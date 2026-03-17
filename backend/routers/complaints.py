import uuid
from pathlib import Path
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query, Form, File, UploadFile
from sqlalchemy.orm import Session
from sqlalchemy import or_, func

from app.config import get_settings
from app.database import get_db
from app.models import User, Complaint, Response, ComplaintStatus, UserRole, ComplaintAttachment, ComplaintCategory, FeedbackType, InvoiceItem
from app.schemas import (
    ComplaintUpdate,
    ComplaintResponse,
    ComplaintListItem,
    ResponseCreate,
    ResponseSchema,
    AttachmentSchema,
    InvoiceItemSchema,
)
from app.auth import get_current_user, require_admin, require_staff_or_admin, require_workflow_role
from app.utils import generate_ticket_number
from app.services.notifications import (
    notify_management_on_new_complaint,
    notify_user_assigned,
    notify_submitter_status,
    notify_submitter_response,
    notify_management_assigned,
    notify_management_audited,
    notify_management_repair_update,
    notify_management_resolved,
)

router = APIRouter(prefix="/complaints", tags=["Complaints"])
settings = get_settings()
UPLOAD_DIR = Path(settings.UPLOAD_DIR)
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB


def get_ticket_number(db: Session) -> str:
    """Ensure unique ticket number"""
    while True:
        ticket = generate_ticket_number()
        if not db.query(Complaint).filter(Complaint.ticket_number == ticket).first():
            return ticket


def _save_upload_file(file: UploadFile) -> tuple[str, str]:
    """Save uploaded file, return (relative_path_for_db, original_name)."""
    ext = Path(file.filename or "img").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}")
    content = file.file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Max 5MB.")
    unique_name = f"{uuid.uuid4().hex}{ext}"
    file_path = UPLOAD_DIR / unique_name
    with open(file_path, "wb") as f:
        f.write(content)
    return unique_name, file.filename or unique_name


VALID_CATEGORIES = {e.value for e in ComplaintCategory}
VALID_FEEDBACK_TYPES = {e.value for e in FeedbackType}


