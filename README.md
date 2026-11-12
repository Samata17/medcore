# MedCore HMS

A multi-hospital management platform built as an MCA full-stack project: patient registration, appointments, electronic medical records, prescriptions, laboratory, pharmacy, billing, payments, notifications and analytics.

> Academic project. Not certified under HIPAA or any other regulation. Use **fictional data only**.

## Project status

| Stage | Scope | Status |
|---|---|---|
| 1 | Monorepo, design system, public website, auth screens | ✅ Done |
| 2 | Dashboard layout, sidebar, top bar, role-based navigation, reusable components | ✅ Done |
| 3 | Dashboards for all 9 roles (labeled sample data) | ✅ Done |
| 4 | PostgreSQL schema, migrations, seed, NestJS API, JWT auth, RBAC, tenant isolation | ✅ Done |
| 5 | Appointments, records, prescriptions, lab (with uploads), pharmacy, billing & payments, notifications (real-time), analytics — all dashboards live | ✅ Done |
| 6 | Automated tests (unit + end-to-end), Dockerfiles, GitHub Actions CI, dependency audit, deployment guide | ✅ Done |

## Folder structure

```
MedCore HMS/
├─ apps/
│  ├─ web/                 Next.js 15 frontend (App Router)
│  │  └─ src/
│  │     ├─ app/           (marketing) · (auth) · dashboard/<role> · api/contact
│  │     ├─ components/    ui/ · dashboard/ · modules/ · marketing/ · auth/
│  │     ├─ lib/           API client, data hooks (hms.ts), validators, demo dataset
│  │     └─ stores/        Zustand stores (auth session, UI prefs)
│  └─ api/                 NestJS backend
│     ├─ prisma/           schema.prisma · migrations/ · seed.ts
│     └─ src/
│        ├─ common/        guards (auth, permissions, CSRF, rate limit), response format, tenant helpers
│        ├─ config/        validated environment variables
│        └─ modules/       auth · users · hospitals · directory · patients · staff · appointments · records
│                          pharmacy · lab · billing · wards · notifications · analytics · audit · mail · health
│     └─ test/             unit/ (no database) · e2e/ (real API + test database)
├─ packages/types/         Shared types + business rules (slot conflicts, FIFO, lab flags, invoice totals) + tests
├─ docs/                   DATABASE.md (schema) · DEPLOYMENT.md (going online)
├─ .github/                CI workflow + Dependabot
├─ docker-compose.yml      PostgreSQL 16 + Redis 7 for development (+ optional full stack)
└─ package.json            npm workspaces root
```

## Running the project (beginner guide)

