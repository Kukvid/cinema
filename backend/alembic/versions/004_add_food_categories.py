"""Add food categories

Revision ID: 004
Revises: 003
Create Date: 2025-11-28

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '004'
down_revision = '003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create food_categories table
    op.create_table(
        'food_categories',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('display_order', sa.Integer(), nullable=False, server_default='0'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name'),
        sa.CheckConstraint('display_order >= 0', name='check_display_order_non_negative')
    )
    op.create_index('idx_food_category_name', 'food_categories', ['name'])
    op.create_index('idx_food_category_display_order', 'food_categories', ['display_order'])

    # Add category_id column to concession_items table
    # First, add as nullable to allow existing records
    op.add_column('concession_items', sa.Column('category_id', sa.Integer(), nullable=True))

    # Create a default category for existing items
    op.execute("""
        INSERT INTO food_categories (name, display_order)
        VALUES ('Разное', 999)
    """)

    # Update existing concession items to use the default category
    op.execute("""
        UPDATE concession_items
        SET category_id = (SELECT id FROM food_categories WHERE name = 'Разное')
        WHERE category_id IS NULL
    """)

    # Now make category_id non-nullable
    op.alter_column('concession_items', 'category_id', nullable=False)

    # Add foreign key constraint
    op.create_foreign_key(
        'fk_concession_item_category',
        'concession_items',
        'food_categories',
        ['category_id'],
        ['id'],
        ondelete='CASCADE'
    )

    # Create index on category_id
    op.create_index('idx_concession_item_category', 'concession_items', ['category_id'])


def downgrade() -> None:
    # Drop index and foreign key
    op.drop_index('idx_concession_item_category', table_name='concession_items')
    op.drop_constraint('fk_concession_item_category', 'concession_items', type_='foreignkey')

    # Drop category_id column from concession_items
    op.drop_column('concession_items', 'category_id')

    # Drop food_categories table
    op.drop_index('idx_food_category_display_order', table_name='food_categories')
    op.drop_index('idx_food_category_name', table_name='food_categories')
    op.drop_table('food_categories')
