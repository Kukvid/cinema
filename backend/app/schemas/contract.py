from datetime import date
from typing import Optional, Union
from decimal import Decimal
from pydantic import BaseModel, Field, ConfigDict, field_validator
from datetime import datetime

from app.models.enums import ContractStatus


# Base schema with common fields (without date validation that applies to existing contracts)
class RentalContractBase(BaseModel):
    contract_number: str = Field(..., min_length=1, max_length=50)
    contract_date: date
    rental_start_date: date
    rental_end_date: date
    distributor_percentage: Optional[Decimal] = Field(default=Decimal("0.00"), ge=0, le=100)

    @field_validator('rental_end_date')
    @classmethod
    def validate_rental_dates(cls, v, values):
        if hasattr(values, 'rental_start_date') and v <= values.rental_start_date:
            raise ValueError('rental_end_date must be after rental_start_date')
        return v

    @field_validator('contract_date')
    @classmethod
    def validate_contract_date_not_future(cls, v):
        if v > date.today():
            raise ValueError('contract_date cannot be in the future')
        return v

    @field_validator('rental_start_date')
    @classmethod
    def validate_rental_start_after_contract_date(cls, v, values):
        if hasattr(values, 'contract_date') and v < values.contract_date:
            raise ValueError('rental_start_date cannot be before contract_date')
        return v


# Schema for creating a rental contract with additional validations
class RentalContractCreate(RentalContractBase):
    film_id: int = Field(..., gt=0)
    distributor_id: int = Field(..., gt=0)
    cinema_id: int = Field(..., gt=0)
    status: ContractStatus = ContractStatus.ACTIVE

    @field_validator('rental_start_date')
    @classmethod
    def validate_rental_start_date_not_before_today(cls, v):
        if v < date.today():
            raise ValueError('rental_start_date cannot be before today')
        return v


# Schema for updating a rental contract
class RentalContractUpdate(BaseModel):
    rental_end_date: Optional[date] = None
    status: Optional[ContractStatus] = None


# Schema for rental contract response
class RentalContractResponse(RentalContractBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    film_id: int
    distributor_id: int
    cinema_id: int
    status: ContractStatus
