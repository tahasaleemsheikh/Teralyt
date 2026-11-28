
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from pwdlib import PasswordHash

from app.core.config import settings


password_hash = PasswordHash.recommended()


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    return password_hash.verify(password, hashed_password)


def generate_email_otp() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def hash_email_otp(otp: str, user_id: int) -> str:
    message = f"{user_id}:email_verification:{otp}".encode("utf-8")

    return hmac.new(
        settings.OTP_PEPPER.encode("utf-8"),
        message,
        hashlib.sha256,
    ).hexdigest()


def verify_email_otp(
    otp: str,
    user_id: int,
    stored_hash: str,
) -> bool:
    calculated_hash = hash_email_otp(otp, user_id)

    return hmac.compare_digest(calculated_hash, stored_hash)


def create_access_token(user_id: int, role: str) -> str:
    now = datetime.now(timezone.utc)

    expires_at = now + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )

    payload = {
        "sub": str(user_id),
        "role": role,
        "iat": now,
        "exp": expires_at,
    }

    return jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )
