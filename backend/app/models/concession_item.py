from sqlalchemy import Column, Integer, String, Text, DECIMAL, ForeignKey, Enum as SQLEnum, Index, CheckConstraint
from sqlalchemy.orm import relationship
from .enums import ConcessionItemStatus
from . import Base


class ConcessionItem(Base):
    __tablename__ = "concession_items"

    id = Column(Integer, primary_key=True, index=True)
    cinema_id = Column(Integer, ForeignKey("cinemas.id", ondelete="CASCADE"), nullable=False)
    category_id = Column(Integer, ForeignKey("food_categories.id", ondelete="CASCADE"), nullable=False)

    name = Column(String(200), nullable=False)
    description = Column(Text)
    price = Column(DECIMAL(8, 2), nullable=False)
    portion_size = Column(String(50))
    calories = Column(Integer)
    stock_quantity = Column(Integer, default=0, nullable=False)
    status = Column(SQLEnum(ConcessionItemStatus), default=ConcessionItemStatus.AVAILABLE, nullable=False)
    image_url = Column(String(500))

    # Relationships
    cinema = relationship("Cinema", back_populates="concession_items")
    category = relationship("FoodCategory", back_populates="concession_items")
    preorders = relationship("ConcessionPreorder", back_populates="concession_item")

    # Constraints
    __table_args__ = (
        Index("idx_concession_item_cinema", "cinema_id"),
        Index("idx_concession_item_category", "category_id"),
        Index("idx_concession_item_status", "status"),
        CheckConstraint("price >= 0", name="check_concession_price_non_negative"),
        CheckConstraint("stock_quantity >= 0", name="check_stock_quantity_non_negative"),
    )
