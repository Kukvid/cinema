import asyncio
import sys
from pathlib import Path

# Add backend directory to path
sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from datetime import datetime, timedelta, date, time
import random
from decimal import Decimal

from app.database import AsyncSessionLocal, engine
from app.models import Base
from app.models.role import Role
from app.models.cinema import Cinema
from app.models.hall import Hall
from app.models.seat import Seat
from app.models.film import Film
from app.models.distributor import Distributor
from app.models.rental_contract import RentalContract
from app.models.user import User
from app.models.bonus_account import BonusAccount
from app.models.bonus_transaction import BonusTransaction
from app.models.session import Session
from app.models.promocode import Promocode
from app.models.concession_item import ConcessionItem
from app.models.order import Order
from app.models.ticket import Ticket
from app.models.payment import Payment
from app.models.concession_preorder import ConcessionPreorder
from app.models.enums import (
    CinemaStatus, HallStatus, HallType, DistributorStatus,
    ContractStatus, SessionStatus, UserStatus, Gender,
    BonusTransactionType, DiscountType, PromocodeStatus,
    OrderStatus, TicketStatus, SalesChannel, PaymentMethod,
    PaymentStatus, ConcessionItemStatus, PreorderStatus
)
from app.utils.security import get_password_hash
from app.utils.qr_generator import generate_ticket_qr


async def clear_database(db: AsyncSession):
    """Clear all data from database (optional, use with caution)"""
    print("Clearing existing data...")

    # Delete in reverse order of dependencies
    tables_to_clear = [
        BonusTransaction,
        Payment,
        ConcessionPreorder,
        Ticket,
        Order,
        Session,
        RentalContract,
        Promocode,
        ConcessionItem,
        BonusAccount,
        User,
        Seat,
        Hall,
        Cinema,
        Film,
        Distributor,
        Role,
    ]

    for table in tables_to_clear:
        await db.execute(delete(table))

    await db.commit()
    print("Database cleared successfully!")


async def create_roles(db: AsyncSession):
    """Create user roles"""
    print("\n1. Creating roles...")

    roles_data = [
        {"name": "admin"},
        {"name": "manager"},
        {"name": "user"},
    ]

    roles = []
    for role_data in roles_data:
        role = Role(**role_data)
        db.add(role)
        roles.append(role)

    await db.flush()
    print(f"   Created {len(roles)} roles")
    return roles


async def create_cinemas(db: AsyncSession):
    """Create cinemas"""
    print("\n2. Creating cinemas...")

    cinemas_data = [
        {
            "name": 'КиноПарк "Октябрь"',
            "address": "ул. Тверская, д. 10",
            "city": "Москва",
            "latitude": Decimal("55.761230"),
            "longitude": Decimal("37.618423"),
            "phone": "+7 (495) 123-45-67",
            "status": CinemaStatus.ACTIVE,
            "opening_date": date(2015, 6, 1),
        },
        {
            "name": 'КиноМакс "Европа"',
            "address": "Невский проспект, д. 100",
            "city": "Санкт-Петербург",
            "latitude": Decimal("59.934280"),
            "longitude": Decimal("30.335098"),
            "phone": "+7 (812) 234-56-78",
            "status": CinemaStatus.ACTIVE,
            "opening_date": date(2016, 9, 15),
        },
        {
            "name": "Синема Сити",
            "address": "ул. Баумана, д. 58",
            "city": "Казань",
            "latitude": Decimal("55.789974"),
            "longitude": Decimal("49.122193"),
            "phone": "+7 (843) 345-67-89",
            "status": CinemaStatus.ACTIVE,
            "opening_date": date(2018, 3, 20),
        },
    ]

    cinemas = []
    for cinema_data in cinemas_data:
        cinema = Cinema(**cinema_data)
        db.add(cinema)
        cinemas.append(cinema)

    await db.flush()
    print(f"   Created {len(cinemas)} cinemas")
    return cinemas


async def create_halls_and_seats(db: AsyncSession, cinemas: list):
    """Create halls and seats for each cinema"""
    print("\n3. Creating halls and seats...")

    halls = []
    seats = []

    hall_types = [HallType.STANDARD, HallType.VIP, HallType.IMAX]

    for cinema in cinemas:
        # Create 2-3 halls per cinema
        num_halls = random.randint(2, 3)

        for hall_num in range(1, num_halls + 1):
            hall = Hall(
                cinema_id=cinema.id,
                hall_number=str(hall_num),
                name=f"Зал {hall_num}",
                capacity=96,  # 8 rows * 12 seats
                hall_type=hall_types[hall_num - 1] if hall_num <= len(hall_types) else HallType.STANDARD,
                status=HallStatus.ACTIVE,
            )
            db.add(hall)
            await db.flush()
            halls.append(hall)

            # Create seats: 8 rows, 12 seats per row
            for row in range(1, 9):
                for seat_num in range(1, 13):
                    # Aisle between seats 6 and 7
                    is_aisle = (seat_num == 6 or seat_num == 7)

                    seat = Seat(
                        hall_id=hall.id,
                        row_number=row,
                        seat_number=seat_num,
                        is_aisle=is_aisle,
                        is_available=True,
                    )
                    db.add(seat)
                    seats.append(seat)

            await db.flush()

    print(f"   Created {len(halls)} halls and {len(seats)} seats")
    return halls, seats


