from pydantic import BaseModel
from datetime import datetime, date
from decimal import Decimal
from typing import Optional
from app.models.enums import PaymentStatus
from pydantic import field_serializer

# Import the related schemas - avoiding full response schemas that include relationships


# Create simplified schemas that don't have nested relationships to avoid loading issues
class SimpleFilmResponse(BaseModel):
    id: int
    title: str
    original_title: Optional[str] = None

    class Config:
        from_attributes = True


class SimpleDistributorResponse(BaseModel):
    id: int
    name: str
    contact_person: Optional[str] = None

    class Config:
        from_attributes = True


class SimpleCinemaResponse(BaseModel):
    id: int
    name: str
    city: str

    class Config:
        from_attributes = True


class RentalContractWithRelatedResponse(BaseModel):
    """Schema for rental contract with related entities for payment history"""
    id: int
    film_id: int
    distributor_id: int
    cinema_id: int
    contract_number: str
    contract_date: date
    rental_start_date: date
    rental_end_date: date
    distributor_percentage: Optional[Decimal] = None
    status: str  # Using str representation

    # Simple related entities (without nested relationships that cause loading issues)
    film: Optional[SimpleFilmResponse] = None
    distributor: Optional[SimpleDistributorResponse] = None
    cinema: Optional[SimpleCinemaResponse] = None

    class Config:
        from_attributes = True


class PaymentHistoryBase(BaseModel):
    calculated_amount: Decimal
    calculation_date: datetime
    payment_status: PaymentStatus = PaymentStatus.PENDING
    payment_date: Optional[date] = None
    payment_document_number: Optional[str] = None


class PaymentHistoryCreate(PaymentHistoryBase):
    pass


class PaymentHistoryUpdate(BaseModel):
    payment_status: Optional[PaymentStatus] = None
    payment_date: Optional[date] = None
    payment_document_number: Optional[str] = None


class PaymentHistoryResponse(PaymentHistoryBase):
    id: int
    rental_contract_id: int  # Keep the ID for reference
    rental_contract: Optional[RentalContractWithRelatedResponse] = None  # Include related data

    class Config:
        from_attributes = True

    @field_serializer('calculation_date')
    def serialize_calculation_date(self, value: datetime) -> str:
        if value:
            return value.strftime('%d.%m.%Y')
        return value

    @field_serializer('payment_date')
    def serialize_payment_date(self, value: date) -> str:
        if value:
            return value.strftime('%d.%m.%Y')
        return value