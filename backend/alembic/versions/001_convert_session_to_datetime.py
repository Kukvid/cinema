"""Convert session date/time to datetime fields

Revision ID: 001
Revises:
Create Date: 2025-11-27

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop old constraints
    op.drop_constraint('check_session_times_valid', 'sessions', type_='check')
    op.drop_index('idx_session_date_time', table_name='sessions')
    op.drop_index('idx_session_date_hall', table_name='sessions')

    # Add new datetime columns
    op.add_column('sessions', sa.Column('start_datetime', sa.DateTime(), nullable=True))
    op.add_column('sessions', sa.Column('end_datetime', sa.DateTime(), nullable=True))

    # Migrate data: combine session_date + start_time -> start_datetime, session_date + end_time -> end_datetime
    # Handle midnight case: if end_time < start_time, add 1 day to end_datetime
    op.execute("""
        UPDATE sessions
        SET start_datetime = session_date + start_time,
            end_datetime = CASE
                WHEN end_time < start_time THEN session_date + interval '1 day' + end_time
                ELSE session_date + end_time
            END
    """)

    # Make new columns NOT NULL
    op.alter_column('sessions', 'start_datetime', nullable=False)
    op.alter_column('sessions', 'end_datetime', nullable=False)

    # Drop old columns
    op.drop_column('sessions', 'session_date')
    op.drop_column('sessions', 'start_time')
    op.drop_column('sessions', 'end_time')

    # Create new indexes
    op.create_index('idx_session_start_datetime', 'sessions', ['start_datetime'])
    op.create_index('idx_session_start_hall', 'sessions', ['start_datetime', 'hall_id'])

    # Create new check constraint
    op.create_check_constraint('check_session_times_valid', 'sessions', 'end_datetime > start_datetime')


def downgrade() -> None:
    # Drop new constraints and indexes
    op.drop_constraint('check_session_times_valid', 'sessions', type_='check')
    op.drop_index('idx_session_start_hall', table_name='sessions')
    op.drop_index('idx_session_start_datetime', table_name='sessions')

    # Add old columns back
    op.add_column('sessions', sa.Column('session_date', sa.Date(), nullable=True))
    op.add_column('sessions', sa.Column('start_time', sa.Time(), nullable=True))
    op.add_column('sessions', sa.Column('end_time', sa.Time(), nullable=True))

    # Migrate data back
    op.execute("""
        UPDATE sessions
        SET session_date = start_datetime::date,
            start_time = start_datetime::time,
            end_time = end_datetime::time
    """)

    # Make old columns NOT NULL
    op.alter_column('sessions', 'session_date', nullable=False)
    op.alter_column('sessions', 'start_time', nullable=False)
    op.alter_column('sessions', 'end_time', nullable=False)

    # Drop new columns
    op.drop_column('sessions', 'end_datetime')
    op.drop_column('sessions', 'start_datetime')

    # Recreate old indexes
    op.create_index('idx_session_date_hall', 'sessions', ['session_date', 'hall_id'])
    op.create_index('idx_session_date_time', 'sessions', ['session_date', 'start_time'])

    # Recreate old check constraint (this will fail for sessions that cross midnight)
    op.create_check_constraint('check_session_times_valid', 'sessions', 'end_time > start_time')
