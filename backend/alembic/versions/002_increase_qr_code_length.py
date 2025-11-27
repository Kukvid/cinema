"""Increase QR code field length

Revision ID: 002
Revises: 001
Create Date: 2025-11-27

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Increase qr_code field length from VARCHAR(500) to VARCHAR(2000)
    op.alter_column('tickets', 'qr_code',
                    existing_type=sa.String(500),
                    type_=sa.String(2000),
                    existing_nullable=True)


def downgrade() -> None:
    # Decrease qr_code field length back to VARCHAR(500)
    op.alter_column('tickets', 'qr_code',
                    existing_type=sa.String(2000),
                    type_=sa.String(500),
                    existing_nullable=True)