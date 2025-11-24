from typing import List, Annotated
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_

from app.database import get_db
from app.models.film import Film
from app.models.user import User
from app.schemas.film import FilmCreate, FilmUpdate, FilmResponse
from app.routers.auth import get_current_active_user

router = APIRouter()


@router.get("", response_model=List[FilmResponse])
async def get_films(
    genre: str | None = Query(None, description="Filter by genre"),
    release_year: int | None = Query(None, description="Filter by release year"),
    search: str | None = Query(None, description="Search in title and original title"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    """Get list of films with optional filters."""
    query = select(Film)

    if genre:
        query = query.filter(Film.genre.ilike(f"%{genre}%"))

    if release_year:
        query = query.filter(Film.release_year == release_year)

    if search:
        query = query.filter(
            or_(
                Film.title.ilike(f"%{search}%"),
                Film.original_title.ilike(f"%{search}%")
            )
        )

    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    films = result.scalars().all()

    return films


@router.get("/{film_id}", response_model=FilmResponse)
async def get_film(
    film_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get film by ID."""
    result = await db.execute(select(Film).filter(Film.id == film_id))
    film = result.scalar_one_or_none()

    if not film:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Film with id {film_id} not found"
        )

    return film


@router.post("", response_model=FilmResponse, status_code=status.HTTP_201_CREATED)
async def create_film(
    film_data: FilmCreate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db)
):
    """Create a new film."""
    new_film = Film(
        title=film_data.title,
        original_title=film_data.original_title,
        description=film_data.description,
        genre=film_data.genre,
        age_rating=film_data.age_rating,
        duration_minutes=film_data.duration_minutes,
        release_year=film_data.release_year,
        country=film_data.country,
        director=film_data.director,
        actors=film_data.actors,
        poster_url=film_data.poster_url,
        trailer_url=film_data.trailer_url,
        imdb_rating=film_data.imdb_rating,
        kinopoisk_rating=film_data.kinopoisk_rating
    )

    db.add(new_film)
    await db.commit()
    await db.refresh(new_film)

    return new_film


@router.put("/{film_id}", response_model=FilmResponse)
async def update_film(
    film_id: int,
    film_data: FilmUpdate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db)
):
    """Update film."""
    result = await db.execute(select(Film).filter(Film.id == film_id))
    film = result.scalar_one_or_none()

    if not film:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Film with id {film_id} not found"
        )

    # Update fields
    update_data = film_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(film, field, value)

    await db.commit()
    await db.refresh(film)

    return film


@router.delete("/{film_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_film(
    film_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db)
):
    """Delete film."""
    result = await db.execute(select(Film).filter(Film.id == film_id))
    film = result.scalar_one_or_none()

    if not film:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Film with id {film_id} not found"
        )

    await db.delete(film)
    await db.commit()

    return None
