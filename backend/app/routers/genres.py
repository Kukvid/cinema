from typing import List, Annotated
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.genre import Genre
from app.models.user import User
from app.schemas.genre import GenreCreate, GenreUpdate, GenreResponse
from app.routers.auth import get_current_active_user

router = APIRouter()


@router.get("", response_model=List[GenreResponse])
async def get_genres(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    """Get list of all genres."""
    query = select(Genre).offset(skip).limit(limit).order_by(Genre.name)
    result = await db.execute(query)
    genres = result.scalars().all()

    return genres


@router.get("/{genre_id}", response_model=GenreResponse)
async def get_genre(
    genre_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get genre by ID."""
    result = await db.execute(select(Genre).filter(Genre.id == genre_id))
    genre = result.scalar_one_or_none()

    if not genre:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Genre with id {genre_id} not found"
        )

    return genre


@router.post("", response_model=GenreResponse, status_code=status.HTTP_201_CREATED)
async def create_genre(
    genre_data: GenreCreate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db)
):
    """Create a new genre (admin only)."""
    # Check if genre with this name already exists
    result = await db.execute(select(Genre).filter(Genre.name == genre_data.name))
    existing_genre = result.scalar_one_or_none()

    if existing_genre:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Genre with name '{genre_data.name}' already exists"
        )

    new_genre = Genre(name=genre_data.name)

    db.add(new_genre)
    await db.commit()
    await db.refresh(new_genre)

    return new_genre


@router.put("/{genre_id}", response_model=GenreResponse)
async def update_genre(
    genre_id: int,
    genre_data: GenreUpdate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db)
):
    """Update genre (admin only)."""
    result = await db.execute(select(Genre).filter(Genre.id == genre_id))
    genre = result.scalar_one_or_none()

    if not genre:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Genre with id {genre_id} not found"
        )

    # Check if new name conflicts with existing genre
    if genre_data.name and genre_data.name != genre.name:
        result = await db.execute(select(Genre).filter(Genre.name == genre_data.name))
        existing_genre = result.scalar_one_or_none()

        if existing_genre:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Genre with name '{genre_data.name}' already exists"
            )

    # Update fields
    update_data = genre_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(genre, field, value)

    await db.commit()
    await db.refresh(genre)

    return genre


@router.delete("/{genre_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_genre(
    genre_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db)
):
    """Delete genre (admin only)."""
    result = await db.execute(select(Genre).filter(Genre.id == genre_id))
    genre = result.scalar_one_or_none()

    if not genre:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Genre with id {genre_id} not found"
        )

    await db.delete(genre)
    await db.commit()

    return None
