from typing import List, Annotated
from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.rental_contract import RentalContract
from app.models.payment_history import PaymentHistory
from app.models.film import Film
from app.models.distributor import Distributor
from app.models.cinema import Cinema
from app.models.user import User
from app.models.enums import ContractStatus
from app.schemas.contract import RentalContractCreate, RentalContractUpdate, RentalContractResponse
from app.routers.auth import get_current_active_user

router = APIRouter()


@router.get("", response_model=List[RentalContractResponse])
async def get_contracts(
    cinema_id: int | None = Query(None, description="Filter by cinema ID"),
    distributor_id: int | None = Query(None, description="Filter by distributor ID"),
    film_id: int | None = Query(None, description="Filter by film ID"),
    status_filter: ContractStatus | None = Query(None, alias="status", description="Filter by status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    """Get list of rental contracts with optional filters."""
    query = select(RentalContract)

    if cinema_id:
        query = query.filter(RentalContract.cinema_id == cinema_id)

    if distributor_id:
        query = query.filter(RentalContract.distributor_id == distributor_id)

    if film_id:
        query = query.filter(RentalContract.film_id == film_id)

    if status_filter:
        query = query.filter(RentalContract.status == status_filter)

    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    contracts = result.scalars().all()

    return contracts


@router.get("/{contract_id}", response_model=RentalContractResponse)
async def get_contract(
    contract_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get rental contract by ID."""
    result = await db.execute(select(RentalContract).filter(RentalContract.id == contract_id))
    contract = result.scalar_one_or_none()

    if not contract:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Rental contract with id {contract_id} not found"
        )

    return contract


@router.post("", response_model=RentalContractResponse, status_code=status.HTTP_201_CREATED)
async def create_contract(
    contract_data: RentalContractCreate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db)
):
    """Create a new rental contract with validation."""
    # Verify film exists
    result = await db.execute(select(Film).filter(Film.id == contract_data.film_id))
    film = result.scalar_one_or_none()

    if not film:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Film with id {contract_data.film_id} not found"
        )

    # Verify distributor exists
    result = await db.execute(select(Distributor).filter(Distributor.id == contract_data.distributor_id))
    distributor = result.scalar_one_or_none()

    if not distributor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Distributor with id {contract_data.distributor_id} not found"
        )

    # Verify cinema exists
    result = await db.execute(select(Cinema).filter(Cinema.id == contract_data.cinema_id))
    cinema = result.scalar_one_or_none()

    if not cinema:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cinema with id {contract_data.cinema_id} not found"
        )

    # Check if contract number already exists
    result = await db.execute(
        select(RentalContract).filter(RentalContract.contract_number == contract_data.contract_number)
    )
    existing_contract = result.scalar_one_or_none()

    if existing_contract:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Contract number {contract_data.contract_number} already exists"
        )

    # Validate dates
    if contract_data.rental_end_date <= contract_data.rental_start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Rental end date must be after start date"
        )

    if contract_data.contract_date > contract_data.rental_start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Contract date cannot be after rental start date"
        )

    new_contract = RentalContract(
        film_id=contract_data.film_id,
        distributor_id=contract_data.distributor_id,
        cinema_id=contract_data.cinema_id,
        contract_number=contract_data.contract_number,
        contract_date=contract_data.contract_date,
        rental_start_date=contract_data.rental_start_date,
        rental_end_date=contract_data.rental_end_date,
        min_screening_period_days=contract_data.min_screening_period_days,
        min_sessions_per_day=contract_data.min_sessions_per_day,
        distributor_percentage_week1=contract_data.distributor_percentage_week1,
        distributor_percentage_week2=contract_data.distributor_percentage_week2,
        distributor_percentage_week3=contract_data.distributor_percentage_week3,
        distributor_percentage_after=contract_data.distributor_percentage_after,
        guaranteed_minimum_amount=contract_data.guaranteed_minimum_amount,
        cinema_operational_costs=contract_data.cinema_operational_costs,
        status=contract_data.status,
        early_termination_terms=contract_data.early_termination_terms
    )

    db.add(new_contract)
    await db.commit()
    await db.refresh(new_contract)

    return new_contract


@router.put("/{contract_id}", response_model=RentalContractResponse)
async def update_contract(
    contract_id: int,
    contract_data: RentalContractUpdate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db)
):
    """Update rental contract (limited fields)."""
    result = await db.execute(select(RentalContract).filter(RentalContract.id == contract_id))
    contract = result.scalar_one_or_none()

    if not contract:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Rental contract with id {contract_id} not found"
        )

    # Update fields
    update_data = contract_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(contract, field, value)

    await db.commit()
    await db.refresh(contract)

    return contract


@router.delete("/{contract_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_contract(
    contract_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db)
):
    """Delete rental contract."""
    result = await db.execute(select(RentalContract).filter(RentalContract.id == contract_id))
    contract = result.scalar_one_or_none()

    if not contract:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Rental contract with id {contract_id} not found"
        )

    await db.delete(contract)
    await db.commit()

    return None


@router.get("/{contract_id}/payments", response_model=List[dict])
async def get_contract_payments(
    contract_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db)
):
    """Get payment history for a rental contract."""
    # Verify contract exists
    result = await db.execute(select(RentalContract).filter(RentalContract.id == contract_id))
    contract = result.scalar_one_or_none()

    if not contract:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Rental contract with id {contract_id} not found"
        )

    # Get payment history
    result = await db.execute(
        select(PaymentHistory)
        .filter(PaymentHistory.rental_contract_id == contract_id)
        .order_by(PaymentHistory.payment_date.desc())
    )
    payments = result.scalars().all()

    return [
        {
            "id": payment.id,
            "week_number": payment.week_number,
            "period_start_date": payment.period_start_date,
            "period_end_date": payment.period_end_date,
            "gross_revenue": float(payment.gross_revenue),
            "cinema_costs": float(payment.cinema_costs),
            "net_revenue": float(payment.net_revenue),
            "distributor_percentage": float(payment.distributor_percentage),
            "distributor_amount": float(payment.distributor_amount),
            "cinema_amount": float(payment.cinema_amount),
            "payment_date": payment.payment_date,
            "payment_status": payment.payment_status.value if payment.payment_status else None
        }
        for payment in payments
    ]
