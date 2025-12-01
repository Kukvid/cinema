from sqlalchemy import Column, Integer, DateTime, ForeignKey, Enum as SQLEnum, Index
from sqlalchemy.orm import relationship
from .enums import BonusTransactionType
from . import Base


class BonusTransaction(Base):
    __tablename__ = "bonus_transactions"

    id = Column(Integer, primary_key=True, index=True)
    bonus_account_id = Column(Integer, ForeignKey("bonus_accounts.id", ondelete="CASCADE"), nullable=False)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="SET NULL"))

    transaction_type = Column(SQLEnum(BonusTransactionType), nullable=False)
    amount = Column(Integer, nullable=False)
    transaction_date = Column(DateTime, nullable=False)

    # Relationships
    bonus_account = relationship("BonusAccount", back_populates="transactions")
    order = relationship("Order", back_populates="bonus_transactions")

    # Indexes
    __table_args__ = (
        Index("idx_bonus_transaction_account", "bonus_account_id"),
        Index("idx_bonus_transaction_date", "transaction_date"),
    )
