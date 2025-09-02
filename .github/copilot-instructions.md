# Periodix

Periodix is a TypeScript monorepo with an Express.js backend (Prisma + PostgreSQL) and React frontend (Vite + TailwindCSS). It provides timetable management with WebUntis integration, user authentication, and lesson color customization.

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## Working Effectively

### Prerequisites and Environment Setup

-   Node.js 18+ and npm are required (Node.js 20+ recommended)
-   Docker Desktop for PostgreSQL database
-   **NETWORK LIMITATIONS**: Some environments may have certificate or network restrictions that prevent Prisma binary downloads and Docker builds. This is documented throughout these instructions.

### Bootstrap and Build (Local Development)

1. **Start PostgreSQL database**:

    ```bash
    docker compose up -d db
    ```

    - Takes ~7 seconds including image pull
    - Database runs on localhost:5432
    - Uses postgres/postgres credentials with untis_pro database

2. **Backend setup**:

    ```bash
    cp .env.example untis-pro-backend/.env
    cd untis-pro-backend
    npm install  # Takes ~21 seconds
    ```

    **CRITICAL NETWORK LIMITATION**: Prisma client generation may fail in some environments:

    ```bash
    npx prisma generate  # FAILS: network restrictions on binaries.prisma.sh
    npx prisma migrate dev --name init  # FAILS: same network issue
    ```

    **TypeScript compilation works fine**:

    ```bash
    npm run build  # Takes ~2 seconds, succeeds
    ```

3. **Frontend setup**:
    ```bash
    cd untis-pro-frontend
    npm install  # Takes ~24 seconds
    npm run build  # Takes ~4 seconds. NEVER CANCEL. Set timeout to 30+ seconds.
    npm run lint  # Takes ~2 seconds
    ```

### Development Servers

-   **Frontend**: `npm run dev` in untis-pro-frontend/ - Runs on http://localhost:5173
-   **Backend**: `npm run dev` in untis-pro-backend/ - Runs on http://localhost:3001 (requires functional Prisma setup)

### Docker Compose (Alternative Deployment)

**NETWORK LIMITATION**: Docker builds may fail due to certificate issues with npm registry in restricted environments:

```bash
docker compose up -d --build  # FAILS: certificate chain issues with npm
```

When working, the full stack runs on:

-   Frontend: http://localhost:8080
-   Backend API: http://localhost:3001
-   PostgreSQL: localhost:5432

## Validation

### Manual Testing Requirements

**ALWAYS** test the frontend after making changes:

1. Start the development server: `cd untis-pro-frontend && npm run dev`
2. Navigate to http://localhost:5173
3. **Key scenarios to test**:
    - Login/registration form displays correctly
    - UI responds to user input
    - Build process completes successfully
    - Linting passes without errors

### Pre-commit Validation

Always run these commands before committing:

```bash
# Frontend
cd untis-pro-frontend
npm run lint      # Takes ~2 seconds
npm run build     # Takes ~4 seconds

# Backend (when Prisma is working)
cd untis-pro-backend
npm run build     # Takes ~2 seconds
```

## Known Issues and Workarounds

### Prisma/Database Issues

-   **Prisma binary downloads fail** in restricted network environments
-   **Workaround**: Use Docker compose for full stack deployment when network allows
-   **Alternative**: Focus on frontend development and TypeScript compilation validation

### Environment Configuration

-   Root `.env` file is required for Docker compose
-   Backend `.env` file must be copied from root `.env.example`
-   Frontend has optional `.env` support via `.env.example`

## Common Tasks

### Build Times and Timeouts

All measurements include 50% safety buffer:

-   Frontend npm install: ~24 seconds → **Use 60-second timeout**
-   Frontend build: ~4 seconds → **Use 30-second timeout**
-   Frontend lint: ~2 seconds → **Use 30-second timeout**
-   Backend npm install: ~21 seconds → **Use 60-second timeout**
-   Backend TypeScript build: ~2 seconds → **Use 30-second timeout**
-   Database startup: ~7 seconds → **Use 30-second timeout**

**NEVER CANCEL these operations**. Builds may appear to hang but will complete within the specified timeouts.

### Repository Structure

```
/
├── .env.example                 # Environment template
├── docker-compose.yml          # Full stack deployment
├── untis-pro-backend/          # Express.js + Prisma backend
│   ├── src/                    # TypeScript source
│   ├── prisma/schema.prisma    # Database schema
│   ├── package.json            # Backend dependencies
│   └── tsconfig.json          # TypeScript config
└── untis-pro-frontend/         # React + Vite frontend
    ├── src/                    # React components
    ├── package.json            # Frontend dependencies
    ├── vite.config.ts          # Vite configuration
    ├── tailwind.config.ts      # TailwindCSS config
    └── eslint.config.js        # ESLint configuration
```

### Key Files to Monitor

-   **Backend API routes**: `untis-pro-backend/src/routes/`
-   **Frontend components**: `untis-pro-frontend/src/components/`
-   **Database schema**: `untis-pro-backend/prisma/schema.prisma`
-   **Rate limiting**: `untis-pro-backend/src/server/untisRateLimiter.ts`
-   **Authentication**: `untis-pro-backend/src/routes/auth.js`

### API Endpoints

-   POST /api/auth/register - User registration
-   POST /api/auth/login - User authentication
-   GET /api/timetable/me - User's timetable
-   GET /api/timetable/user/:userId - Other user's timetable
-   Admin routes require admin JWT token

### Development Notes

-   Frontend proxies `/api` requests to backend on port 3001
-   WebUntis API integration with rate limiting (6 requests per 5 seconds)
-   JWT-based authentication with configurable admin credentials
-   TailwindCSS for styling with dark mode support
-   No test suite currently configured (package.json shows "no test specified")

## Architecture Overview

-   **Monorepo structure** with separate frontend/backend packages
-   **Backend**: Express.js with TypeScript, Prisma ORM, PostgreSQL, JWT auth
-   **Frontend**: React 19+ with TypeScript, Vite build tool, TailwindCSS
-   **Database**: PostgreSQL with Prisma migrations
-   **External**: WebUntis API integration for timetable data
