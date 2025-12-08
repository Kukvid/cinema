from datetime import date
from typing import Optional
from decimal import Decimal
from pydantic import BaseModel, Field, ConfigDict, field_validator

class RoleBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)

class RoleResponse(RoleBase):
    model_config = ConfigDict(from_attributes=True)

    id: int