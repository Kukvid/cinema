from sqlalchemy import Column, Integer, String, ForeignKey, Enum as SQLEnum, Index, CheckConstraint
from sqlalchemy.orm import relationship
from .enums import HallStatus, HallType
from . import Base


class Hall(Base):
    __tablename__ = "halls"

    id = Column(Integer, primary_key=True, index=True)
    cinema_id = Column(Integer, ForeignKey("cinemas.id", ondelete="CASCADE"), nullable=False)
    hall_number = Column(String(10), nullable=False)
    name = Column(String(100))
    capacity = Column(Integer, nullable=False)
    hall_type = Column(SQLEnum(HallType), default=HallType.STANDARD, nullable=False)
    status = Column(SQLEnum(HallStatus), default=HallStatus.ACTIVE, nullable=False)

    # Relationships
    cinema = relationship("Cinema", back_populates="halls")
    seats = relationship("Seat", back_populates="hall", cascade="all, delete-orphan")
    sessions = relationship("Session", back_populates="hall")

    # Constraints
    __table_args__ = (
        Index("idx_hall_cinema", "cinema_id"),
        Index("idx_hall_cinema_number", "cinema_id", "hall_number", unique=True),
        CheckConstraint("capacity > 0", name="check_hall_capacity_positive"),
    )
