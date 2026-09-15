# Tarhino / طرحینو — Architecture

Online-only modular monolith. No microservices, no Redis/Kafka/GraphQL/WebSockets. No offline layer: the server (PostgreSQL) is the source of truth for all web data.

```text
React UI → Zustand (UI state) ─┐
                               ├─→ TanStack Query ─→ REST ─→ FastAPI ─→ PostgreSQL
```

Online: every read is a GET, every write a POST/PATCH/DELETE followed by query invalidation. No client-side persistence of domain data, no sync queue, no background processes.

---

## ── REPO LAYOUT ────────────────────────────────────────────

```text
Tarhino/
├── apps/
│   ├── web/                    # Next.js app (online-only)
│   │   ├── app/                # routes only (thin)
│   │   ├── components/         # shared, non-domain UI
│   │   ├── features/           # auth, teaching, settings, excel — each with
│   │   │                       # api.ts (REST calls) + hooks.ts (React Query)
│   │   ├── hooks/              # session only (auth); no online/offline detection
│   │   ├── lib/                # date/jalali, api client, utils
│   │   ├── stores/             # Zustand (auth session only)
│   │   └── types/
│   └── api/                    # FastAPI modular monolith
│       ├── app/
│       │   ├── auth/  users/  classes/  subjects/  periods/
│       │   ├── lesson_plans/  calendar/  holidays/
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

- UI components never fetch directly. They call `features/*/api.ts` through TanStack Query hooks in `features/*/hooks.ts`.
- Route handlers in FastAPI stay thin. Business logic in `app/<module>/service.py`.
- Business components live in their feature folder, not in `components/`.

---

## ── DOMAIN MODEL ───────────────────────────────────────────

All user-owned tables carry `user_id`, `created_at`, `updated_at`. Deletes are hard — no tombstones.

```text
users
  id            uuid pk
  phone         text unique not null      # normalized E.164-ish, digits only
  first_name    text not null
  last_name     text not null
  password_hash text not null
  grading_mode  text not null default descriptive  # whole-teacher: numeric | descriptive
  created_at, updated_at

schools
  id, user_id fk→users, name, color?, created_at, updated_at
  index (user_id)

classes                                    # always under a school
  id, user_id fk→users, name, grade?, color?, school_id fk→schools not null CASCADE
  index (user_id)

subjects                                   # reusable catalog; taught via class_subjects
  id, user_id fk→users, name, color?, created_at, updated_at
  index (user_id)

class_subjects                             # which subjects are taught to which class
  id, user_id fk→users, class_id fk→classes CASCADE, subject_id fk→subjects CASCADE
  unique (user_id, class_id, subject_id)
  index (user_id, class_id)

students                                   # belong to a class, never duplicated per subject
  id, user_id fk→users, class_id fk→classes CASCADE, first_name, last_name
  index (user_id, class_id)

assessments                                # grade columns on a subject
  id, user_id fk→users, subject_id fk→subjects CASCADE, title, weight, order_index
  index (user_id, subject_id)

grades                                     # one cell: student × assessment
  id, user_id fk→users, student_id fk→students CASCADE,
  assessment_id fk→assessments CASCADE, value 0–20, label text
  unique (user_id, student_id, assessment_id)

grade_scales                               # per-subject descriptive bands
  id, user_id fk→users, subject_id fk→subjects CASCADE,
  excellent_min, good_min, pass_min (0–20, pass < good < excellent),
  excellent_label, good_label, fair_label, needs_label
  unique (user_id, subject_id)

periods                                    # bell schedule of one class, NOT hard-coded 5
  id, user_id fk→users, class_id fk→classes not null CASCADE,
  label, start_time time, end_time time,
  order_index int, created_at, updated_at
  index (user_id, class_id, order_index)

lesson_plans                               # leaf of the tree: class+subject+period required
  id, user_id fk→users
  date        date not null                # Gregorian; Jalali is presentation only
  class_id    fk→classes  not null CASCADE
  subject_id  fk→subjects not null CASCADE
  period_id   fk→periods  not null CASCADE
  activity    text
  notes       text
  status      text                         # planned | done | cancelled
  created_at, updated_at
  index (user_id, date)
  unique (user_id, date, period_id)

holidays
  id, user_id fk→users null                # null = global/official holiday, seeded
  date date not null, title text, type text, description text
  created_at, updated_at
  index (user_id, date)
  type ∈ official | school | personal
