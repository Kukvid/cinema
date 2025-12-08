"""update rental contracts for auto payments

Revision ID: 20250124_update_rental_contracts_for_auto_payments
Revises: 20250123_remove_unwanted_fields
Create Date: 2025-01-24 15:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = '0019'
down_revision = '0018'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Update rental_contracts table only (payment_history table already exists)
    # Drop the old columns that are no longer needed
    op.drop_column('rental_contracts', 'min_sessions_per_day')
    op.drop_column('rental_contracts', 'min_screening_period_days')
    op.drop_column('rental_contracts', 'guaranteed_minimum_amount')
    op.drop_column('rental_contracts', 'cinema_operational_costs')
    op.drop_column('rental_contracts', 'early_termination_terms')
    op.drop_column('rental_contracts', 'distributor_percentage_week1')
    op.drop_column('rental_contracts', 'distributor_percentage_week2')
    op.drop_column('rental_contracts', 'distributor_percentage_week3')
    op.drop_column('rental_contracts', 'distributor_percentage_after')

    # Add the new single percentage column
    op.add_column('rental_contracts', sa.Column('distributor_percentage', sa.Numeric(5, 2), nullable=True, default=sa.text('0.00')))


def downgrade() -> None:
    # Revert changes to rental_contracts table
    op.drop_column('rental_contracts', 'distributor_percentage')

    op.add_column('rental_contracts', sa.Column('early_termination_terms', sa.Text()))
    op.add_column('rental_contracts', sa.Column('cinema_operational_costs', sa.Numeric(10, 2)))
    op.add_column('rental_contracts', sa.Column('guaranteed_minimum_amount', sa.Numeric(10, 2)))
    op.add_column('rental_contracts', sa.Column('min_screening_period_days', sa.Integer()))
    op.add_column('rental_contracts', sa.Column('min_sessions_per_day', sa.Integer()))

    op.add_column('rental_contracts', sa.Column('distributor_percentage_week1', sa.Numeric(5,2)))
    op.add_column('rental_contracts', sa.Column('distributor_percentage_week2', sa.Numeric(5,2)))
    op.add_column('rental_contracts', sa.Column('distributor_percentage_week3', sa.Numeric(5,2)))
    op.add_column('rental_contracts', sa.Column('distributor_percentage_after', sa.Numeric(5,2)))