async def create_films(db: AsyncSession):
    """Create films"""
    print("\n4. Creating films...")

    films_data = [
        {
            "title": "Оппенгеймер",
            "original_title": "Oppenheimer",
            "description": "История американского физика-теоретика Роберта Оппенгеймера, который руководил разработкой атомной бомбы во время Второй мировой войны в рамках Манхэттенского проекта.",
            "genre": "Биография, Драма, История",
            "age_rating": "16+",
            "duration_minutes": 180,
            "release_year": 2023,
            "country": "США, Великобритания",
            "director": "Кристофер Нолан",
            "actors": "Киллиан Мёрфи, Эмили Блант, Мэтт Деймон, Роберт Дауни мл.",
            "poster_url": "https://www.themoviedb.org/t/p/w600_and_h900_bestv2/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg",
            "trailer_url": "https://www.youtube.com/watch?v=uYPbbksJxIg",
            "imdb_rating": Decimal("8.5"),
            "kinopoisk_rating": Decimal("8.1"),
        },
        {
            "title": "Барби",
            "original_title": "Barbie",
            "description": "Барби живет в идеальном мире Барбиленд, но однажды она отправляется в реальный мир, чтобы найти истинное счастье.",
            "genre": "Комедия, Фэнтези",
            "age_rating": "12+",
            "duration_minutes": 114,
            "release_year": 2023,
            "country": "США",
            "director": "Грета Гервиг",
            "actors": "Марго Робби, Райан Гослинг, Уилл Феррелл, Америка Феррера",
            "poster_url": "https://www.themoviedb.org/t/p/w600_and_h900_bestv2/iuFNMS8U5cb6xfzi51Dbkovj7vM.jpg",
            "trailer_url": "https://www.youtube.com/watch?v=pBk4NYhWNMM",
            "imdb_rating": Decimal("7.0"),
            "kinopoisk_rating": Decimal("6.8"),
        },
        {
            "title": "Дюна: Часть вторая",
            "original_title": "Dune: Part Two",
            "description": "Пол Атрейдес объединяется с Чани и фрименами, чтобы отомстить заговорщикам, уничтожившим его семью.",
            "genre": "Фантастика, Боевик, Драма",
            "age_rating": "12+",
            "duration_minutes": 166,
            "release_year": 2024,
            "country": "США",
            "director": "Дени Вильнёв",
            "actors": "Тимоти Шаламе, Зендея, Ребекка Фергюсон, Хавьер Бардем",
            "poster_url": "https://www.themoviedb.org/t/p/w600_and_h900_bestv2/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg",
            "trailer_url": "https://www.youtube.com/watch?v=Way9Dexny3w",
            "imdb_rating": Decimal("8.7"),
            "kinopoisk_rating": Decimal("8.2"),
        },
        {
            "title": "Властелин колец: Братство Кольца",
            "original_title": "The Lord of the Rings: The Fellowship of the Ring",
            "description": "Молодой хоббит Фродо Бэггинс отправляется в опасное путешествие, чтобы уничтожить Кольцо Всевластия.",
            "genre": "Фэнтези, Приключения, Драма",
            "age_rating": "12+",
            "duration_minutes": 178,
            "release_year": 2001,
            "country": "Новая Зеландия, США",
            "director": "Питер Джексон",
            "actors": "Элайджа Вуд, Иэн МакКеллен, Вигго Мортенсен, Шон Бин",
            "poster_url": "https://www.themoviedb.org/t/p/w600_and_h900_bestv2/6oom5QYQ2yQTMJIbnvbkBL9cHo6.jpg",
            "trailer_url": "https://www.youtube.com/watch?v=V75dMMIW2B4",
            "imdb_rating": Decimal("8.8"),
            "kinopoisk_rating": Decimal("8.6"),
        },
        {
            "title": "Интерстеллар",
            "original_title": "Interstellar",
            "description": "Группа исследователей отправляется через червоточину в поисках нового дома для человечества.",
            "genre": "Фантастика, Драма, Приключения",
            "age_rating": "12+",
            "duration_minutes": 169,
            "release_year": 2014,
            "country": "США, Великобритания",
            "director": "Кристофер Нолан",
            "actors": "Мэтью МакКонахи, Энн Хэтэуэй, Джессика Честейн, Майкл Кейн",
            "poster_url": "https://www.themoviedb.org/t/p/w600_and_h900_bestv2/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
            "trailer_url": "https://www.youtube.com/watch?v=zSWdZVtXT7E",
            "imdb_rating": Decimal("8.6"),
            "kinopoisk_rating": Decimal("8.6"),
        },
        {
            "title": "Джокер",
            "original_title": "Joker",
            "description": "История происхождения культового злодея. Клоун и комик Артур Флек превращается в безумного преступника.",
            "genre": "Триллер, Драма, Криминал",
            "age_rating": "18+",
            "duration_minutes": 122,
            "release_year": 2019,
            "country": "США",
            "director": "Тодд Филлипс",
            "actors": "Хоакин Феникс, Роберт Де Ниро, Зази Битц, Фрэнсис Макдорманд",
            "poster_url": "https://www.themoviedb.org/t/p/w600_and_h900_bestv2/udDclJoHjfjb8Ekgsd4FDteOkCU.jpg",
            "trailer_url": "https://www.youtube.com/watch?v=zAGVQLHvwOY",
            "imdb_rating": Decimal("8.4"),
            "kinopoisk_rating": Decimal("7.9"),
        },
        {
            "title": "Паразиты",
            "original_title": "Parasite",
            "description": "Бедная семья Ким одна за другой устраивается на работу к богатым Паркам, выдавая себя за специалистов.",
            "genre": "Драма, Триллер, Комедия",
            "age_rating": "18+",
            "duration_minutes": 132,
            "release_year": 2019,
            "country": "Южная Корея",
            "director": "Пон Джун Хо",
            "actors": "Сон Кан Хо, Ли Сон Гюн, Чо Ё Джон, Чхве У Сик",
            "poster_url": "https://www.themoviedb.org/t/p/w600_and_h900_bestv2/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg",
            "trailer_url": "https://www.youtube.com/watch?v=5xH0HfJHsaY",
            "imdb_rating": Decimal("8.5"),
            "kinopoisk_rating": Decimal("8.1"),
        },
        {
            "title": "1+1",
            "original_title": "Intouchables",
            "description": "Аристократ на коляске нанимает в помощники человека, который менее всего подходит для этой работы.",
            "genre": "Комедия, Драма",
            "age_rating": "16+",
            "duration_minutes": 112,
            "release_year": 2011,
            "country": "Франция",
            "director": "Оливье Накаш, Эрик Толедано",
            "actors": "Франсуа Клюзе, Омар Си, Анн Ле Ни, Одри Флёро",
            "poster_url": "https://www.themoviedb.org/t/p/w600_and_h900_bestv2/4mKIJ7wA4QO1JHr0LTeYQiGypuv.jpg",
            "trailer_url": "https://www.youtube.com/watch?v=34WIbmXkewU",
            "imdb_rating": Decimal("8.5"),
            "kinopoisk_rating": Decimal("8.8"),
        },
        {
            "title": "Зеленая миля",
            "original_title": "The Green Mile",
            "description": "История о начальнике тюремного блока, который понимает, что один из заключённых обладает сверхъестественным даром.",
            "genre": "Драма, Криминал, Фэнтези",
            "age_rating": "16+",
            "duration_minutes": 189,
            "release_year": 1999,
            "country": "США",
            "director": "Фрэнк Дарабонт",
            "actors": "Том Хэнкс, Дэвид Морс, Бонни Хант, Майкл Кларк Дункан",
            "poster_url": "https://www.themoviedb.org/t/p/w600_and_h900_bestv2/velWPhVMQeQKcxggNEU8YmIo52R.jpg",
            "trailer_url": "https://www.youtube.com/watch?v=Ki4haFrqSrw",
            "imdb_rating": Decimal("8.6"),
            "kinopoisk_rating": Decimal("9.1"),
        },
        {
            "title": "Форрест Гамп",
            "original_title": "Forrest Gump",
            "description": "История жизни простого человека из Алабамы, который невольно становится свидетелем важнейших событий в истории США.",
            "genre": "Драма, Комедия, Мелодрама",
            "age_rating": "12+",
            "duration_minutes": 142,
            "release_year": 1994,
            "country": "США",
            "director": "Роберт Земекис",
            "actors": "Том Хэнкс, Робин Райт, Гари Синиз, Салли Филд",
            "poster_url": "https://www.themoviedb.org/t/p/w600_and_h900_bestv2/arw2vcBveWOVZr6pxd9XTd1TdQa.jpg",
            "trailer_url": "https://www.youtube.com/watch?v=bLvqoHBptjg",
            "imdb_rating": Decimal("8.8"),
            "kinopoisk_rating": Decimal("8.9"),
        },
        {
            "title": "Побег из Шоушенка",
            "original_title": "The Shawshank Redemption",
            "description": "Бухгалтер Энди Дюфрейн обвинён в убийстве собственной жены и её любовника. Оказавшись в тюрьме, он сталкивается с жестокостью тюремной жизни.",
            "genre": "Драма",
            "age_rating": "16+",
            "duration_minutes": 142,
            "release_year": 1994,
            "country": "США",
            "director": "Фрэнк Дарабонт",
            "actors": "Тим Роббинс, Морган Фримен, Боб Гантон, Уильям Сэдлер",
            "poster_url": "https://www.themoviedb.org/t/p/w600_and_h900_bestv2/q6y0Go1tsGEsmtFryDOJo3dEmqu.jpg",
            "trailer_url": "https://www.youtube.com/watch?v=6hB3S9bIaco",
            "imdb_rating": Decimal("9.3"),
            "kinopoisk_rating": Decimal("9.1"),
        },
        {
            "title": "Начало",
            "original_title": "Inception",
            "description": "Кобб — талантливый вор, лучший из лучших в опасном искусстве извлечения: он крадёт ценные секреты из глубин подсознания во время сна.",
            "genre": "Фантастика, Боевик, Триллер",
            "age_rating": "12+",
            "duration_minutes": 148,
            "release_year": 2010,
            "country": "США, Великобритания",
            "director": "Кристофер Нолан",
            "actors": "Леонардо ДиКаприо, Марион Котийяр, Том Харди, Джозеф Гордон-Левитт",
            "poster_url": "https://www.themoviedb.org/t/p/w600_and_h900_bestv2/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg",
            "trailer_url": "https://www.youtube.com/watch?v=YoHD9XEInc0",
            "imdb_rating": Decimal("8.8"),
            "kinopoisk_rating": Decimal("8.7"),
        },
        {
            "title": "Темный рыцарь",
            "original_title": "The Dark Knight",
            "description": "Бэтмен поднимает ставки в войне с криминалом. С помощью лейтенанта Джима Гордона и прокурора Харви Дента он намерен очистить улицы от преступности.",
            "genre": "Фантастика, Боевик, Триллер",
            "age_rating": "12+",
            "duration_minutes": 152,
            "release_year": 2008,
            "country": "США, Великобритания",
            "director": "Кристофер Нолан",
            "actors": "Кристиан Бэйл, Хит Леджер, Аарон Экхарт, Майкл Кейн",
            "poster_url": "https://www.themoviedb.org/t/p/w600_and_h900_bestv2/qJ2tW6WMUDux911r6m7haRef0WH.jpg",
            "trailer_url": "https://www.youtube.com/watch?v=EXeTwQWrcwY",
            "imdb_rating": Decimal("9.0"),
            "kinopoisk_rating": Decimal("8.5"),
        },
        {
            "title": "Криминальное чтиво",
            "original_title": "Pulp Fiction",
            "description": "Двое бандитов, жена гангстера, боксёр и пара грабителей оказываются связаны в серии насильственных и забавных историй.",
            "genre": "Криминал, Драма",
            "age_rating": "18+",
            "duration_minutes": 154,
            "release_year": 1994,
            "country": "США",
            "director": "Квентин Тарантино",
            "actors": "Джон Траволта, Сэмюэл Л. Джексон, Ума Турман, Брюс Уиллис",
            "poster_url": "https://www.themoviedb.org/t/p/w600_and_h900_bestv2/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg",
            "trailer_url": "https://www.youtube.com/watch?v=s7EdQ4FqbhY",
            "imdb_rating": Decimal("8.9"),
            "kinopoisk_rating": Decimal("8.6"),
        },
        {
            "title": "Матрица",
            "original_title": "The Matrix",
            "description": "Программист Томас Андерсон ведёт двойную жизнь. Днём он самый обычный офисный работник, а ночью превращается в хакера по имени Нео.",
            "genre": "Фантастика, Боевик",
            "age_rating": "16+",
            "duration_minutes": 136,
            "release_year": 1999,
            "country": "США",
            "director": "Лана и Лилли Вачовски",
            "actors": "Киану Ривз, Лоренс Фишборн, Кэрри-Энн Мосс, Хьюго Уивинг",
            "poster_url": "https://www.themoviedb.org/t/p/w600_and_h900_bestv2/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg",
            "trailer_url": "https://www.youtube.com/watch?v=m8e-FF8MsqU",
            "imdb_rating": Decimal("8.7"),
            "kinopoisk_rating": Decimal("8.5"),
        },
        {
            "title": "Гладиатор",
            "original_title": "Gladiator",
            "description": "Максимус — могущественный римский генерал, которого предал император Коммод. Став рабом, он должен сражаться как гладиатор.",
            "genre": "Боевик, Драма, Приключения",
            "age_rating": "16+",
            "duration_minutes": 155,
            "release_year": 2000,
            "country": "США, Великобритания",
            "director": "Ридли Скотт",
            "actors": "Рассел Кроу, Хоакин Феникс, Конни Нильсен, Оливер Рид",
            "poster_url": "https://www.themoviedb.org/t/p/w600_and_h900_bestv2/ty8TGRuvJLPUmAR1H1nRIsgwvim.jpg",
            "trailer_url": "https://www.youtube.com/watch?v=owK1qxDselE",
            "imdb_rating": Decimal("8.5"),
            "kinopoisk_rating": Decimal("8.6"),
        },
        {
            "title": "Леон",
            "original_title": "Léon",
            "description": "Профессиональный убийца Леон берёт под опеку 12-летнюю девочку Матильду, семью которой убили коррумпированные полицейские.",
            "genre": "Боевик, Триллер, Драма",
            "age_rating": "16+",
            "duration_minutes": 110,
            "release_year": 1994,
            "country": "Франция, США",
            "director": "Люк Бессон",
            "actors": "Жан Рено, Натали Портман, Гари Олдман, Дэнни Айелло",
            "poster_url": "https://www.themoviedb.org/t/p/w600_and_h900_bestv2/yI6X2cCM5YPJtxMhUd3dPGqDAhw.jpg",
            "trailer_url": "https://www.youtube.com/watch?v=jawVxq1Iyl0",
            "imdb_rating": Decimal("8.5"),
            "kinopoisk_rating": Decimal("8.7"),
        },
        {
            "title": "Престиж",
            "original_title": "The Prestige",
            "description": "Роберт и Альфред — фокусники-иллюзионисты, которые в конце XIX века устраивали в Лондоне невероятные представления.",
            "genre": "Фантастика, Триллер, Драма",
            "age_rating": "12+",
            "duration_minutes": 130,
            "release_year": 2006,
            "country": "США, Великобритания",
            "director": "Кристофер Нолан",
            "actors": "Кристиан Бэйл, Хью Джекман, Майкл Кейн, Скарлетт Йоханссон",
            "poster_url": "https://www.themoviedb.org/t/p/w600_and_h900_bestv2/bdN3gXuIZYaJP7ftKK2sU0nPtEA.jpg",
            "trailer_url": "https://www.youtube.com/watch?v=o4gHCmTQDVI",
            "imdb_rating": Decimal("8.5"),
            "kinopoisk_rating": Decimal("8.5"),
        },
        {
            "title": "Бойцовский клуб",
            "original_title": "Fight Club",
            "description": "Страдающий бессонницей офисный работник и дьявольски обаятельный торговец мылом создают подпольный бойцовский клуб.",
            "genre": "Триллер, Драма",
            "age_rating": "18+",
            "duration_minutes": 139,
            "release_year": 1999,
            "country": "США, Германия",
            "director": "Дэвид Финчер",
            "actors": "Эдвард Нортон, Брэд Питт, Хелена Бонем Картер, Мит Лоаф",
            "poster_url": "https://www.themoviedb.org/t/p/w600_and_h900_bestv2/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg",
            "trailer_url": "https://www.youtube.com/watch?v=SUXWAEX2jlg",
            "imdb_rating": Decimal("8.8"),
            "kinopoisk_rating": Decimal("8.6"),
        },
        {
            "title": "Один дома",
            "original_title": "Home Alone",
            "description": "Когда семья восьмилетнего Кевина улетает на рождественские каникулы в Париж, забыв мальчика дома, он должен защищать дом от грабителей.",
            "genre": "Комедия, Семейный",
            "age_rating": "6+",
            "duration_minutes": 103,
            "release_year": 1990,
            "country": "США",
            "director": "Крис Коламбус",
            "actors": "Маколей Калкин, Джо Пеши, Дэниэл Стерн, Джон Хёрд",
            "poster_url": "https://www.themoviedb.org/t/p/w600_and_h900_bestv2/onTSipZ8R3bliBdKfPtsDuHTdlL.jpg",
            "trailer_url": "https://www.youtube.com/watch?v=jEDaVHmw7r4",
            "imdb_rating": Decimal("7.7"),
            "kinopoisk_rating": Decimal("8.3"),
        },
    ]

    films = []
    for film_data in films_data:
        film = Film(**film_data)
        db.add(film)
        films.append(film)

    await db.flush()
    print(f"   Created {len(films)} films")
    return films


