from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
import re

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
from app.utils.qr_generator import parse_qr_data

router = APIRouter()


def parse_qr_code_string(qr_code_string: str):
    """
    Parse QR code string to determine its type and extract relevant information.

    Handle different formats:
    - TICKET:id:session_id:seat_id
    - CONCESSION:preorder_id:order_id
    - ORDER:order_id
    - ORDER-order_id-TXN-timestamp-hexcode (from payments)
    """
    # First, try the existing parser for standard formats
    parsed = parse_qr_data(qr_code_string)
    if parsed:
        return parsed

    # Handle the payment/order format: ORDER-171-TXN-20251207120056-74CE1C6D
    match = re.match(r'^ORDER-(\d+)-TXN-', qr_code_string)
    if match:
        order_id = int(match.group(1))
        return {
            "type": "order",
            "order_id": order_id
        }

    # # Handle just order number format (e.g., if someone inputs an order ID directly)
    # match = re.match(r'^ORDER-(\d+)$', qr_code_string)
    # if match:
    #     order_id = int(match.group(1))
    #     return {
    #         "type": "order",
    #         "order_id": order_id
    #     }

    # If none of the patterns match, return None
    return None


class QRScanRequest(BaseModel):
    qr_code: str


@router.post("/ticket/validate")
async def validate_ticket_qr(
    request_data: QRScanRequest,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db)
):
    """Validate a ticket QR code for cinema entry."""
    qr_code = request_data.qr_code
    if not qr_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="QR code is required"
        )

    # Verify user has admin rights for scanning
    if current_user.role.name not in [UserRoles.admin, UserRoles.super_admin, UserRoles.staff]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Only admins and staff can scan QR codes. You are {current_user.role.name}"
        )

    # Parse the QR code to understand what type it is
    parsed_qr = parse_qr_code_string(qr_code)

    if parsed_qr and parsed_qr["type"] == "order":
        order_id = parsed_qr["order_id"]
        order_result = await db.execute(
            select(Order)
            .options(selectinload(Order.tickets).selectinload(Ticket.session).selectinload(Session.film))
            .options(selectinload(Order.tickets).selectinload(Ticket.seat))
            .filter(Order.id == order_id)
        )
        order = order_result.scalar_one_or_none()

        if order:
            # Check if order has been refunded - don't allow entry for refunded orders
            if order.status in [OrderStatus.refunded, OrderStatus.cancelled]:
                return {
                    "is_valid": False,
                    "message": "Заказ отменен или возвращен, проход запрещен",
                    "status": "order_cancelled_or_refunded",
                    "order": {
                        "id": order.id,
                        "order_number": order.order_number,
                        "status": order.status.value,
                    }
                }

            if order.tickets:
                # Return all tickets for the order
                tickets_data = []
                for ticket in order.tickets:
                    tickets_data.append({
                        "id": ticket.id,
                        "session": {
                            "id": ticket.session.id,
                            "film": {
                                "title": ticket.session.film.title
                            },
                            "start_datetime": ticket.session.start_datetime,
                            "end_datetime": ticket.session.end_datetime,
                        },
                        "seat": {
                            "id": ticket.seat.id,
                            "row_number": ticket.seat.row_number,
                            "seat_number": ticket.seat.seat_number
                        },
                        "status": ticket.status.value,
                    })

                # Check if any ticket can be used (not already used and session has started)
                from datetime import datetime
                import pytz
                moscow_tz = pytz.timezone('Europe/Moscow')
                current_time = datetime.now(moscow_tz).replace(tzinfo=None)

                can_be_used = any(
                    ticket_data["status"] != "USED"
                    # and ticket_data["session"]["start_datetime"] <= current_time
                    for ticket_data in tickets_data
                )

                return {
                    "is_valid": len(tickets_data) > 0,  # Valid for display purposes if tickets exist
                    "can_be_used": can_be_used,  # Separate field to indicate if any can be newly used
                    "tickets": tickets_data,
                    "order": {
                        "id": order.id,
                        "order_number": order.order_number,
                        "user_id": order.user_id,
                        "status": order.status.value,
                    },
                    "message": f"Найдено {len(tickets_data)} билетов для заказа",
                    "status": "multiple_tickets_found"
                }

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Ticket QR code not found or invalid"
    )


