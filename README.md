# Garment Shop Management System (Full-Stack React + Node.js + MongoDB)

A Full-Stack Garment Shop Management & Workforce ERP System built with **React 19 + Vite** on the frontend, **Node.js + Express + TypeScript** on the backend, and **MongoDB with Mongoose** for database persistence.

---

## 🌟 Key Features

1. **Role-Based Access Control (RBAC)**:
   - **Super Admin (Store Owner)**: Executive financial overview, manager accounts provisioning, store settings, audit logs.
   - **Admin (Store Operations / Manager)**: Employee directory, line-by-line attendance roster, payroll disbursements, salary slip generation, compliance reports.
   - **Employee / Staff**: Personal dashboard, daily attendance history, salary breakdown, digital printable salary slips.

2. **Garment Shop Inventory & POS Billing**:
   - **Point of Sale (POS)**: Customer checkout, garment catalog search by SKU/fabric/color, live cart management, discounts, payment methods (Cash, UPI, Card, Net Banking), and automated invoice generation (`INV-YYYYMMDD-XXXX`).
   - **Real-Time Inventory**: Real-time stock counts, automatic stock decrement on sales, low-stock threshold alerts, and manual stock adjustment audit trail.
   - **Garment Categories**: Support for Men's Wear, Women's Ethnic & Sarees, Western Wear, Kids' Wear, Suitings & Shirtings Fabrics.
   - **Suppliers & Textile Mills**: Directory of wholesale suppliers, mills, GST numbers, and contact details.

3. **Workforce, Attendance & Payroll**:
   - Daily attendance marking (Present, Absent, Leave, Half Day, Overtime hours).
   - Dynamic and finalized payroll calculation (working days, basic salary, overtime earnings, bonuses, deductions, net pay).
   - High-fidelity printable digital salary slips with shop branding.

4. **Security & Data Integrity**:
   - Cryptographically secure password hashing using Node.js native `scrypt` with unique 16-byte random salts.
   - Timing-safe password verification preventing timing attacks.
   - Protected administrator provisioning with audit logging.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS, Lucide React
- **Backend**: Node.js, Express, TypeScript, tsx
- **Database**: MongoDB with Mongoose (embedded `mongodb-memory-server` is local-development-only)
- **Deployment**: Node.js hosting platforms or local self-hosting

---

## ⚙️ Environment Variables

Create a `.env` file in the root directory (or use `.env.example` as a template):

```env
NODE_ENV=development
PORT=3000

# MongoDB URI (MongoDB Atlas or Local MongoDB)
# Required in production. In-memory MongoDB is available only for local development.
MONGODB_URI=mongodb://127.0.0.1:27017/garment_shop_erp

# Production requires a random secret with at least 32 characters.
SESSION_SECRET=replace_with_a_random_secret_at_least_32_characters_long

# Optional environment-based initial owner provisioning. Uncomment and replace all values.
# ADMIN_EMAIL=owner@example.com
# ADMIN_PASSWORD=replace_with_a_unique_password_at_least_12_characters
# ADMIN_USERNAME=owner_admin

# Required in production only if using the remote /api/auth/setup-admin endpoint.
# SETUP_TOKEN=replace_with_a_long_random_setup_token
```

Never deploy the example values. Keep real values in the hosting provider's secret environment configuration, not in the repository.

---

## 🚀 Exact Commands to Run Locally

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup the initial Super Admin via CLI
```bash
npm run setup:admin -- owner@example.com YOUR_UNIQUE_PASSWORD_AT_LEAST_12_CHARS owner_admin
```

### 3. Start Development Server
```bash
npm run dev
```
Open **http://localhost:3000** in your browser.

### 4. Build and Run in Production Mode
```bash
npm run build
npm start
```

Production requires `MONGODB_URI` and a `SESSION_SECRET` of at least 32 characters. The server exits with an actionable error if the database is unavailable; it does not switch to temporary storage. The hosting platform must provide `PORT`; the server binds to `0.0.0.0`. Set `NODE_ENV=production`.

### Manual password resets

Password resets are handled manually by the Store Owner; there is no email reset flow. In the Super Admin portal, open **Admin Accounts**, choose **Reset Password** for the manager, and set a new password of at least 12 characters. Employee passwords can be reset from **Admin → Employee Directory → Edit → Reset Password**.

The server does not trust forwarded client IP headers by default. `TRUST_PROXY` is the exact number of trusted proxy hops and must be a non-negative integer; it defaults to `0` for direct connections. For the single-service Render deployment behind one trusted proxy, set `TRUST_PROXY=1` in Render's environment settings. Do not set a hop count unless the deployment topology is controlled.

For a Node.js host, use `npm run build` as the build command and `npm start` as the start command, with the environment variables above configured in the host's secret settings. Provision the first owner using the setup CLI against the same persistent database before giving client users access. No hosting-provider-specific deployment manifest is present in this repository, so provider-specific networking and health-check setup must be completed in that provider's dashboard.

To inventory legacy password hashes, set `AUDIT_MONGODB_URI` to a read-only, non-production database copy and `AUDIT_NON_PRODUCTION=true`, then run `npm run report:legacy-password-hashes`. The report emits aggregate counts only; it does not print identifiers or hashes and does not modify data. Do not run it against production.

---

## 🧪 Testing & Verification

- **Linting & Type Check**:
  ```bash
  npm run lint
  ```
- **Health Check Endpoint**:
  ```bash
  curl http://127.0.0.1:3000/api/health
  ```
  Returns:
  ```json
  {
    "status": "ok",
    "uptime": 12,
    "database": "connected",
    "engine": "MongoDB",
    "timestamp": "2026-10-28T02:11:00.000Z"
  }
  ```
