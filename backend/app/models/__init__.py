from sqlalchemy.orm import declarative_base

Base = declarative_base()

# Import all models for Alembic
from .cinema import Cinema
from .hall import Hall
from .seat import Seat
from .film import Film
from .distributor import Distributor
from .rental_contract import RentalContract
from .payment_history import PaymentHistory
from .session import Session
from .ticket import Ticket
from .user import User
from .role import Role
from .bonus_account import BonusAccount
from .bonus_transaction import BonusTransaction
from .promocode import Promocode
from .order import Order
from .payment import Payment
from .concession_item import ConcessionItem
from .concession_preorder import ConcessionPreorder
from .report import Report

__all__ = [
    "Base",
    "Cinema",
    "Hall",
    "Seat",
    "Film",
    "Distributor",
    "RentalContract",
    "PaymentHistory",
    "Session",
    "Ticket",
    "User",
    "Role",
    "BonusAccount",
    "BonusTransaction",
    "Promocode",
    "Order",
    "Payment",
    "ConcessionItem",
    "ConcessionPreorder",
    "Report",
]
