from sqlalchemy import Column, Integer, Date, Time, DECIMAL, ForeignKey, Enum as SQLEnum, Index, CheckConstraint
from sqlalchemy.orm import relationship
from .enums import SessionStatus
from . import Base


class Session(Base):
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, index=True)
    film_id = Column(Integer, ForeignKey("films.id", ondelete="CASCADE"), nullable=False)
    hall_id = Column(Integer, ForeignKey("halls.id", ondelete="CASCADE"), nullable=False)

    session_date = Column(Date, nullable=False, index=True)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
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
        Index("idx_session_date_hall", "session_date", "hall_id"),
        Index("idx_session_date_time", "session_date", "start_time"),
        CheckConstraint("end_time > start_time", name="check_session_times_valid"),
        CheckConstraint("ticket_price >= 0", name="check_ticket_price_positive"),
    )
