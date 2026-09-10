# Tarhino / طرحینو — Architecture

Offline-first modular monolith. No microservices, no Redis/Kafka/GraphQL/WebSockets.

```text
React UI → Zustand (UI state) ─┐
                               ├─→ Dexie / IndexedDB ─→ Sync Queue ─→ REST ─→ FastAPI ─→ PostgreSQL
              TanStack Query ──┘
```

Local-first: UI reads/writes Dexie first. Network is a background concern.

---

## ── REPO LAYOUT ────────────────────────────────────────────

```text
Tarhino/
├── apps/
│   ├── web/                    # Next.js PWA
│   │   ├── app/                # routes only (thin)
│   │   ├── components/         # shared, non-domain UI
│   │   ├── features/           # auth, dashboard, lesson-plans, calendar,
│   │   │                       # classes, subjects, holidays, import-export, sync
│   │   ├── hooks/
│   │   ├── lib/                # date/jalali, fetch, utils
│   │   ├── db/                 # Dexie schema + repositories (ONLY place touching IndexedDB)
│   │   ├── services/           # REST clients
│   │   ├── stores/             # Zustand
│   │   └── types/
│   └── api/                    # FastAPI modular monolith
│       ├── app/
│       │   ├── auth/  users/  classes/  subjects/  periods/
│       │   ├── lesson_plans/  calendar/  holidays/  sync/
│       │   └── main.py
│       ├── core/               # config, security, deps
│       ├── db/                 # session, base
│       ├── models/             # SQLAlchemy 2
│       ├── schemas/            # Pydantic
│       ├── migrations/         # Alembic
│       └── tests/
└── packages/
    ├── ui/                     # shadcn components (@workspace/ui)
    ├── eslint-config/
    └── typescript-config/
```

Rules:

- UI components never touch IndexedDB directly. They call `db/repositories/*`.
- Route handlers in FastAPI stay thin. Business logic in `app/<module>/service.py`.
- Business components live in their feature folder, not in `components/`.

---

## ── DOMAIN MODEL ───────────────────────────────────────────

All user-owned tables carry `user_id`, `created_at`, `updated_at`, `deleted_at` (soft delete = tombstone).

```text
users
  id            uuid pk
  phone         text unique not null      # normalized E.164-ish, digits only
  first_name    text not null
  last_name     text not null
  password_hash text not null
  created_at, updated_at

classes
  id, user_id fk→users, name, grade?, color?, created_at, updated_at, deleted_at
  index (user_id, deleted_at)

subjects
  id, user_id fk→users, name, color?, created_at, updated_at, deleted_at
  index (user_id, deleted_at)

periods                                    # configurable bell schedule, NOT hard-coded 5
  id, user_id fk→users, label, start_time time, end_time time,
  order_index int, created_at, updated_at, deleted_at
  index (user_id, order_index)

lesson_plans
  id, user_id fk→users
  date        date not null                # Gregorian; Jalali is presentation only
  class_id    fk→classes  null
  subject_id  fk→subjects null
  period_id   fk→periods  null
  activity    text
  notes       text
  status      text                         # planned | done | cancelled
  created_at, updated_at, deleted_at
  index (user_id, date, deleted_at)
  unique (user_id, date, period_id) where deleted_at is null

holidays
  id, user_id fk→users null                # null = global/official holiday, seeded
  date date not null, title text, type text, description text
  created_at, updated_at, deleted_at
  index (user_id, date)
  type ∈ official | school | personal
```

Notes:

- `date` stored Gregorian (`DATE`). All Jalali conversion happens in `apps/web/lib/date/` — never in models, never in components.
- Deleting a lesson plan sets `deleted_at`; the row survives so the delete can sync.
- Periods are per-user rows so each teacher configures their own schedule.

---

## ── AUTH ───────────────────────────────────────────────────

Phone + password. No SMS/OTP in v1.

- `phone` normalized server-side: strip non-digits, strip leading `98`/`0` → store canonical `9XXXXXXXXX`. Reject if not 10 digits starting with `9`.
- Passwords hashed with Argon2id (`argon2-cffi`). Never plaintext, never logged.
- **Access token**: JWT HS256, 30 min, payload `{sub: user_id, exp}`. Sent as `Authorization: Bearer`.
- **Refresh token**: opaque random 32 bytes, stored hashed in `refresh_tokens` table, 30 days, delivered as `httpOnly; Secure; SameSite=Lax` cookie scoped to `/auth`. Rotated on every refresh; reuse of a rotated token revokes the family.
- Offline consequence: when the access token expires with no network, reads keep working from Dexie and writes queue. Refresh happens on reconnect. No feature is gated behind a live request.
- Authorization is server-side only. Every query filters `user_id = current_user.id`. Client-supplied `user_id` is ignored everywhere.

Split: `app/auth/` owns register/login/refresh/logout, `app/users/` owns `/users/me`. Token issuing sits behind `core/security.py` so the scheme can be swapped later.

---

## ── API CONTRACT ───────────────────────────────────────────

Base `/api/v1`. All non-auth routes require a bearer token. All list responses are scoped to the caller.

