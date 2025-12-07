from typing import Annotated, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from datetime import datetime
import pytz

from app.database import get_db
from app.models.user import User
from app.models.order import Order
from app.models.ticket import Ticket
from app.models.session import Session
from app.models.film import Film
from app.models.cinema import Cinema
from app.models.hall import Hall
from app.models.enums import UserRoles, OrderStatus, TicketStatus
from app.routers.auth import get_current_active_user
from pydantic import BaseModel

router = APIRouter()


class DashboardStatsResponse(BaseModel):
    total_users: int
    active_films: int
    today_sessions: int
    monthly_revenue: float
    cinema_id: int = None


@router.get("/stats", response_model=Dict[str, Any])
async def get_dashboard_stats(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db)
):
    """Get dashboard statistics with proper filtering based on user role."""

    # Define timezone for time calculations
    moscow_tz = pytz.timezone('Europe/Moscow')
    current_time = datetime.now(moscow_tz).replace(tzinfo=None)

    # Determine if user is super_admin (no filtering needed)
    is_super_admin = current_user.role.name == UserRoles.super_admin

    # For non-super-admin users (staff, admin), get their assigned cinema
    cinema_id = None
    if not is_super_admin and current_user.role.name in [UserRoles.admin, UserRoles.staff]:
        # Get the user's assigned cinema from the user model
        if not current_user.cinema_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User is not associated with any cinema"
            )
        cinema_id = current_user.cinema_id

    # Count total users - no cinema filter needed for this stat
    users_query = select(func.count(User.id))
    users_result = await db.execute(users_query)
    total_users = users_result.scalar_one()

    # Count today's sessions
    today_start = current_time.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = current_time.replace(hour=23, minute=59, second=59, microsecond=999999)

    sessions_query = select(func.count(Session.id)).join(Film).join(Hall)

    # Add cinema filter for non-super-admin users
    if cinema_id is not None:
        sessions_query = sessions_query.join(Cinema).filter(Cinema.id == cinema_id)

    sessions_query = sessions_query.filter(
        and_(
            Session.start_datetime >= today_start,
            Session.start_datetime <= today_end
        )
    )

    sessions_result = await db.execute(sessions_query)
    today_sessions = sessions_result.scalar_one()

    # Count active films (films with sessions today)
    active_films_query = select(func.count(func.distinct(Session.film_id))).join(Film).join(Hall)

    # Add cinema filter for non-super-admin users
    if cinema_id is not None:
        active_films_query = active_films_query.join(Cinema).filter(Cinema.id == cinema_id)

    active_films_query = active_films_query.filter(
        and_(
            Session.start_datetime >= today_start,
            Session.start_datetime <= today_end
        )
    )

    active_films_result = await db.execute(active_films_query)
    active_films = active_films_result.scalar_one()

    # Calculate monthly revenue
    month_start = current_time.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # Start with orders paid this month
    revenue_query = select(func.coalesce(func.sum(Order.final_amount), 0.0)).filter(
        and_(
            Order.status == OrderStatus.paid,
            Order.created_at >= month_start
        )
    )

    # If we need cinema filtering, join through tickets
    if cinema_id is not None:
        revenue_query = revenue_query.join(Ticket, Order.id == Ticket.order_id) \
            .join(Session, Ticket.session_id == Session.id) \
            .join(Hall, Session.hall_id == Hall.id) \
            .join(Cinema, Hall.cinema_id == Cinema.id) \
            .filter(Cinema.id == cinema_id) \
            .distinct()

    revenue_result = await db.execute(revenue_query)
    monthly_revenue = float(revenue_result.scalar_one())

    # Return the statistics
    return {
        "total_users": total_users,
        "active_films": active_films,
        "today_sessions": today_sessions,
        "monthly_revenue": monthly_revenue,
        "cinema_id": cinema_id  # Include cinema_id if user is not super_admin
    }