@router.post("/concession/validate")
async def validate_concession_qr(
    request_data: QRScanRequest,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db)
):
    """Validate a concession preorder QR code for pickup."""
    qr_code = request_data.qr_code
    if not qr_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="QR code is required"
        )

    # Verify user has admin rights for scanning
    if current_user.role.name not in [UserRoles.admin, UserRoles.super_admin, UserRoles.staff]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and staff can scan QR codes"
        )

    # Check if qr_code matches a pickup code (for concession items)
    preorder_result = await db.execute(
        select(ConcessionPreorder)
        .options(selectinload(ConcessionPreorder.concession_item))
        .filter(ConcessionPreorder.pickup_code == qr_code)
    )
    preorder = preorder_result.scalar_one_or_none()

    if preorder:
        # Get order info for the response
        order_result = await db.execute(
            select(Order).filter(Order.id == preorder.order_id)
        )
        order = order_result.scalar_one_or_none()

        # Handle concession preorder validation
        result = await handle_concession_scan(preorder, db)
        # Convert to a format suitable for concession staff
        if result["type"] == "concession":
            return {
                "is_valid": result["status"] not in ["already_completed", "order_cancelled"],  # Valid if not already completed or cancelled
                "preorder": {
                    "id": preorder.id,
                    "order_id": preorder.order_id,
                    "concession_item_id": preorder.concession_item_id,
                    "concession_item_name": preorder.concession_item.name if preorder.concession_item else "Unknown",
                    "quantity": preorder.quantity,
                    "status": preorder.status.value,
                    "pickup_code": preorder.pickup_code
                },
                "order": {
                    "id": order.id if order else None,
                    "order_number": order.order_number if order else None,
                    "user_id": order.user_id if order else None,
                } if order else None,
                "message": result["message"],
                "status": result["status"]
            }

    # If not a pickup code, check if it's an order QR code (from parsed data)
    parsed_qr = parse_qr_code_string(qr_code)
    if parsed_qr and parsed_qr["type"] == "order":
        order_id = parsed_qr["order_id"]
        order_result = await db.execute(
            select(Order)
            .options(selectinload(Order.concession_preorders).selectinload(ConcessionPreorder.concession_item))
            .filter(Order.id == order_id)
        )
        order = order_result.scalar_one_or_none()

        if order:
            # Check if order has been refunded - don't allow access for refunded orders
            if order.status in [OrderStatus.refunded, OrderStatus.cancelled]:
                return {
                    "is_valid": False,
                    "message": "Заказ отменен или возвращен, доступ запрещен",
                    "status": "order_cancelled_or_refunded",
                    "order": {
                        "id": order.id,
                        "order_number": order.order_number,
                        "status": order.status.value,
                    }
                }

            if order.concession_preorders:
                # Return all concession preorders for the order
                preorders_data = []
                for preorder in order.concession_preorders:
                    preorders_data.append({
                        "id": preorder.id,
                        "order_id": preorder.order_id,
                        "concession_item_id": preorder.concession_item_id,
                        "concession_item_name": preorder.concession_item.name if preorder.concession_item else "Unknown",
                        "quantity": preorder.quantity,
                        "status": preorder.status.value,
                        "pickup_code": preorder.pickup_code
                    })

                # Check if any item can be used (not already completed)
                can_be_completed = any(
                    preorder_data["status"] != PreorderStatus.COMPLETED.value
                    for preorder_data in preorders_data
                )

                return {
                    "is_valid": len(preorders_data) > 0,  # Valid for display purposes if items exist
                    "can_be_completed": can_be_completed,  # Separate field to indicate if any can be newly completed
                    "concession_preorders": preorders_data,
                    "order": {
                        "id": order.id,
                        "order_number": order.order_number,
                        "user_id": order.user_id,
                        "status": order.status.value,
                    },
                    "message": f"Найдено {len(preorders_data)} товаров(-а) из кинобара для заказа",
                    "status": "multiple_concession_items_found"
                }

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Concession QR code not found or invalid"
    )


@router.post("/scan")  # Kept for backward compatibility
async def scan_qr_code(
    request_data: QRScanRequest,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db)
):
    """Handle QR code scanning for tickets or concession items (legacy endpoint)."""
    qr_code = request_data.qr_code
    if not qr_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="QR code is required"
        )

    # Verify user has admin rights for scanning
    if current_user.role.name not in [UserRoles.admin, UserRoles.super_admin, UserRoles.staff]:
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

    # If not a ticket or concession preorder QR code, try to find if it's an order QR code
    # Parse the QR code to understand what type it is
    parsed_qr = parse_qr_code_string(qr_code)
    if parsed_qr and parsed_qr["type"] == "order":
        order_id = parsed_qr["order_id"]
        order_result = await db.execute(
            select(Order)
            .options(selectinload(Order.tickets).selectinload(Ticket.session))
            .options(selectinload(Order.concession_preorders).selectinload(ConcessionPreorder.concession_item))
            .filter(Order.id == order_id)
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

        return {
            "type": "ticket",
            "status": "used_after_session",
            "ticket": TicketResponse.model_validate(ticket),
            "message": "Ticket used after session ended"
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
    if preorder.status == PreorderStatus.COMPLETED:
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
    preorder.status = PreorderStatus.COMPLETED
    await db.commit()
    await db.refresh(preorder)

    # Check if all concession items in the order are now completed
    all_preorders_result = await db.execute(
        select(ConcessionPreorder).filter(ConcessionPreorder.order_id == preorder.order_id)
    )
    all_preorders = all_preorders_result.scalars().all()

    all_completed = all(p.status == PreorderStatus.COMPLETED for p in all_preorders)

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


