from datetime import datetime
from typing import Optional
from fastapi import FastAPI
from sqladmin import Admin, ModelView
from sqladmin.authentication import AuthenticationBackend
from starlette.requests import Request
from starlette.responses import RedirectResponse
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession

from app.config import get_settings
from app.models.user import User
from app.models.film import Film
from app.models.session import Session
from app.models.hall import Hall
from app.models.cinema import Cinema
from app.models.ticket import Ticket
from app.models.order import Order
from app.models.role import Role
from app.models.genre import Genre
from app.models.distributor import Distributor
from app.models.concession_item import ConcessionItem
from app.models.concession_category import ConcessionCategory
from app.models.promocode import Promocode
from app.models.bonus_account import BonusAccount
from app.models.bonus_transaction import BonusTransaction
from app.models.seat import Seat
from app.models.payment import Payment
from app.models.payment_history import PaymentHistory
from app.models.concession_preorder import ConcessionPreorder
from app.models.enums import UserStatus, PaymentStatus, OrderStatus, TicketStatus, PreorderStatus, ConcessionItemStatus


class AdminAuthBackend(AuthenticationBackend):
    async def login(self, request: Request) -> bool:
        form = await request.form()
        email, password = form.get("username"), form.get("password")

        from app.database import get_db
        from app.models.user import User
        from app.utils.security import verify_password
        
        # Get database session
        async with get_db() as db:
            # Find user by email
            from sqlalchemy import select
            result = await db.execute(select(User).filter(User.email == email))
            user = result.scalar_one_or_none()

            if user and verify_password(password, user.password_hash):
                # Check if user is admin
                if user.role and user.role.name == "admin" or user.role.name == "super_admin" or user.role.name == "staff":
                    # Store user in session
                    request.session.update({"user_id": user.id, "email": user.email, "role": user.role.name})
                    return True

        return False

    async def logout(self, request: Request) -> bool:
        request.session.clear()
        return True

    async def authenticate(self, request: Request) -> bool:
        user_id = request.session.get("user_id")
        if not user_id:
            return False
        
        # Verify user is still in database and is admin
        from app.database import get_db
        from app.models.user import User
        
        async with get_db() as db:
            from sqlalchemy import select
            result = await db.execute(select(User).filter(User.id == user_id))
            user = result.scalar_one_or_none()

            if user.role and user.role.name == "admin" or user.role.name == "super_admin" or user.role.name == "staff":
                return True
        
        return False


# User Admin
class UserAdmin(ModelView, model=User):
    column_list = [User.id, User.email, User.first_name, User.last_name, User.phone, User.birth_date, 
                   User.status, User.registration_date, User.last_login, User.role]
    column_searchable_list = [User.email, User.first_name, User.last_name, User.phone]
    column_sortable_list = [User.id, User.email, User.first_name, User.last_name, User.registration_date, User.last_login]
    column_details_exclude_list = [User.password_hash]
    can_view_details = True
    name = "Пользователь"
    name_plural = "Пользователи"


# Cinema Admin
class CinemaAdmin(ModelView, model=Cinema):
    column_list = [Cinema.id, Cinema.name, Cinema.address, Cinema.city, Cinema.status, Cinema.opening_date]
    column_searchable_list = [Cinema.name, Cinema.address, Cinema.city]
    column_sortable_list = [Cinema.id, Cinema.name, Cinema.city]
    can_view_details = True
    name = "Кинотеатр"
    name_plural = "Кинотеатры"


# Hall Admin
class HallAdmin(ModelView, model=Hall):
    column_list = [Hall.id, Hall.cinema, Hall.name, Hall.hall_type, Hall.capacity, Hall.status]
    column_searchable_list = [Hall.name]
    column_sortable_list = [Hall.id, Hall.name, Hall.capacity]
    can_view_details = True
    name = "Зал"
    name_plural = "Залы"


