from typing import List, Annotated
from decimal import Decimal
from typing import List, Annotated

from app.config import get_settings
from app.database import get_db
from app.models.bonus_account import BonusAccount
from app.models.bonus_transaction import BonusTransaction
from app.models.concession_item import ConcessionItem
from app.models.concession_preorder import ConcessionPreorder
from app.models.enums import (
    OrderStatus, TicketStatus, PaymentStatus, SalesChannel,
    BonusTransactionType, PaymentMethod, PreorderStatus
)
from app.models.order import Order
from app.models.payment import Payment
from app.models.seat import Seat
from app.models.session import Session
from app.models.ticket import Ticket
from app.models.user import User
from app.routers.auth import get_current_active_user
from app.schemas.order import OrderCreate, OrderWithTickets, OrderWithTicketsAndPayment, PaymentResponsePublic, \
    ConcessionPreorderResponse, ConcessionItemResponse, OrderCountsResponse
from app.schemas.ticket import TicketResponse
from app.services.promocode_service import validate_promocode, increment_usage
from app.utils.qr_generator import generate_qr_code, generate_order_qr
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select, and_, func, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from datetime import datetime
import pytz
import secrets
from datetime import timedelta

router = APIRouter()


@router.post("", response_model=OrderWithTickets, status_code=status.HTTP_201_CREATED)
async def create_booking(
    booking_data: OrderCreate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db)
):
    """Create a new booking with tickets."""
    total_amount = Decimal("0.00")
    tickets_to_create = []

    # Validate all tickets and check seat availability
    for ticket_data in booking_data.tickets:
        # Get session
        result = await db.execute(select(Session).filter(Session.id == ticket_data.session_id))
        session = result.scalar_one_or_none()

        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Сеанс с id {ticket_data.session_id} не найден"
            )

        # Check if session is in the past
        moscow_tz = pytz.timezone('Europe/Moscow')
        current_time = datetime.now(moscow_tz).replace(tzinfo=None)
        if session.start_datetime < current_time:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Нельзя забронировать билеты на прошедший сеанс"
            )

        # Get seat
        result = await db.execute(select(Seat).filter(Seat.id == ticket_data.seat_id))
        seat = result.scalar_one_or_none()

        if not seat:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Место с id {ticket_data.seat_id} не найдено"
            )

        # Check if seat is available
        if not seat.is_available:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Место {seat.row_number}-{seat.seat_number} недоступно"
            )

        # Check if seat is already booked for this session with row-level locking to prevent race conditions
        result = await db.execute(
            select(Ticket).filter(
                and_(
                    Ticket.session_id == ticket_data.session_id,
                    Ticket.seat_id == ticket_data.seat_id,
                    Ticket.status.in_([TicketStatus.RESERVED, TicketStatus.PAID])
                )
            ).with_for_update()  # Add row-level locking to prevent race conditions
        )
        existing_ticket = result.scalar_one_or_none()

        if existing_ticket:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Место {seat.row_number}-{seat.seat_number} уже забронировано на этот сеанс"
            )

        # Use session price if not specified
        ticket_price = ticket_data.price if ticket_data.price else session.ticket_price
        total_amount += ticket_price

        tickets_to_create.append({
            "session_id": ticket_data.session_id,
            "seat_id": ticket_data.seat_id,
            "price": ticket_price,
            "sales_channel": ticket_data.sales_channel
        })

    # Apply promocode if provided
    discount_amount = Decimal("0.00")
    promocode_id = None
    promocode = None

    if booking_data.promocode_code:
        # Use the service layer to validate promocode
        validation_result = await validate_promocode(
            db=db,
            code=booking_data.promocode_code,
            order_amount=booking_data.total_order_amount,  # Use total order amount instead of just tickets
            category="ORDER"  # The promocode applies to the entire order (tickets + concessions)
        )

        if not validation_result.is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=validation_result.message
            )

        # Get promocode from validation result
        promocode = validation_result.promocode
        discount_amount = validation_result.discount_amount
        promocode_id = promocode.id

        # Increment usage count (will be committed later with the order)
        await increment_usage(db, promocode)

    # Add concession items to the total amount before applying bonuses
    # This ensures bonus calculations include the full order amount
    if booking_data.concession_preorders:
        for preorder_data in booking_data.concession_preorders:
            # Validate concession item exists
            concession_item_result = await db.execute(
                select(ConcessionItem)
                .filter(ConcessionItem.id == preorder_data.concession_item_id)
            )
            concession_item = concession_item_result.scalar_one_or_none()

            if not concession_item:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Товар из кинобара с id {preorder_data.concession_item_id} не найден"
                )

            if concession_item.stock_quantity < preorder_data.quantity:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Недостаточно товара {preorder_data.concession_item_id} на складе. Доступно: {concession_item.stock_quantity}"
                )

            # Calculate total price for this concession item
            total_price = Decimal(str(preorder_data.unit_price)) * Decimal(str(preorder_data.quantity))

            # Add to the total amount (this includes both tickets and concession items)
            total_amount += total_price

    # Apply bonus points if requested
    bonus_deduction = Decimal("0.00")
    if booking_data.use_bonus_points and booking_data.use_bonus_points > 0:
        result = await db.execute(
            select(BonusAccount).filter(BonusAccount.user_id == current_user.id)
        )
        bonus_account = result.scalar_one_or_none()

        if not bonus_account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Бонусный счет не найден"
            )

        if bonus_account.balance < booking_data.use_bonus_points:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Недостаточно бонусных баллов"
            )

        bonus_deduction = booking_data.use_bonus_points

        # Check bonus deduction limits - using the full order amount (tickets + concessions)
        settings = get_settings()
        max_bonus_amount = (total_amount - discount_amount) * Decimal(settings.BONUS_MAX_PERCENTAGE) / Decimal("100")

        if bonus_deduction > max_bonus_amount:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Вычет бонусов не может превышать {settings.BONUS_MAX_PERCENTAGE}% от суммы заказа после скидок"
            )

        # Deduct bonus points from user's account
        bonus_account.balance -= bonus_deduction

    final_amount = total_amount - discount_amount - bonus_deduction

    # Check minimum payment amount after applying bonuses and discounts
    settings = get_settings()
    if final_amount < Decimal(settings.BONUS_MIN_PAYMENT_AMOUNT):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Окончательная сумма заказа не может быть меньше {settings.BONUS_MIN_PAYMENT_AMOUNT} ₽ после применения бонусов и скидок"
        )

    # Create order
    moscow_tz = pytz.timezone('Europe/Moscow')
    current_time = datetime.now(moscow_tz).replace(tzinfo=None)
    order_number = f"ORD-{current_time.strftime('%Y%m%d')}-{secrets.token_hex(4).upper()}"
    created_time = current_time
    settings = get_settings()
    expiry_time = created_time + timedelta(minutes=settings.ORDER_PAYMENT_TIMEOUT_MINUTES)

    new_order = Order(
        user_id=current_user.id,
        promocode_id=promocode_id,
        order_number=order_number,
        created_at=created_time,
        expires_at=expiry_time,
        total_amount=total_amount,
        discount_amount=discount_amount + bonus_deduction,
        final_amount=final_amount,
        status=OrderStatus.pending_payment
    )

    db.add(new_order)
    await db.flush()

    # Create transaction record for the deduction only if bonus points were used
    if bonus_deduction > 0 and bonus_account:
        bonus_transaction = BonusTransaction(
            bonus_account_id=bonus_account.id,
            order_id=new_order.id,  # Will be updated after order creation
            transaction_date=current_time,  # Use the same creation time as the order
            amount=-bonus_deduction,  # Negative amount to indicate deduction
            transaction_type=BonusTransactionType.DEDUCTION,
        )
        db.add(bonus_transaction)

    # Generate QR code for the order
    order_qr = generate_order_qr(new_order.id)
    new_order.qr_code = order_qr

    # Create tickets
    created_tickets = []
    for ticket_data in tickets_to_create:
        new_ticket = Ticket(
            session_id=ticket_data["session_id"],
            seat_id=ticket_data["seat_id"],
            buyer_id=current_user.id,
            order_id=new_order.id,
            price=ticket_data["price"],
            purchase_date=current_time,
            sales_channel=ticket_data["sales_channel"],
            status=TicketStatus.RESERVED
        )
        db.add(new_ticket)
        created_tickets.append(new_ticket)

    # Process concession preorders separately (after order is created)
    created_concession_preorders = []
    if booking_data.concession_preorders:
        for preorder_data in booking_data.concession_preorders:
            # Calculate total price for this concession item
            total_price = Decimal(str(preorder_data.unit_price)) * Decimal(str(preorder_data.quantity))

            # Create preorder
            new_preorder = ConcessionPreorder(
                order_id=new_order.id,
                concession_item_id=preorder_data.concession_item_id,
                quantity=preorder_data.quantity,
                unit_price=preorder_data.unit_price,
                total_price=total_price,
                status=PreorderStatus.PENDING,
            )

            # Update stock
            concession_item_result = await db.execute(
                select(ConcessionItem)
                .filter(ConcessionItem.id == preorder_data.concession_item_id)
            )
            concession_item = concession_item_result.scalar_one_or_none()
            concession_item.stock_quantity -= preorder_data.quantity

            db.add(new_preorder)
            created_concession_preorders.append(new_preorder)

    await db.commit()
    await db.refresh(new_order)

    # Refresh tickets and preorders to get their IDs
    for ticket in created_tickets:
        await db.refresh(ticket)

    for preorder in created_concession_preorders:
        await db.refresh(preorder)

    # Fetch the complete order with related data for response
    complete_order_result = await db.execute(
        select(Order)
        .options(selectinload(Order.tickets).selectinload(Ticket.session).selectinload(Session.film))
        .options(selectinload(Order.tickets).selectinload(Ticket.seat))
        .options(selectinload(Order.promocode))
        .options(selectinload(Order.concession_preorders).selectinload(ConcessionPreorder.concession_item))
        .filter(Order.id == new_order.id)
    )
    complete_order = complete_order_result.scalar_one()

    # Create response with both tickets and concession preorders
    return OrderWithTicketsAndPayment(
        id=complete_order.id,
        user_id=complete_order.user_id,
        promocode_id=complete_order.promocode_id,
        order_number=complete_order.order_number,
        created_at=complete_order.created_at,
        expires_at=complete_order.expires_at,
        total_amount=complete_order.total_amount,
        discount_amount=complete_order.discount_amount,
        final_amount=complete_order.final_amount,
        status=complete_order.status,
        qr_code=complete_order.qr_code,
        tickets=[TicketResponse.model_validate(ticket) for ticket in complete_order.tickets],
        payment=None,  # Payment will be created later when order is paid
        concession_preorders=[ConcessionPreorderResponse.model_validate(preorder) for preorder in complete_order.concession_preorders]
    )


