from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.user import User
from app.models.ticket import Ticket
from app.models.concession_preorder import ConcessionPreorder
from app.models.order import Order
from app.models.session import Session
from app.models.enums import UserRoles, TicketStatus, PreorderStatus, OrderStatus
from app.schemas.order import OrderWithTicketsAndPayment
from app.schemas.ticket import TicketResponse
from app.routers.auth import get_current_active_user
from pydantic import BaseModel

router = APIRouter()


class QRScanRequest(BaseModel):
    qr_code: str


@router.post("/scan")
async def scan_qr_code(
    request_data: QRScanRequest,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db)
):
    """Handle QR code scanning for tickets or concession items."""
    qr_code = request_data.qr_code
    if not qr_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="QR code is required"
        )

    # Verify user has admin rights for scanning
    if current_user.role not in [UserRoles.ADMIN, UserRoles.SUPER_ADMIN, UserRoles.STAFF]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and staff can scan QR codes"
        )

    # First, try to find if the QR code belongs to a ticket
    ticket_result = await db.execute(
        select(Ticket)
        .options(selectinload(Ticket.session))
        .filter(Ticket.qr_code == qr_code)
    )
    ticket = ticket_result.scalar_one_or_none()

    if ticket:
        # Handle ticket scanning
        return await handle_ticket_scan(ticket, db)

    # If not a ticket QR code, try to find if it belongs to a concession preorder
    # Check if qr_code matches a pickup code (for concession items)
    preorder_result = await db.execute(
        select(ConcessionPreorder)
        .options(selectinload(ConcessionPreorder.concession_item))
        .filter(ConcessionPreorder.pickup_code == qr_code)
    )
    preorder = preorder_result.scalar_one_or_none()

    if preorder:
        # Handle concession preorder scanning
        return await handle_concession_scan(preorder, db)

    # If not a ticket or concession preorder QR code, try to find if it belongs to an order
    order_result = await db.execute(
        select(Order)
        .options(selectinload(Order.tickets).selectinload(Ticket.session))
        .options(selectinload(Order.concession_preorders).selectinload(ConcessionPreorder.concession_item))
        .filter(Order.qr_code == qr_code)
    )
    order = order_result.scalar_one_or_none()

    if order:
        # Handle order QR code - this might contain multiple items to scan
        return await handle_order_scan(order, db)

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="QR code not found for ticket, concession item, or order"
    )


async def handle_ticket_scan(ticket: Ticket, db: AsyncSession):
    """Handle scanning of a ticket QR code."""
    # Check if ticket is already used
    if ticket.status == TicketStatus.USED:
        # Even if already used, we can still return the status
        return {
            "type": "ticket",
            "status": "already_used",
            "ticket": TicketResponse.model_validate(ticket),
            "message": "Ticket already used"
        }

    # Check if the ticket's session has already ended
    from datetime import datetime
    import pytz
    moscow_tz = pytz.timezone('Europe/Moscow')
    current_time = datetime.now(moscow_tz).replace(tzinfo=None)

    if ticket.session.end_datetime < current_time:
        # Session has ended but ticket wasn't used - mark as used anyway
        ticket.status = TicketStatus.USED
        await db.commit()
        await db.refresh(ticket)

        # Also update the order status to completed since session has ended
        order_result = await db.execute(
            select(Order).filter(Order.id == ticket.order_id)
        )
        order = order_result.scalar_one_or_none()
        if order and order.status not in [OrderStatus.cancelled, OrderStatus.refunded, OrderStatus.completed]:
            order.status = OrderStatus.completed
            await db.commit()

        return {
            "type": "ticket",
            "status": "used_after_session",
            "ticket": TicketResponse.model_validate(ticket),
            "message": "Ticket used after session ended, order marked as completed"
        }
    elif ticket.session.start_datetime <= current_time:
        # Session is currently ongoing - valid to use
        ticket.status = TicketStatus.USED
        await db.commit()
        await db.refresh(ticket)

        return {
            "type": "ticket",
            "status": "used",
            "ticket": TicketResponse.model_validate(ticket),
            "message": "Ticket successfully used"
        }
    else:
        # Session hasn't started yet - not valid to use
        return {
            "type": "ticket",
            "status": "not_yet_valid",
            "ticket": TicketResponse.model_validate(ticket),
            "message": f"Ticket not valid yet. Session starts at {ticket.session.start_datetime.strftime('%H:%M')}"
        }


