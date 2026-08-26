# Multi-Tenant Expense Management System

A company-scoped expense tracking and approval system: employees submit expenses with
receipts, managers approve or reject them, admins manage their company's users, and
everyone sees analytics for their own company — never anyone else's.

**Stack:** Next.js + TypeScript (frontend) · Node.js + Express + TypeScript (backend) ·
PostgreSQL · Prisma · JWT (access + refresh) · RBAC · Docker Compose for local Postgres.

> **Status:** Backend (Day 1) is complete and tested — REST API, data layer, RBAC,
> multi-tenancy, JWT auth with refresh rotation, expense workflow, receipt upload, and
> analytics endpoints. Frontend (`frontend/`) is the next milestone.

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
│   └── API.md                 # full endpoint reference
└── frontend/                  # (next milestone)
```

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

### 3. Run the tests

Tests use a **separate** database (`expense_mgmt_test`) so they can truncate freely.

```bash
cd backend
docker compose -f ../docker-compose.yml exec db createdb -U expense expense_mgmt_test
npm run test:prepare        # migrate the test DB
npm test                    # vitest — auth, multi-tenant isolation, RBAC, workflow (45 tests)
```

### 4. Production build

```bash
cd backend
npm run build               # tsc → dist/
npm run migrate             # prisma migrate deploy (no prompts)
npm start                   # node dist/server.js
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

Full endpoint documentation with request/response shapes: **[backend/API.md](backend/API.md)**.

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
