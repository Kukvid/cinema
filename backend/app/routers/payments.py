from typing import Annotated, List
from datetime import datetime
from decimal import Decimal
import secrets
import pytz
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.user import User
from app.models.order import Order
from app.models.payment import Payment
from app.models.ticket import Ticket
from app.models.session import Session
from app.models.hall import Hall
from app.models.bonus_account import BonusAccount
from app.models.bonus_transaction import BonusTransaction
from app.models.enums import (
    OrderStatus, PaymentStatus, PaymentMethod,
    TicketStatus, BonusTransactionType
)
from app.schemas.order import PaymentCreate, PaymentResponse, PaymentResponsePublic
from app.routers.auth import get_current_active_user
from app.utils.qr_generator import generate_qr_code

from app.models.concession_preorder import ConcessionPreorder

router = APIRouter()


@router.post("/{order_id}/process", response_model=PaymentResponse)
async def process_payment(
    order_id: int,
    payment_data: PaymentCreate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db)
):
    """Process payment for an order."""
    # Get order with eager loading of related promocode
    result = await db.execute(
        select(Order)
        .options(selectinload(Order.promocode))
        .filter(Order.id == order_id)
    )
    order = result.scalar_one_or_none()

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Заказ с id {order_id} не найден"
        )

    # Verify order belongs to current user
    if order.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Вы можете оплачивать только свои заказы"
        )

    # Check order status
    if order.status == OrderStatus.paid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Заказ уже оплачен"
        )

    if order.status == OrderStatus.cancelled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя оплатить отменённый заказ"
        )

    # Check for special payment cards before amount validation
    card_number = payment_data.card_number.replace(' ', '') if payment_data.card_number else ""

    # Special test cards
    INFINITE_BALANCE_CARD = "9999888877776666"  # Карта с бесконечным балансом
    FIXED_1500_CARD = "5555444433332222"       # Карта на 1500 руб

    # Validate special cards
    amount_validation_needed = True

    if card_number == INFINITE_BALANCE_CARD:
        # Карта с бесконечным балансом - всегда успешно оплачивает, игнорируем проверку суммы
        amount_validation_needed = False
    elif card_number == FIXED_1500_CARD:
        # Карта на 1500 руб - оплачивает только заказы на 1500 рублей
        if payment_data.amount > Decimal('1500.00'):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Карта фиксированной суммы действительна только для заказов до 1500.00 ₽ (текущий заказ: {payment_data.amount} ₽)"
            )
        amount_validation_needed = False  # Проверка общей суммы уже выполнена

    # Для обычных карт (не специальные) не разрешаем оплату - сообщаем о недостатке средств
    if amount_validation_needed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Недостаточно средств на карте. Пополните баланс."
        )

    # Mock payment processing
    moscow_tz = pytz.timezone('Europe/Moscow')
    payment_time = datetime.now(moscow_tz).replace(tzinfo=None)
    transaction_id = f"TXN-{payment_time.strftime('%Y%m%d%H%M%S')}-{secrets.token_hex(4).upper()}"

    # Check if a payment already exists for this order
    existing_payment_query = await db.execute(
        select(Payment).filter(Payment.order_id == order.id)
    )
    existing_payment = existing_payment_query.scalar_one_or_none()

    if existing_payment:
        # If a payment already exists and is not in a final state, we might want to update it
        # Or we might want to return an error to prevent duplicate payments
        # Let's allow updating payments that are in PENDING or FAILED state
        if existing_payment.status in [PaymentStatus.PENDING, PaymentStatus.FAILED]:
            # Update the existing payment in the database directly
            await db.execute(
                update(Payment)
                .where(Payment.id == existing_payment.id)
                .values(
                    amount=payment_data.amount,
                    payment_method=PaymentMethod(payment_data.payment_method),
                    transaction_id=transaction_id,
                    status=PaymentStatus.PENDING,
                    payment_date=payment_time,
                    card_last_four=card_number[-4:] if card_number else None
                )
            )
            # The existing_payment object will be updated by SQLAlchemy automatically
            new_payment = existing_payment
        else:
            # If payment already succeeded, don't allow another payment attempt
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Платеж уже существует для заказа {order_id} со статусом {existing_payment.status.value}. Невозможно инициировать новый платеж."
            )
    else:
        # Create new payment record
        new_payment = Payment(
            order_id=order.id,
            payment_date=payment_time,
            amount=payment_data.amount,
            payment_method=PaymentMethod(payment_data.payment_method),
            transaction_id=transaction_id,
            status=PaymentStatus.PENDING,
            card_last_four=card_number[-4:] if card_number else None,
            # In a real system we would never store full CVV or full expiry date for security reasons
            # For testing purposes only - in production these would not be stored
        )
        db.add(new_payment)

    # Simulate payment processing (in real app this would integrate with payment gateway)
    try:
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"Processing payment for order {order.id}, payment {new_payment.id}")

        # Here we could integrate with a real payment gateway
        # For now, we'll simulate successful payment
        logger.info("Setting payment and order statuses to paid")
        new_payment.status = PaymentStatus.PAID
        order.status = OrderStatus.paid

        # Update ticket statuses and generate single order QR code for all tickets and concessions
        logger.info("Fetching tickets for order")
        result = await db.execute(
            select(Ticket).filter(Ticket.order_id == order.id)
        )
        tickets = result.scalars().all()
        logger.info(f"Found {len(tickets)} tickets for order {order.id}")

        for ticket in tickets:
            logger.info(f"Updating ticket {ticket.id} status to PAID")
            ticket.status = TicketStatus.PAID

        # Generate single QR code for the entire order (tickets + concessions)
        logger.info("Generating QR code")
        qr_data = f"ORDER-{order.id}-{transaction_id}"
        order.qr_code = generate_qr_code(qr_data)

        # At this point, the order should already have its discount_amount properly calculated
        # including any bonus points that were used during booking creation (deductions)
        # NOW we should accrue bonus points for the successful payment (10% of final amount after discounts)
        bonus_points = (order.final_amount * Decimal("0.10")).quantize(Decimal("0.01"))

        bonus_account_result = await db.execute(
            select(BonusAccount).filter(BonusAccount.user_id == current_user.id)
        )
        bonus_account = bonus_account_result.scalar_one_or_none()

        if bonus_account and bonus_points > 0:
            # Add bonus points to user's account
            bonus_account.balance += float(bonus_points)

            # Create bonus transaction record for the accrual
            bonus_transaction = BonusTransaction(
                bonus_account_id=bonus_account.id,
                order_id=order.id,  # Link to the order for which bonus is accrued
                transaction_date=payment_time,
                amount=bonus_points,
                transaction_type=BonusTransactionType.ACCRUAL
            )
            db.add(bonus_transaction)

        logger.info("Committing transaction")
        await db.commit()
        logger.info("Transaction committed successfully")

        return PaymentResponse(
            id=new_payment.id,
            order_id=new_payment.order_id,
            status=new_payment.status.value,
            payment_method=new_payment.payment_method.value,
            transaction_id=new_payment.transaction_id,
            message="Payment processed successfully"
        )

    except Exception as e:
        import traceback
        logger.error(f"Payment processing failed: {str(e)}")
        logger.error(f"Full traceback: {traceback.format_exc()}")

        # If payment fails, update status and rollback changes
        try:
            logger.info("Attempting to rollback transaction")
            await db.rollback()
            logger.info("Transaction rolled back successfully")
        except Exception as rb_e:
            logger.error(f"Rollback failed: {str(rb_e)}")
            logger.error(f"Rollback traceback: {traceback.format_exc()}")

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Обработка платежа не удалась: {str(e)}. Проверьте логи для подробностей."
        )