async def create_distributors(db: AsyncSession):
    """Create distributors"""
    print("\n5. Creating distributors...")

    distributors_data = [
        {
            "name": "Universal Pictures",
            "inn": "7701234567",
            "contact_person": "Иванов Иван Иванович",
            "email": "universal@distribution.ru",
            "phone": "+7 (495) 111-22-33",
            "bank_details": "р/с 40702810400000123456 в ПАО Сбербанк, к/с 30101810400000000225, БИК 044525225",
            "status": DistributorStatus.ACTIVE,
        },
        {
            "name": "Warner Bros. Pictures",
            "inn": "7702345678",
            "contact_person": "Петрова Мария Сергеевна",
            "email": "warnerbros@distribution.ru",
            "phone": "+7 (495) 222-33-44",
            "bank_details": "р/с 40702810500000234567 в ПАО ВТБ, к/с 30101810700000000187, БИК 044525187",
            "status": DistributorStatus.ACTIVE,
        },
        {
            "name": "Walt Disney Pictures",
            "inn": "7703456789",
            "contact_person": "Сидоров Петр Александрович",
            "email": "disney@distribution.ru",
            "phone": "+7 (495) 333-44-55",
            "bank_details": "р/с 40702810600000345678 в АО Альфа-Банк, к/с 30101810200000000593, БИК 044525593",
            "status": DistributorStatus.ACTIVE,
        },
    ]

    distributors = []
    for distributor_data in distributors_data:
        distributor = Distributor(**distributor_data)
        db.add(distributor)
        distributors.append(distributor)

    await db.flush()
    print(f"   Created {len(distributors)} distributors")
    return distributors