```text
POST   /auth/register        {phone, first_name, last_name, password} → 201 {user}
POST   /auth/login           {phone, password} → 200 {access_token, user} + refresh cookie
POST   /auth/refresh         (cookie) → 200 {access_token}
POST   /auth/logout          → 204, revokes refresh family
GET    /users/me             → {id, phone, first_name, last_name}

GET    /classes              ?updated_since=  → [Class]
POST   /classes              → 201 Class
PATCH  /classes/{id}         → 200 Class
DELETE /classes/{id}         → 204 (soft)

GET    /subjects  POST /subjects  PATCH /subjects/{id}  DELETE /subjects/{id}
GET    /periods   POST /periods   PATCH /periods/{id}   DELETE /periods/{id}

GET    /lesson-plans         ?from=&to=&updated_since=  → [LessonPlan]
POST   /lesson-plans         → 201 LessonPlan
PATCH  /lesson-plans/{id}    → 200 LessonPlan
DELETE /lesson-plans/{id}    → 204 (soft)

GET    /holidays             ?from=&to=  → [Holiday]
POST   /holidays  PATCH /holidays/{id}  DELETE /holidays/{id}

GET    /calendar             ?from=&to=  → {days: [{date, is_holiday, holiday?, plans: [...]}]}

POST   /sync                 → push + pull in one round trip (see below)
```

Errors: `{detail: string | [{loc, msg, type}]}` — FastAPI default, 422 for validation, 401 unauthenticated, 404 for both missing and not-owned (never leak existence).

`/calendar` is a read-optimized projection, not a table. It exists so the mobile daily/weekly views do one request instead of four.

---

## ── OFFLINE + SYNC ─────────────────────────────────────────

Dexie stores mirror the server tables plus a local-only `sync_queue`.

```text
sync_queue
  ++id          autoincrement
  entity        'lesson_plans' | 'classes' | ...
  entity_id     uuid
  op            'create' | 'update' | 'delete'
  payload       object
  created_at    iso
```

Every mirrored record also carries local-only `sync_status ∈ synced | pending | conflict`.

Write path:

```text
form submit → repository.write() → Dexie put + sync_queue add (one Dexie transaction)
           → UI re-renders from Dexie immediately
           → background sync flushes queue when online
```

Pull path: `GET /sync?since=<iso>` returns rows with `updated_at > since`, including tombstones.

Conflict strategy (deliberate v1 simplification):

- Last-write-wins by `updated_at`, server clock authoritative.
- Before overwriting, the client compares the server `updated_at` against the base revision it last saw. If they differ **and** the local record is `pending`, the record is marked `conflict` and **not** overwritten — the user picks a version in the UI. Never silently discard user edits.
- A `conflict` record is excluded from the push queue until resolved.

`ponytail:` LWW with a conflict flag, not a CRDT. Ceiling: two devices editing the same period concurrently. Upgrade path: per-field merge or vector clocks if that ever actually happens.

Sync triggers: on app start, on `online` event, on write (debounced 2s), on manual pull-to-refresh. Not on a timer.

---

## ── DATE / JALALI ──────────────────────────────────────────

Single module `apps/web/lib/date/` wrapping `Intl.DateTimeFormat` with `fa-IR-u-ca-persian` for display, and a small conversion pair for arithmetic. No hand-rolled Jalali algorithms. No date math inside components — components call `formatJalali()`, `toJalali()`, `addDays()`.

Persian digit rendering is a display concern, applied at the formatter, not stored.

---

## ── SECURITY ───────────────────────────────────────────────

- Secrets from env only. `.env` gitignored, `.env.example` committed.
- CORS: explicit origin allowlist from env, credentials enabled (refresh cookie).
- Rate-limit `/auth/login` and `/auth/register` per phone + IP.
- Input validated by Pydantic server-side regardless of client Zod schemas.
- Ownership checked in the query (`WHERE user_id = :me`), not in a branch after fetch.
- No tokens, passwords, or phone numbers in logs.

---

## ── TESTING ────────────────────────────────────────────────

Backend (`pytest` + httpx AsyncClient, per-test transaction rollback):

- register/login/refresh, wrong password, duplicate phone, phone normalization
- cross-user access returns 404 (authorization)
- lesson-plan CRUD + validation
- sync push/pull, tombstone propagation, conflict flagging

Frontend (`vitest`, only where logic is non-trivial):

- Jalali conversion + week boundaries
- repository write → queue → flush ordering
- conflict detection on pull

No coverage target. Critical paths only.

---

## ── ROADMAP ────────────────────────────────────────────────

| Phase | Scope                                                                                          | Status |
| ----- | ---------------------------------------------------------------------------------------------- | ------ |
| 1     | Foundation: web app shell, RTL/fa, theme, theme fonts; `apps/api` + SQLAlchemy + Alembic + env | next   |
| 2     | Auth: register, login, refresh, logout, `/users/me`, protected routes                          |        |
| 3     | Core domain: classes, subjects, periods, lesson plans, daily view, weekly view, upcoming days  |        |
| 4     | Calendar: Jalali module, holidays, working/non-working day, day navigation                     |        |
| 5     | Offline: Dexie schema, repositories, offline reads/writes, online detection, queue             |        |
| 6     | Sync: `/sync` push+pull, sync status UI, conflict recovery                                     |        |
| 7     | Excel: export, import → validate → preview → confirm                                           |        |
| 8     | PWA: manifest, service worker, offline startup, mobile polish                                  |        |

Each phase ships with its own validation, error states, RTL check, and tests before moving on.

---

## ── DEPLOYMENT (BASIC) ─────────────────────────────────────

- Web: Vercel (or any Node host) — `pnpm --filter web build`.
- API: container on Fly.io/Render — `uvicorn app.main:app`.
- DB: Neon PostgreSQL, pooled connection string, `alembic upgrade head` on release.
- Env separation: `APP_ENV ∈ development | production`; secrets differ per environment.

---

## ── OPEN DECISION ──────────────────────────────────────────

Repo name and `AGENTS.md` say **Tarhino / طرحینو**; the product spec says **Planino — طرحینو**. Docs here use Tarhino. Confirm which is canonical before user-facing copy is written.
