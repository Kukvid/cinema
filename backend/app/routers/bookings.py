from datetime import datetime, timedelta
from typing import List, Annotated
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.config import get_settings
from app.models.order import Order
from app.models.ticket import Ticket
from app.models.session import Session
from app.models.seat import Seat
from app.models.payment import Payment
from app.models.bonus_account import BonusAccount
from app.models.bonus_transaction import BonusTransaction
from app.models.user import User
from app.models.concession_preorder import ConcessionPreorder
from app.models.concession_item import ConcessionItem
from app.models.enums import (
    OrderStatus, TicketStatus, PaymentStatus, SalesChannel,
    BonusTransactionType, PaymentMethod, PreorderStatus
)
from app.schemas.order import OrderCreate, OrderWithTickets, OrderWithTicketsAndPayment, PaymentResponsePublic, ConcessionPreorderResponse, ConcessionItemResponse
from app.schemas.ticket import TicketResponse
from app.routers.auth import get_current_active_user
from app.utils.qr_generator import generate_qr_code
from app.services.promocode_service import validate_promocode, increment_usage
import secrets

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
                detail=f"Session with id {ticket_data.session_id} not found"
            )

        # Get seat
        result = await db.execute(select(Seat).filter(Seat.id == ticket_data.seat_id))
        seat = result.scalar_one_or_none()

        if not seat:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Seat with id {ticket_data.seat_id} not found"
            )

        # Check if seat is available
        if not seat.is_available:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Seat {seat.row_number}-{seat.seat_number} is not available"
            )

        # Check if seat is already booked for this session
        result = await db.execute(
            select(Ticket).filter(
                and_(
                    Ticket.session_id == ticket_data.session_id,
                    Ticket.seat_id == ticket_data.seat_id,
                    Ticket.status.in_([TicketStatus.RESERVED, TicketStatus.PAID])
                )
            )
        )
        existing_ticket = result.scalar_one_or_none()

        if existing_ticket:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Seat {seat.row_number}-{seat.seat_number} is already booked for this session"
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
                detail="Bonus account not found"
            )

        if bonus_account.balance < booking_data.use_bonus_points:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Insufficient bonus points"
            )

        bonus_deduction = min(booking_data.use_bonus_points, total_amount - discount_amount)

        # Check bonus deduction limits
        settings = get_settings()
        max_bonus_amount = (total_amount - discount_amount) * Decimal(settings.BONUS_MAX_PERCENTAGE) / Decimal("100")

        if bonus_deduction > max_bonus_amount:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Bonus deduction cannot exceed {settings.BONUS_MAX_PERCENTAGE}% of order amount after discounts"
            )

    final_amount = total_amount - discount_amount - bonus_deduction

    # Check minimum payment amount after applying bonuses and discounts
    settings = get_settings()
    if final_amount < Decimal(settings.BONUS_MIN_PAYMENT_AMOUNT):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Final order amount cannot be less than {settings.BONUS_MIN_PAYMENT_AMOUNT} ₽ after applying bonuses and discounts"
        )

    # Create order
    from datetime import timedelta
    order_number = f"ORD-{datetime.utcnow().strftime('%Y%m%d')}-{secrets.token_hex(4).upper()}"
    created_time = datetime.utcnow()
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
        status=OrderStatus.CREATED
    )

    db.add(new_order)
    await db.flush()

    # Create tickets
    created_tickets = []
    for ticket_data in tickets_to_create:
        new_ticket = Ticket(
            session_id=ticket_data["session_id"],
            seat_id=ticket_data["seat_id"],
            buyer_id=current_user.id,
            order_id=new_order.id,
            price=ticket_data["price"],
            purchase_date=datetime.utcnow(),
            sales_channel=ticket_data["sales_channel"],
            status=TicketStatus.RESERVED
        )
        db.add(new_ticket)
        created_tickets.append(new_ticket)

    await db.commit()
    await db.refresh(new_order)

    # Refresh tickets to get their IDs
    for ticket in created_tickets:
        await db.refresh(ticket)

    return OrderWithTickets(
        id=new_order.id,
        user_id=new_order.user_id,
        promocode_id=new_order.promocode_id,
        order_number=new_order.order_number,
        created_at=new_order.created_at,
        total_amount=new_order.total_amount,
        discount_amount=new_order.discount_amount,
        final_amount=new_order.final_amount,
        status=new_order.status,
        tickets=[TicketResponse.model_validate(ticket) for ticket in created_tickets]
    )



@router.get("/my", response_model=List[OrderWithTicketsAndPayment])
async def get_my_bookings(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db)
):
    """Get all bookings for current user."""
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
            tickets=[TicketResponse.model_validate(ticket) for ticket in tickets],
            payment=payment_response,
            concession_preorders=concession_responses
        ))

    return orders_with_details
