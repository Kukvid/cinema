"""Remove ticket_id field from bonus_transactions

Revision ID: 0009
Revises: 0008
Create Date: 2024-12-01 19:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0009'
down_revision = '0008'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop the column - this should automatically handle foreign key constraints
    with op.batch_alter_table('bonus_transactions') as batch_op:
        batch_op.drop_column('ticket_id')


def downgrade() -> None:
    # Add back the column
    with op.batch_alter_table('bonus_transactions') as batch_op:
        batch_op.add_column(sa.Column('ticket_id', sa.Integer(), nullable=True))

    # Recreate index if needed
    op.create_index('ix_bonus_transactions_ticket_id', 'bonus_transactions', ['ticket_id'], unique=False)

    # Recreate foreign key constraint - using batch operation for safety
    with op.batch_alter_table('bonus_transactions') as batch_op:
        batch_op.create_foreign_key('fk_bonus_transactions_ticket_id', 'tickets', ['ticket_id'], ['id'], ondelete='SET NULL')