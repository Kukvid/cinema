from datetime import date, datetime, timedelta
from typing import List, Annotated
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.session import Session
from app.models.film import Film
from app.models.hall import Hall
from app.models.cinema import Cinema
from app.models.seat import Seat
from app.models.ticket import Ticket
from app.models.user import User
from app.models.enums import SessionStatus, TicketStatus
from app.schemas.session import SessionCreate, SessionUpdate, SessionResponse, SessionWithSeats
from app.schemas.seat import SeatWithStatus
from app.routers.auth import get_current_active_user

router = APIRouter()


async def calculate_available_seats(sessions: List[Session], db: AsyncSession):
    """Calculate available seats for each session."""
    if not sessions:
        return {}

    session_ids = [s.id for s in sessions]

    # Get booked tickets count for all sessions in one query
    booked_tickets_query = select(
        Ticket.session_id,
        func.count(Ticket.id).label('booked_count')
    ).filter(
        Ticket.session_id.in_(session_ids),
        Ticket.status.in_([TicketStatus.RESERVED, TicketStatus.PAID])
    ).group_by(Ticket.session_id)

    result = await db.execute(booked_tickets_query)
    booked_counts = {row.session_id: row.booked_count for row in result}

    # Calculate available seats for each session
    available_seats_map = {}
    for session in sessions:
        if session.hall:
            total_capacity = session.hall.capacity
            booked = booked_counts.get(session.id, 0)
            available_seats_map[session.id] = max(0, total_capacity - booked)
        else:
            available_seats_map[session.id] = 0

    return available_seats_map


