# Periodix

A modern timetable management system with WebUntis integration. Built as a TypeScript monorepo with Express.js backend (Prisma + PostgreSQL) and React frontend (Vite + TailwindCSS).

DISCLAIMER: An independent, open-source project – not connected to or supported by WebUntis, Untis GmbH or Sdui GmbH.

## Features

-   📅 **Timetable Management**: Seamless WebUntis integration with real-time timetable sync
-   🎨 **Lesson Customization**: Personalized color schemes for subjects and lessons
-   📚 **Homework & Exams**: Track assignments and exam schedules from WebUntis
-   👥 **Timetable Sharing**: Share your schedule with other users
-   🔐 **Secure Authentication**: JWT-based auth with encrypted credential storage
-   👨‍💼 **User Management**: Admin and user-manager roles for organization control
-   🛡️ **Whitelist System**: Closed beta mode with access request functionality
-   🚀 **Modern Tech Stack**: React 19, TypeScript, TailwindCSS 4, Prisma, PostgreSQL

## 🐳 Docker Deployment (Recommended)

The easiest way to run Periodix is using Docker Compose, which sets up the entire stack automatically.

### Prerequisites

-   Docker Desktop
-   Git

### Quick Start

1. **Clone and setup environment**:

    ```bash
    git clone https://github.com/LimoEisbxr/periodix.git
    cd periodix
    cp .env.example .env
    ```

