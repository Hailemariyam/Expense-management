# Multi-Tenant Expense Management System

A company-scoped expense tracking and approval system: employees submit expenses with
receipts, managers approve or reject them, admins manage their company's users, and
everyone sees analytics for their own company — never anyone else's.

**Stack:** Next.js + TypeScript (frontend) · Node.js + Express + TypeScript (backend) ·
PostgreSQL · Prisma · JWT (access + refresh) · RBAC · Docker Compose for local Postgres.

> **Status:** Backend + frontend are both implemented for the SOW scope.
> Backend: REST API, data layer, RBAC, multi-tenancy, JWT auth with refresh
> rotation, expense workflow, receipt upload, analytics endpoints, OpenAPI/Swagger
> docs, 50 passing tests. Frontend: Next.js 16 App Router app for the three roles
> (employee / manager / admin) — auth, company onboarding, dashboard, expense CRUD
> + receipts, submit / approve / reject, admin user management, analytics — with an
> in-memory access token + httpOnly refresh cookie via a Next.js BFF.

---

## Architecture

Clean architecture with strict layer separation (SOW §3). Each layer only talks to the
one directly below it:

```
Next.js  ──REST──▶  Express Routes
                        │
                        ▼
              Authentication middleware      (verify JWT → req.auth = { userId, companyId, role })
                        ▼
              Tenant / RBAC middleware        (authorize(role…);  tenant scoping enforced in repos)
                        ▼
                   Controller                 (HTTP ⇄ service; no business logic)
                        ▼
                    Service                   (business rules, workflow, guardrails)
                        ▼
                   Repository                 (the ONLY layer that touches Prisma; every query
                        ▼                      is scoped by company_id)
                  PostgreSQL
```

### Directory layout

```
Expense_Management/
├── docker-compose.yml         # local Postgres (host port 5433)
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma      # data model — mirrors the Section 1 DDL
│   │   ├── migrations/        # versioned SQL migrations (prisma migrate)
│   │   └── seed.ts            # one company: admin + manager + employee + sample expenses
│   ├── src/
│   │   ├── config/            # env validation (zod), Prisma client singleton
│   │   ├── middleware/        # authenticate, authorize, validate, upload, errorHandler
│   │   ├── routes/            # Express routers (one per resource) + index
│   │   ├── controllers/       # thin HTTP adapters
│   │   ├── services/          # business logic
│   │   ├── repositories/      # data access — tenant scoping lives here
│   │   ├── validators/        # zod request schemas
│   │   ├── utils/             # AppError, tokens, password, http envelope, asyncHandler
│   │   ├── types/             # shared TS types (AuthContext, token payloads)
│   │   ├── app.ts             # Express app assembly (no listen)
│   │   └── server.ts          # bootstrap + graceful shutdown
│   ├── tests/                 # vitest + supertest — auth, tenancy, RBAC, workflow
│   ├── .env.example           # copy to .env
│   ├── API.md                 # prose endpoint reference
│   └── src/docs/              # OpenAPI 3.1 spec (zod-derived) + Swagger UI at /api/docs
└── frontend/                  # Next.js 16 App Router app (see frontend/README.md)
    ├── app/
    │   ├── (auth)/           # login, register
    │   ├── (app)/            # authenticated shell + one folder per route
    │   └── bff/              # backend-for-frontend: auth handlers + [...path] proxy
    ├── components/           # ui/ · app/ · charts/
    └── lib/                  # api client, auth context, TanStack Query hooks
```

### Frontend request flow

```
Browser (React, access token in memory)
   │  fetch('/bff/...')  with Authorization: Bearer <accessToken>
   ▼
Next.js BFF route handlers
   │  - /bff/auth/*  → manages the httpOnly refresh cookie (em_rt)
   │  - /bff/[...path] → transparent proxy, injects the Bearer header
   ▼
Express API (/api/*)
```

The refresh token is only ever in an httpOnly cookie; the access token is only
ever in memory; a reload silently re-authenticates via `/bff/auth/refresh`.

---

## Multi-tenancy model

**Shared database, shared schema, `company_id` on every tenant-owned row.** There is no
per-tenant schema or database.

Isolation is enforced **in the repository layer**: every read and write of a
company-owned resource is scoped by `companyId`. There is deliberately no
`findById(id)` that omits the tenant — the only unscoped lookup is `userRepository.findByEmail`,
used by login *before* a tenant context exists (email is globally unique).

```ts
expenseRepository.findByIdInCompany(id, companyId)   // ✅ the only shape that exists
```

Cross-tenant access returns **404, not 403** — a user in company A can't even learn whether
a resource in company B exists. This is covered by `tests/tenancy.test.ts`.

**Optional hardening (not built for this milestone, noted in the guide):** Postgres
Row-Level Security keyed off a per-request `app.current_company_id` session variable, as a
second line of defense behind the repository scoping.

---

## Registration & onboarding

There is **no separate admin console that provisions tenants** — onboarding is entirely
self-service through `POST /api/auth/register`, which has **two mutually exclusive modes**
(the request must carry *exactly one* of `companyName` / `companyId`).

### Mode A — start a new company

