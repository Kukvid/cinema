from sqlalchemy import Column, Integer, DECIMAL, DateTime, Date, String, ForeignKey, Enum as SQLEnum, Index
from sqlalchemy.orm import relationship
from .enums import PaymentStatus
from . import Base


class PaymentHistory(Base):
    __tablename__ = "payment_history"

    id = Column(Integer, primary_key=True, index=True)
    rental_contract_id = Column(Integer, ForeignKey("rental_contracts.id", ondelete="CASCADE"), nullable=False)

    calculated_amount = Column(DECIMAL(12, 2), nullable=False)
    calculation_date = Column(DateTime, nullable=False)
    payment_status = Column(SQLEnum(PaymentStatus), default=PaymentStatus.PENDING, nullable=False)
    payment_date = Column(Date)
    payment_document_number = Column(String(100))

    # Relationships
    rental_contract = relationship("RentalContract", back_populates="payment_history")

    # Indexes
    __table_args__ = (
        Index("idx_payment_history_contract", "rental_contract_id"),
        Index("idx_payment_history_status", "payment_status"),
        Index("idx_payment_history_calculation_date", "calculation_date"),
    )