# Cinema Management System - Improvements and Additions

## Analysis of Current Task Logic

### 1. `cancel_expired_orders` task
- **Current functionality**: Cancels orders that exceed payment timeout and returns tickets/concessions to stock
- **Issue handling**: Properly reverses bonus transactions and updates stock quantities
- **Frequency**: Runs every 30 seconds

### 2. `update_session_statuses` task
- **Current functionality**: Updates session statuses based on start/end times
- **Logic**: Changes SCHEDULED → ONGOING when start time is passed, and unfinished sessions → COMPLETED when end time is passed
- **Frequency**: Runs every 1 minute

### 3. `update_completed_order_statuses` task
- **Current functionality**: Marks orders as completed when all related sessions have ended
- **Logic**: Checks if the earliest session time for an order has passed
- **Frequency**: Runs every 2 minutes

## Recommendations for Improvements and Additions

### 1. Ticket/Order Logic Improvements

#### 1.1. Refund Processing Task
```python
async def process_refunded_orders(self):
    """Process orders that have been refunded and return tickets to inventory"""
    logger.info("Running refunded order processing task...")
    
    async with self.SessionLocal() as db:
        try:
            # Find orders with refunded status
            refunded_orders_result = await db.execute(
                select(Order).filter(Order.status == OrderStatus.refunded)
            )
            refunded_orders = refunded_orders_result.scalars().all()
            
            for order in refunded_orders:
                # Update tickets to available status
                await db.execute(
                    update(Ticket)
                    .where(Ticket.order_id == order.id)
                    .values(status=TicketStatus.AVAILABLE)
                )
                
                # Handle concession preorders
                await db.execute(
                    update(ConcessionPreorder)
                    .where(ConcessionPreorder.order_id == order.id)
                    .values(status=PreorderStatus.AVAILABLE)
                )
                
                # Update concession item stock
                preorders_result = await db.execute(
                    select(ConcessionPreorder)
                    .filter(ConcessionPreorder.order_id == order.id)
                )
                preorders = preorders_result.scalars().all()
                
                for preorder in preorders:
                    await db.execute(
                        update(ConcessionItem)
                        .where(ConcessionItem.id == preorder.concession_item_id)
                        .values(stock_quantity=ConcessionItem.stock_quantity + preorder.quantity)
                    )
                
                await db.commit()
        except Exception as e:
            logger.error(f"Error in process_refunded_orders task: {str(e)}")
            await db.rollback()
```

#### 1.2. Late Payment Orders Task
```python
async def process_late_payment_orders(self):
    """Handle orders that are pending payment but past their payment deadline"""
    logger.info("Running late payment orders processing task...")
    
    async with self.SessionLocal() as db:
        try:
            current_time = datetime.now(pytz.timezone('Europe/Moscow')).replace(tzinfo=None)
            
            # Find orders that were pending payment but missed deadline
            late_orders_result = await db.execute(
                select(Order).filter(
                    Order.status == OrderStatus.pending_payment,
                    Order.payment_deadline < current_time
                )
            )
            late_orders = late_orders_result.scalars().all()
            
            for order in late_orders:
                logger.info(f"Processing late payment order: {order.id}")
                
                # Send notifications to users
                # Could integrate with email/SMS services
                
                # Mark as requiring special attention
                order.status = OrderStatus.PAYMENT_OVERDUE
                await db.commit()
                
        except Exception as e:
            logger.error(f"Error in process_late_payment_orders task: {str(e)}")
            await db.rollback()
```

### 2. Bonus System Improvements

