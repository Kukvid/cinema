from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import settings
from app.database import engine
from app.models import Base
from app.tasks import OrderCleanupService
from app.utils import LoggingMiddleware
from app.admin import setup_admin

# Global task service instance
task_service = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global task_service
    # Startup
    print("Starting up Cinema Management System...")
    # Database tables will be created by Alembic migrations

    # Initialize and start order cleanup service
    task_service = OrderCleanupService(settings.DATABASE_URL)
    task_service.start_scheduler()
    print("Order cleanup service started")

    # Setup admin panel
    try:

        setup_admin(app, engine)
    except ImportError as e:
        print(f"Admin panel failed to load: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
    yield

    # Shutdown
    print("Shutting down...")
    if task_service:
        task_service.stop_scheduler()
    await engine.dispose()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Logging middleware - should be added early in the middleware chain
app.add_middleware(LoggingMiddleware)


@app.get("/")
async def root():
    return {
        "message": "Cinema Management System API",
        "version": settings.APP_VERSION,
        "status": "operational"
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


# Include routers
from app.routers import (
    auth, cinemas, halls, films, genres, sessions,
    bookings, concessions, distributors, contracts, food_categories, promocodes, tickets, payments,
    users, roles, reports, seats, qr_scanner, dashboard
)

app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(cinemas.router, prefix="/api/v1/cinemas", tags=["Cinemas"])
app.include_router(halls.router, prefix="/api/v1/halls", tags=["Halls"])
app.include_router(films.router, prefix="/api/v1/films", tags=["Films"])
app.include_router(genres.router, prefix="/api/v1/genres", tags=["Genres"])
app.include_router(sessions.router, prefix="/api/v1/sessions", tags=["Sessions"])
app.include_router(bookings.router, prefix="/api/v1/bookings", tags=["Bookings"])
app.include_router(concessions.router, prefix="/api/v1/concessions", tags=["Concessions"])
app.include_router(food_categories.router, prefix="/api/v1/food-categories", tags=["Food Categories"])
app.include_router(distributors.router, prefix="/api/v1/distributors", tags=["Distributors"])
app.include_router(contracts.router, prefix="/api/v1/contracts", tags=["Contracts"])
app.include_router(promocodes.router, prefix="/api/v1/promocodes", tags=["Promocodes"])
app.include_router(tickets.router, prefix="/api/v1/tickets", tags=["Tickets"])
app.include_router(payments.router, prefix="/api/v1/payments", tags=["Payments"])
app.include_router(qr_scanner.router, prefix="/api/v1/qr-scanner", tags=["QR Scanner"])
app.include_router(dashboard.router, prefix="/api/v1/dashboard", tags=["Dashboard"])
app.include_router(users.router, prefix="/api/v1/users", tags=["Users"])
app.include_router(roles.router, prefix="/api/v1/roles", tags=["Roles"])
app.include_router(reports.router, prefix="/api/v1/reports", tags=["Reports"])
app.include_router(seats.router, prefix="/api/v1/seats", tags=["Seats"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
