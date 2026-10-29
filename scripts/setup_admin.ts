import 'dotenv/config';
import mongoose from 'mongoose';
import { User, initDatabase, hashPassword, logAudit } from '../server/db.ts';

/**
 * CLI Administrator Setup & Credential Management Script (MongoDB)
 * 
 * Safely initializes the database schema before touching collections,
 * and restricts password reset operations to intentional, authorized actions.
 * 
 * Usage:
 *   npx tsx scripts/setup_admin.ts <email> <password> [username] [--reset]
 * 
 * Or configure via environment variables:
 *   ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_USERNAME, ALLOW_ADMIN_RESET
 */
async function runSetup() {
  // 1. Safely initialize database schema idempotently
  try {
    await initDatabase();
  } catch (initErr: any) {
    console.error('[FAILED] Could not initialize database safely:', initErr?.message || initErr);
    process.exit(1);
  }

  const rawArgs = process.argv.slice(2);
  const isResetRequested =
    rawArgs.includes('--reset') ||
    rawArgs.includes('-r') ||
    rawArgs.includes('--force') ||
    process.env.ALLOW_ADMIN_RESET === 'true';

  // Filter out flag arguments to extract positional values
  const positionalArgs = rawArgs.filter(arg => !arg.startsWith('-'));
  const email = (positionalArgs[0] || process.env.ADMIN_EMAIL || process.env.INITIAL_ADMIN_EMAIL || '').trim();
  const password = positionalArgs[1] || process.env.ADMIN_PASSWORD || process.env.INITIAL_ADMIN_PASSWORD || '';
  const username = (positionalArgs[2] || process.env.ADMIN_USERNAME || process.env.INITIAL_ADMIN_USERNAME || 'owner_admin').trim();

  if (!email || !password) {
    console.error('Error: Administrator email and password are required.');
    console.error('Usage: npm run setup:admin <email> <password> [username] [--reset]');
    console.error('Or set ADMIN_EMAIL and ADMIN_PASSWORD environment variables.');
    process.exit(1);
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    console.error('Error: Invalid email format.');
    process.exit(1);
  }

  // Validate password length
  if (password.length < 12) {
    console.error('Error: Password must be at least 12 characters long.');
    process.exit(1);
  }

  const passwordHash = hashPassword(password);
  const cleanEmail = email.toLowerCase().trim();
  const cleanUsername = username.toLowerCase().trim();

  try {
    const existing = await User.findOne({
      $or: [{ email: cleanEmail }, { username: cleanUsername }],
    });

    if (existing) {
      if (!isResetRequested) {
        console.log(`[NOTICE] Account with email "${email}" or username "${username}" already exists (ID: ${existing._id}, Current Role: ${existing.role}).`);
        console.log('To intentionally reset or update credentials for this administrator, pass the --reset flag:');
        console.log(`  npm run setup:admin ${email} <new_password> [username] --reset`);
        console.log('Or set environment variable ALLOW_ADMIN_RESET=true.');
        console.log('Existing credentials and records remain unchanged.');
        await mongoose.disconnect();
        process.exit(0);
      }

      existing.username = cleanUsername;
      existing.email = cleanEmail;
      existing.password_hash = passwordHash;
      existing.role = 'SUPER_ADMIN';
      existing.status = 'active';
      await existing.save();

      await logAudit(
        cleanUsername,
        'CLI Setup Tool',
        'SUPER_ADMIN_PASSWORD_RESET',
        'users',
        '',
        `Authorized administrator password reset for ${email} (ID: ${existing._id})`
      );
      console.log(`[SUCCESS] Authorized administrator credential reset completed for ${email} (ID: ${existing._id}).`);
    } else {
      const newUser = await User.create({
        username: cleanUsername,
        email: cleanEmail,
        password_hash: passwordHash,
        role: 'SUPER_ADMIN',
        employee_id: null,
        status: 'active',
        created_at: new Date(),
      });

      await logAudit(
        cleanUsername,
        'CLI Setup Tool',
        'SUPER_ADMIN_CREATED',
        'users',
        '',
        `Initial Super Admin created for ${email}`
      );
      console.log(`[SUCCESS] New Super Admin account created successfully for ${email} (ID: ${newUser._id}).`);
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (err: any) {
    console.error('[FAILED] Could not setup administrator:', err?.message || err);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
}

runSetup();
