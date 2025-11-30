# Система Промокодов - Документация

## Обзор

Полноценная система управления промокодами для кинотеатра с валидацией, учетом использований и гибкими настройками скидок.

## Возможности

### ✅ Типы скидок
- **Процентная скидка** (PERCENTAGE): От 0% до 100% от суммы заказа
- **Фиксированная скидка** (FIXED_AMOUNT): Абсолютная сумма в рублях (ограничена суммой заказа)

### ✅ Валидации
1. **Статус промокода**: Только ACTIVE промокоды применяются
2. **Срок действия**: Проверка valid_from и valid_until
3. **Лимит использований**: Автоматический подсчет used_count vs max_uses
4. **Минимальная сумма заказа**: min_order_amount должна быть достигнута
5. **Категория товаров**: Опциональная фильтрация по applicable_category
6. **Регистронезависимость**: Коды автоматически приводятся к верхнему регистру

### ✅ Автоматическое управление
- Инкремент used_count при успешном заказе
- Автоматический переход в статус DEPLETED при достижении max_uses
- Защита от дублирования кодов (unique constraint)
- Проверка дат (valid_until >= valid_from)

## Backend API

### Публичные endpoints (без авторизации)

#### POST /api/v1/promocodes/validate
Валидация промокода перед применением к заказу.

**Request:**
```json
{
  "code": "WELCOME10",
  "order_amount": 1000.00,
  "category": "TICKETS"  // optional
}
```

**Response (успех):**
```json
{
  "code": "WELCOME10",
  "order_amount": 1000.00,
  "is_valid": true,
  "discount_amount": 100.00,
  "message": "Promocode is valid"
}
```

**Response (ошибка):**
```json
{
  "code": "WELCOME10",
  "order_amount": 300.00,
  "is_valid": false,
  "discount_amount": 0,
  "message": "Order amount must be at least 500.00 to use this promocode (current: 300)"
}
```

### Админские endpoints (требуют авторизации)

#### GET /api/v1/promocodes
Получить список всех промокодов.

**Query Parameters:**
- `status`: ACTIVE | EXPIRED | DEPLETED | INACTIVE
- `valid_today`: true | false - фильтр по актуальности сегодня
- `discount_type`: PERCENTAGE | FIXED_AMOUNT
- `skip`: число для пагинации (default: 0)
- `limit`: число записей (default: 100, max: 100)

**Response:**
```json
[
  {
    "id": 1,
    "code": "WELCOME10",
    "description": "Скидка 10% на первый заказ",
    "discount_type": "PERCENTAGE",
    "discount_value": 10.00,
    "valid_from": "2024-10-29",
    "valid_until": "2025-01-27",
    "max_uses": 100,
    "used_count": 15,
    "min_order_amount": 500.00,
    "applicable_category": "TICKETS",
    "status": "ACTIVE"
  }
]
```

#### GET /api/v1/promocodes/{id}
Получить промокод по ID.

#### POST /api/v1/promocodes
Создать новый промокод.

**Request:**
```json
{
  "code": "SUMMER2025",
  "description": "Летняя распродажа",
  "discount_type": "PERCENTAGE",
  "discount_value": 15.00,
  "valid_from": "2025-06-01",
  "valid_until": "2025-08-31",
  "max_uses": 500,
  "min_order_amount": 1000.00,
  "applicable_category": null,
  "status": "ACTIVE"
}
```

#### PUT /api/v1/promocodes/{id}
Обновить промокод (частичное обновление).

**Request:**
```json
{
  "status": "INACTIVE",
  "max_uses": 1000
}
```

#### DELETE /api/v1/promocodes/{id}
Удалить промокод.

## Frontend Components

### PromoCodeInput Component
Переиспользуемый компонент для ввода и применения промокода.

**Props:**
```javascript
<PromoCodeInput
  onApply={(promoData) => console.log('Applied:', promoData)}
  disabled={false}
  currentTotal={1500.00}
/>
```

**Features:**
- Валидация промокода в реальном времени
- Визуальная обратная связь (success/error)
- Автоматическое преобразование в верхний регистр
- Кнопка очистки после применения
- Индикатор загрузки

### PromocodesManage Page
Админская панель управления промокодами.

