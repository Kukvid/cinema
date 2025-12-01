"""Merge migration branches

Revision ID: 0007
Revises: f123456789ad, 0006
Create Date: 2024-12-01 17:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0007'
down_revision = ('f123456789ad', '0006')  # This indicates we're merging two branches
branch_labels = None
depends_on = None


def upgrade() -> None:
    # This is a merge migration, no actual changes are needed
    pass


def downgrade() -> None:
    # This is a merge migration, no actual changes are needed
    pass