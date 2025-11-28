from typing import Optional, List
from decimal import Decimal
from pydantic import BaseModel, Field, ConfigDict

from .genre import GenreResponse


# Base schema with common fields
class FilmBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=300)
    original_title: Optional[str] = Field(None, max_length=300)
    description: Optional[str] = None
    age_rating: Optional[str] = Field(None, max_length=5)
    duration_minutes: int = Field(..., gt=0, description="Duration must be positive")
    release_year: Optional[int] = Field(None, ge=1895, le=2100)
    country: Optional[str] = Field(None, max_length=200)
    director: Optional[str] = Field(None, max_length=200)
    actors: Optional[str] = None
    poster_url: Optional[str] = Field(None, max_length=500)
    trailer_url: Optional[str] = Field(None, max_length=500)
    imdb_rating: Optional[Decimal] = Field(None, ge=0, le=10)
    kinopoisk_rating: Optional[Decimal] = Field(None, ge=0, le=10)


# Schema for creating a film
class FilmCreate(FilmBase):
    genre_ids: List[int] = Field(default_factory=list, description="List of genre IDs")


# Schema for updating a film
class FilmUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=300)
    original_title: Optional[str] = Field(None, max_length=300)
    description: Optional[str] = None
    age_rating: Optional[str] = Field(None, max_length=5)
    duration_minutes: Optional[int] = Field(None, gt=0)
    release_year: Optional[int] = Field(None, ge=1895, le=2100)
    country: Optional[str] = Field(None, max_length=200)
    director: Optional[str] = Field(None, max_length=200)
    actors: Optional[str] = None
    poster_url: Optional[str] = Field(None, max_length=500)
    trailer_url: Optional[str] = Field(None, max_length=500)
    imdb_rating: Optional[Decimal] = Field(None, ge=0, le=10)
    kinopoisk_rating: Optional[Decimal] = Field(None, ge=0, le=10)
    genre_ids: Optional[List[int]] = Field(None, description="List of genre IDs")


# Schema for film response
class FilmResponse(FilmBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    genres: List[GenreResponse] = Field(default_factory=list, description="List of genres")


# Schema for film filtering
class FilmFilter(BaseModel):
    genre_id: Optional[int] = Field(None, description="Filter by genre ID")
    release_year: Optional[int] = None
    min_rating: Optional[Decimal] = None
    search: Optional[str] = None


# Schema for paginated films response
class FilmsPaginatedResponse(BaseModel):
    items: List[FilmResponse] = Field(default_factory=list, description="List of films")
    total: int = Field(..., description="Total number of films")
    skip: int = Field(..., description="Number of films skipped")
    limit: int = Field(..., description="Number of films per page")
    hasMore: bool = Field(..., description="Whether there are more films to load")
