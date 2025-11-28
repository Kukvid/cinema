# Database Models and Relationships

## Complete List of Models

### Cinema Infrastructure (3 models)
1. **Cinema** - Кинотеатры
2. **Hall** - Залы
3. **Seat** - Места

### Films & Distribution (5 models)
4. **Film** - Фильмы
5. **Genre** - Жанры
6. **Distributor** - Дистрибьюторы
7. **RentalContract** - Договоры проката
8. **PaymentHistory** - История расчетов с дистрибьюторами

### Sessions & Tickets (2 models)
9. **Session** - Сеансы
10. **Ticket** - Билеты

### Users & Roles (5 models)
11. **User** - Пользователи
12. **Role** - Роли
13. **BonusAccount** - Бонусные счета
14. **BonusTransaction** - Транзакции бонусов
15. **Promocode** - Промокоды

### Orders & Payments (2 models)
16. **Order** - Заказы
17. **Payment** - Платежи

### Concessions (2 models)
18. **ConcessionItem** - Товары кинобара
19. **ConcessionPreorder** - Предзаказы кинобара

### Reports (1 model)
20. **Report** - Отчеты

**TOTAL: 20 models**

---

## Detailed Relationships

### Cinema → Hall → Seat
```
Cinema (one) → (many) Hall
  - Cinema.halls → Hall.cinema
  - CASCADE delete

Hall (one) → (many) Seat
  - Hall.seats → Seat.hall
  - CASCADE delete
```

### Film & Genres (Many-to-Many)
```
Film (many) ↔ (many) Genre
  - Through association table: film_genres
  - Film.genres → Genre.films
  - CASCADE delete on both sides
  - Each film can have multiple genres
  - Each genre can belong to multiple films
```

### Film Distribution Chain
```
Distributor (one) → (many) RentalContract
  - Distributor.rental_contracts → RentalContract.distributor

Film (one) → (many) RentalContract
  - Film.rental_contracts → RentalContract.film

Cinema (one) → (many) RentalContract
  - Cinema.rental_contracts → RentalContract.cinema

RentalContract (one) → (many) PaymentHistory
  - RentalContract.payment_history → PaymentHistory.rental_contract
  - CASCADE delete
```

### Sessions
```
Film (one) → (many) Session
  - Film.sessions → Session.film

Hall (one) → (many) Session
  - Hall.sessions → Session.hall

Session (one) → (many) Ticket
  - Session.tickets → Ticket.session
  - CASCADE delete
```

### Tickets (Complex)
```
Ticket connects to:
  - Session (many-to-one)
    - Ticket.session → Session.tickets
  - Seat (many-to-one)
    - Ticket.seat → Seat.tickets
  - Buyer/User (many-to-one)
    - Ticket.buyer → User.purchased_tickets
    - FK: buyer_id
  - Seller/User (many-to-one)
    - Ticket.seller → User.sold_tickets
    - FK: seller_id
  - Order (many-to-one)
    - Ticket.order → Order.tickets

Constraints:
  - UNIQUE(session_id, seat_id) - no double booking
```

### Users & Roles
```
Role (one) → (many) User
  - Role.users → User.role

Cinema (one) → (many) User
  - Cinema.users → User.cinema
  - For employees only

User (one) → (one) BonusAccount
  - User.bonus_account → BonusAccount.user
  - One-to-one relationship
  - CASCADE delete

BonusAccount (one) → (many) BonusTransaction
  - BonusAccount.transactions → BonusTransaction.bonus_account
  - CASCADE delete

Ticket (one) → (many) BonusTransaction
  - Ticket.bonus_transactions → BonusTransaction.ticket
  - Optional link
```

### Orders
```
User (one) → (many) Order
  - User.orders → Order.user

Promocode (one) → (many) Order
  - Promocode.orders → Order.promocode
  - Optional

Order (one) → (one) Payment
  - Order.payment → Payment.order
  - One-to-one relationship
  - CASCADE delete

Order (one) → (many) Ticket
  - Order.tickets → Ticket.order

Order (one) → (many) ConcessionPreorder
  - Order.concession_preorders → ConcessionPreorder.order
  - CASCADE delete
```

### Concessions
```
Cinema (one) → (many) ConcessionItem
  - Cinema.concession_items → ConcessionItem.cinema

ConcessionItem (one) → (many) ConcessionPreorder
  - ConcessionItem.preorders → ConcessionPreorder.concession_item

Order (one) → (many) ConcessionPreorder
  - Order.concession_preorders → ConcessionPreorder.order
```

### Reports
```
User (one) → (many) Report
  - User.reports → Report.user
  - Optional (SET NULL on delete)
```

---

## Indexes Summary

