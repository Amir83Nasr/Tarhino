<img src="apps/web/public/app-icon.svg" alt="Tarhino" width="96" />

# Tarhino | طرحینو

برنامه‌ریزی ساده، تدریس بهتر

Offline-first lesson planning and schedule management for teachers. Persian, RTL, mobile-first, installable as a PWA.

---

## ── STACK ──────────────────────────────────────────────────

| Layer   | Tech                                                                                                     |
| ------- | -------------------------------------------------------------------------------------------------------- |
| Web     | Next.js, React, TypeScript, Tailwind CSS, shadcn/ui (Base UI), Zustand, TanStack Query, Dexie, IndexedDB |
| API     | Python, FastAPI, Pydantic, SQLAlchemy 2, Alembic                                                         |
| DB      | PostgreSQL (Neon)                                                                                        |
| Tooling | pnpm workspaces, Turborepo, uv, ESLint, Prettier                                                         |

---

## ── REQUIREMENTS ───────────────────────────────────────────

- Node >= 20, `pnpm@10`
- Python >= 3.12, `uv`
- PostgreSQL (local or Neon)

---

## ── SETUP ──────────────────────────────────────────────────

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

## ── COMMANDS ───────────────────────────────────────────────

```bash
pnpm dev          # all workspaces
pnpm build        # turbo build
pnpm lint
pnpm typecheck
pnpm format
```

---

## ── DOCS ───────────────────────────────────────────────────

Architecture, domain model, API contract, and sync strategy: [ARCHITECTURE.md](ARCHITECTURE.md)

Environment variables: [.env.example](.env.example)

---

## ── OFFLINE MODEL ──────────────────────────────────────────

Data reads and writes hit IndexedDB first; the UI never waits on the network. Changes queue locally and flush to the API when connectivity returns. Deletes are tombstones so they can sync. Conflicts are surfaced to the user, never silently discarded.
