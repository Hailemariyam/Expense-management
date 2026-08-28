# Frontend — Multi-Tenant Expense Management

Next.js 16 (App Router) + TypeScript + Tailwind CSS v4. Responsive web app for
the three SOW roles: **employee**, **manager**, **admin**.

> Scope note: the design reference includes a platform-admin role and
> billing / subscriptions / audit-log / integrations screens. Those are **out of
> SOW scope** (SOW §11) and have no backend, so they are not built. Every page
> here is backed by a real endpoint on the Express API.

## Stack

| Concern | Choice |
|---|---|
| Framework | Next.js 16 App Router, React 19 |
| Styling | Tailwind CSS v4 (design tokens in `app/globals.css`) |
| Server state | TanStack Query v5 (`lib/query.ts`) |
| Forms | React Hook Form + Zod (`@hookform/resolvers`) |
| Charts | Recharts (donut / bar / area) |
| Icons | lucide-react |

## Auth model — in-memory access token + httpOnly refresh cookie

The browser never calls the Express API directly. It calls the Next.js **BFF**
(`/bff/*` route handlers), which:

- `/bff/auth/login` · `/bff/auth/register` — forward to the backend, then put the
  **refresh token in an httpOnly `em_rt` cookie** and return `{ user, accessToken }`
  in the body. The access token lives only in React memory (`lib/auth-context.tsx`).
- `/bff/auth/refresh` — reads the cookie, rotates it against the backend, returns
  a fresh access token. Called on app load (silent sign-in) and automatically by
  the API client on a `401` (one retry).
- `/bff/auth/logout` — revokes the refresh token on the backend and clears the cookie.
- `/bff/[...path]` — transparent proxy to `<BACKEND_URL>/api/*`, injecting the
  `Authorization: Bearer` header the client attaches from memory.

Net effect: no tokens in `localStorage`; the refresh token is not readable by JS;
a page reload silently re-authenticates from the cookie.

## Routes

| Path | Access | Backed by |
|---|---|---|
| `/login`, `/register` | public | `/auth/login`, `/auth/register` (create **or** join a company) |
| `/dashboard` | all | analytics endpoints (manager/admin) or own-expense aggregates (employee) |
| `/expenses`, `/expenses/new`, `/expenses/[id]` | all | `/expenses` CRUD, `/expenses/:id/submit` |
| `/team-expenses` | manager, admin | `/expenses?scope=team`, `/expenses/:id/status` |
| `/analytics` | manager, admin | `/analytics/dashboard\|monthly\|by-category` |
| `/users` | admin | `/users` CRUD |
| `/company` | admin | `/companies/me` (view + rename) |

Role gating is enforced in `app/(app)/layout.tsx` (client redirect) **and** by the
backend (the real check). The sidebar only shows links the role can use.

### Notes tied to the current backend milestone

- **Invite users:** the backend has no invite endpoint. New users self-register
  and join with the **company ID** (shown on `/company` and in the Users →
  "Invite user" dialog); they start as employees and an admin promotes them.
- **Owner names in Team Expenses:** the expense payload carries only `userId`.
  Admins resolve names via `/users`; managers (no access to that endpoint) see
  "You" for their own rows and "—" otherwise.

## Getting started

```bash
# from the repo root, make sure the backend + DB are running:
docker compose up -d
cd backend && npm run dev        # http://localhost:4000

# then the frontend:
cd ../frontend
cp .env.example .env.local       # BACKEND_URL defaults to http://localhost:4000
npm install
npm run dev                      # http://localhost:3000
```

Sign in with a seeded account (`npm run seed` in `backend/`):

| Role | Email | Password |
|---|---|---|
| Admin | `admin@acme.test` | `Passw0rd!` |
| Manager | `manager@acme.test` | `Passw0rd!` |
| Employee | `employee@acme.test` | `Passw0rd!` |

## Scripts

| Command | |
|---|---|
| `npm run dev` | dev server (Turbopack) |
| `npm run build` | production build |
| `npm run start` | serve the production build |
| `npm run lint` | ESLint (flat config, `next/core-web-vitals` + `next/typescript`) |

## Environment

| Var | Purpose |
|---|---|
| `BACKEND_URL` | Express API base URL (server-side only; the browser uses `/bff/*`) |
| `COOKIE_SECURE` | `true` marks the refresh cookie `Secure` (set in production/HTTPS) |

## Structure

```
frontend/
├── app/
│   ├── (auth)/            login, register — split brand/form layout
│   ├── (app)/             authenticated shell (sidebar + topbar), one folder per route
│   ├── bff/               BFF: auth route handlers + [...path] proxy
│   ├── layout.tsx         <Providers> (QueryClient, Toasts, Auth)
│   └── globals.css        Tailwind v4 + design tokens
├── components/
│   ├── ui/                Button, Input/Select/Textarea, Card, Badge, Modal, Toast, misc
│   ├── app/               Sidebar, Topbar, PageHeader, StatCard, ExpenseTable, ExpenseForm, …
│   └── charts/            CategoryDonut, MonthlyChart
└── lib/
    ├── api.ts             browser client → /bff, auto-refresh on 401
    ├── auth-context.tsx   session state, silent sign-in, login/register/logout
    ├── query.ts           TanStack Query hooks (one per resource/action)
    ├── bff.ts             server-side backend caller + cookie helpers
    ├── types.ts           shared API types
    └── utils.ts           money / date / initials helpers
```