# Film Admin
class FilmAdmin(ModelView, model=Film):
    column_list = [Film.id, Film.title, Film.original_title, Film.duration_minutes, Film.release_date, Film.age_rating]
    column_searchable_list = [Film.title, Film.original_title, Film.description]
    column_sortable_list = [Film.id, Film.title, Film.release_date, Film.duration_minutes]
    can_view_details = True
    name = "Фильм"
    name_plural = "Фильмы"


# Genre Admin
class GenreAdmin(ModelView, model=Genre):
    column_list = [Genre.id, Genre.name]
    column_searchable_list = [Genre.name]
    column_sortable_list = [Genre.id, Genre.name]
    can_view_details = True
    name = "Жанр"
    name_plural = "Жанры"


# Distributor Admin
class DistributorAdmin(ModelView, model=Distributor):
    column_list = [Distributor.id, Distributor.name, Distributor.contact_person, Distributor.email, Distributor.status]
    column_searchable_list = [Distributor.name, Distributor.contact_person, Distributor.email]
    column_sortable_list = [Distributor.id, Distributor.name]
    can_view_details = True
    name = "Дистрибьютор"
    name_plural = "Дистрибьюторы"


# Session Admin
class SessionAdmin(ModelView, model=Session):
    column_list = [Session.id, Session.film, Session.hall, Session.start_datetime, Session.end_datetime, Session.status]
    column_searchable_list = []
    column_sortable_list = [Session.id, Session.start_datetime]
    can_view_details = True
    name = "Сеанс"
    name_plural = "Сеансы"


# Ticket Admin
class TicketAdmin(ModelView, model=Ticket):
    column_list = [Ticket.id, Ticket.session, Ticket.seat, Ticket.buyer, Ticket.order, Ticket.price, Ticket.status]
    column_searchable_list = []
    column_sortable_list = [Ticket.id, Ticket.price, Ticket.purchase_date]
    can_view_details = True
    name = "Билет"
    name_plural = "Билеты"


# Order Admin
class OrderAdmin(ModelView, model=Order):
    column_list = [Order.id, Order.user, Order.order_number, Order.created_at, Order.total_amount, Order.status]
    column_searchable_list = [Order.order_number]
    column_sortable_list = [Order.id, Order.created_at, Order.total_amount]
    can_view_details = True
    name = "Заказ"
    name_plural = "Заказы"


# Role Admin
class RoleAdmin(ModelView, model=Role):
    column_list = [Role.id, Role.name]
    column_searchable_list = [Role.name]
    column_sortable_list = [Role.id, Role.name]
    can_view_details = True
    name = "Роль"
    name_plural = "Роли"


# Concession Category Admin
class ConcessionCategoryAdmin(ModelView, model=ConcessionCategory):
    column_list = [ConcessionCategory.id, ConcessionCategory.name, ConcessionCategory.description]
    column_searchable_list = [ConcessionCategory.name]
    column_sortable_list = [ConcessionCategory.id, ConcessionCategory.name]
    can_view_details = True
    name = "Категория товаров"
    name_plural = "Категории товаров"


# Concession Item Admin
class ConcessionItemAdmin(ModelView, model=ConcessionItem):
    column_list = [ConcessionItem.id, ConcessionItem.name, ConcessionItem.price, ConcessionItem.stock_quantity, 
                   ConcessionItem.status, ConcessionItem.category]
    column_searchable_list = [ConcessionItem.name, ConcessionItem.description]
    column_sortable_list = [ConcessionItem.id, ConcessionItem.name, ConcessionItem.price]
    can_view_details = True
    name = "Товар кинобара"
    name_plural = "Товары кинобара"


# Promocode Admin
class PromocodeAdmin(ModelView, model=Promocode):
    column_list = [Promocode.id, Promocode.code, Promocode.discount_type, Promocode.discount_value, 
                   Promocode.status, Promocode.valid_until]
    column_searchable_list = [Promocode.code]
    column_sortable_list = [Promocode.id, Promocode.code, Promocode.valid_until]
    can_view_details = True
    name = "Промокод"
    name_plural = "Промокоды"


