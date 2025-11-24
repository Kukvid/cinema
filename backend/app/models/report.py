from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey, Enum as SQLEnum, Index
from sqlalchemy.orm import relationship
from .enums import ReportType, ReportStatus, ReportFormat
from . import Base


class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))

    report_type = Column(SQLEnum(ReportType), nullable=False)
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    generated_at = Column(DateTime, nullable=False)
    file_format = Column(SQLEnum(ReportFormat), nullable=False)
    file_url = Column(String(500))
    status = Column(SQLEnum(ReportStatus), default=ReportStatus.GENERATING, nullable=False)

    # Relationships
    user = relationship("User", back_populates="reports")

    # Constraints
    __table_args__ = (
        Index("idx_report_user", "user_id"),
        Index("idx_report_type", "report_type"),
        Index("idx_report_status", "status"),
        Index("idx_report_generated_at", "generated_at"),
    )