async def handle_concession_scan(preorder: ConcessionPreorder, db: AsyncSession):
    """Handle scanning of a concession preorder QR code."""
    # Check if the concession item is already marked as completed
    if preorder.status == PreorderStatus.completed:
        return {
            "type": "concession",
            "status": "already_completed",
            "preorder": {
                "id": preorder.id,
                "order_id": preorder.order_id,
                "concession_item_id": preorder.concession_item_id,
                "quantity": preorder.quantity,
                "status": preorder.status.value,
                "item_name": preorder.concession_item.name if preorder.concession_item else "Unknown"
            },
            "message": "Concession item already completed"
        }

    # Check if the order associated with this preorder has been completed
    order_result = await db.execute(
        select(Order).filter(Order.id == preorder.order_id)
    )
    order = order_result.scalar_one_or_none()

    if order and order.status in [OrderStatus.cancelled, OrderStatus.refunded]:
        return {
            "type": "concession",
            "status": "order_cancelled",
            "preorder": {
                "id": preorder.id,
                "order_id": preorder.order_id,
                "concession_item_id": preorder.concession_item_id,
                "quantity": preorder.quantity,
                "status": preorder.status.value,
                "item_name": preorder.concession_item.name if preorder.concession_item else "Unknown"
            },
            "message": "Cannot complete concession item - order was cancelled or refunded"
        }

    # Mark the concession item as completed
    preorder.status = PreorderStatus.completed
    await db.commit()
    await db.refresh(preorder)

    # Check if all concession items in the order are now completed
    all_preorders_result = await db.execute(
        select(ConcessionPreorder).filter(ConcessionPreorder.order_id == preorder.order_id)
    )
    all_preorders = all_preorders_result.scalars().all()

    all_completed = all(p.status == PreorderStatus.completed for p in all_preorders)

    # Check if the session time has passed for the order, and update order status accordingly
    from datetime import datetime
    import pytz
    moscow_tz = pytz.timezone('Europe/Moscow')
    current_time = datetime.now(moscow_tz).replace(tzinfo=None)

    # Get the earliest session time for this order to determine if it's completed
    ticket_sessions_result = await db.execute(
        select(Session.start_datetime)
        .join(Ticket, Ticket.session_id == Session.id)
        .filter(Ticket.order_id == order.id)
        .order_by(Session.start_datetime.asc())
    )
    session_datetimes = ticket_sessions_result.scalars().all()

    if session_datetimes:
        earliest_session_time = min(session_datetimes)
        # Check if session end time has passed
        session_end_result = await db.execute(
            select(Session.end_datetime)
            .join(Ticket, Ticket.session_id == Session.id)
            .filter(Ticket.order_id == order.id)
            .order_by(Session.start_datetime.asc())
            .limit(1)
        )
        session_end_time = session_end_result.scalar_one_or_none()

        if session_end_time and session_end_time < current_time:
            # Session has ended, update order to completed if not already
            if order and order.status not in [OrderStatus.cancelled, OrderStatus.refunded, OrderStatus.completed]:
                order.status = OrderStatus.completed
                await db.commit()

    return {
        "type": "concession",
        "status": "completed",
        "preorder": {
            "id": preorder.id,
            "order_id": preorder.order_id,
            "concession_item_id": preorder.concession_item_id,
            "quantity": preorder.quantity,
            "status": preorder.status.value,
            "item_name": preorder.concession_item.name if preorder.concession_item else "Unknown"
        },
        "all_completed_in_order": all_completed,
        "message": "Concession item successfully marked as completed"
    }


async def handle_order_scan(order: Order, db: AsyncSession):
    """Handle scanning of an order QR code."""
    # This function is for scanning the order QR code itself, which might be used for overall order status
    # For now, just return the order details
    return {
        "type": "order",
        "status": "order_details",
        "order": {
            "id": order.id,
            "order_number": order.order_number,
            "status": order.status.value,
            "created_at": order.created_at,
            "expires_at": order.expires_at,
            "total_amount": float(order.total_amount),
        },
        "message": "Order details retrieved"
    }