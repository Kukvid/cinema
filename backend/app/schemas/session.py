from datetime import datetime, date
from typing import Optional, List
from decimal import Decimal
from pydantic import BaseModel, Field, ConfigDict, field_validator

from app.models.enums import SessionStatus

from . import FilmResponse
from .seat import SeatWithStatus
from .hall import HallResponse
from .cinema import CinemaResponse


# Base schema with common fields
class SessionBase(BaseModel):
    start_datetime: datetime
    end_datetime: datetime
    ticket_price: Decimal = Field(..., ge=0, description="Ticket price must be non-negative")

    @field_validator('end_datetime')
    @classmethod
    def validate_session_times(cls, v, info):
        if 'start_datetime' in info.data and v <= info.data['start_datetime']:
            raise ValueError('end_datetime must be after start_datetime')
        return v


# Schema for creating a session
class SessionCreate(SessionBase):
    film_id: int = Field(..., gt=0)
    hall_id: int = Field(..., gt=0)
    status: SessionStatus = SessionStatus.SCHEDULED


# Schema for updating a session
class SessionUpdate(BaseModel):
    start_datetime: Optional[datetime] = None
    end_datetime: Optional[datetime] = None
    ticket_price: Optional[Decimal] = Field(None, ge=0)
    status: Optional[SessionStatus] = None


# Nested schema for hall with cinema info
class HallWithCinema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: Optional[str] = None
    hall_number: str
    capacity: int
    cinema: Optional[CinemaResponse] = None


# Schema for session response
class SessionResponse(SessionBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    film_id: int
    hall_id: int
    status: SessionStatus
    hall: Optional[HallWithCinema] = None
    film_title: str = None
    available_seats: Optional[int] = None


# Schema for session with available seats
class SessionWithSeats(SessionResponse):
    available_seats_count: int
    total_seats_count: int
    seats: List[SeatWithStatus] = []


# Schema for session filter
class SessionFilter(BaseModel):
    cinema_id: Optional[int] = None
    film_id: Optional[int] = None
    date: Optional[date] = None
    status: Optional[SessionStatus] = None
