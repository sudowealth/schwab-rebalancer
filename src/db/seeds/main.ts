// Import individual seed functions

import { seedRebalancingGroups } from './rebalancing-groups';
import { seedSecurities } from './securities';
import { seedModels, seedSleeves, seedSP500Securities } from './sp500-model-seeder';

export async function seedDatabase(userId?: string) {
  console.log('🌱 Starting database seeding...');

  // Create database connection using lazy initialization

  try {
    // Tables will be created by Drizzle migrations

    // PostgreSQL doesn't need to disable foreign keys - seed data in correct order
    await seedSP500Securities(); // S&P 500 securities and index first
    await seedSecurities(); // Then ETFs and cash
    await seedSleeves(userId);
    await seedModels(userId);
    await seedRebalancingGroups(userId);

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
