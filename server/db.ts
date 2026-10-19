import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';

dotenv.config();

// Determine database path: prioritize DB_PATH environment variable (for Render persistent disks or local config)
const rawDbPath = process.env.DB_PATH || 'erp_management.db';
const dbPath = path.isAbsolute(rawDbPath)
  ? rawDbPath
  : path.resolve(process.cwd(), rawDbPath);

// Ensure the parent directory exists (critical for Render persistent disk mounts, e.g., /var/data)
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  try {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log(`[Database] Created persistent storage directory: ${dbDir}`);
  } catch (dirErr: any) {
    console.error(`[Database Error] Could not create directory ${dbDir}:`, dirErr?.message || dirErr);
  }
}

console.log(`[Database] Initializing SQLite connection at: ${dbPath}`);
export const db = new DatabaseSync(dbPath);

// Helper to hash passwords securely with salt/secret from environment
export function hashPassword(password: string): string {
  const secret = process.env.SESSION_SECRET || 'erp_salt_2026_secure';
  return crypto.createHash('sha256').update(password + secret).digest('hex');
}

/**
 * Initializes database schema idempotently.
 * Never deletes employees, attendance, payroll, sessions, or users.
 */
export function initDatabase() {
  // Enable foreign keys and Write-Ahead Logging for high performance & safe persistence
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA journal_mode = WAL;');

  // 1. Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('SUPER_ADMIN', 'ADMIN', 'EMPLOYEE')),
      employee_id TEXT,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 2. Employees table
  db.exec(`
    CREATE TABLE IF NOT EXISTS employees (
      employee_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT UNIQUE NOT NULL,
      address TEXT,
      department TEXT NOT NULL,
      designation TEXT NOT NULL,
      joining_date TEXT NOT NULL,
      per_day_salary REAL NOT NULL DEFAULT 800,
      monthly_salary REAL NOT NULL DEFAULT 20800,
      overtime_rate REAL NOT NULL DEFAULT 150,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
      avatar_url TEXT
    );
  `);

  // 3. Attendance table
  db.exec(`
    CREATE TABLE IF NOT EXISTS attendance (
      attendance_id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id TEXT NOT NULL,
      date TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('Present', 'Absent', 'Leave', 'Half Day')),
      working_hours REAL NOT NULL DEFAULT 8,
      overtime_hours REAL NOT NULL DEFAULT 0,
      notes TEXT,
      created_by TEXT,
      updated_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(employee_id, date),
      FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE
    );
  `);

  // 4. Payroll table
  db.exec(`
    CREATE TABLE IF NOT EXISTS payroll (
      payroll_id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id TEXT NOT NULL,
      month INTEGER NOT NULL,
      year INTEGER NOT NULL,
      working_days REAL NOT NULL DEFAULT 26,
      present_days REAL NOT NULL DEFAULT 0,
      absent_days REAL NOT NULL DEFAULT 0,
      leave_days REAL NOT NULL DEFAULT 0,
      half_days REAL NOT NULL DEFAULT 0,
      overtime_hours REAL NOT NULL DEFAULT 0,
      extra_working_days REAL NOT NULL DEFAULT 0,
      per_day_salary REAL NOT NULL,
      basic_salary REAL NOT NULL,
      extra_day_salary REAL NOT NULL DEFAULT 0,
      overtime_salary REAL NOT NULL DEFAULT 0,
      bonus REAL NOT NULL DEFAULT 0,
      deductions REAL NOT NULL DEFAULT 0,
      net_salary REAL NOT NULL,
      status TEXT DEFAULT 'Finalized' CHECK(status IN ('Draft', 'Finalized', 'Paid')),
      generated_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(employee_id, month, year),
      FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE
    );
  `);

  // 5. Audit Log table
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id TEXT NOT NULL,
      admin_name TEXT NOT NULL,
      action TEXT NOT NULL,
      record_affected TEXT NOT NULL,
      previous_value TEXT,
      new_value TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 6. Settings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // 7. Sessions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      employee_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Initialize default store settings safely without overriding customized user settings
  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  insertSetting.run('company_name', 'H.M. RAJPAL GARMENT SHOP');
  insertSetting.run('company_address', 'Shop No. 12-14, Cloth Market, Main Bazaar');
  insertSetting.run('company_phone', '+91 98234 56789');
  insertSetting.run('company_email', 'hmrajapal11@gmail.com');
  insertSetting.run('standard_working_days', '26');
  insertSetting.run('standard_daily_hours', '8');
  insertSetting.run('leave_is_paid', 'true');
  insertSetting.run('currency_symbol', '₹');

  // Purge only expired sessions (safe housekeeping, never affects active sessions)
  try {
    db.exec("DELETE FROM sessions WHERE datetime(expires_at) < datetime('now');");
  } catch (sessErr) {
    console.warn('[Database] Expired sessions housekeeping skipped:', sessErr);
  }

  // Safe idempotent administrator check: only initialize if no Super Admin exists
  ensureInitialAdmin();
}

/**
 * Idempotently creates the initial Super Admin administrator if no Super Admin exists in the database.
 * Uses environment variables ADMIN_EMAIL and ADMIN_PASSWORD (or INITIAL_ADMIN_EMAIL / INITIAL_ADMIN_PASSWORD).
 * Never overwrites or resets existing administrators on reboot.
 */