### Primary Indexes (on FK)
- All foreign keys have indexes
- Examples: `idx_hall_cinema`, `idx_seat_hall`, `idx_session_film`

### Composite Indexes
- `idx_hall_cinema_number` - UNIQUE(cinema_id, hall_number)
- `idx_seat_hall_row_number` - UNIQUE(hall_id, row_number, seat_number)
- `idx_ticket_session_seat` - UNIQUE(session_id, seat_id)
- `idx_session_start_hall` - (start_datetime, hall_id)
- `idx_cinema_city_status` - (city, status)
- `idx_film_genres_film` - (film_id) on film_genres table
- `idx_film_genres_genre` - (genre_id) on film_genres table

### Search Indexes
- `idx_film_title_search` - for film search
- `idx_film_release_year` - for filtering films by year
- `idx_genre_name` - UNIQUE for genre lookup
- `idx_user_email_status` - for user lookup
- `idx_order_number` - for order lookup
- `idx_promocode_code` - for promocode validation
- `idx_ticket_qr_code` - for QR validation

---

## Enum Classes

All status fields use Enum classes defined in `app/models/enums.py`:

1. **CinemaStatus**: active, closed, renovation
2. **HallStatus**: active, maintenance, closed
3. **HallType**: standard, vip, imax, 4dx
4. **DistributorStatus**: active, inactive, suspended
5. **ContractStatus**: active, expired, terminated, pending
6. **PaymentStatus**: pending, paid, failed, refunded
7. **SessionStatus**: scheduled, ongoing, completed, cancelled
8. **TicketStatus**: reserved, paid, used, cancelled, expired
9. **SalesChannel**: online, box_office, mobile_app
10. **UserStatus**: active, inactive, blocked, deleted
11. **Gender**: male, female, other, prefer_not_to_say
12. **BonusTransactionType**: accrual, deduction, expiration
13. **DiscountType**: percentage, fixed_amount
14. **PromocodeStatus**: active, expired, depleted, inactive
15. **OrderStatus**: created, pending_payment, paid, cancelled, refunded
16. **PaymentMethod**: card, cash, bonus_points, mobile_payment
17. **ConcessionItemStatus**: available, out_of_stock, discontinued
18. **PreorderStatus**: pending, ready, completed, cancelled
19. **ReportType**: revenue, popular_films, distributor_payments, concession_sales, user_activity
20. **ReportStatus**: generating, completed, failed
21. **ReportFormat**: pdf, xlsx, csv

---

## CHECK Constraints

### Positive Value Constraints
- Hall: `capacity > 0`
- Seat: `row_number > 0`, `seat_number > 0`
- Session: `ticket_price >= 0`
- BonusAccount: `balance >= 0`
- Promocode: `discount_value >= 0`, `min_order_amount >= 0`
- Order: `total_amount >= 0`, `discount_amount >= 0`, `final_amount >= 0`
- Ticket: `price >= 0`
- Payment: `amount >= 0`, `payment_system_fee >= 0`
- ConcessionItem: `price >= 0`, `stock_quantity >= 0`
- ConcessionPreorder: `quantity > 0`, `unit_price >= 0`, `total_price >= 0`

### Date/Time Constraints
- Session: `end_datetime > start_datetime`
- RentalContract: `rental_end_date > rental_start_date`
- Promocode: `valid_until >= valid_from`

### Percentage Constraints (RentalContract)
- All distributor percentages must be between 0 and 100
- `distributor_percentage_week1 >= 0 AND <= 100`
- `distributor_percentage_week2 >= 0 AND <= 100`
- `distributor_percentage_week3 >= 0 AND <= 100`
- `distributor_percentage_after >= 0 AND <= 100`

---

## Cascade Delete Strategy

### CASCADE (parent deleted → children deleted)
- Cinema → Hall → Seat
- Hall → Session
- Session → Ticket
- Order → Ticket
- Order → Payment
- Order → ConcessionPreorder
- RentalContract → PaymentHistory
- BonusAccount → BonusTransaction
- User → BonusAccount

### SET NULL (parent deleted → FK set to NULL)
- User deletion sets ticket buyer_id/seller_id to NULL
- Promocode deletion sets order promocode_id to NULL
- Ticket deletion sets bonus_transaction ticket_id to NULL
- User deletion sets report user_id to NULL

---

## Notes for Next Phase

1. **Pydantic Schemas** - Create matching schemas for all models
2. **API Endpoints** - Build CRUD operations respecting relationships
3. **Business Logic**:
   - Seat reservation with timeout
   - Bonus calculation (10% of price)
   - Promocode validation
   - Distributor payment calculation by weeks
   - QR generation/validation
4. **Validation**:
   - Session time conflicts (same hall)
   - Seat availability check
   - Contract date ranges
   - Promocode usage limits
