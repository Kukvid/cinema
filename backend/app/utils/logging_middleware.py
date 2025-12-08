import time
from typing import Optional
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
import logging
from app.utils.security import decode_token # Убедитесь, что decode_token корректно импортирован

# --- Настройка логгера ---
# Создаём логгер с именем 'http_logs'
logger = logging.getLogger("http_logs")
logger.setLevel(logging.INFO)

# Создаём обработчик, который будет записывать в файл
file_handler = logging.FileHandler("http_requests.log") # Логи будут писаться в этот файл
file_formatter = logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
file_handler.setFormatter(file_formatter)

# Добавляем обработчик к логгеру
logger.addHandler(file_handler)
# --- Конец настройки ---

class LoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware to log incoming requests and outgoing responses.
    Logs include:
    - Request method and URL
    - Request body (when available)
    - Response status code
    - User login (when authenticated)
    - Processing time
    """

    async def dispatch(self, request: Request, call_next):
        # Get start time
        start_time = time.time()

        # Get request details
        method = request.method
        url = str(request.url)

        # Attempt to extract user info from JWT token
        user_email = "anonymous"
        token = self._extract_token_from_request(request)
        if token:
            user_info = self._decode_token_and_get_user(token)
            if user_info:
                user_email = user_info.get('email', 'anonymous')

        # Read request body if present
        request_body = ""
        if request.method in ['POST', 'PUT', 'PATCH']:
            try:
                # Read the body for logging
                body_bytes = await request.body()
                if body_bytes:
                    request_body = body_bytes.decode('utf-8')

                # Important: Create a new request with the same body for further processing
                # This is necessary because request.body() can only be consumed once
                async def receive():
                    return {"type": "http.request", "body": body_bytes}

                request._receive = receive
            except Exception:
                request_body = "<could not read body>"

        # Process the request
        response = await call_next(request)

        # Calculate processing time
        process_time = time.time() - start_time

        # Log the request and response
        # Теперь вызов делается как logger.info(...)
        logger.info({
            "event": "request_response_log",
            "method": method,
            "url": url,
            "status_code": response.status_code,
            "user": user_email,
            "request_body": request_body,
            "processing_time": f"{process_time:.4f}s"
        })

        return response

    def _extract_token_from_request(self, request: Request) -> Optional[str]:
        """Extract JWT token from request headers."""
        authorization_header = request.headers.get("Authorization")

        if not authorization_header:
            return None

        # Expected format: "Bearer <token>"
        if not authorization_header.startswith("Bearer "):
            return None

        token = authorization_header[7:]  # Remove "Bearer " prefix
        return token

    def _decode_token_and_get_user(self, token: str) -> Optional[dict]:
        """Get user information from JWT token."""
        try:
            # Decode the token using the imported function
            payload = decode_token(token)
            if not payload:
                return None

            email = payload.get("sub")  # Subject field typically contains user identifier
            if not email:
                return None

            return {"email": email}
        except Exception:
            # If token is invalid or expired, return None
            return None
