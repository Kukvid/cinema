from typing import List, Annotated, Optional
from datetime import date, datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload
import logging
import pytz

from app.database import get_db
from app.models.rental_contract import RentalContract
from app.models.payment_history import PaymentHistory
from app.models.film import Film
from app.models.distributor import Distributor
from app.models.cinema import Cinema
from app.models.user import User
from app.models.enums import ContractStatus, PaymentStatus
from app.schemas.contract import RentalContractCreate, RentalContractUpdate, RentalContractResponse
from app.schemas.payment_history import PaymentHistoryResponse
from app.schemas.cinema import CinemaResponse
from app.routers.auth import get_current_active_user

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("", response_model=List[RentalContractResponse])
async def get_contracts(
    cinema_id: int | None = Query(None, description="Filter by cinema ID"),
    distributor_id: int | None = Query(None, description="Filter by distributor ID"),
    film_id: int | None = Query(None, description="Filter by film ID"),
    status_filter: ContractStatus | None = Query(None, alias="status", description="Filter by status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: Annotated[User, Depends(get_current_active_user)] = None
):
    """Get list of rental contracts with optional filters."""

    # Admin users can only see contracts related to their cinema
    query = select(RentalContract)

    if current_user.role.name == "admin":
        query = query.filter(RentalContract.cinema_id == current_user.cinema_id)
    elif cinema_id:
        # Super admin can filter by any cinema ID
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


@router.get("/cinemas", response_model=List[CinemaResponse])
async def get_available_cinemas(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db)
):
    """Get available cinemas based on user role - admin gets only their cinema, super_admin gets all."""
    if current_user.role.name == "admin":
        # Admin can only see their assigned cinema
        result = await db.execute(select(Cinema).filter(Cinema.id == current_user.cinema_id))
        cinema = result.scalar_one_or_none()
        if cinema:
            return [cinema]
        else:
            return []
    elif current_user.role.name == "super_admin":
        # Super admin can see all cinemas
        result = await db.execute(select(Cinema))
        return result.scalars().all()
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )


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
    # Verify user permissions - admin can only create contracts for their cinema
    if current_user.role.name == "admin":
        if current_user.cinema_id != contract_data.cinema_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin can only create contracts for their assigned cinema"
            )
    elif current_user.role.name not in ["super_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin and super admin users can create contracts"
        )

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

    # Check for overlapping contracts for the same distributor and film at the same cinema
    overlapping_contract_result = await db.execute(
        select(RentalContract).filter(
            and_(
                RentalContract.distributor_id == contract_data.distributor_id,
                RentalContract.film_id == contract_data.film_id,
                RentalContract.cinema_id == contract_data.cinema_id,
                RentalContract.status.in_([ContractStatus.ACTIVE]),
                RentalContract.rental_start_date <= contract_data.rental_end_date,
                RentalContract.rental_end_date >= contract_data.rental_start_date
            )
        )
    )
    overlapping_contract = overlapping_contract_result.scalar_one_or_none()
    if overlapping_contract:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="There is already an active contract for this distributor and film at this cinema during the requested period"
        )

    # Validate dates (these validations are already in the schema, but kept for extra safety)
    if contract_data.rental_end_date <= contract_data.rental_start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Rental end date must be after start date"
        )

    if contract_data.contract_date > date.today():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Contract date cannot be in the future"
        )

    if contract_data.contract_date > contract_data.rental_start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Contract date cannot be after rental start date"
        )

    if contract_data.rental_start_date < date.today():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Rental start date cannot be before today"
        )

    new_contract = RentalContract(
        film_id=contract_data.film_id,
        distributor_id=contract_data.distributor_id,
        cinema_id=contract_data.cinema_id,
        contract_number=contract_data.contract_number,
        contract_date=contract_data.contract_date,
        rental_start_date=contract_data.rental_start_date,
        rental_end_date=contract_data.rental_end_date,
        distributor_percentage=contract_data.distributor_percentage,
        status=ContractStatus.ACTIVE  # Always set to ACTIVE by default
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


@router.get("/{contract_id}/payments", response_model=List[PaymentHistoryResponse])
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

    # Get payment history with related entities loaded
    result = await db.execute(
        select(PaymentHistory)
        .options(
            selectinload(PaymentHistory.rental_contract)
            .selectinload(RentalContract.film)
        )
        .options(
            selectinload(PaymentHistory.rental_contract)
            .selectinload(RentalContract.distributor)
        )
        .options(
            selectinload(PaymentHistory.rental_contract)
            .selectinload(RentalContract.cinema)
        )
        .filter(PaymentHistory.rental_contract_id == contract_id)
        .order_by(PaymentHistory.payment_date.desc())
    )
    payments = result.scalars().all()

    return payments


@router.post("/{contract_id}/payments/{payment_id}/pay", response_model=PaymentHistoryResponse)
async def mark_payment_as_paid(
    contract_id: int,
    payment_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db)
):
    """Mark a contract payment as paid."""
    # Verify contract exists
    contract_result = await db.execute(select(RentalContract).filter(RentalContract.id == contract_id))
    contract = contract_result.scalar_one_or_none()

    if not contract:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Rental contract with id {contract_id} not found"
        )

    # Verify payment exists and belongs to this contract
    payment_result = await db.execute(
        select(PaymentHistory)
        .options(
            selectinload(PaymentHistory.rental_contract)
            .selectinload(RentalContract.film)
        )
        .options(
            selectinload(PaymentHistory.rental_contract)
            .selectinload(RentalContract.distributor)
        )
        .options(
            selectinload(PaymentHistory.rental_contract)
            .selectinload(RentalContract.cinema)
        )
        .filter(
            and_(
                PaymentHistory.id == payment_id,
                PaymentHistory.rental_contract_id == contract_id
            )
        )
    )
    payment = payment_result.scalar_one_or_none()

    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Payment with id {payment_id} not found for contract {contract_id}"
        )

    # Check if payment is already marked as paid
    if payment.payment_status == PaymentStatus.PAID:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment is already marked as paid"
        )

    # Update payment status to paid and set payment date
    payment.payment_status = PaymentStatus.PAID
    # Set the payment date to current date in Moscow timezone when marking as paid
    current_datetime_moscow = datetime.now(pytz.timezone('Europe/Moscow')).replace(tzinfo=None)
    payment.payment_date = current_datetime_moscow.date()  # This gets the date in Moscow timezone

    # Generate document number if not already set
    if not payment.payment_document_number:
        import random
        current_time = current_datetime_moscow  # Use the same Moscow datetime
        payment.payment_document_number = f"PAY_{payment.rental_contract_id}_{int(current_time.timestamp())}_{random.randint(1000, 9999)}"

    # If all payments for this contract are now paid, change contract status to PAID
    remaining_payments_result = await db.execute(
        select(PaymentHistory)
        .filter(
            and_(
                PaymentHistory.rental_contract_id == contract_id,
                PaymentHistory.payment_status != PaymentStatus.PAID
            )
        )
    )
    remaining_payments = remaining_payments_result.scalars().all()

    if not remaining_payments:
        # All payments for this contract are now paid, update contract status
        contract.status = ContractStatus.PAID

    await db.commit()
    await db.refresh(payment)

    return payment


