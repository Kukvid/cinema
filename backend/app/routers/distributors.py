from typing import List, Annotated
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.distributor import Distributor
from app.models.user import User
from app.models.enums import DistributorStatus
from app.schemas.distributor import DistributorCreate, DistributorUpdate, DistributorResponse
from app.routers.auth import get_current_active_user

router = APIRouter()


@router.get("", response_model=List[DistributorResponse])
async def get_distributors(
    status_filter: DistributorStatus | None = Query(None, alias="status", description="Filter by status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    """Get list of distributors."""
    query = select(Distributor)

    if status_filter:
        query = query.filter(Distributor.status == status_filter)

    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    distributors = result.scalars().all()

    return distributors


@router.get("/{distributor_id}", response_model=DistributorResponse)
async def get_distributor(
    distributor_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get distributor by ID."""
    result = await db.execute(select(Distributor).filter(Distributor.id == distributor_id))
    distributor = result.scalar_one_or_none()

    if not distributor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Distributor with id {distributor_id} not found"
        )

    return distributor


@router.post("", response_model=DistributorResponse, status_code=status.HTTP_201_CREATED)
async def create_distributor(
    distributor_data: DistributorCreate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db)
):
    """Create a new distributor."""
    # Check if INN already exists
    result = await db.execute(select(Distributor).filter(Distributor.inn == distributor_data.inn))
    existing_distributor = result.scalar_one_or_none()

    if existing_distributor:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Distributor with INN {distributor_data.inn} already exists"
        )

    new_distributor = Distributor(
        name=distributor_data.name,
        inn=distributor_data.inn,
        contact_person=distributor_data.contact_person,
        email=distributor_data.email,
        phone=distributor_data.phone,
        bank_details=distributor_data.bank_details,
        status=distributor_data.status
    )

    db.add(new_distributor)
    await db.commit()
    await db.refresh(new_distributor)

    return new_distributor


@router.put("/{distributor_id}", response_model=DistributorResponse)
async def update_distributor(
    distributor_id: int,
    distributor_data: DistributorUpdate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db)
):
    """Update distributor."""
    result = await db.execute(select(Distributor).filter(Distributor.id == distributor_id))
    distributor = result.scalar_one_or_none()

    if not distributor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Distributor with id {distributor_id} not found"
        )

    # Update fields
    update_data = distributor_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(distributor, field, value)

    await db.commit()
    await db.refresh(distributor)

    return distributor


@router.delete("/{distributor_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_distributor(
    distributor_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db)
):
    """Delete distributor."""
    result = await db.execute(select(Distributor).filter(Distributor.id == distributor_id))
    distributor = result.scalar_one_or_none()

    if not distributor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Distributor with id {distributor_id} not found"
        )

    await db.delete(distributor)
    await db.commit()

    return None