@router.get("/{order_id}/status", response_model=PaymentResponse)
async def get_payment_status(
    order_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db)
):
    """Get payment status for an order."""
    result = await db.execute(
        select(Payment)
        .join(Order)
        .filter(Order.id == order_id, Order.user_id == current_user.id)
    )
    payment = result.scalar_one_or_none()

    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Платеж для заказа {order_id} не найден"
        )

    return PaymentResponse(
        id=payment.id,
        order_id=payment.order_id,
        status=payment.status.value,
        payment_method=payment.payment_method.value,
        transaction_id=payment.transaction_id,
        message=f"Payment status: {payment.status.value}"
    )


@router.get("/{order_id}/details", response_model=dict)
async def get_payment_details(
    order_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db)
):
    """Get payment details for an order."""
    result = await db.execute(
        select(Order)
        .filter(Order.id == order_id, Order.user_id == current_user.id)
    )
    order = result.scalar_one_or_none()

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order with id {order_id} not found"
        )

    # Get related tickets with session and seat details
    tickets_result = await db.execute(
        select(Ticket)
        .options(
            selectinload(Ticket.session)
            .selectinload(Session.film),
            selectinload(Ticket.session)
            .selectinload(Session.hall)
            .selectinload(Hall.cinema),
            selectinload(Ticket.seat)
        )
        .filter(Ticket.order_id == order_id)
    )
    tickets = tickets_result.scalars().all()

    # Get related concession preorders
    preorders_result = await db.execute(
        select(ConcessionPreorder)
        .options(selectinload(ConcessionPreorder.concession_item))
        .filter(ConcessionPreorder.order_id == order_id)
    )
    preorders = preorders_result.scalars().all()

    # Get payment to retrieve transaction_id
    payment_result = await db.execute(
        select(Payment).filter(Payment.order_id == order_id)
    )
    payment = payment_result.scalar_one_or_none()

    # Reconstruct QR data
    qr_data = None
    if payment and payment.transaction_id:
        qr_data = f"ORDER-{order.id}-{payment.transaction_id}"


    return {
        "order_id": order.id,
        "order_number": order.order_number,
        "status": order.status.value,
        "total_amount": float(order.total_amount),
        "discount_amount": float(order.discount_amount),
        "final_amount": float(order.final_amount),
        "created_at": order.created_at.isoformat() if order.created_at else None,
        "qr_code": order.qr_code,
        "qr_data": qr_data,
        "tickets": [
            {
                "id": ticket.id,
                "session_id": ticket.session_id,
                "seat_id": ticket.seat_id,
                "price": float(ticket.price),
                "status": ticket.status.value,
                "session": {
                    "id": ticket.session.id if ticket.session else None,
                    "start_datetime": ticket.session.start_datetime.isoformat() if ticket.session and ticket.session.start_datetime else None,
                    "end_datetime": ticket.session.end_datetime.isoformat() if ticket.session and ticket.session.end_datetime else None,
                    "film": {
                        "title": ticket.session.film.title if ticket.session and ticket.session.film else "Неизвестный фильм"
                    } if ticket.session else None,
                    "hall": {
                        "id": ticket.session.hall.id if ticket.session and ticket.session.hall else None,
                        "number": ticket.session.hall.hall_number if ticket.session and ticket.session.hall else None,
                        "name": ticket.session.hall.name if ticket.session and ticket.session.hall else None,
                        "cinema_id": ticket.session.hall.cinema_id if ticket.session and ticket.session.hall else None,
                        "cinema": {
                            "id": ticket.session.hall.cinema.id if ticket.session and ticket.session.hall and ticket.session.hall.cinema else None,
                            "name": ticket.session.hall.cinema.name if ticket.session and ticket.session.hall and ticket.session.hall.cinema else None
                        } if ticket.session and ticket.session.hall and ticket.session.hall.cinema else None
                    } if ticket.session and ticket.session.hall else None
                } if ticket.session else None,
                "seat": {
                    "row_number": ticket.seat.row_number if ticket.seat else None,
                    "seat_number": ticket.seat.seat_number if ticket.seat else None
                } if ticket.seat else None,
                "purchase_date": ticket.purchase_date.isoformat() if ticket.purchase_date else None
            }
            for ticket in tickets
        ],
        "concession_preorders": [
            {
                "id": preorder.id,
                "concession_item_id": preorder.concession_item_id,
                "quantity": preorder.quantity,
                "unit_price": float(preorder.unit_price),
                "total_price": float(preorder.total_price),
                "status": preorder.status.value,
                "pickup_code": preorder.pickup_code,
                "concession_item": {
                    "name": preorder.concession_item.name if preorder.concession_item else "Неизвестный товар",
                    "description": preorder.concession_item.description if preorder.concession_item else None,
                } if preorder.concession_item else None
            }
            for preorder in preorders
        ]
    }


@router.get("/history", response_model=List[PaymentResponsePublic])
async def get_payment_history(
    current_user: Annotated[User, Depends(get_current_active_user)],
    skip: int = 0,
    limit: int = 20,
    db: AsyncSession = Depends(get_db)
):
    """Get payment history for current user."""
    statement = (
        select(Payment)
        .join(Order)
        .filter(Order.user_id == current_user.id)
        .order_by(Payment.payment_date.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(statement)
    payments = result.scalars().all()

    return [PaymentResponsePublic.model_validate(payment) for payment in payments]
