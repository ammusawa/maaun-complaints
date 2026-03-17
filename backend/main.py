import os
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.database import init_db
from app.routers import auth, complaints, users, notifications

settings = get_settings()
app = FastAPI(
    title="MAAUN Complaint & Feedback Management System",
    description="School Complaint and Feedback Management for Maryam Abacha American University Nigeria",
    version="1.0.0",
)

# CORS must be added before other middleware/routes
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Ensure 500 errors return JSON with proper CORS headers."""
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc)},
    )

app.include_router(auth.router, prefix="/api")
app.include_router(complaints.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")

# Ensure uploads directory exists and serve static files
UPLOAD_DIR = Path(settings.UPLOAD_DIR)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")


@app.on_event("startup")
def startup():
    init_db()
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@app.get("/")
def root():
    return {
        "message": "MAAUN Complaint & Feedback Management System API",
        "docs": "/docs",
        "version": "1.0.0"
    }


@app.get("/api/health")
def health():
    return {"status": "ok"}
