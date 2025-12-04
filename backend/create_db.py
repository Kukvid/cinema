import asyncio
import sys
from pathlib import Path

# Add backend directory to path
sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy import text
from app.database import engine
from app.models import Base

# Import all models to ensure they're registered with Base
from app.models.role import Role
from app.models.cinema import Cinema
from app.models.hall import Hall
from app.models.seat import Seat
from app.models.film import Film
from app.models.distributor import Distributor
from app.models.rental_contract import RentalContract
from app.models.payment_history import PaymentHistory
from app.models.session import Session
from app.models.user import User
from app.models.bonus_account import BonusAccount
from app.models.bonus_transaction import BonusTransaction
from app.models.promocode import Promocode
from app.models.order import Order
from app.models.ticket import Ticket
from app.models.payment import Payment
from app.models.concession_item import ConcessionItem
from app.models.concession_preorder import ConcessionPreorder
from app.models.report import Report


async def drop_all_tables():
    """Drop all existing tables"""
    print("Dropping all existing tables...")

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    print("All tables dropped successfully!")


async def create_all_tables():
    """Create all tables defined in models"""
    print("Creating all database tables...")

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    print("All tables created successfully!")


async def verify_tables():
    """Verify that tables were created"""
    print("\nVerifying created tables...")

    async with engine.begin() as conn:
        # Query to get all table names from database
        result = await conn.execute(text("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            ORDER BY table_name;
        """))

        tables = result.fetchall()

        if tables:
            print(f"\nFound {len(tables)} tables in database:")
            for table in tables:
                print(f"  ✓ {table[0]}")
        else:
            print("  ⚠ No tables found!")

    return len(tables) > 0


async def get_database_info():
    """Get database connection information"""
    from app.config import settings

    # Parse DATABASE_URL to hide password
    db_url = settings.DATABASE_URL
    if "@" in db_url:
        # Format: postgresql+asyncpg://user:password@host:port/dbname
        protocol, rest = db_url.split("://")
        if "@" in rest:
            credentials, location = rest.split("@")
            username = credentials.split(":")[0]
            masked_url = f"{protocol}://{username}:****@{location}"
        else:
            masked_url = db_url
    else:
        masked_url = db_url

    return masked_url


async def main():
    """Main function to create database schema"""
    print("=" * 70)
    print("CINEMA MANAGEMENT SYSTEM - DATABASE INITIALIZATION")
    print("=" * 70)

    try:
        # Show database info
        db_info = await get_database_info()
        print(f"\nDatabase URL: {db_info}")

        # Ask for confirmation
        print("\n⚠️  WARNING: This will DROP all existing tables and recreate them!")
        print("⚠️  All existing data will be LOST!")
        response = input("\nDo you want to continue? (yes/no): ")

        if response.lower() not in ["yes", "y"]:
            print("\nOperation cancelled by user.")
            return

        print("\n" + "=" * 70)

        # Drop all tables
        await drop_all_tables()

        print("\n" + "-" * 70)

        # Create all tables
        await create_all_tables()

        print("\n" + "-" * 70)

        # Verify tables
        success = await verify_tables()

        print("\n" + "=" * 70)

        if success:
            print("✓ DATABASE INITIALIZATION completed SUCCESSFULLY!")
            print("=" * 70)
            print("\nNext steps:")
            print("  1. Run 'python seed.py' to populate database with test data")
            print("  2. Start the FastAPI server with 'uvicorn app.main:app --reload'")
        else:
            print("✗ DATABASE INITIALIZATION FAILED!")
            print("=" * 70)
            print("\nPlease check the error messages above.")

        print("\n" + "=" * 70)

    except Exception as e:
        print("\n" + "=" * 70)
        print(f"✗ ERROR: {e}")
        print("=" * 70)
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        # Close the engine
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
