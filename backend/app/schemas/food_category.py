from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


# Base schema with common fields
class FoodCategoryBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    display_order: int = Field(default=0, ge=0)


# Schema for creating a food category
class FoodCategoryCreate(FoodCategoryBase):
    pass


# Schema for updating a food category
class FoodCategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    display_order: Optional[int] = Field(None, ge=0)


# Schema for food category response
class FoodCategoryResponse(FoodCategoryBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
