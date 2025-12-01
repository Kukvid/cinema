"""Add order_id field to bonus_transactions

Revision ID: 0008
Revises: 0007
Create Date: 2024-12-01 18:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0008'
down_revision = '0007'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add order_id column to bonus_transactions table
    op.add_column('bonus_transactions', 
                  sa.Column('order_id', sa.Integer(), nullable=True))
    
    # Create foreign key constraint
    op.create_foreign_key(
        'fk_bonus_transactions_order_id', 
        'bonus_transactions', 
        'orders', 
        ['order_id'], 
        ['id'],
        ondelete='SET NULL'
    )
    
    # Create index for the new column
    op.create_index('idx_bonus_transaction_order', 'bonus_transactions', ['order_id'])


def downgrade() -> None:
    # Drop index
    op.drop_index('idx_bonus_transaction_order', table_name='bonus_transactions')
    
    # Drop foreign key constraint
    op.drop_constraint('fk_bonus_transactions_order_id', 'bonus_transactions', type_='foreignkey')
    
    # Drop column
    op.drop_column('bonus_transactions', 'order_id')