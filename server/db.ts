import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';

const dbPath = path.resolve(process.cwd(), 'erp_management.db');
export const db = new DatabaseSync(dbPath);

// Helper to hash passwords securely with salt
export function hashPassword(password: string): string {
  const salt = 'erp_salt_2026_secure';
  return crypto.createHash('sha256').update(password + salt).digest('hex');
}

export function initDatabase() {
  // Enable foreign keys
  db.exec('PRAGMA foreign_keys = ON;');

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

  // Configure store production settings
  const insertSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  insertSetting.run('company_name', 'H.M. RAJPAL GARMENT SHOP');
  insertSetting.run('company_address', 'Shop No. 12-14, Cloth Market, Main Bazaar');
  insertSetting.run('company_phone', '+91 98234 56789');
  insertSetting.run('company_email', 'hmrajapal11@gmail.com');
  insertSetting.run('standard_working_days', '26');
  insertSetting.run('standard_daily_hours', '8');
  insertSetting.run('leave_is_paid', 'true');
  insertSetting.run('currency_symbol', '₹');

  // Clear all default sample data so owner receives a clean slate system
  wipeDefaultDataAndEnsureOwner();
}

/**
 * Removes all default dummy employees, attendance logs, payrolls, and test users.
 * Establishes the real Super Admin owner account: hmrajapal11@gmail.com / RajpalHM@89565
 */
export function wipeDefaultDataAndEnsureOwner() {
  console.log('Ensuring clean production state with Super Admin Owner hmrajapal11@gmail.com...');

  // Delete all dummy employee records and cascade-linked attendance and payroll
  db.exec('PRAGMA foreign_keys = OFF;');
  db.exec('DELETE FROM attendance;');
  db.exec('DELETE FROM payroll;');
  db.exec('DELETE FROM employees;');
  db.exec('DELETE FROM sessions;');
  
  // Remove dummy users (keep only if any real users exist, or clear all)
  db.exec("DELETE FROM users WHERE email != 'hmrajapal11@gmail.com' AND username != 'hmrajpal';");
  db.exec('DELETE FROM audit_logs;');
  db.exec('PRAGMA foreign_keys = ON;');

  // Insert or update the Super Admin Owner
  const ownerPassHash = hashPassword('RajpalHM@89565');
  const existingOwner = db.prepare(`
    SELECT id FROM users 
    WHERE email = 'hmrajapal11@gmail.com' OR username = 'hmrajpal'
  `).get() as any;

  if (existingOwner) {
    db.prepare(`
      UPDATE users 
      SET username = 'hmrajpal', email = 'hmrajapal11@gmail.com', password_hash = ?, 
          role = 'SUPER_ADMIN', employee_id = null, status = 'active'
      WHERE id = ?
    `).run(ownerPassHash, existingOwner.id);
  } else {
    db.prepare(`
      INSERT INTO users (username, email, password_hash, role, employee_id, status)
      VALUES ('hmrajpal', 'hmrajapal11@gmail.com', ?, 'SUPER_ADMIN', null, 'active')
    `).run(ownerPassHash);
  }

  // Initial audit log
  db.prepare(`
    INSERT INTO audit_logs (admin_id, admin_name, action, record_affected, previous_value, new_value, timestamp)
    VALUES ('hmrajpal', 'H.M. Rajpal (Owner)', 'SYSTEM_INITIALIZED', 'H.M. RAJPAL GARMENT SHOP Database', '', 'Production clean slate ready for Store Owner (hmrajapal11@gmail.com)', datetime('now'))
  `).run();

  console.log('Production ready: Super Admin Owner created (hmrajapal11@gmail.com). Dummy data wiped.');
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
