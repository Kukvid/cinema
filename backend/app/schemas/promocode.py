from datetime import date
from typing import Optional
from decimal import Decimal
from pydantic import BaseModel, Field, ConfigDict, field_validator

from app.models.enums import PromocodeStatus, DiscountType


# Base schema with common fields
class PromocodeBase(BaseModel):
    code: str = Field(..., min_length=1, max_length=50)
    description: Optional[str] = None
    discount_type: DiscountType
    discount_value: Decimal = Field(..., ge=0, description="Discount value must be non-negative")
    valid_from: date
    valid_until: date
    max_uses: Optional[int] = Field(None, ge=0)
    min_order_amount: Decimal = Field(default=Decimal("0.00"), ge=0)
    applicable_category: Optional[str] = Field(None, max_length=100)

    @field_validator('valid_until')
    @classmethod
    def validate_dates(cls, v, info):
        if 'valid_from' in info.data and v < info.data['valid_from']:
            raise ValueError('valid_until must be after or equal to valid_from')
        return v


# Schema for creating a promocode
class PromocodeCreate(PromocodeBase):
    status: PromocodeStatus = PromocodeStatus.ACTIVE


# Schema for updating a promocode
class PromocodeUpdate(BaseModel):
    description: Optional[str] = None
    discount_type: Optional[DiscountType] = None
    discount_value: Optional[Decimal] = Field(None, ge=0)
    valid_from: Optional[date] = None
    valid_until: Optional[date] = None
    max_uses: Optional[int] = Field(None, ge=0)
    min_order_amount: Optional[Decimal] = Field(None, ge=0)
    applicable_category: Optional[str] = Field(None, max_length=100)
    status: Optional[PromocodeStatus] = None


# Schema for promocode response
class PromocodeResponse(PromocodeBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    used_count: int
    status: PromocodeStatus


# Schema for promocode validation request
class PromocodeValidateRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=50)
    order_amount: Decimal = Field(..., gt=0)
    category: Optional[str] = Field(None, max_length=100)


# Schema for promocode validation response
class PromocodeValidation(BaseModel):
    code: str
    order_amount: Decimal
    is_valid: bool
    discount_amount: Decimal = Decimal("0.00")
    message: str
