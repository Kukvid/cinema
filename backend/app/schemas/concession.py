from typing import Optional
from decimal import Decimal
from pydantic import BaseModel, Field, ConfigDict

from app.models.enums import ConcessionItemStatus
from app.schemas.food_category import FoodCategoryResponse


# Base schema with common fields
class ConcessionItemBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    price: Decimal = Field(..., ge=0, description="Price must be non-negative")
    portion_size: Optional[str] = Field(None, max_length=50)
    calories: Optional[int] = Field(None, ge=0)
    image_url: Optional[str] = Field(None, max_length=500)


# Schema for creating a concession item
class ConcessionItemCreate(ConcessionItemBase):
    cinema_id: int = Field(..., gt=0)
    category_id: int = Field(..., gt=0)
    stock_quantity: int = Field(default=0, ge=0)
    status: ConcessionItemStatus = ConcessionItemStatus.AVAILABLE


# Schema for updating a concession item
class ConcessionItemUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    price: Optional[Decimal] = Field(None, ge=0)
    portion_size: Optional[str] = Field(None, max_length=50)
    calories: Optional[int] = Field(None, ge=0)
    stock_quantity: Optional[int] = Field(None, ge=0)
    status: Optional[ConcessionItemStatus] = None
    image_url: Optional[str] = Field(None, max_length=500)


# Schema for concession item response
class ConcessionItemResponse(ConcessionItemBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    cinema_id: int
    category_id: int
    category: Optional[FoodCategoryResponse] = None
    stock_quantity: int
    status: ConcessionItemStatus


# Schema for creating a concession preorder
class ConcessionPreorderCreate(BaseModel):
    order_id: int = Field(..., gt=0)
    concession_item_id: int = Field(..., gt=0)
    quantity: int = Field(..., gt=0, description="Quantity must be positive")
    item_price: Decimal = Field(..., ge=0)


# Schema for concession preorder response
class ConcessionPreorderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    order_id: int
    concession_item_id: int
    quantity: int
    item_price: Decimal
    total_price: Decimal
    pickup_code: Optional[str] = None
    status: str
