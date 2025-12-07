from datetime import datetime, timedelta
import pytz
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, update, and_
from sqlalchemy.sql import func
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
import logging

from app.config import settings
from app.models.order import Order
from app.models.ticket import Ticket
from app.models.concession_preorder import ConcessionPreorder
from app.models.enums import OrderStatus, TicketStatus, PreorderStatus, SessionStatus
from app.database import engine, get_db
from app.models.bonus_account import BonusAccount
from app.models.bonus_transaction import BonusTransaction
from app.models.enums import BonusTransactionType
from app.models.session import Session
from app.models.enums import SessionStatus
import pytz

logger = logging.getLogger(__name__)

class OrderCleanupService:
    def __init__(self, db_url: str = None):
        # Use the shared engine from database.py if available
        from app.database import engine as shared_engine
        self.engine = shared_engine
        self.SessionLocal = sessionmaker(self.engine, class_=AsyncSession, expire_on_commit=False)
        self.scheduler = AsyncIOScheduler()

    async def cancel_expired_orders(self):
        """Cancel orders that have exceeded payment timeout and return tickets/concessions to stock"""
        logger.info("Running expired order cleanup task...")

        # Create a new database session for the background task
        async with self.SessionLocal() as db:
            try:
                # Find orders that are pending payment and have exceeded expiration time
                current_time = datetime.now(pytz.timezone('Europe/Moscow')).replace(tzinfo=None)

                expired_orders_result = await db.execute(
                    select(Order).filter(
                        Order.status.in_([OrderStatus.created, OrderStatus.pending_payment]),
                        Order.expires_at < current_time
                    )
                )
                expired_orders = expired_orders_result.scalars().all()

                for order in expired_orders:
                    logger.info(f"Cancelling expired order: {order.id}")

                    # Update order status to cancelled
                    order.status = OrderStatus.cancelled  # For OrderStatus, names remain lowercase as per requirement
                    await db.commit()

                    # Update tickets status to cancelled
                    await db.execute(
                        update(Ticket)
                        .where(Ticket.order_id == order.id)
                        .values(status=TicketStatus.CANCELLED)
                    )

                    # Update concession preorders to cancelled
                    await db.execute(
                        update(ConcessionPreorder)
                        .where(ConcessionPreorder.order_id == order.id)
                        .values(status=PreorderStatus.CANCELLED)
                    )

                    # Return concession items to stock/inventory by incrementing stock quantity
                    from app.models.concession_item import ConcessionItem
                    preorder_items = await db.execute(
                        select(ConcessionPreorder)
                        .filter(ConcessionPreorder.order_id == order.id)
                    )
                    preorders = preorder_items.scalars().all()

                    for preorder in preorders:
                        # Increase the stock of the concession item by the quantity that was preordered
                        await db.execute(
                            update(ConcessionItem)
                            .where(ConcessionItem.id == preorder.concession_item_id)
                            .values(stock_quantity=ConcessionItem.stock_quantity + preorder.quantity)
                        )

                    # If the order used bonus points, return them to user's bonus account
                    # Find bonus transactions related to this order and reverse them
                    bonus_transactions_result = await db.execute(
                        select(BonusTransaction).filter(
                            and_(
                                BonusTransaction.order_id == order.id,
                                BonusTransaction.transaction_type == BonusTransactionType.DEDUCTION
                            )
                        )
                    )
                    bonus_transactions = bonus_transactions_result.scalars().all()

                    for bonus_tx in bonus_transactions:
                        # Get the bonus account associated with this transaction
                        bonus_account_result = await db.execute(
                            select(BonusAccount).filter(BonusAccount.id == bonus_tx.bonus_account_id)
                        )
                        bonus_account = bonus_account_result.scalar_one_or_none()

                        if bonus_account:
                            # Return the deducted amount to the user's bonus account
                            bonus_account.balance += abs(bonus_tx.amount)

                            # Create a reversal transaction record
                            reversal_transaction = BonusTransaction(
                                bonus_account_id=bonus_account.id,
                                order_id=order.id,  # Link to the order that is being cancelled
                                transaction_date=current_time,  # Use Moscow time for consistency
                                amount=abs(bonus_tx.amount),  # Positive amount for reversal
                                transaction_type=BonusTransactionType.ACCRUAL,
                                description="Возврат бонусов: отмена заказа"
                            )
                            db.add(reversal_transaction)

                    await db.commit()
                    logger.info(f"Order {order.id} cancelled successfully")

                await db.commit()

            except Exception as e:
                logger.error(f"Error in cancel_expired_orders task: {str(e)}")
                await db.rollback()

    async def update_session_statuses(self):
        """Update session statuses based on current time - start time and end time"""
        logger.info("Running session status update task...")

        async with self.SessionLocal() as db:
            try:
                # Get Moscow timezone-aware current time
                moscow_tz = pytz.timezone('Europe/Moscow')
                current_time = datetime.now(moscow_tz)
                # For database comparison, we'll use timezone-naive time (as stored in db)
                current_time_naive = current_time.replace(tzinfo=None)
                logger.info(f"Current time for comparison: {current_time_naive}")

                # Update sessions that have started but are still marked as scheduled
                logger.info("Updating started sessions...")
                started_query = (
                    update(Session)
                    .where(
                        and_(
                            Session.status == SessionStatus.SCHEDULED,
                            # Compare with timezone-naive current time to match database storage format
                            Session.start_datetime <= current_time_naive
                        )
                    )
                    .values(status=SessionStatus.ONGOING)
                )
                started_result = await db.execute(started_query)
                started_count = started_result.rowcount
                logger.info(f"Started sessions updated count: {started_count}")

                # Update sessions that have ended but are still not completed
                logger.info("Updating ended sessions...")
                ended_query = (
                    update(Session)
                    .where(
                        and_(
                            Session.status != SessionStatus.CANCELLED,
                            Session.status != SessionStatus.COMPLETED,
                            # Compare with timezone-naive current time to match database storage format
                            Session.end_datetime < current_time_naive
                        )
                    )
                    .values(status=SessionStatus.COMPLETED)
                )
                ended_result = await db.execute(ended_query)
                ended_count = ended_result.rowcount
                logger.info(f"Ended sessions updated count: {ended_count}")

                await db.commit()

                if started_count > 0 or ended_count > 0:
                    logger.info(f"Updated {started_count} sessions to ongoing and {ended_count} sessions to completed")
                else:
                    logger.info("No session status updates needed")

            except Exception as e:
                logger.error(f"Error in update_session_statuses task: {str(e)}", exc_info=True)
                logger.error(f"Exception type: {type(e)}")
                import traceback
                logger.error(f"Full traceback: {traceback.format_exc()}")
                await db.rollback()

    async def update_completed_order_statuses(self):
        """Update order statuses to 'completed' when all tickets and concession items are used/completed"""
        logger.info("Running completed order status update task...")

        async with self.SessionLocal() as db:
            try:
                # Also check for orders where session time has passed and items are still pending
                # This handles the case where orders should be completed based on time
                current_time = datetime.now(pytz.timezone('Europe/Moscow')).replace(tzinfo=None)

                # Find sessions that have ended
                sessions_result = await db.execute(
                    select(Session)
                    .join(Ticket, Session.id == Ticket.session_id)
                    .join(Order, Ticket.order_id == Order.id)
                    .filter(Session.end_datetime < current_time)
                    .distinct()
                )
                ended_sessions = sessions_result.scalars().all()

                updated_count = 0
                for session in ended_sessions:
                    # Get all orders that have tickets for this ended session
                    orders_with_session_tickets = await db.execute(
                        select(Order)
                        .join(Ticket, Order.id == Ticket.order_id)
                        .filter(Ticket.session_id == session.id)
                    )
                    session_orders = orders_with_session_tickets.scalars().all()

                    for order in session_orders:
                        # If session ended and order is not yet completed, check if it should be marked as completed
                        if order.status not in [OrderStatus.completed, OrderStatus.cancelled, OrderStatus.refunded]:
                            # Get the earliest session time for this order to make sure this session was the determining one
                            ticket_sessions_result = await db.execute(
                                select(Session.start_datetime)
                                .join(Ticket, Ticket.session_id == Session.id)
                                .filter(Ticket.order_id == order.id)
                                .order_by(Session.start_datetime.asc())
                            )
                            session_datetimes = ticket_sessions_result.scalars().all()

                            if session_datetimes:
                                earliest_session_time = min(session_datetimes)
                                # If session has ended, mark order as completed if all items have been processed
                                # Even if not all items are marked as used, if session has passed, we consider it completed
                                if earliest_session_time < current_time:
                                    # If session time has passed, mark order as completed regardless of item usage
                                    # This is the main business rule: once session time passes, order is considered completed
                                    # Explicitly use the value to avoid any enum conversion issues
                                    order.status = OrderStatus.completed  # For OrderStatus, use lowercase member name
                                    logger.info(f"Order {order.id} marked as completed (session time passed)")
                                    updated_count += 1

                if updated_count > 0:
                    await db.commit()
                    logger.info(f"Updated {updated_count} orders to completed status")

            except Exception as e:
                logger.error(f"Error in update_completed_order_statuses task: {str(e)}", exc_info=True)
                await db.rollback()

    def start_scheduler(self):
        """Start the scheduler with all cleanup tasks"""
        self.scheduler.add_job(
            self.cancel_expired_orders,
            trigger=IntervalTrigger(seconds=30),  # Run every 30 seconds to check for expired orders
            id='cancel_expired_orders',
            name='Cancel expired orders',
            replace_existing=True
        )

        # Add the session status update job that runs every minute
        self.scheduler.add_job(
            self.update_session_statuses,
            trigger=IntervalTrigger(minutes=1),  # Run every minute to update session statuses
            id='update_session_statuses',
            name='Update session statuses based on time',
            replace_existing=True
        )

        # Add the completed order status update job that runs every 2 minutes
        self.scheduler.add_job(
            self.update_completed_order_statuses,
            trigger=IntervalTrigger(minutes=2),  # Run every 2 minutes to update completed order statuses
            id='update_completed_order_statuses',
            name='Update completed order statuses',
            replace_existing=True
        )

        self.scheduler.start()
        logger.info("Scheduler started for all tasks")

    def stop_scheduler(self):
        """Stop the scheduler"""
        self.scheduler.shutdown()
        logger.info("Scheduler stopped")