"""Add all OrderStatus enum values to database

Revision ID: 0011
Revises: 0010
Create Date: 2025-12-03 15:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision = '0011'
down_revision = '0010'
branch_labels = None
depends_on = None


def upgrade():
    # For this implementation, we'll ensure that the database has all enum values
    # The enum type is typically created from SQLAlchemy models, so we just need to
    # make sure any missing enum values are added for PostgreSQL

    conn = op.get_bind()

    # Add enum values one by one to the existing enum type if they don't exist
    # We use raw SQL for PostgreSQL enum operations
    enum_values = ['created', 'pending_payment', 'paid', 'cancelled', 'refunded', 'used', 'completed']

    for enum_value in enum_values:
        # Use raw SQL to add the enum value if it doesn't exist
        try:
            conn.execute(text(f"ALTER TYPE orderstatus ADD VALUE IF NOT EXISTS '{enum_value}';"))
        except Exception as e:
            # If this fails, it might be because:
            # 1. The enum type doesn't exist yet - we'll create it in the application
            # 2. The value already exists - that's fine
            # 3. We're not using PostgreSQL - that's also fine, the app model handles it
            print(f"Could not add enum value '{enum_value}': {e}")
            pass

    # The actual enum type definition should be handled by SQLAlchemy when models are loaded,
    # but this ensures PostgreSQL enum values are available


def downgrade():
    # Enum values cannot be removed in PostgreSQL, so we just leave them
    # This is a limitation of PostgreSQL enums
    pass