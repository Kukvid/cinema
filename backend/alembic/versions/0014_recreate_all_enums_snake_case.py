"""Recreate all enums with snake_case values

Revision ID: 0014_recreate_all_enums_snake_case
Revises: 0013
Create Date: 2025-12-04 18:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import text


# revision identifiers, used by Alembic.
revision = '0014'
down_revision = '0013'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Backup orders table status column
    conn = op.get_bind()
    
    # Add temporary column to store status as text
    op.add_column('orders', sa.Column('temp_status', sa.Text()))
    conn.execute(text("UPDATE orders SET temp_status = status::text"))
    
    # 2. Drop the orders table status column and recreate enum
    op.drop_column('orders', 'status')
    
    # Drop the old enum type
    conn.execute(text("DROP TYPE IF EXISTS orderstatus"))
    
    # Create new enum with snake_case values
    new_order_status_enum = sa.Enum(
        'created',
        'pending_payment', 
        'paid',
        'cancelled',
        'refunded',
        'completed',
        name='orderstatus'
    )
    new_order_status_enum.create(conn)
    
    # Add the status column back with new enum
    op.add_column('orders', sa.Column('status', new_order_status_enum, nullable=False, server_default='created'))
    
    # Restore data with proper conversion
    conn.execute(text("""
        UPDATE orders SET status = 
        CASE 
            WHEN temp_status = 'CREATED' THEN 'created'::orderstatus
            WHEN temp_status = 'PENDING_PAYMENT' THEN 'pending_payment'::orderstatus
            WHEN temp_status = 'PAID' THEN 'paid'::orderstatus
            WHEN temp_status = 'CANCELLED' THEN 'cancelled'::orderstatus
            WHEN temp_status = 'REFUNDED' THEN 'refunded'::orderstatus
            WHEN temp_status = 'COMPLETED' THEN 'completed'::orderstatus
            ELSE 'created'::orderstatus  -- fallback for any unexpected values
        END
    """))
    
    # Remove the temporary column
    op.drop_column('orders', 'temp_status')


def downgrade():
    # This is a complex migration, downgrade is not recommended
    pass