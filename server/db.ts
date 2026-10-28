import mongoose from 'mongoose';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import { MongoMemoryServer } from 'mongodb-memory-server';

dotenv.config();

// Export models
export * from './models/index.ts';
import {
  User,
  Employee,
  Attendance,
  Payroll,
  AuditLog,
  Setting,
  Session,
  Category,
  Product,
  Customer,
  Supplier,
  Sale,
} from './models/index.ts';

let mongoMemoryServerInstance: MongoMemoryServer | null = null;
let isConnected = false;

/**
 * Connect to MongoDB using Mongoose.
 * Supports:
 *  1. Remote/Production MongoDB Atlas URI via MONGODB_URI
 *  2. Local running MongoDB instance (e.g., mongodb://127.0.0.1:27017/garment_shop)
 *  3. In-memory real MongoDB server (MongoMemoryServer) when no external URI is provided,
 *     guaranteeing 100% operational functionality out of the box in any environment.
 */
export async function connectDB(): Promise<typeof mongoose> {
  if (isConnected && mongoose.connection.readyState === 1) {
    return mongoose;
  }

  const configuredUri = process.env.MONGODB_URI;

  if (configuredUri) {
    try {
      console.log(`[Database] Connecting to configured MongoDB instance...`);
      await mongoose.connect(configuredUri, {
        serverSelectionTimeoutMS: 5000,
      });
      isConnected = true;
      console.log(`[Database] MongoDB successfully connected to: ${configuredUri.split('@').pop()}`);
      return mongoose;
    } catch (connErr: any) {
      console.warn(`[Database Warning] Could not connect to configured MONGODB_URI:`, connErr?.message || connErr);
      console.log(`[Database] Falling back to automated in-memory MongoDB engine...`);
    }
  }

  // Fallback to MongoMemoryServer for standalone/local zero-config execution
  if (!mongoMemoryServerInstance) {
    console.log(`[Database] Initializing automated MongoDB engine (MongoMemoryServer)...`);
    mongoMemoryServerInstance = await MongoMemoryServer.create();
  }

  const memoryUri = mongoMemoryServerInstance.getUri();
  console.log(`[Database] Connecting to local MongoDB engine at: ${memoryUri}`);
  await mongoose.connect(memoryUri);
  isConnected = true;
  console.log(`[Database] Local MongoDB connected successfully.`);
  return mongoose;
}

/**
 * Constant-time string equality helper to prevent timing attacks.
 */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Modern cryptographically secure password hashing using Node's native scrypt.
 * Output format: scrypt$<saltHex>$<derivedKeyHex>
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex');
  return `scrypt$${salt}$${derivedKey}`;
}

/**
 * Verifies a password against a stored hash.
 * Supports:
 *  1. Modern scrypt format: scrypt$<salt>$<derivedKey>
 *  2. Salted SHA-256 (using SESSION_SECRET or fallback salt)
 *  3. Plain unsalted SHA-256 (from legacy initial repository)
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  if (!password || !storedHash) {
    return false;
  }

  try {
    // 1. Modern scrypt format: scrypt$<salt>$<derivedKeyHex>
    if (storedHash.startsWith('scrypt$')) {
      const parts = storedHash.split('$');
      if (parts.length !== 3) {
        return false;
      }
      const [, salt, expectedKeyHex] = parts;
      const derivedKey = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
      const expectedKey = Buffer.from(expectedKeyHex, 'hex');
      if (derivedKey.length !== expectedKey.length) {
        return false;
      }
      return crypto.timingSafeEqual(derivedKey, expectedKey);
    }

    // 2. Legacy SHA-256 with environment secret / salt
    const secret = process.env.SESSION_SECRET || 'erp_salt_2026_secure';
    const legacySaltedHash = crypto.createHash('sha256').update(password + secret).digest('hex');
    if (safeEqual(legacySaltedHash, storedHash)) {
      return true;
    }

    // 3. Legacy plain SHA-256 (from original template)
    const plainSha256 = crypto.createHash('sha256').update(password).digest('hex');
    if (safeEqual(plainSha256, storedHash)) {
      return true;
    }
  } catch (err) {
    console.error('[Auth Error] Password verification failed with error:', err);
    return false;
  }

  return false;
}

/**
 * Initializes database schema and default records idempotently in MongoDB.
 * Never deletes employees, attendance, payroll, sessions, or users.
 */