def determine_order_status(order: Order, session_datetime: datetime) -> OrderStatus:
    """Determine if an order should be considered active or past based on status and session time."""
    moscow_tz = pytz.timezone('Europe/Moscow')
    current_time = datetime.now(moscow_tz).replace(tzinfo=None)

    # Check if session has ended
    session_ended = session_datetime < current_time

    # Orders that are waiting for payment or paid and session hasn't ended are active
    if order.status in [OrderStatus.created, OrderStatus.pending_payment, OrderStatus.paid] and not session_ended:
        return order.status  # Return the actual status for display
    else:
        return order.status  # Return the actual status for display


def is_order_active(order: Order, earliest_session_time: datetime) -> bool:
    """Determine if an order should be considered active from user's perspective."""
    moscow_tz = pytz.timezone('Europe/Moscow')
    current_time = datetime.now(moscow_tz).replace(tzinfo=None)

    # Check if session has ended
    session_ended = earliest_session_time < current_time

    # Orders that are waiting for payment or paid and session hasn't ended are active
    if order.status in [OrderStatus.created, OrderStatus.pending_payment, OrderStatus.paid] and not session_ended:
        return True
    else:
        return False


@router.get("/my/counts", response_model=OrderCountsResponse)
async def get_my_orders_counts(
        current_user: Annotated[User, Depends(get_current_active_user)],
        db: AsyncSession = Depends(get_db)
):
    """Get count of active and past orders for current user."""
    from datetime import datetime
    import pytz

    # Define the current time in Moscow timezone
    moscow_tz = pytz.timezone('Europe/Moscow')
    current_time = datetime.now(moscow_tz).replace(tzinfo=None)

    # Get all user's orders
    orders_result = await db.execute(
        select(Order).filter(Order.user_id == current_user.id)
    )
    orders = orders_result.scalars().all()

    # Create a list of order IDs to fetch related sessions in one query
    order_ids = [order.id for order in orders]

    if order_ids:
        # Get session datetimes for all orders with sessions in one query
        sessions_result = await db.execute(
            select(Ticket.order_id, func.min(Session.start_datetime).label('earliest_session_time'))
            .join(Session, Ticket.session_id == Session.id)
            .filter(Ticket.order_id.in_(order_ids))
            .group_by(Ticket.order_id)
        )
        order_session_times = {row.order_id: row.earliest_session_time for row in sessions_result.fetchall()}
    else:
        order_session_times = {}

    active_count = 0
    past_count = 0

    for order in orders:
        if order.id in order_session_times and order_session_times[order.id]:
            earliest_session_time = order_session_times[order.id]
            # Check if session has ended
            session_ended = earliest_session_time < current_time
            # Orders are active if they have active statuses and session hasn't ended
            if order.status in [OrderStatus.created, OrderStatus.pending_payment, OrderStatus.paid] and not session_ended:
                active_count += 1
            elif order.status in [OrderStatus.completed] and not session_ended:
                # Even completed orders are active if the session hasn't ended yet
                active_count += 1
            else:
                # All other orders with sessions are past
                past_count += 1
        else:
            # If no sessions found for order, consider it active if it's not cancelled/refunded/completed
            if order.status not in [OrderStatus.cancelled, OrderStatus.refunded, OrderStatus.completed]:
                active_count += 1
            else:
                past_count += 1

    return OrderCountsResponse(
        active=active_count,
        past=past_count,
        total=active_count + past_count
    )


