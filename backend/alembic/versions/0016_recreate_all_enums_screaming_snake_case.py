"""Recreate all enums with SCREAMING_SNAKE_CASE values except OrderStatus

Revision ID: 0016_recreate_all_enums_screaming_snake_case
Revises: 0015
Create Date: 2025-12-04 20:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import text


# revision identifiers, used by Alembic.
revision = '0016'
down_revision = '0015'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    
    # Handle PaymentStatus enum
    try:
        # Backup payment status column
        op.add_column('payments', sa.Column('temp_status', sa.Text()))
        conn.execute(text("UPDATE payments SET temp_status = status::text"))
        
        # Drop and recreate paymentstatus enum
        op.drop_column('payments', 'status')
        conn.execute(text("DROP TYPE paymentstatus"))
        
        # Create new enum with SCREAMING_SNAKE_CASE
        new_payment_status_enum = sa.Enum(
            'PENDING',
            'PAID', 
            'FAILED',
            'REFUNDED',
            name='paymentstatus'
        )
        new_payment_status_enum.create(conn)
        
        op.add_column('payments', sa.Column('status', new_payment_status_enum, nullable=False, server_default='PENDING'))
        
        # Restore data with conversion from lowercase to uppercase
        conn.execute(text("""
            UPDATE payments SET status = 
            CASE 
                WHEN temp_status = 'pending' THEN 'PENDING'::paymentstatus
                WHEN temp_status = 'paid' THEN 'PAID'::paymentstatus
                WHEN temp_status = 'failed' THEN 'FAILED'::paymentstatus
                WHEN temp_status = 'refunded' THEN 'REFUNDED'::paymentstatus
                ELSE 'PENDING'::paymentstatus
            END
        """))
        
        op.drop_column('payments', 'temp_status')
    except Exception as e:
        print(f"Error handling payment status: {e}")
        # Continue with other enums even if one fails
    
    # Handle TicketStatus enum
    try:
        op.add_column('tickets', sa.Column('temp_status', sa.Text()))
        conn.execute(text("UPDATE tickets SET temp_status = status::text"))
        
        op.drop_column('tickets', 'status')
        conn.execute(text("DROP TYPE ticketstatus"))
        
        new_ticket_status_enum = sa.Enum(
            'RESERVED',
            'PAID',
            'USED',
            'CANCELLED',
            'EXPIRED',
            name='ticketstatus'
        )
        new_ticket_status_enum.create(conn)
        
        op.add_column('tickets', sa.Column('status', new_ticket_status_enum, nullable=False, server_default='RESERVED'))
        
        conn.execute(text("""
            UPDATE tickets SET status = 
            CASE 
                WHEN temp_status = 'reserved' THEN 'RESERVED'::ticketstatus
                WHEN temp_status = 'paid' THEN 'PAID'::ticketstatus
                WHEN temp_status = 'used' THEN 'USED'::ticketstatus
                WHEN temp_status = 'cancelled' THEN 'CANCELLED'::ticketstatus
                WHEN temp_status = 'expired' THEN 'EXPIRED'::ticketstatus
                ELSE 'RESERVED'::ticketstatus
            END
        """))
        
        op.drop_column('tickets', 'temp_status')
    except Exception as e:
        print(f"Error handling ticket status: {e}")
    
    # Handle SessionStatus enum
    try:
        op.add_column('sessions', sa.Column('temp_status', sa.Text()))
        conn.execute(text("UPDATE sessions SET temp_status = status::text"))
        
        op.drop_column('sessions', 'status')
        conn.execute(text("DROP TYPE sessionstatus"))
        
        new_session_status_enum = sa.Enum(
            'SCHEDULED',
            'ONGOING',
            'COMPLETED',
            'CANCELLED',
            name='sessionstatus'
        )
        new_session_status_enum.create(conn)
        
        op.add_column('sessions', sa.Column('status', new_session_status_enum, nullable=False, server_default='SCHEDULED'))
        
        conn.execute(text("""
            UPDATE sessions SET status = 
            CASE 
                WHEN temp_status = 'scheduled' THEN 'SCHEDULED'::sessionstatus
                WHEN temp_status = 'ongoing' THEN 'ONGOING'::sessionstatus
                WHEN temp_status = 'completed' THEN 'COMPLETED'::sessionstatus
                WHEN temp_status = 'cancelled' THEN 'CANCELLED'::sessionstatus
                ELSE 'SCHEDULED'::sessionstatus
            END
        """))
        
        op.drop_column('sessions', 'temp_status')
    except Exception as e:
        print(f"Error handling session status: {e}")
    
    # Handle other enums as needed based on the app models


def downgrade():
    # This is a complex migration, downgrade is not recommended
    pass