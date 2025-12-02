from typing import List, Annotated
from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.user import User
from app.models.report import Report
from app.models.enums import ReportType, ReportStatus, ReportFormat
from app.routers.auth import get_current_active_user

router = APIRouter()


@router.get("", response_model=List[dict])
async def get_reports(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    report_type: ReportType | None = Query(None),
    status_filter: ReportStatus | None = Query(None, alias="status"),
    period_start: date | None = Query(None),
    period_end: date | None = Query(None),
    search: str | None = Query(None, description="Search by user email"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get list of reports with filters."""
    # Only admin users should be able to see reports
    if not current_user.role or current_user.role.name not in ["admin", "manager"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin and manager users can access reports"
        )

    query = select(Report).options(selectinload(Report.user))

    # Apply filters
    if report_type:
        query = query.filter(Report.report_type == report_type)

    if status_filter:
        query = query.filter(Report.status == status_filter)

    if period_start:
        query = query.filter(Report.period_start >= period_start)

    if period_end:
        query = query.filter(Report.period_end <= period_end)

    if search:
        query = query.join(User).filter(User.email.ilike(f"%{search}%"))

    query = query.offset(skip).limit(limit).order_by(Report.generated_at.desc())
    result = await db.execute(query)
    reports = result.scalars().unique().all()

    # Convert to response format
    reports_list = []
    for report in reports:
        report_dict = {
            "id": report.id,
            "user_id": report.user_id,
            "user_email": report.user.email if report.user else None,
            "report_type": report.report_type.value,
            "period_start": report.period_start.isoformat(),
            "period_end": report.period_end.isoformat(),
            "generated_at": report.generated_at.isoformat(),
            "file_format": report.file_format.value,
            "file_url": report.file_url,
            "status": report.status.value,
        }
        reports_list.append(report_dict)

    return reports_list


@router.get("/{report_id}", response_model=dict)
async def get_report(
    report_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get report by ID."""
    if not current_user.role or current_user.role.name not in ["admin", "manager"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin and manager users can access reports"
        )

    result = await db.execute(
        select(Report).options(selectinload(Report.user)).filter(Report.id == report_id)
    )
    report = result.scalar_one_or_none()

    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Report with id {report_id} not found"
        )

    return {
        "id": report.id,
        "user_id": report.user_id,
        "user_email": report.user.email if report.user else None,
        "report_type": report.report_type.value,
        "period_start": report.period_start.isoformat(),
        "period_end": report.period_end.isoformat(),
        "generated_at": report.generated_at.isoformat(),
        "file_format": report.file_format.value,
        "file_url": report.file_url,
        "status": report.status.value,
    }


@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_report(
    report_data: dict,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new report request."""
    if not current_user.role or current_user.role.name not in ["admin", "manager"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin and manager users can create reports"
        )

    # Validate required fields
    required_fields = ["report_type", "period_start", "period_end", "file_format"]
    for field in required_fields:
        if field not in report_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Missing required field: {field}"
            )

    # Convert string dates to date objects
    period_start = datetime.fromisoformat(report_data["period_start"]).date()
    period_end = datetime.fromisoformat(report_data["period_end"]).date()

    # Create new report
    new_report = Report(
        user_id=current_user.id,
        report_type=ReportType(report_data["report_type"]),
        period_start=period_start,
        period_end=period_end,
        generated_at=datetime.now(),
        file_format=ReportFormat(report_data["file_format"]),
        status=ReportStatus.GENERATING
    )

    db.add(new_report)
    await db.commit()
    await db.refresh(new_report)

    return {
        "id": new_report.id,
        "user_id": new_report.user_id,
        "report_type": new_report.report_type.value,
        "period_start": new_report.period_start.isoformat(),
        "period_end": new_report.period_end.isoformat(),
        "generated_at": new_report.generated_at.isoformat(),
        "file_format": new_report.file_format.value,
        "file_url": new_report.file_url,
        "status": new_report.status.value,
    }


# This is a placeholder for generating reports - in a real implementation, 
# you would have a background task or more complex logic
@router.post("/{report_id}/generate", response_model=dict)
async def generate_report(
    report_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Generate report with given ID."""
    if not current_user.role or current_user.role.name != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin users can generate reports"
        )

    result = await db.execute(select(Report).filter(Report.id == report_id))
    report = result.scalar_one_or_none()

    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Report with id {report_id} not found"
        )

    # In a real implementation, this would trigger the report generation process
    # For now, we'll just update the status and provide a mock file path
    report.status = ReportStatus.COMPLETED
    report.file_url = f"/reports/report_{report_id}.{report.file_format.value.lower()}"

    await db.commit()
    await db.refresh(report)

    return {
        "id": report.id,
        "status": report.status.value,
        "file_url": report.file_url,
    }


@router.delete("/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_report(
    report_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete report by ID."""
    if not current_user.role or current_user.role.name != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin users can delete reports"
        )

    result = await db.execute(select(Report).filter(Report.id == report_id))
    report = result.scalar_one_or_none()

    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Report with id {report_id} not found"
        )

    await db.delete(report)
    await db.commit()

    return None