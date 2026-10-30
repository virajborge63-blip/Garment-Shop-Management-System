import mongoose from 'mongoose';
import { User } from '../server/models/User.ts';
import {
  addPasswordHashRecord,
  createPasswordHashInventory,
} from './password_hash_inventory.ts';

async function reportLegacyPasswordHashes(): Promise<void> {
  const uri = process.env.AUDIT_MONGODB_URI;
  if (!uri || process.env.AUDIT_NON_PRODUCTION !== 'true') {
    console.error(
      'Set AUDIT_MONGODB_URI to a read-only, non-production database copy and AUDIT_NON_PRODUCTION=true.'
    );
    process.exitCode = 1;
    return;
  }

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    const inventory = createPasswordHashInventory();
    const users = User.find()
      .select({ _id: 0, password_hash: 1, status: 1 })
      .lean()
      .cursor({ batchSize: 500 });

    for await (const user of users) {
      addPasswordHashRecord(inventory, user);
    }

    console.log('Read-only legacy password-hash inventory (no identifiers or hashes emitted):');
    console.log(JSON.stringify(inventory, null, 2));
  } finally {
    await mongoose.disconnect();
  }
}

reportLegacyPasswordHashes().catch((error: unknown) => {
  const errorName = error instanceof Error ? error.name : 'UnknownError';
  console.error(`Password-hash inventory failed (${errorName}); no connection details or credential data were logged.`);
  process.exitCode = 1;
});