@router.post("/{contract_id}/payments", response_model=PaymentHistoryResponse)
async def create_contract_payment(
    contract_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db)
):
    """Create a payment for a rental contract by calculating revenue and applying distributor percentage."""
    # Verify user has proper permissions
    if current_user.role.name not in ["admin", "super_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin and super admin users can create contract payments"
        )

    # Verify contract exists with related entities loaded
    contract_result = await db.execute(
        select(RentalContract)
        .options(selectinload(RentalContract.film))
        .options(selectinload(RentalContract.distributor))
        .options(selectinload(RentalContract.cinema))
        .filter(RentalContract.id == contract_id)
    )
    contract = contract_result.scalar_one_or_none()

    if not contract:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Rental contract with id {contract_id} not found"
        )

    # Verify admin permissions - admin can only create payments for their cinema's contracts
    if current_user.role.name == "admin":
        if not current_user.cinema_id or current_user.cinema_id != contract.cinema_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin can only create payments for contracts related to their cinema"
            )

    import random
    from app.models.session import Session
    from app.models.ticket import Ticket
    from app.models.order import Order
    from app.models.film import Film
    from app.models.enums import OrderStatus as OrderStatusEnum
    from sqlalchemy import and_

    # Calculate revenue from sessions and tickets for the contract period
    # Get sessions for the film during the rental period
    sessions_result = await db.execute(
        select(Session)
        .join(Film, Session.film_id == Film.id)
        .filter(
            and_(
                Film.id == contract.film_id,
                Session.start_datetime >= contract.rental_start_date,
                Session.start_datetime <= contract.rental_end_date,
                Session.cinema_id == contract.cinema_id  # Ensure sessions are for the same cinema
            )
        )
    )
    contract_sessions = sessions_result.scalars().all()

    session_ids = [session.id for session in contract_sessions]
    if not session_ids:
        logger.info(f"No sessions found for contract {contract_id} during rental period, setting revenue to 0")
        total_revenue = 0.0
    else:
        # Get tickets for these sessions that were paid during the contract period
        tickets_result = await db.execute(
            select(Ticket)
            .join(Order, Ticket.order_id == Order.id)
            .filter(
                and_(
                    Ticket.session_id.in_(session_ids),
                    Order.status == OrderStatusEnum.paid,
                    # Include all tickets for paid orders, regardless of purchase date,
                    # to capture full revenue for the contract period
                )
            )
        )
        contract_tickets = tickets_result.scalars().all()

        # Calculate total revenue from tickets
        total_revenue = sum(float(ticket.price) for ticket in contract_tickets)

        logger.info(f"Found {len(contract_tickets)} tickets for contract {contract_id}, total revenue: {total_revenue}")

    # Calculate distributor's share (percentage of total revenue)
    distributor_share = total_revenue * float(contract.distributor_percentage) / 100

    moscow_tz = pytz.timezone('Europe/Moscow')
    current_time = datetime.now(moscow_tz)

    # Create payment history record
    new_payment = PaymentHistory(
        rental_contract_id=contract.id,
        calculated_amount=distributor_share,
        calculation_date=current_time,  # This is timezone-aware datetime for calculation
        payment_status=PaymentStatus.PENDING,
        payment_date=None,  # Initially no payment date until paid
        payment_document_number=f"PAY_{contract_id}_{int(current_time.timestamp())}_{random.randint(1000, 9999)}"  # Generate document number
    )

    db.add(new_payment)
    await db.commit()
    await db.refresh(new_payment)

    # Log the calculated revenue to the log file
    log_message = f"Payment created for contract {contract_id}. Total revenue: {total_revenue}, Distributor share ({contract.distributor_percentage}%): {distributor_share}\n"

    # Write to the log file using relative path from the backend directory
    with open("../../http_requests.log", "a", encoding="utf-8") as log_file:
        log_file.write(log_message)

    return new_payment


