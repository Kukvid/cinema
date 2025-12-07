from datetime import datetime
from typing import Optional, List
from decimal import Decimal
from pydantic import BaseModel, Field, ConfigDict

from app.models.enums import OrderStatus
from .ticket import TicketCreate, TicketResponse
from .concession import ConcessionPreorderCreate, ConcessionPreorderCreateForOrder, ConcessionPreorderResponse, ConcessionItemResponse


# Base schema with common fields
class OrderBase(BaseModel):
    total_amount: Decimal = Field(..., ge=0, description="Total amount must be non-negative")
    discount_amount: Decimal = Field(default=Decimal("0.00"), ge=0)
    final_amount: Decimal = Field(..., ge=0, description="Final amount must be non-negative")


# Schema for creating an order
class OrderCreate(BaseModel):
    tickets: List[TicketCreate] = Field(..., min_length=1, description="At least one ticket required")
    concession_preorders: List[ConcessionPreorderCreateForOrder] = Field(default_factory=list, description="Optional concession preorders")
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
    expires_at: datetime
    status: OrderStatus
    qr_code: Optional[str] = None


# Public payment response schema for order display
class PaymentResponsePublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    order_id: int
    status: str
    payment_method: str
    transaction_id: Optional[str] = None
    card_last_four: Optional[str] = None
    payment_date: datetime
    amount: Decimal

# Concession item response for order details
class ConcessionItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: Optional[str] = None
    price: Decimal
    category_id: Optional[int] = None

# Response for concession preorder included in orders
class ConcessionPreorderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    order_id: int
    concession_item_id: int
    quantity: int
    unit_price: Decimal
    total_price: Decimal
    status: str
    pickup_code: Optional[str] = None
    pickup_date: Optional[datetime] = None
    concession_item: Optional['ConcessionItemResponse'] = None

# Schema for order with tickets
class OrderWithTickets(OrderResponse):
    tickets: List[TicketResponse] = []

# Schema for order with tickets and payment info
class OrderWithTicketsAndPayment(OrderWithTickets):
    payment: Optional['PaymentResponsePublic'] = None
    concession_preorders: List['ConcessionPreorderResponse'] = []


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

class OrderCountsResponse(BaseModel):
    active: int
    past: int
    total: int