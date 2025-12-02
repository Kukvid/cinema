from datetime import date, datetime
from typing import List, Annotated, Optional
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.database import get_db
from app.models.promocode import Promocode
from app.models.user import User
from app.models.enums import PromocodeStatus, DiscountType
from app.schemas.promocode import (
    PromocodeCreate, PromocodeUpdate, PromocodeResponse,
    PromocodeValidateRequest, PromocodeValidation
)
from app.routers.auth import get_current_active_user
from app.services.promocode_service import validate_promocode

router = APIRouter()


# ==================== PUBLIC ENDPOINTS ====================

@router.post("/validate", response_model=PromocodeValidation)
async def validate_promocode_endpoint(
    request: PromocodeValidateRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Validate a promocode for an order (PUBLIC endpoint - no authentication required).

    Args:
        request: Validation request with code, order_amount, and optional category

    Returns:
        PromocodeValidation with is_valid, discount_amount, and message
    """
    # Use the service layer to validate
    validation_result = await validate_promocode(
        db=db,
        code=request.code,
        order_amount=request.order_amount,
        category=request.category
    )

    return PromocodeValidation(
        code=request.code,
        order_amount=request.order_amount,
        is_valid=validation_result.is_valid,
        discount_amount=validation_result.discount_amount,
        message=validation_result.message
    )


# ==================== ADMIN ENDPOINTS ====================

@router.get("", response_model=List[PromocodeResponse])
async def get_promocodes(
    status_filter: Optional[PromocodeStatus] = Query(None, alias="status", description="Filter by status"),
    valid_today: bool = Query(False, description="Filter for promocodes valid today"),
    discount_type_filter: Optional[DiscountType] = Query(None, alias="discount_type", description="Filter by discount type"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    current_user: Annotated[User, Depends(get_current_active_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Get list of all promocodes with optional filters (requires admin authentication).

    Filters:
        - status: Filter by promocode status (ACTIVE, INACTIVE, EXPIRED, DEPLETED)
        - valid_today: Only show promocodes valid today
        - discount_type: Filter by discount type (PERCENTAGE, FIXED_AMOUNT)
    """
    query = select(Promocode).order_by(Promocode.valid_until.desc(), Promocode.code)

    # Apply status filter
    if status_filter:
        query = query.filter(Promocode.status == status_filter)

    # Apply valid_today filter
    if valid_today:
        today =datetime.now(pytz.timezone('Europe/Moscow')).date()
        query = query.filter(
            and_(
                Promocode.status == PromocodeStatus.ACTIVE,
                Promocode.valid_from <= today,
                Promocode.valid_until >= today
            )
        )

    # Apply discount_type filter
    if discount_type_filter:
        query = query.filter(Promocode.discount_type == discount_type_filter)

    # Apply pagination
    query = query.offset(skip).limit(limit)

    result = await db.execute(query)
    promocodes = result.scalars().all()

    return promocodes


@router.get("/{promocode_id}", response_model=PromocodeResponse)
async def get_promocode(
    promocode_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db)
):
    """Get a single promocode by ID (requires admin authentication)."""
    result = await db.execute(
        select(Promocode).filter(Promocode.id == promocode_id)
    )
    promocode = result.scalar_one_or_none()

    if not promocode:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Promocode with id {promocode_id} not found"
        )

    return promocode


@router.post("", response_model=PromocodeResponse, status_code=status.HTTP_201_CREATED)
async def create_promocode(
    promocode_data: PromocodeCreate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db)
):
    """Create a new promocode (requires admin authentication)."""
    # Check if promocode with same code already exists
    result = await db.execute(
        select(Promocode).filter(Promocode.code == promocode_data.code.upper())
    )
    existing_promocode = result.scalar_one_or_none()

    if existing_promocode:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Promocode with code '{promocode_data.code}' already exists"
        )

    # Create new promocode
    new_promocode = Promocode(
        code=promocode_data.code.upper(),
        description=promocode_data.description,
        discount_type=promocode_data.discount_type,
        discount_value=promocode_data.discount_value,
        valid_from=promocode_data.valid_from,
        valid_until=promocode_data.valid_until,
        max_uses=promocode_data.max_uses,
        used_count=0,
        min_order_amount=promocode_data.min_order_amount,
        applicable_category=promocode_data.applicable_category,
        status=promocode_data.status
    )

    db.add(new_promocode)
    await db.commit()
    await db.refresh(new_promocode)

    return new_promocode


@router.put("/{promocode_id}", response_model=PromocodeResponse)
async def update_promocode(
    promocode_id: int,
    promocode_data: PromocodeUpdate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db)
):
    """Update a promocode (requires admin authentication)."""
    result = await db.execute(
        select(Promocode).filter(Promocode.id == promocode_id)
    )
    promocode = result.scalar_one_or_none()

    if not promocode:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Promocode with id {promocode_id} not found"
        )

    # Update fields
    update_data = promocode_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(promocode, field, value)

    await db.commit()
    await db.refresh(promocode)

    return promocode


@router.delete("/{promocode_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_promocode(
    promocode_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db)
):
    """Delete a promocode (requires admin authentication)."""
    result = await db.execute(
        select(Promocode).filter(Promocode.id == promocode_id)
    )
    promocode = result.scalar_one_or_none()

    if not promocode:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Promocode with id {promocode_id} not found"
        )

    await db.delete(promocode)
    await db.commit()

    return None
