import uuid
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict

from app.core.phone import normalize_phone

Phone = Annotated[str, AfterValidator(normalize_phone)]


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    phone: str
    first_name: str
    last_name: str
