# Garment Shop Management System (ERP & HRMS)

A complete, production-grade Attendance, Payroll, and Workforce Management System built for garment retail and wholesale stores, featuring strict Role-Based Access Control (RBAC), multi-role portals (Super Admin/Owner, Admin/Manager, Employee/Worker), and offline-capable Progressive Web App (PWA) support for Android and Windows.

---

## 🚀 Key Features

- **Store Owner & Super Admin Portal**: Full executive overview, payroll liability tracking, attendance statistics, company configuration, and administrative user account management.
- **Store Operations & Admin Portal**:
  - **Employee Management**: Profile CRUD, joining dates, department, per-day salary, monthly base, and overtime rate calculation.
  - **Single-Row Attendance Roster**: Quick bulk marking across 100+ workers in a clean grid with Present, Absent, Half-Day, and Leave status.
  - **Automated Payroll Engine**: Month-by-month calculation reflecting actual attendance, working days, overtime hours, bonus, and deductions with instant salary slip generation.
  - **Audit Logs**: Tamper-evident logging of administrative actions, attendance overrides, and salary changes.
- **Worker Self-Service Portal**: View personal attendance history, monthly salary breakdown, and downloadable digital pay slips.
- **PWA Ready**: Installable as a standalone app on Android and Windows with service worker caching.
- **Zero-Wipe Persistence**: Safe, idempotent SQLite database initialization that persists data across redeployments and restarts.

---

## 🛠 Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Lucide Icons, Motion.
- **Backend**: Node.js (>=22.0.0), Express, TypeScript, native `node:sqlite` with WAL mode.
- **Bundler**: Vite for client assets, `esbuild` for server production packaging.
- **Deployment Target**: Render Web Service with Persistent Disk storage.

---

## 📦 Environment Variables

Configure these variables in your deployment platform (e.g., Render Dashboard) or in `.env` for local testing:

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | Yes | `production` | Set to `production` in live environments. |
| `PORT` | Auto | `3000` | Port for Express server (automatically injected by Render). |
| `DB_PATH` | Recommended | `./erp_management.db` | Absolute path to the SQLite database file. On Render with a persistent disk, use `/var/data/erp_management.db`. |
| `SESSION_SECRET` | Recommended | `erp_salt_2026_secure` | Secret string used to salt password hashes and session tokens. |
| `ADMIN_EMAIL` | Optional | `hmrajapal11@gmail.com` | Email of initial Super Admin owner (created on first boot if no Super Admin exists). |
| `ADMIN_PASSWORD` | Optional | — | Password for the initial Super Admin owner. |
| `ADMIN_USERNAME` | Optional | `hmrajpal` | Username for the initial Super Admin owner. |
| `SETUP_TOKEN` | Optional | — | Secret token required to invoke the `/api/auth/setup-admin` endpoint. |
| `GEMINI_API_KEY` | Optional | — | Optional key for Google AI Studio / Gemini features. |

---

## 🌐 Deploying to Render (Step-by-Step)

### Step 1: Create a New Web Service
1. Log in to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** → **Web Service**.
3. Connect your GitHub repository (`https://github.com/virajborge63-blip/Garment-Shop-Management-System.git`).

### Step 2: Configure Service Settings
- **Name**: `garment-shop-management-system` (or your choice)
- **Region**: Select the region nearest your store.
- **Branch**: `main`
- **Runtime**: `Node`
- **Build Command**:
  ```bash
  npm install && npm run build
  ```
- **Start Command**:
  ```bash
  npm start
  ```

### Step 3: Attach Persistent Disk Storage (Critical for SQLite)
Render's filesystem is ephemeral by default. To preserve employees, attendance, and payroll records between deploys and server restarts:
1. In your Web Service settings, scroll down to the **Disks** section.
2. Click **Add Disk**.
3. Enter:
   - **Name**: `garment-data`
   - **Mount Path**: `/var/data`
   - **Size**: `1 GB` (or higher)
4. Add the following Environment Variable in Render:
   - **Key**: `DB_PATH`
   - **Value**: `/var/data/erp_management.db`

