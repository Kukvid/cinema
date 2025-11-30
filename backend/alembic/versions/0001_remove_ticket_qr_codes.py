"""Remove per-ticket QR codes and validation_date

Revision ID: f123456789ab
Revises: 005
Create Date: 2025-02-01 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'f123456789ab'
down_revision: Union[str, None] = '005'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add QR code column to orders table
    op.add_column('orders', sa.Column('qr_code', sa.String(2000), nullable=True))
    
    # Drop QR code and validation_date columns from tickets table
    op.drop_column('tickets', 'qr_code')
    op.drop_column('tickets', 'validation_date')


def downgrade() -> None:
    # Recreate QR code and validation_date columns in tickets table
    op.add_column('tickets', sa.Column('qr_code', sa.String(2000), nullable=True))
    op.add_column('tickets', sa.Column('validation_date', postgresql.TIMESTAMP(), nullable=True))
    
    # Remove QR code column from orders table
    op.drop_column('orders', 'qr_code')