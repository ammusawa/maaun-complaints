from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship

from app.database import Base
import enum


class UserRole(str, enum.Enum):
    STUDENT = "student"
    STAFF = "staff"
    ADMIN = "admin"
    MANAGEMENT = "management"
    AUDITOR = "auditor"
    MAINTENANCE_OFFICER = "maintenance_officer"


class ComplaintStatus(str, enum.Enum):
    PENDING = "pending"  # New, awaiting management
    ASSIGNED_TO_AUDITOR = "assigned_to_auditor"
    AUDITED = "audited"  # Auditor sent feedback
    ASSIGNED_TO_MAINTENANCE = "assigned_to_maintenance"
    MAINTENANCE_IN_PROGRESS = "maintenance_in_progress"
    PENDING_APPROVAL = "pending_approval"  # Invoice/report awaiting management approval
    APPROVED = "approved"  # Management approved repair
    REPAIR_COMPLETED = "repair_completed"
    FINAL_AUDIT = "final_audit"  # Assigned to auditor for final verification
    RESOLVED = "resolved"
    REJECTED = "rejected"


class ComplaintCategory(str, enum.Enum):
    ACADEMIC = "academic"
    FACILITIES = "facilities"
    HOSTEL = "hostel"
    CLASS = "class"
    AUDITORIUM = "auditorium"
    SECURITY = "security"
    FINANCE = "finance"
    LIBRARY = "library"
    TRANSPORT = "transport"
    CAFETERIA = "cafeteria"
    ICT = "ict"
    OTHER = "other"


class FeedbackType(str, enum.Enum):
    COMPLAINT = "complaint"
    SUGGESTION = "suggestion"
    COMMENDATION = "commendation"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    matric_number = Column(String(50), unique=True, nullable=True)  # For students
    department = Column(String(255), nullable=True)
    role = Column(Enum(UserRole, values_callable=lambda x: [e.value for e in x]), default=UserRole.STUDENT)
    is_active = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    complaints = relationship("Complaint", back_populates="submitter", foreign_keys="Complaint.submitter_id")
    assigned_complaints = relationship("Complaint", back_populates="assigned_to", foreign_keys="Complaint.assigned_to_id")
    responses = relationship("Response", back_populates="responder")
    notifications = relationship("Notification", back_populates="user")


class Complaint(Base):
    __tablename__ = "complaints"

    id = Column(Integer, primary_key=True, index=True)
    ticket_number = Column(String(20), unique=True, index=True, nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    category = Column(Enum(ComplaintCategory, values_callable=lambda x: [e.value for e in x]), nullable=False)
    feedback_type = Column(Enum(FeedbackType, values_callable=lambda x: [e.value for e in x]), default=FeedbackType.COMPLAINT)
    status = Column(Enum(ComplaintStatus, values_callable=lambda x: [e.value for e in x]), default=ComplaintStatus.PENDING)
    priority = Column(Integer, default=1)  # 1=low, 2=medium, 3=high

    submitter_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    assigned_to_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    department = Column(String(255), nullable=True)

    audit_feedback = Column(Text, nullable=True)
    maintenance_report = Column(Text, nullable=True)
    invoice_amount = Column(Integer, nullable=True)  # in kobo/smallest unit, or use Float
    invoice_notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)

    submitter = relationship("User", back_populates="complaints", foreign_keys=[submitter_id])
    assigned_to = relationship("User", back_populates="assigned_complaints", foreign_keys=[assigned_to_id])
    responses = relationship("Response", back_populates="complaint", order_by="Response.created_at")
    attachments = relationship("ComplaintAttachment", back_populates="complaint")
    invoice_items = relationship("InvoiceItem", back_populates="complaint", cascade="all, delete-orphan")


class InvoiceItem(Base):
    __tablename__ = "invoice_items"

    id = Column(Integer, primary_key=True, index=True)
    complaint_id = Column(Integer, ForeignKey("complaints.id"), nullable=False)
    item = Column(String(255), nullable=False)
    cost = Column(Integer, nullable=False)  # in kobo (₦1 = 100 kobo)
    quantity = Column(Integer, nullable=False, default=1)

    complaint = relationship("Complaint", back_populates="invoice_items")


class ComplaintAttachment(Base):
    __tablename__ = "complaint_attachments"

    id = Column(Integer, primary_key=True, index=True)
    complaint_id = Column(Integer, ForeignKey("complaints.id"), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_name = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    complaint = relationship("Complaint", back_populates="attachments")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    type = Column(String(50), nullable=False)  # complaint_created, assigned, status_changed, response_added, etc.
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=True)
    link = Column(String(500), nullable=True)  # e.g. /complaints/123
    complaint_id = Column(Integer, ForeignKey("complaints.id"), nullable=True)
    is_read = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="notifications")


class Response(Base):
    __tablename__ = "responses"

    id = Column(Integer, primary_key=True, index=True)
    complaint_id = Column(Integer, ForeignKey("complaints.id"), nullable=False)
    responder_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    message = Column(Text, nullable=False)
    is_internal = Column(Integer, default=0)  # Internal notes not visible to submitter
    created_at = Column(DateTime, default=datetime.utcnow)

    complaint = relationship("Complaint", back_populates="responses")
    responder = relationship("User", back_populates="responses")
