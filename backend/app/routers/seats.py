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

router = APIRouter()


@router.get("", response_model=List[SeatResponse])
async def get_seats(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    hall_id: int | None = Query(None, description="Filter by hall ID"),
    row_number: int | None = Query(None, description="Filter by row number"),
    is_aisle: bool | None = Query(None, description="Filter by aisle status"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get list of seats with optional filters."""
    # Only admin/users with appropriate permissions should access seat management
    if not current_user.role or current_user.role.name not in ["admin", "manager"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin and manager users can access seat management"
        )

    query = select(Seat).options(selectinload(Seat.hall))

    # Apply filters
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


@router.get("/{seat_id}", response_model=SeatResponse)
async def get_seat(
    seat_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get seat by ID."""
    if not current_user.role or current_user.role.name not in ["admin", "manager"]:
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


@router.post("", response_model=SeatResponse, status_code=status.HTTP_201_CREATED)
async def create_seat(
    seat_data: SeatCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new seat."""
    if not current_user.role or current_user.role.name != "admin":
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
    if not current_user.role or current_user.role.name != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin users can update seats"
        )

    result = await db.execute(select(Seat).filter(Seat.id == seat_id))
    seat = result.scalar_one_or_none()

    if not seat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Seat with id {seat_id} not found"
        )

    # Update fields
    update_data = seat_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(seat, field, value)

    await db.commit()
    await db.refresh(seat)

    return seat


@router.delete("/{seat_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_seat(
    seat_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete seat by ID."""
    if not current_user.role or current_user.role.name != "admin":
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