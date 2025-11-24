from datetime import date
from typing import Optional
from decimal import Decimal
from pydantic import BaseModel, Field, ConfigDict

from app.models.enums import CinemaStatus


# Base schema with common fields
class CinemaBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    address: str = Field(..., min_length=1, max_length=500)
    city: str = Field(..., min_length=1, max_length=100)
    latitude: Optional[Decimal] = Field(None, ge=-90, le=90)
    longitude: Optional[Decimal] = Field(None, ge=-180, le=180)
    phone: Optional[str] = Field(None, max_length=20)


# Schema for creating a cinema
class CinemaCreate(CinemaBase):
    status: CinemaStatus = CinemaStatus.ACTIVE
    opening_date: Optional[date] = None


# Schema for updating a cinema
class CinemaUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    address: Optional[str] = Field(None, min_length=1, max_length=500)
    city: Optional[str] = Field(None, min_length=1, max_length=100)
    latitude: Optional[Decimal] = Field(None, ge=-90, le=90)
    longitude: Optional[Decimal] = Field(None, ge=-180, le=180)
    phone: Optional[str] = Field(None, max_length=20)
    status: Optional[CinemaStatus] = None
    opening_date: Optional[date] = None


# Schema for cinema response
class CinemaResponse(CinemaBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: CinemaStatus
    opening_date: Optional[date] = None
