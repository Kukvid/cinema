from sqlalchemy import Column, Integer, Date, ForeignKey, CheckConstraint
from sqlalchemy.orm import relationship
from . import Base


class BonusAccount(Base):
    __tablename__ = "bonus_accounts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)

    balance = Column(Integer, default=0, nullable=False)
    last_accrual_date = Column(Date)

    # Relationships
    user = relationship("User", back_populates="bonus_account")
    transactions = relationship("BonusTransaction", back_populates="bonus_account", cascade="all, delete-orphan")

    # Constraints
    __table_args__ = (
        CheckConstraint("balance >= 0", name="check_bonus_balance_non_negative"),
    )
