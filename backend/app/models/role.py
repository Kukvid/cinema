from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from . import Base


class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False, index=True)

    # Relationships
    users = relationship("User", back_populates="role")
