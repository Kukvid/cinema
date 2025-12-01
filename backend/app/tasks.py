from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, update
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
        
        async with self.SessionLocal() as db:
            try:
                # Find orders that are pending payment and have exceeded expiration time
                current_time = datetime.utcnow()
                
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
                    
                    # Update tickets status to expired
                    await db.execute(
                        update(Ticket)
                        .where(Ticket.order_id == order.id)
                        .values(status=TicketStatus.EXPIRED)
                    )
                    
                    # Update concession preorders to cancelled
                    await db.execute(
                        update(ConcessionPreorder)
                        .where(ConcessionPreorder.order_id == order.id)
                        .values(status=PreorderStatus.CANCELLED)
                    )

                    # Return concession items to stock/inventory by incrementing stock quantity
                    # This is done by updating the concession items to increase their stock quantity
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
                    # This is done when payment happens, but we need to account for any bonus-related adjustments
                    # When order is cancelled it means payment never happened, so if we had processed bonus deductions,
                    # they should be returned. However, in our current system we don't deduct bonuses until payment.
                    # In case payment was made but not confirmed, we might need to return bonuses.
                    # For now, we'll check if there were any bonus transactions for this order and handle accordingly.

                    # Find bonus transactions related to this order and reverse them
                    # This includes both deductions and accural transactions
                    from sqlalchemy import and_
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
                            bonus_account.balance += abs(bonus_tx.amount)  # Using abs() to ensure positive value

                            # Create a reversal transaction record
                            reversal_transaction = BonusTransaction(
                                bonus_account_id=bonus_account.id,
                                order_id=order.id,  # Link to the order that is being cancelled
                                transaction_date=datetime.utcnow(),
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
                
    def start_scheduler(self):
        """Start the scheduler with the cleanup task"""
        self.scheduler.add_job(
            self.cancel_expired_orders,
            trigger=IntervalTrigger(seconds=30),  # Run every 30 seconds to check for expired orders
            id='cancel_expired_orders',
            name='Cancel expired orders',
            replace_existing=True
        )
        
        self.scheduler.start()
        logger.info("Scheduler started for order cleanup")

    def stop_scheduler(self):
        """Stop the scheduler"""
        self.scheduler.shutdown()
        logger.info("Scheduler stopped")