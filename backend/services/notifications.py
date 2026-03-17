"""Service to create notifications for users."""
from typing import List, Optional
from sqlalchemy.orm import Session

from app.models import Notification, User, UserRole


def _management_admin_ids(db: Session) -> List[int]:
    """Get user IDs of all active management and admin users."""
    users = db.query(User).filter(
        User.is_active == 1,
        User.role.in_([UserRole.MANAGEMENT, UserRole.ADMIN]),
    ).all()
    return [u.id for u in users]


def notify(
    db: Session,
    user_ids: List[int],
    ntype: str,
    title: str,
    message: Optional[str] = None,
    link: Optional[str] = None,
    complaint_id: Optional[int] = None,
):
    """Create notifications for given users."""
    for uid in user_ids:
        if uid:
            n = Notification(
                user_id=uid,
                type=ntype,
                title=title,
                message=message,
                link=link,
                complaint_id=complaint_id,
            )
            db.add(n)


def notify_management_on_new_complaint(db: Session, complaint_id: int, ticket: str, title: str):
    """Notify management and admin when a new complaint is created."""
    notify(db, _management_admin_ids(db), "complaint_created", f"New complaint: {ticket}", title, f"/complaints/{complaint_id}", complaint_id)


def notify_user_assigned(db: Session, user_id: int, complaint_id: int, ticket: str, title: str, assigned_by: str):
    """Notify user when assigned to a complaint (auditor/maintenance)."""
    notify(db, [user_id], "assigned", f"Case assigned to you: {ticket}", f"By {assigned_by}", f"/complaints/{complaint_id}", complaint_id)


def notify_submitter_status(db: Session, submitter_id: int, complaint_id: int, ticket: str, status: str):
    """Notify submitter when their complaint status changes."""
    if status == "resolved":
        notify(db, [submitter_id], "status_changed", f"Your case has been resolved: {ticket}", "Your complaint has been successfully resolved.", f"/complaints/{complaint_id}", complaint_id)
    else:
        notify(db, [submitter_id], "status_changed", f"Complaint {ticket} update", f"Status: {status}", f"/complaints/{complaint_id}", complaint_id)


def notify_submitter_response(db: Session, submitter_id: int, complaint_id: int, ticket: str, responder_name: str):
    """Notify submitter when someone adds a response to their complaint."""
    notify(db, [submitter_id], "response_added", f"Response on {ticket}", f"By {responder_name}", f"/complaints/{complaint_id}", complaint_id)


def notify_management_assigned(db: Session, complaint_id: int, ticket: str, title: str, assignee_name: str, role: str):
    """Notify management/admin: case assigned to auditor or maintenance."""
    role_label = "for verification" if role == "auditor" else "for repair"
    notify(db, _management_admin_ids(db), "case_assigned", f"Case assigned to {assignee_name}: {ticket}", role_label.title(), f"/complaints/{complaint_id}", complaint_id)


def notify_management_audited(db: Session, complaint_id: int, ticket: str, title: str, auditor_name: str):
    """Notify management/admin: case audited by auditor."""
    notify(db, _management_admin_ids(db), "case_audited", f"Case audited by {auditor_name}: {ticket}", title, f"/complaints/{complaint_id}", complaint_id)


def notify_management_repair_update(db: Session, complaint_id: int, ticket: str, title: str, maintenance_name: str):
    """Notify management/admin: repair update by maintenance officer."""
    notify(db, _management_admin_ids(db), "case_repaired", f"Repair update by {maintenance_name}: {ticket}", title, f"/complaints/{complaint_id}", complaint_id)


def notify_management_resolved(db: Session, complaint_id: int, ticket: str, title: str):
    """Notify management/admin: case resolved."""
    notify(db, _management_admin_ids(db), "case_resolved", f"Case resolved: {ticket}", title, f"/complaints/{complaint_id}", complaint_id)
