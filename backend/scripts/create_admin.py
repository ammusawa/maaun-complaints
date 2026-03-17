"""Script to create initial admin user. Run: python -m scripts.create_admin"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models import User, UserRole
from app.auth import get_password_hash


def create_admin(email: str = "admin@maaun.edu.ng", password: str = "Admin@123", full_name: str = "System Admin"):
    db = SessionLocal()
    if db.query(User).filter(User.email == email).first():
        print(f"Admin user {email} already exists.")
        return
    admin = User(
        email=email,
        hashed_password=get_password_hash(password),
        full_name=full_name,
        role=UserRole.ADMIN,
    )
    db.add(admin)
    db.commit()
    print(f"Admin user created: {email}")


if __name__ == "__main__":
    create_admin()
