
from datetime import datetime, date
import pytz
from typing import List, Annotated
from pydantic import ValidationError
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, asc
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.user import User
from app.models.bonus_account import BonusAccount
from app.models.enums import UserStatus
from app.schemas.user import UserResponse, UserCreate, UserUpdate
from app.routers.auth import get_current_active_user
from app.models.role import Role

from app.schemas.user import UserCreateInAdmin

router = APIRouter()


@router.get("", response_model=List[UserResponse])
async def get_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    status_filter: UserStatus | None = Query(None, alias="status"),
    cinema_id: int | None = Query(None, description="Filter by cinema ID for super admin users"),
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

    # For admin users, only show users related to their cinema
    if current_user.role.name == "admin":
        query = query.filter(User.cinema_id == current_user.cinema_id)
    elif current_user.role.name == "super_admin" and cinema_id:
        # Super admin can filter by any cinema ID
        query = query.filter(User.cinema_id == cinema_id)

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

    query = query.order_by(asc(User.id)).offset(skip).limit(limit)
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

        # Remove SQLAlchemy state attributes that shouldn't be serialized
        user_dict.pop('_sa_instance_state', None)

        users_with_bonus.append(UserResponse.model_validate(user_dict))

    return users_with_bonus


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get user by ID."""
    if not current_user.role or current_user.role.name not in ["admin", "super_admin"]:
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

    # Remove SQLAlchemy state attributes that shouldn't be serialized
    user_dict.pop('_sa_instance_state', None)

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

    result = await db.execute(
        select(User)
        .options(selectinload(User.role), selectinload(User.bonus_account))  # <-- Добавлено
        .filter(User.id == user_id)
    )
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

    # Remove SQLAlchemy state attributes that shouldn't be serialized
    user_dict.pop('_sa_instance_state', None)

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
    if not current_user.role or current_user.role.name not in ["admin", "super_admin"]:
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

@router.post("", response_model=UserResponse)
async def create_user(
    user_create: UserCreateInAdmin,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new user.
    Only admin users can create other users.
    """
    # Проверка прав доступа
    if not current_user.role or current_user.role.name not in ["super_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super_admin users can create other users"
        )

    # Проверка уникальности email
    existing_user = await db.execute(select(User).filter(User.email == user_create.email))
    if existing_user.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Проверка, что role_id существует (опционально, но рекомендуется)
    if user_create.role_id is not None:
        role_check = await db.execute(select(Role).filter(Role.id == user_create.role_id))
        if not role_check.scalar_one_or_none():
             raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Role with id {user_create.role_id} does not exist"
            )
    from app.utils.security import verify_password, get_password_hash
    # Подготовка данных для создания пользователя
    hashed_password = get_password_hash(user_create.password)

    if user_create.cinema_id==None and user_create.role.name=="super_admin":
        user_create.cinema_id=0
    # Создаем объект ORM User, используя данные из user_create
    db_user = User(
        email=user_create.email,
        password_hash=hashed_password,
        first_name=user_create.first_name,
        last_name=user_create.last_name,
        phone=user_create.phone,
        birth_date=user_create.birth_date,
        gender=user_create.gender,
        city=user_create.city,
        preferred_language=user_create.preferred_language,
        marketing_consent=user_create.marketing_consent,
        data_processing_consent=user_create.data_processing_consent,
        registration_date=datetime.now(pytz.timezone('Europe/Moscow')).date(),
        role_id=user_create.role_id, # <-- Берем из входных данных
        cinema_id=user_create.cinema_id, # <-- Добавляем cinema_id из входных данных
    )

    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)

    # Создаем бонусный счет для нового пользователя
    bonus_account = BonusAccount(user_id=db_user.id, balance=0.00)
    db.add(bonus_account)
    await db.commit()

    # Загружаем связанные объекты для формирования ответа
    # ИСПРАВЛЕНО: Добавляем options(selectinload(User.role), selectinload(User.bonus_account)) для предзагрузки связи
    result = await db.execute(
        select(User)
        .options(selectinload(User.role), selectinload(User.bonus_account)) # <-- Обязательно
        .filter(User.id == db_user.id)
    )
    created_user = result.scalar_one()

    # ИСПОЛЬЗУЕМ __dict__ как и раньше
    user_dict = created_user.__dict__.copy()

    # Add bonus balance to the user data (уже есть через bonus_account, но добавим явно)
    user_dict['bonus_balance'] = created_user.bonus_account.balance if created_user.bonus_account else 0.00

    # Add role name as string - ТЕПЕРЬ ЭТО РАБОТАЕТ, ТАК КАК UserResponse.role ОЖИДАЕТ СТРОКУ
    if created_user.role:
        user_dict['role'] = created_user.role.name
    else:
        user_dict['role'] = None # или 'user'

    # Remove SQLAlchemy state attributes that shouldn't be serialized
    user_dict.pop('_sa_instance_state', None)

    # Возвращаем валидированный объект Pydantic, используя обновленный словарь
    # С той же оговоркой про from_attributes.
    try:
        return UserResponse.model_validate(user_dict)
    except ValidationError:
        # Если model_validate не справляется, используем конструктор
        return UserResponse(**user_dict)