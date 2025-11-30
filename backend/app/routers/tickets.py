from typing import List, Annotated
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.user import User
from app.models.ticket import Ticket
from app.models.session import Session
from app.models.film import Film
from app.models.hall import Hall
from app.models.cinema import Cinema
from app.models.seat import Seat
from app.models.enums import TicketStatus
from app.schemas.ticket import TicketResponse
from app.routers.auth import get_current_active_user

router = APIRouter()


@router.get("/my", response_model=List[TicketResponse])
async def get_my_tickets(
    current_user: Annotated[User, Depends(get_current_active_user)],
    status_filter: TicketStatus | None = Query(None, alias="status", description="Filter by ticket status"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(10, ge=1, le=100, description="Maximum number of records to return"),
    db: AsyncSession = Depends(get_db)
):
    """Get all tickets for current user with pagination and optional status filter."""
    query = select(Ticket).options(
        selectinload(Ticket.session)
        .selectinload(Session.film),
        selectinload(Ticket.session)
        .selectinload(Session.hall)
        .selectinload(Hall.cinema),
        selectinload(Ticket.seat)
    ).filter(Ticket.buyer_id == current_user.id)

    if status_filter:
        query = query.filter(Ticket.status == status_filter)

    # Order by purchase date descending (newest first)
    query = query.order_by(Ticket.purchase_date.desc()).offset(skip).limit(limit)

    result = await db.execute(query)
    tickets = result.scalars().unique().all()

    return tickets


@router.get("/my/count", response_model=int)
async def get_my_tickets_count(
    current_user: Annotated[User, Depends(get_current_active_user)],
    status_filter: TicketStatus | None = Query(None, alias="status", description="Filter by ticket status"),
    db: AsyncSession = Depends(get_db)
):
    """Get total count of tickets for current user with optional status filter."""
    query = select(func.count(Ticket.id)).filter(Ticket.buyer_id == current_user.id)

    if status_filter:
        query = query.filter(Ticket.status == status_filter)

    result = await db.execute(query)
    count = result.scalar_one()

    return count


@router.get("/{ticket_id}", response_model=TicketResponse)
async def get_ticket(
    ticket_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db)
):
    """Get a specific ticket by ID."""
    result = await db.execute(
        select(Ticket).options(
            selectinload(Ticket.session)
            .selectinload(Session.film),
            selectinload(Ticket.session)
            .selectinload(Session.hall)
            .selectinload(Hall.cinema),
            selectinload(Ticket.seat)
        ).filter(
            and_(
                Ticket.id == ticket_id,
                Ticket.buyer_id == current_user.id
            )
        )
    )
    ticket = result.scalar_one_or_none()

    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ticket with id {ticket_id} not found"
        )

    return ticket