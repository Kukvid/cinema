# ПОЛНАЯ ДОКУМЕНТАЦИЯ ФАЙЛОВ ПРОЕКТА "СИСТЕМА УПРАВЛЕНИЯ СЕТЬЮ КИНОТЕАТРОВ"

## Содержание
- [Backend](#backend)
  - [Точки входа и конфигурация](#1-точки-входа-и-конфигурация)
  - [Модели базы данных](#2-модели-базы-данных)
  - [Pydantic схемы](#3-pydantic-схемы)
  - [API роутеры](#4-api-роутеры)
  - [Утилиты](#5-утилиты)
  - [Инициализация данных](#6-инициализация-данных)
- [Frontend](#frontend)
  - [Точки входа](#1-точки-входа)
  - [Контекст и состояние](#2-контекст-и-состояние)
  - [API клиенты](#3-api-клиенты)
  - [Компоненты](#4-компоненты)
  - [Публичные страницы](#5-публичные-страницы)
  - [Защищенные страницы](#6-защищенные-страницы)
  - [Страницы бронирования](#7-страницы-бронирования)
  - [Админ-панель](#8-админ-панель)

---

# BACKEND

## 1. Точки входа и конфигурация

### `backend/app/main.py`
**Назначение**: Главная точка входа FastAPI приложения

**Основные компоненты**:
- **`lifespan(app)`** - Асинхронный контекстный менеджер для управления жизненным циклом приложения
  - Выполняет инициализацию при запуске
  - Корректно завершает работу при остановке

**API Endpoints**:
- `GET /` - Корневой endpoint, возвращает информацию о системе
- `GET /health` - Health check для мониторинга статуса приложения

**Роутеры (префикс `/api/v1`)**:
- `/auth` - Аутентификация и авторизация
- `/cinemas` - Управление кинотеатрами
- `/halls` - Управление залами
- `/films` - Управление фильмами
- `/genres` - Управление жанрами
- `/sessions` - Управление сеансами
- `/bookings` - Бронирование билетов
- `/concessions` - Управление кинобаром
- `/distributors` - Управление дистрибьюторами
- `/contracts` - Управление договорами проката

**Middleware**:
- CORS для кроссдоменных запросов (настраиваемые origins из конфига)

---

### `backend/app/config.py`
**Назначение**: Централизованная конфигурация приложения через переменные окружения

**Параметры приложения**:
- `APP_NAME` - Название приложения
- `APP_VERSION` - Версия приложения
- `DEBUG` - Режим отладки

**Параметры БД**:
- `DATABASE_URL` - URL подключения к PostgreSQL
- `DB_ECHO` - Логирование SQL запросов

**Параметры безопасности**:
- `SECRET_KEY` - Секретный ключ для JWT
- `ALGORITHM` - Алгоритм шифрования JWT (default: HS256)
- `ACCESS_TOKEN_EXPIRE_MINUTES` - Время жизни access токена (30 минут)
- `REFRESH_TOKEN_EXPIRE_DAYS` - Время жизни refresh токена (7 дней)

**CORS настройки**:
- `CORS_ORIGINS` - Разрешенные источники (парсит строку или список)

**Бизнес-логика**:
- `BONUS_ACCRUAL_PERCENTAGE` - Процент начисления бонусов (10%)
- `BONUS_POINTS_PER_RUBLE` - Бонусных баллов за рубль (1)
- `SEAT_RESERVATION_TIMEOUT_MINUTES` - Таймаут резервации места (5 минут)

**QR коды**:
- `QR_CODE_SIZE` - Размер QR кода (10)
- `QR_CODE_BORDER` - Толщина рамки (4)

**Файлы**:
- `UPLOAD_DIR` - Директория загрузок
- `MAX_UPLOAD_SIZE_MB` - Макс размер файла (10MB)
- `REPORTS_DIR` - Директория отчетов

**Функции**:
- `get_settings()` - Получить настройки (кешируется через @lru_cache)

---

### `backend/app/database.py`
**Назначение**: Конфигурация асинхронной работы с БД через SQLAlchemy

**Компоненты**:
- `engine` - Асинхронный движок БД
  - Создается из DATABASE_URL из конфига
  - Поддерживает echo для логирования SQL

- `AsyncSessionLocal` - Фабрика асинхронных сессий
  - `autocommit=False` - Ручной контроль транзакций
  - `autoflush=False` - Отключен автофлеш
  - `expire_on_commit=False` - Объекты остаются в памяти после коммита

**Зависимости FastAPI**:
- `get_db()` - Асинхронная зависимость для получения сессии
  - Автоматический коммит при успехе
  - Автоматический откат при ошибке
  - Автоматическое закрытие сессии

**Утилиты**:
- `get_session()` - Асинхронный контекстный менеджер для ручной работы с сессией
  - Используется в seed.py и других скриптах

---

## 2. Модели базы данных

### Инфраструктура кинотеатров

#### `backend/app/models/cinema.py`
**Модель**: `Cinema` - Кинотеатр

**Поля**:
- `id` - UUID, первичный ключ
- `name` - Название (обязательное)
- `address` - Адрес (обязательное)
- `city` - Город
- `latitude` - Широта (координаты)
- `longitude` - Долгота (координаты)
- `phone` - Телефон
- `status` - Статус (enum: ACTIVE, CLOSED, RENOVATION)
- `opening_date` - Дата открытия
- `created_at` - Дата создания записи
- `updated_at` - Дата обновления записи

**Связи**:
- `halls` - Связь с залами (one-to-many)
- `users` - Сотрудники кинотеатра (one-to-many)
- `rental_contracts` - Договоры проката (one-to-many)
- `concession_items` - Товары кинобара (one-to-many)

**Индексы**:
- По полю `city` для быстрого поиска по городам
- По полю `status` для фильтрации активных кинотеатров

---

#### `backend/app/models/hall.py`
**Модель**: `Hall` - Зал кинотеатра

**Поля**:
- `id` - UUID, первичный ключ
- `cinema_id` - Внешний ключ на Cinema
- `hall_number` - Номер зала (целое число)
- `name` - Название зала
- `capacity` - Вместимость (должна быть > 0)
- `hall_type` - Тип зала (enum: STANDARD, VIP, IMAX, 4DX)
- `status` - Статус (enum: ACTIVE, MAINTENANCE, CLOSED)
- `created_at`, `updated_at` - Временные метки

**Связи**:
- `cinema` - Связь с кинотеатром
- `seats` - Места в зале (one-to-many, cascade delete)
- `sessions` - Сеансы в зале (one-to-many)

**Ограничения**:
- `capacity > 0` (CHECK constraint)
- UNIQUE(`cinema_id`, `hall_number`) - уникальность номера зала в кинотеатре

---

#### `backend/app/models/seat.py`
**Модель**: `Seat` - Место в зале

**Поля**:
- `id` - UUID, первичный ключ
- `hall_id` - Внешний ключ на Hall
- `row_number` - Номер ряда (должен быть > 0)
- `seat_number` - Номер места (должен быть > 0)
- `is_aisle` - Место у прохода (boolean)
- `is_available` - Доступно для бронирования (boolean)

**Связи**:
- `hall` - Связь с залом
- `tickets` - Билеты на это место (one-to-many)

**Ограничения**:
- `row_number > 0` (CHECK constraint)
- `seat_number > 0` (CHECK constraint)
- UNIQUE(`hall_id`, `row_number`, `seat_number`) - уникальность места в зале

---

### Фильмы и жанры

#### `backend/app/models/film.py`
**Модель**: `Film` - Фильм

**Поля**:
- `id` - UUID, первичный ключ
- `title` - Название (обязательное)
- `original_title` - Оригинальное название
- `description` - Описание
- `age_rating` - Возрастной рейтинг (6+, 12+, 16+, 18+)
- `duration_minutes` - Длительность в минутах
- `release_year` - Год выпуска
- `country` - Страна производства
- `director` - Режиссер
- `actors` - Актеры (список через запятую)
- `poster_url` - URL постера
- `trailer_url` - URL трейлера
- `imdb_rating` - Рейтинг IMDB
- `kinopoisk_rating` - Рейтинг Кинопоиск
- `created_at`, `updated_at` - Временные метки

**Связи**:
- `genres` - Жанры фильма (many-to-many через таблицу `film_genres`)
- `rental_contracts` - Договоры проката (one-to-many)
- `sessions` - Сеансы фильма (one-to-many)

**Association Table**: `film_genres`
- `film_id` - Внешний ключ на Film
- `genre_id` - Внешний ключ на Genre

**Индексы**:
- По полю `title` для поиска по названию
- По полю `release_year` для фильтрации по годам

---

#### `backend/app/models/genre.py`
**Модель**: `Genre` - Жанр

**Поля**:
- `id` - UUID, первичный ключ
- `name` - Название жанра (UNIQUE, обязательное)
- `created_at` - Дата создания

**Связи**:
- `films` - Фильмы этого жанра (many-to-many)

---

### Распространение фильмов

#### `backend/app/models/distributor.py`
**Модель**: `Distributor` - Дистрибьютор/Правообладатель

**Поля**:
- `id` - UUID, первичный ключ
- `name` - Название компании (обязательное)
- `inn` - ИНН (UNIQUE, обязательное)
- `contact_person` - Контактное лицо
- `email` - Email
- `phone` - Телефон
- `bank_details` - Банковские реквизиты
- `status` - Статус (enum: ACTIVE, INACTIVE, SUSPENDED)
- `created_at`, `updated_at` - Временные метки

**Связи**:
- `rental_contracts` - Договоры проката (one-to-many)

---

#### `backend/app/models/rental_contract.py`
**Модель**: `RentalContract` - Договор проката фильма

**Поля**:
- `id` - UUID, первичный ключ
- `film_id` - Внешний ключ на Film
- `distributor_id` - Внешний ключ на Distributor
- `cinema_id` - Внешний ключ на Cinema
- `contract_number` - Номер договора (UNIQUE)
- `contract_date` - Дата заключения
- `rental_start_date` - Начало проката
- `rental_end_date` - Окончание проката (должна быть > rental_start_date)
- `min_screening_period_days` - Минимальный срок показа
- `min_sessions_per_day` - Минимум сеансов в день

**Процентные поля** (0-100%):
- `distributor_percentage_week1` - Процент дистрибьютора 1 неделя
- `distributor_percentage_week2` - Процент дистрибьютора 2 неделя
- `distributor_percentage_week3` - Процент дистрибьютора 3 неделя
- `distributor_percentage_after` - Процент дистрибьютора после 3 недель

**Финансовые поля**:
- `guaranteed_minimum_amount` - Гарантированная минимальная сумма
- `cinema_operational_costs` - Операционные расходы кинотеатра

**Прочие поля**:
- `status` - Статус договора
- `early_termination_terms` - Условия досрочного расторжения
- `created_at`, `updated_at` - Временные метки

**Связи**:
- `film` - Связь с фильмом
- `distributor` - Связь с дистрибьютором
- `cinema` - Связь с кинотеатром
- `payment_history` - История платежей (one-to-many, cascade delete)

**Ограничения**:
- `rental_end_date > rental_start_date`
- Все процентные поля в диапазоне [0, 100]

---

#### `backend/app/models/payment_history.py`
**Модель**: `PaymentHistory` - История расчетов с дистрибьютором

**Поля**:
- `id` - UUID, первичный ключ
- `rental_contract_id` - Внешний ключ на RentalContract
- `calculated_amount` - Рассчитанная сумма
- `calculation_date` - Дата расчета
- `status` - Статус платежа (enum: PENDING, paid, FAILED, refunded)
- `payment_date` - Дата платежа
- `payment_document_number` - Номер платежного документа
- `created_at`, `updated_at` - Временные метки

**Связи**:
- `rental_contract` - Связь с договором проката

---

### Сеансы и билеты

#### `backend/app/models/session.py`
**Модель**: `Session` - Сеанс показа фильма

**Поля**:
- `id` - UUID, первичный ключ
- `film_id` - Внешний ключ на Film
- `hall_id` - Внешний ключ на Hall
- `start_datetime` - Время начала
- `end_datetime` - Время окончания (должно быть > start_datetime)
- `ticket_price` - Базовая цена билета (должна быть >= 0)
- `status` - Статус (enum: SCHEDULED, ONGOING, completed, cancelled)
- `created_at`, `updated_at` - Временные метки

**Связи**:
- `film` - Связь с фильмом
- `hall` - Связь с залом
- `tickets` - Билеты на сеанс (one-to-many)

**Ограничения**:
- `end_datetime > start_datetime`
- `ticket_price >= 0`

**Индексы**:
- По полю `start_datetime` для поиска по времени
- Составной индекс (`start_datetime`, `hall_id`) для оптимизации расписания

---

#### `backend/app/models/ticket.py`
**Модель**: `Ticket` - Билет на сеанс

**Поля**:
- `id` - UUID, первичный ключ
- `session_id` - Внешний ключ на Session
- `seat_id` - Внешний ключ на Seat
- `buyer_id` - Внешний ключ на User (покупатель)
- `order_id` - Внешний ключ на Order
- `seller_id` - Внешний ключ на User (продавец, если куплен в кассе)
- `price` - Цена билета
- `purchase_date` - Дата покупки
- `sales_channel` - Канал продажи (enum: ONLINE, BOX_OFFICE, MOBILE_APP)
- `status` - Статус (enum: RESERVED, paid, USED, cancelled, EXPIRED)
- `qr_code` - QR код билета (base64)
- `validation_date` - Дата валидации (использования)
- `created_at`, `updated_at` - Временные метки

**Связи**:
- `session` - Связь с сеансом
- `seat` - Связь с местом
- `buyer` - Связь с покупателем (User)
- `seller` - Связь с продавцом (User, опционально)
- `order` - Связь с заказом
- `bonus_transactions` - Транзакции по бонусам (one-to-many)

**Ограничения**:
- UNIQUE(`session_id`, `seat_id`) - запрет двойного бронирования места на сеанс

---

### Пользователи и роли

#### `backend/app/models/role.py`
**Модель**: `Role` - Роль пользователя

**Поля**:
- `id` - UUID, первичный ключ
- `name` - Название роли (UNIQUE, обязательное)
- `created_at` - Дата создания

**Связи**:
- `users` - Пользователи с этой ролью (one-to-many)

**Стандартные роли**:
- `admin` - Администратор
- `manager` - Менеджер кинотеатра
- `user` - Обычный пользователь

---

#### `backend/app/models/user.py`
**Модель**: `User` - Пользователь системы

**Поля**:
- `id` - UUID, первичный ключ
- `role_id` - Внешний ключ на Role
- `cinema_id` - Внешний ключ на Cinema (для сотрудников, опционально)
- `email` - Email (UNIQUE, обязательное)
- `password_hash` - Хеш пароля (bcrypt)
- `first_name` - Имя
- `last_name` - Фамилия
- `phone` - Телефон
- `birth_date` - Дата рождения
- `gender` - Пол (enum: MALE, FEMALE, OTHER, PREFER_NOT_TO_SAY)
- `city` - Город
- `position` - Должность (для сотрудников)
- `registration_date` - Дата регистрации
- `employment_date` - Дата трудоустройства (для сотрудников)
- `last_login` - Дата последнего входа
- `status` - Статус (enum: ACTIVE, INACTIVE, BLOCKED, DELETED)
- `marketing_consent` - Согласие на маркетинг
- `data_processing_consent` - Согласие на обработку данных
- `preferred_language` - Предпочитаемый язык (default: 'ru')
- `created_at`, `updated_at` - Временные метки

**Связи**:
- `role` - Связь с ролью
- `cinema` - Связь с кинотеатром (для сотрудников)
- `bonus_account` - Бонусный счет (one-to-one)
- `orders` - Заказы пользователя (one-to-many)
- `purchased_tickets` - Купленные билеты (one-to-many, foreign_key='buyer_id')
- `sold_tickets` - Проданные билеты (one-to-many, foreign_key='seller_id')
- `reports` - Созданные отчеты (one-to-many)

**Индексы**:
- Составной индекс (`email`, `status`)
- По полю `role_id`
- По полю `cinema_id`

---

#### `backend/app/models/bonus_account.py`
**Модель**: `BonusAccount` - Бонусный счет пользователя

**Поля**:
- `id` - UUID, первичный ключ
- `user_id` - Внешний ключ на User (UNIQUE, one-to-one)
- `balance` - Текущий баланс (должен быть >= 0)
- `last_accrual_date` - Дата последнего начисления
- `created_at`, `updated_at` - Временные метки

**Связи**:
- `user` - Связь с пользователем (one-to-one)
- `transactions` - Транзакции по счету (one-to-many, cascade delete)

**Ограничения**:
- `balance >= 0`

---

#### `backend/app/models/bonus_transaction.py`
**Модель**: `BonusTransaction` - Транзакция по бонусному счету

**Поля**:
- `id` - UUID, первичный ключ
- `bonus_account_id` - Внешний ключ на BonusAccount
- `ticket_id` - Внешний ключ на Ticket (опционально)
- `transaction_type` - Тип (enum: ACCRUAL, DEDUCTION, EXPIRATION)
- `amount` - Сумма транзакции (может быть отрицательной)
- `transaction_date` - Дата транзакции
- `created_at` - Дата создания записи

**Связи**:
- `bonus_account` - Связь с бонусным счетом
- `ticket` - Связь с билетом (если транзакция связана с покупкой)

**Индексы**:
- По полю `bonus_account_id`
- По полю `transaction_date`

---

#### `backend/app/models/promocode.py`
**Модель**: `Promocode` - Промокод/купон

**Поля**:
- `id` - UUID, первичный ключ
- `code` - Код промокода (UNIQUE, обязательное)
- `description` - Описание
- `discount_type` - Тип скидки (enum: PERCENTAGE, FIXED_AMOUNT)
- `discount_value` - Значение скидки (должно быть >= 0)
- `valid_from` - Дата начала действия
- `valid_until` - Дата окончания (должна быть >= valid_from)
- `max_uses` - Максимальное количество использований
- `used_count` - Количество использований
- `min_order_amount` - Минимальная сумма заказа
- `applicable_category` - Категория применения (опционально)
- `status` - Статус (enum: ACTIVE, EXPIRED, DEPLETED, INACTIVE)
- `created_at`, `updated_at` - Временные метки

**Связи**:
- `orders` - Заказы с этим промокодом (one-to-many)

**Ограничения**:
- `valid_until >= valid_from`
- `discount_value >= 0`

**Индекс**:
- По полю `code` для быстрого поиска

---

### Заказы и платежи

#### `backend/app/models/order.py`
**Модель**: `Order` - Заказ (билеты + кинобар)

**Поля**:
- `id` - UUID, первичный ключ
- `user_id` - Внешний ключ на User
- `promocode_id` - Внешний ключ на Promocode (опционально)
- `order_number` - Номер заказа (UNIQUE, генерируется автоматически)
- `created_at` - Дата создания
- `total_amount` - Общая сумма (должна быть >= 0)
- `discount_amount` - Сумма скидки (должна быть >= 0)
- `final_amount` - Итоговая сумма (должна быть >= 0)
- `status` - Статус (enum: created, pending_payment, paid, cancelled, refunded)
- `updated_at` - Дата обновления

**Связи**:
- `user` - Связь с пользователем
- `promocode` - Связь с промокодом (опционально)
- `tickets` - Билеты в заказе (one-to-many, cascade delete)
- `payment` - Платеж по заказу (one-to-one)
- `concession_preorders` - Предзаказы кинобара (one-to-many, cascade delete)

**Ограничения**:
- `total_amount >= 0`
- `discount_amount >= 0`
- `final_amount >= 0`

**Индексы**:
- По полю `user_id`
- По полю `created_at`
- По полю `status`

---

#### `backend/app/models/payment.py`
**Модель**: `Payment` - Платеж по заказу

**Поля**:
- `id` - UUID, первичный ключ
- `order_id` - Внешний ключ на Order (UNIQUE, one-to-one)
- `amount` - Сумма платежа
- `payment_method` - Метод оплаты (enum: CARD, CASH, BONUS_POINTS, MOBILE_PAYMENT)
- `payment_date` - Дата платежа
- `status` - Статус (enum: PENDING, paid, FAILED, refunded)
- `transaction_id` - ID транзакции в платежной системе
- `payment_system_fee` - Комиссия платежной системы
- `card_last_four` - Последние 4 цифры карты
- `refund_date` - Дата возврата (опционально)
- `refund_amount` - Сумма возврата (опционально)
- `created_at`, `updated_at` - Временные метки

**Связи**:
- `order` - Связь с заказом (one-to-one)

---

### Кинобар

#### `backend/app/models/concession_item.py`
**Модель**: `ConcessionItem` - Товар кинобара

**Поля**:
- `id` - UUID, первичный ключ
- `cinema_id` - Внешний ключ на Cinema
- `name` - Название товара (обязательное)
- `description` - Описание
- `price` - Цена (должна быть >= 0)
- `portion_size` - Размер порции (например, "0.5L")
- `calories` - Калорийность
- `stock_quantity` - Количество на складе (должно быть >= 0)
- `status` - Статус (enum: AVAILABLE, OUT_OF_STOCK, DISCONTINUED)
- `image_url` - URL изображения
- `created_at`, `updated_at` - Временные метки

**Связи**:
- `cinema` - Связь с кинотеатром
- `preorders` - Предзаказы этого товара (one-to-many)

**Ограничения**:
- `price >= 0`
- `stock_quantity >= 0`

---

#### `backend/app/models/concession_preorder.py`
**Модель**: `ConcessionPreorder` - Предзаказ товара кинобара

**Поля**:
- `id` - UUID, первичный ключ
- `order_id` - Внешний ключ на Order
- `concession_item_id` - Внешний ключ на ConcessionItem
- `quantity` - Количество (должно быть > 0)
- `unit_price` - Цена за единицу (должна быть >= 0)
- `total_price` - Общая стоимость (должна быть >= 0)
- `status` - Статус (enum: PENDING, READY, completed, cancelled)
- `pickup_code` - Код получения (QR код)
- `pickup_date` - Дата получения
- `created_at`, `updated_at` - Временные метки

**Связи**:
- `order` - Связь с заказом
- `concession_item` - Связь с товаром

**Ограничения**:
- `quantity > 0`
- `unit_price >= 0`
- `total_price >= 0`

---

### Отчеты

#### `backend/app/models/report.py`
**Модель**: `Report` - Сгенерированный отчет

**Поля**:
- `id` - UUID, первичный ключ
- `user_id` - Внешний ключ на User (кто создал отчет)
- `report_type` - Тип отчета (enum: REVENUE, POPULAR_FILMS, DISTRIBUTOR_PAYMENTS, CONCESSION_SALES, USER_ACTIVITY)
- `period_start` - Начало периода
- `period_end` - Конец периода
- `generated_at` - Дата генерации
- `file_format` - Формат файла (enum: PDF, XLSX, CSV)
- `file_url` - URL файла отчета
- `status` - Статус (enum: GENERATING, completed, FAILED)
- `created_at` - Дата создания записи

**Связи**:
- `user` - Связь с пользователем (кто создал)

---

### Enums

#### `backend/app/models/enums.py`
**Назначение**: Централизованное хранение всех enum классов

**Enums** (всего 21):
1. `CinemaStatus` - Статусы кинотеатра
2. `HallType` - Типы залов
3. `HallStatus` - Статусы зала
4. `DistributorStatus` - Статусы дистрибьютора
5. `SessionStatus` - Статусы сеанса
6. `TicketStatus` - Статусы билета
7. `SalesChannel` - Каналы продажи
8. `Gender` - Пол
9. `UserStatus` - Статусы пользователя
10. `BonusTransactionType` - Типы транзакций бонусов
11. `DiscountType` - Типы скидок
12. `PromocodeStatus` - Статусы промокода
13. `OrderStatus` - Статусы заказа
14. `PaymentMethod` - Методы оплаты
15. `PaymentStatus` - Статусы платежа
16. `ConcessionStatus` - Статусы товара кинобара
17. `ConcessionPreorderStatus` - Статусы предзаказа
18. `ReportType` - Типы отчетов
19. `ReportFormat` - Форматы отчетов
20. `ReportStatus` - Статусы отчетов
21. `RentalContractStatus` - Статусы договоров проката (если определен)

---

## 3. Pydantic схемы

### `backend/app/schemas/film.py`
**Схемы для работы с фильмами**

**Схемы**:
- `FilmBase` - Базовые поля фильма
  - `title`, `original_title`, `description`, `age_rating`
  - `duration_minutes`, `release_year`, `country`
  - `director`, `actors`, `poster_url`, `trailer_url`
  - `imdb_rating`, `kinopoisk_rating`

- `FilmCreate` - Создание фильма
  - Наследует `FilmBase`
  - Дополнительно: `genre_ids: List[UUID]` - список ID жанров

- `FilmUpdate` - Обновление фильма
  - Все поля опциональны
  - Позволяет частичное обновление

- `FilmResponse` - Ответ с фильмом
  - Наследует `FilmBase`
  - Дополнительно: `id`, `genres` (список объектов Genre), `created_at`, `updated_at`

- `FilmFilter` - Фильтрация фильмов
  - `genre_id`, `release_year`, `search` (поиск по названию)

---

### `backend/app/schemas/genre.py`
**Схемы для работы с жанрами**

**Схемы**:
- `GenreBase` - Базовые поля жанра
  - `name` - название жанра

- `GenreCreate` - Создание жанра
  - Наследует `GenreBase`

- `GenreUpdate` - Обновление жанра
  - `name` (опционально)

- `GenreResponse` - Ответ с жанром
  - Наследует `GenreBase`
  - Дополнительно: `id`, `created_at`

---

### `backend/app/schemas/cinema.py`
**Схемы для работы с кинотеатрами**

**Схемы**:
- `CinemaBase` - Базовые поля кинотеатра
  - `name`, `address`, `city`, `latitude`, `longitude`
  - `phone`, `status`, `opening_date`
  - **Валидация**: `latitude` в диапазоне [-90, 90], `longitude` в [-180, 180]

- `CinemaCreate` - Создание кинотеатра
  - Наследует `CinemaBase`

- `CinemaUpdate` - Обновление кинотеатра
  - Все поля опциональны

- `CinemaResponse` - Ответ с кинотеатром
  - Наследует `CinemaBase`
  - Дополнительно: `id`, `created_at`, `updated_at`

---

### `backend/app/schemas/hall.py`
**Схемы для работы с залами**

**Схемы**:
- `HallBase` - Базовые поля зала
  - `hall_number`, `name`, `capacity`, `hall_type`, `status`
  - **Валидация**: `capacity > 0`

- `HallCreate` - Создание зала
  - Наследует `HallBase`
  - Дополнительно: `cinema_id`

- `HallUpdate` - Обновление зала
  - Все поля опциональны

- `HallResponse` - Ответ с залом
  - Наследует `HallBase`
  - Дополнительно: `id`, `cinema_id`, `created_at`, `updated_at`

---

### `backend/app/schemas/seat.py`
**Схемы для работы с местами**

**Схемы**:
- `SeatBase` - Базовые поля места
  - `row_number`, `seat_number`, `is_aisle`, `is_available`

- `SeatCreate` - Создание места
  - Наследует `SeatBase`
  - Дополнительно: `hall_id`

- `SeatUpdate` - Обновление места
  - Все поля опциональны

- `SeatResponse` - Ответ с местом
  - Наследует `SeatBase`
  - Дополнительно: `id`, `hall_id`

- `SeatWithStatus` - Место с статусом бронирования
  - Наследует `SeatResponse`
  - Дополнительно: `is_booked` (boolean) - забронировано ли место на конкретный сеанс

---

### `backend/app/schemas/session.py`
**Схемы для работы с сеансами**

**Схемы**:
- `SessionBase` - Базовые поля сеанса
  - `start_datetime`, `end_datetime`, `ticket_price`, `status`

- `SessionCreate` - Создание сеанса
  - Наследует `SessionBase`
  - Дополнительно: `film_id`, `hall_id`

- `SessionUpdate` - Обновление сеанса
  - Все поля опциональны

- `SessionResponse` - Ответ с сеансом
  - Наследует `SessionBase`
  - Дополнительно: `id`, `film_id`, `hall_id`, `created_at`, `updated_at`

- `SessionWithSeats` - Сеанс со списком мест
  - Наследует `SessionResponse`
  - Дополнительно: `seats: List[SeatWithStatus]` - места с информацией о бронировании

- `SessionFilter` - Фильтрация сеансов
  - `cinema_id`, `film_id`, `date` (конкретная дата), `status`

---

### `backend/app/schemas/ticket.py`
**Схемы для работы с билетами**

**Схемы**:
- `TicketBase` - Базовые поля билета
  - `price`, `sales_channel`, `status`

- `TicketCreate` - Создание билета
  - Наследует `TicketBase`
  - Дополнительно: `session_id`, `seat_id`

- `TicketResponse` - Ответ с билетом
  - Наследует `TicketBase`
  - Дополнительно: `id`, `session_id`, `seat_id`, `buyer_id`, `order_id`
  - `seller_id`, `purchase_date`, `qr_code`, `validation_date`
  - `created_at`, `updated_at`

- `TicketValidation` - Валидация QR кода
  - `qr_code` - строка QR кода для проверки

---

### `backend/app/schemas/order.py`
**Схемы для работы с заказами и платежами**

**Схемы**:
- `OrderBase` - Базовые поля заказа
  - `total_amount`, `discount_amount`, `final_amount`, `status`

- `OrderCreate` - Создание заказа
  - `session_id`, `seat_ids: List[UUID]`
  - `concession_items: List[{concession_id, quantity}]` (опционально)
  - `promo_code` (опционально)
  - `use_bonuses` (boolean), `bonus_amount` (опционально)

- `OrderResponse` - Ответ с заказом
  - Наследует `OrderBase`
  - Дополнительно: `id`, `user_id`, `promocode_id`, `order_number`
  - `created_at`, `updated_at`

- `OrderWithTickets` - Заказ с полным списком билетов
  - Наследует `OrderResponse`
  - Дополнительно: `tickets: List[TicketResponse]`

- `PaymentCreate` - Создание платежа
  - `order_id`, `payment_method`, `amount`
  - `card_last_four` (опционально)

- `PaymentResponse` - Ответ с платежом
  - `id`, `order_id`, `amount`, `payment_method`
  - `payment_date`, `status`, `transaction_id`
  - `payment_system_fee`, `card_last_four`
  - `refund_date`, `refund_amount`
  - `created_at`, `updated_at`

---

### `backend/app/schemas/user.py`
**Схемы для работы с пользователями и авторизацией**

**Схемы**:
- `UserBase` - Базовые поля пользователя
  - `email`, `first_name`, `last_name`, `phone`
  - `birth_date`, `gender`, `city`

- `UserCreate` - Регистрация пользователя
  - Наследует `UserBase`
  - Дополнительно: `password` - пароль в открытом виде

- `UserLogin` - Вход пользователя
  - `email`, `password`

- `UserUpdate` - Обновление профиля
  - Все поля опциональны
  - `password` (опционально) - новый пароль

- `UserResponse` - Ответ с пользователем
  - Наследует `UserBase`
  - Дополнительно: `id`, `role_id`, `cinema_id`
  - `position`, `registration_date`, `employment_date`
  - `last_login`, `status`, `preferred_language`
  - `created_at`, `updated_at`
  - **ВАЖНО**: НЕ включает `password_hash`

- `Token` - JWT токен
  - `access_token` - access токен
  - `refresh_token` - refresh токен
  - `token_type` - тип токена (обычно "bearer")

- `TokenData` - Данные из токена
  - `sub` - subject (обычно user_id)
  - `exp` - expiration date

---

### `backend/app/schemas/distributor.py`
**Схемы для работы с дистрибьюторами**

**Схемы**:
- `DistributorBase` - Базовые поля дистрибьютора
  - `name`, `inn`, `contact_person`, `email`
  - `phone`, `bank_details`, `status`
  - **Валидация**: `inn` должен быть 10-12 символов

- `DistributorCreate` - Создание дистрибьютора
  - Наследует `DistributorBase`

- `DistributorUpdate` - Обновление дистрибьютора
  - Все поля опциональны

- `DistributorResponse` - Ответ с дистрибьютором
  - Наследует `DistributorBase`
  - Дополнительно: `id`, `created_at`, `updated_at`

---

### `backend/app/schemas/contract.py`
**Схемы для работы с договорами проката**

**Схемы**:
- `RentalContractBase` - Базовые поля договора
  - `contract_number`, `contract_date`
  - `rental_start_date`, `rental_end_date`
  - `min_screening_period_days`, `min_sessions_per_day`
  - `distributor_percentage_week1/2/3/after`
  - `guaranteed_minimum_amount`, `cinema_operational_costs`
  - `status`, `early_termination_terms`
  - **Валидация**: `rental_end_date > rental_start_date` через field_validator

- `RentalContractCreate` - Создание договора
  - Наследует `RentalContractBase`
  - Дополнительно: `film_id`, `distributor_id`, `cinema_id`

- `RentalContractUpdate` - Обновление договора
  - Все поля опциональны

- `RentalContractResponse` - Ответ с договором
  - Наследует `RentalContractBase`
  - Дополнительно: `id`, `film_id`, `distributor_id`, `cinema_id`
  - `created_at`, `updated_at`

---

### `backend/app/schemas/concession.py`
**Схемы для работы с кинобаром**

**Схемы**:
- `ConcessionItemBase` - Базовые поля товара
  - `name`, `description`, `price`
  - `portion_size`, `calories`, `stock_quantity`
  - `status`, `image_url`

- `ConcessionItemCreate` - Создание товара
  - Наследует `ConcessionItemBase`
  - Дополнительно: `cinema_id`

- `ConcessionItemUpdate` - Обновление товара
  - Все поля опциональны

- `ConcessionItemResponse` - Ответ с товаром
  - Наследует `ConcessionItemBase`
  - Дополнительно: `id`, `cinema_id`, `created_at`, `updated_at`

- `ConcessionPreorderCreate` - Создание предзаказа
  - `concession_item_id`, `quantity`

- `ConcessionPreorderResponse` - Ответ с предзаказом
  - `id`, `order_id`, `concession_item_id`
  - `quantity`, `unit_price`, `total_price`
  - `status`, `pickup_code`, `pickup_date`
  - `created_at`, `updated_at`

---

### `backend/app/schemas/promocode.py`
**Схемы для работы с промокодами**

**Схемы**:
- `PromocodeBase` - Базовые поля промокода
  - `code`, `description`, `discount_type`, `discount_value`
  - `valid_from`, `valid_until`, `max_uses`, `used_count`
  - `min_order_amount`, `applicable_category`, `status`
  - **Валидация**: `valid_until >= valid_from` через field_validator

- `PromocodeCreate` - Создание промокода
  - Наследует `PromocodeBase`

- `PromocodeUpdate` - Обновление промокода
  - Все поля опциональны

- `PromocodeResponse` - Ответ с промокодом
  - Наследует `PromocodeBase`
  - Дополнительно: `id`, `created_at`, `updated_at`

- `PromocodeValidation` - Результат валидации промокода
  - `is_valid` - валиден ли промокод
  - `discount_amount` - сумма скидки
  - `error_message` - сообщение об ошибке (если не валиден)

---

## 4. API роутеры

### `backend/app/routers/auth.py`
**Назначение**: Аутентификация и авторизация пользователей

**Зависимости**:
- `get_current_user(token: str)` - Извлечь пользователя из JWT токена
  - Использует `decode_token()` из utils/security.py
  - Возвращает User объект или вызывает HTTPException(401)

- `get_current_active_user()` - Проверить, что пользователь активен
  - Зависит от `get_current_user()`
  - Проверяет `user.status == UserStatus.ACTIVE`

**Endpoints**:
1. **POST `/register`** - Регистрация нового пользователя
   - Входные данные: `UserCreate` (email, password, first_name, last_name, phone, etc.)
   - Проверяет уникальность email
   - Хеширует пароль через `get_password_hash()`
   - Присваивает роль "user" по умолчанию
   - Создает BonusAccount с балансом 0
   - Возвращает: `UserResponse`

2. **POST `/login`** - Вход в систему
   - Входные данные: `UserLogin` (email, password)
   - Проверяет email и пароль через `verify_password()`
   - Обновляет `last_login`
   - Генерирует access и refresh токены
   - Возвращает: `Token` (access_token, refresh_token, token_type)

3. **GET `/me`** - Получить профиль текущего пользователя
   - Требует аутентификации: `get_current_active_user`
   - Возвращает: `UserResponse`

4. **POST `/refresh`** - Обновить access токен
   - Входные данные: `refresh_token` в теле запроса
   - Декодирует refresh токен
   - Генерирует новый access токен
   - Возвращает: новый `access_token`

**Используемые функции**:
- `get_password_hash()` - хеширование пароля (bcrypt)
- `verify_password()` - проверка пароля
- `create_access_token()` - создание JWT access токена
- `create_refresh_token()` - создание JWT refresh токена
- `decode_token()` - декодирование JWT токена

---

### `backend/app/routers/films.py`
**Назначение**: CRUD операции с фильмами

**Endpoints**:
1. **GET `/`** - Получить список фильмов
   - Query параметры (опционально):
     - `genre_id` - фильтр по жанру
     - `release_year` - фильтр по году выпуска
     - `search` - поиск по названию (ILIKE)
   - Возвращает: `List[FilmResponse]` (с genres)
   - Использует eager loading (`selectinload`) для жанров

2. **GET `/{film_id}`** - Получить фильм по ID
   - Path параметр: `film_id` (UUID)
   - Возвращает: `FilmResponse` (с genres)
   - 404 если не найден

3. **POST `/`** - Создать новый фильм
   - Требует аутентификации: `get_current_active_user`
   - Входные данные: `FilmCreate` (с `genre_ids`)
   - Валидирует наличие всех жанров
   - Связывает фильм с жанрами (many-to-many)
   - Возвращает: `FilmResponse`

4. **PUT `/{film_id}`** - Обновить фильм
   - Требует аутентификации: `get_current_active_user`
   - Path параметр: `film_id` (UUID)
   - Входные данные: `FilmUpdate` (все поля опциональны)
   - Позволяет обновить жанры (заменяет существующие)
   - Возвращает: `FilmResponse`
   - 404 если не найден

5. **DELETE `/{film_id}`** - Удалить фильм
   - Требует аутентификации: `get_current_active_user`
   - Path параметр: `film_id` (UUID)
   - Возвращает: `{"detail": "Film deleted successfully"}`
   - 404 если не найден

**Особенности**:
- Все GET запросы публичные (не требуют авторизации)
- CUD операции требуют авторизации (TODO: добавить проверку роли admin)
- Жанры загружаются через `selectinload(Film.genres)` для оптимизации

---

### `backend/app/routers/genres.py`
**Назначение**: CRUD операции с жанрами

**Endpoints**:
1. **GET `/`** - Получить список всех жанров
   - Возвращает: `List[GenreResponse]` (отсортировано по имени)

2. **GET `/{genre_id}`** - Получить жанр по ID
   - Path параметр: `genre_id` (UUID)
   - Возвращает: `GenreResponse`
   - 404 если не найден

3. **POST `/`** - Создать новый жанр
   - Требует аутентификации: `get_current_active_user`
   - Входные данные: `GenreCreate` (name)
   - Проверяет уникальность имени
   - Возвращает: `GenreResponse`
   - 400 если жанр с таким именем уже существует

4. **PUT `/{genre_id}`** - Обновить жанр
   - Требует аутентификации: `get_current_active_user`
   - Path параметр: `genre_id` (UUID)
   - Входные данные: `GenreUpdate` (name, опционально)
   - Возвращает: `GenreResponse`
   - 404 если не найден

5. **DELETE `/{genre_id}`** - Удалить жанр
   - Требует аутентификации: `get_current_active_user`
   - Path параметр: `genre_id` (UUID)
   - Возвращает: `{"detail": "Genre deleted successfully"}`
   - 404 если не найден

---

### `backend/app/routers/cinemas.py`
**Назначение**: CRUD операции с кинотеатрами

**Endpoints**:
1. **GET `/`** - Получить список кинотеатров
   - Query параметры (опционально):
     - `city` - фильтр по городу
     - `status` - фильтр по статусу
   - Возвращает: `List[CinemaResponse]`

2. **GET `/{cinema_id}`** - Получить кинотеатр по ID
   - Path параметр: `cinema_id` (UUID)
   - Возвращает: `CinemaResponse`
   - 404 если не найден

3. **POST `/`** - Создать новый кинотеатр
   - Требует аутентификации: `get_current_active_user`
   - TODO: добавить проверку роли admin
   - Входные данные: `CinemaCreate`
   - Возвращает: `CinemaResponse`

4. **PUT `/{cinema_id}`** - Обновить кинотеатр
   - Требует аутентификации: `get_current_active_user`
   - TODO: добавить проверку роли admin
   - Path параметр: `cinema_id` (UUID)
   - Входные данные: `CinemaUpdate`
   - Возвращает: `CinemaResponse`
   - 404 если не найден

5. **DELETE `/{cinema_id}`** - Удалить кинотеатр
   - Требует аутентификации: `get_current_active_user`
   - TODO: добавить проверку роли admin
   - Path параметр: `cinema_id` (UUID)
   - Возвращает: `{"detail": "Cinema deleted successfully"}`
   - 404 если не найден

---

### `backend/app/routers/halls.py`
**Назначение**: CRUD операции с залами

**Endpoints**:
1. **GET `/`** - Получить список залов
   - Query параметр (опционально): `cinema_id` - фильтр по кинотеатру
   - Возвращает: `List[HallResponse]`

2. **GET `/{hall_id}`** - Получить зал по ID
   - Path параметр: `hall_id` (UUID)
   - Возвращает: `HallResponse`
   - 404 если не найден

3. **POST `/`** - Создать новый зал
   - Требует аутентификации: `get_current_active_user`
   - Входные данные: `HallCreate` (с `cinema_id`)
   - Проверяет существование кинотеатра
   - Проверяет уникальность `hall_number` в кинотеатре
   - Возвращает: `HallResponse`
   - 404 если кинотеатр не найден
   - 400 если зал с таким номером уже существует

4. **PUT `/{hall_id}`** - Обновить зал
   - Требует аутентификации: `get_current_active_user`
   - Path параметр: `hall_id` (UUID)
   - Входные данные: `HallUpdate`
   - Возвращает: `HallResponse`
   - 404 если не найден

5. **DELETE `/{hall_id}`** - Удалить зал
   - Требует аутентификации: `get_current_active_user`
   - Path параметр: `hall_id` (UUID)
   - Каскадно удаляет все места (seats) через CASCADE
   - Возвращает: `{"detail": "Hall deleted successfully"}`
   - 404 если не найден

---

### `backend/app/routers/sessions.py`
**Назначение**: CRUD операции с сеансами

**Endpoints**:
1. **GET `/`** - Получить список сеансов
   - Query параметры (опционально):
     - `cinema_id` - фильтр по кинотеатру
     - `film_id` - фильтр по фильму
     - `date` - фильтр по дате (формат YYYY-MM-DD)
     - `status` - фильтр по статусу
   - Возвращает: `List[SessionResponse]`
   - Использует JOIN с Hall для фильтрации по cinema_id
   - Фильтрация по дате: сеансы, начинающиеся в указанный день

2. **GET `/{session_id}`** - Получить сеанс по ID
   - Path параметр: `session_id` (UUID)
   - Возвращает: `SessionResponse`
   - 404 если не найден

3. **GET `/{session_id}/seats`** - Получить сеанс со статусом мест
   - Path параметр: `session_id` (UUID)
   - Возвращает: `SessionWithSeats` (со списком мест и статусом бронирования)
   - Для каждого места добавляет флаг `is_booked` (забронировано ли на этот сеанс)
   - Использует LEFT JOIN с Ticket для определения забронированных мест
   - 404 если сеанс не найден

4. **POST `/`** - Создать новый сеанс
   - Требует аутентификации: `get_current_active_user`
   - Входные данные: `SessionCreate` (с `film_id`, `hall_id`)
   - Валидирует наличие фильма и зала
   - Возвращает: `SessionResponse`

5. **PUT `/{session_id}`** - Обновить сеанс
   - Требует аутентификации: `get_current_active_user`
   - Path параметр: `session_id` (UUID)
   - Входные данные: `SessionUpdate`
   - Возвращает: `SessionResponse`
   - 404 если не найден

6. **DELETE `/{session_id}`** - Удалить сеанс
   - Требует аутентификации: `get_current_active_user`
   - Path параметр: `session_id` (UUID)
   - Возвращает: `{"detail": "Session deleted successfully"}`
   - 404 если не найден

---

### `backend/app/routers/bookings.py`
**Назначение**: Бронирование билетов и управление заказами

**Endpoints** (частично реализовано):
1. **POST `/`** - Создать новый заказ (бронирование)
   - Требует аутентификации: `get_current_active_user`
   - Входные данные: `OrderCreate`
     - `session_id` - ID сеанса
     - `seat_ids` - список ID мест
     - `concession_items` - предзаказ кинобара (опционально)
     - `promo_code` - промокод (опционально)
     - `use_bonuses` - использовать бонусы (boolean)
     - `bonus_amount` - количество бонусов
   - Логика:
     1. Валидация сеанса
     2. Валидация мест (доступность, отсутствие бронирования)
     3. Расчет стоимости билетов
     4. Применение промокода (если есть)
     5. Расчет товаров кинобара
     6. Применение бонусов
     7. Создание заказа, билетов, предзаказов
     8. Генерация QR кодов
     9. Начисление бонусов (10% от суммы)
   - Возвращает: `OrderResponse`
   - Проверяет UNIQUE constraint (session_id, seat_id) для предотвращения двойного бронирования

2. **GET `/my`** - Получить мои заказы
   - Требует аутентификации: `get_current_active_user`
   - Возвращает: `List[OrderWithTickets]` (заказы текущего пользователя)

3. **GET `/{booking_id}`** - Получить заказ по ID
   - Требует аутентификации: `get_current_active_user`
   - Path параметр: `booking_id` (UUID)
   - Возвращает: `OrderWithTickets`
   - 403 если заказ не принадлежит текущему пользователю
   - 404 если не найден

4. **POST `/{booking_id}/payment`** - Создать платеж по заказу
   - Требует аутентификации: `get_current_active_user`
   - Path параметр: `booking_id` (UUID)
   - Входные данные: `PaymentCreate`
   - Создает платеж и обновляет статус заказа на paid
   - Возвращает: `PaymentResponse`

5. **DELETE `/{booking_id}`** - Отменить заказ
   - Требует аутентификации: `get_current_active_user`
   - Path параметр: `booking_id` (UUID)
   - Обновляет статус заказа и билетов на cancelled
   - Возвращает: `{"detail": "Booking cancelled successfully"}`

---

### `backend/app/routers/concessions.py`
**Назначение**: Управление товарами кинобара

**Endpoints** (частично реализовано):
1. **GET `/`** - Получить товары кинобара
   - Query параметры (опционально):
     - `cinema_id` - фильтр по кинотеатру
     - `status` - фильтр по статусу
   - Возвращает: `List[ConcessionItemResponse]`

2. **GET `/{item_id}`** - Получить товар по ID
   - Path параметр: `item_id` (UUID)
   - Возвращает: `ConcessionItemResponse`
   - 404 если не найден

3. **POST `/`** - Создать новый товар
   - Требует аутентификации: `get_current_active_user`
   - Входные данные: `ConcessionItemCreate`
   - Возвращает: `ConcessionItemResponse`

---

### `backend/app/routers/distributors.py`
**Назначение**: Управление дистрибьюторами

**Endpoints** (частично реализовано):
1. **GET `/`** - Получить дистрибьюторов
   - Query параметр (опционально): `status` - фильтр по статусу
   - Возвращает: `List[DistributorResponse]`

2. **GET `/{distributor_id}`** - Получить дистрибьютора по ID
   - Path параметр: `distributor_id` (UUID)
   - Возвращает: `DistributorResponse`
   - 404 если не найден

3. **POST `/`** - Создать нового дистрибьютора
   - Требует аутентификации: `get_current_active_user`
   - Входные данные: `DistributorCreate`
   - Проверяет уникальность ИНН
   - Возвращает: `DistributorResponse`
   - 400 если ИНН уже существует

---

### `backend/app/routers/contracts.py`
**Назначение**: Управление договорами проката

**Endpoints** (частично реализовано):
1. **GET `/`** - Получить договоры проката
   - Query параметры (опционально):
     - `cinema_id` - фильтр по кинотеатру
     - `distributor_id` - фильтр по дистрибьютору
     - `film_id` - фильтр по фильму
     - `status` - фильтр по статусу
   - Возвращает: `List[RentalContractResponse]`

2. **GET `/{contract_id}`** - Получить договор по ID
   - Path параметр: `contract_id` (UUID)
   - Возвращает: `RentalContractResponse`
   - 404 если не найден

3. **POST `/`** - Создать новый договор
   - Требует аутентификации: `get_current_active_user`
   - Входные данные: `RentalContractCreate`
   - Валидирует наличие фильма, дистрибьютора, кинотеатра
   - Возвращает: `RentalContractResponse`

---

## 5. Утилиты

### `backend/app/utils/security.py`
**Назначение**: Функции для работы с безопасностью (пароли, JWT)

**Функции**:

1. **`verify_password(plain_password: str, hashed_password: str) -> bool`**
   - Проверяет пароль против bcrypt хеша
   - Использует `pwd_context.verify()`
   - Возвращает True если пароль верный

2. **`get_password_hash(password: str) -> str`**
   - Создает bcrypt хеш пароля
   - **ВАЖНО**: bcrypt имеет ограничение 72 байта, более длинные пароли обрезаются
   - Использует `pwd_context.hash()`

3. **`create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str`**
   - Создает JWT access токен
   - Параметры:
     - `data` - полезная нагрузка (обычно {"sub": user_id})
     - `expires_delta` - время жизни (default: 30 минут из конфига)
   - Добавляет поле `exp` (expiration) в payload
   - Использует `SECRET_KEY` и `ALGORITHM` из конфига

4. **`create_refresh_token(data: dict) -> str`**
   - Создает JWT refresh токен
   - Время жизни: 7 дней из конфига (`REFRESH_TOKEN_EXPIRE_DAYS`)
   - Аналогично access токену, но с большим временем жизни

5. **`decode_token(token: str) -> Optional[dict]`**
   - Декодирует и проверяет JWT токен
   - Возвращает payload (словарь) если токен валиден
   - Возвращает None если токен невалиден или истек
   - Обрабатывает исключения `JWTError`

**Конфигурация**:
- `pwd_context` - CryptContext с bcrypt схемой
- `SECRET_KEY`, `ALGORITHM` - из настроек приложения

---

### `backend/app/utils/qr_generator.py`
**Назначение**: Генерация QR кодов для билетов и предзаказов

**Функции**:

1. **`generate_qr_code(data: str, size: int = 10, border: int = 4) -> str`**
   - Генерирует QR код из строки
   - Параметры:
     - `data` - данные для кодирования
     - `size` - размер QR кода (default: 10 из конфига)
     - `border` - толщина рамки (default: 4 из конфига)
   - Возвращает: base64 строку PNG изображения
   - Использует библиотеку `qrcode`

2. **`generate_ticket_qr(ticket_id: UUID, session_id: UUID, seat_id: UUID) -> str`**
   - Генерирует QR код для билета
   - Формат данных: `"TICKET:{ticket_id}:{session_id}:{seat_id}"`
   - Возвращает: base64 строку QR кода

3. **`generate_concession_qr(preorder_id: UUID, order_id: UUID) -> str`**
   - Генерирует QR код для предзаказа кинобара
   - Формат данных: `"CONCESSION:{preorder_id}:{order_id}"`
   - Возвращает: base64 строку QR кода

4. **`parse_qr_data(qr_data: str) -> dict`**
   - Парсит QR данные в структурированный формат
   - Распознает типы: TICKET, CONCESSION
   - Для TICKET возвращает: `{"type": "ticket", "ticket_id": ..., "session_id": ..., "seat_id": ...}`
   - Для CONCESSION возвращает: `{"type": "concession", "preorder_id": ..., "order_id": ...}`
   - Вызывает `ValueError` если формат невалиден

---

## 6. Инициализация данных

### `backend/seed.py`
**Назначение**: Заполнение БД начальными данными для разработки и тестирования

**Функции**:

1. **`clear_database(db: AsyncSession)`**
   - Очищает все таблицы
   - Удаляет записи в обратном порядке зависимостей
   - Предотвращает ошибки внешних ключей

2. **`create_roles(db: AsyncSession) -> Dict[str, Role]`**
   - Создает роли: admin, manager, user
   - Возвращает словарь {"admin": Role, "manager": Role, "user": Role}

3. **`create_cinemas(db: AsyncSession) -> List[Cinema]`**
   - Создает 3 кинотеатра:
     - Москва (с координатами)
     - Санкт-Петербург
     - Казань
   - Все с статусом ACTIVE

4. **`create_halls_and_seats(db: AsyncSession, cinemas: List[Cinema]) -> List[Hall]`**
   - Для каждого кинотеатра создает 2-3 зала разных типов (STANDARD, VIP, IMAX)
   - Для каждого зала создает сетку мест: 8 рядов x 12 мест
   - Помечает места у прохода (`is_aisle`)
   - Возвращает список залов

5. **`create_genres(db: AsyncSession) -> List[Genre]`**
   - Создает 12 жанров на русском языке:
     - Боевик, Комедия, Драма, Триллер, Фантастика
     - Ужасы, Мелодрама, Приключения, Детектив
     - Фэнтези, Мультфильм, Документальный
   - Возвращает список жанров

6. **`create_films(db: AsyncSession, genres: List[Genre]) -> List[Film]`**
   - Создает несколько фильмов с реальными данными:
     - Оппенгеймер (2023)
     - Барби (2023)
     - и другие...
   - Связывает с жанрами
   - Добавляет рейтинги, описания, постеры
   - Возвращает список фильмов

7. **`create_users(db: AsyncSession, roles: Dict, cinemas: List[Cinema]) -> List[User]`**
   - Создает тестовых пользователей:
     - admin@cinema.com (роль admin)
     - manager@cinema.com (роль manager)
     - user@cinema.com (роль user)
   - Для каждого создает BonusAccount с начальным балансом
   - Хеширует пароли
   - Возвращает список пользователей

8. **`create_sessions(db: AsyncSession, films: List[Film], halls: List[Hall]) -> List[Session]`**
   - Создает сеансы на ближайшие дни
   - Расписание с интервалами (утро, день, вечер)
   - Разные цены для разных типов залов
   - Возвращает список сеансов

9. **`create_tickets_and_orders(...)`**
   - Создает тестовые заказы и билеты
   - Генерирует QR коды
   - Создает платежи
   - Начисляет бонусы

10. **`create_promocodes(db: AsyncSession) -> List[Promocode]`**
    - Создает промокоды:
      - WELCOME10 (10% скидка)
      - SUMMER50 (50 руб скидка)
      - и другие...
    - С разными сроками действия и условиями

11. **`create_distributors_and_contracts(...)`**
    - Создает дистрибьюторов (Warner Bros, Universal, Sony, и др.)
    - Создает договоры проката для фильмов
    - С процентными ставками по неделям

12. **`create_concession_items(db: AsyncSession, cinemas: List[Cinema])`**
    - Создает товары кинобара для каждого кинотеатра:
      - Попкорн (разные размеры)
      - Напитки (Coca-Cola, Sprite, и др.)
      - Снэки (начос, хот-доги, и др.)
    - С ценами, калориями, размерами порций

**Главная функция**:
- **`async def main()`**
  - Вызывает все функции создания данных последовательно
  - Оборачивает в try-except для обработки ошибок
  - Использует `get_session()` для получения БД сессии

**Запуск**: `python seed.py`

---

# FRONTEND

## 1. Точки входа

### `frontend/src/index.js`
**Назначение**: Точка входа React приложения

**Код**:
```javascript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

**Функции**:
- Создает React root
- Монтирует App компонент в DOM элемент с id='root'
- Использует StrictMode для выявления проблем в разработке

---

### `frontend/src/App.js`
**Назначение**: Главный компонент приложения с маршрутизацией

**Компоненты**:
- `ThemeProvider` - применяет Material-UI тему
- `BrowserRouter` - настраивает React Router
- `AuthProvider` - оборачивает приложение контекстом авторизации
- `Header` - навигационная панель

**Маршруты**:
```javascript
<Routes>
  {/* Публичные */}
  <Route path="/" element={<Home />} />
  <Route path="/films/:id" element={<FilmDetail />} />
  <Route path="/sessions/:id/booking" element={<SessionBooking />} />
  <Route path="/login" element={<Login />} />
  <Route path="/register" element={<Register />} />

  {/* Защищенные */}
  <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
  <Route path="/my-tickets" element={<PrivateRoute><MyTickets /></PrivateRoute>} />

  {/* Админ */}
  <Route path="/admin" element={<PrivateRoute requireAdmin><Dashboard /></PrivateRoute>} />
  <Route path="/admin/cinemas" element={<PrivateRoute requireAdmin><CinemasManage /></PrivateRoute>} />
  <Route path="/admin/films" element={<PrivateRoute requireAdmin><FilmsManage /></PrivateRoute>} />
  <Route path="/admin/sessions" element={<PrivateRoute requireAdmin><SessionsManage /></PrivateRoute>} />
</Routes>
```

**Стили**:
- Линейный градиент фона: #141414 → #1f1f1f
- Минимальная высота 100vh

---

### `frontend/src/theme.js`
**Назначение**: Конфигурация Material-UI темы

**Палитра**:
- **Primary**: Netflix red
  - main: #e50914
  - light: #ff4a4a
  - dark: #b00710
- **Secondary**: Gold
  - main: #ffd700
- **Background**:
  - default: #141414
  - paper: #1f1f1f
- **Success**: #46d369
- **Error**: #e50914

**Переопределения компонентов**:
- `MuiButton` - градиентный фон, трансформация при hover
- `MuiCard` - темный фон с рамкой
- `MuiTextField` - светлый текст на темном фоне
- `MuiChip` - полупрозрачный фон с рамкой
- `MuiAppBar` - темный фон

**Типография**:
- Семейство шрифтов: Roboto, sans-serif
- Заголовки h1-h6 с градиентными эффектами

---

## 2. Контекст и состояние

### `frontend/src/context/AuthContext.js`
**Назначение**: Управление глобальным состоянием авторизации

**Состояние**:
```javascript
{
  user: {
    id, email, first_name, last_name, role_id,
    bonus_balance, ...
  },
  token: "JWT_TOKEN",
  isAuthenticated: true/false,
  loading: true/false
}
```

**Функции**:
1. **`login(email, password)`**
   - Отправляет запрос на `/auth/token`
   - Сохраняет токен в localStorage
   - Загружает данные пользователя
   - Обновляет состояние

2. **`register(userData)`**
   - Отправляет запрос на `/auth/register`
   - Автоматически логинит после регистрации
   - Сохраняет токен и пользователя

3. **`logout()`**
   - Удаляет токен из localStorage
   - Очищает состояние пользователя
   - Редиректит на главную

4. **`updateUser(userData)`**
   - Обновляет профиль пользователя
   - Отправляет PUT запрос на `/auth/me`
   - Обновляет локальное состояние

**Хук**: `useAuth()`
- Возвращает `{ user, token, isAuthenticated, loading, login, register, logout, updateUser }`
- Доступен во всех компонентах через `useAuth()`

**Инициализация**:
- При загрузке проверяет наличие токена в localStorage
- Если токен есть, загружает данные пользователя
- Устанавливает токен в Axios headers

**Обработка ошибок**:
- Парсит ошибки валидации от FastAPI
- Отображает понятные сообщения пользователю

---

## 3. API клиенты

### `frontend/src/api/axios.js`
**Назначение**: Настроенный Axios клиент

**Конфигурация**:
```javascript
const api = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000/api/v1',
  headers: {
    'Content-Type': 'application/json'
  }
});
```

**Request Interceptor**:
- Добавляет Bearer токен к каждому запросу
- Читает токен из localStorage
- Устанавливает `Authorization: Bearer <token>`

**Response Interceptor**:
- Обрабатывает ошибки 401 (Unauthorized)
- Удаляет токен из localStorage
- Редиректит на /login
- Отображает уведомление об истечении сессии

---

### `frontend/src/api/auth.js`
**Функции**:
- `register(userData)` - POST /auth/register
- `login(credentials)` - POST /auth/token (URLSearchParams format)
- `getCurrentUser()` - GET /auth/me
- `updateProfile(userData)` - PUT /auth/me

---

### `frontend/src/api/films.js`
**Функции**:
- `getFilms(params)` - GET /films (с фильтрацией)
- `getFilmById(id)` - GET /films/{id}
- `createFilm(filmData)` - POST /films
- `updateFilm(id, filmData)` - PUT /films/{id}
- `deleteFilm(id)` - DELETE /films/{id}
- `uploadPoster(id, file)` - POST /films/{id}/poster (multipart/form-data)

---

### `frontend/src/api/genres.js`
**Функции** (named exports):
- `getGenres()` - GET /genres
- `getGenre(id)` - GET /genres/{id}
- `createGenre(genreData)` - POST /genres
- `updateGenre(id, genreData)` - PUT /genres/{id}
- `deleteGenre(id)` - DELETE /genres/{id}

---

### `frontend/src/api/sessions.js`
**Функции**:
- `getSessions(params)` - GET /sessions (с фильтрацией)
- `getSessionById(id)` - GET /sessions/{id}
- `getSessionSeats(id)` - GET /sessions/{id}/seats
- `createSession(sessionData)` - POST /sessions
- `updateSession(id, sessionData)` - PUT /sessions/{id}
- `deleteSession(id)` - DELETE /sessions/{id}

---

### `frontend/src/api/bookings.js`
**Функции**:
- `createBooking(bookingData)` - POST /bookings
- `getMyBookings()` - GET /bookings/my
- `getBookingById(id)` - GET /bookings/{id}
- `createPayment(bookingId, paymentData)` - POST /bookings/{bookingId}/payment
- `cancelBooking(id)` - DELETE /bookings/{id}
- `getMyTickets()` - GET /tickets/my

---

### `frontend/src/api/cinemas.js`
**Функции**:
- `getCinemas()` - GET /cinemas
- `getCinemaById(id)` - GET /cinemas/{id}
- `createCinema(cinemaData)` - POST /cinemas
- `updateCinema(id, cinemaData)` - PUT /cinemas/{id}
- `deleteCinema(id)` - DELETE /cinemas/{id}
- `getHalls(cinemaId)` - GET /cinemas/{cinemaId}/halls
- `createHall(cinemaId, hallData)` - POST /cinemas/{cinemaId}/halls

---

### `frontend/src/api/concessions.js`
**Функции**:
- `getConcessionItems()` - GET /concessions
- `getConcessionItemById(id)` - GET /concessions/{id}
- `createConcessionItem(itemData)` - POST /concessions
- `updateConcessionItem(id, itemData)` - PUT /concessions/{id}
- `deleteConcessionItem(id)` - DELETE /concessions/{id}

---

## 4. Компоненты

### `frontend/src/components/Header.js`
**Назначение**: Навигационная панель

**Компоненты**:
- `ElevationScroll` - компонент для динамического elevation при скролле
- `Header` - главный компонент навигации

**Функциональность**:
- Логотип с иконкой фильма и названием "CinemaBooking"
- Меню для авторизованных пользователей:
  - Аватар с инициалом
  - Имя пользователя и бонусный баланс
  - Dropdown меню:
    - Профиль
    - Мои билеты
    - Админ-панель (только для админов)
    - Выход
- Кнопка "Войти" для неавторизованных

**Хуки**:
- `useAuth()` - доступ к контексту авторизации
- `useNavigate()` - навигация
- `useState()` - состояние меню

**Стили**:
- Градиентный фон (темный)
- Липкая позиция
- Скролл-триггер для elevation

---

### `frontend/src/components/FilmCard.js`
**Назначение**: Карточка фильма для сетки

**Props**:
- `film` - объект фильма (title, poster_url, genres, duration_minutes, imdb_rating, description)

**Отображение**:
- Постер фильма (с плейсхолдером если нет)
- Название (max 2 строки)
- Жанры (чипсы, до 3)
- Рейтинг (звезды + число)
- Длительность
- Описание (max 2 строки)

**Интерактивность**:
- Hover эффекты:
  - Поднятие карточки (elevation)
  - Масштабирование постера
  - Проявление оверлея с кнопкой
- Оверлей с градиентом и кнопкой "Купить билет"
- Клик по кнопке → переход на `/films/{id}`

**Зависимости**:
- `useNavigate()`
- Material-UI компоненты

---

### `frontend/src/components/PrivateRoute.js`
**Назначение**: Защита маршрутов

**Props**:
- `children` - компонент для отображения
- `requireAdmin` - требуется ли роль админа (default: false)

**Логика**:
1. Проверяет `loading` - показывает Loading
2. Проверяет `isAuthenticated` - редирект на /login
3. Проверяет `requireAdmin` и `user.role_id` - редирект на / если не админ
4. Отображает `children` если все проверки прошли

**Зависимости**:
- `useAuth()`
- `Navigate` из react-router-dom
- `Loading` компонент

---

### `frontend/src/components/SeatMap.js`
**Назначение**: Визуализация схемы зала с местами

**Props**:
- `seats` - массив мест [{id, row_number, seat_number, is_available, is_booked, ...}]
- `selectedSeats` - массив ID выбранных мест
- `onSeatSelect` - callback при клике на место

**Функции**:
- `getSeatColor(seat)` - определение цвета:
  - Зеленый (#46d369) - свободно
  - Красный (#f44336) - занято
  - Синий (#2196f3) - выбрано
- `getSeatHoverColor(seat)` - цвет при hover
- `handleSeatClick(seat)` - обработка клика (только если доступно)
- `getSeatIcon(seat)` - иконка места (EventSeat или Cancel)

**Отображение**:
- Экран вверху (красная полоса)
- Места группированы по рядам
- Номера рядов слева и справа
- Легенда с цветами внизу

**Интерактивность**:
- Скейл на hover (для доступных мест)
- Граница для выбранных мест
- Курсор pointer/not-allowed

---

### `frontend/src/components/SessionList.js`
**Назначение**: Список сеансов фильма

**Props**:
- `sessions` - массив сеансов
- `groupByDate` - группировать по датам (default: true)

**Функции**:
- `formatDate(date)` - форматирование даты (dd MMMM yyyy, ru)
- `formatTime(time)` - форматирование времени (HH:mm)
- `handleBookSession(sessionId)` - переход на `/sessions/{id}/booking`

**Отображение** (для каждого сеанса):
- Время начала
- Название кинотеатра и номер зала
- Базовая цена
- Доступное количество мест
- Формат (если есть)
- Кнопка "Выбрать"

**Группировка**:
- По датам (если `groupByDate=true`)
- Заголовки дат

**Пустое состояние**:
- Сообщение "Сеансы не найдены"

**Зависимости**:
- `date-fns` для форматирования
- `useNavigate()`

---

### `frontend/src/components/Loading.js`
**Назначение**: Спиннер загрузки

**Props**:
- `message` - сообщение (default: "Загрузка...")

**Отображение**:
- Центрированный спиннер
- Текст сообщения снизу
- Красный цвет (#e50914)
- Минимальная высота 400px

---

## 5. Публичные страницы

### `frontend/src/pages/Home.js`
**Назначение**: Главная страница со списком фильмов

**Состояние**:
- `films` - все фильмы
- `genres` - список жанров
- `filteredFilms` - отфильтрованные фильмы
- `loading`, `error` - состояние загрузки
- `selectedGenre` - выбранный жанр
- `searchQuery` - поисковый запрос

**Функции**:
- `loadData()` - параллельная загрузка фильмов и жанров
- `filterFilms()` - фильтрация по жанру и поиску (case-insensitive)
- `resetFilters()` - сброс всех фильтров

**Отображение**:
1. **Hero секция**:
   - Приветствие "Добро пожаловать в CinemaBooking"
   - Подзаголовок

2. **Фильтры**:
   - Поле поиска (с иконкой)
   - Select выбора жанра
   - Кнопка "Сбросить фильтры"

3. **Быстрые фильтры**:
   - Чипсы с жанрами
   - Клик → выбор жанра

4. **Сетка фильмов**:
   - Grid с FilmCard компонентами
   - 3 колонки на больших экранах
   - Адаптивная верстка

**useEffect**:
- Загрузка данных при монтировании
- Фильтрация при изменении фильтров

**Зависимости**:
- `filmsAPI`, `getGenres()`
- `FilmCard`, `Loading`

---

### `frontend/src/pages/FilmDetail.js`
**Назначение**: Подробная страница фильма

**Props**:
- `id` - из URL параметров (`useParams`)

**Состояние**:
- `film` - объект фильма
- `sessions` - сеансы этого фильма
- `loading`, `error`

**Функции**:
- `loadFilmData()` - параллельная загрузка фильма и сеансов

**Отображение**:
1. **Hero фон**:
   - Размытый постер на фоне
   - Темный оверлей

2. **Левая колонка**:
   - Постер фильма

3. **Правая колонка**:
   - Название (градиентный текст)
   - Рейтинг (звезды + число)
   - Жанр (чип)
   - Длительность (чип)
   - Описание
   - Встроенный трейлер (YouTube iframe)

4. **Расписание сеансов**:
   - SessionList компонент

**Зависимости**:
- `filmsAPI`, `sessionsAPI`
- `SessionList`, `Loading`

---

### `frontend/src/pages/Login.js`
**Назначение**: Страница входа

**Состояние**:
- `error` - сообщение об ошибке
- `loading` - состояние отправки
- `showPassword` - видимость пароля

**Форма** (React Hook Form):
```javascript
{
  email: {
    required: "Email обязателен",
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  password: {
    required: "Пароль обязателен",
    minLength: 6
  }
}
```

**Функции**:
- `onSubmit(data)` - отправка формы
  - Вызывает `login()` из AuthContext
  - Редирект на главную при успехе
  - Отображает ошибку при неудаче

**Отображение**:
- Центрированная Card
- Поля email и password
- Кнопка "Войти"
- Ссылка на регистрацию

---

### `frontend/src/pages/Register.js`
**Назначение**: Страница регистрации

**Состояние**:
- `error`, `loading`, `showPassword`

**Форма** (React Hook Form):
```javascript
{
  first_name: { required: "Имя обязательно" },
  last_name: { required: "Фамилия обязательна" },
  email: {
    required: "Email обязателен",
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  phone: {
    pattern: /^\+?[0-9]{10,15}$/
  },
  password: {
    required: "Пароль обязателен",
    minLength: 6
  },
  confirmPassword: {
    validate: (value) => value === password || "Пароли не совпадают"
  }
}
```

**Функции**:
- `onSubmit(data)` - отправка формы
  - Вызывает `register()` из AuthContext
  - Автоматический логин после регистрации
  - Редирект на главную

**Отображение**:
- Поля в 2 колонки (Grid)
- Валидация в реальном времени
- Проверка совпадения паролей
- Кнопка "Зарегистрироваться"
- Ссылка на вход

---

## 6. Защищенные страницы

### `frontend/src/pages/Profile.js`
**Назначение**: Профиль пользователя с редактированием

**Состояние**:
- `editing` - режим редактирования (boolean)
- `success`, `error` - сообщения
- `loading` - состояние отправки

**Функции**:
- `onSubmit(data)` - сохранение изменений
  - Вызывает `updateUser()` из AuthContext
  - Отображает success сообщение
  - Выходит из режима редактирования
- `handleCancel()` - отмена редактирования
  - Сбрасывает форму к исходным значениям

**Отображение** (2 колонки):

**Левая колонка**:
- Большой аватар с инициалом
- Имя и email
- Карточка бонусного баланса:
  - Звезды (золотые)
  - Количество баллов
  - Градиентный фон

**Правая колонка**:
- Личная информация:
  - Имя
  - Фамилия
  - Email (readonly)
  - Телефон
- Кнопка "Редактировать" (если не в режиме редактирования)
- Кнопки "Сохранить" и "Отмена" (если в режиме редактирования)
- Роль и дата регистрации (readonly)

**Зависимости**:
- `useAuth()`
- `useForm()`

---

### `frontend/src/pages/MyTickets.js`
**Назначение**: Список билетов пользователя

**Состояние**:
- `tickets` - все билеты
- `loading`, `error`
- `tabValue` - текущий таб (0=активные, 1=прошедшие)

**Функции**:
- `loadTickets()` - загрузка билетов
- `formatDate(date)` - форматирование даты (dd MMM yyyy, HH:mm)
- `isTicketPast(ticket)` - проверка, прошел ли сеанс
- Автоматическая фильтрация на `activeTickets` и `pastTickets`

**Табы**:
1. **Активные билеты** (иконка часов)
   - Сеансы в будущем

2. **Прошедшие билеты** (иконка галочки)
   - Сеансы в прошлом

**Отображение билета** (Card):

**Левая часть**:
- Название фильма + статус (Chip: Активный/Просмотрен)
- Время сеанса
- Кинотеатр и зал
- Выбранные места (Chip'ы)
- Номер заказа + сумма

**Правая часть**:
- QR-код билета (белый квадрат с иконкой QR)

**Пустое состояние**:
- "У вас пока нет активных билетов"
- "У вас пока нет прошедших билетов"

**Зависимости**:
- `bookingsAPI.getMyTickets()`
- `date-fns`

---

## 7. Страницы бронирования

### `frontend/src/pages/SessionBooking.js`
**Назначение**: Страница бронирования билетов

**Props**:
- `id` - ID сеанса из URL (`useParams`)

**Состояние**:
- `session` - информация о сеансе
- `seats` - все места в зале
- `selectedSeats` - выбранные места (массив ID)
- `concessions` - товары кинобара
- `selectedConcessions` - {concession_id: quantity}
- `promoCode` - промокод (строка)
- `useBonuses` - использовать бонусы (boolean)
- `bonusAmount` - количество бонусов
- `loading`, `bookingLoading`, `error`

**Функции**:
1. **`loadData()`** - параллельная загрузка:
   - Сеанс
   - Места с бронированием
   - Товары кинобара

2. **`handleSeatSelect(seatId)`** - переключение выбора места:
   - Добавляет/удаляет из `selectedSeats`
   - Только если место свободно

3. **`handleConcessionChange(itemId, quantity)`**:
   - Обновляет количество товара
   - Удаляет если количество = 0

4. **`calculateTotal()`** - расчет стоимости:
   - Билеты: `selectedSeats.length * session.ticket_price`
   - Кинобар: сумма всех товаров
   - Минус бонусы (если используются)
   - Минус промокод (TODO)

5. **`handleBooking()`** - создание бронирования:
   - Валидация: хотя бы одно место
   - Подготовка данных:
     ```javascript
     {
       session_id,
       seat_ids: selectedSeats,
       concession_items: [
         {concession_id, quantity}, ...
       ],
       promo_code: promoCode || undefined,
       use_bonuses: useBonuses,
       bonus_amount: bonusAmount || 0
     }
     ```
   - Создание заказа: `createBooking(bookingData)`
   - Создание платежа: `createPayment(orderId, paymentData)`
   - Редирект на `/my-tickets`

**Отображение** (2 колонки):

**Левая колонка** (основная):
1. **Информация о сеансе**:
   - Название фильма
   - Время сеанса
   - Кинотеатр и зал
   - Базовая цена билета

2. **Схема мест**:
   - SeatMap компонент

3. **Кинобар**:
   - Список товаров (карточки)
   - Для каждого товара:
     - Название, описание
     - Цена, размер порции, калорийность
     - Кнопки +/- для выбора количества
     - Текущее количество

**Правая колонка** (липкая):
- **Ваш заказ**:
  - Выбранные места (Chip'ы)
  - Расчет:
    - Билеты: X × Y руб = Z руб
    - Кинобар: W руб

- **Промокод**:
  - Поле ввода
  - (TODO: валидация и применение)

- **Бонусы**:
  - Чекбокс "Использовать бонусы"
  - Поле ввода количества
  - Доступный баланс

- **Итого**: TOTAL руб
- Кнопка "Оплатить" (disabled если нет мест)

**Валидация**:
- Обязательно выбрать хотя бы одно место
- Бонусы не больше доступных
- Бонусы не больше суммы заказа

**Зависимости**:
- `sessionsAPI`, `concessionsAPI`, `bookingsAPI`
- `SeatMap`, `useAuth()`

---

## 8. Админ-панель

### `frontend/src/pages/admin/Dashboard.js`
**Назначение**: Главная панель администратора

**Отображение**:
1. **Статистика** (4 карточки):
   - Пользователи: 1,234 (+12%)
   - Активные фильмы: 42 (+5%)
   - Сеансы сегодня: 156 (+8%)
   - Выручка месяца: ₽1,245,000 (+23%)

2. **Меню управления** (4 пункта):
   - Управление кинотеатрами → /admin/cinemas
   - Управление фильмами → /admin/films
   - Управление сеансами → /admin/sessions
   - Кинобар → /admin/concessions

**Функции**:
- `handleMenuClick(path)` - навигация

**Зависимости**:
- `useNavigate()`
- Material-UI компоненты

---

### `frontend/src/pages/admin/CinemasManage.js`
**Назначение**: Управление кинотеатрами (CRUD)

**Состояние**:
- `cinemas` - список кинотеатров
- `loading`, `error`, `formLoading`
- `dialogOpen` - видимость диалога
- `editingCinema` - редактируемый кинотеатр (null для создания)

**Функции**:
- `loadCinemas()` - загрузка списка
- `handleCreate()` - открыть диалог создания
- `handleEdit(cinema)` - открыть диалог редактирования
- `handleDelete(id)` - удалить (с подтверждением)
- `onSubmit(data)` - создать/обновить кинотеатр

**Отображение**:
1. **Таблица**:
   - Колонки: Название, Адрес, Телефон, Действия
   - Строки с данными
   - Кнопки редактировать/удалить для каждой строки

2. **Кнопка** "Добавить кинотеатр"

3. **Диалог формы**:
   - Название (обязательное)
   - Адрес (обязательное)
   - Телефон (опциональное)
   - Кнопки "Сохранить" и "Отмена"

**Валидация**:
- React Hook Form
- Обязательные поля отмечены

**Зависимости**:
- `cinemasAPI`
- `useForm()`

---

### `frontend/src/pages/admin/FilmsManage.js`
**Назначение**: Управление фильмами (CRUD)

**Состояние**:
- `films` - список фильмов
- `loading`, `error`, `formLoading`
- `dialogOpen`, `editingFilm`
- `posterFile` - выбранный файл постера

**Функции**:
- `loadFilms()` - загрузка списка
- `handleCreate()`, `handleEdit(film)`, `handleDelete(id)`
- `onSubmit(data)` - создать/обновить фильм
  - Если есть posterFile, загружает постер

**Отображение**:
1. **Сетка карточек**:
   - Постер (с плейсхолдером)
   - Название
   - Жанр и длительность
   - Кнопки редактировать/удалить

2. **Кнопка** "Добавить фильм"

3. **Диалог формы**:
   - Название (обязательное)
   - Описание (multiline)
   - Жанр
   - Длительность (число)
   - Рейтинг (0-10)
   - URL трейлера
   - Загрузка постера (file input)

**Функциональность**:
- Загрузка постера через `uploadPoster()`
- Предпросмотр постера

**Зависимости**:
- `filmsAPI`
- `useForm()`

---

### `frontend/src/pages/admin/SessionsManage.js`
**Назначение**: Управление сеансами (CRUD)

**Состояние**:
- `sessions`, `films`, `cinemas` - справочники
- `halls` - залы выбранного кинотеатра
- `loading`, `error`, `formLoading`
- `dialogOpen`, `editingSession`

**Функции**:
- `loadData()` - загрузка сеансов, фильмов, кинотеатров
- `loadHalls(cinemaId)` - загрузка залов при смене кинотеатра
- `handleCreate()`, `handleEdit(session)`, `handleDelete(id)`
- `onSubmit(data)` - создать/обновить сеанс

**Отображение**:
1. **Таблица**:
   - Колонки: Фильм, Кинотеатр, Зал, Время, Цена, Действия
   - Строки с данными

2. **Кнопка** "Добавить сеанс"

3. **Диалог формы**:
   - Фильм (select, обязательное)
   - Кинотеатр (select, обязательное)
   - Зал (select, disabled пока не выбран кинотеатр)
   - Время начала (datetime-local)
   - Базовая цена (число, step 50)

**Интерактивность**:
- При смене кинотеатра загружаются залы этого кинотеатра
- Валидация обязательных полей

**Зависимости**:
- `sessionsAPI`, `filmsAPI`, `cinemasAPI`
- `useForm()`, `watch()` для отслеживания смены кинотеатра

---

## РЕЗЮМЕ

Данный документ содержит полное описание функционала всех файлов проекта "Система управления сетью кинотеатров":

**Backend** (FastAPI + SQLAlchemy):
- 20 моделей БД с полными связями
- Pydantic схемы для валидации
- RESTful API endpoints
- JWT аутентификация
- QR коды для билетов
- Бонусная система
- Промокоды
- Договоры проката с расчетами

**Frontend** (React + Material-UI):
- SPA с React Router
- Context API для глобального состояния
- Полный функционал бронирования
- Админ-панель для управления
- Адаптивный дизайн в стиле Netflix
- Защищенные маршруты

**Архитектура**:
- Асинхронное программирование
- Разделение на слои (модели, схемы, роутеры, сервисы)
- Валидация на всех уровнях
- Централизованная обработка ошибок
- CORS настройка
- Миграции БД через Alembic

Проект представляет собой полнофункциональную систему управления кинотеатрами с возможностью онлайн-бронирования билетов, предзаказом товаров кинобара, бонусной программой и подробной аналитикой.
