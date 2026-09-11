import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.teaching import UserScoped


async def get_scoped[T: UserScoped](
    session: AsyncSession, model: type[T], entity_id: uuid.UUID, user_id: uuid.UUID
) -> T | None:
    """Fetch a row owned by the user; None otherwise.

    Ownership belongs in the query itself: a row owned by someone else is
    indistinguishable from a missing one.
    """
    return await session.scalar(
        select(model).where(
            model.id == entity_id,
            model.user_id == user_id,
        )
    )
