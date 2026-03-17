from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, UserRole
from app.schemas import UserResponse, UserCreate, UserUpdate
from app.auth import require_workflow_role, get_password_hash

router = APIRouter(prefix="/users", tags=["Users"])


def _require_admin_or_management(user: User) -> None:
    if user.role not in [UserRole.ADMIN, UserRole.MANAGEMENT]:
        raise HTTPException(status_code=403, detail="Access denied")


def _admin_only(user: User) -> None:
    """Only admin can perform this action; management cannot."""
    if user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")


@router.get("", response_model=List[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_workflow_role),
    role: Optional[str] = Query(None),
    include_inactive: bool = Query(False),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
):
    """List users. Filter by role. Admin/management can include inactive users."""
    _require_admin_or_management(current_user)
    query = db.query(User)
    if not include_inactive:
        query = query.filter(User.is_active == 1)
    if role:
        try:
            query = query.filter(User.role == UserRole(role))
        except ValueError:
            pass
    users = query.order_by(User.created_at.desc()).offset(skip).limit(limit).all()
    return users


@router.post("", response_model=UserResponse)
def create_user(
    data: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_workflow_role),
):
    """Create a new user. Admin/management only. Only admin can create admin users."""
    _require_admin_or_management(current_user)
    if data.role == "admin":
        _admin_only(current_user)
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    if data.matric_number and db.query(User).filter(User.matric_number == data.matric_number).first():
        raise HTTPException(status_code=400, detail="Matric number already in use")
    user = User(
        email=data.email,
        hashed_password=get_password_hash(data.password),
        full_name=data.full_name,
        matric_number=data.matric_number,
        department=data.department,
        role=UserRole(data.role),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.patch("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_workflow_role),
):
    """Update user (revoke/activate, role, name, department). Admin/management only. Only admin can modify admin users."""
    _require_admin_or_management(current_user)
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role == UserRole.ADMIN:
        _admin_only(current_user)
    if data.is_active is not None:
        user.is_active = 1 if data.is_active else 0
    if data.role is not None:
        try:
            user.role = UserRole(data.role)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid role: {data.role}")
    if data.full_name is not None:
        user.full_name = data.full_name
    if data.department is not None:
        user.department = data.department
    db.commit()
    db.refresh(user)
    return user
