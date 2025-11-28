"""Add genres many-to-many relationship

Revision ID: 003
Revises: 002
Create Date: 2025-11-27

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '003'
down_revision = '002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create genres table
    op.create_table(
        'genres',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )
    op.create_index('idx_genre_name', 'genres', ['name'])

    # Create film_genres association table
    op.create_table(
        'film_genres',
        sa.Column('film_id', sa.Integer(), nullable=False),
        sa.Column('genre_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['film_id'], ['films.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['genre_id'], ['genres.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('film_id', 'genre_id')
    )
    op.create_index('idx_film_genres_film', 'film_genres', ['film_id'])
    op.create_index('idx_film_genres_genre', 'film_genres', ['genre_id'])

    # Migrate existing genre data to new structure
    # First, extract unique genres from films table
    op.execute("""
        INSERT INTO genres (name)
        SELECT DISTINCT genre
        FROM films
        WHERE genre IS NOT NULL AND genre != ''
    """)

    # Populate film_genres table with existing relationships
    op.execute("""
        INSERT INTO film_genres (film_id, genre_id)
        SELECT f.id, g.id
        FROM films f
        INNER JOIN genres g ON f.genre = g.name
        WHERE f.genre IS NOT NULL AND f.genre != ''
    """)

    # Drop old index that includes genre column
    op.drop_index('idx_film_genre_year', table_name='films')

    # Drop genre column from films table
    op.drop_column('films', 'genre')

    # Create new index for release_year only (was part of composite index)
    # Note: idx_film_release_year is already created in the model, so we don't need to create it here


def downgrade() -> None:
    # Add genre column back to films table
    op.add_column('films', sa.Column('genre', sa.String(length=100), nullable=True))

    # Restore data: take first genre from film_genres for each film
    op.execute("""
        UPDATE films f
        SET genre = (
            SELECT g.name
            FROM film_genres fg
            INNER JOIN genres g ON fg.genre_id = g.id
            WHERE fg.film_id = f.id
            LIMIT 1
        )
    """)

    # Recreate old index
    op.create_index('idx_film_genre_year', 'films', ['genre', 'release_year'])

    # Drop new tables
    op.drop_index('idx_film_genres_genre', table_name='film_genres')
    op.drop_index('idx_film_genres_film', table_name='film_genres')
    op.drop_table('film_genres')

    op.drop_index('idx_genre_name', table_name='genres')
    op.drop_table('genres')
