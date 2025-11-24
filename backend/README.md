# Cinema Management System - Backend

FastAPI-based backend for managing cinema operations including film screenings, ticket booking, concessions, and distributor payments.

## Technology Stack

- **FastAPI 0.104+** - Modern async web framework
- **SQLAlchemy 2.0** - ORM with async support
- **PostgreSQL** - Database
- **Alembic** - Database migrations
- **Pydantic** - Data validation
- **JWT** - Authentication
- **QRCode** - Ticket generation
- **ReportLab/OpenPyXL** - Report generation

## Project Structure

```
backend/
├── app/
│   ├── models/          # SQLAlchemy models
│   │   ├── cinema.py
│   │   ├── film.py
│   │   ├── session.py
│   │   ├── ticket.py
│   │   ├── user.py
│   │   ├── order.py
│   │   └── ...
│   ├── schemas/         # Pydantic schemas
│   ├── routers/         # API endpoints
│   ├── services/        # Business logic
│   ├── utils/           # Utility functions
│   │   ├── security.py
│   │   └── qr_generator.py
│   ├── config.py        # Configuration
│   ├── database.py      # DB session
│   └── main.py          # FastAPI app
├── alembic/             # Database migrations
├── .env.example         # Environment variables template
├── alembic.ini          # Alembic config
└── requirements.txt     # Python dependencies
```

## Database Models

### Cinema Infrastructure
- **Cinema** - Cinema locations with halls
- **Hall** - Screening halls with different types (STANDARD, VIP, IMAX, 4DX)
- **Seat** - Individual seats in halls

### Films & Distribution
- **Film** - Movie information
- **Distributor** - Film distributors
- **RentalContract** - Contracts with weekly percentage splits
- **PaymentHistory** - Distributor payment tracking

### Sessions & Tickets
- **Session** - Film screenings
- **Ticket** - Ticket bookings with QR codes

### Users & Roles
- **User** - System users (customers, staff)
- **Role** - User roles (admin, cashier, customer)
- **BonusAccount** - Customer loyalty points
- **BonusTransaction** - Bonus point transactions

### Orders & Payments
- **Order** - Customer orders
- **Payment** - Payment processing
- **Promocode** - Discount codes

### Concessions
- **ConcessionItem** - Snacks and drinks
- **ConcessionPreorder** - Pre-orders with pickup codes

### Reports
- **Report** - Generated reports (revenue, film popularity, etc.)

## Key Relationships

- `Cinema` → `Hall` → `Seat` (one-to-many cascade)
- `Film` → `Session` ← `Hall` (many-to-one)
- `Session` → `Ticket` ← `Seat` (UNIQUE constraint on session+seat)
- `User` → `Ticket` (buyer/seller relationships)
- `Order` → `Ticket` + `ConcessionPreorder`
- `RentalContract` → `PaymentHistory`

## Setup

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

3. **Create database:**
   ```bash
   createdb cinema_db
   ```

4. **Run migrations:**
   ```bash
   alembic upgrade head
   ```

5. **Start server:**
   ```bash
   uvicorn app.main:app --reload
   ```

## API Documentation

Once running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Database Migrations

Create new migration:
```bash
alembic revision --autogenerate -m "description"
```

Apply migrations:
```bash
alembic upgrade head
```

Rollback:
```bash
alembic downgrade -1
```

## Features to Implement

### Phase 1: Infrastructure
- [x] Project structure
- [x] Database models
- [x] Configuration
- [ ] Initial migration
- [ ] JWT authentication

### Phase 2: Basic CRUD
- [ ] Cinema/Hall/Seat management
- [ ] Film catalog
- [ ] Distributor management
- [ ] Rental contract validation
- [ ] Session scheduling

### Phase 3: Booking
- [ ] Seat reservation (5 min timeout)
- [ ] Order creation
- [ ] Payment processing
- [ ] QR code generation
- [ ] QR validation

### Phase 4: Business Logic
- [ ] Bonus system (10% accrual)
- [ ] Promocode validation
- [ ] Concession preorders
- [ ] Distributor payment calculation
- [ ] Payment history automation

### Phase 5: Reports
- [ ] Revenue reports (PDF/Excel)
- [ ] Popular films analytics
- [ ] Distributor settlements
- [ ] Concession sales reports

## Development Notes

- All models use async-ready SQLAlchemy 2.0 syntax
- Relationships use `back_populates` for bidirectional references
- Indexes on FK and frequently queried fields
- CHECK constraints for data validation
- Enum classes for status fields
- Cascade deletes where appropriate

## Next Steps

1. Create Pydantic schemas for all models
2. Implement authentication and authorization
3. Build API endpoints for each resource
4. Add business logic services
5. Write tests
6. Set up CI/CD