export async function initDatabase(): Promise<void> {
  await connectDB();

  // 1. Default Store Settings
  const defaultSettings: Record<string, string> = {
    company_name: 'H.M. RAJPAL GARMENT SHOP',
    company_address: 'Shop No. 12-14, Cloth Market, Main Bazaar',
    company_phone: '+91 98234 56789',
    company_email: 'hmrajpal11@gmail.com',
    standard_working_days: '26',
    standard_daily_hours: '8',
    leave_is_paid: 'true',
    currency_symbol: '₹',
  };

  for (const [key, value] of Object.entries(defaultSettings)) {
    const existing = await Setting.findOne({ key });
    if (!existing) {
      await Setting.create({ key, value });
    }
  }

  // 2. Initial Garment Categories
  const defaultCategories = [
    { name: "Men's Wear", code: 'MEN', description: 'Shirts, Trousers, Jeans & Formal wear' },
    { name: "Women's Ethnic & Sarees", code: 'WOMEN_ETHNIC', description: 'Designer Sarees, Salwar Suits, Lehengas' },
    { name: "Women's Western & Casual", code: 'WOMEN_WEST', description: 'Tops, Kurtis, Dresses & Denim' },
    { name: "Kids' Wear", code: 'KIDS', description: 'Boys & Girls festive and casual wear' },
    { name: 'Suitings & Shirtings Fabric', code: 'FABRIC', description: 'Premium unstitched cloth materials' },
    { name: 'Traditional & Festive Wear', code: 'TRADITIONAL', description: 'Kurta Pyjama, Sherwani & Wedding collections' },
  ];

  for (const cat of defaultCategories) {
    const existingCat = await Category.findOne({ code: cat.code });
    if (!existingCat) {
      await Category.create(cat);
    }
  }

  // 3. Initial Sample Products & Inventory
  const productCount = await Product.countDocuments();
  if (productCount === 0) {
    const sampleProducts = [
      {
        name: 'Royal Blue Silk Banarasi Saree',
        sku: 'SAR-SILK-001',
        category: "Women's Ethnic & Sarees",
        size: 'Free Size',
        color: 'Royal Blue & Gold Zari',
        fabric: 'Pure Banarasi Silk',
        cost_price: 2400,
        selling_price: 4999,
        stock_quantity: 24,
        min_stock_alert: 5,
        barcode: '890123456001',
        status: 'active',
      },
      {
        name: 'Raymond Premium Cotton Formal Shirt',
        sku: 'SHIRT-RAY-002',
        category: "Men's Wear",
        size: '40 (L)',
        color: 'Sky Blue Crisp',
        fabric: '100% Giza Cotton',
        cost_price: 750,
        selling_price: 1599,
        stock_quantity: 45,
        min_stock_alert: 8,
        barcode: '890123456002',
        status: 'active',
      },
      {
        name: 'Designer Anarkali Kurti Set with Dupatta',
        sku: 'KURTI-ANAR-003',
        category: "Women's Ethnic & Sarees",
        size: '38 (M)',
        color: 'Maroon & Gold',
        fabric: 'Georgette with Embroidery',
        cost_price: 1200,
        selling_price: 2499,
        stock_quantity: 18,
        min_stock_alert: 4,
        barcode: '890123456003',
        status: 'active',
      },
      {
        name: 'Slim Fit Stretch Denim Jeans',
        sku: 'JEAN-DEN-004',
        category: "Men's Wear",
        size: '32',
        color: 'Dark Indigo Blue',
        fabric: 'Stretch Cotton Denim',
        cost_price: 850,
        selling_price: 1899,
        stock_quantity: 35,
        min_stock_alert: 6,
        barcode: '890123456004',
        status: 'active',
      },
      {
        name: 'Kids Festive Kurta Pajama Jacket Set',
        sku: 'KIDS-FEST-005',
        category: "Kids' Wear",
        size: 'Age 6-8 Yrs',
        color: 'Mustard Yellow & White',
        fabric: 'Art Silk Blend',
        cost_price: 600,
        selling_price: 1299,
        stock_quantity: 20,
        min_stock_alert: 5,
        barcode: '890123456005',
        status: 'active',
      },
      {
        name: 'Italian Wool Blend Suit Fabric (3 Meters)',
        sku: 'FAB-SUIT-006',
        category: 'Suitings & Shirtings Fabric',
        size: '3.0 Meters',
        color: 'Charcoal Grey Houndstooth',
        fabric: 'Terry Wool Blend',
        cost_price: 1800,
        selling_price: 3600,
        stock_quantity: 15,
        min_stock_alert: 3,
        barcode: '890123456006',
        status: 'active',
      },
    ];

    await Product.insertMany(sampleProducts);
    console.log(`[Database] Seeded ${sampleProducts.length} initial garment store inventory products.`);
  }

  // 4. Initial Sample Suppliers & Customers
  const supplierCount = await Supplier.countDocuments();
  if (supplierCount === 0) {
    await Supplier.create({
      name: 'Rameshwaram Mills Ltd',
      company_name: 'Surat Textile Hub',
      phone: '+91 98221 44556',
      email: 'sales@surattextilehub.com',
      address: 'Ring Road Textile Market, Surat, Gujarat',
      gst_number: '24AAAAA0000A1Z5',
    });
  }

  const customerCount = await Customer.countDocuments();
  if (customerCount === 0) {
    await Customer.create({
      name: 'Rajesh Khanna',
      phone: '+91 98989 12345',
      email: 'rajesh.k@gmail.com',
      address: 'Main Market Society, Flat 4B',
      total_purchases: 8598,
    });
  }

  // 5. Clean up expired sessions safely without touching active sessions
  try {
    await Session.deleteMany({ expires_at: { $lt: new Date() } });
  } catch (sessErr) {
    console.warn('[Database] Expired sessions housekeeping skipped:', sessErr);
  }

  // 6. Safe idempotent administrator check: only initialize if no Super Admin exists
  await ensureInitialAdmin();
}

