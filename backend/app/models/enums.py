from enum import Enum


class CinemaStatus(str, Enum):
    ACTIVE = "active"
    CLOSED = "closed"
    RENOVATION = "renovation"


class HallStatus(str, Enum):
    ACTIVE = "active"
    MAINTENANCE = "maintenance"
    CLOSED = "closed"


class HallType(str, Enum):
    STANDARD = "standard"
    VIP = "vip"
    IMAX = "imax"
    FOUR_DX = "4dx"


class DistributorStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"


class ContractStatus(str, Enum):
    ACTIVE = "active"
    EXPIRED = "expired"
    TERMINATED = "terminated"
    PENDING = "pending"


class PaymentStatus(str, Enum):
    PENDING = "pending"
    PAID = "paid"
    FAILED = "failed"
    REFUNDED = "refunded"


class SessionStatus(str, Enum):
    SCHEDULED = "scheduled"
    ONGOING = "ongoing"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class TicketStatus(str, Enum):
    RESERVED = "reserved"
    PAID = "paid"
    USED = "used"
    CANCELLED = "cancelled"
    EXPIRED = "expired"


class SalesChannel(str, Enum):
    ONLINE = "online"
    BOX_OFFICE = "box_office"
    MOBILE_APP = "mobile_app"


class UserStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    BLOCKED = "blocked"
    DELETED = "deleted"


class Gender(str, Enum):
    MALE = "male"
    FEMALE = "female"
    OTHER = "other"
    PREFER_NOT_TO_SAY = "prefer_not_to_say"


class BonusTransactionType(str, Enum):
    ACCRUAL = "accrual"
    DEDUCTION = "deduction"
    EXPIRATION = "expiration"


class DiscountType(str, Enum):
    PERCENTAGE = "percentage"
    FIXED_AMOUNT = "fixed_amount"


class PromocodeStatus(str, Enum):
    ACTIVE = "active"
    EXPIRED = "expired"
    DEPLETED = "depleted"
    INACTIVE = "inactive"


class OrderStatus(str, Enum):
    CREATED = "created"
    PENDING_PAYMENT = "pending_payment"
    PAID = "paid"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"


class PaymentMethod(str, Enum):
    CARD = "card"
    CASH = "cash"
    BONUS_POINTS = "bonus_points"
    MOBILE_PAYMENT = "mobile_payment"


class ConcessionItemStatus(str, Enum):
    AVAILABLE = "available"
    OUT_OF_STOCK = "out_of_stock"
    DISCONTINUED = "discontinued"


class PreorderStatus(str, Enum):
    PENDING = "pending"
    READY = "ready"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class ReportType(str, Enum):
    REVENUE = "revenue"
    POPULAR_FILMS = "popular_films"
    DISTRIBUTOR_PAYMENTS = "distributor_payments"
    CONCESSION_SALES = "concession_sales"
    USER_ACTIVITY = "user_activity"


class ReportStatus(str, Enum):
    GENERATING = "generating"
    COMPLETED = "completed"
    FAILED = "failed"


class ReportFormat(str, Enum):
    PDF = "pdf"
    XLSX = "xlsx"
    CSV = "csv"
