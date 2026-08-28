# API Reference — Multi-Tenant Expense Management

> **Interactive docs:** run the backend and open **http://localhost:4000/api/docs**
> (Swagger UI) or fetch **`/api/docs.json`** (OpenAPI 3.1). That spec is generated
> from the zod validators in `src/docs/openapi.ts` and is the source of truth for
> request/response schemas; this file is the readable companion.

Base URL: `http://localhost:4000/api`

All responses use a consistent envelope:

```jsonc
// success
{ "data": <payload>, "meta"?: { "page": 1, "pageSize": 20, "total": 42 } }

// error
{ "error": { "code": "FORBIDDEN", "message": "…", "details"?: { … } } }
```

Error codes: `VALIDATION_ERROR` (400), `UNAUTHENTICATED` / `INVALID_CREDENTIALS` / `TOKEN_EXPIRED` (401),
`FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409), `UNPROCESSABLE` (422), `INTERNAL` (500).

Authentication: send the access token as `Authorization: Bearer <accessToken>` on every protected route.
Access tokens are short-lived (`JWT_ACCESS_TTL`, default 15m); use `POST /auth/refresh` to rotate.

Money is always a **string** (`"42.50"`) end-to-end — never a float — to avoid rounding drift.
Dates are `YYYY-MM-DD` strings.

---

## Auth

### `POST /auth/register`
Create an account. Provide **exactly one** of `companyName` (create a new company — you become its **admin**)
or `companyId` (join an existing company as an **employee**).

```jsonc
// body
{ "name": "Ada Lovelace", "email": "ada@acme.test", "password": "Passw0rd!", "companyName": "Acme Inc" }
// or
{ "name": "Joe", "email": "joe@acme.test", "password": "Passw0rd!", "companyId": "<uuid>" }
```
`201` →
```jsonc
{ "data": {
  "user": { "id", "companyId", "name", "email", "role", "createdAt" },
  "accessToken": "<jwt>",
  "refreshToken": "<jwt>"
}}
```
Errors: `409` email already registered · `400` not exactly one of companyName/companyId · `404` companyId not found.

### `POST /auth/login`
```jsonc
{ "email": "ada@acme.test", "password": "Passw0rd!" }
```
`200` → same shape as register. `401 INVALID_CREDENTIALS` on any mismatch (email existence is not disclosed).

### `POST /auth/refresh`
```jsonc
{ "refreshToken": "<jwt>" }
```
`200` → new `{ user, accessToken, refreshToken }`. The presented refresh token is **revoked** (rotation);
reusing it returns `401`.

### `POST /auth/logout`  — _auth required_
```jsonc
{ "refreshToken": "<jwt>" }   // optional; if omitted, revokes ALL sessions for the user
```
`200 { "data": { "success": true } }`

### `GET /auth/me`  — _auth required_
`200 { "data": { "id", "companyId", "name", "email", "role", "createdAt" } }`

---

## Companies

### `GET /companies/me`  — _auth required_
`200 { "data": { "id", "name", "createdAt", "updatedAt", "userCount" } }` — always the caller's own company.

### `PATCH /companies/me`  — _admin only_
```jsonc
{ "name": "New Co Name" }
```

### `POST /companies` · `POST /companies/join`
Present for contract completeness. Both return `400` with a message directing you to `POST /auth/register`
(company creation/joining happens at sign-up; a user belongs to exactly one company).

---

## Users  — _admin only_ (entire resource)

Company-scoped: an admin only ever sees/affects their own company's users.

### `GET /users?page=1&pageSize=20`
`200` → `{ "data": [ <publicUser>… ], "meta": { "page", "pageSize", "total" } }`

### `GET /users/:id`
`200 { "data": <publicUser> }` · `404` if not in your company.

### `PATCH /users/:id`
```jsonc
{ "name"?: "…", "role"?: "employee|manager|admin", "password"?: "min 8 chars" }
```
Guardrails: an admin **cannot** change their own role away from `admin` (`400`) — promote someone else first.

### `DELETE /users/:id`
`204` on success.
Guardrails: cannot delete yourself (`400`); cannot delete the last remaining admin (`400`);
a user who owns expenses cannot be deleted (`409`, FK `RESTRICT` — the audit trail is preserved).

---

## Expenses  — _auth required_

Visibility: **employee** → own expenses only. **manager / admin** → the whole company.

### `POST /expenses`  — `multipart/form-data`
| field | type | notes |
|---|---|---|
| `amount` | string | `> 0`, up to 2 decimals |
| `category` | string | 1–100 chars |
| `expenseDate` | string | `YYYY-MM-DD` |
| `comment` | string | optional, ≤ 2000 chars |
| `receipt` | file | optional; jpeg/png/webp/heic/pdf, ≤ `MAX_UPLOAD_BYTES` (5 MB default) |

`201 { "data": <expense> }` — created with `status: "pending"`.
The stored file is served at `receiptUrl` (`<PUBLIC_BASE_URL>/uploads/<name>`).

### `GET /expenses`
Query params (all optional): `scope=me|team`, `status=pending|approved|rejected`, `category`,
`dateFrom`, `dateTo` (`YYYY-MM-DD`), `page`, `pageSize` (≤ 100).
- `scope=me` narrows to your own rows (managers/admins).
- `scope=team` is `403` for employees.

`200` → `{ "data": [ <expense>… ], "meta": { "page", "pageSize", "total" } }`, newest `expenseDate` first.

### `GET /expenses/:id`
`200 { "data": <expense> }`. `404` if it's in another company, or you're an employee and it isn't yours
(same 404 — existence is not disclosed).

### `PATCH /expenses/:id`
Owner-only, and only while `status === "pending"` (`422` otherwise).
```jsonc
{ "amount"?, "category"?, "expenseDate"?, "comment"? }
```

### `POST /expenses/:id/submit`
Owner-only. Moves `rejected → pending` (resubmit after fixing). No-op if already `pending`.
`422` if `approved`.

### `PATCH /expenses/:id/status`  — _manager / admin only_
```jsonc
{ "status": "approved" }   // or "rejected"
```
Rules (SOW §6 order): authenticated → same company → manager/admin → valid target status → update.
Only a `pending` expense can transition (`422` otherwise). A **manager cannot** approve/reject their
**own** expense (`403`, segregation of duties); an **admin can** (full company access per SOW).

### `DELETE /expenses/:id`
Owner or admin. An `approved` expense can only be deleted by an admin (`422` for the owner).
Deletes the local receipt file best-effort. `204` on success.

`<expense>` shape:
```jsonc
{ "id", "companyId", "userId", "amount": "42.50", "category": "Meals",
  "expenseDate": "2026-08-20", "comment": null, "receiptUrl": null,
  "status": "pending", "createdAt", "updatedAt" }
```

---

## Analytics  — _manager / admin only_

All figures are company-scoped.

### `GET /analytics/dashboard`
Headline numbers for the dashboard page:
```jsonc
{ "data": {
  "monthTotal": "357.26", "monthCount": 6,
  "pending":  { "count": 3, "total": "143.50" },
  "approved": { "count": 5, "total": "479.51" },
  "rejected": { "count": 1, "total": "300.00" }
}}
```

### `GET /analytics/monthly?months=6`  (`months`: 1–24, default 6)
```jsonc
{ "data": [ { "month": "2026-07", "total": "565.75", "count": 3 },
            { "month": "2026-08", "total": "357.26", "count": 6 } ] }
```

### `GET /analytics/by-category?dateFrom=&dateTo=`
```jsonc
{ "data": [ { "category": "Travel", "total": "420.00", "count": 2 },
            { "category": "Meals",  "total": "109.50", "count": 3 } ] }
```

---

## Health

### `GET /health` — no auth
`200 { "data": { "status": "ok", "ts": "<iso>" } }`