*Note: The backend automatically creates any missing parent directories (`/var/data`) on boot.*

### Step 4: Configure Initial Super Admin Owner
In the **Environment** tab on Render, add:
- `NODE_ENV`: `production`
- `DB_PATH`: `/var/data/erp_management.db`
- `SESSION_SECRET`: *(Generate a random 32+ character string)*
- `ADMIN_EMAIL`: `hmrajapal11@gmail.com`
- `ADMIN_PASSWORD`: *(Enter strong password for owner)*
- `ADMIN_USERNAME`: `hmrajpal`
- `SETUP_TOKEN`: *(Optional random string for remote setup)*

Click **Save Changes** and deploy!

---

## 🔐 Administrator Setup & Provisioning Methods

You have three secure ways to set up or update the Store Owner / Super Admin account:

### Method 1: Automatic Bootstrapping via Environment Variables
Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in your Render Environment Variables. On the very first launch, if no Super Admin exists, the system automatically creates the account and logs an audit record. If an admin already exists, it is **never** overwritten on subsequent restarts.

### Method 2: Command-Line Interface (CLI)
You can create or update an administrator at any time using the Render Shell or local terminal:
```bash
npm run setup:admin <email> <password> [username]
```
Example:
```bash
npm run setup:admin hmrajapal11@gmail.com MySecurePassword123 hmrajpal
```

### Method 3: Protected Setup API Endpoint
You can securely provision or update credentials via `POST /api/auth/setup-admin`:
```bash
curl -X POST https://your-app.onrender.com/api/auth/setup-admin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "hmrajapal11@gmail.com",
    "password": "MySecurePassword123",
    "username": "hmrajpal",
    "setupToken": "your_configured_setup_token"
  }'
```

---

## 🔍 Health Check & Monitoring

The service includes a production health-check endpoint:
- **URL**: `GET /api/health`
- **Response**:
  ```json
  {
    "status": "ok",
    "uptime": 142,
    "database": "connected",
    "timestamp": "2026-10-19T06:00:00.000Z"
  }
  ```
Render can use `/api/health` as its Health Check Path in the service settings.

---

## 💻 Local Development

1. **Clone the repository**:
   ```bash
   git clone https://github.com/virajborge63-blip/Garment-Shop-Management-System.git
   cd Garment-Shop-Management-System
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Copy environment variables**:
   ```bash
   cp .env.example .env
   ```

4. **Start the development server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your browser.

5. **Run type checks & build**:
   ```bash
   npm run lint
   npm run build
   ```

---

## 🛡 Security & Reliability Highlights

1. **Idempotent Initialization**: The server starts without data wipes. Existing employees, attendance logs, payroll calculations, and session tokens remain intact across restarts and upgrades.
2. **Encrypted Passwords**: SHA-256 with configurable salt/secret from `SESSION_SECRET`. Passwords and password hashes are never returned by any API route.
3. **Protected Static Files**: The static file handler explicitly blocks direct client requests to `.cjs`, `.map`, `.db`, or `.sqlite` files.
4. **Strict Role-Based Access Control**:
   - `requireSuperAdmin`: Restricts store ownership settings and administrator provisioning.
   - `requireAdmin`: Restricts worker creation, attendance logging, and payroll finalization.
   - `requireEmployee`: Ensures workers can only view their own records.
5. **Robust Error Handling**: Production errors are masked to avoid leaking database paths or stack traces to end users.

---

## ❓ Troubleshooting

| Issue | Cause | Solution |
|---|---|---|
| **Data lost after restart** | Ephemeral Render disk | Mount a persistent disk at `/var/data` and configure `DB_PATH=/var/data/erp_management.db`. |
| **Node SQLite version warning** | Running on Node < 22 | Ensure Node version is `>=22.0.0` as specified in `package.json` engines. |
| **Login fails with 401** | Account inactive or wrong password | Check credentials or run `npm run setup:admin` to reset the Super Admin password. |
| **Port EADDRINUSE locally** | Port 3000 occupied | Run with `PORT=3001 npm run dev` or free port 3000. |
