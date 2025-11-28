from sqlalchemy import Column, Integer, String, Text, Boolean, Index, CheckConstraint
from sqlalchemy.orm import relationship
from . import Base


class FoodCategory(Base):
    __tablename__ = "food_categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    display_order = Column(Integer, default=0, nullable=False)

    # Relationships
    concession_items = relationship("ConcessionItem", back_populates="category")

    # Constraints
    __table_args__ = (
        Index("idx_food_category_name", "name"),
        Index("idx_food_category_display_order", "display_order"),
        CheckConstraint("display_order >= 0", name="check_display_order_non_negative"),
    )
