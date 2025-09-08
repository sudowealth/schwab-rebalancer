import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../../db/schema";
import { eq, sql } from "drizzle-orm";

const ACCOUNTS_DATA = [
  {
    id: "account-1",
    name: "Taxable Account",
    type: "TAXABLE",
    accountNumber: "TX-001-2024",
  },
  {
    id: "account-2",
    name: "Roth IRA",
    type: "TAX_EXEMPT",
    accountNumber: "ROTH-002-2024",
  },
  {
    id: "account-3",
    name: "Traditional 401(k)",
    type: "TAX_DEFERRED",
    accountNumber: "401K-003-2024",
  },
];

// Function to check if accountNumber column exists and add it if needed
async function migrateAccountTable(db: ReturnType<typeof drizzle>) {
  try {
    // Try to check if accountNumber column exists by running a simple query
    await db.run(sql`SELECT accountNumber FROM account LIMIT 1`);
    console.log("✅ accountNumber column already exists");
  } catch {
    console.log("📝 Adding accountNumber column to account table...");
    try {
      await db.run(sql`ALTER TABLE account ADD COLUMN accountNumber TEXT`);
      console.log("✅ accountNumber column added successfully");
    } catch (alterError) {
      console.warn("⚠️ Could not add accountNumber column:", alterError);
    }
  }
}

export async function seedAccounts(db: ReturnType<typeof drizzle>, userId?: string) {
  console.log("🏦 Seeding accounts...");

  // First, ensure the account table has the accountNumber column
  await migrateAccountTable(db);

  const now = Date.now();

  // Use provided userId or fallback to demo user logic
  let targetUserId = userId;
  
  if (!targetUserId) {
    throw new Error("User ID is required for seeding accounts");
  }
  
  console.log(`✅ Using provided user ID: ${targetUserId}`);

  // Clear existing accounts for this user and any accounts with the same IDs we're about to insert
  const { or, inArray } = await import("drizzle-orm");
  const accountIdsToInsert = ACCOUNTS_DATA.map(a => a.id);
  
  // Delete accounts that either belong to this user OR have IDs we want to use
  await db.delete(schema.account).where(
    or(
      eq(schema.account.userId, targetUserId),
      inArray(schema.account.id, accountIdsToInsert)
    )
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
      console.log("⚠️ Retrying account insert without accountNumber...");
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
