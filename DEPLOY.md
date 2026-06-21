# Deploying ARSHI (pilot)

ARSHI builds into **one deployable service**: the Express server serves the API,
the websocket, and the built React app from a single port. Pair it with managed
Postgres (Neon) and object storage (Cloudflare R2).

## What you need
- The Neon Postgres connection string (already in your local `server/.env`).
- The 5 Cloudflare R2 values (already in your local `server/.env`).
- A host that can run a Docker container (Railway, Render, Fly.io, or a VPS).

## Environment variables to set on the host
| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Neon connection string (`...?sslmode=require`) |
| `JWT_SECRET` | long random string, ≥ 32 chars |
| `JWT_REFRESH_SECRET` | another long random string |
| `NODE_ENV` | `production` |
| `PORT` | provided by host, or `4000` |
| `ALLOWED_ORIGINS` | your app's public URL, e.g. `https://arshi.yourdomain.com` |
| `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET` / `R2_PUBLIC_URL` | from Cloudflare R2 |

Because it's a single service, the client talks to the API on the same origin —
no separate frontend URL to configure.

## Deploy steps
1. Push this repo to GitHub.
2. On your host, create a new service from the repo. It will detect the `Dockerfile`.
3. Add the environment variables above.
4. Deploy. The build compiles the client and starts the server.

## One-time database setup (first deploy)
Run against the Neon database (from the host shell, or locally with the prod `DATABASE_URL`):
```
cd server
npx prisma db push        # create the schema on Neon
node prisma/seed.js       # optional: seed demo data — SKIP for a real launch
```

## Verify
- `GET https://<your-url>/api/v1/health` → `{ "status": "ok", "db": true, "storage": "remote" }`
  (`storage: "remote"` confirms R2 is reachable from the host.)
- Open the URL, log in, upload a photo, and check it appears in your R2 bucket.

## Before a real (non-pilot) launch
- Remove demo accounts / change all `password123` seed passwords (or skip seeding).
- Set strong, unique `JWT_SECRET` / `JWT_REFRESH_SECRET`.
- Add a password-reset flow and error monitoring (e.g. Sentry).