@router.get("/my/active/count", response_model=int)
async def get_my_active_orders_count(
        current_user: Annotated[User, Depends(get_current_active_user)],
        db: AsyncSession = Depends(get_db)
):
    """Get count of active orders for current user."""
    from datetime import datetime
    import pytz

    # Define the current time in Moscow timezone
    moscow_tz = pytz.timezone('Europe/Moscow')
    current_time = datetime.now(moscow_tz).replace(tzinfo=None)

    # Get all user's orders
    orders_result = await db.execute(
        select(Order).filter(Order.user_id == current_user.id)
    )
    orders = orders_result.scalars().all()

    # Create a list of order IDs to fetch related sessions in one query
    order_ids = [order.id for order in orders]

    if order_ids:
        # Get session datetimes for all orders with sessions in one query
        sessions_result = await db.execute(
            select(Ticket.order_id, func.min(Session.start_datetime).label('earliest_session_time'))
            .join(Session, Ticket.session_id == Session.id)
            .filter(Ticket.order_id.in_(order_ids))
            .group_by(Ticket.order_id)
        )
        order_session_times = {row.order_id: row.earliest_session_time for row in sessions_result.fetchall()}
    else:
        order_session_times = {}

    active_count = 0

    for order in orders:
        if order.id in order_session_times and order_session_times[order.id]:
            earliest_session_time = order_session_times[order.id]
            # Check if session has ended
            session_ended = earliest_session_time < current_time
            # Orders are active if they have active statuses and session hasn't ended
            if order.status in [OrderStatus.created, OrderStatus.pending_payment, OrderStatus.paid] and not session_ended:
                active_count += 1
            elif order.status in [OrderStatus.completed] and not session_ended:
                # Even completed orders are active if the session hasn't ended yet
                active_count += 1
        else:
            # If no sessions found for order, consider it active if it's not cancelled/refunded/completed
            if order.status not in [OrderStatus.cancelled, OrderStatus.refunded, OrderStatus.completed]:
                active_count += 1

    return active_count


@router.get("/my/past/count", response_model=int)
async def get_my_past_orders_count(
        current_user: Annotated[User, Depends(get_current_active_user)],
        db: AsyncSession = Depends(get_db)
):
    """Get count of past orders for current user."""
    from datetime import datetime
    import pytz

    # Define the current time in Moscow timezone
    moscow_tz = pytz.timezone('Europe/Moscow')
    current_time = datetime.now(moscow_tz).replace(tzinfo=None)

    # Get all user's orders
    orders_result = await db.execute(
        select(Order).filter(Order.user_id == current_user.id)
    )
    orders = orders_result.scalars().all()

    # Create a list of order IDs to fetch related sessions in one query
    order_ids = [order.id for order in orders]

    if order_ids:
        # Get session datetimes for all orders with sessions in one query
        sessions_result = await db.execute(
            select(Ticket.order_id, func.min(Session.start_datetime).label('earliest_session_time'))
            .join(Session, Ticket.session_id == Session.id)
            .filter(Ticket.order_id.in_(order_ids))
            .group_by(Ticket.order_id)
        )
        order_session_times = {row.order_id: row.earliest_session_time for row in sessions_result.fetchall()}
    else:
        order_session_times = {}

    past_count = 0

    for order in orders:
        if order.id in order_session_times and order_session_times[order.id]:
            earliest_session_time = order_session_times[order.id]
            # Check if session has ended
            session_ended = earliest_session_time < current_time
            # Orders are past if session has ended OR if they have past statuses
            if session_ended or order.status in [OrderStatus.cancelled, OrderStatus.refunded, OrderStatus.completed]:
                past_count += 1
        else:
            # If no sessions found for order, consider it past if it's cancelled/refunded/completed
            if order.status in [OrderStatus.cancelled, OrderStatus.refunded, OrderStatus.completed]:
                past_count += 1

    return past_count


