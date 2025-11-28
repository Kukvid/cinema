from sqlalchemy import Column, Integer, String, Text, DECIMAL, Index, Table, ForeignKey
from sqlalchemy.orm import relationship
from . import Base


# Association table for many-to-many relationship between Film and Genre
film_genres = Table(
    'film_genres',
    Base.metadata,
    Column('film_id', Integer, ForeignKey('films.id', ondelete='CASCADE'), primary_key=True),
    Column('genre_id', Integer, ForeignKey('genres.id', ondelete='CASCADE'), primary_key=True),
    Index('idx_film_genres_film', 'film_id'),
    Index('idx_film_genres_genre', 'genre_id'),
)


class Film(Base):
    __tablename__ = "films"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(300), nullable=False, index=True)
    original_title = Column(String(300))
    description = Column(Text)
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
    # Many-to-many relationship with Genre through film_genres table
    genres = relationship("Genre", secondary=film_genres, back_populates="films")

    # Indexes
    __table_args__ = (
        Index("idx_film_title_search", "title"),
        Index("idx_film_release_year", "release_year"),
    )
