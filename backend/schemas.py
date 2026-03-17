from datetime import datetime
from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, List
from app.models import ComplaintStatus, ComplaintCategory, FeedbackType, UserRole


# Auth Schemas
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    matric_number: Optional[str] = None
    department: Optional[str] = None
    role: str = "student"

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        valid = ("student", "staff", "admin", "management", "auditor", "maintenance_officer")
        if v not in valid:
            raise ValueError(f"role must be one of: {', '.join(valid)}")
        return v


class UserUpdate(BaseModel):
    is_active: Optional[bool] = None
    role: Optional[str] = None
    full_name: Optional[str] = None
    department: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    matric_number: Optional[str] = None
    department: Optional[str] = None
    role: UserRole
    is_active: int
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse


# Complaint Schemas
class ComplaintCreate(BaseModel):
    title: str
    description: str
    category: ComplaintCategory
    feedback_type: FeedbackType = FeedbackType.COMPLAINT
    department: Optional[str] = None


class InvoiceItemCreate(BaseModel):
    item: str
    cost: int  # in kobo (₦1 = 100 kobo)
    quantity: int = 1


class InvoiceItemSchema(BaseModel):
    id: int
    item: str
    cost: int
    quantity: int

    class Config:
        from_attributes = True


class ComplaintUpdate(BaseModel):
    status: Optional[ComplaintStatus] = None
    assigned_to_id: Optional[int] = None
    priority: Optional[int] = None
    audit_feedback: Optional[str] = None
    maintenance_report: Optional[str] = None
    invoice_amount: Optional[int] = None
    invoice_notes: Optional[str] = None
    invoice_items: Optional[List["InvoiceItemCreate"]] = None


class ResponseCreate(BaseModel):
    message: str
    is_internal: bool = False


class ResponseSchema(BaseModel):
    id: int
    message: str
    is_internal: bool
    created_at: datetime
    responder_name: Optional[str] = None
    responder_role: Optional[str] = None

    class Config:
        from_attributes = True


class AttachmentSchema(BaseModel):
    id: int
    file_path: str
    file_name: str
    url: Optional[str] = None

    class Config:
        from_attributes = True


class ComplaintResponse(BaseModel):
    id: int
    ticket_number: str
    title: str
    description: str
    category: ComplaintCategory
    feedback_type: FeedbackType
    status: ComplaintStatus
    priority: int
    department: Optional[str] = None
    submitter_name: Optional[str] = None
    assigned_to_id: Optional[int] = None
    assigned_to_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime] = None
    responses: List[ResponseSchema] = []
    attachments: List[AttachmentSchema] = []
    audit_feedback: Optional[str] = None
    maintenance_report: Optional[str] = None
    invoice_amount: Optional[int] = None
    invoice_notes: Optional[str] = None
    invoice_items: List["InvoiceItemSchema"] = []

    class Config:
        from_attributes = True


class ComplaintListItem(BaseModel):
    id: int
    ticket_number: str
    title: str
    category: ComplaintCategory
    feedback_type: FeedbackType
    status: ComplaintStatus
    priority: int
    submitter_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
