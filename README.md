# 🎓 Student Project Showcase Portal

A full-stack web application built for the **Faculty of Computing** enabling students to showcase academic and personal projects, recruiters to discover and follow student developers, and administrators to moderate content and view system analytics.

---

## 🌟 Key Features

- **Authentication & Identity**:
  - OIDC / Google OAuth 2.0 integration with cloud-based Identity Provider.
  - Local Password-based authentication (PBKDF2/Argon2 hashing with salt).
  - Passwordless Magic Link / 6-digit OTP verification.
  - RS256 Asymmetric JWT access tokens (15-min expiry) with refresh token rotation and database-backed revocation.
- **Role-Based Access Control (RBAC)**:
  - Dynamic, database-driven permissions (`Admin`, `Recruiter`, `Student`).
  - Instant permission propagation without token re-issuance lag.
- **Project Showcase Management**:
  - Create, edit, delete, and upload thumbnail images (JPEG, PNG, WebP, GIF).
  - Public vs. Private visibility toggles and Admin content moderation.
- **Engagement & Real-Time Notifications**:
  - Recruiter project likes with unique toggle constraints.
  - Student developer follow system with follower counters.
  - In-app notifications panel for engagement events.
- **Security & HTTPS**:
  - Out-of-the-box HTTPS support with automatic local SSL certificate generation.
  - HTTP security headers (`Helmet`, CSP, strict CORS, `nosniff`, `SameSite` cookies).
  - Rate-limited authentication routes and security audit logging.

---

## 📋 Prerequisites

Before setting up the project, make sure the following software is installed on your PC:

