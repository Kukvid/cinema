"""Add expires_at field to orders

Revision ID: 0006
Revises: 0005
Create Date: 2024-12-01 16:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import table, column
from datetime import datetime, timedelta


# revision identifiers, used by Alembic.
revision = '0006'
down_revision = '005'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add expires_at column as nullable first
    op.add_column('orders', sa.Column('expires_at', sa.DateTime(), nullable=True))

    # Update existing records to have expires_at as created_at + 5 minutes (default timeout)
    # This is a reasonable default if the timeout is 5 minutes as configured in settings
    orders_table = table('orders',
        column('created_at', sa.DateTime()),
        column('expires_at', sa.DateTime())
    )

    # Set expires_at = created_at + 5 minutes for existing orders
    op.execute(
        orders_table.update().values(
            expires_at=orders_table.c.created_at + sa.text("INTERVAL '5 minutes'")
        ).where(orders_table.c.expires_at.is_(None))
    )

    # Now make expires_at non-nullable
    op.alter_column('orders', 'expires_at', nullable=False)


def downgrade() -> None:
    op.drop_column('orders', 'expires_at')