@router.post("/{order_id}/cancel", status_code=status.HTTP_200_OK)
async def cancel_pending_order(
    order_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db)
):
    """Cancel a pending order before payment is completed."""
    # Get the order and verify it belongs to the current user
    result = await db.execute(
        select(Order)
        .options(selectinload(Order.tickets).selectinload(Ticket.session))
        .options(selectinload(Order.payment))
        .options(selectinload(Order.concession_preorders).selectinload(ConcessionPreorder.concession_item))
        .filter(and_(Order.id == order_id, Order.user_id == current_user.id))
    )
    order = result.scalar_one_or_none()

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Заказ не найден или не принадлежит текущему пользователю"
        )

    # Check if the order can be cancelled (must be in pending_payment status)
    if order.status != OrderStatus.pending_payment:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Отмена возможна только для заказов в ожидании оплаты"
        )

    # Cancel the order
    order.status = OrderStatus.cancelled

    # Update ticket statuses back to available
    tickets_result = await db.execute(
        select(Ticket).filter(Ticket.order_id == order.id)
    )
    tickets = tickets_result.scalars().all()

    for ticket in tickets:
        ticket.status = TicketStatus.CANCELLED  # Return to available since payment wasn't completed

    # Update concession preorders
    preorders_result = await db.execute(
        select(ConcessionPreorder).filter(ConcessionPreorder.order_id == order.id)
    )
    preorders = preorders_result.scalars().all()

    for preorder in preorders:
        # Return items to inventory by changing status back
        preorder.status = PreorderStatus.CANCELLED
        # Update concession item quantity to return stock
        from app.models.concession_item import ConcessionItem
        await db.execute(
            update(ConcessionItem)
            .where(ConcessionItem.id == preorder.concession_item_id)
            .values(stock_quantity=ConcessionItem.stock_quantity + preorder.quantity)
        )

    # Return bonus points that were used for the order if any
    bonus_account_result = await db.execute(
        select(BonusAccount).filter(BonusAccount.user_id == current_user.id)
    )
    bonus_account = bonus_account_result.scalar_one_or_none()

    if bonus_account:
        # Find bonus transactions related to this order that were for deductions
        bonus_deduction_transactions = await db.execute(
            select(BonusTransaction).filter(
                and_(
                    BonusTransaction.bonus_account_id == bonus_account.id,
                    BonusTransaction.order_id == order.id,
                    BonusTransaction.transaction_type == BonusTransactionType.DEDUCTION
                )
            )
        )
        deduction_transactions = bonus_deduction_transactions.scalars().all()

        moscow_tz = pytz.timezone('Europe/Moscow')
        current_time = datetime.now(moscow_tz).replace(tzinfo=None)

        # Return each deduction by adding back to balance and creating accrual transaction
        for deduction_tx in deduction_transactions:
            # Add back the deducted amount to the user's bonus account
            bonus_account.balance += abs(deduction_tx.amount)

            # Create bonus transaction record for return of the originally deducted points
            bonus_return_transaction = BonusTransaction(
                bonus_account_id=bonus_account.id,
                order_id=order.id,  # Link to the order being cancelled
                transaction_date=current_time,
                amount=abs(deduction_tx.amount),
                transaction_type=BonusTransactionType.ACCRUAL,
            )
            db.add(bonus_return_transaction)

        # Also remove any bonus points that were accrued for this order
        # (if a system gives bonuses for making orders, but order gets cancelled)
        bonus_accrual_transactions = await db.execute(
            select(BonusTransaction).filter(
                and_(
                    BonusTransaction.bonus_account_id == bonus_account.id,
                    BonusTransaction.order_id == order.id,
                    BonusTransaction.transaction_type == BonusTransactionType.ACCRUAL
                )
            )
        )
        accrual_transactions = bonus_accrual_transactions.scalars().all()

        for accrual_tx in accrual_transactions:
            # Subtract the accrued amount from the user's bonus account
            bonus_account.balance -= accrual_tx.amount

            # Create bonus transaction record for the removal of accrued points
            bonus_removal_transaction = BonusTransaction(
                bonus_account_id=bonus_account.id,
                order_id=order.id,  # Link to the order being cancelled
                transaction_date=current_time,
                amount=-accrual_tx.amount,  # Negative amount to indicate removal
                transaction_type=BonusTransactionType.DEDUCTION,
                description=f"Удаление бонусов при отмене заказа {order.order_number}"
            )
            db.add(bonus_removal_transaction)

    await db.commit()

    return {
        "message": "Order cancelled successfully",
        "order_id": order_id
    }


@router.post("/{order_id}/return", status_code=status.HTTP_200_OK)
async def return_order(
    order_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db)
):
    """Return an order and process refund according to the rules."""
    # Get the order and verify it belongs to the current user
    result = await db.execute(
        select(Order)
        .options(selectinload(Order.tickets).selectinload(Ticket.session))
        .options(selectinload(Order.payment))
        .options(selectinload(Order.concession_preorders).selectinload(ConcessionPreorder.concession_item))
        .filter(and_(Order.id == order_id, Order.user_id == current_user.id))
    )
    order = result.scalar_one_or_none()

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Заказ не найден или не принадлежит текущему пользователю"
        )

    # Check if the order can be returned (must be paid or pending_payment)
    if order.status not in [OrderStatus.paid]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Возврат возможен только для оплаченных заказов"
        )

    # Get all tickets and preorders for validation
    tickets_result = await db.execute(
        select(Ticket).filter(Ticket.order_id == order.id)
    )
    tickets = tickets_result.scalars().all()

    # Check if any tickets have already been used
    used_tickets = [ticket for ticket in tickets if ticket.status == TicketStatus.USED]
    if used_tickets:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Невозможно вернуть заказ с использованными билетами. {len(used_tickets)} билет(ов) уже использован(ы)."
        )

    # Get all preorders and check if any have been completed
    preorders_result = await db.execute(
        select(ConcessionPreorder).filter(ConcessionPreorder.order_id == order.id)
    )
    preorders = preorders_result.scalars().all()

    completed_preorders = [preorder for preorder in preorders if preorder.status == PreorderStatus.COMPLETED]
    if completed_preorders:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Невозможно вернуть заказ с выданными товарами из кинобара. {len(completed_preorders)} товар(ов) уже выдан(ы)."
        )

    # Find the earliest session datetime for this order
    ticket_sessions_result = await db.execute(
        select(Session.start_datetime)
        .join(Ticket, Ticket.session_id == Session.id)
        .filter(Ticket.order_id == order.id)
        .order_by(Session.start_datetime.asc())
    )
    session_datetimes = ticket_sessions_result.scalars().all()

    if not session_datetimes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="У заказа нет связанных сеансов"
        )

    earliest_session_time = min(session_datetimes)

    # Calculate time until session
    moscow_tz = pytz.timezone('Europe/Moscow')
    current_time = datetime.now(moscow_tz).replace(tzinfo=None)
    time_to_session = earliest_session_time - current_time

    # Check if session starts in less than 10 minutes - don't allow return
    if time_to_session.total_seconds() < 600:  # 600 seconds = 10 minutes
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Невозможно вернуть заказ: сеанс начинается менее чем через 10 минут"
        )

    # Calculate refund percentage based on user requirements
    if time_to_session.days < 1:
        refund_percentage = Decimal("0.10")  # 10% return if less than 1 day to session
    elif time_to_session.days <= 7:  # 1-7 days
        refund_percentage = Decimal("0.95")  # 95% return
    else:
        refund_percentage = Decimal("1.00")  # 100% return if more than 7 days

    # Calculate refund amount
    total_refund_amount = order.final_amount * refund_percentage

    # Process the return
    # 1. Cancel all tickets (tickets already fetched above)
    for ticket in tickets:
        ticket.status = TicketStatus.CANCELLED

    # 2. Return concession preorders to inventory (preorders already fetched above)
    for preorder in preorders:
        # Return items to inventory by changing status back
        preorder.status = PreorderStatus.CANCELLED
        # Update concession item quantity
        concession_item_result = await db.execute(
            select(ConcessionItem).filter(ConcessionItem.id == preorder.concession_item_id)
        )
        concession_item = concession_item_result.scalar_one_or_none()
        if concession_item:
            concession_item.stock_quantity += preorder.quantity

    # 3. Process bonus return - return bonuses that were used for the order and remove bonuses that were accrued for the order
    bonus_account_result = await db.execute(
        select(BonusAccount).filter(BonusAccount.user_id == current_user.id)
    )
    bonus_account = bonus_account_result.scalar_one_or_none()

    if bonus_account:
        # Return any bonus points that were used for discounts on this order
        if order.discount_amount > Decimal("0.00"):
            # Find bonus transactions related to this order that were for deductions
            bonus_deduction_transactions = await db.execute(
                select(BonusTransaction).filter(
                    and_(
                        BonusTransaction.bonus_account_id == bonus_account.id,
                        BonusTransaction.order_id == order.id,
                        BonusTransaction.transaction_type == BonusTransactionType.DEDUCTION
                    )
                )
            )
            deduction_transactions = bonus_deduction_transactions.scalars().all()

            # Return each deduction by creating accrual transactions
            for deduction_tx in deduction_transactions:
                # Add back the deducted amount to the user's bonus account
                bonus_account.balance += abs(deduction_tx.amount)

                # Create bonus transaction record for return of the originally deducted points
                bonus_return_transaction = BonusTransaction(
                    bonus_account_id=bonus_account.id,
                    order_id=order.id,  # Link to the order being returned
                    transaction_date=current_time,
                    amount=abs(deduction_tx.amount),
                    transaction_type=BonusTransactionType.ACCRUAL,
                )
                db.add(bonus_return_transaction)

        # Also remove any bonus points that were accrued for this order
        bonus_accrual_transactions = await db.execute(
            select(BonusTransaction).filter(
                and_(
                    BonusTransaction.bonus_account_id == bonus_account.id,
                    BonusTransaction.order_id == order.id,
                    BonusTransaction.transaction_type == BonusTransactionType.ACCRUAL
                )
            )
        )
        accrual_transactions = bonus_accrual_transactions.scalars().all()

        for accrual_tx in accrual_transactions:
            # Subtract the accrued amount from the user's bonus account
            bonus_account.balance -= accrual_tx.amount

            # Create bonus transaction record for the removal of accrued points
            bonus_removal_transaction = BonusTransaction(
                bonus_account_id=bonus_account.id,
                order_id=order.id,  # Link to the order being returned
                transaction_date=current_time,
                amount=-accrual_tx.amount,  # Negative amount to indicate removal
                transaction_type=BonusTransactionType.DEDUCTION,
            )
            db.add(bonus_removal_transaction)

    # 4. Process refund to original payment method
    if order.status == OrderStatus.paid:
        # Note: In a real system, you'd need to interact with payment gateway to process actual refund
        # For now, we'll create a refund payment record to track the refund

        # Get the original payment that was made for this order
        original_payment_result = await db.execute(
            select(Payment)
            .filter(Payment.order_id == order.id)
            .order_by(Payment.payment_date.desc())
        )
        payments = original_payment_result.scalars().all()
        original_payment = payments[0] if payments else None

        if original_payment:
            # Create a refund payment record

            moscow_tz = pytz.timezone('Europe/Moscow')
            refund_time = datetime.now(moscow_tz).replace(tzinfo=None)
            refund_transaction_id = f"REF-{refund_time.strftime('%Y%m%d%H%M%S')}-{secrets.token_hex(4).upper()}"

            refund_payment = Payment(
                order_id=order.id,
                payment_date=refund_time,
                amount=total_refund_amount,  # Negative amount for refund
                payment_method=original_payment.payment_method,  # Same payment method as original
                transaction_id=refund_transaction_id,
                status=PaymentStatus.REFUNDED,
                card_last_four=original_payment.card_last_four,  # Same card for reference
            )
            db.add(refund_payment)

    # 5. Update order status to refunded
    # Keep order amounts unchanged - they should reflect the original order value including concessions
    order.status = OrderStatus.refunded

    # Commit all changes
    await db.commit()

    return {
        "message": "Order returned successfully",
        "refund_amount": float(total_refund_amount),
        "refund_percentage": float(refund_percentage) * 100
    }


