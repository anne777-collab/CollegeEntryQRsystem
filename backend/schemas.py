from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class RegisterStudentRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    roll_no: str = Field(..., min_length=1, max_length=50)
    course: str = Field(..., min_length=1, max_length=120)
    contact: str = Field(..., min_length=1, max_length=50)


class RegisterStudentResponse(BaseModel):
    message: str
    token: str
    qr_code_url: str


class VerifyQRRequest(BaseModel):
    token: str = Field(..., min_length=1, max_length=20)


class VerifyQRResponse(BaseModel):
    status: Literal["VALID", "INVALID", "USED"]
    message: str


class StudentResponse(BaseModel):
    id: int
    name: str
    roll_no: str
    course: str
    contact: str
    token: str
    is_used: bool
    created_at: datetime

    class Config:
        orm_mode = True
