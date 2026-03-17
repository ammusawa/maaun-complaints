"""Create management, auditor, and maintenance users for testing. Run: python -m scripts.create_workflow_users"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models import User, UserRole
from app.auth import get_password_hash

DEFAULT_PASSWORD = "Workflow@123"

WORKFLOW_USERS = [
    ("management@maaun.edu.ng", "Management Officer", UserRole.MANAGEMENT),
    ("auditor@maaun.edu.ng", "Auditor", UserRole.AUDITOR),
    ("maintenance@maaun.edu.ng", "Maintenance Officer", UserRole.MAINTENANCE_OFFICER),
]


def create_or_update_user(db, email: str, full_name: str, role: UserRole):
    """Create user with correct role, or update role if user exists. Resets password when fixing role."""
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        if existing.role != role:
            existing.role = role
            existing.full_name = full_name
            existing.hashed_password = get_password_hash(DEFAULT_PASSWORD)  # Reset so login works
            print(f"  Updated {email} -> role={role.value}, password reset to Workflow@123")
        else:
            existing.hashed_password = get_password_hash(DEFAULT_PASSWORD)  # Ensure known password
            print(f"  {email} exists (role={role.value}), password reset to Workflow@123")
        return
    user = User(
        email=email,
        hashed_password=get_password_hash(DEFAULT_PASSWORD),
        full_name=full_name,
        role=role,  # Explicit role: management, auditor, or maintenance_officer
    )
    db.add(user)
    print(f"  Created {role.value}: {email}")


def main():
    db = SessionLocal()
    try:
        print("Creating workflow users (password: Workflow@123)...")
        for email, full_name, role in WORKFLOW_USERS:
            create_or_update_user(db, email, full_name, role)
        db.commit()
        print("Done.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