async def create_rental_contracts(db: AsyncSession, films: list, distributors: list, cinemas: list):
    """Create rental contracts"""
    print("\n6. Creating rental contracts...")

    contracts = []
    contract_num = 1

    # Create contract for each film with random distributor and cinema
    for film in films:
        distributor = random.choice(distributors)
        cinema = random.choice(cinemas)

        start_date = date.today() - timedelta(days=random.randint(0, 30))
        end_date = start_date + timedelta(days=random.randint(30, 90))

        contract = RentalContract(
            film_id=film.id,
            distributor_id=distributor.id,
            cinema_id=cinema.id,
            contract_number=f"RC-2024-{contract_num:04d}",
            contract_date=start_date - timedelta(days=7),
            rental_start_date=start_date,
            rental_end_date=end_date,
            min_screening_period_days=21,
            min_sessions_per_day=2,
            distributor_percentage_week1=Decimal("80.00"),
            distributor_percentage_week2=Decimal("70.00"),
            distributor_percentage_week3=Decimal("60.00"),
            distributor_percentage_after=Decimal("50.00"),
            guaranteed_minimum_amount=Decimal(str(random.randint(100000, 500000))),
            cinema_operational_costs=Decimal("50000.00"),
            status=ContractStatus.ACTIVE,
        )
        db.add(contract)
        contracts.append(contract)
        contract_num += 1

    await db.flush()
    print(f"   Created {len(contracts)} rental contracts")
    return contracts