You need **Node.js 20.12+** (`node -v`) and **Docker Desktop** (running — you'll see the whale icon in the taskbar).

Open the `MedCore HMS` folder in VS Code and open a terminal (**View → Terminal** or <kbd>Ctrl</kbd> + <kbd>`</kbd>).

### First-time setup

```bash
# 1. Install all packages (also builds the shared types package)
npm install

# 2. Create the env files from the examples
copy apps\web\.env.example apps\web\.env.local
copy apps\api\.env.example apps\api\.env
```

Open `apps\api\.env` and replace the two `CHANGE_ME…` values with random strings. Generate each one with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

```bash
# 3. Start PostgreSQL and Redis in Docker
npm run db:up

# 4. Create the database tables
npm run db:migrate

# 5. Load the fictional demo data
npm run db:seed
```

### Every day

Use two terminals (click **+** in the terminal panel for a second one):

```bash
npm run dev:api     # terminal 1 → API on http://localhost:4100  (docs: http://localhost:4100/api/docs)
npm run dev:web     # terminal 2 → website on http://localhost:3000
```

If Docker was restarted, run `npm run db:up` first. Stop everything with <kbd>Ctrl</kbd> + <kbd>C</kbd> and `npm run db:down`.

> **Ports:** MedCore uses 5433 (PostgreSQL), 6380 (Redis), 4100 (API) and 3000 (web), so it can run next to other projects that use the default 5432/6379/4000.

### Sign in with the seeded accounts

All passwords are **`Demo@12345`** (set by `SEED_PASSWORD` in `apps/api/.env`). These are fictional accounts on reserved `.test` email domains.

| Role | Email |
|---|---|
| Super Admin | `superadmin@medcore.test` |
| Hospital Admin | `rahul.mehta@sunrise.test` |
| Doctor | `kavita.sharma@sunrise.test` |
| Nurse | `meera.pillai@sunrise.test` |
| Receptionist | `arjun.nair@sunrise.test` |
| Lab Technician | `sneha.joshi@sunrise.test` |
| Pharmacist | `vikram.desai@sunrise.test` |
| Accountant | `pooja.iyer@sunrise.test` |
| Patient | `rohan.kulkarni@patient.test` |
| Admin of a second hospital | `ravi.menon@metroheart.test` |

**Email codes in development:** without SMTP settings, the API prints verification and password-reset codes in the API terminal (look for `[DEV EMAIL — not sent…]`). Production refuses to start without SMTP.

### Useful commands

| Command | What it does |
|---|---|
| `npm run typecheck` | Checks every package (and the tests) for TypeScript errors |
| `npm test` | Unit tests — business rules, upload checks, payment signatures, config safety (seconds, no database) |
| `npm run test:e2e` | End-to-end tests against the real API (needs `npm run db:up`; ~2 minutes) |
| `npm run build:web` / `npm run build:api` | Production builds |
| `npm run db:studio` | Opens Prisma Studio to browse the database in your browser |
| `npm run db:reset` | **Deletes all data**, re-runs migrations and the seed |

## Tests

```bash
npm test            # 27 unit tests
npm run test:e2e    # 57 end-to-end tests (Docker must be running: npm run db:up)
```

**Your data is safe while testing.** The end-to-end tests use a separate database called `medcore_test` (created automatically next to your dev database). Before each test file they wipe it and reload the fictional seed, so results are repeatable. The harness refuses to run against any database whose name doesn't end in `_test`. Uploaded test files go to a temporary folder that is deleted afterwards.

What the end-to-end tests cover:
- **Security:** wrong passwords, lockout, rate limits, token forgery (edited payload, `alg: none`), refresh-token rotation and theft detection, CSRF header, CORS, security headers, oversized and malformed requests, role permissions, cross-hospital 404s, injected fields, and audit logging. They also try to `UPDATE`, `DELETE` and `TRUNCATE` clinical records directly in the database and expect all three to be blocked.
- **Clinical workflow:** booking races, slot rules, real-time notifications, check-in → consultation → vitals/diagnosis/notes, prescriptions with FIFO dispensing and expired stock, lab results with server-side ranges, file upload checks, approval-gated reports, GST, partial and simultaneous payments, refusal of fake online payments, analytics, nursing and beds.

## Continuous integration

[.github/workflows/ci.yml](.github/workflows/ci.yml) runs on every push and pull request:

1. Typecheck, unit tests, and API + website builds.
2. End-to-end tests against PostgreSQL 16 in a GitHub-hosted container, with throwaway secrets generated for each run.
3. `npm audit` of production dependencies (fails on high/critical issues).
4. Both Docker images build.

[Dependabot](.github/dependabot.yml) opens weekly update pull requests for npm packages, GitHub Actions and Docker base images.

## Deployment

See **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**: Vercel for the website, Render (Docker) for the API, and Neon for PostgreSQL, plus an AWS alternative and a pre-launch security checklist. Both apps have production Dockerfiles. They run as a non-root user, include health checks, and the API applies database migrations on start:

```bash
docker compose --profile full up -d --build   # whole stack in containers
```

## What's connected to the real backend

**Everything.** When you sign in with a real account, every dashboard reads and writes PostgreSQL through the API. Demo mode (<http://localhost:3000/demo>) still works offline and is always labeled as sample data.

Try the full patient journey with the seeded accounts:

1. **Receptionist** → Patients → *Register patient* → *Book* (taken and past slots are disabled).
2. **Receptionist** → Today's desk → *Confirm* → *Check in*. The patient gets a live notification.
3. **Doctor** → My day → *Start* → *Open record* → vitals (BMI is calculated by the server), diagnosis, note (corrections keep the original), prescription, lab order.
4. **Lab Technician** → Test orders → collect → process → *Enter results* (optionally attach a PDF) → *Approve*. Only now can the patient see the report.
5. **Pharmacist** → Prescriptions → *Dispense* — stock is taken from the earliest-expiring valid batch; expired stock is never used.
6. **Accountant / Receptionist** → Billing → *New invoice* (GST applied by the server) → *Record payment* → print the receipt.
7. **Patient** → see the confirmed appointment, approved lab report (with download), prescription and invoice; notifications arrive in real time.

### Online payments (optional, test mode)

Patients can pay invoices online through **Razorpay test mode**. Without keys, the page clearly says to pay at the counter.

1. Create a free Razorpay account → switch to **Test mode** → *Settings → API Keys* → generate a key.
2. Put the values in `apps/api/.env`: `RAZORPAY_KEY_ID=rzp_test_…` and `RAZORPAY_KEY_SECRET=…`, then restart the API.
3. Use Razorpay's test cards/UPI IDs from their docs. The server verifies Razorpay's signature before marking an invoice paid — a "success" message from the browser alone changes nothing.
4. Optional: add a webhook in the Razorpay dashboard pointing to `/api/v1/billing/webhooks/razorpay` and set `RAZORPAY_WEBHOOK_SECRET`.

### Real-time notifications

The browser connects to `ws://localhost:4100/notifications` (Socket.IO) with its access token. Appointment confirmations, reminders (sent ~24 h before), emergency bookings, approved lab reports, new prescriptions, ready medicines, invoices, payments and low-stock alerts appear instantly with a toast. With Redis running, notifications also work across several API instances. Email/SMS delivery can be added later in `NotificationsService.deliver()`.
## API

- Base URL `http://localhost:4100/api/v1`, interactive docs at **<http://localhost:4100/api/docs>** (sign in with `POST /auth/login`, click **Authorize**, paste the `accessToken`).
- Every response: `{ "success": true, "data": …, "meta"?: { page, pageSize, total, totalPages } }`.
- Every error: `{ "success": false, "error": { "statusCode", "message", "details"? } }` — validation errors are `422` with per-field `details`.

## Security (implemented)

- **Passwords**: bcrypt cost 12; same error for wrong email and wrong password; account locks for 15 minutes after 5 failed attempts.
- **Tokens**: 15-minute access JWT kept in browser memory only; refresh token in an `HttpOnly`, path-scoped cookie, stored as a SHA-256 hash, **rotated on every use**; reuse of an old token revokes the whole session.
- **CSRF**: cookie routes require a custom header that cross-site pages can't send.
- **Works in every browser after a reload**: when the website and API are on different domains, `NEXT_PUBLIC_AUTH_PROXY=true` sends only sign-in requests through the website's own address, so the refresh cookie is first-party and not blocked by Safari/Firefox (see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)).
- **RBAC on the server**: every endpoint declares a permission; roles map to permissions in the `RolePermission` table.
- **Tenant isolation**: hospital comes from the signed-in user, never from the request; other hospitals' records return 404. Suspending a hospital signs its users out immediately.
- **Validation**: DTO whitelisting rejects unknown fields (e.g. an injected `hospitalId`).
- **Rate limiting**: credential/OTP routes 5/min per IP + email; general 600/min per IP.
- **Headers & CORS**: Helmet security headers; CORS allows only `WEB_ORIGIN` with credentials.
- **Audit log**: logins, failed logins, record views, every clinical/billing/pharmacy action, file downloads, staff and hospital changes. Append-only at the database level.
- **Concurrency**: bookings take a per-doctor database lock (no double-booking even with simultaneous clicks); dispensing and payments lock their rows (no overselling stock or double-counting payments).
- **Server-side business rules**: GST rates, lab reference ranges, BMI and invoice totals are always computed by the server; values sent by the browser are ignored.
- **File uploads**: PDF/PNG/JPEG only, verified by file content (not name), 5 MB limit, stored under random names; downloads are permission-checked and patients only get approved reports.
- **Append-only clinical records**: database triggers block `UPDATE`/`DELETE`/`TRUNCATE` on vitals, diagnoses, clinical notes and audit logs.
- **Safe configuration**: in production the API refuses to start with placeholder or reused secrets, without SMTP, without Secure cookies, with a wildcard CORS origin, or with live Razorpay keys.
- **Errors never leak internals**: unexpected errors return a generic message; oversized bodies return 413 and malformed JSON returns 400.
- **Dependencies**: `npm audit` is clean for production packages (patched versions are pinned with `overrides` in the root `package.json`) and is checked in CI.
- **Containers**: run as an unprivileged user; no secrets are baked into images (see `.dockerignore`).

See [docs/DATABASE.md](docs/DATABASE.md) for the schema and how the tables relate.

## Design system

Defined as CSS variables in [apps/web/src/app/globals.css](apps/web/src/app/globals.css): primary deep medical blue `#0B4F9C`, secondary teal `#0D9488`, green/amber/red for status, Plus Jakarta Sans + Inter, and a validated colorblind-safe chart palette. Every color has a dark-mode value.
