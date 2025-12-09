from datetime import date, datetime, timedelta
from typing import List, Annotated
import pytz
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
from app.models.rental_contract import RentalContract
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
    include_past: bool = Query(False, description="Include past sessions in results"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    """Get list of sessions with optional filters."""
    query = select(Session).options(
        selectinload(Session.hall).selectinload(Hall.cinema),
        selectinload(Session.film)
    )

    # Filter out past sessions unless explicitly requested
    if not include_past:
        current_time = datetime.now(pytz.timezone('Europe/Moscow')).replace(tzinfo=None)
        query = query.filter(Session.start_datetime > current_time)

    if film_id:
        query = query.filter(Session.film_id == film_id)

    if session_date:
        # Filter sessions that start on the given date
        next_day = session_date + timedelta(days=1)
        start_datetime = datetime.combine(session_date, datetime.min.time())
        end_datetime = datetime.combine(next_day, datetime.min.time())
        # Убедимся, что объекты datetime не имеют таймзоны
        start_datetime = start_datetime.replace(tzinfo=None)
        end_datetime = end_datetime.replace(tzinfo=None)
        query = query.filter(
            and_(
                Session.start_datetime >= start_datetime,
                Session.start_datetime < end_datetime
            )
        )

    if status_filter:
        query = query.filter(Session.status == status_filter)

    if cinema_id:
        # Join with Hall to filter by cinema
        query = query.join(Hall).filter(Hall.cinema_id == cinema_id)

    query = query.order_by(Session.start_datetime.asc())

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
        session_dict['film_title'] = session.film.title
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

    # Get booked tickets for this session (including expired/cancelled to show different statuses)
    result = await db.execute(
        select(Ticket).filter(
            Ticket.session_id == session_id
        )
    )
    all_tickets = result.scalars().all()

    # Create mapping of seat_id to ticket_id and status for all tickets
    seat_ticket_mapping = {ticket.seat_id: {'id': ticket.id, 'status': ticket.status.value} for ticket in all_tickets}

    # Only seats with active tickets (not expired/cancelled) should be considered as booked
    booked_seat_ids = {ticket.seat_id: ticket.id for ticket in all_tickets if ticket.status in [TicketStatus.RESERVED, TicketStatus.PAID]}

    # Create seat list with booking status
    seats_with_status = []
    available_count = 0

    for seat in seats:
        is_booked = seat.id in booked_seat_ids
        if not is_booked and seat.is_available:
            available_count += 1

        # Get ticket status if seat has a ticket
        ticket_info = seat_ticket_mapping.get(seat.id)
        ticket_status = ticket_info['status'] if ticket_info else None
        ticket_id = ticket_info['id'] if ticket_info else None

        seats_with_status.append(SeatWithStatus(
            id=seat.id,
            hall_id=seat.hall_id,
            row_number=seat.row_number,
            seat_number=seat.seat_number,
            is_aisle=seat.is_aisle,
            is_available=seat.is_available,
            is_booked=is_booked,
            ticket_id=ticket_id,
            ticket_status=ticket_status
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
    """Create a new session with conflict checking and permission validation."""
    # Check user permissions - only admin and super_admin can create sessions
    if not current_user.role or current_user.role.name not in ["admin", "super_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin users can create sessions"
        )

    # Verify hall exists and get cinema information
    result = await db.execute(
        select(Hall).options(selectinload(Hall.cinema)).filter(Hall.id == session_data.hall_id)
    )
    hall = result.scalar_one_or_none()

    if not hall:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Hall with id {session_data.hall_id} not found"
        )

    # Check if user has permission to create session in this cinema
    if current_user.role.name == "admin" and hall.cinema_id != current_user.cinema_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin can only create sessions in their assigned cinema"
        )

    # Verify film exists
    result = await db.execute(select(Film).filter(Film.id == session_data.film_id))
    film = result.scalar_one_or_none()

    if not film:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Film with id {session_data.film_id} not found"
        )

    # Check if the session date is in the past
    current_time = datetime.now(pytz.timezone('Europe/Moscow')).replace(tzinfo=None)
    session_start_time = session_data.start_datetime.replace(tzinfo=None) if session_data.start_datetime.tzinfo else session_data.start_datetime
    if session_start_time < current_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot create a session in the past"
        )

    # Check if the session ends before it starts
    start_time = session_data.start_datetime.replace(tzinfo=None) if session_data.start_datetime.tzinfo else session_data.start_datetime
    end_time = session_data.end_datetime.replace(tzinfo=None) if session_data.end_datetime.tzinfo else session_data.end_datetime
    if end_time <= start_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session end time must be after start time"
        )

    # Check if the film has an active rental contract for this session's date
    session_date = session_data.start_datetime.date()
    result = await db.execute(
        select(RentalContract).filter(
            and_(
                RentalContract.film_id == session_data.film_id,
                RentalContract.rental_start_date <= session_date,
                RentalContract.rental_end_date >= session_date,
                RentalContract.status.in_(["ACTIVE", "PENDING", "PAID"])  # Active, pending payment, or paid contracts
            )
        )
    )
    rental_contract = result.scalar_one_or_none()

    if not rental_contract:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active rental contract found for the film on the specified date"
        )

    # Check for time conflicts in the same hall
    result = await db.execute(
        select(Session).filter(
            and_(
                Session.hall_id == session_data.hall_id,
                Session.status != SessionStatus.CANCELLED,  # Use enum instead of string
                or_(
                    # New session starts during existing session
                    and_(
                        Session.start_datetime < session_data.end_datetime,
                        Session.end_datetime > session_data.start_datetime
                    ),
                    # New session ends during existing session
                    and_(
                        Session.start_datetime < session_data.end_datetime,
                        Session.end_datetime > session_data.start_datetime
                    ),
                    # New session completely overlaps existing session
                    and_(
                        Session.start_datetime <= session_data.start_datetime,
                        Session.end_datetime >= session_data.end_datetime
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
    """Update session (limited fields)."""
    # Verify session exists and get hall info
    result = await db.execute(
        select(Session)
        .options(selectinload(Session.hall).selectinload(Hall.cinema))
        .filter(Session.id == session_id)
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session with id {session_id} not found"
        )

    # Check user permissions
    if not current_user.role or current_user.role.name not in ["admin", "super_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin users can update sessions"
        )

    # For admin users, check if they can manage session in this cinema
    if current_user.role.name == "admin" and session.hall.cinema_id != current_user.cinema_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin can only update sessions in their assigned cinema"
        )

    # Check if the session date is in the past when changing the date
    if session_data.start_datetime:
        current_time = datetime.now(pytz.timezone('Europe/Moscow')).replace(tzinfo=None)
        session_start_time = session_data.start_datetime.replace(tzinfo=None) if session_data.start_datetime.tzinfo else session_data.start_datetime
        if session_start_time < current_time:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot update session to a past date"
            )

    # Check if the session ends before it starts when changing the end time
    if session_data.end_datetime:
        start_time = session_data.start_datetime or session.start_datetime
        start_time_naive = start_time.replace(tzinfo=None) if start_time.tzinfo else start_time
        end_time_naive = session_data.end_datetime.replace(tzinfo=None) if session_data.end_datetime.tzinfo else session_data.end_datetime
        if end_time_naive <= start_time_naive:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Session end time must be after start time"
            )

    # Check if the film has an active rental contract for the new session date
    if session_data.start_datetime:
        session_date = session_data.start_datetime.date()
        result = await db.execute(
            select(RentalContract).filter(
                and_(
                    RentalContract.film_id == session.film_id,
                    RentalContract.rental_start_date <= session_date,
                    RentalContract.rental_end_date >= session_date,
                    RentalContract.status.in_(["ACTIVE"])
                )
            )
        )
        rental_contract = result.scalar_one_or_none()

        if not rental_contract:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No active rental contract found for the film on the specified date"
            )

    # If changing time, check for time conflicts in the same hall
    if session_data.start_datetime or session_data.end_datetime:
        new_start = session_data.start_datetime or session.start_datetime
        new_end = session_data.end_datetime or session.end_datetime

        # Check for time conflicts in the same hall
        result = await db.execute(
            select(Session).filter(
                and_(
                    Session.hall_id == session.hall_id,
                    Session.id != session_id,  # Exclude current session
                    Session.status != SessionStatus.CANCELLED,
                    or_(
                        # New session starts during existing session
                        and_(
                            Session.start_datetime < new_end,
                            Session.end_datetime > new_start
                        ),
                        # New session ends during existing session
                        and_(
                            Session.start_datetime < new_end,
                            Session.end_datetime > new_start
                        ),
                        # New session completely overlaps existing session
                        and_(
                            Session.start_datetime <= new_start,
                            Session.end_datetime >= new_end
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
    # Verify session exists and get hall info
    result = await db.execute(
        select(Session)
        .options(selectinload(Session.hall).selectinload(Hall.cinema))
        .filter(Session.id == session_id)
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session with id {session_id} not found"
        )

    # Check user permissions
    if not current_user.role or current_user.role.name not in ["admin", "super_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin users can delete sessions"
        )

    # For admin users, check if they can manage session in this cinema
    if current_user.role.name == "admin" and session.hall.cinema_id != current_user.cinema_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin can only delete sessions in their assigned cinema"
        )

    await db.delete(session)
    await db.commit()

    return None
