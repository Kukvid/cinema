from sqlalchemy import Column, Integer, String, Text, Enum as SQLEnum
from sqlalchemy.orm import relationship
from .enums import DistributorStatus
from . import Base


class Distributor(Base):
    __tablename__ = "distributors"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(300), nullable=False, index=True)
    inn = Column(String(12), unique=True, nullable=False)
    contact_person = Column(String(200))
    email = Column(String(100))
    phone = Column(String(20))
    bank_details = Column(Text)
    status = Column(SQLEnum(DistributorStatus), default=DistributorStatus.ACTIVE, nullable=False)

    # Relationships
    rental_contracts = relationship("RentalContract", back_populates="distributor")
