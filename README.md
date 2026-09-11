<img alt="Tarhino" src="apps/web/public/square.svg" width="96">

# Tarhino

Online lesson planning and schedule management for teachers. Persian, RTL, mobile-first.

---

## STACK

| Layer   | Tech                                                                                   |
| ------- | -------------------------------------------------------------------------------------- |
| Web     | Next.js, React, TypeScript, Tailwind CSS, shadcn/ui (Base UI), Zustand, TanStack Query |
| API     | Python, FastAPI, Pydantic, SQLAlchemy 2, Alembic                                       |
| DB      | PostgreSQL (Neon)                                                                      |
| Tooling | pnpm workspaces, Turborepo, uv, ESLint, Prettier                                       |

---

## REQUIREMENTS

- Node >= 20, `pnpm@10`
- Python >= 3.12, `uv`
- PostgreSQL (local or Neon)

---

## SETUP

```bash
pnpm install
cp .env.example .env
```

Backend:

```bash
cd apps/api
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:app --reload
```

Frontend:

```bash
pnpm --filter tarhino-frontend dev
```

---

## COMMANDS

```bash
pnpm dev          # all workspaces
pnpm build        # turbo build
pnpm lint
pnpm typecheck
pnpm format
```

---

## DOCS

Architecture, domain model, and API contract: [ARCHITECTURE.md](ARCHITECTURE.md)

Environment variables: [.env.example](.env.example)
