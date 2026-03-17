# MAAUN Complaint & Feedback Management System

**Maryam Abacha American University Nigeria (MAAUN)**

A structured platform for submitting, tracking, and resolving complaints and feedback within the university. Built with Python (FastAPI), Next.js, and MySQL.

## Features

- **User Roles**: Students, Staff, and Administrators
- **Complaint Submission**: Submit complaints, suggestions, or commendations with categories
- **Status Tracking**: Pending → In Progress → Resolved/Rejected
- **Categories**: Academic, Facilities, Hostel, Security, Finance, Library, Transport, Cafeteria, ICT, Other
- **Admin Dashboard**: Manage complaints, assign to staff, update status, view statistics
- **Responses**: Threaded responses and internal notes (staff only)
- **Reports**: Statistics for decision-making

## Tech Stack

| Layer     | Technology |
|----------|------------|
| Backend  | Python, FastAPI |
| Frontend | Next.js 14, React, TypeScript, Tailwind CSS |
| Database | MySQL |

## Project Structure

```
maaun-complaints/
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── main.py         # Application entry
│   │   ├── config.py       # Settings
│   │   ├── database.py     # DB connection
│   │   ├── models.py       # SQLAlchemy models
│   │   ├── schemas.py      # Pydantic schemas
│   │   ├── auth.py         # JWT authentication
│   │   ├── utils.py        # Helpers
│   │   └── routers/        # API routes
│   ├── scripts/
│   │   └── create_admin.py # Create admin user
│   └── requirements.txt
├── frontend/               # Next.js frontend
│   ├── app/               # App Router pages
│   ├── components/
│   └── lib/               # API client, auth
├── database/
│   └── init.sql           # DB initialization
└── README.md
```

## Setup

### Prerequisites

- Python 3.10+
- Node.js 18+
- MySQL 8.0+

### 1. Database

Create the database:

```sql
CREATE DATABASE maaun_complaints;
```

### 2. Backend

```bash
cd maaun-complaints/backend
python -m venv venv

# Windows
venv\Scripts\activate

# Linux/Mac
source venv/bin/activate

pip install -r requirements.txt
```

Copy `.env.example` to `.env` and update:

```
DATABASE_URL=mysql+pymysql://root:YOUR_PASSWORD@localhost:3306/maaun_complaints
SECRET_KEY=your-secret-key
```

Start the backend (creates tables on first run):

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Create admin user:

```bash
python -m scripts.create_admin
# Default: admin@maaun.edu.ng / Admin@123
```

### 3. Frontend

```bash
cd maaun-complaints/frontend
npm install
```

Copy `.env.local.example` to `.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Start the frontend:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## API Documentation

When the backend is running, visit:

- Swagger UI: [http://localhost:8000/docs](http://localhost:8000/docs)
- ReDoc: [http://localhost:8000/redoc](http://localhost:8000/redoc)

## Default Admin

- **Email**: admin@maaun.edu.ng  
- **Password**: Admin@123  

Change these in production.

## License

Academic project for MAAUN.
