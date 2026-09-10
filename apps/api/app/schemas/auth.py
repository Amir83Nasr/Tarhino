from pydantic import BaseModel, Field

from app.schemas.user import Phone, UserOut


class RegisterRequest(BaseModel):
    phone: Phone
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    phone: Phone
    password: str = Field(min_length=1, max_length=128)


class PhoneCheckRequest(BaseModel):
    phone: Phone


class PhoneCheckResponse(BaseModel):
    exists: bool


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
