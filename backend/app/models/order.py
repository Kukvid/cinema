from sqlalchemy import Column, Integer, String, DateTime, DECIMAL, ForeignKey, Enum as SQLEnum, Index, CheckConstraint
from sqlalchemy.orm import relationship
from .enums import OrderStatus
from . import Base


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    promocode_id = Column(Integer, ForeignKey("promocodes.id", ondelete="SET NULL"))

    order_number = Column(String(50), unique=True, nullable=False, index=True)
    created_at = Column(DateTime, nullable=False)
    total_amount = Column(DECIMAL(12, 2), nullable=False)
    discount_amount = Column(DECIMAL(8, 2), default=0.00)
    final_amount = Column(DECIMAL(12, 2), nullable=False)
    status = Column(SQLEnum(OrderStatus), default=OrderStatus.CREATED, nullable=False)

    # Relationships
    user = relationship("User", back_populates="orders", foreign_keys=[user_id])
    promocode = relationship("Promocode", back_populates="orders")
    tickets = relationship("Ticket", back_populates="order")
    payment = relationship("Payment", back_populates="order", uselist=False, cascade="all, delete-orphan")
    concession_preorders = relationship("ConcessionPreorder", back_populates="order", cascade="all, delete-orphan")

    # Constraints
    __table_args__ = (
        Index("idx_order_user", "user_id"),
        Index("idx_order_created_at", "created_at"),
        Index("idx_order_status", "status"),
        CheckConstraint("total_amount >= 0", name="check_total_amount_non_negative"),
        CheckConstraint("discount_amount >= 0", name="check_discount_amount_non_negative"),
        CheckConstraint("final_amount >= 0", name="check_final_amount_non_negative"),
    )