@router.post("", response_model=ComplaintResponse)
async def create_complaint(
    title: str = Form(...),
    description: str = Form(...),
    category: str = Form(...),
    feedback_type: str = Form(default="complaint"),
    department: Optional[str] = Form(None),
    images: List[UploadFile] = File(default=[]),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Submit a new complaint or feedback with proof images (at least 1 required)"""
    if category not in VALID_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Invalid category. Must be one of: {', '.join(sorted(VALID_CATEGORIES))}")
    if feedback_type not in VALID_FEEDBACK_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid feedback_type. Must be one of: {', '.join(sorted(VALID_FEEDBACK_TYPES))}")
    if not images or not any(img.filename and img.filename.strip() for img in images):
        raise HTTPException(
            status_code=400,
            detail="At least one proof image is required (jpg, png, gif, webp, max 5MB each)",
        )
    complaint = Complaint(
        ticket_number=get_ticket_number(db),
        title=title,
        description=description,
        category=ComplaintCategory(category),
        feedback_type=FeedbackType(feedback_type),
        department=department or current_user.department,
        submitter_id=current_user.id,
    )
    db.add(complaint)
    db.commit()
    db.refresh(complaint)

    for img in images:
        if img.filename and img.filename.strip():
            try:
                rel_path, orig_name = _save_upload_file(img)
                att = ComplaintAttachment(
                    complaint_id=complaint.id,
                    file_path=rel_path,
                    file_name=orig_name,
                )
                db.add(att)
            except HTTPException:
                raise
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Failed to save image: {str(e)}")
    db.commit()
    db.refresh(complaint)
    notify_management_on_new_complaint(db, complaint.id, complaint.ticket_number, complaint.title)
    db.commit()
    return _complaint_to_response(complaint, current_user)


@router.get("", response_model=List[ComplaintListItem])
def list_complaints(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    status_filter: Optional[str] = Query(None, alias="status"),
    category: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
):
    """List complaints - role-based: student/staff see own; management sees all; auditor/maintenance see assigned"""
    query = db.query(Complaint)
    if current_user.role in [UserRole.STUDENT, UserRole.STAFF]:
        query = query.filter(Complaint.submitter_id == current_user.id)
    elif current_user.role == UserRole.AUDITOR:
        query = query.filter(Complaint.assigned_to_id == current_user.id)
    elif current_user.role == UserRole.MAINTENANCE_OFFICER:
        query = query.filter(Complaint.assigned_to_id == current_user.id)
    if status_filter:
        try:
            status_enum = ComplaintStatus(status_filter)
            query = query.filter(Complaint.status == status_enum)
        except ValueError:
            pass
    if category:
        query = query.filter(Complaint.category == category)

    complaints = query.order_by(Complaint.created_at.desc()).offset(skip).limit(limit).all()
    return [_complaint_to_list_item(c) for c in complaints]


@router.get("/analytics")
def get_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_workflow_role),
    submitter_id: Optional[int] = Query(None),
    category: Optional[str] = Query(None),
    feedback_type: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
):
    """Analytics for admin/management: filter by submitter, category, type, department. Returns aggregated stats."""
    from sqlalchemy import func
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGEMENT]:
        raise HTTPException(status_code=403, detail="Access denied")
    base = db.query(Complaint)
    if submitter_id:
        base = base.filter(Complaint.submitter_id == submitter_id)
    if category and category in VALID_CATEGORIES:
        base = base.filter(Complaint.category == category)
    if feedback_type and feedback_type in VALID_FEEDBACK_TYPES:
        base = base.filter(Complaint.feedback_type == feedback_type)
    if department:
        base = base.filter(Complaint.department == department)
    if status:
        try:
            base = base.filter(Complaint.status == ComplaintStatus(status))
        except ValueError:
            pass

    total = base.count()
    by_status = {str(s): c for s, c in base.with_entities(Complaint.status, func.count(Complaint.id)).group_by(Complaint.status).all()}
    by_category = {str(cat): cnt for cat, cnt in base.with_entities(Complaint.category, func.count(Complaint.id)).group_by(Complaint.category).all()}
    by_feedback_type = {str(ft): cnt for ft, cnt in base.with_entities(Complaint.feedback_type, func.count(Complaint.id)).group_by(Complaint.feedback_type).all()}
    by_dept_rows = base.with_entities(Complaint.department, func.count(Complaint.id)).group_by(Complaint.department).all()
    by_department = {(str(d) if d else "Unspecified"): cnt for d, cnt in by_dept_rows}
    top_submitters = base.with_entities(
        Complaint.submitter_id,
        User.full_name,
        func.count(Complaint.id).label("count"),
    ).join(User, Complaint.submitter_id == User.id).group_by(Complaint.submitter_id, User.full_name).order_by(func.count(Complaint.id).desc()).limit(10).all()
    dept_rows = db.query(Complaint.department).filter(Complaint.department.isnot(None), Complaint.department != "").distinct().all()
    departments = sorted(set(r[0] for r in dept_rows if r[0]))
    submitters = db.query(User.id, User.full_name).join(Complaint, Complaint.submitter_id == User.id).group_by(User.id, User.full_name).order_by(User.full_name).all()

    return {
        "total": total,
        "by_status": by_status,
        "by_category": by_category,
        "by_feedback_type": by_feedback_type,
        "by_department": by_department,
        "top_submitters": [{"user_id": s, "full_name": n or "", "count": c} for s, n, c in top_submitters],
        "departments": departments,
        "submitters": [{"id": sid, "full_name": fn or ""} for sid, fn in submitters],
    }


@router.get("/stats")
def get_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_workflow_role),
):
    """Get complaint statistics for dashboard - management, auditor, maintenance, admin"""
    from sqlalchemy import func
    base = db.query(Complaint)
    if current_user.role == UserRole.AUDITOR:
        base = base.filter(Complaint.assigned_to_id == current_user.id)
    elif current_user.role == UserRole.MAINTENANCE_OFFICER:
        base = base.filter(Complaint.assigned_to_id == current_user.id)
    rows = base.with_entities(Complaint.status, func.count(Complaint.id)).group_by(Complaint.status).all()
    stats = {(s.value if hasattr(s, "value") else str(s)): c for s, c in rows}
    total = sum(stats.values())
    return {
        "total": total,
        "pending": stats.get("pending", 0),
        "assigned_to_auditor": stats.get("assigned_to_auditor", 0),
        "audited": stats.get("audited", 0),
        "assigned_to_maintenance": stats.get("assigned_to_maintenance", 0),
        "maintenance_in_progress": stats.get("maintenance_in_progress", 0),
        "pending_approval": stats.get("pending_approval", 0),
        "resolved": stats.get("resolved", 0),
        "rejected": stats.get("rejected", 0),
    }


@router.get("/track")
def track_complaint_public(
    ticket_number: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
):
    """Public endpoint: track complaint status by ticket number. No auth required."""
    q = ticket_number.strip()
    complaint = db.query(Complaint).filter(func.upper(Complaint.ticket_number) == q.upper()).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    return {
        "ticket_number": complaint.ticket_number,
        "title": complaint.title,
        "status": complaint.status.value,
        "category": complaint.category.value,
        "created_at": complaint.created_at.isoformat() if complaint.created_at else None,
        "resolved_at": complaint.resolved_at.isoformat() if complaint.resolved_at else None,
    }


@router.get("/{complaint_id}", response_model=ComplaintResponse)
def get_complaint(
    complaint_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get complaint details - students see own; workflow roles see relevant complaints"""
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    if current_user.role in [UserRole.STUDENT, UserRole.STAFF]:
        if complaint.submitter_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == UserRole.AUDITOR:
        if complaint.assigned_to_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == UserRole.MAINTENANCE_OFFICER:
        if complaint.assigned_to_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")
    return _complaint_to_response(complaint, current_user)


@router.patch("/{complaint_id}", response_model=ComplaintResponse)
def update_complaint(
    complaint_id: int,
    update_data: ComplaintUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_workflow_role),
):
    """Update complaint - workflow actions by management, auditor, maintenance, admin"""
    from datetime import datetime
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    old_status = complaint.status
    old_assigned_to_id = complaint.assigned_to_id
    old_maintenance_report = complaint.maintenance_report

    # Management/Admin: assign, approve, status changes
    assigned_to_new = False
    if current_user.role in [UserRole.ADMIN, UserRole.MANAGEMENT]:
        if update_data.assigned_to_id is not None:
            assigned_to_new = complaint.assigned_to_id != update_data.assigned_to_id
            complaint.assigned_to_id = update_data.assigned_to_id
        if update_data.status is not None:
            complaint.status = update_data.status
            if update_data.status == ComplaintStatus.RESOLVED:
                complaint.resolved_at = datetime.utcnow()
        if update_data.priority is not None:
            complaint.priority = update_data.priority

    # Auditor: submit feedback, verify. Admin can do on any complaint (oversight).
    auditor_ok = (current_user.role == UserRole.ADMIN) or (current_user.role == UserRole.AUDITOR and complaint.assigned_to_id == current_user.id)
    if auditor_ok:
        if update_data.audit_feedback is not None:
            complaint.audit_feedback = update_data.audit_feedback
        if update_data.status in [ComplaintStatus.AUDITED, ComplaintStatus.RESOLVED]:
            complaint.status = update_data.status
            if update_data.status == ComplaintStatus.RESOLVED:
                complaint.resolved_at = datetime.utcnow()

    # Maintenance: report, invoice items, repair done. Admin can do on any complaint (oversight).
    maintenance_ok = (current_user.role == UserRole.ADMIN) or (current_user.role == UserRole.MAINTENANCE_OFFICER and complaint.assigned_to_id == current_user.id)
    if maintenance_ok:
        if update_data.maintenance_report is not None:
            complaint.maintenance_report = update_data.maintenance_report
        if update_data.invoice_amount is not None:
            complaint.invoice_amount = update_data.invoice_amount
        if update_data.invoice_notes is not None:
            complaint.invoice_notes = update_data.invoice_notes
        if update_data.invoice_items is not None:
            # Replace all invoice items
            db.query(InvoiceItem).filter(InvoiceItem.complaint_id == complaint_id).delete()
            total = 0
            for it in update_data.invoice_items:
                item = InvoiceItem(
                    complaint_id=complaint_id,
                    item=it.item,
                    cost=it.cost,
                    quantity=it.quantity,
                )
                db.add(item)
                total += it.cost * it.quantity
            complaint.invoice_amount = total
        if update_data.status is not None:
            complaint.status = update_data.status

    db.commit()
    db.refresh(complaint)
    new_status = complaint.status
    new_assigned = complaint.assigned_to

    # Notifications (separate commit)
    ticket = complaint.ticket_number
    title = complaint.title

    # Assignee: auditor/maintenance gets notified when assigned
    if assigned_to_new and complaint.assigned_to_id:
        notify_user_assigned(db, complaint.assigned_to_id, complaint.id, ticket, title, current_user.full_name)
        # Management/admin: case assigned to X
        if new_assigned:
            role = "auditor" if new_assigned.role == UserRole.AUDITOR else "maintenance"
            notify_management_assigned(db, complaint.id, ticket, title, new_assigned.full_name, role)

    # Management/admin: case audited
    if new_status == ComplaintStatus.AUDITED and old_status != ComplaintStatus.AUDITED:
        auditor_name = new_assigned.full_name if new_assigned else current_user.full_name
        notify_management_audited(db, complaint.id, ticket, title, auditor_name)

    # Management/admin: repair update (report added or key status changes by maintenance)
    maintenance_did_update = (
        (update_data.maintenance_report is not None and complaint.maintenance_report != old_maintenance_report)
        or (new_status == ComplaintStatus.REPAIR_COMPLETED and old_status != ComplaintStatus.REPAIR_COMPLETED)
        or (new_status == ComplaintStatus.PENDING_APPROVAL and old_status != ComplaintStatus.PENDING_APPROVAL)
    )
    if maintenance_did_update and (current_user.role in [UserRole.ADMIN, UserRole.MAINTENANCE_OFFICER]):
        notify_management_repair_update(db, complaint.id, ticket, title, current_user.full_name)

    # Management/admin: case resolved
    if new_status == ComplaintStatus.RESOLVED and old_status != ComplaintStatus.RESOLVED:
        notify_management_resolved(db, complaint.id, ticket, title)

    # Submitter: status updates (especially resolved)
    if new_status == ComplaintStatus.RESOLVED and complaint.submitter_id:
        notify_submitter_status(db, complaint.submitter_id, complaint.id, ticket, "resolved")
    elif update_data.status is not None and complaint.submitter_id and complaint.submitter_id != current_user.id:
        notify_submitter_status(db, complaint.submitter_id, complaint.id, ticket, str(update_data.status.value))

    db.commit()

    return _complaint_to_response(complaint, current_user)


