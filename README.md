# CloudVault Backend

NestJS + Prisma + PostgreSQL backend for CloudVault, a file storage application with nested folder organization and AWS S3 integration.

## Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 13+ (local or remote)
- AWS account with S3 bucket configured (optional for local testing)

### Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment**
   - Copy `.env.example` to `.env` and adjust:
     - `DATABASE_URL` — your PostgreSQL connection string
     - `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` — change to random values
     - `AWS_*` — provide real credentials if testing S3 integration

3. **Initialize database**
   ```bash
   # Generate Prisma client
   npx prisma generate
   
   # Create database and tables
   npx prisma migrate dev --name init
   ```

4. **Start development server**
   ```bash
   npm run start:dev
   ```
   Server runs on `http://localhost:5000`

## API Overview

### Auth (`/auth`)
- `POST /auth/register` — create account
- `POST /auth/login` — login, returns access token + refresh cookie
- `POST /auth/refresh` — get new access token
- `POST /auth/logout` — invalidate refresh token

### Users (`/users`)
- `GET /users/me` — current user profile

### Folders (`/folders`)
- `POST /folders` — create folder
- `GET /folders` — list root folders
- `GET /folders/:id` — list folder contents
- `PATCH /folders/:id` — rename
- `DELETE /folders/:id` — soft delete (cascades to children)

### Files (`/files`)
- `POST /files/upload-url` — request presigned S3 upload URL
- `POST /files/confirm` — confirm upload completed
- `GET /files` — list root files
- `GET /files/:id/download-url` — get presigned download URL
- `PATCH /files/:id` — rename
- `DELETE /files/:id` — soft delete

## Authentication Flow

1. User registers or logs in via `/auth/login`
2. Backend returns `accessToken` (in response body) + sets `refreshToken` (HttpOnly cookie)
3. Frontend stores `accessToken` in memory and includes in all protected requests
4. When `accessToken` expires, frontend calls `/auth/refresh` (cookie auto-sent) to get a new one
5. On logout, refresh token is cleared server-side and cookie is removed

## File Storage

- **S3 key format**: `{userId}/{fileId}/{originalFileName}`
- **Presigned URLs** expire in 5 min (upload) / 10 min (download)
- **Storage quotas** enforced: max 100MB per file, 1GB per user
- **Container tracking**: each upload records the `INSTANCE_ID` that processed it

## Database

- **Soft deletes**: all deletions set `deletedAt` timestamp, queries filter them out by default
- **Folder cascade**: deleting a folder soft-deletes all children folders and files
- **User quota**: `totalBytes` updated atomically on confirm/delete

See [plan.md](./plan.md) for full architecture and implementation details.