import 'dotenv/config';
import { db, hashPassword, logAudit } from '../server/db.ts';

/**
 * CLI Administrator Setup Script
 * Usage:
 *   npx tsx scripts/setup_admin.ts [email] [password] [username]
 * Or configure via environment variables:
 *   ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_USERNAME
 */
async function runSetup() {
  const args = process.argv.slice(2);
  const email = (args[0] || process.env.ADMIN_EMAIL || process.env.INITIAL_ADMIN_EMAIL || '').trim();
  const password = (args[1] || process.env.ADMIN_PASSWORD || process.env.INITIAL_ADMIN_PASSWORD || '').trim();
  const username = (args[2] || process.env.ADMIN_USERNAME || process.env.INITIAL_ADMIN_USERNAME || 'owner_admin').trim();

  if (!email || !password) {
    console.error('Error: Administrator email and password are required.');
    console.error('Usage: npm run setup:admin <email> <password> [username]');
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
  if (password.length < 8) {
    console.error('Error: Password must be at least 8 characters long.');
    process.exit(1);
  }

  const passwordHash = hashPassword(password);

  try {
    const existing = db.prepare('SELECT id, username, email, role FROM users WHERE LOWER(email) = LOWER(?) OR LOWER(username) = LOWER(?)').get(email, username) as any;

    if (existing) {
      db.prepare(`
        UPDATE users 
        SET username = ?, email = ?, password_hash = ?, role = 'SUPER_ADMIN', status = 'active'
        WHERE id = ?
      `).run(username, email, passwordHash, existing.id);

      logAudit(username, 'CLI Setup Tool', 'SUPER_ADMIN_PASSWORD_UPDATED', 'users', '', `Updated Super Admin credentials for ${email}`);
      console.log(`[SUCCESS] Super Admin credentials updated for ${email} (ID: ${existing.id}).`);
    } else {
      const result = db.prepare(`
        INSERT INTO users (username, email, password_hash, role, employee_id, status)
        VALUES (?, ?, ?, 'SUPER_ADMIN', null, 'active')
      `).run(username, email, passwordHash);

      logAudit(username, 'CLI Setup Tool', 'SUPER_ADMIN_CREATED', 'users', '', `Created initial Super Admin for ${email}`);
      console.log(`[SUCCESS] New Super Admin created successfully for ${email}.`);
    }

    process.exit(0);
  } catch (err: any) {
    console.error('[FAILED] Could not setup administrator:', err?.message || err);
    process.exit(1);
  }
}

runSetup();
