from sqlalchemy import Column, Integer, String, Text, DECIMAL, Index
from sqlalchemy.orm import relationship
from . import Base


class Film(Base):
    __tablename__ = "films"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(300), nullable=False, index=True)
    original_title = Column(String(300))
    description = Column(Text)
    genre = Column(String(100), index=True)
    age_rating = Column(String(5))
    duration_minutes = Column(Integer, nullable=False)
    release_year = Column(Integer, index=True)
    country = Column(String(200))
    director = Column(String(200))
    actors = Column(Text)
    poster_url = Column(String(500))
    trailer_url = Column(String(500))
    imdb_rating = Column(DECIMAL(3, 1))
    kinopoisk_rating = Column(DECIMAL(3, 1))

    # Relationships
    rental_contracts = relationship("RentalContract", back_populates="film")
    sessions = relationship("Session", back_populates="film")

    # Indexes
    __table_args__ = (
        Index("idx_film_genre_year", "genre", "release_year"),
        Index("idx_film_title_search", "title"),
    )
