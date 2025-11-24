from sqlalchemy import Column, Integer, String, Date, DECIMAL, Text, ForeignKey, Enum as SQLEnum, Index, CheckConstraint
from sqlalchemy.orm import relationship
from .enums import ContractStatus
from . import Base


class RentalContract(Base):
    __tablename__ = "rental_contracts"

    id = Column(Integer, primary_key=True, index=True)
    film_id = Column(Integer, ForeignKey("films.id", ondelete="CASCADE"), nullable=False)
    distributor_id = Column(Integer, ForeignKey("distributors.id", ondelete="CASCADE"), nullable=False)
    cinema_id = Column(Integer, ForeignKey("cinemas.id", ondelete="CASCADE"), nullable=False)

    contract_number = Column(String(50), unique=True, nullable=False)
    contract_date = Column(Date, nullable=False)
    rental_start_date = Column(Date, nullable=False)
    rental_end_date = Column(Date, nullable=False)

    min_screening_period_days = Column(Integer)
    min_sessions_per_day = Column(Integer)

    distributor_percentage_week1 = Column(DECIMAL(5, 2), nullable=False)
    distributor_percentage_week2 = Column(DECIMAL(5, 2), nullable=False)
    distributor_percentage_week3 = Column(DECIMAL(5, 2), nullable=False)
    distributor_percentage_after = Column(DECIMAL(5, 2), nullable=False)

    guaranteed_minimum_amount = Column(DECIMAL(12, 2), default=0.00)
    cinema_operational_costs = Column(DECIMAL(12, 2), default=0.00)

    status = Column(SQLEnum(ContractStatus), default=ContractStatus.ACTIVE, nullable=False)
    early_termination_terms = Column(Text)

    # Relationships
    film = relationship("Film", back_populates="rental_contracts")
    distributor = relationship("Distributor", back_populates="rental_contracts")
    cinema = relationship("Cinema", back_populates="rental_contracts")
    payment_history = relationship("PaymentHistory", back_populates="rental_contract", cascade="all, delete-orphan")

    # Constraints
    __table_args__ = (
        Index("idx_rental_contract_film", "film_id"),
        Index("idx_rental_contract_distributor", "distributor_id"),
        Index("idx_rental_contract_cinema", "cinema_id"),
        Index("idx_rental_contract_dates", "rental_start_date", "rental_end_date"),
        CheckConstraint("rental_end_date > rental_start_date", name="check_rental_dates_valid"),
        CheckConstraint("distributor_percentage_week1 >= 0 AND distributor_percentage_week1 <= 100", name="check_percentage_week1"),
        CheckConstraint("distributor_percentage_week2 >= 0 AND distributor_percentage_week2 <= 100", name="check_percentage_week2"),
        CheckConstraint("distributor_percentage_week3 >= 0 AND distributor_percentage_week3 <= 100", name="check_percentage_week3"),
        CheckConstraint("distributor_percentage_after >= 0 AND distributor_percentage_after <= 100", name="check_percentage_after"),
    )
