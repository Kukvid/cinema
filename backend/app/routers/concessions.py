from typing import List, Annotated
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from decimal import Decimal

from app.database import get_db
from app.config import get_settings
from app.models.concession_item import ConcessionItem
from app.models.concession_preorder import ConcessionPreorder
from app.models.order import Order
from app.models.promocode import Promocode
from app.models.ticket import Ticket
from app.models.user import User
from app.models.enums import ConcessionItemStatus, PreorderStatus, DiscountType, UserRoles
from app.schemas.concession import (
    ConcessionItemCreate, ConcessionItemUpdate, ConcessionItemResponse,
    ConcessionPreorderCreate, ConcessionPreorderResponse
)
from app.routers.auth import get_current_active_user
import secrets

router = APIRouter()


@router.get("", response_model=List[ConcessionItemResponse])
async def get_concession_items(
    current_user: Annotated[User, Depends(get_current_active_user)],
    cinema_id: int | None = Query(None, description="Filter by cinema ID"),
    status_filter: ConcessionItemStatus | None = Query(None, alias="status", description="Filter by status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    """Get list of concession items."""
    query = select(ConcessionItem).options(selectinload(ConcessionItem.category))

    if cinema_id:
        query = query.filter(ConcessionItem.cinema_id == cinema_id)

    if status_filter:
        query = query.filter(ConcessionItem.status == status_filter)

    if current_user.role and current_user.role.name in [UserRoles.staff, UserRoles.admin, UserRoles.staff]:
        query = query.filter(ConcessionItem.cinema_id == current_user.cinema_id)

    query = query.order_by(ConcessionItem.name.asc()).offset(skip).limit(limit)
    result = await db.execute(query)
    items = result.scalars().all()

    return items


@router.get("/public", response_model=List[ConcessionItemResponse])
async def get_public_concession_items(
    cinema_id: int = Query(..., description="Filter by cinema ID"),
    status_filter: ConcessionItemStatus | None = Query(None, alias="status", description="Filter by status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    """Get list of concession items without authentication (for public viewing)."""
    query = select(ConcessionItem).options(selectinload(ConcessionItem.category))

    # Filter by cinema_id (required for public endpoint)
    query = query.filter(ConcessionItem.cinema_id == cinema_id)

    # Only show available items for public by default
    # If status_filter is provided, use that instead
    if status_filter:
        query = query.filter(ConcessionItem.status == status_filter)
    else:
        # Default to showing only available items for public
        query = query.filter(ConcessionItem.status == ConcessionItemStatus.AVAILABLE)

    query = query.order_by(ConcessionItem.name.asc()).offset(skip).limit(limit)
    result = await db.execute(query)
    items = result.scalars().all()

    return items


@router.get("/{item_id}", response_model=ConcessionItemResponse)
async def get_concession_item(
    item_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get concession item by ID."""
    result = await db.execute(
        select(ConcessionItem)
        .options(selectinload(ConcessionItem.category))
        .filter(ConcessionItem.id == item_id)
    )
    item = result.scalar_one_or_none()

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Concession item with id {item_id} not found"
        )

    return item


@router.post("", response_model=ConcessionItemResponse, status_code=status.HTTP_201_CREATED)
async def create_concession_item(
    item_data: ConcessionItemCreate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db)
):
    """Create a new concession item."""
    new_item = ConcessionItem(
        cinema_id=item_data.cinema_id,
        category_id=item_data.category_id,
        name=item_data.name,
        description=item_data.description,
        price=item_data.price,
        portion_size=item_data.portion_size,
        calories=item_data.calories,
        stock_quantity=item_data.stock_quantity,
        status=item_data.status,
        image_url=item_data.image_url
    )

    db.add(new_item)
    await db.commit()
    await db.refresh(new_item)

    # Load the item with the category using a query to ensure relationships are accessible
    result = await db.execute(
        select(ConcessionItem)
        .options(selectinload(ConcessionItem.category))
        .filter(ConcessionItem.id == new_item.id)
    )
    item = result.scalar_one_or_none()

    return item


