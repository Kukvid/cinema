from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


# Base schema with common fields
class GenreBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Genre name")


# Schema for creating a genre
class GenreCreate(GenreBase):
    pass


# Schema for updating a genre
class GenreUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)


# Schema for genre response
class GenreResponse(GenreBase):
    model_config = ConfigDict(from_attributes=True)

    id: int