@router.get("/qr/{qr_code}")
async def get_order_by_qr(
    qr_code: str,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db)
):
    """Get order by QR code - for admin/controller use."""
    # First, check if QR code matches an order
    result = await db.execute(
        select(Order)
        .options(selectinload(Order.tickets).selectinload(Ticket.session).selectinload(Session.film))
        .options(selectinload(Order.tickets).selectinload(Ticket.seat))
        .options(selectinload(Order.concession_preorders).selectinload(ConcessionPreorder.concession_item))
        .filter(Order.qr_code == qr_code)
    )
    order = result.scalar_one_or_none()

    if not order:
        # If no order found with this QR code, look for tickets with this QR code
        ticket_result = await db.execute(
            select(Ticket).filter(Ticket.qr_code == qr_code)
        )
        ticket = ticket_result.scalar_one_or_none()

        if ticket:
            # Get the order associated with this ticket
            order_result = await db.execute(
                select(Order)
                .options(selectinload(Order.tickets).selectinload(Ticket.session).selectinload(Session.film))
                .options(selectinload(Order.tickets).selectinload(Ticket.seat))
                .options(selectinload(Order.concession_preorders).selectinload(ConcessionPreorder.concession_item))
                .filter(Order.id == ticket.order_id)
            )
            order = order_result.scalar_one_or_none()

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Заказ или билет не найден"
        )

    # Get all tickets and concession preorders for this order
    tickets_result = await db.execute(
        select(Ticket).filter(Ticket.order_id == order.id)
    )
    tickets = tickets_result.scalars().all()

    preorders_result = await db.execute(
        select(ConcessionPreorder)
        .options(selectinload(ConcessionPreorder.concession_item))
        .filter(ConcessionPreorder.order_id == order.id)
    )
    concession_preorders = preorders_result.scalars().all()

    # Format response
    return OrderWithTicketsAndPayment(
        id=order.id,
        user_id=order.user_id,
        promocode_id=order.promocode_id,
        order_number=order.order_number,
        created_at=order.created_at,
        expires_at=order.expires_at,
        total_amount=order.total_amount,
        discount_amount=order.discount_amount,
        final_amount=order.final_amount,
        status=order.status,
        qr_code=order.qr_code,
        tickets=[TicketResponse.model_validate(ticket) for ticket in tickets],
        concession_preorders=[
            ConcessionPreorderResponse(
                id=p.id,
                order_id=p.order_id,
                concession_item_id=p.concession_item_id,
                quantity=p.quantity,
                unit_price=p.unit_price,
                total_price=p.total_price,
                status=p.status,
                pickup_code=p.pickup_code,
                pickup_date=p.pickup_date,
                concession_item=ConcessionItemResponse.model_validate(p.concession_item) if p.concession_item else None
            ) for p in concession_preorders
        ],
        payment=None  # Payment info not needed for this view
    )


