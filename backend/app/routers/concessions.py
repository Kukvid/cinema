from typing import List, Annotated
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.concession_item import ConcessionItem
from app.models.concession_preorder import ConcessionPreorder
from app.models.order import Order
from app.models.user import User
from app.models.enums import ConcessionItemStatus, PreorderStatus
from app.schemas.concession import (
    ConcessionItemCreate, ConcessionItemUpdate, ConcessionItemResponse,
    ConcessionPreorderCreate, ConcessionPreorderResponse
)
from app.routers.auth import get_current_active_user
import secrets

router = APIRouter()


@router.get("", response_model=List[ConcessionItemResponse])
async def get_concession_items(
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

    query = query.offset(skip).limit(limit)
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

    return new_item


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

    return item


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
    total_price = preorder_data.item_price * preorder_data.quantity

    # Generate pickup code
    pickup_code = f"PKP-{secrets.token_hex(3).upper()}"

    # Create preorder
    new_preorder = ConcessionPreorder(
        order_id=preorder_data.order_id,
        concession_item_id=preorder_data.concession_item_id,
        quantity=preorder_data.quantity,
        item_price=preorder_data.item_price,
        total_price=total_price,
        pickup_code=pickup_code,
        status=PreorderStatus.PENDING
    )

    # Update stock
    item.stock_quantity -= preorder_data.quantity

    db.add(new_preorder)
    await db.commit()
    await db.refresh(new_preorder)

    return ConcessionPreorderResponse(
        id=new_preorder.id,
        order_id=new_preorder.order_id,
        concession_item_id=new_preorder.concession_item_id,
        quantity=new_preorder.quantity,
        item_price=new_preorder.item_price,
        total_price=new_preorder.total_price,
        pickup_code=new_preorder.pickup_code,
        status=new_preorder.status.value
    )
