from datetime import datetime
from typing import Annotated
from decimal import Decimal
import secrets
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.user import User
from app.models.order import Order
from app.models.payment import Payment
from app.models.ticket import Ticket
from app.models.session import Session
from app.models.bonus_account import BonusAccount
from app.models.bonus_transaction import BonusTransaction
from app.models.enums import (
    OrderStatus, PaymentStatus, PaymentMethod,
    TicketStatus, BonusTransactionType
)
from app.schemas.order import PaymentCreate, PaymentResponse
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
    # Get order
    result = await db.execute(
        select(Order).filter(Order.id == order_id)
    )
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
        if payment_data.amount != Decimal('1500.00'):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Fixed amount card only valid for orders of exactly 1500.00 ₽ (current: {payment_data.amount} ₽)"
            )
        amount_validation_needed = False  # Проверка общей суммы уже выполнена

    # Verify payment amount matches order final_amount (unless it's a special card)
    if amount_validation_needed and payment_data.amount != order.final_amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Payment amount mismatch. Expected: {order.final_amount}, got: {payment_data.amount}"
        )

    # Mock payment processing
    transaction_id = f"TXN-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{secrets.token_hex(4).upper()}"

    # Create payment record
    new_payment = Payment(
        order_id=order.id,
        payment_date=datetime.utcnow(),
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
        # Here we could integrate with a real payment gateway
        # For now, we'll simulate successful payment
        new_payment.status = PaymentStatus.PAID
        order.status = OrderStatus.PAID

        # Update ticket statuses and generate single order QR code for all tickets and concessions
        result = await db.execute(
            select(Ticket).filter(Ticket.order_id == order.id)
        )
        tickets = result.scalars().all()

        for ticket in tickets:
            ticket.status = TicketStatus.PAID

        # Generate single QR code for the entire order (tickets + concessions)
        qr_data = f"ORDER-{order.id}-{transaction_id}"
        order.qr_code = generate_qr_code(qr_data)

        # Process bonus deductions if any were requested during booking
        if order.discount_amount > 0 and order.discount_amount != (order.promocode.discount_amount if order.promocode else 0):
            # Some of the discount was from bonus points, so we need to debit them
            bonus_deduction = order.discount_amount - (order.promocode.discount_amount if order.promocode else 0) if order.promocode else order.discount_amount

            result = await db.execute(
                select(BonusAccount).filter(BonusAccount.user_id == current_user.id)
            )
            bonus_account = result.scalar_one_or_none()

            if bonus_account:
                # Deduct the bonus points from the user's account
                bonus_account.balance -= float(bonus_deduction)

                # Create a bonus transaction record for the deduction
                bonus_deduction_transaction = BonusTransaction(
                    bonus_account_id=bonus_account.id,
                    order_id=order.id,
                    transaction_date=datetime.utcnow(),
                    amount=-float(bonus_deduction),  # Negative amount for deduction
                    transaction_type=BonusTransactionType.DEDUCTION,
                    description="Списание бонусов за заказ"
                )
                db.add(bonus_deduction_transaction)

        # Add bonus points (10% of total amount)
        bonus_points = (order.total_amount * Decimal("0.10")).quantize(Decimal("0.01"))

        result = await db.execute(
            select(BonusAccount).filter(BonusAccount.user_id == current_user.id)
        )
        bonus_account = result.scalar_one_or_none()

        if bonus_account:
            bonus_account.balance += bonus_points

            # Create bonus transaction record for the order
            if tickets:
                bonus_transaction = BonusTransaction(
                    bonus_account_id=bonus_account.id,
                    order_id=order.id,  # Link to the order for which bonus is accrued
                    transaction_date=datetime.utcnow(),
                    amount=bonus_points,
                    transaction_type=BonusTransactionType.ACCRUAL
                )
                db.add(bonus_transaction)
            else:
                # Create bonus transaction for the order
                bonus_transaction = BonusTransaction(
                    bonus_account_id=bonus_account.id,
                    order_id=order.id,
                    transaction_date=datetime.utcnow(),
                    amount=bonus_points,
                    transaction_type=BonusTransactionType.ACCRUAL
                )
                db.add(bonus_transaction)

        await db.commit()
        await db.refresh(new_payment)

        return PaymentResponse(
            id=new_payment.id,
            order_id=new_payment.order_id,
            status=new_payment.status.value,
            payment_method=new_payment.payment_method.value,
            transaction_id=new_payment.transaction_id,
            message="Payment processed successfully"
        )

    except Exception as e:
        # If payment fails, update status
        new_payment.status = PaymentStatus.FAILED
        order.status = OrderStatus.PENDING_PAYMENT  # or keep as CREATED?
        await db.commit()
        await db.refresh(new_payment)

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Payment processing failed: {str(e)}"
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
            detail=f"Payment for order {order_id} not found"
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

    # Calculate concession total
    concession_total = sum(float(preorder.total_price) for preorder in preorders)

    # Calculate full total amount including tickets and concessions
    tickets_total = sum(float(ticket.price) for ticket in tickets)
    full_total_amount = order.total_amount + Decimal(str(concession_total))
    full_final_amount = order.final_amount + Decimal(str(concession_total))

    return {
        "order_id": order.id,
        "order_number": order.order_number,
        "status": order.status.value,
        "total_amount": float(full_total_amount),  # Include concessions
        "discount_amount": float(order.discount_amount),
        "final_amount": float(full_final_amount),  # Include concessions
        "tickets_total": float(tickets_total),
        "concessions_total": float(concession_total),
        "created_at": order.created_at.isoformat() if order.created_at else None,
        "tickets": [
            {
                "id": ticket.id,
                "session_id": ticket.session_id,
                "seat_id": ticket.seat_id,
                "price": float(ticket.price),
                "status": ticket.status.value,
                "session": {
                    "film": {
                        "title": ticket.session.film.title if ticket.session and ticket.session.film else "Неизвестный фильм"
                    } if ticket.session else None
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
