from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


# Base schema with common fields
class SeatBase(BaseModel):
    row_number: int = Field(..., gt=0, description="Row number must be positive")
    seat_number: int = Field(..., gt=0, description="Seat number must be positive")
    is_aisle: bool = False
    is_available: bool = True


# Schema for creating a seat
class SeatCreate(SeatBase):
    hall_id: int = Field(..., gt=0)


# Schema for updating a seat
class SeatUpdate(BaseModel):
    is_aisle: Optional[bool] = None
    is_available: Optional[bool] = None


# Schema for seat response
class SeatResponse(SeatBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    hall_id: int


# Schema for seat with booking status (used in session seat availability)
class SeatWithStatus(SeatResponse):
    is_booked: bool = False
    ticket_id: Optional[int] = None