async def create_users(db: AsyncSession, roles: list, cinemas: list):
    """Create test users"""
    print("\n7. Creating users...")

    # Find role IDs
    admin_role = next(r for r in roles if r.name == "admin")
    manager_role = next(r for r in roles if r.name == "manager")
    user_role = next(r for r in roles if r.name == "user")

    users_data = [
        {
            "email": "admin@cinema.ru",
            "password": "admin123",
            "first_name": "Администратор",
            "last_name": "Системы",
            "phone": "+7 (999) 001-00-01",
            "birth_date": date(1985, 5, 15),
            "gender": Gender.MALE,
            "city": "Москва",
            "position": "Системный администратор",
            "role_id": admin_role.id,
            "cinema_id": cinemas[0].id,
            "employment_date": date(2015, 1, 10),
        },
        {
            "email": "manager@cinema.ru",
            "password": "manager123",
            "first_name": "Менеджер",
            "last_name": "Залов",
            "phone": "+7 (999) 002-00-02",
            "birth_date": date(1990, 8, 20),
            "gender": Gender.FEMALE,
            "city": "Москва",
            "position": "Менеджер",
            "role_id": manager_role.id,
            "cinema_id": cinemas[0].id,
            "employment_date": date(2018, 3, 15),
        },
        {
            "email": "user@example.com",
            "password": "user123",
            "first_name": "Пользователь",
            "last_name": "Тестовый",
            "phone": "+7 (999) 100-00-01",
            "birth_date": date(1995, 3, 25),
            "gender": Gender.MALE,
            "city": "Москва",
            "role_id": user_role.id,
        },
        {
            "email": "ivan@example.com",
            "password": "user123",
            "first_name": "Иван",
            "last_name": "Иванов",
            "phone": "+7 (999) 100-00-02",
            "birth_date": date(1992, 7, 10),
            "gender": Gender.MALE,
            "city": "Санкт-Петербург",
            "role_id": user_role.id,
        },
        {
            "email": "maria@example.com",
            "password": "user123",
            "first_name": "Мария",
            "last_name": "Петрова",
            "phone": "+7 (999) 100-00-03",
            "birth_date": date(1998, 12, 5),
            "gender": Gender.FEMALE,
            "city": "Москва",
            "role_id": user_role.id,
        },
        {
            "email": "alexey@example.com",
            "password": "user123",
            "first_name": "Алексей",
            "last_name": "Сидоров",
            "phone": "+7 (999) 100-00-04",
            "birth_date": date(1988, 4, 18),
            "gender": Gender.MALE,
            "city": "Казань",
            "role_id": user_role.id,
        },
        {
            "email": "elena@example.com",
            "password": "user123",
            "first_name": "Елена",
            "last_name": "Смирнова",
            "phone": "+7 (999) 100-00-05",
            "birth_date": date(2000, 9, 22),
            "gender": Gender.FEMALE,
            "city": "Москва",
            "role_id": user_role.id,
        },
        {
            "email": "dmitry@example.com",
            "password": "user123",
            "first_name": "Дмитрий",
            "last_name": "Козлов",
            "phone": "+7 (999) 100-00-06",
            "birth_date": date(1993, 11, 30),
            "gender": Gender.MALE,
            "city": "Санкт-Петербург",
            "role_id": user_role.id,
        },
    ]

    users = []
    for user_data in users_data:
        password = user_data.pop("password")
        user = User(
            **user_data,
            password_hash=get_password_hash(password),
            registration_date=datetime.now() - timedelta(days=random.randint(30, 365)),
            status=UserStatus.ACTIVE,
            marketing_consent=random.choice([True, False]),
            data_processing_consent=True,
        )
        db.add(user)
        users.append(user)

    await db.flush()
    print(f"   Created {len(users)} users")
    return users


