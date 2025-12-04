"""Add completed value to orderstatus enum

Revision ID: 0012
Revises: 0011
Create Date: 2025-12-03 22:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0012'
down_revision = '0011'
branch_labels = None
depends_on = None


def upgrade():
    # Add the 'completed' value to the orderstatus enum type in PostgreSQL
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE orderstatus ADD VALUE IF NOT EXISTS 'completed'")


def downgrade():
    # Unfortunately, PostgreSQL doesn't allow removing enum values
    # So we can't really revert this migration
    # This is a limitation of PostgreSQL enums
    pass