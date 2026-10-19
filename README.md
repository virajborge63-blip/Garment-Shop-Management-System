# Garment Shop Management System (ERP & HRMS)

A complete, production-grade Attendance, Payroll, and Workforce Management System built specifically for garment retail and wholesale stores, featuring strict Role-Based Access Control (RBAC), multi-role portals (Super Admin Store Owner, Branch/Floor Admin, and Staff/Employee), and automated salary calculations with overtime and allowances.

---

## 🚀 Production Deployment on Render

This application runs as a unified full-stack service with a React 19 + Vite frontend bundled together with a Node.js + Express backend powered by SQLite (`node:sqlite`).

### 1. Prerequisites & Runtime Requirements
- **Node.js**: `>= 22.0.0` (required for native `node:sqlite`)
- **Git Repository**: Pushed to GitHub

---

### 2. Render Web Service Configuration

1. In the **Render Dashboard**, click **New +** > **Web Service**.
2. Connect your GitHub repository: `https://github.com/virajborge63-blip/Garment-Shop-Management-System.git`.
3. Configure the service settings:
   - **Name**: `garment-shop-management-system`
   - **Environment**: `Node`
   - **Region**: Select your preferred region (e.g., Singapore, Frankfurt, Oregon)
   - **Branch**: `main`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: Standard or Starter (required to attach a Persistent Disk)

---

### 3. Persistent Storage Setup (Render Disk)

Because SQLite stores data in a file, Render's default ephemeral container filesystem will reset data on restarts or new deploys. Attaching a persistent disk ensures **100% data durability across restarts and deployments**.

1. In your Render Web Service settings, scroll down to **Disks** and click **Add Disk**.
2. Set the following disk parameters:
   - **Name**: `garment-data`
   - **Mount Path**: `/var/data`
   - **Size**: `1 GB` (or higher)
3. Under **Environment Variables**, set:
   - **Key**: `DB_PATH`
   - **Value**: `/var/data/erp_management.db`

The application automatically verifies and creates the `/var/data` parent directory on startup and applies Write-Ahead Logging (`WAL` mode) and `PRAGMA synchronous = NORMAL` for durable persistence.

---

### 4. Required & Recommended Environment Variables

Configure these variables in your Render Web Service dashboard under the **Environment** tab:

| Variable | Required | Default | Description |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | **Yes** | `production` | Set to `production` for optimized static asset serving and strict security headers. |
| `PORT` | **Yes** | `3000` | Port for the Express server (Render injects `PORT=10000` automatically). |
| `DB_PATH` | **Yes (on Render)** | `./data/erp_management.db` | Absolute path to the database. Use `/var/data/erp_management.db` on Render with a persistent disk. |
| `SESSION_SECRET` | **Yes** | Random fallback | Cryptographic secret key used to secure user sessions and password salts. |
| `ADMIN_EMAIL` | Recommended | None | Initial Super Admin (Store Owner) email address created on first boot. |
| `ADMIN_PASSWORD` | Recommended | None | Initial Super Admin password (min 8 characters). |
| `ADMIN_USERNAME` | Optional | `owner_admin` | Initial Super Admin username. |
| `SETUP_TOKEN` | Optional | None | Secret token required to invoke `POST /api/auth/setup-admin` for remote administration. |
| `ALLOW_ADMIN_RESET` | Optional | `false` | Set to `true` only when intentionally overriding existing admin passwords via script. |

---

### 5. Administrator Setup & Credential Management

The system provides multiple secure administrator provisioning methods without hardcoding any credentials into source code:

#### Method A: Automatic Initialization on First Boot (Zero-Downtime)
Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in Render's environment variables.
- On first launch, if no `SUPER_ADMIN` account exists, the application initializes the administrator account securely hashed with `scrypt`.
- On subsequent deployments and server restarts, existing administrators are **never overwritten or reset**.

#### Method B: Interactive CLI Command via Render Shell
You can use the Render SSH Console or local terminal to provision or reset administrator accounts:

```bash
# Initial administrator creation:
npm run setup:admin owner@rajpalgarments.com MySuperPass123! hmrajpal

# Protected credential reset (requires explicit --reset flag):
npm run setup:admin owner@rajpalgarments.com NewSecurePass456! hmrajpal --reset
```
*Note: If an administrator already exists, running `npm run setup:admin` without `--reset` safely halts and protects existing credentials from accidental overrides.*

#### Method C: Protected Setup API
If `SETUP_TOKEN` is configured in your environment variables, you can provision or reset administrators via:
```bash
curl -X POST https://your-app.onrender.com/api/auth/setup-admin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "owner@rajpalgarments.com",
    "password": "NewSecurePassword123!",
    "username": "hmrajpal",
    "setupToken": "your_configured_setup_token"
  }'
```
If an administrator exists and `setupToken` is absent or invalid, access is strictly forbidden (`403 Forbidden`).

---

### 6. Security & Safe Remediation Plan for Sensitive Data

If a local SQLite database (`erp_management.db`) was previously committed to GitHub:

#### Step 1: Untrack the Database from Git
The `.gitignore` has been updated to ignore all `*.db`, `*.sqlite`, and `data/` directories. Remove the file from git tracking:
```bash
git rm --cached erp_management.db
git commit -m "security: remove committed sqlite database from git tracking"
git push origin main
```

#### Step 2: Scrub Sensitive Data from Git Commit History
To permanently purge any previously committed database blobs and historical credentials from repository history:
```bash
# Using git-filter-repo (recommended by GitHub)
pip install git-filter-repo
git filter-repo --path erp_management.db --invert-paths

# Force push the clean history to GitHub
git push origin --force --all
git push origin --force --tags
```

#### Step 3: Rotate Secrets and Reset Credentials
1. Update `SESSION_SECRET` in your Render Environment variables with a newly generated random 64-character string.
2. Invalidate old sessions by running:
   ```bash
   npm run setup:admin <email> <new_password> [username] --reset
   ```
3. Passwords are automatically hashed using Node.js native `scrypt` with unique salts. Any legacy SHA-256 hashes are transparently upgraded to `scrypt` upon successful user login.

---

### 7. Health Check & Monitoring

The backend exposes a JSON health check endpoint:
```
GET /api/health
```
Response:
```json
{
  "status": "ok",
  "uptime": 124,
  "database": "connected",
  "timestamp": "2026-10-19T06:25:00.000Z"
}
```
You can configure Render's **Health Check Path** to `/api/health` for zero-downtime rolling deploys.

---

### 8. Local Development

```bash
# Install dependencies
npm install

# Run development server with HMR and Express API backend
npm run dev

# Run TypeScript type check
npm run lint

# Build production bundle
npm run build

# Start production server
npm start
```
Default local port is `3000` (http://localhost:3000).
