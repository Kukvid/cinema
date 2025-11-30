"""
Promocode service - Business logic for promocode validation and usage.

This service handles:
- Promocode validation (status, dates, usage limits, minimum order amount, category)
- Discount calculation (percentage or fixed amount)
- Usage tracking and increment
"""

from datetime import datetime, date
from decimal import Decimal
from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.promocode import Promocode
from app.models.enums import PromocodeStatus, DiscountType


class PromocodeValidationResult:
    """Result of promocode validation."""

    def __init__(
        self,
        is_valid: bool,
        discount_amount: Decimal = Decimal("0.00"),
        message: str = "",
        promocode: Optional[Promocode] = None
    ):
        self.is_valid = is_valid
        self.discount_amount = discount_amount
        self.message = message
        self.promocode = promocode

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for easier serialization."""
        return {
            "is_valid": self.is_valid,
            "discount_amount": float(self.discount_amount),
            "message": self.message,
            "promocode_id": self.promocode.id if self.promocode else None
        }


async def validate_promocode(
    db: AsyncSession,
    code: str,
    order_amount: Decimal,
    category: Optional[str] = None,
    today: Optional[date] = None
) -> PromocodeValidationResult:
    """
    Validate a promocode for use.

    Args:
        db: Database session
        code: Promocode string to validate
        order_amount: Total order amount before discount
        category: Optional category to check applicability (e.g., "TICKETS", "CONCESSIONS")
        today: Optional date for validation (defaults to current date)

    Returns:
        PromocodeValidationResult with validation status, discount amount, and message

    Validation checks:
        1. Promocode exists
        2. Status is ACTIVE
        3. Current date is within valid_from and valid_until range
        4. Usage limit not exceeded (if max_uses is set)
        5. Order amount meets minimum requirement
        6. Category matches (if applicable_category is set)
    """
    if not code or not code.strip():
        return PromocodeValidationResult(
            is_valid=False,
            message="Promocode code is not find"
        )

    # Use current date if not provided
    if today is None:
        today = datetime.utcnow().date()

    # Find promocode by code
    result = await db.execute(
        select(Promocode).filter(Promocode.code == code.strip().upper())
    )
    promocode = result.scalar_one_or_none()

    if not promocode:
        return PromocodeValidationResult(
            is_valid=False,
            message=f"Promocode '{code}' not found"
        )

    # Check if promocode is active
    if promocode.status != PromocodeStatus.ACTIVE:
        status_messages = {
            PromocodeStatus.EXPIRED: "Promocode has expired",
            PromocodeStatus.DEPLETED: "Promocode usage limit has been reached",
            PromocodeStatus.INACTIVE: "Promocode is not active"
        }
        return PromocodeValidationResult(
            is_valid=False,
            message=status_messages.get(promocode.status, "Promocode is not active"),
            promocode=promocode
        )

    # Check date validity
    if today < promocode.valid_from:
        return PromocodeValidationResult(
            is_valid=False,
            message=f"Promocode is not valid yet. Valid from {promocode.valid_from.strftime('%Y-%m-%d')}",
            promocode=promocode
        )

    if today > promocode.valid_until:
        return PromocodeValidationResult(
            is_valid=False,
            message=f"Promocode has expired. Valid until {promocode.valid_until.strftime('%Y-%m-%d')}",
            promocode=promocode
        )

    # Check usage limit (if max_uses is set)
    if promocode.max_uses is not None:
        if promocode.used_count >= promocode.max_uses:
            return PromocodeValidationResult(
                is_valid=False,
                message="Promocode usage limit has been reached",
                promocode=promocode
            )

    # Check minimum order amount
    min_amount = promocode.min_order_amount or Decimal("0.00")
    if order_amount < min_amount:
        return PromocodeValidationResult(
            is_valid=False,
            message=f"Order amount must be at least {min_amount} to use this promocode (current: {order_amount})",
            promocode=promocode
        )

    # Check category applicability (if applicable_category is set)
    if promocode.applicable_category:
        if not category:
            return PromocodeValidationResult(
                is_valid=False,
                message="Category information is required for this promocode",
                promocode=promocode
            )

        # Case-insensitive category comparison
        if promocode.applicable_category.upper() != category.upper():
            return PromocodeValidationResult(
                is_valid=False,
                message=f"Promocode is only applicable to {promocode.applicable_category} orders",
                promocode=promocode
            )

    # Calculate discount
    discount_amount = calculate_discount(promocode, order_amount)

    return PromocodeValidationResult(
        is_valid=True,
        discount_amount=discount_amount,
        message="Promocode is valid",
        promocode=promocode
    )


def calculate_discount(promocode: Promocode, order_amount: Decimal) -> Decimal:
    """
    Calculate the discount amount based on promocode type.

    Args:
        promocode: Promocode object
        order_amount: Total order amount before discount

    Returns:
        Decimal: Calculated discount amount (never exceeds order_amount)

    Discount types:
        - PERCENTAGE: Discount is a percentage of order amount (e.g., 10% off)
        - FIXED_AMOUNT: Discount is a fixed amount (e.g., $5 off)
    """
    if order_amount <= 0:
        return Decimal("0.00")

    discount_value = promocode.discount_value or Decimal("0.00")

    if promocode.discount_type == DiscountType.PERCENTAGE:
        # Calculate percentage discount
        # Ensure percentage is between 0 and 100
        percentage = min(max(discount_value, Decimal("0.00")), Decimal("100.00"))
        discount_amount = (order_amount * percentage) / Decimal("100.00")
    else:  # DiscountType.FIXED_AMOUNT
        # Fixed amount discount, but not more than order amount
        discount_amount = min(discount_value, order_amount)

    # Round to 2 decimal places
    discount_amount = discount_amount.quantize(Decimal("0.01"))

    # Ensure discount doesn't exceed order amount
    return min(discount_amount, order_amount)


async def increment_usage(db: AsyncSession, promocode: Promocode) -> None:
    """
    Increment the usage count of a promocode.

    This should be called after a successful order is placed.
    Also updates status to DEPLETED if max_uses is reached.

    Args:
        db: Database session
        promocode: Promocode object to increment

    Note:
        - Increments used_count by 1
        - If max_uses is set and reached, status is changed to DEPLETED
        - Changes are not committed - caller must commit the transaction
    """
    if not promocode:
        return

    # Increment usage count
    promocode.used_count += 1

    # Check if usage limit is reached
    if promocode.max_uses is not None:
        if promocode.used_count >= promocode.max_uses:
            # Mark as depleted
            promocode.status = PromocodeStatus.DEPLETED


async def check_and_update_expired_promocodes(db: AsyncSession, today: Optional[date] = None) -> int:
    """
    Check for expired promocodes and update their status.

    This is a maintenance function that should be run periodically (e.g., daily cron job).

    Args:
        db: Database session
        today: Optional date for checking expiration (defaults to current date)

    Returns:
        int: Number of promocodes that were updated to EXPIRED status
    """
    if today is None:
        today = datetime.utcnow().date()

    # Find all active promocodes that have expired
    result = await db.execute(
        select(Promocode).filter(
            Promocode.status == PromocodeStatus.ACTIVE,
            Promocode.valid_until < today
        )
    )
    expired_promocodes = result.scalars().all()

    # Update their status
    count = 0
    for promocode in expired_promocodes:
        promocode.status = PromocodeStatus.EXPIRED
        count += 1

    if count > 0:
        await db.commit()

    return count


async def get_promocode_by_code(db: AsyncSession, code: str) -> Optional[Promocode]:
    """
    Get a promocode by its code.

    Args:
        db: Database session
        code: Promocode string

    Returns:
        Promocode object if found, None otherwise
    """
    if not code or not code.strip():
        return None

    result = await db.execute(
        select(Promocode).filter(Promocode.code == code.strip().upper())
    )
    return result.scalar_one_or_none()
