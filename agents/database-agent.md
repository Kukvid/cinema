## Agent 3: Database Architect

**Технологии**: PostgreSQL, SQLAlchemy 2.0, PlantUML

### Основные задачи

**Фаза 1: Проектирование**
1. Схема базы данных в PlantUML находится в файле "backend/dbPlantUml.txt"
2. Определить все indexes (по FK и часто запрашиваемым полям)
3. Определить constraints (UNIQUE, CHECK)
4. Спланировать каскадные удаления

**Фаза 2: Реализация**
5. Создать SQLAlchemy модели с relationships
   - `Cinema.halls` → `Hall.cinema`
   - `Hall.seats` → `Seat.hall`
   - `Film.sessions` → `Session.film`
   - `Session.tickets` → `Ticket.session`
   - `User.bonus_account` → `BonusAccount.user` (one-to-one)
   - `RentalContract.payment_history` → `PaymentHistory.contract`
6. Добавить indexes:
   - `Session(Дата_сеанса, ID_зала)` - для поиска сеансов
   - `Ticket(ID_сеанса, ID_места)` - UNIQUE для предотвращения двойного бронирования
   - `User(Email)` - UNIQUE
   - `Promocode(Код)` - UNIQUE
7. Добавить CHECK constraints:
   - `Seat: Ряд > 0, Место_в_ряду > 0`
   - `Session: Время_окончания > Время_начала`
   - `RentalContract: Дата_окончания_проката > Дата_начала_проката`
   - `Promocode: Значение_скидки >= 0`

**Фаза 3: Данные**
8. Создать seed скрипт:
   - 3-5 кинотеатров с залами
   - 20+ фильмов разных жанров
   - 2-3 дистрибьютора
   - Договоры проката
   - 50+ сеансов
   - Тестовые пользователи (root, admin, client)
   - Промокоды
   - Товары кинобара

**Фаза 4: Оптимизация**
9. Оптимизировать запросы для отчетов:
   - Агрегация выручки по кинотеатрам (GROUP BY)
   - Подсчет проданных билетов по фильмам (JOIN + COUNT)
   - Расчет с дистрибьюторами (сложный JOIN с CASE для недель)
10. Добавить indexes для медленных запросов
11. Использовать `selectinload`/`joinedload` для relationships

**Ключевые relationships**:
Сложные связи
Ticket:
session (many-to-one)
seat (many-to-one)
buyer (many-to-one к User, FK: ID_пользователя_покупатель)
seller (many-to-one к User, FK: ID_пользователя_продавец)
order (many-to-one)
RentalContract:
film (many-to-one)
distributor (many-to-one)
cinema (many-to-one)
payment_history (one-to-many)