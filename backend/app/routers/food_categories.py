from typing import List, Annotated
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.food_category import FoodCategory
from app.models.user import User
from app.schemas.food_category import (
    FoodCategoryCreate, FoodCategoryUpdate, FoodCategoryResponse
)
from app.routers.auth import get_current_active_user

router = APIRouter()


@router.get("", response_model=List[FoodCategoryResponse])
async def get_food_categories(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    """Get list of food categories."""
    query = select(FoodCategory).order_by(FoodCategory.display_order, FoodCategory.name)

    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    categories = result.scalars().all()

    return categories


@router.get("/{category_id}", response_model=FoodCategoryResponse)
async def get_food_category(
    category_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get food category by ID."""
    result = await db.execute(select(FoodCategory).filter(FoodCategory.id == category_id))
    category = result.scalar_one_or_none()

    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Food category with id {category_id} not found"
        )

    return category


@router.post("", response_model=FoodCategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_food_category(
    category_data: FoodCategoryCreate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db)
):
    """Create a new food category. Requires authentication."""
    # Check if category with same name already exists
    result = await db.execute(
        select(FoodCategory).filter(FoodCategory.name == category_data.name)
    )
    existing_category = result.scalar_one_or_none()

    if existing_category:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Food category with name '{category_data.name}' already exists"
        )

    new_category = FoodCategory(
        name=category_data.name,
        display_order=category_data.display_order
    )

    db.add(new_category)
    await db.commit()
    await db.refresh(new_category)

    return new_category


@router.put("/{category_id}", response_model=FoodCategoryResponse)
async def update_food_category(
    category_id: int,
    category_data: FoodCategoryUpdate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db)
):
    """Update food category. Requires authentication."""
    result = await db.execute(select(FoodCategory).filter(FoodCategory.id == category_id))
    category = result.scalar_one_or_none()

    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Food category with id {category_id} not found"
        )

    # Check if new name conflicts with existing category
    if category_data.name and category_data.name != category.name:
        result = await db.execute(
            select(FoodCategory).filter(FoodCategory.name == category_data.name)
        )
        existing_category = result.scalar_one_or_none()

        if existing_category:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Food category with name '{category_data.name}' already exists"
            )

    # Update fields
    update_data = category_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(category, field, value)

    await db.commit()
    await db.refresh(category)

    return category


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_food_category(
    category_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db)
):
    """Delete food category. Requires authentication."""
    result = await db.execute(select(FoodCategory).filter(FoodCategory.id == category_id))
    category = result.scalar_one_or_none()

    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Food category with id {category_id} not found"
        )

    await db.delete(category)
    await db.commit()

    return None
