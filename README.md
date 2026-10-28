# Garment Shop Management System (Full-Stack React + Node.js + MongoDB)

A complete, production-ready Full-Stack Garment Shop Management & Workforce ERP System built with **React 19 + Vite** on the frontend, **Node.js + Express + TypeScript** on the backend, and **MongoDB with Mongoose** for database persistence.

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
- **Database**: MongoDB with Mongoose (with embedded `mongodb-memory-server` fallback for zero-configuration local runs)
- **Deployment**: Production-ready for Render, Railway, AWS, or local self-hosting

---

## ⚙️ Environment Variables

Create a `.env` file in the root directory (or use `.env.example` as a template):

```env
NODE_ENV=development
PORT=3000

# MongoDB URI (MongoDB Atlas or Local MongoDB)
# If omitted or left blank, the app will automatically start an in-memory MongoDB instance!
MONGODB_URI=mongodb://127.0.0.1:27017/garment_shop_erp

# Session secret for cryptographically signing sessions
SESSION_SECRET=your_long_random_session_secret_string

# Default Super Admin credentials
ADMIN_EMAIL=hmrajpal11@gmail.com
ADMIN_PASSWORD=HMRajpal@89565
ADMIN_USERNAME=hmrajpal
```

---

## 🚀 Exact Commands to Run Locally

### 1. Install Dependencies
```bash
npm install
```

### 2. (Optional) Setup Super Admin via CLI
```bash
npm run setup:admin hmrajpal11@gmail.com HMRajpal@89565 hmrajpal
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
