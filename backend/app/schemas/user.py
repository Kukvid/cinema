from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, ConfigDict

from app.models.enums import UserStatus, Gender


# Base schema with common fields
class UserBase(BaseModel):
    email: EmailStr
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    birth_date: Optional[date] = None
    gender: Optional[Gender] = None
    city: Optional[str] = None
    preferred_language: str = "ru"
    marketing_consent: bool = False


# Schema for user registration
class UserCreate(UserBase):
    password: str = Field(..., min_length=6, description="Password must be at least 6 characters")
    data_processing_consent: bool = Field(default=True, description="User must consent to data processing")


# Schema for user login
class UserLogin(BaseModel):
    email: EmailStr
    password: str


# Schema for user update
class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    birth_date: Optional[date] = None
    gender: Optional[Gender] = None
    city: Optional[str] = None
    preferred_language: Optional[str] = None
    marketing_consent: Optional[bool] = None


# Schema for user response (excludes password)
class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    birth_date: Optional[date] = None
    gender: Optional[Gender] = None
    city: Optional[str] = None
    position: Optional[str] = None
    registration_date: datetime
    employment_date: Optional[date] = None
    last_login: Optional[datetime] = None
    status: UserStatus
    marketing_consent: bool
    preferred_language: str
    role_id: Optional[int] = None
    cinema_id: Optional[int] = None


# JWT Token response
class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    email: Optional[str] = None
