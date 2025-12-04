# Issues Report: Cinema Management System

## Major Issues

### 1. Missing Seat Reservation Timeout Logic (Critical)
- **Issue**: The system has `SEAT_RESERVATION_TIMEOUT_MINUTES = 5` configured in settings, and the `TicketStatus` enum includes `EXPIRED`, but there is NO implementation to automatically expire reserved tickets after the timeout period.
- **Impact**: Reserved seats remain permanently blocked, potentially causing inventory loss and preventing other customers from purchasing these seats.
- **Location**: Configuration in `app/config.py`, enum in `app/models/enums.py`, but missing timeout handling logic.
- **Evidence**: The README.md has a checkbox "Seat reservation (5 min timeout)" marked as unchecked, indicating this feature is not implemented.

### 2. No Background Task System for Cleanup Jobs (High)
- **Issue**: The system requires background/cron jobs to handle:
  - Expired ticket reservation cleanup
  - Expired promocode status updates
  - Bonus point expiration (if applicable)
  - Session cleanup for cancelled sessions
- **Impact**: Without background processing, critical cleanup tasks will not occur, leading to data inconsistency and system degradation over time.
- **Evidence**: No background task packages (like Celery, APScheduler) in `requirements.txt`, no scheduled job implementations found.

## Medium Issues

### 3. Potential Race Condition in Seat Booking (Medium)
- **Issue**: The booking process checks seat availability sequentially but doesn't use database transactions properly to prevent concurrent bookings for the same seat.
- **Location**: `app/routers/bookings.py` - the booking validation logic doesn't use row-level locking.
- **Impact**: Multiple users might simultaneously book the same seat, causing double booking issues.

### 4. Insufficient Session Time Validation (Medium)
- **Issue**: While the system checks for hall time conflicts when creating sessions, it doesn't fully validate if session times are logically consistent (e.g., past times, extremely long sessions).
- **Location**: `app/routers/sessions.py` - the conflict checking logic in `create_session`.
- **Impact**: Invalid or problematic session times could be created.

### 5. Missing Comprehensive Session Cancellation Logic (Medium)
- **Issue**: When sessions are cancelled, there's no automatic handling of related tickets/orders. The system has `SessionStatus.cancelled` but no cascade logic for related bookings.
- **Location**: No session cancellation endpoint handles related tickets and orders.
- **Impact**: cancelled sessions may still have paid/active tickets, leading to customer confusion and service desk issues.

## Minor Issues

### 6. Hardcoded Error Messages in Russian (Minor)
- **Issue**: Some error messages in validation functions use Russian, which is inconsistent with English-based system architecture.
- **Location**: `app/services/promocode_service.py` - contains "not find" instead of "not found".
- **Impact**: Minor localization inconsistency.

### 7. Potential SQL Injection Vulnerability in Raw Queries (Minor)
- **Issue**: In `create_db.py`, raw SQL queries use string formatting without proper parameterization.
- **Location**: `create_db.py` - the `verify_tables` function uses raw SQL.
- **Impact**: Low risk since this is typically for database schema verification, but still a potential security issue.

### 8. Missing Input Validation for Timeouts (Minor)
- **Issue**: `SEAT_RESERVATION_TIMEOUT_MINUTES` in config doesn't validate if the value makes sense (e.g., negative values, unreasonably large values).
- **Location**: `app/config.py` - no validation constraints on timeout values.
- **Impact**: Could lead to improper system behavior if misconfigured.

### 9. Inconsistent Payment Method Handling (Minor)
- **Issue**: The payment system accepts card numbers but only stores last 4 digits. Full card number validation and handling could be improved.
- **Location**: `app/routers/bookings.py` - in payment processing.
- **Impact**: Could cause issues with payment processing if card validation is too simplistic.

### 10. Missing Expired Bonus Account Handling (Minor)
- **Issue**: While the system has bonus points, there's no clear handling of bonus point expiration, which could be required for compliance with regulations.
- **Location**: `app/models/bonus_account.py` and related services.
- **Impact**: Could lead to unbounded growth of bonus points or regulatory compliance issues.

## Recommendations

1. Implement a background task system (e.g., Celery with Redis/Redis Queue) to handle cleanup operations.
2. Add database-level locking or optimistic locking to prevent race conditions in booking.
3. Create scheduled jobs for handling expired reservations, promocodes, and other time-sensitive operations.
4. Add comprehensive session cancellation logic with proper cascade handling.
5. Improve input validation and error message consistency.
6. Add proper monitoring and alerting for background tasks to ensure they run successfully.