@router.get("/pickup/{pickup_code}")
async def get_orders_by_pickup_code(
    pickup_code: str,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db)
):
    """Get orders by pickup code for concession staff."""
    result = await db.execute(
        select(ConcessionPreorder)
        .filter(ConcessionPreorder.pickup_code == pickup_code)
        .options(selectinload(ConcessionPreorder.order).selectinload(Order.tickets).selectinload(Ticket.session).selectinload(Session.film))
        .options(selectinload(ConcessionPreorder.order).selectinload(Order.tickets).selectinload(Ticket.seat))
        .options(selectinload(ConcessionPreorder.concession_item))
    )
    preorders = result.scalars().all()

    if not preorders:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Заказы с этим кодом получения не найдены"
        )

    # Get unique orders associated with these preorders
    order_ids = {p.order_id for p in preorders}
    orders_data = []

    for order_id in order_ids:
        order_result = await db.execute(
            select(Order)
            .filter(Order.id == order_id)
        )
        order = order_result.scalar_one_or_none()

        if order:
            # Get all tickets and concession preorders for this order
            tickets_result = await db.execute(
                select(Ticket).filter(Ticket.order_id == order.id)
            )
            tickets = tickets_result.scalars().all()

            all_preorders_result = await db.execute(
                select(ConcessionPreorder)
                .options(selectinload(ConcessionPreorder.concession_item))
                .filter(ConcessionPreorder.order_id == order.id)
            )
            all_concession_preorders = all_preorders_result.scalars().all()

            order_data = OrderWithTicketsAndPayment(
                id=order.id,
                user_id=order.user_id,
                promocode_id=order.promocode_id,
                order_number=order.order_number,
                created_at=order.created_at,
                expires_at=order.expires_at,
                total_amount=order.total_amount,
                discount_amount=order.discount_amount,
                final_amount=order.final_amount,
                status=order.status,
                qr_code=order.qr_code,
                tickets=[TicketResponse.model_validate(ticket) for ticket in tickets],
                concession_preorders=[
                    ConcessionPreorderResponse(
                        id=p.id,
                        order_id=p.order_id,
                        concession_item_id=p.concession_item_id,
                        quantity=p.quantity,
                        unit_price=p.unit_price,
                        total_price=p.total_price,
                        status=p.status,
                        pickup_code=p.pickup_code,
                        pickup_date=p.pickup_date,
                        concession_item=ConcessionItemResponse.model_validate(p.concession_item) if p.concession_item else None
                    ) for p in all_concession_preorders
                ],
                payment=None  # Payment info not needed for this view
            )
            orders_data.append(order_data)

    return orders_data



class UpdateOrderStatusRequest(BaseModel):
    status: str


@router.patch("/{order_id}/status")
async def update_order_status(
    order_id: int,
    status_update: UpdateOrderStatusRequest,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db)
):
    """Update order status - for admin use."""
    # Verify user has admin rights
    if current_user.role not in [UserRoles.admin, UserRoles.super_admin, UserRoles.staff]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Только администраторы и сотрудники могут изменять статус заказа"
        )

    # Get the order
    result = await db.execute(
        select(Order).filter(Order.id == order_id)
    )
    order = result.scalar_one_or_none()

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Заказ не найден"
        )

    # Update the status - validate using the enum
    try:
        new_status = OrderStatus(status_update.status)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Недопустимый статус"
        )

    order.status = new_status.value
    await db.commit()
    await db.refresh(order)

    return order


@router.get("/my", response_model=List[OrderWithTicketsAndPayment])
async def get_my_bookings(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db)
):
    """Get all bookings for current user."""
    # This endpoint returns all bookings - keeping for compatibility
    # For paginated version, see get_my_bookings_paginated
    result = await db.execute(
        select(Order)
        .filter(Order.user_id == current_user.id)
        .order_by(Order.created_at.desc())
    )
    orders = result.scalars().all()

    # Get tickets, payment and concession preorders for each order
    orders_with_details = []
    for order in orders:
        # Get tickets
        result = await db.execute(
            select(Ticket).filter(Ticket.order_id == order.id)
        )
        tickets = result.scalars().all()

        # Get payment
        result = await db.execute(
            select(Payment).filter(Payment.order_id == order.id)
        )
        payment = result.scalar_one_or_none()

        # Get concession preorders
        result = await db.execute(
            select(ConcessionPreorder)
            .options(selectinload(ConcessionPreorder.concession_item))
            .filter(ConcessionPreorder.order_id == order.id)
        )
        concession_preorders = result.scalars().all()

        # Create payment response if payment exists
        payment_response = None
        if payment:
            payment_response = PaymentResponsePublic(
                id=payment.id,
                order_id=payment.order_id,
                status=payment.status.value,
                payment_method=payment.payment_method.value,
                transaction_id=payment.transaction_id,
                card_last_four=payment.card_last_four,
                payment_date=payment.payment_date,
                amount=payment.amount
            )

        # Create concession preorder responses
        concession_responses = []
        for preorder in concession_preorders:
            concession_item_response = None
            if preorder.concession_item:
                concession_item_response = ConcessionItemResponse(
                    id=preorder.concession_item.id,
                    name=preorder.concession_item.name,
                    description=preorder.concession_item.description,
                    price=preorder.concession_item.price,
                    category_id=preorder.concession_item.category_id
                )

            concession_responses.append(
                ConcessionPreorderResponse(
                    id=preorder.id,
                    order_id=preorder.order_id,
                    concession_item_id=preorder.concession_item_id,
                    quantity=preorder.quantity,
                    unit_price=preorder.unit_price,
                    total_price=preorder.total_price,
                    status=preorder.status.value,
                    pickup_code=preorder.pickup_code,
                    pickup_date=preorder.pickup_date,
                    concession_item=concession_item_response
                )
            )

        orders_with_details.append(OrderWithTicketsAndPayment(
            id=order.id,
            user_id=order.user_id,
            promocode_id=order.promocode_id,
            order_number=order.order_number,
            created_at=order.created_at,
            expires_at=order.expires_at,
            total_amount=order.total_amount,
            discount_amount=order.discount_amount,
            final_amount=order.final_amount,
            status=order.status,
            qr_code=order.qr_code,  # Add QR code to response
            tickets=[TicketResponse.model_validate(ticket) for ticket in tickets],
            payment=payment_response,
            concession_preorders=concession_responses
        ))

    return orders_with_details


