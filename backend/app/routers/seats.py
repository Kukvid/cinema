from typing import List, Annotated
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.seat import Seat
from app.models.hall import Hall
from app.schemas.seat import SeatCreate, SeatUpdate, SeatResponse
from app.routers.auth import get_current_active_user
from app.models.user import User

from app.schemas.seat import SeatWithCinemaResponse

router = APIRouter()


@router.get("", response_model=List[SeatResponse])
async def get_seats(
    skip: int = Query(0, ge=0),
    limit: int = Query(1000, ge=1, le=1000),
    cinema_id: int | None = Query(None, description="Filter by cinema ID"),
    hall_id: int | None = Query(None, description="Filter by hall ID"),
    row_number: int | None = Query(None, description="Filter by row number"),
    is_aisle: bool | None = Query(None, description="Filter by aisle status"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get list of seats with optional filters."""
    # Only admin/users with appropriate permissions should access seat management
    if not current_user.role or current_user.role.name not in ["admin", "super_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin and manager users can access seat management"
        )

    query = select(Seat).options(selectinload(Seat.hall))

    # Apply filters
    if cinema_id and current_user.role and current_user.role.name == "admin":
        query = query.join(Hall).filter(Hall.cinema_id == cinema_id)

    if hall_id:
        query = query.filter(Seat.hall_id == hall_id)

    if row_number:
        query = query.filter(Seat.row_number == row_number)

    if is_aisle is not None:
        query = query.filter(Seat.is_aisle == is_aisle)

    query = query.offset(skip).limit(limit).order_by(Seat.hall_id, Seat.row_number, Seat.seat_number)
    result = await db.execute(query)
    seats = result.scalars().all()

    return seats

@router.get("/with-cinema", response_model=List[SeatWithCinemaResponse])
async def get_seats_with_cinema(
    skip: int = Query(0, ge=0),
    limit: int = Query(1000, ge=1, le=1000),
    cinema_id: int | None = Query(None, description="Filter by cinema ID"),
    hall_id: int | None = Query(None, description="Filter by hall ID"),
    row_number: int | None = Query(None, description="Filter by row number"),
    is_aisle: bool | None = Query(None, description="Filter by aisle status"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get list of seats with cinema and hall information."""
    # Only admin/users with appropriate permissions should access seat management
    if not current_user.role or current_user.role.name not in ["admin", "super_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin and manager users can access seat management"
        )

    # Start with base query that loads hall with cinema relationship
    query = select(Seat).options(selectinload(Seat.hall).selectinload(Hall.cinema))

    # Apply filters - note: no need to join separately since we're using selectinload
    if cinema_id:
        query = query.join(Seat.hall).filter(Hall.cinema_id == cinema_id)

    if hall_id:
        query = query.filter(Seat.hall_id == hall_id)

    if row_number:
        query = query.filter(Seat.row_number == row_number)

    if is_aisle is not None:
        query = query.filter(Seat.is_aisle == is_aisle)

    query = query.offset(skip).limit(limit).order_by(Seat.hall_id, Seat.row_number, Seat.seat_number)
    result = await db.execute(query)
    seats = result.scalars().all()

    # Convert seats to include cinema information
    seats_with_cinema = []
    for seat in seats:
        seat_with_cinema = SeatWithCinemaResponse(
            id=seat.id,
            hall_id=seat.hall_id,
            row_number=seat.row_number,
            seat_number=seat.seat_number,
            is_aisle=seat.is_aisle,
            is_available=seat.is_available,
            hall_name=seat.hall.name,
            cinema_id=seat.hall.cinema_id,
            cinema_name=seat.hall.cinema.name
        )
        seats_with_cinema.append(seat_with_cinema)

    return seats_with_cinema


@router.get("/{seat_id}", response_model=SeatResponse)
async def get_seat(
    seat_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get seat by ID."""
    if not current_user.role or current_user.role.name not in ["admin", "super_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin and manager users can access seat details"
        )

    result = await db.execute(
        select(Seat).options(selectinload(Seat.hall)).filter(Seat.id == seat_id)
    )
    seat = result.scalar_one_or_none()

    if not seat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Seat with id {seat_id} not found"
        )

    return seat

@router.get("/{seat_id}/with-cinema", response_model=SeatWithCinemaResponse)
async def get_seat_with_cinema(
    seat_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get seat by ID with cinema and hall information."""
    if not current_user.role or current_user.role.name not in ["admin", "super_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin and manager users can access seat details"
        )

    result = await db.execute(
        select(Seat).options(selectinload(Seat.hall).selectinload(Hall.cinema)).filter(Seat.id == seat_id)
    )
    seat = result.scalar_one_or_none()

    if not seat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Seat with id {seat_id} not found"
        )

    seat_with_cinema = SeatWithCinemaResponse(
        id=seat.id,
        hall_id=seat.hall_id,
        row_number=seat.row_number,
        seat_number=seat.seat_number,
        is_aisle=seat.is_aisle,
        is_available=seat.is_available,
        hall_name=seat.hall.name,
        cinema_id=seat.hall.cinema_id,
        cinema_name=seat.hall.cinema.name
    )

    return seat_with_cinema


@router.post("", response_model=SeatResponse, status_code=status.HTTP_201_CREATED)
async def create_seat(
    seat_data: SeatCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new seat."""
    if not current_user.role or current_user.role.name not in [ "admin", "super_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin users can create seats"
        )

    # Verify hall exists
    result = await db.execute(select(Hall).filter(Hall.id == seat_data.hall_id))
    hall = result.scalar_one_or_none()

    if not hall:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Hall with id {seat_data.hall_id} not found"
        )

    # Check if seat already exists in this location
    result = await db.execute(
        select(Seat).filter(
            Seat.hall_id == seat_data.hall_id,
            Seat.row_number == seat_data.row_number,
            Seat.seat_number == seat_data.seat_number
        )
    )
    existing_seat = result.scalar_one_or_none()

    if existing_seat:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Seat already exists at row {seat_data.row_number}, seat {seat_data.seat_number} in hall {seat_data.hall_id}"
        )

    new_seat = Seat(
        hall_id=seat_data.hall_id,
        row_number=seat_data.row_number,
        seat_number=seat_data.seat_number,
        is_aisle=seat_data.is_aisle,
        is_available=seat_data.is_available
    )

    db.add(new_seat)
    await db.commit()
    await db.refresh(new_seat)

    return new_seat


@router.put("/{seat_id}", response_model=SeatResponse)
async def update_seat(
        seat_id: int,
        seat_data: SeatUpdate,
        current_user: User = Depends(get_current_active_user),
        db: AsyncSession = Depends(get_db)
):
    """Update seat by ID."""
    if not current_user.role or current_user.role.name not in ["admin", "super_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin users can update seats"
        )

    # Загрузить место с relationship
    result = await db.execute(
        select(Seat)
        .options(selectinload(Seat.hall))
        .filter(Seat.id == seat_id)
    )
    seat = result.scalar_one_or_none()

    if not seat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Seat with id {seat_id} not found"
        )

    # Получить данные для обновления
    update_data = seat_data.model_dump(exclude_unset=True)

    # Проверить, что есть данные для обновления
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update"
        )

    # Если обновляется позиция места, проверить уникальность
    if any(k in update_data for k in ['hall_id', 'row_number', 'seat_number']):
        check_hall_id = update_data.get('hall_id', seat.hall_id)
        check_row = update_data.get('row_number', seat.row_number)
        check_seat_num = update_data.get('seat_number', seat.seat_number)

        # Проверить, не занято ли это место другим seat
        conflict_result = await db.execute(
            select(Seat).filter(
                Seat.hall_id == check_hall_id,
                Seat.row_number == check_row,
                Seat.seat_number == check_seat_num,
                Seat.id != seat_id  # Исключить текущее место
            )
        )
        conflict_seat = conflict_result.scalar_one_or_none()

        if conflict_seat:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Seat already exists at row {check_row}, seat {check_seat_num} in hall {check_hall_id}"
            )

    # Обновить поля
    for field, value in update_data.items():
        setattr(seat, field, value)

    await db.commit()

    # Перезагрузить с relationship после commit
    result = await db.execute(
        select(Seat)
        .options(selectinload(Seat.hall))
        .filter(Seat.id == seat_id)
    )
    updated_seat = result.scalar_one()

    return updated_seat

@router.delete("/{seat_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_seat(
    seat_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete seat by ID."""
    if not current_user.role or current_user.role.name not in [ "admin", "super_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin users can delete seats"
        )

    result = await db.execute(select(Seat).filter(Seat.id == seat_id))
    seat = result.scalar_one_or_none()

    if not seat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Seat with id {seat_id} not found"
        )

    await db.delete(seat)
    await db.commit()

    return None