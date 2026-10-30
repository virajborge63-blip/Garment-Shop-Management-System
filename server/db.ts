import mongoose from 'mongoose';
import type { ClientSession } from 'mongoose';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { isProduction } from './environment.ts';

dotenv.config();

// Export models
export * from './models/index.ts';
import {
  User,
  AuditLog,
  Setting,
  Session,
  Category,
} from './models/index.ts';

let mongoMemoryServerInstance: MongoMemoryServer | null = null;
let isConnected = false;

function getMongoConnectionDiagnostics(error: unknown): Array<{ name: string; code?: string | number }> {
  const diagnostics: Array<{ name: string; code?: string | number }> = [];
  const pending: unknown[] = [error];
  const seen = new Set<object>();

  while (pending.length > 0 && diagnostics.length < 5) {
    const current = pending.shift();
    if (!current || typeof current !== 'object' || seen.has(current)) {
      continue;
    }

    seen.add(current);
    const value = current as {
      name?: unknown;
      code?: unknown;
      cause?: unknown;
      errors?: unknown;
      reason?: unknown;
      error?: unknown;
      servers?: unknown;
    };
    const diagnostic: { name: string; code?: string | number } = {
      name: typeof value.name === 'string' && /^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(value.name)
        ? value.name
        : 'MongoConnectionError',
    };
    if (
      typeof value.code === 'number' ||
      (typeof value.code === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(value.code))
    ) {
      diagnostic.code = value.code;
    }
    diagnostics.push(diagnostic);

    if (value.cause) {
      pending.push(value.cause);
    }
    if (value.reason) {
      pending.push(value.reason);
    }
    if (value.error) {
      pending.push(value.error);
    }
    if (Array.isArray(value.errors)) {
      pending.push(...value.errors);
    }
    if (value.servers instanceof Map) {
      for (const server of value.servers.values()) {
        if (server && typeof server === 'object' && 'error' in server) {
          pending.push(server.error);
        }
      }
    }
  }

  return diagnostics;
}

/**
 * Connect to MongoDB using Mongoose.
 * Supports:
 *  1. Remote/Production MongoDB Atlas URI via MONGODB_URI
 *  2. Local running MongoDB instance (e.g., mongodb://127.0.0.1:27017/garment_shop)
 *  3. In-memory MongoDB is available only for local development without a configured URI.
 */
export async function connectDB(): Promise<typeof mongoose> {
  if (isConnected && mongoose.connection.readyState === 1) {
    return mongoose;
  }

  const configuredUri = process.env.MONGODB_URI;
  const production = isProduction();

  if (production && !configuredUri) {
    throw new Error('MONGODB_URI must be configured in production; in-memory storage is not persistent.');
  }
  if (
    production &&
    (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)
  ) {
    throw new Error('SESSION_SECRET must be configured with at least 32 characters in production.');
  }

  const useMemoryFallback = !production;

  if (configuredUri) {
    try {
      console.log('[Database] Connecting to configured MongoDB instance...');
      await mongoose.connect(configuredUri, {
        serverSelectionTimeoutMS: 10000,
      });
      isConnected = true;
      console.log('[Database] MongoDB connection established.');
      return mongoose;
    } catch (connectionError) {
      if (production) {
        console.error(
          '[Database] Could not connect to the configured MongoDB instance.',
          JSON.stringify(getMongoConnectionDiagnostics(connectionError))
        );
        throw new Error('MongoDB connection failed. Check MONGODB_URI, network access, and database availability.');
      }

      console.warn(
        '[Database] Configured MongoDB is unavailable in development. Falling back to a local in-memory MongoDB instance.'
      );
      await mongoose.disconnect().catch(() => undefined);
      // Fall through to the in-memory development fallback below.
    }
  }

  // Use in-memory MongoDB only for development when no persistent database is available.
  if (!mongoMemoryServerInstance) {
    console.log('[Database] Initializing automated MongoDB engine (MongoMemoryServer)...');
    mongoMemoryServerInstance = await MongoMemoryServer.create();
  }

  if (!useMemoryFallback && !configuredUri) {
    throw new Error('MONGODB_URI must be configured in production; in-memory storage is not persistent.');
  }

  const memoryUri = mongoMemoryServerInstance.getUri();
  console.log(`[Database] Connecting to local MongoDB engine at: ${memoryUri}`);
  await mongoose.connect(memoryUri);
  isConnected = true;
  console.log('[Database] Local MongoDB connected successfully.');
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

  // Clean up expired sessions without touching active sessions or business records.
  try {
    await Session.deleteMany({ expires_at: { $lt: new Date() } });
  } catch (sessErr) {
    console.warn('[Database] Expired sessions housekeeping skipped:', sessErr);
  }

  // Create an initial owner only when explicit credentials are provided.
  await ensureInitialAdmin();
}