async def create_bonus_accounts(db: AsyncSession, users: list):
    """Create bonus accounts for users"""
    print("\n8. Creating bonus accounts...")

    bonus_accounts = []
    for user in users:
        initial_balance = random.randint(100, 500)
        bonus_account = BonusAccount(
            user_id=user.id,
            balance=initial_balance,
            last_accrual_date=date.today() - timedelta(days=random.randint(1, 30)),
        )
        db.add(bonus_account)
        bonus_accounts.append(bonus_account)

    await db.flush()
    print(f"   Created {len(bonus_accounts)} bonus accounts")
    return bonus_accounts


async def create_sessions(db: AsyncSession, films: list, halls: list):
    """Create movie sessions"""
    print("\n9. Creating sessions...")

    sessions = []
    session_times = [
        (time(10, 0), time(12, 30)),
        (time(13, 0), time(15, 30)),
        (time(16, 0), time(18, 30)),
        (time(19, 0), time(21, 30)),
        (time(22, 0), time(0, 30)),
    ]

    # Create sessions for next 7 days
    for day_offset in range(7):
        session_date = date.today() + timedelta(days=day_offset)

        # For each hall, create 3-5 sessions
        for hall in halls:
            # Select random films for this hall today
            daily_films = random.sample(films, min(len(session_times), len(films)))

            for i, film in enumerate(daily_films):
                if i >= len(session_times):
                    break

                start, end = session_times[i]

                # Price varies by time and hall type
                base_price = 400
                if hall.hall_type == HallType.VIP:
                    base_price = 700
                elif hall.hall_type == HallType.IMAX:
                    base_price = 600

                # Evening sessions are more expensive
                if start.hour >= 18:
                    base_price += 100

                # Weekend premium
                if session_date.weekday() >= 5:  # Saturday or Sunday
                    base_price += 100

                session = Session(
                    film_id=film.id,
                    hall_id=hall.id,
                    session_date=session_date,
                    start_time=start,
                    end_time=end,
                    ticket_price=Decimal(str(base_price)),
                    status=SessionStatus.SCHEDULED,
                )
                db.add(session)
                sessions.append(session)

    await db.flush()
    print(f"   Created {len(sessions)} sessions")
    return sessions


async def create_promocodes(db: AsyncSession):
    """Create promocodes"""
    print("\n10. Creating promocodes...")

    promocodes_data = [
        {
            "code": "WELCOME10",
            "description": "Скидка 10% на первый заказ для новых пользователей",
            "discount_type": DiscountType.PERCENTAGE,
            "discount_value": Decimal("10.00"),
            "valid_from": date.today() - timedelta(days=30),
            "valid_until": date.today() + timedelta(days=60),
            "max_uses": 100,
            "used_count": 15,
            "min_order_amount": Decimal("500.00"),
            "applicable_category": "tickets",
            "status": PromocodeStatus.ACTIVE,
        },
        {
            "code": "NEWYEAR2024",
            "description": "Новогодняя скидка 500 рублей на заказ",
            "discount_type": DiscountType.FIXED_AMOUNT,
            "discount_value": Decimal("500.00"),
            "valid_from": date.today() - timedelta(days=10),
            "valid_until": date.today() + timedelta(days=20),
            "max_uses": 200,
            "used_count": 45,
            "min_order_amount": Decimal("1000.00"),
            "status": PromocodeStatus.ACTIVE,
        },
        {
            "code": "BIRTHDAY20",
            "description": "Скидка 20% в день рождения",
            "discount_type": DiscountType.PERCENTAGE,
            "discount_value": Decimal("20.00"),
            "valid_from": date.today() - timedelta(days=180),
            "valid_until": date.today() + timedelta(days=180),
            "max_uses": 500,
            "used_count": 78,
            "min_order_amount": Decimal("300.00"),
            "status": PromocodeStatus.ACTIVE,
        },
        {
            "code": "EXPIRED",
            "description": "Истекший промокод",
            "discount_type": DiscountType.PERCENTAGE,
            "discount_value": Decimal("15.00"),
            "valid_from": date.today() - timedelta(days=90),
            "valid_until": date.today() - timedelta(days=1),
            "max_uses": 50,
            "used_count": 30,
            "status": PromocodeStatus.EXPIRED,
        },
        {
            "code": "MAXUSED",
            "description": "Исчерпанный промокод",
            "discount_type": DiscountType.FIXED_AMOUNT,
            "discount_value": Decimal("300.00"),
            "valid_from": date.today() - timedelta(days=60),
            "valid_until": date.today() + timedelta(days=30),
            "max_uses": 20,
            "used_count": 20,
            "status": PromocodeStatus.DEPLETED,
        },
        {
            "code": "WEEKEND15",
            "description": "Скидка 15% на выходных",
            "discount_type": DiscountType.PERCENTAGE,
            "discount_value": Decimal("15.00"),
            "valid_from": date.today(),
            "valid_until": date.today() + timedelta(days=90),
            "max_uses": 300,
            "used_count": 67,
            "min_order_amount": Decimal("600.00"),
            "status": PromocodeStatus.ACTIVE,
        },
        {
            "code": "STUDENT",
            "description": "Студенческая скидка 200 рублей",
            "discount_type": DiscountType.FIXED_AMOUNT,
            "discount_value": Decimal("200.00"),
            "valid_from": date.today() - timedelta(days=365),
            "valid_until": date.today() + timedelta(days=365),
            "max_uses": 1000,
            "used_count": 234,
            "min_order_amount": Decimal("400.00"),
            "status": PromocodeStatus.ACTIVE,
        },
    ]

    promocodes = []
    for promo_data in promocodes_data:
        promocode = Promocode(**promo_data)
        db.add(promocode)
        promocodes.append(promocode)

    await db.flush()
    print(f"   Created {len(promocodes)} promocodes")
    return promocodes


