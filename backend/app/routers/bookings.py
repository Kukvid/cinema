from datetime import datetime, timedelta
from typing import List, Annotated
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.database import get_db
from app.models.order import Order
from app.models.ticket import Ticket
from app.models.session import Session
from app.models.seat import Seat
from app.models.payment import Payment
from app.models.bonus_account import BonusAccount
from app.models.bonus_transaction import BonusTransaction
from app.models.user import User
from app.models.enums import (
    OrderStatus, TicketStatus, PaymentStatus, SalesChannel,
    BonusTransactionType, PaymentMethod
)
from app.schemas.order import OrderCreate, OrderWithTickets, PaymentCreate, PaymentResponse
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
            order_amount=total_amount,
            category="TICKETS"  # Bookings are always for tickets
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
        bonus_account.balance -= bonus_deduction

    final_amount = total_amount - discount_amount - bonus_deduction

    # Create order
    order_number = f"ORD-{datetime.utcnow().strftime('%Y%m%d')}-{secrets.token_hex(4).upper()}"
    new_order = Order(
        user_id=current_user.id,
        promocode_id=promocode_id,
        order_number=order_number,
        created_at=datetime.utcnow(),
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


@router.post("/{order_id}/payment", response_model=PaymentResponse)
async def process_payment(
    order_id: int,
    payment_data: PaymentCreate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db)
):
    """Process payment for an order (mock payment)."""
    # Get order
    result = await db.execute(select(Order).filter(Order.id == order_id))
    order = result.scalar_one_or_none()

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order with id {order_id} not found"
        )

    # Verify order belongs to current user
    if order.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only pay for your own orders"
        )

    # Check order status
    if order.status == OrderStatus.PAID:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Order has already been paid"
        )

    if order.status == OrderStatus.CANCELLED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot pay for cancelled order"
        )

    # Mock payment processing
    transaction_id = f"TXN-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{secrets.token_hex(4).upper()}"

    # Create payment record
    new_payment = Payment(
        order_id=order.id,
        payment_date=datetime.utcnow(),
        amount=order.final_amount,
        payment_method=PaymentMethod(payment_data.payment_method),
        transaction_id=transaction_id,
        payment_status=PaymentStatus.PAID,
        card_last_digits=payment_data.card_number[-4:] if payment_data.card_number else None
    )
    db.add(new_payment)

    # Update order status
    order.status = OrderStatus.PAID

    # Update ticket statuses and generate QR codes
    result = await db.execute(select(Ticket).filter(Ticket.order_id == order.id))
    tickets = result.scalars().all()

    for ticket in tickets:
        ticket.status = TicketStatus.PAID
        # Generate QR code
        qr_data = f"TICKET-{ticket.id}-{transaction_id}"
        ticket.qr_code = generate_qr_code(qr_data)

    # Add bonus points (10% of total amount)
    bonus_points = (order.total_amount * Decimal("0.10")).quantize(Decimal("0.01"))

    result = await db.execute(select(BonusAccount).filter(BonusAccount.user_id == current_user.id))
    bonus_account = result.scalar_one_or_none()

    if bonus_account:
        bonus_account.balance += bonus_points

        # Create bonus transaction record
        if tickets:  # Use first ticket for the transaction
            bonus_transaction = BonusTransaction(
                bonus_account_id=bonus_account.id,
                ticket_id=tickets[0].id,
                transaction_date=datetime.utcnow(),
                amount=bonus_points,
                transaction_type=BonusTransactionType.ACCRUAL,
                description=f"Bonus accrual for order {order.order_number}"
            )
            db.add(bonus_transaction)

    await db.commit()
    await db.refresh(new_payment)

    return PaymentResponse(
        id=new_payment.id,
        order_id=new_payment.order_id,
        payment_status=new_payment.payment_status.value,
        payment_method=new_payment.payment_method.value,
        transaction_id=new_payment.transaction_id,
        message="Payment processed successfully"
    )


@router.get("/my", response_model=List[OrderWithTickets])
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

    # Get tickets for each order
    orders_with_tickets = []
    for order in orders:
        result = await db.execute(
            select(Ticket).filter(Ticket.order_id == order.id)
        )
        tickets = result.scalars().all()

        orders_with_tickets.append(OrderWithTickets(
            id=order.id,
            user_id=order.user_id,
            promocode_id=order.promocode_id,
            order_number=order.order_number,
            created_at=order.created_at,
            total_amount=order.total_amount,
            discount_amount=order.discount_amount,
            final_amount=order.final_amount,
            status=order.status,
            tickets=[TicketResponse.model_validate(ticket) for ticket in tickets]
        ))

    return orders_with_tickets
