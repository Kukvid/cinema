from typing import List, Annotated
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.film import Film, film_genres
from app.models.genre import Genre
from app.models.user import User
from app.schemas.film import FilmCreate, FilmUpdate, FilmResponse, FilmsPaginatedResponse
from app.routers.auth import get_current_active_user

router = APIRouter()


@router.get("", response_model=FilmsPaginatedResponse)
async def get_films(
    genre_id: int | None = Query(None, description="Filter by genre ID"),
    release_year: int | None = Query(None, description="Filter by release year"),
    search: str | None = Query(None, description="Search in title and original title"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    """Get list of films with optional filters and pagination."""
    # Build base query
    base_query = select(Film)

    if genre_id:
        # Join with film_genres to filter by genre
        base_query = base_query.join(film_genres).filter(film_genres.c.genre_id == genre_id)

    if release_year:
        base_query = base_query.filter(Film.release_year == release_year)

    if search:
        base_query = base_query.filter(
            or_(
                Film.title.ilike(f"%{search}%"),
                Film.original_title.ilike(f"%{search}%")
            )
        )

    # Get total count
    count_query = select(func.count()).select_from(base_query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # Get paginated films
    query = base_query.options(selectinload(Film.genres)).offset(skip).limit(limit)
    result = await db.execute(query)
    films = result.scalars().unique().all()

    # Check if there are more films
    has_more = (skip + limit) < total

    return FilmsPaginatedResponse(
        items=films,
        total=total,
        skip=skip,
        limit=limit,
        hasMore=has_more
    )


@router.get("/{film_id}", response_model=FilmResponse)
async def get_film(
    film_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get film by ID."""
    result = await db.execute(
        select(Film)
        .options(selectinload(Film.genres))
        .filter(Film.id == film_id)
    )
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
    # Verify all genre IDs exist
    if film_data.genre_ids:
        result = await db.execute(select(Genre).filter(Genre.id.in_(film_data.genre_ids)))
        genres = result.scalars().all()

        if len(genres) != len(film_data.genre_ids):
            found_ids = {g.id for g in genres}
            missing_ids = set(film_data.genre_ids) - found_ids
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Genres with IDs {missing_ids} not found"
            )
    else:
        genres = []

    new_film = Film(
        title=film_data.title,
        original_title=film_data.original_title,
        description=film_data.description,
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

    # Associate genres with film
    new_film.genres = genres

    db.add(new_film)
    await db.commit()
    await db.refresh(new_film, attribute_names=['genres'])

    return new_film


@router.put("/{film_id}", response_model=FilmResponse)
async def update_film(
    film_id: int,
    film_data: FilmUpdate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db)
):
    """Update film."""
    result = await db.execute(
        select(Film)
        .options(selectinload(Film.genres))
        .filter(Film.id == film_id)
    )
    film = result.scalar_one_or_none()

    if not film:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Film with id {film_id} not found"
        )

    # Update fields
    update_data = film_data.model_dump(exclude_unset=True)

    # Handle genre_ids separately
    genre_ids = update_data.pop('genre_ids', None)
    if genre_ids is not None:
        # Verify all genre IDs exist
        result = await db.execute(select(Genre).filter(Genre.id.in_(genre_ids)))
        genres = result.scalars().all()

        if len(genres) != len(genre_ids):
            found_ids = {g.id for g in genres}
            missing_ids = set(genre_ids) - found_ids
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Genres with IDs {missing_ids} not found"
            )

        # Update genres
        film.genres = genres

    # Update other fields
    for field, value in update_data.items():
        setattr(film, field, value)

    await db.commit()
    await db.refresh(film, attribute_names=['genres'])

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
