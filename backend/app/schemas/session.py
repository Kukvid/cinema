from datetime import date, time
from typing import Optional, List
from decimal import Decimal
from pydantic import BaseModel, Field, ConfigDict, field_validator

from app.models.enums import SessionStatus
from .seat import SeatWithStatus


# Base schema with common fields
class SessionBase(BaseModel):
    session_date: date
    start_time: time
    end_time: time
    ticket_price: Decimal = Field(..., ge=0, description="Ticket price must be non-negative")

    @field_validator('end_time')
    @classmethod
    def validate_session_times(cls, v, info):
        if 'start_time' in info.data and v <= info.data['start_time']:
            raise ValueError('end_time must be after start_time')
        return v


# Schema for creating a session
class SessionCreate(SessionBase):
    film_id: int = Field(..., gt=0)
    hall_id: int = Field(..., gt=0)
    status: SessionStatus = SessionStatus.SCHEDULED


# Schema for updating a session
class SessionUpdate(BaseModel):
    session_date: Optional[date] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    ticket_price: Optional[Decimal] = Field(None, ge=0)
    status: Optional[SessionStatus] = None


# Schema for session response
class SessionResponse(SessionBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    film_id: int
    hall_id: int
    status: SessionStatus


# Schema for session with available seats
class SessionWithSeats(SessionResponse):
    available_seats_count: int
    total_seats_count: int
    seats: List[SeatWithStatus] = []


# Schema for session filter
class SessionFilter(BaseModel):
    cinema_id: Optional[int] = None
    film_id: Optional[int] = None
    session_date: Optional[date] = None
    status: Optional[SessionStatus] = None
