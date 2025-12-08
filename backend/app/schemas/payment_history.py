from pydantic import BaseModel
from datetime import datetime, date
from decimal import Decimal
from typing import Optional
from app.models.enums import PaymentStatus


class PaymentHistoryBase(BaseModel):
    rental_contract_id: int
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

    class Config:
        from_attributes = True