"""Allow multiple payments per order including refunds

Revision ID: 0018_allow_multiple_payments_per_order
Revises: 0017_change_ticket_unique_constraint
Create Date: 2025-12-06 21:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0018'
down_revision: Union[str, None] = '0017'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop the existing unique constraint on order_id
    op.drop_constraint('payments_order_id_key', 'payments', type_='unique')
    
    # Create a more flexible constraint that allows multiple payments per order
    # We can add a unique constraint on transaction_id to ensure each transaction is unique
    op.create_unique_constraint('payments_transaction_id_key', 'payments', ['transaction_id'])


def downgrade() -> None:
    # Drop the transaction_id unique constraint
    op.drop_constraint('payments_transaction_id_key', 'payments', type_='unique')
    
    # Recreate the original order_id unique constraint
    op.create_unique_constraint('payments_order_id_key', 'payments', ['order_id'])