#### 2.1. Bonus Expiration Task
```python
async def expire_bonus_points(self):
    """Expire bonus points that have exceeded their validity period"""
    logger.info("Running bonus points expiration task...")
    
    async with self.SessionLocal() as db:
        try:
            current_time = datetime.now(pytz.timezone('Europe/Moscow')).replace(tzinfo=None)
            
            # Find bonus accounts with points that have expired
            expired_bonuses_result = await db.execute(
                select(BonusAccount).filter(
                    BonusAccount.last_accrual_date < current_time - timedelta(days=365)  # 1 year validity
                )
            )
            expired_bonuses = expired_bonuses_result.scalars().all()
            
            for bonus_account in expired_bonuses:
                if bonus_account.balance > 0:
                    # Create expiration transaction
                    expiration_transaction = BonusTransaction(
                        bonus_account_id=bonus_account.id,
                        transaction_date=current_time,
                        amount=-bonus_account.balance,
                        transaction_type=BonusTransactionType.EXPIRATION,
                        description="Истечение срока действия бонусов"
                    )
                    db.add(expiration_transaction)
                    
                    # Reset balance
                    bonus_account.balance = 0
            
            await db.commit()
        except Exception as e:
            logger.error(f"Error in expire_bonus_points task: {str(e)}")
            await db.rollback()
```

#### 2.2. Bonus Accrual for Completed Orders
```python
async def accrue_bonus_for_completed_orders(self):
    """Award bonus points for completed orders that haven't been rewarded yet"""
    logger.info("Running bonus accrual task for completed orders...")
    
    async with self.SessionLocal() as db:
        try:
            # Find completed orders that haven't received bonus points yet
            completed_orders_result = await db.execute(
                select(Order).filter(
                    Order.status == OrderStatus.completed,
                    ~exists().where(
                        and_(
                            BonusTransaction.order_id == Order.id,
                            BonusTransaction.transaction_type == BonusTransactionType.ACCRUAL
                        )
                    )
                )
            )
            completed_orders = completed_orders_result.scalars().all()
            
            for order in completed_orders:
                # Calculate bonus points (e.g., 5% of order value)
                bonus_points = int(order.final_amount * 0.05)
                
                # Find or create bonus account
                bonus_account_result = await db.execute(
                    select(BonusAccount).filter(BonusAccount.user_id == order.user_id)
                )
                bonus_account = bonus_account_result.scalar_one_or_none()
                
                if bonus_account:
                    # Create bonus transaction
                    bonus_transaction = BonusTransaction(
                        bonus_account_id=bonus_account.id,
                        order_id=order.id,
                        transaction_date=datetime.now(pytz.timezone('Europe/Moscow')).replace(tzinfo=None),
                        amount=bonus_points,
                        transaction_type=BonusTransactionType.ACCRUAL,
                        description="Бонусы за выполненный заказ"
                    )
                    db.add(bonus_transaction)
                    
                    # Update balance
                    bonus_account.balance += bonus_points
            
            await db.commit()
        except Exception as e:
            logger.error(f"Error in accrue_bonus_for_completed_orders task: {str(e)}")
            await db.rollback()
```

### 3. Concession Items Logic

#### 3.1. Low Stock Alert Task
```python
async def check_low_stock_items(self):
    """Check for concession items running low on stock and send alerts"""
    logger.info("Running low stock alert task...")
    
    async with self.SessionLocal() as db:
        try:
            # Find items with stock below threshold (e.g., 20% of max stock)
            low_stock_items_result = await db.execute(
                select(ConcessionItem).filter(
                    ConcessionItem.stock_quantity < (ConcessionItem.max_stock_quantity * 0.2)
                )
            )
            low_stock_items = low_stock_items_result.scalars().all()
            
            for item in low_stock_items:
                logger.warning(f"Low stock alert: {item.name} - {item.stock_quantity} units remaining")
                
                # Could send notifications to managers/admins
                # Could trigger automatic reordering
        except Exception as e:
            logger.error(f"Error in check_low_stock_items task: {str(e)}")
```

