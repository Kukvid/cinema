from sqlalchemy import Column, Integer, String, Text, Date, DECIMAL, Enum as SQLEnum, CheckConstraint
from sqlalchemy.orm import relationship
from .enums import PromocodeStatus, DiscountType
from . import Base


class Promocode(Base):
    __tablename__ = "promocodes"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, nullable=False, index=True)
    description = Column(Text)
    discount_type = Column(SQLEnum(DiscountType), nullable=False)
    discount_value = Column(DECIMAL(8, 2), nullable=False)
    valid_from = Column(Date, nullable=False)
    valid_until = Column(Date, nullable=False)
    max_uses = Column(Integer)
    used_count = Column(Integer, default=0, nullable=False)
    min_order_amount = Column(DECIMAL(8, 2), default=0.00)
    applicable_category = Column(String(100))
    status = Column(SQLEnum(PromocodeStatus), default=PromocodeStatus.ACTIVE, nullable=False)

    # Relationships
    orders = relationship("Order", back_populates="promocode")

    # Constraints
    __table_args__ = (
        CheckConstraint("discount_value >= 0", name="check_discount_value_non_negative"),
        CheckConstraint("valid_until >= valid_from", name="check_promocode_dates_valid"),
        CheckConstraint("used_count >= 0", name="check_used_count_non_negative"),
        CheckConstraint("min_order_amount >= 0", name="check_min_order_amount_non_negative"),
    )
