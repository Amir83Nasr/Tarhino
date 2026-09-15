import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, Field

from app.core.phone import normalize_phone

Phone = Annotated[str, AfterValidator(normalize_phone)]


GradingMode = Literal["numeric", "descriptive"]


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    phone: str
    first_name: str
    last_name: str
    # Always "descriptive": elementary teachers pick levels only. Kept on the
    # payload so older clients keep parsing; the switch endpoint is gone.
    grading_mode: GradingMode = "descriptive"
    created_at: datetime


class UserUpdate(BaseModel):
    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class SessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    expires_at: datetime
    is_current: bool = False
    device: str | None = None