**Функции:**
- Таблица со всеми промокодами
- Фильтрация по статусу
- Создание/редактирование/удаление
- Визуальные индикаторы статуса (цветные чипы)
- Отображение статистики использования

**Маршрут:** `/admin/promocodes`

## Service Layer

### validate_promocode()
```python
async def validate_promocode(
    db: AsyncSession,
    code: str,
    order_amount: Decimal,
    category: Optional[str] = None,
    today: date = date.today()
) -> PromocodeValidationResult
```

**Проверки:**
1. Код не пустой
2. Промокод существует в БД
3. Статус = ACTIVE
4. Текущая дата в диапазоне valid_from - valid_until
5. used_count < max_uses (если max_uses установлен)
6. order_amount >= min_order_amount
7. category совпадает с applicable_category (если установлена)

### calculate_discount()
```python
def calculate_discount(
    promocode: Promocode,
    order_amount: Decimal
) -> Decimal
```

**Расчет:**
- **PERCENTAGE**: `(order_amount * discount_value) / 100`
- **FIXED_AMOUNT**: `min(discount_value, order_amount)` - никогда не превышает сумму заказа

### increment_usage()
```python
async def increment_usage(
    db: AsyncSession,
    promocode: Promocode
) -> None
```

**Логика:**
- Инкремент `used_count`
- Если `used_count >= max_uses` → статус = DEPLETED
- Commit в БД

## Граничные случаи

### ✅ Обработанные сценарии

1. **Нулевая/отрицательная сумма заказа** → Отклонение
2. **Пустой код** → Ошибка "код не найден"
3. **Несуществующий код** → Ошибка "промокод не найден"
4. **Регистр букв** → welcome10 = WELCOME10 = WeLcOmE10
5. **Фиксированная скидка > суммы заказа** → Ограничение суммой заказа
6. **Точное совпадение min_order_amount** → Применяется
7. **Очень большие суммы** → Корректный расчет
8. **Истекший промокод** → Отклонение
9. **Исчерпанный промокод (DEPLETED)** → Отклонение
10. **Неактивный промокод (INACTIVE)** → Отклонение
11. **Процентная скидка** → Округление до 2 знаков после запятой

## Статусы промокодов

| Статус | Описание | Цвет |
|--------|----------|------|
| ACTIVE | Промокод активен и доступен для использования | Зеленый |
| EXPIRED | Промокод истек (прошел valid_until) | Красный |
| DEPLETED | Достигнут лимит использований | Оранжевый |
| INACTIVE | Промокод отключен администратором | Серый |

## Примеры использования

### Пример 1: Применение промокода при бронировании

```javascript
// Frontend (SessionBooking.js)
const handleApplyPromo = async (promoData) => {
  setAppliedPromo(promoData);
  setSnackbar({
    open: true,
    message: `Промокод применен! Скидка: ${promoData.discount_amount} ₽`,
    severity: 'success'
  });
};

// При создании заказа
const bookingData = {
  session_id: sessionId,
  seat_ids: selectedSeats,
  promocode_code: appliedPromo?.code,  // Передаем код
  ...
};
```

### Пример 2: Создание промокода (админ)

```javascript
// Frontend (PromocodesManage.js)
const createPromo = async () => {
  const data = {
    code: "BIRTHDAY20",
    description: "Скидка 20% в день рождения",
    discount_type: "PERCENTAGE",
    discount_value: 20,
    valid_from: "2025-01-01",
    valid_until: "2025-12-31",
    max_uses: 500,
    min_order_amount: 300,
    applicable_category: null,
    status: "ACTIVE"
  };

  await createPromocode(data);
};
```

### Пример 3: Валидация на бэкенде

```python
# Backend (bookings.py)
from app.services.promocode_service import validate_promocode, increment_usage

# При создании заказа
if booking_data.promocode_code:
    validation = await validate_promocode(
        db=db,
        code=booking_data.promocode_code,
        order_amount=total_amount,
        category="TICKETS"
    )

    if not validation.is_valid:
        raise HTTPException(
            status_code=400,
            detail=validation.message
        )

    discount_amount = validation.discount_amount
    await increment_usage(db, validation.promocode)
```

## База данных

### Таблица: promocodes