export function ensureInitialAdmin() {
  try {
    const adminRow = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'SUPER_ADMIN'").get() as { count: number } | undefined;
    
    if (adminRow && adminRow.count > 0) {
      // Super admin exists; preserve existing administrator credentials safely
      return;
    }

    const email = process.env.ADMIN_EMAIL || process.env.INITIAL_ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD || process.env.INITIAL_ADMIN_PASSWORD;
    const username = process.env.ADMIN_USERNAME || process.env.INITIAL_ADMIN_USERNAME || 'owner_admin';

    if (email && password) {
      const passwordHash = hashPassword(password);
      db.prepare(`
        INSERT INTO users (username, email, password_hash, role, employee_id, status)
        VALUES (?, ?, ?, 'SUPER_ADMIN', null, 'active')
      `).run(username, email, passwordHash);

      logAudit(
        username,
        'System Setup',
        'SUPER_ADMIN_INITIALIZED',
        'users',
        '',
        `Initial Super Admin owner initialized from environment variables (${email})`
      );
      console.log(`[Database] Initial Super Admin account created: ${email}`);
    } else {
      console.log('[Database Notice] No Super Admin found in database. Configure ADMIN_EMAIL and ADMIN_PASSWORD in environment variables, or run "npm run setup:admin" to configure.');
    }
  } catch (err: any) {
    console.error('[Database Warning] ensureInitialAdmin check failed:', err?.message || err);
  }
}

// Optional helper for user testing if requested via Super Admin settings
export function seedWorkersUpTo(targetCount = 100) {
  const countRow = db.prepare('SELECT count(*) as count FROM employees').get() as { count: number };
  const currentCount = countRow ? countRow.count : 0;
  if (currentCount >= targetCount) {
    return currentCount;
  }

  console.log(`Seeding garment store workers from ${currentCount} up to ${targetCount}...`);

  const firstNames = [
    'Rajesh', 'Sunil', 'Manoj', 'Deepak', 'Sanjay', 'Anil', 'Vijay', 'Pooja', 'Ritu', 'Kavita',
    'Mohit', 'Dinesh', 'Ramesh', 'Suresh', 'Kiran', 'Neeraj', 'Vikas', 'Gaurav', 'Alok', 'Pankaj',
    'Jyoti', 'Meena', 'Sunita', 'Manju', 'Rekha', 'Rohit', 'Ashok', 'Kunal', 'Sachin', 'Naveen'
  ];

  const lastNames = [
    'Sharma', 'Verma', 'Gupta', 'Singh', 'Patel', 'Jain', 'Agarwal', 'Kumar', 'Mishra', 'Yadav',
    'Chauhan', 'Pandey', 'Saxena', 'Mehta', 'Bhatia', 'Khurana', 'Malhotra', 'Kapoor', 'Seth', 'Bansal'
  ];

  const deptRoles = [
    { dept: 'Sales', desig: 'Senior Sales Associate', salary: 800, ot: 150 },
    { dept: 'Sales', desig: 'Men\'s Wear Specialist', salary: 750, ot: 140 },
    { dept: 'Sales', desig: 'Women\'s Saree & Suits Associate', salary: 850, ot: 160 },
    { dept: 'Sales', desig: 'Kids & Casual Section Attendant', salary: 700, ot: 130 },
    { dept: 'Billing', desig: 'POS Billing Operator', salary: 900, ot: 170 },
    { dept: 'Cashier', desig: 'Counter Cashier', salary: 850, ot: 160 },
    { dept: 'Stock Management', desig: 'Godown & Inventory Supervisor', salary: 800, ot: 150 },
    { dept: 'Alteration & Tailoring', desig: 'Master Tailor', salary: 900, ot: 175 },
    { dept: 'Store Operations', desig: 'Floor Helper & Packaging Attendant', salary: 650, ot: 120 }
  ];

  const insertEmp = db.prepare(`
    INSERT OR IGNORE INTO employees (
      employee_id, name, phone, email, address, department, designation, 
      joining_date, per_day_salary, monthly_salary, overtime_rate, status, avatar_url
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
  `);

  const insertUser = db.prepare(`
    INSERT OR IGNORE INTO users (username, email, password_hash, role, employee_id, status)
    VALUES (?, ?, ?, 'EMPLOYEE', ?, 'active')
  `);

  const avatarPool = [
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150'
  ];

  for (let i = currentCount + 1; i <= targetCount; i++) {
    const empId = `EMP${String(i).padStart(3, '0')}`;
    const fn = firstNames[(i * 3 + 7) % firstNames.length];
    const ln = lastNames[(i * 7 + 11) % lastNames.length];
    const fullName = `${fn} ${ln}`;
    const conf = deptRoles[(i - 1) % deptRoles.length];
    const phone = `+91 98${String((i * 8831) % 89999 + 10000)} ${String((i * 4729) % 89999 + 10000).slice(0, 4)}`;
    const email = `emp${String(i).padStart(3, '0')}@rajpalgarments.com`;
    const address = `Cloth Market Staff Quarters, Unit ${10 + (i % 40)}`;
    const joinDate = '2024-01-15';
    const avatar = avatarPool[i % avatarPool.length];
    const monthly = conf.salary * 26;

    insertEmp.run(
      empId, fullName, phone, email, address, conf.dept, conf.desig,
      joinDate, conf.salary, monthly, conf.ot, avatar
    );

    const username = `worker${i}`;
    insertUser.run(username, email, hashPassword(`worker${i}123`), empId);
  }

  console.log(`Successfully added ${targetCount} staff members.`);
  return targetCount;
}

export function logAudit(adminId: string, adminName: string, action: string, recordAffected: string, previousValue: string = '', newValue: string = '') {
  try {
    const stmt = db.prepare(`
      INSERT INTO audit_logs (admin_id, admin_name, action, record_affected, previous_value, new_value, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `);
    stmt.run(adminId, adminName, action, recordAffected, previousValue, newValue);
  } catch (err) {
    console.error('Audit log failure:', err);
  }
}