@router.get("/my/paginated", response_model=List[OrderWithTicketsAndPayment])
async def get_my_bookings_paginated(
    current_user: Annotated[User, Depends(get_current_active_user)],
    skip: int = 0,
    limit: int = 20,
    db: AsyncSession = Depends(get_db)
):
    """Get paginated bookings for current user."""
    result = await db.execute(
        select(Order)
        .filter(Order.user_id == current_user.id)
        .offset(skip)
        .limit(limit)
        .order_by(Order.created_at.desc())
    )
    orders = result.scalars().all()

    # Get tickets, payment and concession preorders for each order
    orders_with_details = []
    for order in orders:
        # Get tickets
        result = await db.execute(
            select(Ticket).filter(Ticket.order_id == order.id)
        )
        tickets = result.scalars().all()

        # Get the most recent payment for the order
        result = await db.execute(
            select(Payment)
            .filter(Payment.order_id == order.id)
            .order_by(Payment.payment_date.desc())
        )
        payment = result.scalars().first()  # Get the most recent payment or None

        # Get concession preorders
        result = await db.execute(
            select(ConcessionPreorder)
            .options(selectinload(ConcessionPreorder.concession_item))
            .filter(ConcessionPreorder.order_id == order.id)
        )
        concession_preorders = result.scalars().all()

        # Create payment response if payment exists
        payment_response = None
        if payment:
            payment_response = PaymentResponsePublic(
                id=payment.id,
                order_id=payment.order_id,
                status=payment.status.value,
                payment_method=payment.payment_method.value,
                transaction_id=payment.transaction_id,
                card_last_four=payment.card_last_four,
                payment_date=payment.payment_date,
                amount=payment.amount
            )

        # Create concession preorder responses
        concession_responses = []
        for preorder in concession_preorders:
            concession_item_response = None
            if preorder.concession_item:
                concession_item_response = ConcessionItemResponse(
                    id=preorder.concession_item.id,
                    name=preorder.concession_item.name,
                    description=preorder.concession_item.description,
                    price=preorder.concession_item.price,
                    category_id=preorder.concession_item.category_id
                )

            concession_responses.append(
                ConcessionPreorderResponse(
                    id=preorder.id,
                    order_id=preorder.order_id,
                    concession_item_id=preorder.concession_item_id,
                    quantity=preorder.quantity,
                    unit_price=preorder.unit_price,
                    total_price=preorder.total_price,
                    status=preorder.status.value,
                    pickup_code=preorder.pickup_code,
                    pickup_date=preorder.pickup_date,
                    concession_item=concession_item_response
                )
            )

        orders_with_details.append(OrderWithTicketsAndPayment(
            id=order.id,
            user_id=order.user_id,
            promocode_id=order.promocode_id,
            order_number=order.order_number,
            created_at=order.created_at,
            expires_at=order.expires_at,
            total_amount=order.total_amount,
            discount_amount=order.discount_amount,
            final_amount=order.final_amount,
            status=order.status,
            qr_code=order.qr_code,  # Add QR code to response
            tickets=[TicketResponse.model_validate(ticket) for ticket in tickets],
            payment=payment_response,
            concession_preorders=concession_responses
        ))

    return orders_with_details


@router.get("/my/active", response_model=List[OrderWithTicketsAndPayment])
async def get_my_active_orders(
    current_user: Annotated[User, Depends(get_current_active_user)],
    skip: int = 0,
    limit: int = 20,
    db: AsyncSession = Depends(get_db)
):
    """Get paginated active orders for current user."""
    moscow_tz = pytz.timezone('Europe/Moscow')
    current_time = datetime.now(moscow_tz).replace(tzinfo=None)

    # First, get all user's orders with related data to determine which are active
    all_orders_result = await db.execute(
        select(Order)
        .filter(Order.user_id == current_user.id)
        .options(selectinload(Order.tickets).selectinload(Ticket.session))
        .options(selectinload(Order.payment))
        .options(selectinload(Order.concession_preorders).selectinload(ConcessionPreorder.concession_item))
        .order_by(Order.created_at.desc())
    )
    all_orders = all_orders_result.scalars().all()

    # Determine which orders are active
    active_orders = []
    for order in all_orders:
        # Get the earliest session datetime for this order
        ticket_sessions_result = await db.execute(
            select(Session.start_datetime)
            .join(Ticket, Ticket.session_id == Session.id)
            .filter(Ticket.order_id == order.id)
            .order_by(Session.start_datetime.asc())
        )
        session_datetimes = ticket_sessions_result.scalars().all()

        is_active = False
        if session_datetimes:
            earliest_session_time = min(session_datetimes)
            # Check if session has ended
            session_ended = earliest_session_time < current_time
            # Orders that are in active states and session hasn't ended are active
            if order.status in [OrderStatus.created, OrderStatus.pending_payment, OrderStatus.paid] and not session_ended:
                is_active = True
            elif order.status in [OrderStatus.completed] and not session_ended:
                # Even completed orders are active if the session hasn't ended yet
                is_active = True
        else:
            # If no sessions found for order, consider it active if it's not cancelled/refunded/completed
            is_active = order.status not in [OrderStatus.cancelled, OrderStatus.refunded, OrderStatus.completed]

        if is_active:
            active_orders.append(order)

    # Apply pagination to active orders - get the slice we want
    paginated_active_orders = active_orders[skip:skip + limit]

    orders_with_details = []
    for order in paginated_active_orders:
        # Get tickets with session and seat details
        tickets_result = await db.execute(
            select(Ticket)
            .options(selectinload(Ticket.session).selectinload(Session.film))
            .options(selectinload(Ticket.seat))
            .filter(Ticket.order_id == order.id)
        )
        tickets = tickets_result.scalars().all()

        # Get the most recent payment for the order (active orders method)
        payment_result = await db.execute(
            select(Payment)
            .filter(Payment.order_id == order.id)
            .order_by(Payment.payment_date.desc())
        )
        payment = payment_result.scalars().first()  # Get the most recent payment or None

        # Get concession preorders
        concession_result = await db.execute(
            select(ConcessionPreorder)
            .options(selectinload(ConcessionPreorder.concession_item))
            .filter(ConcessionPreorder.order_id == order.id)
        )
        concession_preorders = concession_result.scalars().all()

        # Create payment response if payment exists
        payment_response = None
        if payment:
            payment_response = PaymentResponsePublic(
                id=payment.id,
                order_id=payment.order_id,
                status=payment.status.value,
                payment_method=payment.payment_method.value,
                transaction_id=payment.transaction_id,
                card_last_four=payment.card_last_four,
                payment_date=payment.payment_date,
                amount=payment.amount
            )

        # Create concession preorder responses
        concession_responses = []
        for preorder in concession_preorders:
            concession_item_response = None
            if preorder.concession_item:
                concession_item_response = ConcessionItemResponse(
                    id=preorder.concession_item.id,
                    name=preorder.concession_item.name,
                    description=preorder.concession_item.description,
                    price=preorder.concession_item.price,
                    category_id=preorder.concession_item.category_id
                )

            concession_responses.append(
                ConcessionPreorderResponse(
                    id=preorder.id,
                    order_id=preorder.order_id,
                    concession_item_id=preorder.concession_item_id,
                    quantity=preorder.quantity,
                    unit_price=preorder.unit_price,
                    total_price=preorder.total_price,
                    status=preorder.status.value,
                    pickup_code=preorder.pickup_code,
                    pickup_date=preorder.pickup_date,
                    concession_item=concession_item_response
                )
            )

        orders_with_details.append(OrderWithTicketsAndPayment(
            id=order.id,
            user_id=order.user_id,
            promocode_id=order.promocode_id,
            order_number=order.order_number,
            created_at=order.created_at,
            expires_at=order.expires_at,
            total_amount=order.total_amount,
            discount_amount=order.discount_amount,
            final_amount=order.final_amount,
            status=order.status,
            qr_code=order.qr_code,  # Add QR code to response
            tickets=[TicketResponse.model_validate(ticket) for ticket in tickets],
            payment=payment_response,
            concession_preorders=concession_responses
        ))

    return orders_with_details


