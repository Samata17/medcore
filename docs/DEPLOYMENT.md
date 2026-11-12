# Deploying MedCore HMS

This guide puts MedCore online for a **demonstration with fictional data**. MedCore is an academic project: it is **not** certified under HIPAA or any other regulation and must not store real patient information.

## What gets deployed

| Part | Recommended host | Alternative |
|---|---|---|
| Website (`apps/web`) | **Vercel** | Docker image `apps/web/Dockerfile` on any container host |
| API (`apps/api`) | **Render** (Docker web service) | Railway, Fly.io, AWS App Runner / ECS |
| PostgreSQL 16 | **Neon** or Render PostgreSQL | AWS RDS, Supabase |
| Redis 7 (optional) | **Upstash** or Render Key Value | AWS ElastiCache |

Redis is only needed when you run **more than one API instance**, so that real-time notifications reach users on every instance. With one instance, leave `REDIS_URL` empty.

## 1. Choose your setup (important for staying signed in after a reload)

After a page reload, the website restores the session with a secure refresh cookie. Safari, and Firefox in strict mode, block cookies set by a *different* site. Both setups below avoid that problem and work in every browser:

| | Setup A — free addresses (`*.vercel.app` + `*.onrender.com`) | Setup B — your own domain (`app.` + `api.` subdomains) |
|---|---|---|
| Website `NEXT_PUBLIC_AUTH_PROXY` | `true` | `false` (or `true`, both work) |
| API `COOKIE_SAMESITE` | `lax` | `lax` |
| API `TRUST_PROXY` | `2` | `1` |
| How it works | Sign-in requests go to the **website's own address** (`/api/v1/auth/*`) and Vercel forwards them to the API, so the cookie belongs to the website. All other requests and live notifications go straight to the API using the access token. | Website and API are the same site, so the cookie is accepted directly. |