/**
 * Idempotently creates the initial Super Admin administrator if no Super Admin exists in MongoDB.
 * Never overwrites or resets existing administrators.
 */
export async function ensureInitialAdmin(): Promise<void> {
  try {
    const existingAdmin = await User.findOne({ role: 'SUPER_ADMIN' });

    if (existingAdmin) {
      // Super admin exists; preserve existing administrator credentials safely
      return;
    }

    const email = process.env.ADMIN_EMAIL || process.env.INITIAL_ADMIN_EMAIL || 'hmrajpal11@gmail.com';
    const password = process.env.ADMIN_PASSWORD || process.env.INITIAL_ADMIN_PASSWORD || 'HMRajpal@89565';
    const username = process.env.ADMIN_USERNAME || process.env.INITIAL_ADMIN_USERNAME || 'hmrajpal';

    const passwordHash = hashPassword(password);
    await User.create({
      username,
      email: email.toLowerCase().trim(),
      password_hash: passwordHash,
      role: 'SUPER_ADMIN',
      employee_id: null,
      status: 'active',
      created_at: new Date(),
    });

    await logAudit(
      username,
      'System Setup',
      'SUPER_ADMIN_INITIALIZED',
      'users',
      '',
      `Initial Super Admin owner initialized from configuration (${email})`
    );
    console.log(`[Database] Initial Super Admin account created: ${email}`);
  } catch (err: any) {
    console.error('[Database Warning] ensureInitialAdmin check failed:', err?.message || err);
  }
}

/**
 * Seeds employees up to targetCount in MongoDB.
 */
export async function seedWorkersUpTo(targetCount = 100): Promise<number> {
  const currentCount = await Employee.countDocuments();
  if (currentCount >= targetCount) {
    return currentCount;
  }

  console.log(`Seeding garment store workers from ${currentCount} up to ${targetCount} in MongoDB...`);

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

  const avatarPool = [
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150'
  ];

  const employeesToInsert = [];
  const usersToInsert = [];

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

    employeesToInsert.push({
      employee_id: empId,
      name: fullName,
      phone,
      email,
      address,
      department: conf.dept,
      designation: conf.desig,
      joining_date: joinDate,
      per_day_salary: conf.salary,
      monthly_salary: monthly,
      overtime_rate: conf.ot,
      status: 'active',
      avatar_url: avatar,
      created_at: new Date(),
    });

    const username = `worker${i}`;
    usersToInsert.push({
      username,
      email,
      password_hash: hashPassword(`worker${i}123`),
      role: 'EMPLOYEE',
      employee_id: empId,
      status: 'active',
      created_at: new Date(),
    });
  }

  if (employeesToInsert.length > 0) {
    await Employee.insertMany(employeesToInsert);
    await User.insertMany(usersToInsert);
  }

  console.log(`Successfully added ${targetCount} staff members to MongoDB.`);
  return targetCount;
}

/**
 * Creates an audit log record in MongoDB.
 */
export async function logAudit(
  adminId: string,
  adminName: string,
  action: string,
  recordAffected: string,
  previousValue: string = '',
  newValue: string = ''
): Promise<void> {
  try {
    await AuditLog.create({
      admin_id: adminId,
      admin_name: adminName,
      action,
      record_affected: recordAffected,
      previous_value: previousValue,
      new_value: newValue,
      timestamp: new Date(),
    });
  } catch (err) {
    console.error('Audit log failure:', err);
  }
}
