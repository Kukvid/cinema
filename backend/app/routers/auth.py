from datetime import datetime
from typing import Annotated
import pytz
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.user import User
from app.models.bonus_account import BonusAccount
from app.models.enums import UserStatus
from app.schemas.user import UserCreate, UserLogin, UserUpdate, UserResponse, Token
from app.utils.security import verify_password, get_password_hash, create_access_token, create_refresh_token, decode_token
from app.config import get_settings
import pytz
from sqlalchemy.orm import selectinload

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


# Dependency to get current user from JWT token
async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: AsyncSession = Depends(get_db)
) -> User:
    """Get current authenticated user from JWT token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = decode_token(token)
    if payload is None:
        raise credentials_exception

    email: str = payload.get("sub")
    if email is None:
        raise credentials_exception

    # Get user from database
    query = select(User).options(selectinload(User.role)).filter(User.email == email)
    result = await db.execute(query)
    user = result.scalar_one_or_none()

    if user is None:
        raise credentials_exception

    if user.status != UserStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is not active"
        )

    return user


async def get_current_active_user(
    current_user: Annotated[User, Depends(get_current_user)]
) -> User:
    """Get current active user (additional check)."""
    if current_user.status != UserStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db)
):
    """Register a new user."""
    # Check if user already exists
    result = await db.execute(select(User).filter(User.email == user_data.email))
    existing_user = result.scalar_one_or_none()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Create new user
    new_user = User(
        email=user_data.email,
        password_hash=get_password_hash(user_data.password),
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        phone=user_data.phone,
        birth_date=user_data.birth_date,
        gender=user_data.gender,
        city=user_data.city,
        preferred_language=user_data.preferred_language,
        marketing_consent=user_data.marketing_consent,
        data_processing_consent=user_data.data_processing_consent,
        registration_date=datetime.now(pytz.timezone('Europe/Moscow')).replace(tzinfo=None),
        status=UserStatus.ACTIVE
    )

    db.add(new_user)
    await db.flush()

    # Create bonus account for new user with initial bonus
    settings = get_settings()
    bonus_account = BonusAccount(
        user_id=new_user.id,
        balance=float(settings.BONUS_INITIAL_AMOUNT)
    )
    db.add(bonus_account)

    await db.commit()
    await db.refresh(new_user)

    return new_user


@router.post("/login", response_model=Token)
async def login(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: AsyncSession = Depends(get_db)
):
    """Login user and return JWT tokens."""
    # Get user by email
    result = await db.execute(select(User).filter(User.email == form_data.username))
    user = result.scalar_one_or_none()

    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if user.status != UserStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is not active"
        )

    # Update last login
    user.last_login =datetime.now(pytz.timezone('Europe/Moscow')).replace(tzinfo=None)
    await db.commit()

    # Create access token
    access_token = create_access_token(data={"sub": user.email})
    refresh_token = create_refresh_token(data={"sub": user.email})

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db)
):
    """Get current user profile."""
    # Get user's bonus account balance
    from sqlalchemy import select
    from app.models.bonus_account import BonusAccount

    bonus_account_result = await db.execute(
        select(BonusAccount).filter(BonusAccount.user_id == current_user.id)
    )
    bonus_account = bonus_account_result.scalar_one_or_none()

    # Create user response with bonus balance
    user_dict = current_user.__dict__.copy()
    user_dict['bonus_balance'] = bonus_account.balance if bonus_account else 0.00

    # Get role name from the role relationship
    if current_user.role:
        user_dict['role'] = current_user.role.name
    else:
        user_dict['role'] = 'user'  # default role

    # Convert to UserResponse model
    return UserResponse.model_validate(user_dict)


@router.put("/me", response_model=UserResponse)
async def update_profile(
    user_update: UserUpdate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db)
):
    """Update current user profile."""
    # Prevent changing birth date and email
    update_data = user_update.model_dump(exclude_unset=True)

    # Remove birth_date if it's being attempted to change
    if 'birth_date' in update_data:
        del update_data['birth_date']

    # Remove email if it's being attempted to change
    if 'email' in update_data:
        del update_data['email']

    # Update only allowed fields
    for field, value in update_data.items():
        setattr(current_user, field, value)

    try:
        await db.commit()
        await db.refresh(current_user)

        # Get updated bonus account balance
        bonus_account_result = await db.execute(
            select(BonusAccount).filter(BonusAccount.user_id == current_user.id)
        )
        bonus_account = bonus_account_result.scalar_one_or_none()

        # Create user response with bonus balance
        user_dict = current_user.__dict__.copy()
        user_dict['bonus_balance'] = bonus_account.balance if bonus_account else 0.00

        return UserResponse.model_validate(user_dict)
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update profile: {str(e)}"
        )


@router.post("/refresh", response_model=Token)
async def refresh_token(
    refresh_token: str,
    db: AsyncSession = Depends(get_db)
):
    """Refresh access token using refresh token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = decode_token(refresh_token)
    if payload is None:
        raise credentials_exception

    email: str = payload.get("sub")
    if email is None:
        raise credentials_exception

    # Verify user exists
    result = await db.execute(select(User).filter(User.email == email))
    user = result.scalar_one_or_none()

    if user is None or user.status != UserStatus.ACTIVE:
        raise credentials_exception

    # Create new tokens
    new_access_token = create_access_token(data={"sub": user.email})
    new_refresh_token = create_refresh_token(data={"sub": user.email})

    return {
        "access_token": new_access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer"
    }
