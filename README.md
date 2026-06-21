# WashOps - Express Car Wash Operations Platform

The operational brain for express car wash businesses. Replace group texts, checklist apps, and spreadsheets with one unified platform.

## Quick Start

```bash
# Install dependencies
cd server && npm install
cd ../client && npm install

# Setup database
cd ../server
npx prisma generate
npx prisma migrate dev --name init
node prisma/seed.js

# Start the API server (port 4000)
npm run dev

# In another terminal, start the React frontend (port 3000)
cd client
npm start
```

## Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@splashexpress.com | password123 |
| Manager | manager@splashexpress.com | password123 |
| Employee | carlos@splashexpress.com | password123 |

## MVP Modules

- **Dashboard** — Live car count, alerts, team status, checklist progress
- **Shifts & Attendance** — Geofenced clock-in/out, shift templates, on-site tracking
- **Checklists** — Opening/closing/chemical/equipment templates with photo verification
- **Team Chat** — Real-time messaging + announcements
- **Team Management** — Add members, assign roles and locations
- **Settings** — Location management, geofence configuration

## Tech Stack

- **Backend:** Node.js + Express + Prisma ORM + SQLite (swap to PostgreSQL for production)
- **Frontend:** React + TailwindCSS + React Router
- **Real-time:** Socket.io
- **Auth:** JWT with role-based access (4 tiers)

## Architecture

Multi-tenant SaaS: Tenant → Locations → Users with RBAC (Super Admin, Regional Admin, Site Manager, Employee).

## Switching to PostgreSQL for Production

1. Update `server/.env`: `DATABASE_URL="postgresql://user:pass@host:5432/washops"`
2. Update `server/prisma/schema.prisma`: change `provider = "sqlite"` to `provider = "postgresql"`
3. Update the `daysOfWeek` field from String to `Int[]` and `photoUrls` from String to `String[]`
4. Run `npx prisma migrate dev`
