from sqlalchemy import Column, Integer, DateTime, DECIMAL, ForeignKey, Enum as SQLEnum, Index, CheckConstraint
from sqlalchemy.orm import relationship
from .enums import SessionStatus
from . import Base


class Session(Base):
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, index=True)
    film_id = Column(Integer, ForeignKey("films.id", ondelete="CASCADE"), nullable=False)
    hall_id = Column(Integer, ForeignKey("halls.id", ondelete="CASCADE"), nullable=False)

    start_datetime = Column(DateTime, nullable=False, index=True)
    end_datetime = Column(DateTime, nullable=False)
    ticket_price = Column(DECIMAL(8, 2), nullable=False)
    status = Column(SQLEnum(SessionStatus), default=SessionStatus.SCHEDULED, nullable=False)

    # Relationships
    film = relationship("Film", back_populates="sessions")
    hall = relationship("Hall", back_populates="sessions")
    tickets = relationship("Ticket", back_populates="session", cascade="all, delete-orphan")

    # Constraints
    __table_args__ = (
        Index("idx_session_film", "film_id"),
        Index("idx_session_hall", "hall_id"),
        Index("idx_session_start_hall", "start_datetime", "hall_id"),
        Index("idx_session_start_datetime", "start_datetime"),
        CheckConstraint("end_datetime > start_datetime", name="check_session_times_valid"),
        CheckConstraint("ticket_price >= 0", name="check_ticket_price_positive"),
    )