# Bonus Account Admin
class BonusAccountAdmin(ModelView, model=BonusAccount):
    column_list = [BonusAccount.id, BonusAccount.user, BonusAccount.balance, BonusAccount.last_updated]
    column_searchable_list = []
    column_sortable_list = [BonusAccount.id, BonusAccount.balance]
    can_view_details = True
    name = "Бонусный счёт"
    name_plural = "Бонусные счёты"


# Bonus Transaction Admin
class BonusTransactionAdmin(ModelView, model=BonusTransaction):
    column_list = [BonusTransaction.id, BonusTransaction.bonus_account, BonusTransaction.order, 
                   BonusTransaction.amount, BonusTransaction.transaction_type, BonusTransaction.transaction_date]
    column_searchable_list = []
    column_sortable_list = [BonusTransaction.id, BonusTransaction.transaction_date, BonusTransaction.amount]
    can_view_details = True
    name = "Бонусная транзакция"
    name_plural = "Бонусные транзакции"


# Seat Admin
class SeatAdmin(ModelView, model=Seat):
    column_list = [Seat.id, Seat.hall, Seat.row_number, Seat.seat_number, Seat.seat_type]
    column_searchable_list = []
    column_sortable_list = [Seat.id, Seat.row_number, Seat.seat_number]
    can_view_details = True
    name = "Место"
    name_plural = "Места"


# Payment Admin
class PaymentAdmin(ModelView, model=Payment):
    column_list = [Payment.id, Payment.order, Payment.amount, Payment.payment_method, Payment.status, Payment.payment_date]
    column_searchable_list = []
    column_sortable_list = [Payment.id, Payment.payment_date, Payment.amount]
    can_view_details = True
    name = "Платёж"
    name_plural = "Платежи"


# Concession Preorder Admin
class ConcessionPreorderAdmin(ModelView, model=ConcessionPreorder):
    column_list = [ConcessionPreorder.id, ConcessionPreorder.order, ConcessionPreorder.concession_item,
                   ConcessionPreorder.quantity, ConcessionPreorder.status]
    column_searchable_list = []
    column_sortable_list = [ConcessionPreorder.id, ConcessionPreorder.quantity]
    can_view_details = True
    name = "Предзаказ кинобара"
    name_plural = "Предзаказы кинобара"


# Payment History Admin
class PaymentHistoryAdmin(ModelView, model=PaymentHistory):
    column_list = [PaymentHistory.id, PaymentHistory.rental_contract, PaymentHistory.calculated_amount,
                   PaymentHistory.calculation_date, PaymentHistory.payment_status, PaymentHistory.payment_date]
    column_searchable_list = []
    column_sortable_list = [PaymentHistory.id, PaymentHistory.calculated_amount, PaymentHistory.calculation_date, PaymentHistory.payment_status]
    can_view_details = True
    name = "История платежей по контрактам"
    name_plural = "История платежей по контрактам"


def setup_admin(app: FastAPI, engine):
    """Setup FastAPI Admin with authentication."""
    authentication_backend = AdminAuthBackend(secret_key=get_settings().SECRET_KEY)
    admin = Admin(app, engine, authentication_backend=authentication_backend)

    # Register model views
    admin.add_view(UserAdmin)
    admin.add_view(CinemaAdmin)
    admin.add_view(HallAdmin)
    admin.add_view(FilmAdmin)
    admin.add_view(GenreAdmin)
    admin.add_view(DistributorAdmin)
    admin.add_view(SessionAdmin)
    admin.add_view(TicketAdmin)
    admin.add_view(OrderAdmin)
    admin.add_view(RoleAdmin)
    admin.add_view(ConcessionCategoryAdmin)
    admin.add_view(ConcessionItemAdmin)
    admin.add_view(PromocodeAdmin)
    admin.add_view(BonusAccountAdmin)
    admin.add_view(BonusTransactionAdmin)
    admin.add_view(SeatAdmin)
    admin.add_view(PaymentAdmin)
    admin.add_view(ConcessionPreorderAdmin)
    admin.add_view(PaymentHistoryAdmin)

    return admin