from typing import List, Annotated
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.cinema import Cinema
from app.models.user import User
from app.models.enums import CinemaStatus
from app.schemas.cinema import CinemaCreate, CinemaUpdate, CinemaResponse
from app.routers.auth import get_current_active_user

router = APIRouter()


@router.get("", response_model=List[CinemaResponse])
async def get_cinemas(
    city: str | None = Query(None, description="Filter by city"),
    status_filter: CinemaStatus | None = Query(None, alias="status", description="Filter by status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    """Get list of cinemas with optional filters."""
    query = select(Cinema)

    if city:
        query = query.filter(Cinema.city == city)

    if status_filter:
        query = query.filter(Cinema.status == status_filter)

    query = query.offset(skip).limit(limit).order_by(Cinema.id.desc())
    result = await db.execute(query)
    cinemas = result.scalars().all()

    return cinemas


@router.get("/{cinema_id}", response_model=CinemaResponse)
async def get_cinema(
    cinema_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get cinema by ID."""
    result = await db.execute(select(Cinema).filter(Cinema.id == cinema_id))
    cinema = result.scalar_one_or_none()

    if not cinema:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cinema with id {cinema_id} not found"
        )

    return cinema


@router.post("", response_model=CinemaResponse, status_code=status.HTTP_201_CREATED)
async def create_cinema(
    cinema_data: CinemaCreate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db)
):
    """Create a new cinema (admin only)."""
    # TODO: Add role check for admin
    # if current_user.role.name != "admin":
    #     raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")

    new_cinema = Cinema(
        name=cinema_data.name,
        address=cinema_data.address,
        city=cinema_data.city,
        latitude=cinema_data.latitude,
        longitude=cinema_data.longitude,
        phone=cinema_data.phone,
        status=cinema_data.status,
        opening_date=cinema_data.opening_date
    )

    db.add(new_cinema)
    await db.commit()
    await db.refresh(new_cinema)

    return new_cinema


@router.put("/{cinema_id}", response_model=CinemaResponse)
async def update_cinema(
    cinema_id: int,
    cinema_data: CinemaUpdate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db)
):
    """Update cinema (admin only)."""
    # TODO: Add role check for admin

    result = await db.execute(select(Cinema).filter(Cinema.id == cinema_id))
    cinema = result.scalar_one_or_none()

    if not cinema:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cinema with id {cinema_id} not found"
        )

    # Update fields
    update_data = cinema_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(cinema, field, value)

    await db.commit()
    await db.refresh(cinema)

    return cinema


@router.delete("/{cinema_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_cinema(
    cinema_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db)
):
    """Delete cinema (admin only)."""
    # TODO: Add role check for admin

    result = await db.execute(select(Cinema).filter(Cinema.id == cinema_id))
    cinema = result.scalar_one_or_none()

    if not cinema:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cinema with id {cinema_id} not found"
        )

    await db.delete(cinema)
    await db.commit()

    return None
