
from app.core.security import (
    generate_email_otp,
    hash_email_otp,
    verify_email_otp,
    hash_password,
    verify_password,
)


password = "Example-Test-Password-123!"
password_hash = hash_password(password)

assert verify_password(password, password_hash)
assert not verify_password("wrong-password", password_hash)

otp = generate_email_otp()
otp_hash = hash_email_otp(otp, user_id=1)

assert len(otp) == 6
assert verify_email_otp(otp, user_id=1, stored_hash=otp_hash)
assert not verify_email_otp("000000", user_id=1, stored_hash=otp_hash)

print("Security functions passed.")
