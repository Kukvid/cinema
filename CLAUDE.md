# CLAUDE.md

Never run "npm run dev".
Use "npm run build" to check if code compiled or not. See results and fix code if it's needed
Always use context7 when I need code generation, setup or configuration steps, or
library/API documentation. This means you should automatically use the Context7 MCP
tools to resolve library id and get library docs without me having to explicitly ask.
Поддерживай красивую и понятную структуру проектов фронтэнда и бэкэнда
Используй агентов из папки agents для выполнения всех задач, применяй их там где того требует задача
## Project Overview

Система управления сетью кинотеатров. Full-stack приложение с FastAPI backend и Next.js frontend.

## Development Setup

### Environment Setup
The project uses a Python virtual environment located in `.venv/`:

```bash
# On Windows (Git Bash):
source .venv/Scripts/activate

# On Windows (Command Prompt):
.venv\Scripts\activate.bat

# On Windows (PowerShell):
.venv\Scripts\Activate.ps1

# Deactivate when done:
deactivate
```

### Running the Application
```bash
python main.py
```

## Project Structure

- `main.py` - Entry point (currently contains template code)
- `.venv/` - Python virtual environment
- `.idea/` - PyCharm IDE configuration

## Development Notes
Backend:
- Framework: FastAPI 0.104+
- ORM: SQLAlchemy 2.0
- Миграции: Alembic
- Валидация: Pydantic
- Аутентификация: python-jose (JWT токены)
- Python version: 3.10
- Qr-коды: qrcode
- 
**Структура**:
cinema-backend/
cinema-backend/
├── app/
│   ├── main.py                      # Точка входа FastAPI
│   ├── config.py                    # Настройки (DB_URL, SECRET_KEY)
│   ├── database.py                  # Подключение к БД
│   │
│   ├── models/                      # SQLAlchemy модели
│   │   ├── __init__.py
│   │   ├── cinema.py                # Кинотеатр, Зал, Место
│   │   ├── film.py                  # Фильм
│   │   ├── session.py               # Сеанс
│   │   ├── ticket.py                # Билет
│   │   ├── user.py                  # Пользователь, Роль
│   │   ├── rental.py                # ДоговорПроката, ИсторияРасчетов
│   │   ├── order.py                 # Заказ, Платеж
│   │   └── bonus.py                 # БонусныйСчет, ТранзакцияБонусов
│   │
│   ├── schemas/                     # Pydantic схемы (для API)
│   │   ├── cinema.py
│   │   ├── film.py
│   │   ├── session.py
│   │   ├── ticket.py
│   │   ├── user.py
│   │   └── ...
│   │
│   ├── routers/                     # API endpoints
│   │   ├── auth.py                  # Регистрация, вход
│   │   ├── cinemas.py               # CRUD кинотеатров
│   │   ├── films.py                 # CRUD фильмов
│   │   ├── sessions.py              # CRUD сеансов
│   │   ├── bookings.py              # Бронирование билетов
│   │   ├── payments.py              # Оплата (mock)
│   │   ├── users.py                 # Профиль пользователя
│   │   ├── rentals.py               # Договоры проката
│   │   └── reports.py               # Отчеты
│   │
│   ├── services/                    # Бизнес-логика
│   │   ├── auth_service.py          # JWT, хеширование паролей
│   │   ├── booking_service.py       # Логика бронирования
│   │   ├── payment_service.py       # Mock платежей
│   │   ├── rental_service.py        # Расчеты с дистрибьюторами
│   │   └── report_service.py        # Генерация отчетов
│   │
│   └── utils/
│       ├── security.py              # Функции для JWT, паролей
│       ├── qr_generator.py          # Генерация QR кодов
│       └── logger.py                # Простое логирование в файл
│
├── alembic/                         # Миграции БД
│   ├── versions/
│   └── env.py
│
├── uploads/                         # Папка для загруженных файлов
│   ├── posters/                     # Постеры фильмов
│   ├── qr_codes/                    # QR коды билетов
│   └── reports/                     # Сгенерированные отчеты
│
├── logs/                            # Логи
│   └── app.log
│
├── tests/                           # Тесты (опционально)
│   ├── test_auth.py
│   ├── test_bookings.py
│   └── ...
│
├── requirements.txt                 # Зависимости Python
├── .env.example                     # Пример настроек
├── README.md
└── docker-compose.yml               # Опционально для Docker

Frontend:
- Frontend framework: Next.js 14
- Routing: встроенный App Router (для Next.js)
- State: React Context API + useState/useReducer (без Redux/Zustand)
- UI компоненты: Material-UI (готовые компоненты)
- Формы: React Hook Form (легковесная библиотека)
- HTTP клиент: Axios
- Таблицы: react-table (базовая версия)
- Календарь: react-big-calendar (для расписания сеансов)

**Структура**
cinema-frontend/
├── public/
│   ├── index.html
│   └── favicon.ico
│
├── src/
│   ├── index.js                     # Точка входа
│   ├── App.js                       # Главный компонент
│   ├── App.css
│   │
│   ├── pages/                       # Страницы
│   │   ├── Home.js                  # Главная (список фильмов)
│   │   ├── FilmDetail.js            # Страница фильма
│   │   ├── SessionBooking.js        # Бронирование мест
│   │   ├── Login.js                 # Вход
│   │   ├── Register.js              # Регистрация
│   │   ├── Profile.js               # Профиль пользователя
│   │   ├── MyTickets.js             # Мои билеты
│   │   │
│   │   └── admin/                   # Админ-панель
│   │       ├── Dashboard.js         # Дашборд
│   │       ├── CinemasManage.js     # Управление кинотеатрами
│   │       ├── FilmsManage.js       # Управление фильмами
│   │       ├── SessionsManage.js    # Управление сеансами
│   │       ├── RentalsManage.js     # Договоры проката
│   │       └── Reports.js           # Отчеты
│   │
│   ├── components/                  # Компоненты
│   │   ├── Header.js                # Шапка сайта
│   │   ├── Footer.js                # Подвал
│   │   ├── FilmCard.js              # Карточка фильма
│   │   ├── SeatMap.js               # Схема зала с местами
│   │   ├── SessionList.js           # Список сеансов
│   │   └── PrivateRoute.js          # Защищенный роут
│   │
│   ├── context/                     # React Context
│   │   └── AuthContext.js           # Контекст авторизации
│   │
│   ├── api/                         # API запросы
│   │   ├── axios.js                 # Настройка Axios
│   │   ├── auth.js                  # API аутентификации
│   │   ├── films.js                 # API фильмов
│   │   ├── sessions.js              # API сеансов
│   │   └── bookings.js              # API бронирований
│   │
│   └── utils/
│       ├── constants.js             # Константы
│       └── helpers.js               # Вспомогательные функции
│
├── package.json
├── .env.example
└── README.md

The project is managed with Git 