```jsonc
POST /api/auth/register
{
  "name": "Alice Admin",
  "email": "alice@acme.com",
  "password": "…",              // ≥ 8 chars
  "companyName": "Acme Inc"     // ← creates the tenant
}
```

In one DB transaction a `companies` row is inserted (Postgres generates a fresh UUID) and
the registrant is created as that company's **`admin`**. Response `201` →
`{ data: { user, accessToken, refreshToken } }`.

### Mode B — join an existing company

```jsonc
POST /api/auth/register
{
  "name": "Bob Employee",
  "email": "bob@acme.com",
  "password": "…",
  "companyId": "<Acme's UUID>"  // ← joins that tenant
}
```

The user is created as an **`employee`**; an admin promotes them afterwards via
`PATCH /api/users/:id`. **The company's UUID is the join token** — the admin shares it
with new hires out of band. There is no invite/email flow (SOW §11), and no
"admin creates an employee account" endpoint — admin user-management is
*manage existing staff only*.

### Rules

- The **first user of a company is always its `admin`** — the company always has someone
  who can manage users.
- Everyone who joins via `companyId` starts as **`employee`**.
- **Email is globally unique** across the whole platform: one email = one account = one
  company. Registering an already-used email returns `409`.
- A user's `companyId` is **fixed at registration and never changes**.
  `companyService.joinNotSupported()` explicitly rejects "switch company" —
  `POST /companies` and `POST /companies/join` exist only for contract completeness and
  return `400` pointing back to `/auth/register`.
- Adding company #2, #3, … is just Mode A again with a different `companyName`; each gets
  its own UUID and its own admin, in the same shared database.

### After registration

`login` / `refresh` re-issue a JWT carrying `{ userId, companyId, role }`. The
`authenticate` middleware lifts `companyId` off the verified token into `req.auth` — the
client never passes it as a parameter — and every repository query is scoped by it from
there on (see **Multi-tenancy model** above). On the frontend, `app/(auth)/register`
drives both modes and drops the user into the company-scoped app shell.

---

## RBAC model

Three roles: `employee`, `manager`, `admin` (a native Postgres enum). The JWT access token
carries `{ userId, companyId, role }`. `authorize(...roles)` gates routes; **tenant
ownership is always checked in addition to role** — an admin of company A still cannot
touch company B.

| Feature | Employee | Manager | Admin |
|---|:--:|:--:|:--:|
| Register / create or join a company | ✅ | ✅ | ✅ |
| Create expense · view own · submit | ✅ | ✅ | ✅ |
| View **team** (whole-company) expenses | ❌ | ✅ | ✅ |
| Approve / reject expense | ❌ | ✅ | ✅ |
| Manage company users | ❌ | ❌ | ✅ |
| Analytics | ❌ | ✅ | ✅ |
| Full company access | ❌ | ❌ | ✅ |

Extra rules enforced in the service layer:
- The **first user of a new company is its admin**; users who *join* an existing company
  start as `employee` (an admin promotes them).
- A **manager cannot approve/reject their own expense** (segregation of duties). An
  **admin can** — the SOW grants admin full access.
- Only a **`pending`** expense can transition; only its **owner** can edit it, and only
  while `pending`.
- An admin **cannot self-demote** or **self-delete**, and the **last admin** cannot be
  deleted — the company must always retain someone who can manage users.
- A user who **owns expenses cannot be deleted** (FK `ON DELETE RESTRICT` — the expense
  history is preserved).

The full matrix is exercised end-to-end in `tests/rbac.test.ts`.

---

## Data model

Mirrors the Section 1 DDL of the implementation guide.

| Table | Key columns | Notes |
|---|---|---|
| `companies` | `id` (uuid) · `name` · timestamps | the tenant boundary |
| `users` | `id` · `company_id` → companies (RESTRICT) · `email` (unique) · `password_hash` · `role` (enum) · timestamps | `@@index(company_id)` |
| `expenses` | `id` · `company_id` (RESTRICT) · `user_id` (RESTRICT) · `amount` NUMERIC(12,2) `> 0` · `category` · `expense_date` · `comment` · `receipt_url` · `status` (enum, default `pending`) · timestamps | composite indexes `(company_id, …)` on `user_id`, `status`, `expense_date`, `category` |
| `refresh_tokens` | `id` · `user_id` → users (CASCADE) · `token_hash` (unique, SHA-256) · `expires_at` · `revoked_at` | rotation store; only hashes are persisted |

Design choices (from the guide): UUID PKs via `gen_random_uuid()` (no ID enumeration
across tenants); native enums for `role` / `status`; money as `NUMERIC(12,2)` never float;
`updated_at` maintained by Prisma `@updatedAt`; `RESTRICT` on financial FKs so nothing
silently wipes an audit trail; `category` kept as free-text `VARCHAR` (a `categories`
lookup table is a clean additive migration if the client later wants one).

---

## Expense workflow

```
             submit / create
   (draft) ───────────────────▶  pending
                                   │  PATCH /expenses/:id/status  (manager | admin)
                          ┌────────┴────────┐
                          ▼                 ▼
                      approved          rejected
                                            │  POST /expenses/:id/submit (owner)
                                            └────────▶ pending   (resubmit after fixing)
```