@router.get("/payments/all", response_model=List[PaymentHistoryResponse])
async def get_all_payments(
    current_user: Annotated[User, Depends(get_current_active_user)],
    cinema_id: Optional[int] = Query(None, description="Filter by cinema ID for admin users"),
    db: AsyncSession = Depends(get_db)
):
    """Get all payments (all statuses) with optional cinema filter for admin users."""
    # Verify user has proper permissions
    if current_user.role.name not in ["admin", "super_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin and super admin users can access payments"
        )

    query = (
        select(PaymentHistory)
        .options(
            selectinload(PaymentHistory.rental_contract)
            .selectinload(RentalContract.film)
        )
        .options(
            selectinload(PaymentHistory.rental_contract)
            .selectinload(RentalContract.distributor)
        )
        .options(
            selectinload(PaymentHistory.rental_contract)
            .selectinload(RentalContract.cinema)
        )
        .join(RentalContract, PaymentHistory.rental_contract_id == RentalContract.id)
        .order_by(PaymentHistory.calculation_date.desc())
    )

    # For admin users, only show payments related to their cinema
    if current_user.role.name == "admin" and cinema_id:
        # Admin can only see payments for contracts related to their cinema
        query = query.filter(RentalContract.cinema_id == cinema_id)
    elif current_user.role.name == "admin" and not cinema_id:
        # If no cinema ID provided, use admin's assigned cinema
        if current_user.cinema_id:
            query = query.filter(RentalContract.cinema_id == current_user.cinema_id)
    # For super admin users, show all payments
    # No filter is applied for super_admin, they see all payments

    result = await db.execute(query)
    payments = result.scalars().all()

    return payments


