# Cinema Management System - Database Setup Guide

## Содержание
- [Требования](#требования)
- [Настройка базы данных](#настройка-базы-данных)
- [Инициализация схемы БД](#инициализация-схемы-бд)
- [Заполнение тестовыми данными](#заполнение-тестовыми-данными)
- [Тестовые учетные данные](#тестовые-учетные-данные)
- [Структура данных](#структура-данных)
- [Troubleshooting](#troubleshooting)

---

## Требования

### Программное обеспечение
- Python 3.10+
- PostgreSQL 14+
- pip (менеджер пакетов Python)

### Python зависимости
Установите все зависимости из `requirements.txt`:
```bash
pip install -r requirements.txt
```

Основные зависимости:
- `sqlalchemy` - ORM для работы с БД
- `asyncpg` - асинхронный драйвер PostgreSQL
- `alembic` - миграции БД (опционально)
- `passlib` - хеширование паролей
- `python-jose` - JWT токены
- `qrcode` - генерация QR кодов
- `pydantic-settings` - управление конфигурацией

---

## Настройка базы данных

### 1. Установка PostgreSQL

**Windows:**
- Скачайте установщик с [официального сайта](https://www.postgresql.org/download/windows/)
- Запустите установщик и следуйте инструкциям
- Запомните пароль для пользователя `postgres`

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**macOS:**
```bash
brew install postgresql
brew services start postgresql
```

### 2. Создание базы данных

Подключитесь к PostgreSQL:
```bash
# Windows/Linux
psql -U postgres

# macOS
psql postgres
```

Выполните SQL команды:
```sql
-- Создать базу данных
CREATE DATABASE cinema_db;

-- Создать пользователя (опционально)
CREATE USER cinema_user WITH PASSWORD 'your_password_here';

-- Дать права пользователю
GRANT ALL PRIVILEGES ON DATABASE cinema_db TO cinema_user;

-- Выйти
\q
```

### 3. Настройка .env файла

Создайте файл `.env` в директории `backend/`:
```bash
cd backend
cp .env.example .env  # Если есть .env.example
# ИЛИ создайте новый файл .env
```

Содержимое `.env`:
```env
# Application
APP_NAME=Cinema Management System
APP_VERSION=1.0.0
DEBUG=True

# Database
DATABASE_URL=postgresql+asyncpg://postgres:your_password@localhost:5432/cinema_db
DB_ECHO=False

# Security (ВАЖНО: используйте сложный ключ в production!)
SECRET_KEY=your-super-secret-key-change-this-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# CORS
CORS_ORIGINS=["http://localhost:3000","http://localhost:5173"]

# Bonus System
BONUS_ACCRUAL_PERCENTAGE=10
BONUS_POINTS_PER_RUBLE=1

# Reservation
SEAT_RESERVATION_TIMEOUT_MINUTES=5

# QR Code
QR_CODE_SIZE=10
QR_CODE_BORDER=4

# File Upload
UPLOAD_DIR=uploads
MAX_UPLOAD_SIZE_MB=10

# Reports
REPORTS_DIR=reports
```

**Важно:** Замените следующие значения:
- `your_password` - пароль от PostgreSQL
- `your-super-secret-key-change-this-in-production` - сгенерируйте сложный ключ

Для генерации SECRET_KEY:
```python
import secrets
print(secrets.token_urlsafe(32))
```

---

## Инициализация схемы БД

### Вариант 1: Использование create_db.py (Рекомендуется для разработки)

Скрипт `create_db.py` создаст все таблицы автоматически.

```bash
cd backend
python create_db.py
```

**Что делает скрипт:**
1. Отображает подключение к БД
2. Запрашивает подтверждение
3. Удаляет все существующие таблицы (если есть)
4. Создает новые таблицы согласно моделям
5. Проверяет созданные таблицы

**Вывод:**
```
======================================================================
CINEMA MANAGEMENT SYSTEM - DATABASE INITIALIZATION
======================================================================

Database URL: postgresql+asyncpg://postgres:****@localhost:5432/cinema_db

⚠️  WARNING: This will DROP all existing tables and recreate them!
⚠️  All existing data will be LOST!

Do you want to continue? (yes/no): yes

======================================================================
Dropping all existing tables...
All tables dropped successfully!

----------------------------------------------------------------------
Creating all database tables...
All tables created successfully!

----------------------------------------------------------------------
Verifying created tables...

Found 19 tables in database:
  ✓ bonus_accounts
  ✓ bonus_transactions
  ✓ cinemas
  ✓ concession_items
  ✓ concession_preorders
  ✓ distributors
  ✓ films
  ✓ halls
  ✓ orders
  ✓ payment_history
  ✓ payments
  ✓ promocodes
  ✓ rental_contracts
  ✓ reports
  ✓ roles
  ✓ seats
  ✓ sessions
  ✓ tickets
  ✓ users

======================================================================
✓ DATABASE INITIALIZATION completed SUCCESSFULLY!
======================================================================

Next steps:
  1. Run 'python seed.py' to populate database with test data
  2. Start the FastAPI server with 'uvicorn app.main:app --reload'

======================================================================
```

### Вариант 2: Использование Alembic (Для production)

Если вы хотите использовать миграции:

```bash
# Инициализация Alembic (если еще не сделано)
alembic init alembic

# Создать первую миграцию
alembic revision --autogenerate -m "Initial migration"

# Применить миграции
alembic upgrade head
```

---

## Заполнение тестовыми данными

После создания схемы БД, запустите seed скрипт:

```bash
cd backend
python seed.py
```

**Что создает скрипт:**

| Сущность | Количество | Описание |
|----------|-----------|----------|
| Роли | 3 | admin, manager, user |
| Кинотеатры | 3 | Москва, Санкт-Петербург, Казань |
| Залы | 6-9 | 2-3 зала на кинотеатр |
| Места | 576-864 | 96 мест на зал (8 рядов × 12 мест) |
| Фильмы | 20 | Разные жанры и годы |
| Дистрибьюторы | 3 | Universal, Warner Bros, Disney |
| Договоры проката | 20 | По одному на каждый фильм |
| Пользователи | 8 | 2 сотрудника + 6 клиентов |
| Бонусные счета | 8 | По одному на пользователя |
| Сеансы | 50+ | На ближайшие 7 дней |
| Промокоды | 7 | Активные и истекшие |
| Товары кинобара | 57-171 | 19 товаров × 3 кинотеатра |
| Заказы | 10-15 | Оплаченные заказы |
| Билеты | 15-30 | С QR кодами |
| Платежи | 10-15 | Успешные платежи |

**Пример вывода:**
```
============================================================
CINEMA MANAGEMENT SYSTEM - DATABASE SEED
============================================================

1. Creating roles...
   created 3 roles

2. Creating cinemas...
   created 3 cinemas

3. Creating halls and seats...
   created 7 halls and 672 seats

4. Creating films...
   created 20 films

5. Creating distributors...
   created 3 distributors

6. Creating rental contracts...
   created 20 rental contracts

7. Creating users...
   created 8 users

8. Creating bonus accounts...
   created 8 bonus accounts

9. Creating sessions...
   created 53 sessions

10. Creating promocodes...
   created 7 promocodes

11. Creating concession items...
   created 57 concession items

12. Creating orders and tickets...
   created 12 orders
   created 18 tickets
   created 12 payments
   created 5 concession preorders
   created 12 bonus transactions

============================================================
SEED completed SUCCESSFULLY!
============================================================
```

---

## Тестовые учетные данные

### Сотрудники

**Администратор:**
- Email: `admin@cinema.ru`
- Password: `admin123`
- Роль: admin
- Доступ: Полный доступ ко всем функциям системы

**Менеджер:**
- Email: `manager@cinema.ru`
- Password: `manager123`
- Роль: manager
- Доступ: Управление сеансами, заказами, отчеты

### Клиенты

Все клиенты имеют пароль: `user123`

| Email | Имя | Город | Бонусы |
|-------|-----|-------|--------|
| user@example.com | Пользователь Тестовый | Москва | 100-500 |
| ivan@example.com | Иван Иванов | Санкт-Петербург | 100-500 |
| maria@example.com | Мария Петрова | Москва | 100-500 |
| alexey@example.com | Алексей Сидоров | Казань | 100-500 |
| elena@example.com | Елена Смирнова | Москва | 100-500 |
| dmitry@example.com | Дмитрий Козлов | Санкт-Петербург | 100-500 |

### Промокоды

| Код | Тип | Скидка | Описание |
|-----|-----|--------|----------|
| WELCOME10 | Процент | 10% | Для новых пользователей |
| NEWYEAR2024 | Фикс. сумма | 500₽ | Новогодняя акция |
| BIRTHDAY20 | Процент | 20% | В день рождения |
| WEEKEND15 | Процент | 15% | На выходных |
| STUDENT | Фикс. сумма | 200₽ | Студенческая скидка |

---

## Структура данных

### Кинотеатры

1. **КиноПарк "Октябрь"** (Москва)
   - Адрес: ул. Тверская, д. 10
   - Залы: 2-3 (Standard, VIP, IMAX)
   - Места: 96 на зал

2. **КиноМакс "Европа"** (Санкт-Петербург)
   - Адрес: Невский проспект, д. 100
   - Залы: 2-3
   - Места: 96 на зал

3. **Синема Сити** (Казань)
   - Адрес: ул. Баумана, д. 58
   - Залы: 2-3
   - Места: 96 на зал

### Фильмы (примеры)

- **Новинки 2023-2024:**
  - Оппенгеймер (8.5 IMDb, 180 мин)
  - Барби (7.0 IMDb, 114 мин)
  - Дюна: Часть вторая (8.7 IMDb, 166 мин)

- **Классика:**
  - Побег из Шоушенка (9.3 IMDb, 142 мин)
  - Темный рыцарь (9.0 IMDb, 152 мин)
  - Форрест Гамп (8.8 IMDb, 142 мин)
  - Властелин колец (8.8 IMDb, 178 мин)

### Товары кинобара

**Напитки:**
- Coca-Cola, Sprite, Fanta (0.5л/1л): 120₽/180₽
- Вода: 80₽
- Кофе американо: 150₽
- Капучино: 200₽

**Еда:**
- Попкорн (S/M/L): 150₽/250₽/350₽
- Хот-дог: 200₽
- Начос с сыром: 300₽
- Сэндвич: 250₽
- Картофель фри: 180₽

**Сладости:**
- M&M's: 150₽
- Skittles: 150₽

---

## Запуск приложения

После успешной инициализации БД и заполнения данными:

```bash
cd backend

# Запуск сервера разработки
uvicorn app.main:app --reload

# Или с указанием хоста и порта
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Приложение будет доступно по адресу:
- API: http://localhost:8000
- Документация Swagger: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

---

## Troubleshooting

### Проблема: "Connection refused" при подключении к БД

**Решение:**
1. Проверьте, что PostgreSQL запущен:
   ```bash
   # Windows
   services.msc  # Найдите PostgreSQL

   # Linux
   sudo systemctl status postgresql

   # macOS
   brew services list
   ```

2. Проверьте параметры подключения в `.env`:
   - Правильный ли хост (обычно `localhost` или `127.0.0.1`)
   - Правильный ли порт (по умолчанию `5432`)
   - Правильный ли пароль

### Проблема: "Database does not exist"

**Решение:**
Создайте БД вручную:
```bash
psql -U postgres
CREATE DATABASE cinema_db;
\q
```

### Проблема: "Permission denied" при создании таблиц

**Решение:**
Дайте права пользователю:
```sql
GRANT ALL PRIVILEGES ON DATABASE cinema_db TO postgres;
-- Или вашему пользователю
GRANT ALL PRIVILEGES ON DATABASE cinema_db TO cinema_user;
```

### Проблема: "ModuleNotFoundError"

**Решение:**
Установите все зависимости:
```bash
pip install -r requirements.txt
```

### Проблема: Seed скрипт выдает ошибку

**Решение:**
1. Убедитесь, что схема БД создана (`python create_db.py`)
2. Проверьте логи на наличие constraint violations
3. Очистите БД и запустите заново:
   ```bash
   python create_db.py  # Пересоздать схему
   python seed.py       # Заполнить данными
   ```

### Проблема: QR коды не генерируются

**Решение:**
Установите зависимость:
```bash
pip install qrcode[pil]
```

### Проблема: Медленная работа seed скрипта

**Решение:**
Это нормально при первом запуске (хеширование паролей, генерация QR кодов).
Обычно занимает 10-30 секунд в зависимости от мощности компьютера.

---

## Сброс базы данных

Если нужно полностью пересоздать БД:

```bash
# Вариант 1: Через скрипты
python create_db.py  # Пересоздаст все таблицы
python seed.py       # Заполнит данными

# Вариант 2: Вручную через SQL
psql -U postgres
DROP DATABASE cinema_db;
CREATE DATABASE cinema_db;
\q

# Затем создать схему и данные
python create_db.py
python seed.py
```

---

## Дополнительная информация

### Backup базы данных

```bash
# Создать backup
pg_dump -U postgres cinema_db > backup.sql

# Восстановить из backup
psql -U postgres cinema_db < backup.sql
```

### Просмотр данных

Используйте любой из инструментов:
- **pgAdmin** - GUI для PostgreSQL
- **DBeaver** - Универсальный клиент БД
- **psql** - Консольный клиент
- **DataGrip** (JetBrains) - Профессиональная IDE для БД

### Миграции

Для управления изменениями схемы в production рекомендуется использовать Alembic:

```bash
# Создать новую миграцию
alembic revision --autogenerate -m "Description of changes"

# Применить миграции
alembic upgrade head

# Откатить миграцию
alembic downgrade -1
```

---

## Поддержка

Если возникли проблемы:
1. Проверьте логи приложения
2. Проверьте логи PostgreSQL
3. Убедитесь, что все зависимости установлены
4. Проверьте `.env` файл

Для дополнительной помощи обратитесь к:
- Документации FastAPI: https://fastapi.tiangolo.com/
- Документации SQLAlchemy: https://docs.sqlalchemy.org/
- Документации PostgreSQL: https://www.postgresql.org/docs/