@router.get("", response_model=List[SessionResponse])
async def get_sessions(
    cinema_id: int | None = Query(None, description="Filter by cinema ID"),
    film_id: int | None = Query(None, description="Filter by film ID"),
    session_date: date | None = Query(None, description="Filter by date"),
    status_filter: SessionStatus | None = Query(None, alias="status", description="Filter by status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    """Get list of sessions with optional filters."""
    query = select(Session).options(
        selectinload(Session.hall).selectinload(Hall.cinema)
    )

    if film_id:
        query = query.filter(Session.film_id == film_id)

    if session_date:
        # Filter sessions that start on the given date
        next_day = session_date + timedelta(days=1)
        query = query.filter(
            and_(
                Session.start_datetime >= datetime.combine(session_date, datetime.min.time()),
                Session.start_datetime < datetime.combine(next_day, datetime.min.time())
            )
        )

    if status_filter:
        query = query.filter(Session.status == status_filter)

    if cinema_id:
        # Join with Hall to filter by cinema
        query = query.join(Hall).filter(Hall.cinema_id == cinema_id)

    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    sessions = result.scalars().unique().all()

    # Calculate available seats for all sessions
    available_seats_map = await calculate_available_seats(sessions, db)

    # Convert to response format with available_seats
    response_sessions = []
    for session in sessions:
        session_dict = SessionResponse.model_validate(session).model_dump()
        session_dict['available_seats'] = available_seats_map.get(session.id, 0)
        response_sessions.append(SessionResponse(**session_dict))

    return response_sessions


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get session by ID."""
    result = await db.execute(
        select(Session)
        .options(selectinload(Session.hall).selectinload(Hall.cinema),selectinload(Session.film))
        .filter(Session.id == session_id)
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session with id {session_id} not found"
        )

    # Calculate available seats
    available_seats_map = await calculate_available_seats([session], db)

    # Convert to response format with available_seats
    session_dict = SessionResponse.model_validate(session).model_dump()
    session_dict['available_seats'] = available_seats_map.get(session.id, 0)
    session_dict['film_title'] = session.film.title

    return SessionResponse(**session_dict)


@router.get("/{session_id}/seats", response_model=SessionWithSeats)
async def get_session_seats(
    session_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get session with seat availability."""
    # Get session
    result = await db.execute(select(Session).filter(Session.id == session_id))
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session with id {session_id} not found"
        )

    # Get all seats for the hall
    result = await db.execute(
        select(Seat).filter(Seat.hall_id == session.hall_id).order_by(Seat.row_number, Seat.seat_number)
    )
    seats = result.scalars().all()

    # Get booked tickets for this session
    result = await db.execute(
        select(Ticket).filter(
            Ticket.session_id == session_id,
            Ticket.status.in_([TicketStatus.RESERVED, TicketStatus.PAID])
        )
    )
    booked_tickets = result.scalars().all()
    booked_seat_ids = {ticket.seat_id: ticket.id for ticket in booked_tickets}

    # Create seat list with booking status
    seats_with_status = []
    available_count = 0

    for seat in seats:
        is_booked = seat.id in booked_seat_ids
        if not is_booked and seat.is_available:
            available_count += 1

        seats_with_status.append(SeatWithStatus(
            id=seat.id,
            hall_id=seat.hall_id,
            row_number=seat.row_number,
            seat_number=seat.seat_number,
            is_aisle=seat.is_aisle,
            is_available=seat.is_available,
            is_booked=is_booked,
            ticket_id=booked_seat_ids.get(seat.id)
        ))

    return SessionWithSeats(
        id=session.id,
        film_id=session.film_id,
        hall_id=session.hall_id,
        start_datetime=session.start_datetime,
        end_datetime=session.end_datetime,
        ticket_price=session.ticket_price,
        status=session.status,
        available_seats_count=available_count,
        total_seats_count=len(seats),
        seats=seats_with_status
    )


@router.post("", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    session_data: SessionCreate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db)
):
    """Create a new session with conflict checking."""
    # Verify film exists
    result = await db.execute(select(Film).filter(Film.id == session_data.film_id))
    film = result.scalar_one_or_none()

    if not film:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Film with id {session_data.film_id} not found"
        )

    # Verify hall exists
    result = await db.execute(select(Hall).filter(Hall.id == session_data.hall_id))
    hall = result.scalar_one_or_none()

    if not hall:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Hall with id {session_data.hall_id} not found"
        )

    # Check for time conflicts in the same hall
    result = await db.execute(
        select(Session).filter(
            and_(
                Session.hall_id == session_data.hall_id,
                Session.status != SessionStatus.CANCELLED,
                or_(
                    # New session starts during existing session
                    and_(
                        Session.start_datetime <= session_data.start_datetime,
                        Session.end_datetime > session_data.start_datetime
                    ),
                    # New session ends during existing session
                    and_(
                        Session.start_datetime < session_data.end_datetime,
                        Session.end_datetime >= session_data.end_datetime
                    ),
                    # New session completely overlaps existing session
                    and_(
                        Session.start_datetime >= session_data.start_datetime,
                        Session.end_datetime <= session_data.end_datetime
                    )
                )
            )
        )
    )
    conflicting_session = result.scalar_one_or_none()

    if conflicting_session:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Time conflict with existing session (ID: {conflicting_session.id}) in the same hall"
        )

    new_session = Session(
        film_id=session_data.film_id,
        hall_id=session_data.hall_id,
        start_datetime=session_data.start_datetime,
        end_datetime=session_data.end_datetime,
        ticket_price=session_data.ticket_price,
        status=session_data.status
    )

    db.add(new_session)
    await db.commit()
    await db.refresh(new_session)

    return new_session


@router.put("/{session_id}", response_model=SessionResponse)
async def update_session(
    session_id: int,
    session_data: SessionUpdate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db)
):
    """Update session."""
    result = await db.execute(select(Session).filter(Session.id == session_id))
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session with id {session_id} not found"
        )

    # Update fields
    update_data = session_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(session, field, value)

    await db.commit()
    await db.refresh(session)

    return session


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db)
):
    """Delete session."""
    result = await db.execute(select(Session).filter(Session.id == session_id))
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session with id {session_id} not found"
        )

    await db.delete(session)
    await db.commit()

    return None
