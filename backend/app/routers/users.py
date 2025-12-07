from typing import List, Annotated
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.user import User
from app.models.bonus_account import BonusAccount
from app.models.enums import UserStatus
from app.schemas.user import UserResponse, UserCreate, UserUpdate
from app.routers.auth import get_current_active_user
from app.models.role import Role

router = APIRouter()


@router.get("", response_model=List[UserResponse])
async def get_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    status_filter: UserStatus | None = Query(None, alias="status"),
    search: str | None = Query(None, description="Search by email, first_name, or last_name"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get list of users with pagination and filters."""
    # Only admin users should be able to see all users
    if not current_user.role or current_user.role.name not in [ "admin", "super_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin users can access user management"
        )

    query = select(User).options(
        selectinload(User.role),
        selectinload(User.bonus_account)
    )

    # Apply filters
    if status_filter:
        query = query.filter(User.status == status_filter)

    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            User.email.ilike(search_filter) |
            User.first_name.ilike(search_filter) |
            User.last_name.ilike(search_filter)
        )

    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    users = result.scalars().unique().all()

    # Add bonus balance to each user
    users_with_bonus = []
    for user in users:
        # Create a dictionary copy of user data
        user_dict = user.__dict__.copy()
        
        # Get bonus account if exists
        bonus_account = await db.execute(
            select(BonusAccount).filter(BonusAccount.user_id == user.id)
        )
        bonus_account = bonus_account.scalar_one_or_none()
        
        # Add bonus balance to the user dict
        user_dict['bonus_balance'] = bonus_account.balance if bonus_account else 0.00
        
        # Add role name
        if user.role:
            user_dict['role'] = user.role.name
        else:
            user_dict['role'] = 'user'

        users_with_bonus.append(UserResponse.model_validate(user_dict))

    return users_with_bonus


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get user by ID."""
    if not current_user.role or current_user.role.name not in ["admin", "manager"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin or manager users can access user details"
        )

    result = await db.execute(
        select(User)
        .options(selectinload(User.role), selectinload(User.bonus_account))
        .filter(User.id == user_id)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with id {user_id} not found"
        )

    # Add bonus balance to the user data
    bonus_account = await db.execute(
        select(BonusAccount).filter(BonusAccount.user_id == user.id)
    )
    bonus_account = bonus_account.scalar_one_or_none()

    user_dict = user.__dict__.copy()
    user_dict['bonus_balance'] = bonus_account.balance if bonus_account else 0.00

    if user.role:
        user_dict['role'] = user.role.name
    else:
        user_dict['role'] = 'user'

    return UserResponse.model_validate(user_dict)


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_update: UserUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Update user by ID."""
    if not current_user.role or current_user.role.name not in [ "admin", "super_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin users can update other users"
        )

    result = await db.execute(select(User).filter(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with id {user_id} not found"
        )

    # Update fields
    update_data = user_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)

    await db.commit()
    await db.refresh(user)

    # Add bonus balance to the user data
    bonus_account = await db.execute(
        select(BonusAccount).filter(BonusAccount.user_id == user.id)
    )
    bonus_account = bonus_account.scalar_one_or_none()

    user_dict = user.__dict__.copy()
    user_dict['bonus_balance'] = bonus_account.balance if bonus_account else 0.00

    if user.role:
        user_dict['role'] = user.role.name
    else:
        user_dict['role'] = 'user'

    return UserResponse.model_validate(user_dict)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete user by ID."""
    if not current_user.role or current_user.role.name not in [ "admin", "super_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin users can delete other users"
        )

    result = await db.execute(select(User).filter(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with id {user_id} not found"
        )

    await db.delete(user)
    await db.commit()

    return None


@router.get("/{user_id}/bonus-balance", response_model=float)
async def get_user_bonus_balance(
    user_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get user's bonus account balance."""
    if not current_user.role or current_user.role.name not in ["admin", "manager"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin or manager users can access bonus balances"
        )

    result = await db.execute(select(User).filter(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with id {user_id} not found"
        )

    bonus_account = await db.execute(
        select(BonusAccount).filter(BonusAccount.user_id == user_id)
    )
    bonus_account = bonus_account.scalar_one_or_none()

    return bonus_account.balance if bonus_account else 0.00