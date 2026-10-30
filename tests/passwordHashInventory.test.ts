import { describe, expect, it } from 'vitest';
import {
  addPasswordHashRecord,
  createPasswordHashInventory,
} from '../scripts/password_hash_inventory.ts';

describe('legacy password hash inventory', () => {
  it('counts modern, legacy SHA-256, and unrecognized hashes without exposing them', () => {
    const inventory = createPasswordHashInventory();

    addPasswordHashRecord(inventory, {
      password_hash: `scrypt$${'a'.repeat(32)}$${'b'.repeat(128)}`,
      status: 'active',
    });
    addPasswordHashRecord(inventory, {
      password_hash: 'c'.repeat(64),
      status: 'active',
    });
    addPasswordHashRecord(inventory, {
      password_hash: 'not-a-recognized-hash',
      status: 'inactive',
    });

    expect(inventory).toEqual({
      totalUsers: 3,
      modernScrypt: 1,
      legacySha256: 1,
      activeLegacySha256: 1,
      other: 1,
    });
    expect(JSON.stringify(inventory)).not.toContain('cccc');
  });
});
