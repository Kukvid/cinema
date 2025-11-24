from datetime import datetime
from typing import Optional
from decimal import Decimal
from pydantic import BaseModel, Field, ConfigDict

from app.models.enums import TicketStatus, SalesChannel


# Base schema with common fields
class TicketBase(BaseModel):
    price: Decimal = Field(..., ge=0, description="Price must be non-negative")
    sales_channel: SalesChannel = SalesChannel.ONLINE


# Schema for creating a ticket
class TicketCreate(BaseModel):
    session_id: int = Field(..., gt=0)
    seat_id: int = Field(..., gt=0)
    price: Decimal = Field(..., ge=0)
    sales_channel: SalesChannel = SalesChannel.ONLINE


# Schema for ticket response
class TicketResponse(TicketBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    session_id: int
    seat_id: int
    buyer_id: Optional[int] = None
    order_id: int
    seller_id: Optional[int] = None
    purchase_date: datetime
    status: TicketStatus
    qr_code: Optional[str] = None
    validation_date: Optional[datetime] = None


# Schema for QR code validation
class TicketValidation(BaseModel):
    qr_code: str
    is_valid: bool
    message: str
    ticket_id: Optional[int] = None
