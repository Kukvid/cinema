from enum import Enum


class UserRoles(str, Enum):
    SUPER_ADMIN = 'SUPER_ADMIN'
    ADMIN = 'ADMIN'
    STAFF = 'STAFF'
    USER = 'USER'

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
    PENDING = "PENDING"
    PAID = "PAID"
    FAILED = "FAILED"
    REFUNDED = "REFUNDED"


class SessionStatus(str, Enum):
    SCHEDULED = "SCHEDULED"
    ONGOING = "ONGOING"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class TicketStatus(str, Enum):
    RESERVED = "RESERVED"
    PAID = "PAID"
    USED = "USED"
    CANCELLED = "CANCELLED"
    EXPIRED = "EXPIRED"


class SalesChannel(str, Enum):
    ONLINE = "ONLINE"
    BOX_OFFICE = "BOX_OFFICE"
    MOBILE_APP = "MOBILE_APP"


class UserStatus(str, Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    BLOCKED = "BLOCKED"
    DELETED = "DELETED"


class Gender(str, Enum):
    MALE = "MALE"
    FEMALE = "FEMALE"
    OTHER = "OTHER"
    PREFER_NOT_TO_SAY = "PREFER_NOT_TO_SAY"


class BonusTransactionType(str, Enum):
    ACCRUAL = "ACCRUAL"
    DEDUCTION = "DEDUCTION"
    EXPIRATION = "EXPIRATION"


class DiscountType(str, Enum):
    PERCENTAGE = "PERCENTAGE"
    FIXED_AMOUNT = "FIXED_AMOUNT"


class PromocodeStatus(str, Enum):
    ACTIVE = "ACTIVE"
    EXPIRED = "EXPIRED"
    DEPLETED = "DEPLETED"
    INACTIVE = "INACTIVE"


class OrderStatus(str, Enum):
    # активные
    created = "created"
    pending_payment = "pending_payment"
    paid = "paid"
    # неактивные
    cancelled = "cancelled"
    refunded = "refunded"
    completed = "completed"


class PaymentMethod(str, Enum):
    CARD = "CARD"
    CASH = "CASH"
    BONUS_POINTS = "BONUS_POINTS"
    MOBILE_PAYMENT = "MOBILE_PAYMENT"


class ConcessionItemStatus(str, Enum):
    AVAILABLE = "AVAILABLE"
    OUT_OF_STOCK = "OUT_OF_STOCK"
    DISCONTINUED = "DISCONTINUED"


class PreorderStatus(str, Enum):
    PENDING = "PENDING"
    READY = "READY"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class ReportType(str, Enum):
    REVENUE = "REVENUE"
    POPULAR_FILMS = "POPULAR_FILMS"
    DISTRIBUTOR_PAYMENTS = "DISTRIBUTOR_PAYMENTS"
    CONCESSION_SALES = "CONCESSION_SALES"
    USER_ACTIVITY = "USER_ACTIVITY"


class ReportStatus(str, Enum):
    GENERATING = "GENERATING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class ReportFormat(str, Enum):
    PDF = "PDF"
    XLSX = "XLSX"
    CSV = "CSV"
