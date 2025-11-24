from datetime import date
from typing import Optional
from decimal import Decimal
from pydantic import BaseModel, Field, ConfigDict, field_validator

from app.models.enums import ContractStatus


# Base schema with common fields
class RentalContractBase(BaseModel):
    contract_number: str = Field(..., min_length=1, max_length=50)
    contract_date: date
    rental_start_date: date
    rental_end_date: date
    min_screening_period_days: Optional[int] = Field(None, ge=0)
    min_sessions_per_day: Optional[int] = Field(None, ge=0)
    distributor_percentage_week1: Decimal = Field(..., ge=0, le=100, description="Percentage must be 0-100")
    distributor_percentage_week2: Decimal = Field(..., ge=0, le=100, description="Percentage must be 0-100")
    distributor_percentage_week3: Decimal = Field(..., ge=0, le=100, description="Percentage must be 0-100")
    distributor_percentage_after: Decimal = Field(..., ge=0, le=100, description="Percentage must be 0-100")
    guaranteed_minimum_amount: Decimal = Field(default=Decimal("0.00"), ge=0)
    cinema_operational_costs: Decimal = Field(default=Decimal("0.00"), ge=0)
    early_termination_terms: Optional[str] = None

    @field_validator('rental_end_date')
    @classmethod
    def validate_rental_dates(cls, v, info):
        if 'rental_start_date' in info.data and v <= info.data['rental_start_date']:
            raise ValueError('rental_end_date must be after rental_start_date')
        return v


# Schema for creating a rental contract
class RentalContractCreate(RentalContractBase):
    film_id: int = Field(..., gt=0)
    distributor_id: int = Field(..., gt=0)
    cinema_id: int = Field(..., gt=0)
    status: ContractStatus = ContractStatus.ACTIVE


# Schema for updating a rental contract
class RentalContractUpdate(BaseModel):
    rental_end_date: Optional[date] = None
    status: Optional[ContractStatus] = None
    early_termination_terms: Optional[str] = None


# Schema for rental contract response
class RentalContractResponse(RentalContractBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    film_id: int
    distributor_id: int
    cinema_id: int
    status: ContractStatus