2. **Configure environment variables** (see [Environment Configuration](#environment-configuration) below):

    ```bash
    # Edit .env file - at minimum set these:
    JWT_SECRET="your-strong-random-secret-here"
    PERIODIX_MASTER_KEY="64-character-hex-string-here"
    ```

3. **Start the application**:

    ```bash
    docker compose up -d --build
    ```

4. **Access the application**:
    - **Web Interface**: http://localhost:8080
    - **API Health**: http://localhost:3001/health
    - **Database**: localhost:6666 (postgres/postgres)

### Docker Services

-   **Frontend** (Port 8080): React app served by Nginx with API proxy
-   **Backend** (Port 3001): Express.js API with Prisma ORM
-   **Database** (Port 6666): PostgreSQL 16 with persistent storage

## Environment Configuration

Periodix requires proper environment configuration. Copy `.env.example` to `.env` and customize the following variables:

### 🔑 Security (Required)

```bash
# JWT secret for signing authentication tokens (32+ random bytes)
# Generate with: openssl rand -base64 48
JWT_SECRET="REPLACE_WITH_STRONG_RANDOM_SECRET"

# Master key for encrypting stored Untis credentials (64 hex characters)
# Generate with: openssl rand -hex 32
PERIODIX_MASTER_KEY="REPLACE_WITH_64_CHARACTER_HEX_STRING"
```

### 🌐 WebUntis Integration

```bash
# Default school identifier for WebUntis
UNTIS_DEFAULT_SCHOOL="your-school-identifier"

# WebUntis server hostname
UNTIS_HOST="your-webuntis-server.com"
```

### 👨‍💼 Admin Access (Optional)

```bash
# Admin credentials for user management
# Users logging in with these credentials get admin privileges
PERIODIX_ADMIN_USERNAME="admin"
PERIODIX_ADMIN_PASSWORD="secure-admin-password"
```

### 🛡️ Access Control (Optional)

```bash
# Enable whitelist mode for closed beta
WHITELIST_ENABLED=false

# If enabled, only whitelisted usernames can register
# Existing users and admins bypass this restriction
```

### 🔧 Application Settings

```bash
# CORS origin for frontend access
CORS_ORIGIN="http://localhost:8080"

# Frontend external port
WEB_PORT=8080

# Backend port
PORT=3001

# Database credentials
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres

# Developer mode toggle in frontend
VITE_ENABLE_DEVELOPER_MODE=false
```

### ⚠️ Security Notes

-   **Never use default secrets in production**
-   **Generate strong random values** for JWT_SECRET and PERIODIX_MASTER_KEY
-   **Change default database credentials** for production deployments
-   **Use HTTPS** with proper SSL certificates in production
-   **Review CORS settings** for your domain

## 💻 Local Development

For development with hot reloading and debugging:

### Prerequisites

-   Node.js 18+ (Node.js 20+ recommended)
-   npm
-   Docker Desktop (for PostgreSQL)

### Setup

1. **Start PostgreSQL**:

    ```bash
    docker compose up -d db
    ```

2. **Backend setup**:

    ```bash
    cp .env.example .env
    # Edit .env with your configuration

    cd periodix-backend
    npm install
    npx prisma generate
    npx prisma migrate dev --name init
    npm run dev
    ```

3. **Frontend setup**:

    ```bash
    cd periodix-frontend
    npm install
    npm run dev
    ```

4. **Access the application**:
    - Frontend: http://localhost:5173
    - Backend API: http://localhost:3001

## 🚀 API Documentation

### Authentication

All authenticated endpoints require the `Authorization: Bearer <token>` header.

#### Public Endpoints

-   `POST /api/auth/register` - User registration
    ```json
    { "username": "string", "password": "string", "displayName": "string?" }
    ```
-   `POST /api/auth/login` - User authentication
    ```json
    { "username": "string", "password": "string" }
    ```
-   `POST /api/access-request` - Request access (whitelist mode)
    ```json
    { "username": "string", "message": "string?" }
    ```

#### User Endpoints (Authenticated)

-   `GET /api/timetable/me` - Get user's timetable
-   `GET /api/timetable/user/:userId` - Get shared user's timetable
-   `GET /api/users/me` - Get current user profile
-   `PATCH /api/users/me` - Update display name
-   `GET /api/lesson-colors` - Get lesson color settings
-   `POST /api/lesson-colors` - Create/update lesson color
-   `DELETE /api/lesson-colors/:id` - Delete lesson color setting

#### Sharing Endpoints

-   `GET /api/sharing/status` - Get sharing status
-   `PUT /api/sharing/global` - Toggle global sharing
-   `GET /api/sharing/with` - List users you're sharing with
-   `POST /api/sharing/share` - Share timetable with user
-   `DELETE /api/sharing/share/:userId` - Stop sharing with user
-   `GET /api/sharing/shared-with-me` - List users sharing with you
-   `GET /api/sharing/search` - Search users to share with

#### Admin Endpoints (Admin JWT required)

-   `GET /api/admin/users` - List all users
-   `DELETE /api/admin/users/:id` - Delete user
-   `PATCH /api/admin/users/:id` - Update user (admin privileges)
-   `GET /api/admin/whitelist` - List whitelist rules
-   `POST /api/admin/whitelist` - Add whitelist rule
-   `DELETE /api/admin/whitelist/:id` - Remove whitelist rule
-   `GET /api/admin/access-requests` - List access requests
-   `POST /api/admin/access-requests/:id/approve` - Approve access request
-   `DELETE /api/admin/access-requests/:id` - Reject access request

#### User Manager Endpoints (User Manager or Admin)

-   `PATCH /api/user-manager/users/:id` - Update user display name
-   `GET /api/user-manager/whitelist` - List whitelist rules
-   `POST /api/user-manager/whitelist` - Add whitelist rule
-   `DELETE /api/user-manager/whitelist/:id` - Remove whitelist rule

### Query Parameters

Timetable endpoints support date filtering:

-   `start=YYYY-MM-DD` - Start date for timetable range
-   `end=YYYY-MM-DD` - End date for timetable range

## 🏗️ Architecture

### Monorepo Structure

```
periodix/
├── .env.example              # Environment template
├── docker-compose.yml       # Full stack deployment
├── periodix-backend/       # Express.js + Prisma backend
│   ├── src/routes/          # API route handlers
│   ├── src/server/          # Server configuration
│   ├── prisma/schema.prisma # Database schema
│   └── Dockerfile           # Backend container
├── periodix-frontend/      # React + Vite frontend
│   ├── src/components/      # React components
│   ├── src/api.ts          # API client
│   └── Dockerfile          # Frontend container (Nginx)
└── branding/               # Logo and brand assets
```

### Technology Stack

**Backend:**

-   Express.js 5 with TypeScript
-   Prisma ORM with PostgreSQL
-   JWT authentication with Argon2 password hashing
-   WebUntis API integration with rate limiting
-   Helmet security middleware

**Frontend:**

-   React 19 with TypeScript
-   Vite build tool
-   TailwindCSS 4 for styling
-   Modern responsive design

**Infrastructure:**

-   Docker & Docker Compose
-   Nginx for frontend serving and API proxying
-   PostgreSQL 16 for data persistence

### Database Schema

Key models:

-   **User**: Authentication, profiles, and preferences
-   **Timetable**: Cached WebUntis data with date ranges
-   **LessonColorSetting**: Personalized lesson colors
-   **Homework/Exam**: WebUntis homework and exam tracking
-   **TimetableShare**: User-to-user timetable sharing
-   **WhitelistRule**: Access control for closed beta
-   **AccessRequest**: User requests for whitelist access

## 🔍 Health Checks

Monitor application status:

-   **API Health**: `GET /health` - Returns service status and timestamp
-   **Database**: Automatic health checks in Docker Compose
-   **Frontend**: Nginx serves health endpoint at `/health`

## 🛠️ Development Notes

-   **Rate Limiting**: WebUntis API calls are limited to 6 requests per 5 seconds
-   **Credential Security**: Untis passwords are encrypted with AES-GCM before storage
-   **Migrations**: Use `prisma migrate dev` for development, `prisma migrate deploy` for production
-   **CORS**: Configurable origins with dynamic reflection for development
-   **Proxy**: Frontend development server proxies `/api` requests to backend

## 📝 Contributing

1. Fork the repository
2. Create a feature branch
3. Run tests: `npm run lint` and `npm run build` in both frontend and backend
4. Submit a pull request

## 📄 License

Licensed under the MIT License. See [LICENSE](LICENSE) for details.
