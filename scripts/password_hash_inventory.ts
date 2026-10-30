export interface PasswordHashInventory {
  totalUsers: number;
  modernScrypt: number;
  legacySha256: number;
  activeLegacySha256: number;
  other: number;
}

export function createPasswordHashInventory(): PasswordHashInventory {
  return {
    totalUsers: 0,
    modernScrypt: 0,
    legacySha256: 0,
    activeLegacySha256: 0,
    other: 0,
  };
}

export function addPasswordHashRecord(
  inventory: PasswordHashInventory,
  record: { password_hash: unknown; status: string }
): void {
  inventory.totalUsers++;
  if (
    typeof record.password_hash === 'string' &&
    /^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/i.test(record.password_hash)
  ) {
    inventory.modernScrypt++;
  } else if (
    typeof record.password_hash === 'string' &&
    /^[a-f0-9]{64}$/i.test(record.password_hash)
  ) {
    inventory.legacySha256++;
    if (record.status === 'active') {
      inventory.activeLegacySha256++;
    }
  } else {
    inventory.other++;
  }
}