- **Node.js**: `v20.x` or `v22.x` ([Download Node.js](https://nodejs.org/))
- **npm**: `v10.x` or higher (comes with Node.js)
- **Git**: ([Download Git](https://git-scm.com/))
- **Docker & Docker Compose** _(Recommended for easiest setup)_: ([Download Docker Desktop](https://www.docker.com/products/docker-desktop/))
  - _OR_ a local **PostgreSQL 16** server if not using Docker.
- **OpenSSL** _(Optional, included by default on Linux/macOS and Git Bash on Windows for auto SSL generation)_.

---

## 🚀 Quick Start Guide

You can run this application using **Docker Compose (Easiest)** or as a **Local Node.js Development Setup**.

---

### Option 1: Running with Docker Compose (Recommended)

This runs the PostgreSQL Database and Express Backend inside isolated Docker containers.

#### Step 1: Clone the Repository

```bash
git clone https://github.com/your-username/web-project-hall.git
cd web-project-hall
```

#### Step 2: Configure Root Environment File

Copy the example environment file:

```bash
cp .env.example .env
```

_(Optional: If you want to use Google OAuth, add your `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`)_.

#### Step 3: Start Backend & Database with Docker

```bash
docker compose up --build -d
```

Verify the containers are running:

```bash
docker compose ps
```

#### Step 4: Start the Frontend (Vite)

Open a new terminal tab/window:

```bash
cd frontend
npm install
npm run dev
```

The frontend will start at: **`https://localhost:5173`** (or `http://localhost:5173`).

#### Step 5: Accept Local SSL Certificates in Browser (First-Time Setup)

When running over HTTPS with local self-signed certificates, complete the [1-minute browser certificate setup](#-running-with-https--browser-certificate-setup) so your browser trusts both the frontend and backend:
1. Open `https://localhost:5173` in your browser $\rightarrow$ click **Advanced...** $\rightarrow$ **Accept the Risk and Continue** (or **Proceed to localhost**).
2. Open `https://localhost:5000/api/auth/.well-known/openid-configuration` in a new tab $\rightarrow$ click **Advanced...** $\rightarrow$ **Accept the Risk and Continue**.

---

### Option 2: Local Development Setup (Without Docker)

If you prefer to run both backend and frontend directly on your host machine:

#### Step 1: Set Up PostgreSQL Database

1. Ensure PostgreSQL is running locally on port `5432` (or `5433`).
2. Create a database named `project_hall`:
   ```sql
   CREATE DATABASE project_hall;
   ```
3. Initialize the database schema and seeded demo users:
   ```bash
   psql -U postgres -d project_hall -f backend/init.sql
   ```

#### Step 2: Set Up & Start Backend

1. Navigate to `backend/` and install dependencies:
   ```bash
   cd backend
   npm install
   ```
2. Create `backend/.env`:
   ```bash
   cp .env.example .env
   ```
   _Edit `.env` to match your local PostgreSQL credentials (`PGUSER`, `PGPASSWORD`, `PGPORT`)._
3. Start the backend:
   ```bash
   npm run dev
   ```
   The backend will start at: **`https://localhost:5000`** (or `http://localhost:5000`).

#### Step 3: Set Up & Start Frontend

1. In a new terminal, navigate to `frontend/` and install dependencies:
   ```bash
   cd frontend
   npm install
   ```
2. Create `frontend/.env`:
   ```properties
   VITE_HTTPS=true
   VITE_API_URL=https://localhost:5000
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   Open your browser and visit: **`https://localhost:5173`**

#### Step 4: Accept Local SSL Certificates in Browser (First-Time Setup)

1. Open `https://localhost:5173` $\rightarrow$ click **Advanced...** $\rightarrow$ **Accept the Risk and Continue**.
2. Open `https://localhost:5000/api/auth/.well-known/openid-configuration` $\rightarrow$ click **Advanced...** $\rightarrow$ **Accept the Risk and Continue**.

---

## 🔒 Running with HTTPS & Browser Certificate Setup

The application is configured to run with **HTTPS** out of the box.

### Handling Self-Signed Certificate Warnings in Localhost

When accessing `https://localhost:5173` for the first time, your browser (Firefox/Chrome) will display a security warning (e.g., `SEC_ERROR_UNKNOWN_ISSUER` or `NET::ERR_CERT_AUTHORITY_INVALID`). **This is completely normal for local self-signed development certificates.**

#### Quick 1-Minute Browser Fix:

1. **Frontend**:
   - Open `https://localhost:5173`
   - Click **Advanced...** $\rightarrow$ Click **Accept the Risk and Continue** (or **Proceed to localhost (unsafe)** in Chrome).
2. **Backend API**:
   - Open `https://localhost:5000/api/auth/.well-known/openid-configuration` in a new tab.
   - Click **Advanced...** $\rightarrow$ Click **Accept the Risk and Continue**.
   - Close the tab.

_Your browser will remember the exception, and the app will load smoothly._

### ⚠️ Troubleshooting: "Cross-Origin Request Blocked ... (Reason: CORS request did not succeed). Status code: (null)"

If you see this error in your browser console:
```text
Cross-Origin Request Blocked: The Same Origin Policy disallows reading the remote resource at https://localhost:5000/api/auth/me. (Reason: CORS request did not succeed). Status code: (null).
```
**Why this occurs:** Modern browsers automatically block background `fetch`/`axios` requests to an untrusted HTTPS port (`localhost:5000`) before exchanging CORS headers, reporting it as a CORS error with status `(null)`.

**Solution:** Simply visit `https://localhost:5000/api/auth/.well-known/openid-configuration` in a browser tab once and click **Accept the Risk and Continue** (Step 2 above), then reload your frontend.

> 💡 **Prefer HTTP instead?**
> Set `USE_HTTPS=false` in `.env` (or `backend/.env`) and `VITE_HTTPS=false`, `VITE_API_URL=http://localhost:5000` in `frontend/.env`.

---

## 👥 Pre-Seeded Demo Accounts

The database comes pre-seeded with test accounts for each role:

| Role          | Email                  | Password      | Permissions                                                  |
| :------------ | :--------------------- | :------------ | :----------------------------------------------------------- |
| **Admin**     | `admin@school.com`     | `password123` | Moderate all projects, manage user roles, system stats       |
| **Recruiter** | `recruiter@school.com` | `password123` | Browse public projects, like projects, follow students       |
| **Student**   | `student@school.com`   | `password123` | Create, edit, and delete own projects, receive notifications |

---

## ⚙️ Environment Variables Reference

### Backend (`backend/.env` or root `.env`)

| Variable               | Default Value            | Description                                        |
| :--------------------- | :----------------------- | :------------------------------------------------- |
| `PORT`                 | `5000`                   | Port for the Express backend server                |
| `NODE_ENV`             | `development`            | Runtime mode (`development`, `production`, `test`) |
| `USE_HTTPS`            | `true`                   | Toggle HTTPS (`true` or `false`)                   |
| `SSL_KEY_PATH`         | _(empty)_                | Optional path to custom SSL private key            |
| `SSL_CERT_PATH`        | _(empty)_                | Optional path to custom SSL certificate            |
| `PGHOST`               | `localhost` / `db`       | PostgreSQL host address                            |
| `PGPORT`               | `5432` / `5433`          | PostgreSQL port                                    |
| `PGUSER`               | `postgres`               | PostgreSQL username                                |
| `PGPASSWORD`           | `postgres`               | PostgreSQL password                                |
| `PGDATABASE`           | `project_hall`           | Database name                                      |
| `SESSION_SECRET`       | _(string)_               | Secret used for Google OAuth sessions              |
| `JWT_ISSUER`           | `https://localhost:5000` | OIDC token issuer URL                              |
| `JWT_AUDIENCE`         | `https://localhost:5173` | OIDC token audience URL                            |
| `FRONTEND_URL`         | `https://localhost:5173` | Allowed CORS origin and OAuth redirect target      |
| `GOOGLE_CLIENT_ID`     | _(optional)_             | Google Cloud OAuth Client ID                       |
| `GOOGLE_CLIENT_SECRET` | _(optional)_             | Google Cloud OAuth Client Secret                   |

### Frontend (`frontend/.env`)

| Variable       | Default Value            | Description                          |
| :------------- | :----------------------- | :----------------------------------- |
| `VITE_HTTPS`   | `true`                   | Enables HTTPS in the Vite dev server |
| `VITE_API_URL` | `https://localhost:5000` | Backend API base URL                 |