@router.post("/{complaint_id}/responses", response_model=ResponseSchema)
def add_response(
    complaint_id: int,
    response_data: ResponseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add response/comment to complaint"""
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    # Students can only add non-internal responses to their own complaints
    if current_user.role == UserRole.STUDENT:
        if complaint.submitter_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")
        if response_data.is_internal:
            raise HTTPException(status_code=403, detail="Students cannot add internal notes")

    response = Response(
        complaint_id=complaint_id,
        responder_id=current_user.id,
        message=response_data.message,
        is_internal=1 if response_data.is_internal else 0,
    )
    db.add(response)
    db.commit()
    db.refresh(response)

    if not response_data.is_internal and complaint.submitter_id != current_user.id:
        notify_submitter_response(db, complaint.submitter_id, complaint_id, complaint.ticket_number, current_user.full_name)
        db.commit()

    return ResponseSchema(
        id=response.id,
        message=response.message,
        is_internal=bool(response.is_internal),
        created_at=response.created_at,
        responder_name=current_user.full_name,
        responder_role=current_user.role.value if current_user.role else None,
    )


def _complaint_to_response(complaint: Complaint, current_user: User) -> ComplaintResponse:
    """Convert Complaint model to response schema"""
    responses = []
    for r in complaint.responses:
        if r.is_internal and complaint.submitter_id == current_user.id:
            continue  # Submitters (student/staff) don't see internal notes
        responses.append(ResponseSchema(
            id=r.id,
            message=r.message,
            is_internal=bool(r.is_internal),
            created_at=r.created_at,
            responder_name=r.responder.full_name if r.responder else None,
            responder_role=r.responder.role.value if r.responder and r.responder.role else None,
        ))
    attachments = []
    for a in getattr(complaint, "attachments", []) or []:
        attachments.append(AttachmentSchema(
            id=a.id,
            file_path=a.file_path,
            file_name=a.file_name,
            url=f"/uploads/{a.file_path}",
        ))
    invoice_items = [
        InvoiceItemSchema(id=inv.id, item=inv.item, cost=inv.cost, quantity=inv.quantity)
        for inv in getattr(complaint, "invoice_items", []) or []
    ]
    return ComplaintResponse(
        id=complaint.id,
        ticket_number=complaint.ticket_number,
        title=complaint.title,
        description=complaint.description,
        category=complaint.category,
        feedback_type=complaint.feedback_type,
        status=complaint.status,
        priority=complaint.priority,
        department=complaint.department,
        submitter_name=complaint.submitter.full_name if complaint.submitter else None,
        assigned_to_id=complaint.assigned_to_id,
        assigned_to_name=complaint.assigned_to.full_name if complaint.assigned_to else None,
        created_at=complaint.created_at,
        updated_at=complaint.updated_at,
        resolved_at=complaint.resolved_at,
        responses=responses,
        attachments=attachments,
        audit_feedback=getattr(complaint, "audit_feedback", None),
        maintenance_report=getattr(complaint, "maintenance_report", None),
        invoice_amount=getattr(complaint, "invoice_amount", None),
        invoice_notes=getattr(complaint, "invoice_notes", None),
        invoice_items=invoice_items,
    )


def _complaint_to_list_item(complaint: Complaint) -> ComplaintListItem:
    return ComplaintListItem(
        id=complaint.id,
        ticket_number=complaint.ticket_number,
        title=complaint.title,
        category=complaint.category,
        feedback_type=complaint.feedback_type,
        status=complaint.status,
        priority=complaint.priority,
        submitter_name=complaint.submitter.full_name if complaint.submitter else None,
        created_at=complaint.created_at,
    )
