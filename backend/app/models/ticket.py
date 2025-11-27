from sqlalchemy import Column, Integer, DECIMAL, DateTime, String, ForeignKey, Enum as SQLEnum, Index, CheckConstraint
from sqlalchemy.orm import relationship
from .enums import TicketStatus, SalesChannel
from . import Base


class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    seat_id = Column(Integer, ForeignKey("seats.id", ondelete="CASCADE"), nullable=False)
    buyer_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    seller_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))

    price = Column(DECIMAL(8, 2), nullable=False)
    purchase_date = Column(DateTime, nullable=False)
    sales_channel = Column(SQLEnum(SalesChannel), nullable=False)
    status = Column(SQLEnum(TicketStatus), default=TicketStatus.RESERVED, nullable=False)
    qr_code = Column(String(2000))
    validation_date = Column(DateTime)

    # Relationships
    session = relationship("Session", back_populates="tickets")
    seat = relationship("Seat", back_populates="tickets")
    buyer = relationship("User", back_populates="purchased_tickets", foreign_keys=[buyer_id])
    seller = relationship("User", back_populates="sold_tickets", foreign_keys=[seller_id])
    order = relationship("Order", back_populates="tickets")
    bonus_transactions = relationship("BonusTransaction", back_populates="ticket")

    # Constraints
    __table_args__ = (
        Index("idx_ticket_session", "session_id"),
        Index("idx_ticket_seat", "seat_id"),
        Index("idx_ticket_buyer", "buyer_id"),
        Index("idx_ticket_order", "order_id"),
        Index("idx_ticket_session_seat", "session_id", "seat_id", unique=True),
        Index("idx_ticket_qr_code", "qr_code"),
        CheckConstraint("price >= 0", name="check_ticket_price_non_negative"),
    )
