# Untis Pro

Monorepo with a TypeScript Express backend (Prisma + Postgres) and React + Tailwind frontend.

## Quick start

Prereqs: Node 18+, npm, Docker Desktop (for Postgres). If you don't have Docker, install Postgres locally and set `DATABASE_URL` in `untis-pro-backend/.env`.

1. Start Postgres

    - Using Docker: from the repo root run: `docker compose up -d db`
    - Or set your own DB and update `DATABASE_URL` in `untis-pro-backend/.env`

2. Backend

    - Copy env: `copy untis-pro-backend\.env.example untis-pro-backend\.env`
    - Install deps: `cd untis-pro-backend && npm i`
    - Generate client and migrate: `npx prisma generate && npx prisma migrate dev --name init`
    - Run dev: `npm run dev`

3. Frontend
    - Install deps: `cd untis-pro-frontend && npm i`
    - Create `.env` from example if needed
    - Run dev: `npm run dev`

Open http://localhost:5173.

## Run the whole stack with Docker

This repo includes Dockerfiles and a compose file to run Postgres, the backend (Express + Prisma), and the frontend (Nginx serving the built app and proxying /api).

Ports:

-   Frontend: http://localhost:8080
-   Backend API: http://localhost:3001
-   Postgres: localhost:5432

Start everything:

```cmd
docker compose up -d --build
```

Environment variables (override as needed in compose):

-   JWT_SECRET: default "change-me-please"
-   CORS_ORIGIN: default http://localhost:8080
-   DATABASE_URL: auto-wired to the Postgres service
-   UNTIS_DEFAULT_SCHOOL, UNTIS_HOST
-   Optional admin: UNTIS_ADMIN_USERNAME, UNTIS_ADMIN_PASSWORD

Check health:

-   API: http://localhost:3001/health
-   Web: http://localhost:8080/health

## API

-   POST /api/auth/register { username, password, displayName? }
-   POST /api/auth/login { username, password }
-   GET /api/timetable/me?start=YYYY-MM-DD&end=YYYY-MM-DD
-   GET /api/timetable/user/:userId?start=YYYY-MM-DD&end=YYYY-MM-DD
-   Admin (requires admin JWT):
    -   GET /api/admin/users
    -   DELETE /api/admin/users/:id

Auth with `Authorization: Bearer <token>` header.

## Notes

-   Credentials are stored as provided for demo. Replace with secure storage or encryption.
-   Prisma schema auto-migrate in dev via `migrate dev`. Use `migrate deploy` in prod.

# untis-pro
