import { eq } from 'drizzle-orm';
import type { drizzle } from 'drizzle-orm/neon-http';
import * as schema from '../../db/schema';

const ACCOUNTS_DATA = [
  {
    id: 'account-1',
    name: 'Taxable Account',
    type: 'TAXABLE',
    accountNumber: 'TX-001-2024',
  },
  {
    id: 'account-2',
    name: 'Roth IRA',
    type: 'TAX_EXEMPT',
    accountNumber: 'ROTH-002-2024',
  },
  {
    id: 'account-3',
    name: 'Traditional 401(k)',
    type: 'TAX_DEFERRED',
    accountNumber: '401K-003-2024',
  },
];

// Function to check if accountNumber column exists (simplified for Neon HTTP)
async function migrateAccountTable(_db: ReturnType<typeof drizzle>) {
  // With Neon HTTP, we can't run raw SQL queries
  // The accountNumber column should already be defined in the schema
  console.log('✅ Using schema-defined accountNumber column');
}

export async function seedAccounts(db: ReturnType<typeof drizzle>, userId?: string) {
  console.log('🏦 Seeding accounts...');

  // First, ensure the account table has the accountNumber column
  await migrateAccountTable(db);

  const now = Math.floor(Date.now() / 1000);

  // Use provided userId or fallback to demo user logic
  const targetUserId = userId;

  if (!targetUserId) {
    throw new Error('User ID is required for seeding accounts');
  }

  console.log(`✅ Using provided user ID: ${targetUserId}`);

  // Clear existing accounts for this user and any accounts with the same IDs we're about to insert
  const { or, inArray } = await import('drizzle-orm');
  const accountIdsToInsert = ACCOUNTS_DATA.map((a) => a.id);

  // Delete accounts that either belong to this user OR have IDs we want to use
  await db
    .delete(schema.account)
    .where(
      or(eq(schema.account.userId, targetUserId), inArray(schema.account.id, accountIdsToInsert)),
    );

  // Insert accounts
  for (const account of ACCOUNTS_DATA) {
    try {
      await db.insert(schema.account).values({
        id: account.id,
        userId: targetUserId, // Use the target user ID
        name: account.name,
        type: account.type,
        accountNumber: account.accountNumber,
        createdAt: now,
        updatedAt: now,
      });
    } catch {
      // If accountNumber column doesn't exist, try without it
      console.log('⚠️ Retrying account insert without accountNumber...');
      await db.insert(schema.account).values({
        id: account.id,
        userId: targetUserId, // Use the target user ID
        name: account.name,
        type: account.type,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  console.log(`✅ Seeded ${ACCOUNTS_DATA.length} accounts for user ${targetUserId}`);
}
