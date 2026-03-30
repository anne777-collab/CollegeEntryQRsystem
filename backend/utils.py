import re
import secrets
import string
from pathlib import Path

import qrcode


TOKEN_ALPHABET = string.ascii_uppercase + string.digits


def generate_token(min_length: int = 10, max_length: int = 15) -> str:
    token_length = secrets.randbelow(max_length - min_length + 1) + min_length
    return "".join(secrets.choice(TOKEN_ALPHABET) for _ in range(token_length))


def safe_filename(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9_-]+", "_", value.strip())
    return cleaned.strip("_") or "student"


def save_qr_code(token: str, destination: Path) -> None:
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=4,
    )
    qr.add_data(token)
    qr.make(fit=True)

    image = qr.make_image(fill_color="black", back_color="white")
    destination.parent.mkdir(parents=True, exist_ok=True)
    image.save(destination)
