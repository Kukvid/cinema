from sqlalchemy import Column, Integer, String, Index
from sqlalchemy.orm import relationship
from . import Base


class Genre(Base):
    __tablename__ = "genres"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True, index=True)

    # Relationships
    # Many-to-many relationship with Film through film_genres table
    films = relationship("Film", secondary="film_genres", back_populates="genres")

    # Indexes
    __table_args__ = (
        Index("idx_genre_name", "name"),
    )
