"""
Promocode service - Бизнес-логика для валидации и использования промокодов.

Этот сервис обрабатывает:
- Валидацию промокодов (статус, даты, лимиты использования, минимальная сумма заказа, категория)
- Расчёт скидки (процент или фиксированная сумма)
- Отслеживание и инкремент использования
"""

from datetime import datetime, date
from decimal import Decimal
from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.promocode import Promocode
from app.models.enums import PromocodeStatus, DiscountType

class PromocodeValidationResult:
    """Результат валидации промокода."""

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
        """Преобразование в словарь для упрощённой сериализации."""
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
    if not code or not code.strip():
        return PromocodeValidationResult(
            is_valid=False,
            message="Промокод не найден"
        )

    # Использовать текущую дату, если не указана
    if today is None:
        today = datetime.now(pytz.timezone('Europe/Moscow')).date()

    # Найти промокод по коду
    result = await db.execute(
        select(Promocode).filter(Promocode.code == code.strip().upper())
    )
    promocode = result.scalar_one_or_none()

    if not promocode:
        return PromocodeValidationResult(
            is_valid=False,
            message=f"Промокод '{code}' не найден"
        )

    # Проверить, активен ли промокод
    if promocode.status != PromocodeStatus.ACTIVE:
        status_messages = {
            PromocodeStatus.EXPIRED: "Срок действия промокода истёк",
            PromocodeStatus.DEPLETED: "Достигнут лимит использования промокода",
            PromocodeStatus.INACTIVE: "Промокод неактивен"
        }
        return PromocodeValidationResult(
            is_valid=False,
            message=status_messages.get(promocode.status, "Промокод неактивен"),
            promocode=promocode
        )

    # Проверить действительность по датам
    if today < promocode.valid_from:
        return PromocodeValidationResult(
            is_valid=False,
            message=f"Промокод ещё не действует. Действителен с {promocode.valid_from.strftime('%d.%m.%Y')}",
            promocode=promocode
        )

    if today > promocode.valid_until:
        return PromocodeValidationResult(
            is_valid=False,
            message=f"Срок действия промокода истёк. Действителен до {promocode.valid_until.strftime('%d.%m.%Y')}",
            promocode=promocode
        )

    # Проверить лимит использования (если max_uses установлен)
    if promocode.max_uses is not None:
        if promocode.used_count >= promocode.max_uses:
            return PromocodeValidationResult(
                is_valid=False,
                message="Достигнут лимит использования промокода",
                promocode=promocode
            )

    # Проверить минимальную сумму заказа
    min_amount = promocode.min_order_amount or Decimal("0.00")
    if order_amount < min_amount:
        return PromocodeValidationResult(
            is_valid=False,
            message=f"Сумма заказа должна быть не менее {min_amount} ₽ для использования этого промокода (текущая: {order_amount} ₽)",
            promocode=promocode
        )

    # Проверить применимость категории (если applicable_category установлена)
    if promocode.applicable_category:
        if not category:
            return PromocodeValidationResult(
                is_valid=False,
                message="Для этого промокода требуется информация о категории",
                promocode=promocode
            )

        # Сравнение категорий без учёта регистра с гибким совпадением
        promocode_category = promocode.applicable_category.upper()
        request_category = category.upper()

        # Разрешить промокодам для "ORDER" работать с "TICKETS", "CONCESSIONS" или "ORDER"
        if promocode_category == "ORDER":
            # Промокод для всего заказа работает для любого товара
            if request_category not in ["ORDER", "TICKETS", "CONCESSIONS"]:
                return PromocodeValidationResult(
                    is_valid=False,
                    message=f"Промокод применим к заказу, но был запрошен для {category}",
                    promocode=promocode
                )
        elif promocode_category == "TICKETS":
            # Промокод для билетов работает только для билетов или всего заказа
            if request_category not in ["TICKETS", "ORDER"]:
                return PromocodeValidationResult(
                    is_valid=False,
                    message=f"Промокод применим только для заказов категории {promocode.applicable_category}",
                    promocode=promocode
                )
        elif promocode_category == "CONCESSIONS":
            # Промокод для кинобара работает только для кинобара или всего заказа
            if request_category not in ["CONCESSIONS", "ORDER"]:
                return PromocodeValidationResult(
                    is_valid=False,
                    message=f"Промокод применим только для заказов категории {promocode.applicable_category}",
                    promocode=promocode
                )
        else:
            # Для других категорий проверить точное совпадение
            if promocode_category != request_category:
                return PromocodeValidationResult(
                    is_valid=False,
                    message=f"Промокод применим только для заказов категории {promocode.applicable_category}",
                    promocode=promocode
                )

    # Рассчитать скидку
    discount_amount = calculate_discount(promocode, order_amount)

    return PromocodeValidationResult(
        is_valid=True,
        discount_amount=discount_amount,
        message="Промокод действителен",
        promocode=promocode
    )


def calculate_discount(promocode: Promocode, order_amount: Decimal) -> Decimal:
    if order_amount <= 0:
        return Decimal("0.00")

    discount_value = promocode.discount_value or Decimal("0.00")

    if promocode.discount_type == DiscountType.PERCENTAGE:
        # Рассчитать процентную скидку
        # Убедиться, что процент между 0 и 100
        percentage = min(max(discount_value, Decimal("0.00")), Decimal("100.00"))
        discount_amount = (order_amount * percentage) / Decimal("100.00")
    else:  # DiscountType.FIXED_AMOUNT
        # Фиксированная сумма скидки, но не больше суммы заказа
        discount_amount = min(discount_value, order_amount)

    # Округлить до 2 знаков после запятой
    discount_amount = discount_amount.quantize(Decimal("0.01"))

    # Убедиться, что скидка не превышает сумму заказа
    return min(discount_amount, order_amount)


async def increment_usage(db: AsyncSession, promocode: Promocode) -> None:
    if not promocode:
        return

    # Увеличить счётчик использования
    promocode.used_count += 1

    # Проверить, достигнут ли лимит использования
    if promocode.max_uses is not None:
        if promocode.used_count >= promocode.max_uses:
            # Отметить как исчерпанный
            promocode.status = PromocodeStatus.DEPLETED


async def check_and_update_expired_promocodes(db: AsyncSession, today: Optional[date] = None) -> int:
    if today is None:
        today =datetime.now(pytz.timezone('Europe/Moscow')).date()

    # Найти все активные промокоды, срок которых истёк
    result = await db.execute(
        select(Promocode).filter(
            Promocode.status == PromocodeStatus.ACTIVE,
            Promocode.valid_until < today
        )
    )
    expired_promocodes = result.scalars().all()

    # Обновить их статус
    count = 0
    for promocode in expired_promocodes:
        promocode.status = PromocodeStatus.EXPIRED
        count += 1

    if count > 0:
        await db.commit()

    return count


async def get_promocode_by_code(db: AsyncSession, code: str) -> Optional[Promocode]:
    if not code or not code.strip():
        return None

    result = await db.execute(
        select(Promocode).filter(Promocode.code == code.strip().upper())
    )
    return result.scalar_one_or_none()
