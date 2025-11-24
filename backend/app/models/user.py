from sqlalchemy import Column, Integer, String, Date, DateTime, Boolean, ForeignKey, Enum as SQLEnum, Index
from sqlalchemy.orm import relationship
from .enums import UserStatus, Gender
from . import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    role_id = Column(Integer, ForeignKey("roles.id", ondelete="SET NULL"))
    cinema_id = Column(Integer, ForeignKey("cinemas.id", ondelete="SET NULL"))

    email = Column(String(100), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    first_name = Column(String(100))
    last_name = Column(String(100))
    phone = Column(String(20))
    birth_date = Column(Date)
    gender = Column(SQLEnum(Gender))
    city = Column(String(100))
    position = Column(String(100))
    registration_date = Column(DateTime, nullable=False)
    employment_date = Column(Date)
    last_login = Column(DateTime)
    status = Column(SQLEnum(UserStatus), default=UserStatus.ACTIVE, nullable=False)
    marketing_consent = Column(Boolean, default=False)
    data_processing_consent = Column(Boolean, default=True, nullable=False)
    preferred_language = Column(String(10), default="ru")

    # Relationships
    role = relationship("Role", back_populates="users")
    cinema = relationship("Cinema", back_populates="users")
    bonus_account = relationship("BonusAccount", back_populates="user", uselist=False, cascade="all, delete-orphan")
    orders = relationship("Order", back_populates="user", foreign_keys="Order.user_id")
    purchased_tickets = relationship("Ticket", back_populates="buyer", foreign_keys="Ticket.buyer_id")
    sold_tickets = relationship("Ticket", back_populates="seller", foreign_keys="Ticket.seller_id")
    reports = relationship("Report", back_populates="user")

    # Indexes
    __table_args__ = (
        Index("idx_user_email_status", "email", "status"),
        Index("idx_user_role", "role_id"),
        Index("idx_user_cinema", "cinema_id"),
    )