async def create_concession_items(db: AsyncSession, cinemas: list):
    """Create concession items"""
    print("\n11. Creating concession items...")

    items_template = [
        {"name": "Попкорн маленький", "description": "Классический попкорн", "price": "150.00", "portion_size": "0.5L", "calories": 250},
        {"name": "Попкорн средний", "description": "Классический попкорн", "price": "250.00", "portion_size": "1L", "calories": 450},
        {"name": "Попкорн большой", "description": "Классический попкорн", "price": "350.00", "portion_size": "2L", "calories": 800},
        {"name": "Coca-Cola 0.5л", "description": "Прохладительный напиток", "price": "120.00", "portion_size": "0.5L", "calories": 210},
        {"name": "Coca-Cola 1л", "description": "Прохладительный напиток", "price": "180.00", "portion_size": "1L", "calories": 420},
        {"name": "Sprite 0.5л", "description": "Лимонад", "price": "120.00", "portion_size": "0.5L", "calories": 200},
        {"name": "Sprite 1л", "description": "Лимонад", "price": "180.00", "portion_size": "1L", "calories": 400},
        {"name": "Fanta 0.5л", "description": "Апельсиновый напиток", "price": "120.00", "portion_size": "0.5L", "calories": 220},
        {"name": "Fanta 1л", "description": "Апельсиновый напиток", "price": "180.00", "portion_size": "1L", "calories": 440},
        {"name": "Хот-дог", "description": "Сосиска в булочке", "price": "200.00", "portion_size": "1шт", "calories": 350},
        {"name": "Начос с сыром", "description": "Кукурузные чипсы с сырным соусом", "price": "300.00", "portion_size": "200г", "calories": 550},
        {"name": "M&M's", "description": "Шоколадное драже", "price": "150.00", "portion_size": "90г", "calories": 450},
        {"name": "Skittles", "description": "Жевательные конфеты", "price": "150.00", "portion_size": "95г", "calories": 380},
        {"name": "Вода негазированная", "description": "Питьевая вода", "price": "80.00", "portion_size": "0.5L", "calories": 0},
        {"name": "Вода газированная", "description": "Газированная вода", "price": "80.00", "portion_size": "0.5L", "calories": 0},
        {"name": "Сэндвич с курицей", "description": "Свежий сэндвич", "price": "250.00", "portion_size": "1шт", "calories": 420},
        {"name": "Картофель фри", "description": "Жареный картофель", "price": "180.00", "portion_size": "150г", "calories": 380},
        {"name": "Кофе американо", "description": "Черный кофе", "price": "150.00", "portion_size": "0.3L", "calories": 5},
        {"name": "Капучино", "description": "Кофе с молоком", "price": "200.00", "portion_size": "0.3L", "calories": 120},
    ]

    items = []
    for cinema in cinemas:
        for item_template in items_template:
            item = ConcessionItem(
                cinema_id=cinema.id,
                name=item_template["name"],
                description=item_template["description"],
                price=Decimal(item_template["price"]),
                portion_size=item_template["portion_size"],
                calories=item_template["calories"],
                stock_quantity=random.randint(50, 200),
                status=ConcessionItemStatus.AVAILABLE,
            )
            db.add(item)
            items.append(item)

    await db.flush()
    print(f"   Created {len(items)} concession items")
    return items


