"""Create promocodes table

Revision ID: 005
Revises: 004
Create Date: 2025-11-28

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '005'
down_revision = '004'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create promocodes table
    op.create_table(
        'promocodes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('code', sa.String(length=50), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('discount_type', sa.Enum('PERCENTAGE', 'FIXED_AMOUNT', name='discounttype'), nullable=False),
        sa.Column('discount_value', sa.DECIMAL(precision=8, scale=2), nullable=False),
        sa.Column('valid_from', sa.Date(), nullable=False),
        sa.Column('valid_until', sa.Date(), nullable=False),
        sa.Column('max_uses', sa.Integer(), nullable=True),
        sa.Column('used_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('min_order_amount', sa.DECIMAL(precision=8, scale=2), nullable=True, server_default='0.00'),
        sa.Column('applicable_category', sa.String(length=100), nullable=True),
        sa.Column('status', sa.Enum('ACTIVE', 'EXPIRED', 'DEPLETED', 'INACTIVE', name='promocodestatus'), nullable=False, server_default='ACTIVE'),

        # Constraints
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code'),
        sa.CheckConstraint('discount_value >= 0', name='check_discount_value_non_negative'),
        sa.CheckConstraint('valid_until >= valid_from', name='check_promocode_dates_valid'),
        sa.CheckConstraint('used_count >= 0', name='check_used_count_non_negative'),
        sa.CheckConstraint('min_order_amount >= 0', name='check_min_order_amount_non_negative')
    )

    # Create indexes
    op.create_index('idx_promocode_code', 'promocodes', ['code'])
    op.create_index('idx_promocode_status', 'promocodes', ['status'])
    op.create_index('idx_promocode_valid_from', 'promocodes', ['valid_from'])
    op.create_index('idx_promocode_valid_until', 'promocodes', ['valid_until'])


def downgrade() -> None:
    # Drop indexes
    op.drop_index('idx_promocode_valid_until', table_name='promocodes')
    op.drop_index('idx_promocode_valid_from', table_name='promocodes')
    op.drop_index('idx_promocode_status', table_name='promocodes')
    op.drop_index('idx_promocode_code', table_name='promocodes')

    # Drop table
    op.drop_table('promocodes')

    # Drop enums
    op.execute('DROP TYPE IF EXISTS promocodestatus')
    op.execute('DROP TYPE IF EXISTS discounttype')
