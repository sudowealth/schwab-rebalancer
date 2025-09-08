// Import individual seed functions
import { seedSecurities, seedIndices } from "./securities";
import { seedAccounts } from "./accounts";
import { seedSleeves } from "./sleeves";
import { seedModels } from "./models";
import { seedRebalancingGroups } from "./rebalancing-groups";
import { seedHoldings } from "./holdings";
import { seedTransactions } from "./transactions";
import { getDatabase, cleanupDatabase } from "../db-config";
import { sql } from "drizzle-orm";

// Initialize database connection to D1 local database
const db = getDatabase();

export async function seedDatabase(userId?: string) {
  console.log("🌱 Starting database seeding...");

  try {
    // Tables will be created by Drizzle migrations

    // Temporarily disable foreign key constraints for seeding
    await db.run(sql`PRAGMA foreign_keys = OFF`);

    // Seed data in correct order (due to foreign key constraints)
    await seedSecurities(db);
    await seedIndices(db);
    await seedAccounts(db, userId);
    await seedSleeves(db, userId);
    await seedModels(db, userId);
    await seedRebalancingGroups(db, userId);
    await seedHoldings(db, userId);
    await seedTransactions(db, userId);

    // Re-enable foreign key constraints
    await db.run(sql`PRAGMA foreign_keys = ON`);

    // Force WAL checkpoint to ensure all data is written to main database file
    await db.run(sql`PRAGMA wal_checkpoint(TRUNCATE)`);

    // Clear the connection pool to ensure fresh connections see the new data
    cleanupDatabase();

    console.log("✅ Database seeding completed successfully!");
  } catch (error) {
    console.error("❌ Database seeding failed:", error);
    throw error;
  }
}

// Run seeding if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase()
    .then(() => {
      console.log("🎉 Seeding completed!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Seeding failed:", error);
      process.exit(1);
    });
}
