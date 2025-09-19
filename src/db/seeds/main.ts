// Import individual seed functions

import { cleanupDatabase, getDatabaseSync, initDatabase } from '../db-config';
import { seedRebalancingGroups } from './rebalancing-groups';
import { seedSecurities } from './securities';
import { seedModels, seedSleeves, seedSP500Securities } from './sp500-model-seeder';

export async function seedDatabase(userId?: string) {
  console.log('🌱 Starting database seeding...');

  // Initialize database connection
  await initDatabase();
  const db = getDatabaseSync();

  try {
    // Tables will be created by Drizzle migrations

    // PostgreSQL doesn't need to disable foreign keys - seed data in correct order
    await seedSP500Securities(db); // S&P 500 securities and index first
    await seedSecurities(db); // Then ETFs and cash
    await seedSleeves(db, userId);
    await seedModels(db, userId);
    await seedRebalancingGroups(db, userId);

    // PostgreSQL handles WAL and checkpoints automatically
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