#### 3.2. Concession Preorder Expiration Task
```python
async def cancel_expired_concession_preorders(self):
    """Cancel concession preorders that have expired without collection"""
    logger.info("Running expired concession preorder task...")
    
    async with self.SessionLocal() as db:
        try:
            current_time = datetime.now(pytz.timezone('Europe/Moscow')).replace(tzinfo=None)
            
            # Find preorders that are pending and past their collection deadline
            expired_preorders_result = await db.execute(
                select(ConcessionPreorder).filter(
                    ConcessionPreorder.status == PreorderStatus.PENDING,
                    ConcessionPreorder.collection_deadline < current_time
                )
            )
            expired_preorders = expired_preorders_result.scalars().all()
            
            for preorder in expired_preorders:
                # Update status to expired
                preorder.status = PreorderStatus.EXPIRED
                
                # Return items to stock
                await db.execute(
                    update(ConcessionItem)
                    .where(ConcessionItem.id == preorder.concession_item_id)
                    .values(stock_quantity=ConcessionItem.stock_quantity + preorder.quantity)
                )
            
            await db.commit()
        except Exception as e:
            logger.error(f"Error in cancel_expired_concession_preorders task: {str(e)}")
            await db.rollback()
```

### 4. Session and Ticket Logic

#### 4.1. Session Cleanup Task
```python
async def cleanup_completed_sessions(self):
    """Archive or clean up old completed sessions to improve performance"""
    logger.info("Running completed session cleanup task...")
    
    async with self.SessionLocal() as db:
        try:
            # Find sessions completed more than 30 days ago
            cleanup_date = datetime.now(pytz.timezone('Europe/Moscow')).replace(tzinfo=None) - timedelta(days=30)
            
            old_sessions_result = await db.execute(
                select(Session).filter(
                    Session.status == SessionStatus.COMPLETED,
                    Session.end_datetime < cleanup_date
                )
            )
            old_sessions = old_sessions_result.scalars().all()
            
            # Could move data to archive tables or perform other cleanup operations
            # This helps maintain database performance
            
        except Exception as e:
            logger.error(f"Error in cleanup_completed_sessions task: {str(e)}")
```

#### 4.2. Ticket Usage Reminder Task
```python
async def send_ticket_usage_reminders(self):
    """Send reminders to users about upcoming sessions"""
    logger.info("Running ticket usage reminder task...")
    
    async with self.SessionLocal() as db:
        try:
            current_time = datetime.now(pytz.timezone('Europe/Moscow')).replace(tzinfo=None)
            reminder_time = current_time + timedelta(hours=2)  # 2 hours before session
            
            # Find tickets for sessions starting in 2 hours
            upcoming_sessions_result = await db.execute(
                select(Ticket)
                .join(Session, Ticket.session_id == Session.id)
                .filter(
                    Session.start_datetime >= current_time,
                    Session.start_datetime <= reminder_time,
                    Ticket.status == TicketStatus.PAID  # Only send to paid tickets
                )
            )
            upcoming_tickets = upcoming_sessions_result.scalars().all()
            
            # Send reminders to users (could be email/SMS)
            for ticket in upcoming_tickets:
                logger.info(f"Sending reminder for ticket {ticket.id} to user {ticket.order.user_id}")
                
                # Implementation would involve notification service
        except Exception as e:
            logger.error(f"Error in send_ticket_usage_reminders task: {str(e)}")
```

### 5. Additional Feature Suggestions

#### 5.1. Dynamic Pricing based on Demand
Implement algorithm to adjust ticket prices based on session popularity and time until start.

#### 5.2. Integration with External Payment Gateways
Enhance payment processing with real payment gateways beyond the test system.

#### 5.3. Revenue Analytics
Add tasks to generate daily/weekly/monthly revenue reports and analytics.

#### 5.4. User Engagement Metrics
Track user behavior and engagement to improve the system and marketing efforts.

#### 5.5. Seat Availability Optimization
Advanced algorithms to optimize seat allocation based on demand forecasting.

#### 5.6. Multi-Lingual Support
Add support for multiple languages for international users.

#### 5.7. Advanced Reporting
More comprehensive reporting system for managers and administrators.

#### 5.8. Integration with External Systems
Connect with external cinema management, movie distribution, or marketing platforms.

These additions would significantly enhance the robustness, functionality, and user experience of the cinema management system.