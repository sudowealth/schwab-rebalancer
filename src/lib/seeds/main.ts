// Import individual seed functions

import { sql } from 'drizzle-orm';
import { cleanupDatabase, getDatabase } from '../db-config';
import { seedAccounts } from './accounts';
import { seedHoldings } from './holdings';
import { seedRebalancingGroups } from './rebalancing-groups';
import { seedSecurities } from './securities';
import { seedModels, seedSleeves, seedSP500Securities } from './sp500-model-seeder';
import { seedTransactions } from './transactions';

// Initialize database connection to D1 local database
const db = getDatabase();

export async function seedDatabase(userId?: string) {
  console.log('🌱 Starting database seeding...');

  try {
    // Tables will be created by Drizzle migrations

    // Temporarily disable foreign key constraints for seeding
    await db.run(sql`PRAGMA foreign_keys = OFF`);

    // Seed data in correct order (due to foreign key constraints)
    await seedSP500Securities(db); // S&P 500 securities and index first
    await seedSecurities(db); // Then ETFs and cash
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

    console.log('✅ Database seeding completed successfully!');
  } catch (error) {
    console.error('❌ Database seeding failed:', error);
    throw error;
  }
}

// Run seeding if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase()
    .then(() => {
      console.log('🎉 Seeding completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Seeding failed:', error);
      process.exit(1);
    });
}
