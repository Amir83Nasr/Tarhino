from pydantic import BaseModel, Field

from app.schemas.user import UserOut


class AiSettingsOut(BaseModel):
    base_url: str | None = None
    model: str | None = None
    has_key: bool = False
    # True when the effective key comes from the shared server default,
    # not from the user's own stored key.
    is_default: bool = False


class AiSettingsUpdate(BaseModel):
    base_url: str | None = Field(default=None, max_length=500)
    model: str | None = Field(default=None, max_length=200)
    # Plaintext only on the wire; persisted Fernet-encrypted. Empty/whitespace
    # means "keep the stored key".
    api_key: str | None = Field(default=None, max_length=2000)


class ChatMessage(BaseModel):
    role: str = Field(pattern="^(system|user|assistant)$")
    content: str = Field(min_length=1, max_length=20000)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=100)


class ChatResponse(BaseModel):
    text: str


class AiSettingsAndUser(BaseModel):
    settings: AiSettingsOut
    user: UserOut
