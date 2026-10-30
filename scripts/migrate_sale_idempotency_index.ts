import mongoose from 'mongoose';
import { Sale } from '../server/models/Sale.ts';

const partialIndexOptions = {
  unique: true,
  partialFilterExpression: { idempotency_key: { $type: 'string' } },
  name: 'idempotency_key_string_unique',
};

interface IndexDefinition {
  key: Record<string, unknown>;
  name?: string;
  unique?: boolean;
  sparse?: boolean;
  partialFilterExpression?: Record<string, unknown>;
}

async function migrateSaleIdempotencyIndex(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('Set MONGODB_URI to the target database URI.');
  }

  const applyChanges = process.env.CONFIRM_SALE_IDEMPOTENCY_INDEX_MIGRATION === 'true';
  mongoose.set('autoIndex', false);
  await mongoose.connect(uri, { autoIndex: false, serverSelectionTimeoutMS: 10000 });

  try {
    const database = mongoose.connection.db;
    if (!database) {
      throw new Error('MongoDB database connection is unavailable.');
    }

    const collectionName = Sale.collection.name;
    const collectionExists = await database
      .listCollections({ name: collectionName }, { nameOnly: true })
      .hasNext();

    const indexes: IndexDefinition[] = collectionExists
      ? await Sale.collection.indexes()
      : [];
    const duplicateCounts = collectionExists
      ? await Sale.collection
        .aggregate([
          { $match: { idempotency_key: { $type: 'string' } } },
          { $group: { _id: '$idempotency_key', count: { $sum: 1 } } },
          { $match: { count: { $gt: 1 } } },
          { $count: 'duplicateKeyCount' },
        ])
        .toArray()
      : [];
    const duplicateKeyCount = duplicateCounts[0]?.duplicateKeyCount ?? 0;

    console.log(`Sale collection: ${collectionName}${collectionExists ? '' : ' (not created)'}`);
    console.log('Existing indexes:');
    console.log(JSON.stringify(indexes, null, 2));
    console.log(`Duplicate string idempotency keys: ${duplicateKeyCount}`);

    if (!applyChanges) {
      console.log(
        'Dry run only; no changes made. Set CONFIRM_SALE_IDEMPOTENCY_INDEX_MIGRATION=true to apply the migration.'
      );
      return;
    }

    if (duplicateKeyCount > 0) {
      throw new Error('Duplicate string idempotency keys exist; no index changes were made.');
    }

    const idempotencyIndexes = indexes.filter(
      (index) =>
        index.key.idempotency_key === 1 &&
        Object.keys(index.key).length === 1 &&
        typeof index.name === 'string'
    );
    const existingPartialIndex = idempotencyIndexes.find(
      (index) =>
        index.unique === true &&
        (index.partialFilterExpression as { idempotency_key?: { $type?: string } } | undefined)
          ?.idempotency_key?.$type === 'string'
    );

    if (existingPartialIndex) {
      console.log('The partial unique Sale idempotency index is already in place.');
      return;
    }

    if (!collectionExists) {
      await Sale.collection.createIndex({ idempotency_key: 1 }, partialIndexOptions);
      console.log('Created the partial unique Sale idempotency index.');
      return;
    }

    for (const index of idempotencyIndexes) {
      await Sale.collection.dropIndex(index.name!);
    }

    try {
      await Sale.collection.createIndex({ idempotency_key: 1 }, partialIndexOptions);
    } catch (error) {
      const previousUniqueIndex = idempotencyIndexes.find((index) => index.unique === true);
      if (previousUniqueIndex) {
        await Sale.collection.createIndex(
          { idempotency_key: 1 },
          {
            unique: true,
            ...(previousUniqueIndex.sparse === true ? { sparse: true } : {}),
            name: previousUniqueIndex.name,
          }
        );
      }
      throw error;
    }

    console.log('Migrated the Sale idempotency index to a string-only partial unique index.');
  } finally {
    await mongoose.disconnect();
  }
}

migrateSaleIdempotencyIndex().catch((error: unknown) => {
  const errorName = error instanceof Error ? error.name : 'UnknownError';
  const message = error instanceof Error
    ? error.message
      .replace(/mongodb(?:\+srv)?:\/\/[^\s"'<>]+/gi, '[MongoDB URI]')
      .replace(/[\r\n\t]+/g, ' ')
      .slice(0, 300)
    : 'Unknown migration failure.';
  console.error(`Sale idempotency index migration failed (${errorName}): ${message}`);
  process.exitCode = 1;
});
