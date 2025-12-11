import asyncio
import sys
from pathlib import Path
from datetime import datetime, timedelta, date
import random
from decimal import Decimal

# Add backend directory to path
sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models.cinema import Cinema
from app.models.film import Film
from app.models.distributor import Distributor
from app.models.rental_contract import RentalContract
from app.models.hall import Hall
from app.models.session import Session
from app.models.user import User
from app.models.order import Order
from app.models.ticket import Ticket
from app.models.seat import Seat
from app.models.enums import ContractStatus, SessionStatus, OrderStatus, TicketStatus, SalesChannel
from app.utils.qr_generator import generate_ticket_qr


async def create_demo_contracts():
    """Create demonstration contracts with expired dates, sessions, and ticket sales to demonstrate payment functionality"""
    print("Creating demonstration contracts with expired dates, sessions, and ticket sales...")

    async with AsyncSessionLocal() as db:
        # Get existing data needed
        print("Fetching existing data...")
        cinemas = await db.execute(select(Cinema))
        cinema_list = cinemas.scalars().all()
        if not cinema_list:
            print("No cinemas found - please run seed.py first")
            return

        films = await db.execute(select(Film))
        film_list = films.scalars().all()
        if not film_list:
            print("No films found - please run seed.py first")
            return

        distributors = await db.execute(select(Distributor))
        distributor_list = distributors.scalars().all()
        if not distributor_list:
            print("No distributors found - please run seed.py first")
            return

        # Get users for orders (regular users)
        users = await db.execute(select(User).where(User.role.has(name="user")).limit(5))
        user_list = users.scalars().all()
        if not user_list:
            print("No users found - please run seed.py first")
            return

        # Get halls for sessions
        halls = await db.execute(select(Hall).limit(10))
        hall_list = halls.scalars().all()
        if not hall_list:
            print("No halls found - please run seed.py first")
            return

        print(f"Found {len(cinema_list)} cinemas, {len(film_list)} films, {len(distributor_list)} distributors, {len(user_list)} users, {len(hall_list)} halls")

        # Create expired contract 1 (with ACTIVE status - let system handle the transition)
        print("\nCreating contract 1 that will expire...")
        expired_contract_1 = RentalContract(
            film_id=film_list[0].id,
            distributor_id=distributor_list[0].id,
            cinema_id=cinema_list[0].id,
            contract_number=f"DEMO-{date.today().year}-{random.randint(100000, 999999)}-002",
            contract_date=date.today() - timedelta(days=90),  # Signed 3 months ago
            rental_start_date=date.today() - timedelta(days=60),  # Started 2 months ago
            rental_end_date=date.today() - timedelta(days=15),  # Ended 15 days ago (expired!)
            distributor_percentage=Decimal("20.00"),  # 20% for the distributor
            status=ContractStatus.ACTIVE  # Start as ACTIVE - system should transition to PENDING when payment is created
        )
        db.add(expired_contract_1)
        await db.flush()  # Get the ID

        # Create sessions for the expired contract period
        print("Creating sessions for expired contract 1...")
        session_dates = [
            datetime.now() - timedelta(days=50),
            datetime.now() - timedelta(days=45),
            datetime.now() - timedelta(days=40),
            datetime.now() - timedelta(days=35),
        ]
        sessions_1 = []
        for session_date in session_dates:
            # Create a session during the contract period
            session_start = session_date.replace(hour=14, minute=0, second=0, microsecond=0)
            session_end = session_start + timedelta(hours=2, minutes=30)  # 2.5 hours duration

            session = Session(
                film_id=expired_contract_1.film_id,
                hall_id=random.choice(hall_list).id,
                start_datetime=session_start,
                end_datetime=session_end,
                ticket_price=Decimal("450.00"),
                status=SessionStatus.COMPLETED
            )
            db.add(session)
            await db.flush()  # Get the ID
            sessions_1.append(session)

        # Find seats for these sessions (get all seats in halls used)
        seats_result = await db.execute(
            select(Seat).where(Seat.hall_id.in_([s.hall_id for s in sessions_1]))
        )
        all_seats = seats_result.scalars().all()

        # Create orders and tickets for these sessions
        print("Creating orders and tickets for expired contract 1...")
        for session in sessions_1:
            # Create 1-3 orders per session
            num_orders = random.randint(1, 3)
            for _ in range(num_orders):
                user = random.choice(user_list)
                
                # Create order
                order = Order(
                    user_id=user.id,
                    order_number=f"DEMO{random.randint(100000, 999999)}",
                    created_at=session.start_datetime - timedelta(minutes=30),
                    expires_at=session.start_datetime - timedelta(minutes=10),
                    total_amount=Decimal("0.00"),
                    discount_amount=Decimal("0.00"),
                    final_amount=Decimal("0.00"),
                    status=OrderStatus.paid  # Mark as paid
                )
                db.add(order)
                await db.flush()  # Get the ID

                # Create 1-5 tickets for this order for this session
                num_tickets = random.randint(1, 5)
                selected_seats = random.sample(all_seats, min(num_tickets, len(all_seats)))
                
                total_session_price = Decimal("0.00")
                for seat in selected_seats:
                    ticket = Ticket(
                        session_id=session.id,
                        seat_id=seat.id,
                        buyer_id=user.id,
                        order_id=order.id,
                        seller_id=None,  # No specific seller
                        price=session.ticket_price,
                        purchase_date=session.start_datetime - timedelta(minutes=15),  # Ticket bought before session
                        sales_channel=SalesChannel.ONLINE,
                        status=TicketStatus.PAID
                    )
                    db.add(ticket)
                    total_session_price += session.ticket_price

                # Update order totals
                order.total_amount = total_session_price
                order.final_amount = total_session_price
                
                await db.flush()

        # Create contract 2 (with ACTIVE status - let system handle the transition)
        print("\nCreating contract 2 that will expire...")
        expired_contract_2 = RentalContract(
            film_id=film_list[1].id,
            distributor_id=distributor_list[1].id,
            cinema_id=cinema_list[1].id,
            contract_number=f"DEMO-{date.today().year}-{random.randint(100000, 999999)}-004",
            contract_date=date.today() - timedelta(days=120),  # Signed 4 months ago
            rental_start_date=date.today() - timedelta(days=90),  # Started 3 months ago
            rental_end_date=date.today() - timedelta(days=30),  # Ended 30 days ago (expired!)
            distributor_percentage=Decimal("25.00"),  # 25% for the distributor
            status=ContractStatus.ACTIVE  # Start as ACTIVE - system should transition to PENDING when payment is created
        )
        db.add(expired_contract_2)
        await db.flush()  # Get the ID

        # Create sessions for the second expired contract
        print("Creating sessions for expired contract 2...")
        session_dates_2 = [
            datetime.now() - timedelta(days=75),
            datetime.now() - timedelta(days=70),
            datetime.now() - timedelta(days=65),
        ]
        sessions_2 = []
        for session_date in session_dates_2:
            session_start = session_date.replace(hour=18, minute=30, second=0, microsecond=0)
            session_end = session_start + timedelta(hours=2, minutes=15)

            session = Session(
                film_id=expired_contract_2.film_id,
                hall_id=random.choice(hall_list).id,
                start_datetime=session_start,
                end_datetime=session_end,
                ticket_price=Decimal("500.00"),
                status=SessionStatus.COMPLETED
            )
            db.add(session)
            await db.flush()  # Get the ID
            sessions_2.append(session)

        # Create orders and tickets for second contract sessions
        print("Creating orders and tickets for expired contract 2...")
        for session in sessions_2:
            # Create 2-4 orders per session
            num_orders = random.randint(2, 4)
            for _ in range(num_orders):
                user = random.choice(user_list)
                
                # Create order
                order = Order(
                    user_id=user.id,
                    order_number=f"DEMO{random.randint(100000, 999999)}",
                    created_at=session.start_datetime - timedelta(minutes=30),
                    expires_at=session.start_datetime - timedelta(minutes=10),
                    total_amount=Decimal("0.00"),
                    discount_amount=Decimal("0.00"),
                    final_amount=Decimal("0.00"),
                    status=OrderStatus.paid
                )
                db.add(order)
                await db.flush()

                # Create tickets for this order
                num_tickets = random.randint(2, 4)
                selected_seats = random.sample(all_seats, min(num_tickets, len(all_seats)))
                
                total_session_price = Decimal("0.00")
                for seat in selected_seats:
                    ticket = Ticket(
                        session_id=session.id,
                        seat_id=seat.id,
                        buyer_id=user.id,
                        order_id=order.id,
                        seller_id=None,
                        price=session.ticket_price,
                        purchase_date=session.start_datetime - timedelta(minutes=20),
                        sales_channel=SalesChannel.ONLINE,
                        status=TicketStatus.PAID
                    )
                    db.add(ticket)
                    total_session_price += session.ticket_price

                # Update order totals
                order.total_amount = total_session_price
                order.final_amount = total_session_price
                
                await db.flush()

        # Create an active contract for comparison (not expired)
        print("\nCreating active contract for comparison...")
        active_contract = RentalContract(
            film_id=film_list[2].id,
            distributor_id=distributor_list[0].id,
            cinema_id=cinema_list[0].id,
            contract_number=f"DEMO-{date.today().year}-{random.randint(100000, 999999)}-003",
            contract_date=date.today() - timedelta(days=10),  # Signed 10 days ago
            rental_start_date=date.today(),  # Starts today
            rental_end_date=date.today() + timedelta(days=30),  # Ends in 30 days
            distributor_percentage=Decimal("15.00"),  # 15% for the distributor
            status=ContractStatus.ACTIVE
        )
        db.add(active_contract)
        await db.flush()

        # Create some future sessions for the active contract
        print("Creating future sessions for active contract...")
        for i in range(2):  # 2 future sessions
            session_start = datetime.now() + timedelta(days=5 + i*2)
            session_start = session_start.replace(hour=19, minute=0, second=0, microsecond=0)
            session_end = session_start + timedelta(hours=2, minutes=45)

            session = Session(
                film_id=active_contract.film_id,
                hall_id=random.choice(hall_list).id,
                start_datetime=session_start,
                end_datetime=session_end,
                ticket_price=Decimal("480.00"),
                status=SessionStatus.SCHEDULED
            )
            db.add(session)

        await db.commit()
        print(f"\nSuccessfully created 2 expired contracts (status ACTIVE) with sessions and ticket sales:")
        print(f"- Contract 1: {expired_contract_1.contract_number} (ended {expired_contract_1.rental_end_date}) - status: {expired_contract_1.status}")
        print(f"- Contract 2: {expired_contract_2.contract_number} (ended {expired_contract_2.rental_end_date}) - status: {expired_contract_2.status}")
        print(f"- Active Contract: {active_contract.contract_number} (ends {active_contract.rental_end_date}) - status: {active_contract.status}")
        print("\nThese contracts have completed sessions with paid tickets,")
        print("which can be used to demonstrate the payment creation functionality.")
        print("Run the expiration task to transition expired contracts to PENDING status and generate payments.")


if __name__ == "__main__":
    asyncio.run(create_demo_contracts())