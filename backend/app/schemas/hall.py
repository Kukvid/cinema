from typing import Optional
from pydantic import BaseModel, Field, ConfigDict

from app.models.enums import HallStatus, HallType


# Base schema with common fields
class HallBase(BaseModel):
    hall_number: str = Field(..., min_length=1, max_length=10)
    name: Optional[str] = Field(None, max_length=100)
    capacity: int = Field(..., gt=0, description="Hall capacity must be positive")
    hall_type: HallType = HallType.STANDARD


# Schema for creating a hall
class HallCreate(HallBase):
    cinema_id: int = Field(..., gt=0)
    status: HallStatus = HallStatus.ACTIVE


# Schema for updating a hall
class HallUpdate(BaseModel):
    hall_number: Optional[str] = Field(None, min_length=1, max_length=10)
    name: Optional[str] = Field(None, max_length=100)
    capacity: Optional[int] = Field(None, gt=0)
    hall_type: Optional[HallType] = None
    status: Optional[HallStatus] = None


# Schema for hall response
class HallResponse(HallBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    cinema_id: int
    status: HallStatus