/**
 * Idempotently creates the initial Super Admin administrator if no Super Admin exists in MongoDB.
 * Never overwrites or resets existing administrators.
 */
export async function ensureInitialAdmin(): Promise<void> {
  const existingAdmin = await User.findOne({ role: 'SUPER_ADMIN' });
  if (existingAdmin) {
    return;
  }

  const email = (process.env.ADMIN_EMAIL || process.env.INITIAL_ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || process.env.INITIAL_ADMIN_PASSWORD || '';
  const username = (process.env.ADMIN_USERNAME || process.env.INITIAL_ADMIN_USERNAME || '').trim();

  if (!email || !password || !username) {
    console.warn('[Database] No Super Admin exists. Configure ADMIN_EMAIL, ADMIN_PASSWORD, and ADMIN_USERNAME or run npm run setup:admin.');
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('ADMIN_EMAIL must be a valid email address when creating the initial Super Admin.');
  }
  if (username.length < 3 || username.length > 50) {
    throw new Error('ADMIN_USERNAME must be between 3 and 50 characters when creating the initial Super Admin.');
  }
  if (password.length < 12) {
    throw new Error('ADMIN_PASSWORD must be at least 12 characters when creating the initial Super Admin.');
  }

  const existingUser = await User.findOne({ $or: [{ email }, { username }] });
  if (existingUser) {
    console.warn('[Database] Initial Super Admin was not created because the configured email or username already belongs to an account. Use the authorized setup command to manage it.');
    return;
  }

  const initialAdmin = new User({
    username,
    email,
    password_hash: hashPassword(password),
    role: 'SUPER_ADMIN',
    employee_id: null,
    status: 'active',
    created_at: new Date(),
  });
  const session = await User.startSession();
  try {
    await session.withTransaction(async () => {
      await initialAdmin.save({ session });
      await logAuditStrict(
        username,
        'System Setup',
        'SUPER_ADMIN_INITIALIZED',
        `User #${initialAdmin._id.toString()}`,
        session,
        '',
        'Initial Super Admin owner initialized from explicit environment configuration'
      );
    });
  } finally {
    await session.endSession();
  }
  console.log('[Database] Initial Super Admin account created from explicit environment configuration.');
}

/**
 * Creates an audit log record in MongoDB.
 */
function createAuditRecord(
  adminId: string,
  adminName: string,
  action: string,
  recordAffected: string,
  previousValue: string = '',
  newValue: string = ''
): {
  admin_id: string;
  admin_name: string;
  action: string;
  record_affected: string;
  previous_value: string;
  new_value: string;
  timestamp: Date;
} {
  return {
    admin_id: adminId,
    admin_name: adminName,
    action,
    record_affected: recordAffected,
    previous_value: previousValue,
    new_value: newValue,
    timestamp: new Date(),
  };
}

function logAuditWriteFailure(action: string, entityId: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`AUDIT_WRITE_FAILED ${JSON.stringify({ action, entityId, error: message })}`);
}

export async function logAuditStrict(
  adminId: string,
  adminName: string,
  action: string,
  recordAffected: string,
  session: ClientSession,
  previousValue: string = '',
  newValue: string = ''
): Promise<void> {
  try {
    await AuditLog.create([createAuditRecord(
      adminId,
      adminName,
      action,
      recordAffected,
      previousValue,
      newValue
    )], { session });
  } catch (error) {
    logAuditWriteFailure(action, recordAffected, error);
    throw error;
  }
}

export async function logAuditBestEffort(
  adminId: string,
  adminName: string,
  action: string,
  recordAffected: string,
  previousValue: string = '',
  newValue: string = ''
): Promise<void> {
  try {
    await AuditLog.create(createAuditRecord(
      adminId,
      adminName,
      action,
      recordAffected,
      previousValue,
      newValue
    ));
  } catch (error) {
    logAuditWriteFailure(action, recordAffected, error);
  }
}