@router.get("/payments/pending", response_model=List[PaymentHistoryResponse])
async def get_pending_payments(
    current_user: Annotated[User, Depends(get_current_active_user)],
    cinema_id: Optional[int] = Query(None, description="Filter by cinema ID for admin users"),
    db: AsyncSession = Depends(get_db)
):
    """Get all pending payments with optional cinema filter for admin users."""
    # Verify user has proper permissions
    if current_user.role.name not in ["admin", "super_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin and super admin users can access pending payments"
        )

    query = (
        select(PaymentHistory)
        .options(
            selectinload(PaymentHistory.rental_contract)
            .selectinload(RentalContract.film)
        )
        .options(
            selectinload(PaymentHistory.rental_contract)
            .selectinload(RentalContract.distributor)
        )
        .options(
            selectinload(PaymentHistory.rental_contract)
            .selectinload(RentalContract.cinema)
        )
        .join(RentalContract, PaymentHistory.rental_contract_id == RentalContract.id)
        .filter(PaymentHistory.payment_status == PaymentStatus.PENDING)
        .order_by(PaymentHistory.calculation_date.desc())
    )

    # For admin users, only show payments related to their cinema
    if current_user.role.name == "admin" and cinema_id:
        # Admin can only see payments for contracts related to their cinema
        query = query.filter(RentalContract.cinema_id == cinema_id)
    elif current_user.role.name == "admin" and not cinema_id:
        # If no cinema ID provided, use admin's assigned cinema
        if current_user.cinema_id:
            query = query.filter(RentalContract.cinema_id == current_user.cinema_id)
    # For super admin users, show all pending payments
    # No filter is applied for super_admin, they see all payments

    result = await db.execute(query)
    payments = result.scalars().all()

    return payments


@router.post("/payments/{payment_id}/pay", response_model=PaymentHistoryResponse)
async def pay_contract_payment(
    payment_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db)
):
    """Pay a specific contract payment (global payment endpoint)."""
    # Verify user has proper permissions
    if current_user.role.name not in ["admin", "super_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin and super admin users can pay contract payments"
        )

    # Get the payment with its contract and related entities
    payment_result = await db.execute(
        select(PaymentHistory)
        .options(
            selectinload(PaymentHistory.rental_contract)
            .selectinload(RentalContract.film)
        )
        .options(
            selectinload(PaymentHistory.rental_contract)
            .selectinload(RentalContract.distributor)
        )
        .options(
            selectinload(PaymentHistory.rental_contract)
            .selectinload(RentalContract.cinema)
        )
        .join(RentalContract, PaymentHistory.rental_contract_id == RentalContract.id)
        .filter(PaymentHistory.id == payment_id)
    )
    payment = payment_result.scalar_one_or_none()

    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Payment with id {payment_id} not found"
        )

    # Check if payment is already marked as paid
    if payment.payment_status == PaymentStatus.PAID:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment is already marked as paid"
        )

    # Verify admin permissions - admin can only pay for their cinema's contracts
    if current_user.role.name == "admin":
        if not current_user.cinema_id or current_user.cinema_id != payment.rental_contract.cinema_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin can only pay for contracts related to their cinema"
            )

    # Update payment status to paid and set payment date
    payment.payment_status = PaymentStatus.PAID
    current_datetime_moscow = datetime.now(pytz.timezone('Europe/Moscow')).replace(tzinfo=None)
    payment.payment_date = current_datetime_moscow.date()  # This gets the date in Moscow timezone

    # Generate document number if not already set
    if not payment.payment_document_number:
        import random
        current_time = current_datetime_moscow  # Use the same Moscow datetime
        payment.payment_document_number = f"PAY_{payment.rental_contract_id}_{int(current_time.timestamp())}_{random.randint(1000, 9999)}"

    # Check if all payments for this contract are now paid
    remaining_payments_result = await db.execute(
        select(PaymentHistory)
        .filter(
            and_(
                PaymentHistory.rental_contract_id == payment.rental_contract_id,
                PaymentHistory.payment_status != PaymentStatus.PAID
            )
        )
    )
    remaining_payments = remaining_payments_result.scalars().all()

    if not remaining_payments:
        # All payments for this contract are now paid, update contract status
        payment.rental_contract.status = ContractStatus.PAID

    await db.commit()
    await db.refresh(payment)

    return payment