Only `pending`, `approved`, `rejected` exist (SOW §6). An expense is created directly as
`pending`. `approved` is terminal; `rejected` can be resubmitted.

---

## Getting started

### Prerequisites
- Node.js ≥ 20
- Docker + Docker Compose (for local Postgres) — or your own PostgreSQL 14+.

### 1. Start Postgres

```bash
docker compose up -d        # postgres:16 on localhost:5433, db "expense_mgmt"
```

Not using Docker? Create a database and set `DATABASE_URL` accordingly in `backend/.env`.

### 2. Backend

```bash
cd backend
cp .env.example .env
# edit .env: set JWT_ACCESS_SECRET and JWT_REFRESH_SECRET to long random strings
#   (e.g. `openssl rand -hex 48`). Defaults for DATABASE_URL match docker-compose.

npm install
npm run migrate:dev         # apply migrations (creates tables + enums)
npm run seed                # optional: demo company + users + sample expenses
npm run dev                 # http://localhost:4000  (tsx watch)
```

Health check: `curl http://localhost:4000/api/health`

### Seeded accounts (after `npm run seed`)

| Role | Email | Password |
|---|---|---|
| Admin | `admin@acme.test` | `Passw0rd!` |
| Manager | `manager@acme.test` | `Passw0rd!` |
| Employee | `employee@acme.test` | `Passw0rd!` |

### 3. Frontend

```bash
cd frontend
cp .env.example .env.local       # BACKEND_URL defaults to http://localhost:4000
npm install
npm run dev                      # http://localhost:3000
```

Open http://localhost:3000 and sign in with one of the seeded accounts above.
See [frontend/README.md](frontend/README.md) for the auth model and route map.

### 4. Run the backend tests

Tests use a **separate** database (`expense_mgmt_test`) so they can truncate freely.

```bash
cd backend
docker compose -f ../docker-compose.yml exec db createdb -U expense expense_mgmt_test
npm run test:prepare        # migrate the test DB
npm test                    # vitest — auth, multi-tenant isolation, RBAC, workflow (45 tests)
```

### 5. Production build

```bash
# backend
cd backend
npm run build               # tsc → dist/
npm run migrate             # prisma migrate deploy (no prompts)
npm start                   # node dist/server.js

# frontend
cd ../frontend
npm run build               # next build
npm start                   # next start (default port 3000)
```

---

## Environment variables

See `backend/.env.example` for the annotated list. Key ones:

| Var | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | **required**, ≥ 16 chars, distinct |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL` | token lifetimes (default `15m` / `7d`) |
| `BCRYPT_ROUNDS` | password hash cost (default `12`) |
| `CORS_ORIGIN` | comma-separated allowed origins (the frontend) |
| `UPLOAD_DIR` / `MAX_UPLOAD_BYTES` / `PUBLIC_BASE_URL` | receipt storage |

The process **exits on startup** with a readable message if required config is missing or
malformed (`src/config/env.ts`).

---

## Receipt upload

Local disk storage for this milestone. `POST /api/expenses` accepts `multipart/form-data`
with an optional `receipt` file (jpeg/png/webp/heic/pdf, ≤ 5 MB). Files are written to
`backend/uploads/` with a random name and served read-only at
`GET /uploads/<name>`; the expense's `receipt_url` is `<PUBLIC_BASE_URL>/uploads/<name>`.

Swapping to S3/GCS later is a change to `src/middleware/upload.ts` only — callers are
unaffected. This is documented here per the SOW.

---

## API reference

**Interactive (Swagger UI):** with the backend running, open
**http://localhost:4000/api/docs** — try any endpoint from the browser
(click **Authorize** and paste an access token for the protected routes). The
raw OpenAPI 3.1 document is at `/api/docs.json`. Both are served in
`development` / `test` only, never in production.

The spec is generated from the same zod schemas the routes validate with
([backend/src/docs/openapi.ts](backend/src/docs/openapi.ts)), so it can't drift
from the implementation.

**Prose reference** with request/response shapes: **[backend/API.md](backend/API.md)**.

Summary:

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/register` · `POST /auth/login` · `POST /auth/refresh` · `POST /auth/logout` · `GET /auth/me` |
| Companies | `GET /companies/me` · `PATCH /companies/me` (admin) |
| Users (admin) | `GET /users` · `GET /users/:id` · `PATCH /users/:id` · `DELETE /users/:id` |
| Expenses | `POST /expenses` · `GET /expenses` · `GET /expenses/:id` · `PATCH /expenses/:id` · `POST /expenses/:id/submit` · `PATCH /expenses/:id/status` (mgr/admin) · `DELETE /expenses/:id` |
| Analytics (mgr/admin) | `GET /analytics/dashboard` · `GET /analytics/monthly` · `GET /analytics/by-category` |

---

## Out of scope (this milestone)

Per SOW §11: advanced reporting, payroll/invoicing, email notifications, multi-step
approval chains, multiple currencies, OCR, AI categorization, subscription billing,
platform super-admin, advanced Redis infrastructure, mobile app, custom design system.
