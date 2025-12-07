"""Change ticket unique constraint to include order_id

Revision ID: 0017_change_ticket_unique_constraint
Revises: 0016_recreate_all_enums_screaming_snake_case
Create Date: 2025-12-05 23:59:59.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0017'
down_revision: Union[str, None] = '0014'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop the existing unique index on (session_id, seat_id)
    op.drop_index('idx_ticket_session_seat', table_name='tickets')

    # Create a new unique constraint on (session_id, seat_id, order_id)
    op.create_unique_constraint('uq_ticket_session_seat_order', 'tickets', ['session_id', 'seat_id', 'order_id'])


def downgrade() -> None:
    # Drop the new constraint
    op.drop_constraint('uq_ticket_session_seat_order', 'tickets', type_='unique')

    # Recreate the old unique index
    op.create_index('idx_ticket_session_seat', 'tickets', ['session_id', 'seat_id'], unique=True)