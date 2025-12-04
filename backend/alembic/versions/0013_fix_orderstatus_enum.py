"""Fix orderstatus enum by ensuring only lowercase values are used

Revision ID: 0013
Revises: 0012
Create Date: 2025-12-03 23:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0013'
down_revision = '0012'
branch_labels = None
depends_on = None


def upgrade():
    # Update all orders that might have uppercase status to lowercase values
    # This ensures the enum values in the database match the Python enum values
    conn = op.get_bind()

    # Update orders with uppercase statuses to their lowercase equivalents
    # This will prevent the enum error by ensuring existing data matches the expected format
    status_mapping = {
        'created': 'created',
        'pending_payment': 'pending_payment',
        'paid': 'paid',
        'cancelled': 'cancelled',
        'refunded': 'refunded'
    }

    for old_status, new_status in status_mapping.items():
        conn.execute(sa.text(f"""
            UPDATE orders
            SET status = '{new_status}'::orderstatus
            WHERE status::text = '{old_status}';
        """))


def downgrade():
    # No downgrade needed, this is a data correction that doesn't need reverting
    pass