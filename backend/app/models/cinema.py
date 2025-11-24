from sqlalchemy import Column, Integer, String, Date, DECIMAL, Enum as SQLEnum, Index
from sqlalchemy.orm import relationship
from .enums import CinemaStatus
from . import Base


class Cinema(Base):
    __tablename__ = "cinemas"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    address = Column(String(500), nullable=False)
    city = Column(String(100), nullable=False, index=True)
    latitude = Column(DECIMAL(8, 6))
    longitude = Column(DECIMAL(8, 6))
    phone = Column(String(20))
    status = Column(SQLEnum(CinemaStatus), default=CinemaStatus.ACTIVE, nullable=False)
    opening_date = Column(Date)

    # Relationships
    halls = relationship("Hall", back_populates="cinema", cascade="all, delete-orphan")
    users = relationship("User", back_populates="cinema")
    rental_contracts = relationship("RentalContract", back_populates="cinema")
    concession_items = relationship("ConcessionItem", back_populates="cinema")

    # Indexes
    __table_args__ = (
        Index("idx_cinema_city_status", "city", "status"),
    )