async def create_orders_and_tickets(db: AsyncSession, users: list, sessions: list, promocodes: list, concession_items: list):
    """Create test orders with tickets"""
    print("\n12. Creating orders and tickets...")

    # Filter only regular users (not admin/manager)
    regular_users = [u for u in users if u.email not in ["admin@cinema.ru", "manager@cinema.ru"]]

    orders = []
    tickets = []
    payments = []
    concession_preorders = []
    bonus_transactions = []
    order_num = 1

    # Create 10-15 completed orders
    for _ in range(random.randint(10, 15)):
        user = random.choice(regular_users)

        # Pick 1-3 sessions
        user_sessions = random.sample(sessions, random.randint(1, 3))

        # Use promocode sometimes
        use_promo = random.random() < 0.3
        promocode = random.choice([p for p in promocodes if p.status == PromocodeStatus.ACTIVE]) if use_promo else None

        created_at = datetime.now() - timedelta(days=random.randint(0, 7), hours=random.randint(0, 23))

        # Create order
        order = Order(
            user_id=user.id,
            promocode_id=promocode.id if promocode else None,
            order_number=f"ORD-{datetime.now().year}-{order_num:06d}",
            created_at=created_at,
            total_amount=Decimal("0.00"),
            discount_amount=Decimal("0.00"),
            final_amount=Decimal("0.00"),
            status=OrderStatus.PAID,
        )
        db.add(order)
        await db.flush()

        total_amount = Decimal("0.00")

        # Create tickets for each session
        for session in user_sessions:
            # Get available seats for this session
            result = await db.execute(
                select(Seat).where(
                    Seat.hall_id == session.hall_id,
                    Seat.is_available == True
                )
            )
            available_seats = result.scalars().all()

            if not available_seats:
                continue

            # Book 1-2 seats
            num_seats = random.randint(1, min(2, len(available_seats)))
            booked_seats = random.sample(available_seats, num_seats)

            for seat in booked_seats:
                ticket = Ticket(
                    session_id=session.id,
                    seat_id=seat.id,
                    buyer_id=user.id,
                    order_id=order.id,
                    seller_id=None,  # Online purchase
                    price=session.ticket_price,
                    purchase_date=created_at,
                    sales_channel=SalesChannel.ONLINE,
                    status=TicketStatus.PAID,
                )
                db.add(ticket)
                await db.flush()

                # Generate QR code
                ticket.qr_code = generate_ticket_qr(ticket.id, session.id, seat.id)

                tickets.append(ticket)
                total_amount += session.ticket_price

        # Add some concession items (30% chance)
        if random.random() < 0.3:
            # Get items from the same city as the first session's cinema
            session_cinema_id = user_sessions[0].hall.cinema_id
            cinema_items = [item for item in concession_items if item.cinema_id == session_cinema_id]

            if cinema_items:
                num_items = random.randint(1, 3)
                for _ in range(num_items):
                    item = random.choice(cinema_items)
                    quantity = random.randint(1, 2)

                    preorder = ConcessionPreorder(
                        order_id=order.id,
                        concession_item_id=item.id,
                        quantity=quantity,
                        unit_price=item.price,
                        total_price=item.price * quantity,
                        status=PreorderStatus.COMPLETED,
                    )
                    db.add(preorder)
                    concession_preorders.append(preorder)
                    total_amount += preorder.total_price

        # Calculate discount
        discount_amount = Decimal("0.00")
        if promocode:
            if promocode.discount_type == DiscountType.PERCENTAGE:
                discount_amount = total_amount * (promocode.discount_value / 100)
            else:
                discount_amount = min(promocode.discount_value, total_amount)

        final_amount = total_amount - discount_amount

        # Update order amounts
        order.total_amount = total_amount
        order.discount_amount = discount_amount
        order.final_amount = final_amount

        # Create payment
        payment = Payment(
            order_id=order.id,
            amount=final_amount,
            payment_method=random.choice([PaymentMethod.CARD, PaymentMethod.MOBILE_PAYMENT]),
            payment_date=created_at,
            status=PaymentStatus.PAID,
            transaction_id=f"TXN-{random.randint(1000000, 9999999)}",
        )
        db.add(payment)
        payments.append(payment)

        # Add bonus points (10% of final amount)
        bonus_points = int(final_amount * Decimal("0.1"))
        if bonus_points > 0:
            # Find user's bonus account
            result = await db.execute(
                select(BonusAccount).where(BonusAccount.user_id == user.id)
            )
            bonus_account = result.scalar_one_or_none()

            if bonus_account:
                # Update balance
                bonus_account.balance += bonus_points
                bonus_account.last_accrual_date = created_at.date()

                # Create transaction for first ticket only (simplified)
                if tickets:
                    bonus_transaction = BonusTransaction(
                        bonus_account_id=bonus_account.id,
                        ticket_id=tickets[0].id,
                        transaction_type=BonusTransactionType.ACCRUAL,
                        amount=bonus_points,
                        transaction_date=created_at,
                        description=f"Начисление за заказ {order.order_number}",
                    )
                    db.add(bonus_transaction)
                    bonus_transactions.append(bonus_transaction)

        orders.append(order)
        order_num += 1

    await db.flush()
    print(f"   Created {len(orders)} orders")
    print(f"   Created {len(tickets)} tickets")
    print(f"   Created {len(payments)} payments")
    print(f"   Created {len(concession_preorders)} concession preorders")
    print(f"   Created {len(bonus_transactions)} bonus transactions")

    return orders, tickets, payments


async def seed_all():
    """Main seed function"""
    print("=" * 60)
    print("CINEMA MANAGEMENT SYSTEM - DATABASE SEED")
    print("=" * 60)

    async with AsyncSessionLocal() as db:
        try:
            # Optional: Clear existing data (commented out for safety)
            # await clear_database(db)

            # Create all data
            roles = await create_roles(db)
            cinemas = await create_cinemas(db)
            halls, seats = await create_halls_and_seats(db, cinemas)
            films = await create_films(db)
            distributors = await create_distributors(db)
            contracts = await create_rental_contracts(db, films, distributors, cinemas)
            users = await create_users(db, roles, cinemas)
            bonus_accounts = await create_bonus_accounts(db, users)
            sessions = await create_sessions(db, films, halls)
            promocodes = await create_promocodes(db)
            concession_items = await create_concession_items(db, cinemas)
            orders, tickets, payments = await create_orders_and_tickets(
                db, users, sessions, promocodes, concession_items
            )

            await db.commit()

            print("\n" + "=" * 60)
            print("SEED COMPLETED SUCCESSFULLY!")
            print("=" * 60)
            print("\nDatabase Statistics:")
            print(f"  - Roles: {len(roles)}")
            print(f"  - Cinemas: {len(cinemas)}")
            print(f"  - Halls: {len(halls)}")
            print(f"  - Seats: {len(seats)}")
            print(f"  - Films: {len(films)}")
            print(f"  - Distributors: {len(distributors)}")
            print(f"  - Rental Contracts: {len(contracts)}")
            print(f"  - Users: {len(users)}")
            print(f"  - Bonus Accounts: {len(bonus_accounts)}")
            print(f"  - Sessions: {len(sessions)}")
            print(f"  - Promocodes: {len(promocodes)}")
            print(f"  - Concession Items: {len(concession_items)}")
            print(f"  - Orders: {len(orders)}")
            print(f"  - Tickets: {len(tickets)}")
            print(f"  - Payments: {len(payments)}")

            print("\n" + "=" * 60)
            print("TEST CREDENTIALS:")
            print("=" * 60)
            print("\nAdministrator:")
            print("  Email: admin@cinema.ru")
            print("  Password: admin123")
            print("\nManager:")
            print("  Email: manager@cinema.ru")
            print("  Password: manager123")
            print("\nRegular Users (all with password 'user123'):")
            print("  - user@example.com")
            print("  - ivan@example.com")
            print("  - maria@example.com")
            print("  - alexey@example.com")
            print("  - elena@example.com")
            print("  - dmitry@example.com")

            print("\n" + "=" * 60)
            print("Active Promocodes:")
            print("=" * 60)
            active_promos = [p for p in promocodes if p.status == PromocodeStatus.ACTIVE]
            for promo in active_promos:
                print(f"  - {promo.code}: {promo.description}")

            print("\n" + "=" * 60)

        except Exception as e:
            await db.rollback()
            print(f"\nERROR: Failed to seed database: {e}")
            import traceback
            traceback.print_exc()
            raise


if __name__ == "__main__":
    asyncio.run(seed_all())