@router.put("/{item_id}", response_model=ConcessionItemResponse)
async def update_concession_item(
    item_id: int,
    item_data: ConcessionItemUpdate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db)
):
    """Update concession item."""
    result = await db.execute(select(ConcessionItem).filter(ConcessionItem.id == item_id))
    item = result.scalar_one_or_none()

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Concession item with id {item_id} not found"
        )

    # Update fields
    update_data = item_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)

    await db.commit()
    await db.refresh(item)

    # Load the updated item with the category using a query to ensure relationships are accessible
    result = await db.execute(
        select(ConcessionItem)
        .options(selectinload(ConcessionItem.category))
        .filter(ConcessionItem.id == item_id)
    )
    updated_item = result.scalar_one_or_none()

    return updated_item


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_concession_item(
    item_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db)
):
    """Delete concession item."""
    result = await db.execute(select(ConcessionItem).filter(ConcessionItem.id == item_id))
    item = result.scalar_one_or_none()

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Concession item with id {item_id} not found"
        )

    await db.delete(item)
    await db.commit()

    return None


@router.post("/preorder", response_model=ConcessionPreorderResponse, status_code=status.HTTP_201_CREATED)
async def create_preorder(
    preorder_data: ConcessionPreorderCreate,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db)
):
    """Create a concession preorder."""
    # Verify order exists and belongs to user
    result = await db.execute(select(Order).filter(Order.id == preorder_data.order_id))
    order = result.scalar_one_or_none()

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order with id {preorder_data.order_id} not found"
        )

    if order.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only create preorders for your own orders"
        )

    # Verify concession item exists and is available
    result = await db.execute(
        select(ConcessionItem).filter(ConcessionItem.id == preorder_data.concession_item_id)
    )
    item = result.scalar_one_or_none()

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Concession item with id {preorder_data.concession_item_id} not found"
        )

    if item.status != ConcessionItemStatus.AVAILABLE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Concession item is not available"
        )

    if item.stock_quantity < preorder_data.quantity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient stock. Available: {item.stock_quantity}"
        )

    # Calculate total price
    total_price = preorder_data.unit_price * preorder_data.quantity

    # Generate pickup code
    # Check if there are already preorders for this order - use the same code if exists
    existing_preorder_result = await db.execute(
        select(ConcessionPreorder).filter(ConcessionPreorder.order_id == preorder_data.order_id)
    )
    existing_preorder = existing_preorder_result.first()

    if existing_preorder:
        # Use the same pickup code as other preorders in the same order
        pickup_code = existing_preorder[0].pickup_code
    else:
        # Generate new pickup code for this order
        pickup_code = f"PKP-{secrets.token_hex(3).upper()}"

    # Create preorder
    new_preorder = ConcessionPreorder(
        order_id=preorder_data.order_id,
        concession_item_id=preorder_data.concession_item_id,
        quantity=preorder_data.quantity,
        unit_price=preorder_data.unit_price,
        total_price=total_price,
        pickup_code=pickup_code,
        status=PreorderStatus.PENDING
    )

    # Update stock
    item.stock_quantity -= preorder_data.quantity

    db.add(new_preorder)

    # Update order amounts to include the new concession item
    order_result = await db.execute(select(Order).filter(Order.id == preorder_data.order_id))
    order = order_result.scalar_one_or_none()

    if order:
        # Calculate the total concession amount for this order
        concession_total_result = await db.execute(
            select(func.sum(ConcessionPreorder.total_price))
            .filter(ConcessionPreorder.order_id == preorder_data.order_id)
        )
        concession_total_amount = concession_total_result.scalar() or Decimal("0.00")

        # Calculate total with tickets + concessions
        total_with_concessions = order.total_amount + concession_total_amount

        # Apply discounts to the total amount (the original discount was applied to the initial total)
        discount_proportion = Decimal("0.00")
        if order.total_amount > 0:
            discount_proportion = order.discount_amount / order.total_amount
        else:
            discount_proportion = Decimal("0.00")

        # Calculate how much discount to apply to the new total amount
        new_discount_amount = total_with_concessions * discount_proportion
        new_final_amount = total_with_concessions - new_discount_amount

        # Update order amounts
        order.total_amount = total_with_concessions
        order.final_amount = new_final_amount

    await db.commit()
    await db.refresh(new_preorder)

    return ConcessionPreorderResponse(
        id=new_preorder.id,
        order_id=new_preorder.order_id,
        concession_item_id=new_preorder.concession_item_id,
        quantity=new_preorder.quantity,
        unit_price=new_preorder.unit_price,
        total_price=new_preorder.total_price,
        pickup_code=new_preorder.pickup_code,
        status=new_preorder.status.value
    )


