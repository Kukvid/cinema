from datetime import datetime
from typing import Optional, List
from decimal import Decimal
from pydantic import BaseModel, Field, ConfigDict

from app.models.enums import OrderStatus
from .ticket import TicketCreate, TicketResponse


# Base schema with common fields
class OrderBase(BaseModel):
    total_amount: Decimal = Field(..., ge=0, description="Total amount must be non-negative")
    discount_amount: Decimal = Field(default=Decimal("0.00"), ge=0)
    final_amount: Decimal = Field(..., ge=0, description="Final amount must be non-negative")


# Schema for creating an order
class OrderCreate(BaseModel):
    tickets: List[TicketCreate] = Field(..., min_length=1, description="At least one ticket required")
    total_order_amount: Decimal = Field(..., ge=0, description="Total order amount including tickets and concessions")
    promocode_code: Optional[str] = None
    use_bonus_points: Optional[Decimal] = Field(None, ge=0)


# Schema for order response
class OrderResponse(OrderBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    promocode_id: Optional[int] = None
    order_number: str
    created_at: datetime
    status: OrderStatus
    qr_code: Optional[str] = None


# Schema for order with tickets
class OrderWithTickets(OrderResponse):
    tickets: List[TicketResponse] = []


# Schema for payment processing
class PaymentCreate(BaseModel):
    amount: Decimal = Field(..., gt=0, description="Payment amount must be positive")
    payment_method: str = Field(..., description="Payment method: card, cash, mobile_payment")
    card_number: Optional[str] = Field(None, description="Full card number (for card payments)")
    card_expiry: Optional[str] = Field(None, description="Card expiry date in MM/YY format (for card payments)")
    card_cvv: Optional[str] = Field(None, description="Card CVV code (for card payments)")


# Schema for payment response
class PaymentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    order_id: int
    status: str
    payment_method: str
    transaction_id: Optional[str] = None
    message: str