@router.get("/my/past", response_model=List[OrderWithTicketsAndPayment])
async def get_my_past_orders(
    current_user: Annotated[User, Depends(get_current_active_user)],
    skip: int = 0,
    limit: int = 20,
    db: AsyncSession = Depends(get_db)
):
    """Get paginated past orders for current user."""
    moscow_tz = pytz.timezone('Europe/Moscow')
    current_time = datetime.now(moscow_tz).replace(tzinfo=None)

    # First, get all user's orders with related data to determine which are past
    all_orders_result = await db.execute(
        select(Order)
        .filter(Order.user_id == current_user.id)
        .options(selectinload(Order.tickets).selectinload(Ticket.session))
        .options(selectinload(Order.payment))
        .options(selectinload(Order.concession_preorders).selectinload(ConcessionPreorder.concession_item))
        .order_by(Order.created_at.desc())
    )
    all_orders = all_orders_result.scalars().all()

    # Determine which orders are past
    past_orders = []
    for order in all_orders:
        # Get the earliest session datetime for this order
        ticket_sessions_result = await db.execute(
            select(Session.start_datetime)
            .join(Ticket, Ticket.session_id == Session.id)
            .filter(Ticket.order_id == order.id)
            .order_by(Session.start_datetime.asc())
        )
        session_datetimes = ticket_sessions_result.scalars().all()

        is_past = False
        if session_datetimes:
            earliest_session_time = min(session_datetimes)
            # Check if session has ended
            session_ended = earliest_session_time < current_time
            # Determine if order should be considered past
            # For orders with sessions:
            # - If session ended: order is past (regardless of status, including completed)
            # - If session not ended: only cancelled/refunded orders are past (completed is NOT past if session not ended)
            if session_ended:
                is_past = True  # All orders with ended sessions are past
            elif order.status in [OrderStatus.cancelled, OrderStatus.refunded]:
                is_past = True  # cancelled/refunded orders are past regardless of session time
            else:
                # Session not ended and status is not cancelled/refunded
                # This includes completed orders - they are NOT past if session not ended
                is_past = False
        else:
            # If no sessions found for order, consider it past if it's cancelled/refunded/completed
            is_past = order.status in [OrderStatus.cancelled, OrderStatus.refunded, OrderStatus.completed]

        if is_past:
            past_orders.append(order)

    # Apply pagination to past orders - get the slice we want
    paginated_past_orders = past_orders[skip:skip + limit]

    orders_with_details = []
    for order in paginated_past_orders:
        # Get tickets with session and seat details
        tickets_result = await db.execute(
            select(Ticket)
            .options(selectinload(Ticket.session).selectinload(Session.film))
            .options(selectinload(Ticket.seat))
            .filter(Ticket.order_id == order.id)
        )
        tickets = tickets_result.scalars().all()

        # Get the most recent payment for the order (past orders method)
        payment_result = await db.execute(
            select(Payment)
            .filter(Payment.order_id == order.id)
            .order_by(Payment.payment_date.desc())
        )
        payment = payment_result.scalars().first()  # Get the most recent payment or None

        # Get concession preorders
        concession_result = await db.execute(
            select(ConcessionPreorder)
            .options(selectinload(ConcessionPreorder.concession_item))
            .filter(ConcessionPreorder.order_id == order.id)
        )
        concession_preorders = concession_result.scalars().all()

        # Create payment response if payment exists
        payment_response = None
        if payment:
            payment_response = PaymentResponsePublic(
                id=payment.id,
                order_id=payment.order_id,
                status=payment.status.value,
                payment_method=payment.payment_method.value,
                transaction_id=payment.transaction_id,
                card_last_four=payment.card_last_four,
                payment_date=payment.payment_date,
                amount=payment.amount
            )

        # Create concession preorder responses
        concession_responses = []
        for preorder in concession_preorders:
            concession_item_response = None
            if preorder.concession_item:
                concession_item_response = ConcessionItemResponse(
                    id=preorder.concession_item.id,
                    name=preorder.concession_item.name,
                    description=preorder.concession_item.description,
                    price=preorder.concession_item.price,
                    category_id=preorder.concession_item.category_id
                )

            concession_responses.append(
                ConcessionPreorderResponse(
                    id=preorder.id,
                    order_id=preorder.order_id,
                    concession_item_id=preorder.concession_item_id,
                    quantity=preorder.quantity,
                    unit_price=preorder.unit_price,
                    total_price=preorder.total_price,
                    status=preorder.status.value,
                    pickup_code=preorder.pickup_code,
                    pickup_date=preorder.pickup_date,
                    concession_item=concession_item_response
                )
            )

        orders_with_details.append(OrderWithTicketsAndPayment(
            id=order.id,
            user_id=order.user_id,
            promocode_id=order.promocode_id,
            order_number=order.order_number,
            created_at=order.created_at,
            expires_at=order.expires_at,
            total_amount=order.total_amount,
            discount_amount=order.discount_amount,
            final_amount=order.final_amount,
            status=order.status,
            qr_code=order.qr_code,  # Add QR code to response
            tickets=[TicketResponse.model_validate(ticket) for ticket in tickets],
            payment=payment_response,
            concession_preorders=concession_responses
        ))

    return orders_with_details

#
# @router.get("/my/counts", response_model=OrderCountsResponse)
# async def get_my_orders_counts(
#         current_user: Annotated[User, Depends(get_current_active_user)],
#         db: AsyncSession = Depends(get_db)
# ):
#     """Get count of active and past orders for current user."""
#
#     # Прошедшие заказы (cancelled, refunded, used)
#     past_result = await db.execute(
#         select(func.count(Order.id)).filter(
#             and_(
#                 Order.user_id == current_user.id,
#                 Order.status.in_([
#                     OrderStatus.cancelled,
#                     OrderStatus.refunded,
#                     OrderStatus.USED
#                 ])
#             )
#         )
#     )
#     past_count = past_result.scalar() or 0
#
#     # Активные заказы (created, pending_payment, paid)
#     active_result = await db.execute(
#         select(func.count(Order.id)).filter(
#             and_(
#                 Order.user_id == current_user.id,
#                 Order.status.in_([
#                     OrderStatus.created,
#                     OrderStatus.pending_payment,
#                     OrderStatus.paid
#                 ])
#             )
#         )
#     )
#     active_count = active_result.scalar() or 0
#
#     return OrderCountsResponse(
#         active=active_count,
#         past=past_count,
#         total=active_count + past_count
#     )
