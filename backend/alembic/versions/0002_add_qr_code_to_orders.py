"""Add qr_code column to orders table

Revision ID: f123456789ac
Revises: f123456789ab
Create Date: 2025-02-01 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f123456789ac'
down_revision: Union[str, None] = 'f123456789ab'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add QR code column to orders table if it doesn't exist
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('orders')]
    if 'qr_code' not in columns:
        op.add_column('orders', sa.Column('qr_code', sa.String(2000), nullable=True))


def downgrade() -> None:
    # Remove QR code column from orders table if it exists
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('orders')]
    if 'qr_code' in columns:
        op.drop_column('orders', 'qr_code')