`TRUST_PROXY=2` tells the API there are two forwarding hops in front of it (Vercel, then Render's load balancer), so it still sees each visitor's real IP address for rate limits and the audit log.

> Avoid `COOKIE_SAMESITE=none` without the proxy: Chrome and Edge accept it, but Safari users are signed out on every reload.

## 2. Pre-launch security checklist

The API **refuses to start** in production if the first five items are wrong:

- [ ] `JWT_ACCESS_SECRET` and `OTP_SECRET` are two **different** random values, 48+ bytes each (`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`). Never reuse the development values.
- [ ] `COOKIE_SECURE=true` (HTTPS only).
- [ ] SMTP is configured, so verification and reset codes are emailed. In production the API never prints codes to the log.
- [ ] `WEB_ORIGIN` lists the exact website address(es), for example `https://app.medcore-demo.in`. No `*`.
- [ ] Razorpay, if used, has **test-mode** keys only (`rzp_test_…`).
- [ ] The database password is strong and unique, and the connection uses SSL (`?sslmode=require` for Neon/RDS).
- [ ] Secrets are stored only in the hosting platform's environment settings, never in Git. `.env` files are already git-ignored.
- [ ] The CI workflow is green: tests, dependency audit and Docker builds.
- [ ] Only fictional demo data is loaded.

## 3. Database (Neon example)

1. Create a free project at <https://neon.tech> → copy the **connection string**. It looks like `postgresql://user:pass@ep-xxx.aws.neon.tech/neondb?sslmode=require`.
2. Nothing else is needed: the API container applies migrations itself when it starts.

## 4. API on Render

1. Push the repository to GitHub.
2. Render → **New → Web Service** → connect the repo.
3. Settings:
   - **Language/Runtime:** Docker
   - **Dockerfile path:** `apps/api/Dockerfile`
   - **Docker build context:** `.` (repository root)
   - **Health check path:** `/api/v1/health`
4. Environment variables:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | the Neon connection string |
| `JWT_ACCESS_SECRET` | random value #1 |
| `OTP_SECRET` | random value #2 |
| `WEB_ORIGIN` | `https://app.medcore-demo.in` (your website) |
| `COOKIE_SECURE` | `true` |
| `COOKIE_SAMESITE` | `lax` |
| `TRUST_PROXY` | `2` for Setup A, `1` for Setup B (see step 1) |
| `APP_TIMEZONE` | `Asia/Kolkata` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | from your email provider (Brevo, Mailgun, SES…) |
| `REDIS_URL` | optional, e.g. Upstash `rediss://…` |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | optional, test mode |

Render sets `PORT` itself and the API listens on it automatically.

5. **Uploaded lab reports** are saved on the container's disk (`/app/apps/api/uploads`). Add a Render **persistent disk** mounted at that path, or reports disappear on every deploy. Free instances can't have disks, so uploads there are temporary. The API never claims otherwise: a missing file returns 404.
6. Deploy. Open `https://api.medcore-demo.in/api/v1/health` → `{"success":true,"data":{"status":"ok","database":"up",…}}`.
7. Optional custom domain: Render → Settings → Custom Domains → `api.medcore-demo.in`.

### Load the fictional demo data (once)

From your own computer, point the seed at the cloud database. The seed only adds fictional records; it never deletes anything.

```powershell
cd apps\api
$env:DATABASE_URL="postgresql://…neon connection string…"
$env:SEED_PASSWORD="choose-a-demo-password"
npx prisma db seed
Remove-Item Env:DATABASE_URL, Env:SEED_PASSWORD
```

Use a **different** `SEED_PASSWORD` from the development one, because the seeded accounts are publicly listed in the README.

## 5. Website on Vercel

1. Vercel → **Add New → Project** → import the GitHub repo.
2. **Root Directory:** `apps/web`. Vercel detects Next.js and the npm workspace automatically.
3. Environment variables (built into the website, so **redeploy after changing them**):
   - `NEXT_PUBLIC_API_URL` = the API address, e.g. `https://medcore-api.onrender.com/api/v1`
   - `NEXT_PUBLIC_AUTH_PROXY` = `true` for Setup A (free addresses), `false` for Setup B
4. Optional: `CONTACT_WEBHOOK_URL` for contact-form messages.
5. Deploy, then add your domain (`app.medcore-demo.in`) under Settings → Domains.
6. Make sure the API's `WEB_ORIGIN` matches the final website address exactly (scheme + host, no trailing slash).

## 6. After deploying: smoke test

1. `https://<api>/api/v1/health` shows `database: up`.
2. Open the website → **Sign in** with a seeded account → the dashboard loads.
3. Reload the page and confirm you're still signed in. This proves the refresh cookie works. Try it in **Safari** too (or Firefox with strict tracking protection). With Setup A, browser dev tools → Network should show `…vercel.app/api/v1/auth/refresh` returning 200.
4. As a receptionist, confirm an appointment. Signed in as that patient in another browser, the notification appears instantly. This proves WebSockets work.
5. `https://<api>/api/docs` shows the API documentation.

## Alternative: AWS

- **API:** push `apps/api/Dockerfile` to ECR → run it on **App Runner** (simplest) or **ECS Fargate** behind an Application Load Balancer. The health check is `/api/v1/health`. Put secrets in **Secrets Manager**. ALBs support WebSockets; enable sticky sessions or set `REDIS_URL` when running more than one task.
- **Database:** **RDS for PostgreSQL 16**, private subnet, encryption at rest on, automated backups on.
- **Redis:** **ElastiCache** (only for multiple API tasks).
- **Uploads:** mount **EFS** at `/app/apps/api/uploads`. S3 storage is not implemented yet.
- **Website:** Vercel, or the `apps/web/Dockerfile` image on App Runner. Pass `--build-arg NEXT_PUBLIC_API_URL=…` when building.

## Run the production images locally

```powershell
docker compose --profile full up -d --build   # postgres, redis, api (port 4100), web (port 3000)
docker compose --profile full down
```

This uses your `apps/api/.env` for secrets and runs in development mode over plain HTTP, so it's a preview of the containers, not a production setup.

## Updates and rollback

- Every push to `main` runs CI. Vercel and Render redeploy automatically when connected to the repo. Turn on "wait for CI" (Render: *Auto-Deploy → After CI checks pass*) so a failing build never ships.
- Database migrations are applied on API start. They only add things; write new migrations rather than editing old ones.
- Rollback: Render → *Deploys* → **Rollback** to the previous image; Vercel → *Deployments* → **Promote** a previous one. Migrations aren't rolled back automatically, so keep them backwards-compatible.