@router.post("/preorder-batch", status_code=status.HTTP_201_CREATED)
async def create_preorder_batch(
    preorders_data: List[ConcessionPreorderCreate],
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db)
):
    """Create multiple concession preorders for the same order with shared pickup code."""
    if not preorders_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one preorder item is required"
        )

    # Verify all items belong to the same order and user
    order_id = preorders_data[0].order_id
    result = await db.execute(select(Order).filter(Order.id == order_id))
    order = result.scalar_one_or_none()

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order with id {order_id} not found"
        )

    if order.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only create preorders for your own orders"
        )

    # Check all items before creating any preorders
    items_and_quantities = []
    for preorder_data in preorders_data:
        if preorder_data.order_id != order_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="All preorders must belong to the same order"
            )

        result = await db.execute(
            select(ConcessionItem).filter(ConcessionItem.id == preorder_data.concession_item_id)
        )
        item = result.scalar_one_or_none()

        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Concession item with id {preorder_data.concession_item_id} not found"
            )

        if item.status != ConcessionItemStatus.AVAILABLE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Concession item {preorder_data.concession_item_id} is not available"
            )

        if item.stock_quantity < preorder_data.quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient stock for item {preorder_data.concession_item_id}. Available: {item.stock_quantity}"
            )

        items_and_quantities.append((item, preorder_data))

    # Generate a single pickup code for all items in this order
    pickup_code = f"PKP-{secrets.token_hex(3).upper()}"

    # Now create all preorders with the same pickup code
    created_preorders = []
    for item, preorder_data in items_and_quantities:
        total_price = preorder_data.unit_price * preorder_data.quantity

        new_preorder = ConcessionPreorder(
            order_id=preorder_data.order_id,
            concession_item_id=preorder_data.concession_item_id,
            quantity=preorder_data.quantity,
            unit_price=preorder_data.unit_price,
            total_price=total_price,
            pickup_code=pickup_code,
            status=PreorderStatus.PENDING
        )

        # Update stock
        item.stock_quantity -= preorder_data.quantity

        db.add(new_preorder)
        created_preorders.append(new_preorder)

    # Get the order to update its amounts
    order_result = await db.execute(select(Order).filter(Order.id == order_id))
    order = order_result.scalar_one_or_none()

    if order:
        # Calculate the total concession amount for this order
        concession_total_result = await db.execute(
            select(func.sum(ConcessionPreorder.total_price))
            .filter(ConcessionPreorder.order_id == order_id)
        )
        concession_total_amount = concession_total_result.scalar() or Decimal("0.00")

        # Calculate original ticket total to reconstruct the full calculation
        ticket_total_result = await db.execute(
            select(func.sum(Ticket.price))
            .filter(Ticket.order_id == order_id)
        )
        ticket_total_amount = ticket_total_result.scalar() or Decimal("0.00")

        # Calculate base total (tickets + concessions) before any discounts
        base_total = ticket_total_amount + concession_total_amount

        # Calculate original discount proportions for proper recalculation
        # Split the original discount between promocode and bonus portions if both were used
        original_promo_discount = Decimal("0.00")
        original_bonus_deduction = Decimal("0.00")

        # Get the promocode for this order separately to ensure it's properly loaded
        if order.promocode_id:
            promocode_result = await db.execute(
                select(Promocode).filter(Promocode.id == order.promocode_id)
            )
            promocode = promocode_result.scalar_one_or_none()

            if promocode:
                # Get original promocode discount value
                original_promo_discount = promocode.discount_value if promocode else Decimal("0.00")

                # If promocode is percentage-based, calculate based on original ticket total
                if promocode.discount_type == DiscountType.PERCENTAGE:
                    original_promo_discount = (ticket_total_amount * promocode.discount_value / Decimal("100")).quantize(Decimal("0.01"))
                else:
                    # FIXED_AMOUNT promocode - use fixed value but cap at total amount
                    original_promo_discount = min(promocode.discount_value, ticket_total_amount)
        else:
            promocode = None

        # Calculate original bonus deduction from total discount minus promocode discount
        original_bonus_deduction = max(Decimal("0.00"), order.discount_amount - original_promo_discount)

        # For the new total (with concession items), we'll apply the same promotion logic
        # The promocode discount should be recalculated based on the new total if it's percentage-based
        new_promo_discount = Decimal("0.00")
        if promocode:
            if promocode.discount_type == DiscountType.PERCENTAGE:
                # For percentage promocodes, apply the same percentage to the new total
                new_promo_discount = (base_total * promocode.discount_value / Decimal("100")).quantize(Decimal("0.01"))
            else:
                # For fixed amount promocodes, keep the same fixed amount but make sure it doesn't exceed total
                new_promo_discount = min(promocode.discount_value, base_total)

        # Calculate new bonus deduction based on remaining amount after promo discount
        settings = get_settings()

        # Apply bonus deduction rules: max percentage of amount after promo discount
        max_bonus_for_new_total = (base_total - new_promo_discount) * Decimal(settings.BONUS_MAX_PERCENTAGE) / Decimal("100")
        new_bonus_deduction = min(original_bonus_deduction, max_bonus_for_new_total)

        # Ensure final amount doesn't go below minimum allowed payment amount
        potential_final_amount = base_total - new_promo_discount - new_bonus_deduction
        if potential_final_amount < Decimal(settings.BONUS_MIN_PAYMENT_AMOUNT):
            # Adjust bonus deduction to ensure minimum payment is met
            new_bonus_deduction = max(Decimal("0.00"), base_total - new_promo_discount - Decimal(settings.BONUS_MIN_PAYMENT_AMOUNT))

        # Final calculation following frontend logic: total - promo_discount - bonus_deduction
        new_final_amount = base_total - new_promo_discount - new_bonus_deduction

        # Update order amounts to reflect new totals
        order.total_amount = base_total
        order.discount_amount = new_promo_discount + new_bonus_deduction  # Combined discount amount
        order.final_amount = new_final_amount

    await db.commit()

    # Refresh all created preorders
    for preorder in created_preorders:
        await db.refresh(preorder)

    # Return the first preorder response (they all have the same pickup code)
    first_preorder = created_preorders[0]
    return ConcessionPreorderResponse(
        id=first_preorder.id,
        order_id=first_preorder.order_id,
        concession_item_id=first_preorder.concession_item_id,
        quantity=first_preorder.quantity,
        unit_price=first_preorder.unit_price,
        total_price=first_preorder.total_price,
        pickup_code=first_preorder.pickup_code,
        status=first_preorder.status.value
    )


@router.post("/concession_preorders/{preorder_id}/complete")
async def mark_concession_item_as_completed(
    preorder_id: int,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db)
):
    """Mark a concession preorder as completed - for concession staff use."""
    # Verify user has staff rights (admin or concession staff role)
    if current_user.role.name not in [UserRoles.admin, UserRoles.super_admin, UserRoles.staff]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and staff can mark concession items as completed"
        )

    # Get the preorder
    result = await db.execute(
        select(ConcessionPreorder).filter(ConcessionPreorder.id == preorder_id)
    )
    preorder = result.scalar_one_or_none()

    if not preorder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Concession preorder not found"
        )

    # Update the status to completed
    preorder.status = PreorderStatus.COMPLETED
    await db.commit()
    await db.refresh(preorder)

    return preorder
