
import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.dependencies import get_db
from app.core.email_service import send_verification_email
from app.core.security import (
    create_access_token,
    generate_email_otp,
    hash_email_otp,
    hash_password,
    verify_email_otp,
    verify_password,
)
from app.models.email_otp import EmailOTP
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    SignupRequest,
    VerifyEmailRequest,
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


# ---------------------------------------------------------
# SIGNUP
# ---------------------------------------------------------

@router.post(
    "/signup",
    status_code=status.HTTP_202_ACCEPTED,
)
def signup(
    payload: SignupRequest,
    db: Session = Depends(get_db),
):
    email = str(payload.email).strip().lower()

    existing_user = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    # Public signup is limited to End User and Society Head.
    if payload.role not in ("user", "head"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid account role.",
        )

    user = User(
        name=payload.name.strip(),
        email=email,
        password_hash=hash_password(payload.password),
        role=payload.role,
        email_verified=False,
        head_approval_status=(
            "pending"
            if payload.role == "head"
            else "not_required"
        ),
    )

    db.add(user)

    try:
        db.commit()
        db.refresh(user)

    except Exception:
        db.rollback()
        logger.exception("Failed to create user")

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not create account.",
        )

    # Generate a new email verification code.
    otp = generate_email_otp()

    otp_record = EmailOTP(
        user_id=user.id,
        otp_hash=hash_email_otp(otp, user.id),
        purpose="email_verification",
        expires_at=(
            datetime.now(timezone.utc)
            + timedelta(minutes=10)
        ),
        attempts=0,
    )

    # Remove previous verification codes for this user.
    db.query(EmailOTP).filter(
        EmailOTP.user_id == user.id,
        EmailOTP.purpose == "email_verification",
    ).delete(synchronize_session=False)

    db.add(otp_record)

    try:
        db.commit()

    except Exception:
        db.rollback()
        logger.exception(
            "Failed to save email verification code"
        )

        try:
            db.query(User).filter(
                User.id == user.id
            ).delete(synchronize_session=False)

            db.commit()

        except Exception:
            db.rollback()
            logger.exception(
                "Failed to clean up pending user"
            )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not create verification request.",
        )

    # Send the OTP to the user's email address.
    try:
        send_verification_email(email, otp)

    except Exception:
        logger.exception(
            "Verification email delivery failed"
        )

        # Remove the pending account if email delivery fails.
        try:
            db.query(EmailOTP).filter(
                EmailOTP.user_id == user.id
            ).delete(synchronize_session=False)

            db.query(User).filter(
                User.id == user.id
            ).delete(synchronize_session=False)

            db.commit()

        except Exception:
            db.rollback()
            logger.exception(
                "Failed to clean up after email failure"
            )

        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Verification email could not be sent. "
                "Please try again later."
            ),
        )

    return {
        "message": "Verification code sent to your email.",
        "email": email,
        "expires_in_seconds": 600,
    }


# ---------------------------------------------------------
# VERIFY EMAIL OTP
# ---------------------------------------------------------

@router.post("/verify-email")
def verify_email(
    payload: VerifyEmailRequest,
    db: Session = Depends(get_db),
):
    email = str(payload.email).strip().lower()

    user = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account or verification request not found.",
        )

    if user.email_verified:
        return {
            "message": "Email is already verified.",
            "email_verified": True,
        }

    otp_record = (
        db.query(EmailOTP)
        .filter(
            EmailOTP.user_id == user.id,
            EmailOTP.purpose == "email_verification",
            EmailOTP.consumed_at.is_(None),
        )
        .order_by(EmailOTP.created_at.desc())
        .first()
    )

    if not otp_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Verification code not found. "
                "Please request a new code."
            ),
        )

    now = datetime.now(timezone.utc)

    # Normalize database timestamps to UTC.
    expires_at = otp_record.expires_at

    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(
            tzinfo=timezone.utc
        )

    # Check OTP expiration.
    if expires_at <= now:
        db.delete(otp_record)
        db.commit()

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Verification code expired. "
                "Please request a new code."
            ),
        )

    # Enforce a maximum of five attempts.
    if otp_record.attempts >= 5:
        db.delete(otp_record)
        db.commit()

        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                "Too many incorrect attempts. "
                "Please request a new code."
            ),
        )

    # Verify the submitted OTP against its stored hash.
    is_valid = verify_email_otp(
        payload.otp,
        user.id,
        otp_record.otp_hash,
    )

    if not is_valid:
        otp_record.attempts += 1

        if otp_record.attempts >= 5:
            db.delete(otp_record)
            db.commit()

            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=(
                    "Too many incorrect attempts. "
                    "Please request a new code."
                ),
            )

        db.commit()

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code.",
        )

    # Mark the email as verified.
    user.email_verified = True

    # Consume the OTP so it cannot be reused.
    otp_record.consumed_at = now

    try:
        db.commit()

    except Exception:
        db.rollback()
        logger.exception("Failed to verify user email")

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not verify email.",
        )

    return {
        "message": "Email verified successfully.",
        "email_verified": True,
        "role": user.role,
        "head_approval_status": user.head_approval_status,
    }


# ---------------------------------------------------------
# LOGIN
# ---------------------------------------------------------

@router.post("/login")
def login(
    payload: LoginRequest,
    db: Session = Depends(get_db),
):
    email = str(payload.email).strip().lower()

    user = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )

    invalid_credentials = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid email or password.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not user:
        raise invalid_credentials

    now = datetime.now(timezone.utc)

    # Check whether the account is temporarily locked.
    if user.locked_until:
        locked_until = user.locked_until

        if locked_until.tzinfo is None:
            locked_until = locked_until.replace(
                tzinfo=timezone.utc
            )

        if locked_until > now:
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail=(
                    "Account temporarily locked. "
                    "Please try again later."
                ),
            )

        # Reset expired lock.
        user.locked_until = None
        user.failed_login_attempts = 0

    # Verify the password.
    if not verify_password(
        payload.password,
        user.password_hash,
    ):
        user.failed_login_attempts += 1

        if user.failed_login_attempts >= 5:
            user.locked_until = (
                now + timedelta(minutes=5)
            )

            db.commit()

            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail=(
                    "Too many incorrect attempts. "
                    "Account locked for 5 minutes."
                ),
            )

        db.commit()
        raise invalid_credentials

    # Reject disabled accounts.
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account is disabled.",
        )

    # Email verification is required before login.
    if not user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email before logging in.",
        )

    # Society Head accounts require administrator approval.
    if (
        user.role == "head"
        and user.head_approval_status != "approved"
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Your Society Head account is awaiting "
                "administrator approval."
            ),
        )

    # Reset failed login attempts after successful login.
    user.failed_login_attempts = 0
    user.locked_until = None

    try:
        db.commit()

    except Exception:
        db.rollback()
        logger.exception(
            "Failed to reset login attempt counters"
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not complete login.",
        )

    # Create a JWT access token.
    access_token = create_access_token(
        user_id=user.id,
        role=user.role,
    )

    return {
        "message": "Login successful.",
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": (
            settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        ),
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
            "email_verified": user.email_verified,
            "head_approval_status": (
                user.head_approval_status
            ),
        },
    }
