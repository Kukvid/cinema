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
from app.models.enums import OrderStatus, TicketStatus, PreorderStatus
from app.database import engine, get_db
from app.models.bonus_account import BonusAccount
from app.models.bonus_transaction import BonusTransaction
from app.models.enums import BonusTransactionType
from app.models.session import Session
from app.models.enums import SessionStatus
import pytz

logger = logging.getLogger(__name__)

class OrderCleanupService:
    def __init__(self, db_url: str):
        self.db_url = db_url
        self.engine = create_async_engine(db_url)
        self.SessionLocal = sessionmaker(self.engine, class_=AsyncSession, expire_on_commit=False)
        self.scheduler = AsyncIOScheduler()

    async def cancel_expired_orders(self):
        """Cancel orders that have exceeded payment timeout and return tickets/concessions to stock"""
        logger.info("Running expired order cleanup task...")

        # Create a new database session for the background task
        async with self.SessionLocal() as db:
            try:
                # Find orders that are pending payment and have exceeded expiration time
                current_time =datetime.now(pytz.timezone('Europe/Moscow')).replace(tzinfo=None)

                expired_orders_result = await db.execute(
                    select(Order).filter(
                        Order.status.in_([OrderStatus.CREATED, OrderStatus.PENDING_PAYMENT]),
                        Order.expires_at < current_time
                    )
                )
                expired_orders = expired_orders_result.scalars().all()

                for order in expired_orders:
                    logger.info(f"Cancelling expired order: {order.id}")

                    # Update order status to cancelled
                    order.status = OrderStatus.CANCELLED
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
                current_time = datetime.now(pytz.timezone('Europe/Moscow')).replace(tzinfo=None)

                # Update sessions that have started but are still marked as scheduled
                started_result = await db.execute(
                    update(Session)
                    .where(
                        and_(
                            Session.status == SessionStatus.SCHEDULED,
                            Session.start_datetime <= current_time
                        )
                    )
                    .values(status=SessionStatus.IN_PROGRESS)
                )
                started_count = started_result.rowcount

                # Update sessions that have ended but are still not completed
                ended_result = await db.execute(
                    update(Session)
                    .where(
                        and_(
                            Session.status != SessionStatus.CANCELLED,
                            Session.status != SessionStatus.COMPLETED,
                            Session.end_datetime < current_time
                        )
                    )
                    .values(status=SessionStatus.COMPLETED)
                )
                ended_count = ended_result.rowcount

                await db.commit()

                if started_count > 0 or ended_count > 0:
                    logger.info(f"Updated {started_count} sessions to IN_PROGRESS and {ended_count} sessions to COMPLETED")
                else:
                    logger.info("No session status updates needed")

            except Exception as e:
                logger.error(f"Error in update_session_statuses task: {str(e)}")
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

        self.scheduler.start()
        logger.info("Scheduler started for all tasks")

    def stop_scheduler(self):
        """Stop the scheduler"""
        self.scheduler.shutdown()
        logger.info("Scheduler stopped")