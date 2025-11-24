from sqlalchemy import Column, Integer, DECIMAL, DateTime, Date, String, ForeignKey, Enum as SQLEnum, Index, CheckConstraint
from sqlalchemy.orm import relationship
from .enums import PaymentStatus, PaymentMethod
from . import Base


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), unique=True, nullable=False)

    amount = Column(DECIMAL(12, 2), nullable=False)
    payment_method = Column(SQLEnum(PaymentMethod), nullable=False)
    payment_date = Column(DateTime, nullable=False)
    status = Column(SQLEnum(PaymentStatus), default=PaymentStatus.PENDING, nullable=False)
    transaction_id = Column(String(200))
    payment_system_fee = Column(DECIMAL(8, 2), default=0.00)
    card_last_four = Column(String(4))
    refund_date = Column(Date)
    refund_amount = Column(DECIMAL(12, 2))

    # Relationships
    order = relationship("Order", back_populates="payment")

    # Constraints
    __table_args__ = (
        Index("idx_payment_order", "order_id"),
        Index("idx_payment_status", "status"),
        Index("idx_payment_date", "payment_date"),
        Index("idx_payment_transaction_id", "transaction_id"),
        CheckConstraint("amount >= 0", name="check_payment_amount_non_negative"),
        CheckConstraint("payment_system_fee >= 0", name="check_payment_fee_non_negative"),
    )
