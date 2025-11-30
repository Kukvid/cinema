"""Mark QR code changes as completed

Revision ID: f123456789ad
Revises: f123456789ac
Create Date: 2025-02-01 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f123456789ad'
down_revision: Union[str, None] = 'f123456789ac'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # This migration is just to mark the previous changes as completed
    # since the database structure already matches what we need
    pass


def downgrade() -> None:
    # No actual changes to reverse
    pass