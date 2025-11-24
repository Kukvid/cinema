from typing import Optional
from pydantic import BaseModel, EmailStr, Field, ConfigDict

from app.models.enums import DistributorStatus


# Base schema with common fields
class DistributorBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=300)
    inn: str = Field(..., min_length=10, max_length=12, description="INN must be 10 or 12 digits")
    contact_person: Optional[str] = Field(None, max_length=200)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=20)
    bank_details: Optional[str] = None


# Schema for creating a distributor
class DistributorCreate(DistributorBase):
    status: DistributorStatus = DistributorStatus.ACTIVE


# Schema for updating a distributor
class DistributorUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=300)
    contact_person: Optional[str] = Field(None, max_length=200)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=20)
    bank_details: Optional[str] = None
    status: Optional[DistributorStatus] = None


# Schema for distributor response
class DistributorResponse(DistributorBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: DistributorStatus
