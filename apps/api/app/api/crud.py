import uuid
from collections.abc import Awaitable, Callable
from datetime import UTC, date, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel
from sqlalchemy import ColumnElement, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser
from app.db.scoped import get_scoped
from app.db.session import get_session
from app.models.teaching import UserScoped

Session = Annotated[AsyncSession, Depends(get_session)]

# Optional per-entity ownership check: (session, user_id, payload, existing_id) -> None.
# Raises HTTPException when the payload references a row the caller does not own.
ValidateFn = Callable[[AsyncSession, uuid.UUID, dict[str, Any], uuid.UUID | None], Awaitable[None]]


def _as_utc(value: datetime) -> datetime:
    """Postgres returns aware datetimes; a client may send a naive one."""
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


def build_crud_router[M: UserScoped](
    *,
    model: type[M],
    create_schema: type[BaseModel],
    update_schema: type[BaseModel],
    out_schema: type[BaseModel],
    prefix: str,
    tag: str,
    extra_where: Callable[[uuid.UUID], ColumnElement[bool]] | None = None,
    validate: ValidateFn | None = None,
    date_column: Any = None,
) -> APIRouter:
    """Wire standard list/create/patch/soft-delete routes for a user-scoped entity.

    Owned entities differ only by their schemas and an optional ownership check, so
    the routes are generated instead of copied five times. Anything beyond plain
    scoped CRUD (calendar projection, sync) gets its own module.
    """
    router = APIRouter(prefix=prefix, tags=[tag])
    out_config = {"response_model": out_schema}

    def read_filter(user: CurrentUser) -> ColumnElement[bool]:
        base = model.user_id == user.id
        return base if extra_where is None else base | extra_where(user.id)

    @router.get("", **out_config)
    async def list_items(
        user: CurrentUser,
        session: Session,
        updated_since: Annotated[datetime | None, Query()] = None,
        limit: Annotated[int, Query(ge=1, le=500)] = 200,
        date_from: Annotated[date | None, Query()] = None,
        date_to: Annotated[date | None, Query()] = None,
        include_deleted: Annotated[bool, Query()] = False,
    ) -> list[Any]:
        stmt = select(model).where(read_filter(user))
        if not include_deleted:
            stmt = stmt.where(model.deleted_at.is_(None))

        # ponytail: cursor is updated_at alone, so rows sharing a timestamp with a
        # previous page's last row can be skipped. Move to (updated_at, id) when a
        # user has enough rows for it to matter.
        stmt = stmt.order_by(model.updated_at, model.id).limit(limit)
        if updated_since is not None:
            stmt = stmt.where(model.updated_at > updated_since)
        # ponytail: range filter only for date-keyed entities (plans, holidays).
        # Add a real calendar projection when the week view needs aggregates.
        if date_column is not None:
            if date_from is not None:
                stmt = stmt.where(date_column >= date_from)
            if date_to is not None:
                stmt = stmt.where(date_column <= date_to)
        return list(await session.scalars(stmt))

    @router.post("", status_code=status.HTTP_201_CREATED, **out_config)
    async def create_item(
        payload: create_schema,  # type: ignore[valid-type]
        user: CurrentUser,
        session: Session,
    ) -> Any:
        data = payload.model_dump()
        client_id = data.pop("id", None)

        # Idempotency: an offline client that re-sends after a dropped response
        # gets its own row back instead of a duplicate-key error.
        if client_id is not None:
            existing = await session.get(model, client_id)
            if existing is not None:
                if existing.user_id != user.id:
                    raise HTTPException(status.HTTP_409_CONFLICT, "ID already in use")
                return existing

        if validate is not None:
            await validate(session, user.id, data, None)
        row = model(id=client_id or uuid.uuid4(), user_id=user.id, **data)
        session.add(row)
        await session.commit()
        await session.refresh(row)
        return row

    @router.patch("/{item_id}", **out_config)
    async def update_item(
        item_id: uuid.UUID,
        payload: update_schema,  # type: ignore[valid-type]
        user: CurrentUser,
        session: Session,
    ) -> Any:
        row = await get_scoped(session, model, item_id, user.id)
        if row is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")

        data = payload.model_dump(exclude_unset=True)
        base_updated_at = data.pop("base_updated_at", None)

        # Optimistic concurrency: the client tells us which version it edited. A
        # mismatch means another device got there first, so refuse rather than
        # silently clobber.
        if base_updated_at is not None and _as_utc(row.updated_at) != _as_utc(base_updated_at):
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "این رکورد روی دستگاه دیگری تغییر کرده است",
            )

        if validate is not None:
            await validate(session, user.id, data, item_id)
        for key, value in data.items():
            setattr(row, key, value)

        await session.commit()
        await session.refresh(row)
        return row

    @router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
    async def delete_item(item_id: uuid.UUID, user: CurrentUser, session: Session) -> Response:
        row = await get_scoped(session, model, item_id, user.id)
        if row is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")

        # Tombstone, not DELETE: the row has to survive so the removal can sync.
        row.deleted_at = datetime.now(UTC)
        await session.commit()
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    return router


async def count_live(session: AsyncSession, model: type[UserScoped], user_id: uuid.UUID) -> int:
    return (
        await session.scalar(
            select(func.count())
            .select_from(model)
            .where(model.user_id == user_id, model.deleted_at.is_(None))
        )
        or 0
    )
