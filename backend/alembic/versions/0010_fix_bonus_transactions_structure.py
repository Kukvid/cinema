"""Fix bonus_transactions table structure

Revision ID: 0010
Revises: 0009
Create Date: 2024-12-01 20:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision = '0010'
down_revision = '0009'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # First, check if order_id column exists and add it if missing
    conn = op.get_bind()
    
    # Check if order_id column exists
    result = conn.execute(text("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'bonus_transactions' 
        AND column_name = 'order_id'
    """)).fetchone()
    
    if not result:
        # Add order_id column if it doesn't exist
        op.add_column('bonus_transactions', 
                      sa.Column('order_id', sa.Integer(), nullable=True))
    
    # Check if foreign key exists, if not - create it
    # First drop if exists to avoid conflicts
    try:
        op.drop_constraint('fk_bonus_transactions_order_id', 'bonus_transactions', type_='foreignkey')
    except:
        pass  # Foreign key might not exist
    
    # Create the foreign key constraint
    op.create_foreign_key(
        'fk_bonus_transactions_order_id',
        'bonus_transactions',
        'orders',
        ['order_id'],
        ['id'],
        ondelete='SET NULL'
    )


def downgrade() -> None:
    # Drop foreign key constraint
    op.drop_constraint('fk_bonus_transactions_order_id', 'bonus_transactions', type_='foreignkey')
    
    # Drop the column
    op.drop_column('bonus_transactions', 'order_id')