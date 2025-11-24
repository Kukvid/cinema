from sqlalchemy import Column, Integer, DECIMAL, DateTime, String, ForeignKey, Enum as SQLEnum, Index, CheckConstraint
from sqlalchemy.orm import relationship
from .enums import PreorderStatus
from . import Base


class ConcessionPreorder(Base):
    __tablename__ = "concession_preorders"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    concession_item_id = Column(Integer, ForeignKey("concession_items.id", ondelete="CASCADE"), nullable=False)

    quantity = Column(Integer, nullable=False)
    unit_price = Column(DECIMAL(8, 2), nullable=False)
    total_price = Column(DECIMAL(8, 2), nullable=False)
    status = Column(SQLEnum(PreorderStatus), default=PreorderStatus.PENDING, nullable=False)
    pickup_code = Column(String(20))
    pickup_date = Column(DateTime)

    # Relationships
    order = relationship("Order", back_populates="concession_preorders")
    concession_item = relationship("ConcessionItem", back_populates="preorders")

    # Constraints
    __table_args__ = (
        Index("idx_preorder_order", "order_id"),
        Index("idx_preorder_item", "concession_item_id"),
        Index("idx_preorder_pickup_code", "pickup_code"),
        CheckConstraint("quantity > 0", name="check_preorder_quantity_positive"),
        CheckConstraint("unit_price >= 0", name="check_unit_price_non_negative"),
        CheckConstraint("total_price >= 0", name="check_total_price_non_negative"),
    )