| Поле | Тип | Описание |
|------|-----|----------|
| id | INTEGER | Primary Key |
| code | VARCHAR(50) | Уникальный код (UNIQUE, INDEXED) |
| description | TEXT | Описание промокода |
| discount_type | ENUM | PERCENTAGE или FIXED_AMOUNT |
| discount_value | DECIMAL(8,2) | Значение скидки |
| valid_from | DATE | Начало действия (INDEXED) |
| valid_until | DATE | Конец действия (INDEXED) |
| max_uses | INTEGER | Максимум использований (NULL = безлимит) |
| used_count | INTEGER | Текущее количество использований |
| min_order_amount | DECIMAL(8,2) | Минимальная сумма заказа |
| applicable_category | VARCHAR(100) | Категория товаров (NULL = все) |
| status | ENUM | ACTIVE, EXPIRED, DEPLETED, INACTIVE (INDEXED) |

### Constraints
- `check_discount_value_non_negative`: discount_value >= 0
- `check_promocode_dates_valid`: valid_until >= valid_from
- `check_used_count_non_negative`: used_count >= 0
- `check_min_order_amount_non_negative`: min_order_amount >= 0

### Indexes
- `idx_promocode_code` на `code` - для быстрого поиска
- `idx_promocode_status` на `status` - для фильтрации
- `idx_promocode_valid_from` на `valid_from` - для проверки дат
- `idx_promocode_valid_until` на `valid_until` - для проверки дат

## Тестовые промокоды

В seed.py создано 7 тестовых промокодов:

| Код | Тип | Скидка | Мин. сумма | Макс. использований | Статус |
|-----|-----|--------|------------|---------------------|--------|
| WELCOME10 | % | 10% | 500₽ | 100 | ACTIVE |
| NEWYEAR2024 | Фикс. | 500₽ | 1000₽ | 200 | ACTIVE |
| BIRTHDAY20 | % | 20% | 300₽ | 500 | ACTIVE |
| EXPIRED | % | 15% | 0₽ | 50 | EXPIRED |
| MAXUSED | Фикс. | 300₽ | 0₽ | 20 | DEPLETED |
| WEEKEND15 | % | 15% | 600₽ | 300 | ACTIVE |
| STUDENT | Фикс. | 200₽ | 400₽ | 1000 | ACTIVE |

## Файлы проекта

### Backend
- `backend/app/models/promocode.py` - Модель Promocode
- `backend/app/schemas/promocode.py` - Pydantic схемы
- `backend/app/services/promocode_service.py` - Бизнес-логика ⭐ НОВЫЙ
- `backend/app/routers/promocodes.py` - API endpoints ⭐ НОВЫЙ
- `backend/app/routers/bookings.py` - Интеграция с заказами (обновлен)
- `backend/alembic/versions/005_create_promocodes_table.py` - Миграция ⭐ НОВЫЙ

### Frontend
- `frontend/src/api/promocodes.js` - API клиент ⭐ НОВЫЙ
- `frontend/src/components/PromoCodeInput.js` - Компонент ввода ⭐ НОВЫЙ
- `frontend/src/pages/admin/PromocodesManage.js` - Админская панель ⭐ НОВЫЙ
- `frontend/src/pages/SessionBooking.js` - Интеграция в бронирование (обновлен)
- `frontend/src/App.js` - Роут добавлен
- `frontend/src/pages/admin/Dashboard.js` - Пункт меню добавлен

## Развертывание

1. Применить миграцию (если требуется):
```bash
cd backend
alembic upgrade head
```

2. Запустить seed для создания тестовых промокодов:
```bash
python seed.py
```

3. Собрать frontend:
```bash
cd frontend
npm run build
```

4. Запустить приложение:
```bash
cd backend
python main.py
```

## Безопасность

- ✅ Все админские endpoints защищены аутентификацией
- ✅ Валидация всех входных данных через Pydantic
- ✅ SQL инъекции предотвращены через SQLAlchemy ORM
- ✅ Проверка прав доступа (admin only)
- ✅ Ограничение максимального значения скидки суммой заказа
- ✅ Защита от дублирования кодов (UNIQUE constraint)
- ✅ Атомарные операции с used_count (race condition защита)

---

**Дата создания:** 2025-11-28
**Версия:** 1.0.0
**Статус:** ✅ Полностью реализовано и протестировано
