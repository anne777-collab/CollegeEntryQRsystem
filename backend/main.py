from pathlib import Path
from typing import List

from fastapi import FastAPI
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.database import Base, engine, get_db
from backend.models import Student
from backend.schemas import (
    RegisterStudentRequest,
    RegisterStudentResponse,
    StudentResponse,
    VerifyQRRequest,
    VerifyQRResponse,
)
from backend.utils import generate_token, safe_filename, save_qr_code


BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"
QR_CODES_DIR = BASE_DIR / "qr_codes"


def ensure_app_directories() -> None:
    FRONTEND_DIR.mkdir(parents=True, exist_ok=True)
    QR_CODES_DIR.mkdir(parents=True, exist_ok=True)


def sanitize_input(value: str, field_name: str) -> str:
    cleaned = value.strip()
    if not cleaned:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{field_name} cannot be empty.",
        )
    return cleaned


ensure_app_directories()
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="College Event QR Entry System",
    description="FastAPI application for QR-based student registration and entry verification.",
    version="1.0.0",
)

app.mount("/frontend", StaticFiles(directory="frontend"), name="frontend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")
app.mount("/qr_codes", StaticFiles(directory=str(QR_CODES_DIR)), name="qr_codes")


@app.get("/", include_in_schema=False)
def serve_index() -> FileResponse:
    return FileResponse(FRONTEND_DIR / "index.html")


@app.get("/scanner", include_in_schema=False)
def serve_scanner() -> FileResponse:
    return FileResponse(FRONTEND_DIR / "scanner.html")


@app.get("/admin", include_in_schema=False)
def serve_admin() -> FileResponse:
    return FileResponse(FRONTEND_DIR / "admin.html")


@app.get("/health")
def health_check() -> dict:
    return {"status": "ok"}


@app.post("/register", response_model=RegisterStudentResponse, status_code=status.HTTP_201_CREATED)
def register_student(payload: RegisterStudentRequest, db: Session = Depends(get_db)) -> RegisterStudentResponse:
    name = sanitize_input(payload.name, "Name")
    roll_no = sanitize_input(payload.roll_no, "Roll number")
    course = sanitize_input(payload.course, "Course")
    contact = sanitize_input(payload.contact, "Contact")

    existing_student = db.execute(
        select(Student).where(Student.roll_no == roll_no)
    ).scalar_one_or_none()
    if existing_student:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A student with this roll number is already registered.",
        )

    token = generate_token()
    while db.execute(select(Student).where(Student.token == token)).scalar_one_or_none():
        token = generate_token()

    qr_file_name = f"{safe_filename(roll_no)}_{token}.png"
    qr_file_path = QR_CODES_DIR / qr_file_name
    student = Student(
        name=name,
        roll_no=roll_no,
        course=course,
        contact=contact,
        token=token,
    )

    try:
        db.add(student)
        db.flush()
        save_qr_code(token, qr_file_path)
        db.commit()
    except IntegrityError:
        db.rollback()
        if qr_file_path.exists():
            qr_file_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to register student because the roll number or token already exists.",
        )
    except Exception as exc:
        db.rollback()
        if qr_file_path.exists():
            qr_file_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate QR code for the student.",
        ) from exc

    return RegisterStudentResponse(
        message="Student registered successfully.",
        token=token,
        qr_code_url=f"/qr_codes/{qr_file_name}",
    )


@app.post("/verify", response_model=VerifyQRResponse)
def verify_qr(payload: VerifyQRRequest, db: Session = Depends(get_db)) -> VerifyQRResponse:
    token = sanitize_input(payload.token, "Token")

    try:
        result = db.execute(
            update(Student)
            .where(Student.token == token, Student.is_used.is_(False))
            .values(is_used=True)
        )

        if result.rowcount == 1:
            db.commit()
            return VerifyQRResponse(status="VALID", message="Entry allowed.")

        student = db.execute(
            select(Student).where(Student.token == token)
        ).scalar_one_or_none()
        if student is None:
            return VerifyQRResponse(status="INVALID", message="Invalid QR code.")

        return VerifyQRResponse(status="USED", message="This QR code has already been used.")
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to verify the QR code.",
        ) from exc


@app.get("/students", response_model=List[StudentResponse])
def get_students(db: Session = Depends(get_db)) -> List[StudentResponse]:
    students = db.execute(
        select(Student).order_by(Student.created_at.desc())
    ).scalars().all()
    return students
