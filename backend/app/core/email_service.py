
import smtplib
import ssl
from email.message import EmailMessage

from app.core.config import settings


def send_verification_email(to_email: str, otp: str) -> None:
    if not settings.SMTP_HOST or not settings.SMTP_FROM_EMAIL:
        raise RuntimeError("SMTP email settings are not configured.")

    message = EmailMessage()
    message["Subject"] = "Verify your Teralyt email"
    message["From"] = (
        f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
    )
    message["To"] = to_email

    message.set_content(
        f"Your Teralyt email verification code is: {otp}\n\n"
        "This code expires in 10 minutes.\n"
        "If you did not create a Teralyt account, ignore this email."
    )

    tls_context = ssl.create_default_context()

    if settings.SMTP_USE_SSL:
        smtp_connection = smtplib.SMTP_SSL(
            settings.SMTP_HOST,
            settings.SMTP_PORT,
            context=tls_context,
            timeout=30,
        )
    else:
        smtp_connection = smtplib.SMTP(
            settings.SMTP_HOST,
            settings.SMTP_PORT,
            timeout=30,
        )

    with smtp_connection as server:
        if not settings.SMTP_USE_SSL:
            server.starttls(context=tls_context)

        if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
            server.login(
                settings.SMTP_USERNAME,
                settings.SMTP_PASSWORD,
            )

        server.send_message(message)
