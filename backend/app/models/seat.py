from sqlalchemy import Column, Integer, Boolean, ForeignKey, Index, CheckConstraint
from sqlalchemy.orm import relationship
from . import Base


class Seat(Base):
    __tablename__ = "seats"

    id = Column(Integer, primary_key=True, index=True)
    hall_id = Column(Integer, ForeignKey("halls.id", ondelete="CASCADE"), nullable=False)
    row_number = Column(Integer, nullable=False)
    seat_number = Column(Integer, nullable=False)
    is_aisle = Column(Boolean, default=False, nullable=False)
    is_available = Column(Boolean, default=True, nullable=False)

    # Relationships
    hall = relationship("Hall", back_populates="seats")
    tickets = relationship("Ticket", back_populates="seat")

    # Constraints
    __table_args__ = (
        Index("idx_seat_hall", "hall_id"),
        Index("idx_seat_hall_row_number", "hall_id", "row_number", "seat_number", unique=True),
        CheckConstraint("row_number > 0", name="check_row_positive"),
        CheckConstraint("seat_number > 0", name="check_seat_positive"),
    )