```

Notes:

- `date` stored Gregorian (`DATE`). All Jalali conversion happens in `apps/web/lib/date/` — never in models, never in components.
- Deleting a row removes it permanently (hard delete).
- Tree: school → class → {students, class_subjects, periods, lesson_plans}.
  Subjects stay a per-teacher catalog; "a class's subjects" is the
  class_subjects link.
- Rules: class requires school_id; period requires class_id; plan requires
  class_id+subject_id+period_id, the class_subjects link (422 otherwise), and
  period.class_id == plan.class_id (422 otherwise). GET
  /periods/by-class/{class_id} lists one class's bells. No recurring timetable
  table yet — date-based LessonPlans are the schedule.
- AI is server-controlled only: `POST /ai/chat` uses `AI_*` env; no settings
  endpoints, no per-user keys, never exposed to the frontend.

---

## ── AUTH ───────────────────────────────────────────────────

Phone + password. No SMS/OTP in v1.

- `phone` normalized server-side: strip non-digits, strip leading `98`/`0` → store canonical `9XXXXXXXXX`. Reject if not 10 digits starting with `9`.
- Passwords hashed with Argon2id (`argon2-cffi`). Never plaintext, never logged.
- **Access token**: JWT HS256, 30 min, payload `{sub: user_id, exp}`. Sent as `Authorization: Bearer`.
- **Refresh token**: opaque random 32 bytes, stored hashed in `refresh_tokens` table, 30 days, delivered as `httpOnly; Secure; SameSite=Lax` cookie scoped to `/auth`. Rotated on every refresh; reuse of a rotated token revokes the family.
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
GET    /users/me             → {id, phone, first_name, last_name, grading_mode, created_at}
PATCH  /users/me             {first_name?, last_name?} → 200 {user}
POST   /users/me/grading-mode {grading_mode: numeric|descriptive} → 200 {user, converted}
POST   /users/me/password    {current_password, new_password} → 204
GET    /users/me/stats       → {schools, classes, students, subjects, lesson_plans, assessments, grades}
GET    /users/me/sessions    → [{id, created_at, expires_at, is_current}]
POST   /users/me/sessions/revoke-others → 204 (keeps current session)
DELETE /users/me/data       → 204, deletes all owned rows, keeps the account logged in

GET    /classes              → [Class]
POST   /classes              → 201 Class
PATCH  /classes/{id}         → 200 Class
DELETE /classes/{id}         → 204

GET    /subjects  POST /subjects  PATCH /subjects/{id}  DELETE /subjects/{id}
GET    /periods   POST /periods   PATCH /periods/{id}   DELETE /periods/{id}
GET    /periods/by-class/{class_id} → [Period]

GET    /lesson-plans         ?date_from=&date_to=  → [LessonPlan]
POST   /lesson-plans         → 201 LessonPlan
PATCH  /lesson-plans/{id}    → 200 LessonPlan
DELETE /lesson-plans/{id}    → 204

GET    /holidays             ?date_from=&date_to=  → [Holiday]
POST   /holidays  PATCH /holidays/{id}  DELETE /holidays/{id}
```

Errors: `{detail: string | [{loc, msg, type}]}` — FastAPI default, 422 for validation, 401 unauthenticated, 404 for both missing and not-owned (never leak existence).

## ── DATA FLOW ────────────────────────────────────────────

The web client holds no domain data. Reads are React Query `useQuery` calls against the list endpoints; writes are `useMutation` calls that invalidate the affected list key on success:

```text
form submit → POST/PATCH/DELETE → invalidate ["lesson-plans" | "classes" | …]
           → list query refetches → UI re-renders from the server response
```

Offline support lives in the future Android app, not here.

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
- lesson-plan CRUD + validation, hard delete gone on next GET

Frontend (`vitest`, only where logic is non-trivial):

- Jalali conversion + week boundaries

No coverage target. Critical paths only.

---

## ── ROADMAP ────────────────────────────────────────────────

| Phase | Scope                                                                                      | Status  |
| ----- | ------------------------------------------------------------------------------------------ | ------- |
| 1     | Foundation: web app shell, RTL/fa, theme fonts; `apps/api` + SQLAlchemy + Alembic + env    | done    |
| 2     | Auth: register, login, refresh, logout, `/users/me`, protected routes                      | done    |
| 3     | Core domain: schools/classes/students/subjects/periods/plans, daily/weekly views           | done    |
| 4     | Calendar: Jalali module, holidays, working/non-working day, day navigation                 | done    |
| 5     | Online data: React Query reads/writes, invalidation, no client persistence                 | done    |
| 6     | Excel: export, import → validate → preview → confirm                                       | done    |
| 7     | AI server-only: per-teacher provider/key UI removed, `POST /ai/chat` uses `AI_*` env only  | done    |
| 8     | Class↔subject links: `class_subjects` join + backfill, plan/grade link checks, settings UI | done    |
| 9     | PDF plumbing: WeasyPrint student PDF report                                                | done    |
| 10    | Google sign-in + Sheets (later removed: auth is phone + password only)                     | removed |
| 11    | More PDFs: grades matrix, schedule; wire buttons into grades/week pages                    | done    |
| 12    | Polish: manifest, icons, mobile layout, loading states                                     |         |

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
