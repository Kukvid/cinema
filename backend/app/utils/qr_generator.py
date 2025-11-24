import qrcode
from io import BytesIO
import base64
from typing import Optional

from app.config import settings


def generate_qr_code(data: str, size: Optional[int] = None, border: Optional[int] = None) -> str:
    """
    Generate a QR code from data and return as base64 encoded string.

    Args:
        data: The data to encode in the QR code
        size: QR code box size (default from settings)
        border: QR code border size (default from settings)

    Returns:
        Base64 encoded PNG image string
    """
    qr_size = size or settings.QR_CODE_SIZE
    qr_border = border or settings.QR_CODE_BORDER

    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=qr_size,
        border=qr_border,
    )
    qr.add_data(data)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")

    # Convert to base64
    buffer = BytesIO()
    img.save(buffer, format="PNG")
    img_str = base64.b64encode(buffer.getvalue()).decode()

    return f"data:image/png;base64,{img_str}"


def generate_ticket_qr(ticket_id: int, session_id: int, seat_id: int) -> str:
    """
    Generate a QR code for a ticket.

    Format: TICKET:{ticket_id}:{session_id}:{seat_id}
    """
    qr_data = f"TICKET:{ticket_id}:{session_id}:{seat_id}"
    return generate_qr_code(qr_data)


def generate_concession_qr(preorder_id: int, order_id: int) -> str:
    """
    Generate a QR code for a concession preorder.

    Format: CONCESSION:{preorder_id}:{order_id}
    """
    qr_data = f"CONCESSION:{preorder_id}:{order_id}"
    return generate_qr_code(qr_data)


def parse_qr_data(qr_data: str) -> Optional[dict]:
    """
    Parse QR code data into structured format.

    Returns:
        Dict with 'type' and relevant IDs, or None if invalid
    """
    try:
        parts = qr_data.split(":")
        if len(parts) < 2:
            return None

        qr_type = parts[0]

        if qr_type == "TICKET" and len(parts) == 4:
            return {
                "type": "ticket",
                "ticket_id": int(parts[1]),
                "session_id": int(parts[2]),
                "seat_id": int(parts[3]),
            }
        elif qr_type == "CONCESSION" and len(parts) == 3:
            return {
                "type": "concession",
                "preorder_id": int(parts[1]),
                "order_id": int(parts[2]),
            }

        return None
    except (ValueError, IndexError):
        return None
