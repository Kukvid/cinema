from typing import List, Annotated
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.hall import Hall
from app.models.cinema import Cinema
from app.models.user import User
from app.schemas.hall import HallCreate, HallUpdate, HallResponse, HallWithCinemaResponse
from app.routers.auth import get_current_active_user

router = APIRouter()


@router.get("/with-cinema", response_model=List[HallWithCinemaResponse])
async def get_halls_with_cinema(
    cinema_id: int | None = Query(None, description="Filter by cinema ID"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    """Get list of halls with cinema information, optionally filtered by cinema."""
    query = select(
        Hall.id,
        Hall.hall_number,
        Hall.name,
        Hall.capacity,
        Hall.hall_type,
        Hall.status,
        Hall.cinema_id,
        Cinema.name.label('cinema_name'),
        Cinema.city.label('cinema_city')
    ).join(Cinema, Hall.cinema_id == Cinema.id)

    if cinema_id:
        query = query.filter(Hall.cinema_id == cinema_id)

    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    halls_data = result.all()

    # Convert to response format
    halls_with_cinema = []
    for row in halls_data:
        hall_dict = {
            'id': row.id,
            'hall_number': row.hall_number,
            'name': row.name,
            'capacity': row.capacity,
            'hall_type': row.hall_type,
            'status': row.status,
            'cinema_id': row.cinema_id,
            'cinema_name': row.cinema_name,
            'cinema_city': row.cinema_city
        }
        halls_with_cinema.append(HallWithCinemaResponse(**hall_dict))

    return halls_with_cinema


@router.get("", response_model=List[HallResponse])
async def get_halls(
    cinema_id: int | None = Query(None, description="Filter by cinema ID"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    """Get list of halls, optionally filtered by cinema."""
    query = select(Hall)

    if cinema_id:
        query = query.filter(Hall.cinema_id == cinema_id)

    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    halls = result.scalars().all()

    return halls


@router.get("/{hall_id}", response_model=HallResponse)
async def get_hall(
    hall_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get hall by ID."""
    result = await db.execute(select(Hall).filter(Hall.id == hall_id))
    hall = result.scalar_one_or_none()

    if not hall:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Hall with id {hall_id} not found"
        )

    return hall


@router.post("", response_model=HallResponse, status_code=status.HTTP_201_CREATED)
async def create_hall(
    hall_data: HallCreate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db)
):
    """Create a new hall."""
    # Verify cinema exists
    result = await db.execute(select(Cinema).filter(Cinema.id == hall_data.cinema_id))
    cinema = result.scalar_one_or_none()

    if not cinema:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cinema with id {hall_data.cinema_id} not found"
        )

    # Check if hall number already exists in this cinema
    result = await db.execute(
        select(Hall).filter(
            Hall.cinema_id == hall_data.cinema_id,
            Hall.hall_number == hall_data.hall_number
        )
    )
    existing_hall = result.scalar_one_or_none()

    if existing_hall:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Hall number {hall_data.hall_number} already exists in this cinema"
        )

    new_hall = Hall(
        cinema_id=hall_data.cinema_id,
        hall_number=hall_data.hall_number,
        name=hall_data.name,
        capacity=hall_data.capacity,
        hall_type=hall_data.hall_type,
        status=hall_data.status
    )

    db.add(new_hall)
    await db.commit()
    await db.refresh(new_hall)

    return new_hall


@router.put("/{hall_id}", response_model=HallResponse)
async def update_hall(
    hall_id: int,
    hall_data: HallUpdate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db)
):
    """Update hall."""
    result = await db.execute(select(Hall).filter(Hall.id == hall_id))
    hall = result.scalar_one_or_none()

    if not hall:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Hall with id {hall_id} not found"
        )

    # Update fields
    update_data = hall_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(hall, field, value)

    await db.commit()
    await db.refresh(hall)

    return hall


@router.delete("/{hall_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_hall(
    hall_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db)
):
    """Delete hall."""
    result = await db.execute(select(Hall).filter(Hall.id == hall_id))
    hall = result.scalar_one_or_none()

    if not hall:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Hall with id {hall_id} not found"
        )

    await db.delete(hall)
    await db.commit()

    return None
