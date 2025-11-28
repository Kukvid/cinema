from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import settings
from app.database import engine
from app.models import Base


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("Starting up Cinema Management System...")
    # Database tables will be created by Alembic migrations
    yield
    # Shutdown
    print("Shutting down...")
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
    bookings, concessions, distributors, contracts
)

app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(cinemas.router, prefix="/api/v1/cinemas", tags=["Cinemas"])
app.include_router(halls.router, prefix="/api/v1/halls", tags=["Halls"])
app.include_router(films.router, prefix="/api/v1/films", tags=["Films"])
app.include_router(genres.router, prefix="/api/v1/genres", tags=["Genres"])
app.include_router(sessions.router, prefix="/api/v1/sessions", tags=["Sessions"])
app.include_router(bookings.router, prefix="/api/v1/bookings", tags=["Bookings"])
app.include_router(concessions.router, prefix="/api/v1/concessions", tags=["Concessions"])
app.include_router(distributors.router, prefix="/api/v1/distributors", tags=["Distributors"])
app.include_router(contracts.router, prefix="/api/v1/contracts", tags=["Contracts"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
