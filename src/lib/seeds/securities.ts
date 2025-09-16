import { inArray } from 'drizzle-orm';
import type { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '../../db/schema';

const CASH_DATA = [
  {
    ticker: '$$$',
    name: 'Cash',
    price: 1.0,
    industry: 'Cash',
    sector: 'Cash',
  },
  {
    ticker: 'MCASH',
    name: 'Manual Cash',
    price: 1.0,
    industry: 'Manual Cash',
    sector: 'Cash',
  },
];

// Seed cash securities (ETFs and stocks will be populated automatically via equity securities sync)
export async function seedSecurities(db: ReturnType<typeof drizzle>) {
  console.log('📊 Seeding cash securities...');

  const now = Math.floor(Date.now() / 1000);

  // Only seed cash securities, ETFs and stocks will be populated via equity securities sync
  const existingCash = await db
    .select({ ticker: schema.security.ticker })
    .from(schema.security)
    .where(
      inArray(
        schema.security.ticker,
        CASH_DATA.map((c) => c.ticker),
      ),
    );

  const existingTickers = new Set(existingCash.map((s) => s.ticker));

  // Only insert cash securities that don't already exist
  const securitiesToInsert = CASH_DATA.filter((security) => !existingTickers.has(security.ticker));

  if (securitiesToInsert.length > 0) {
    for (const security of securitiesToInsert) {
      await db.insert(schema.security).values({
        ticker: security.ticker,
        name: security.name,
        price: security.price,
        industry: security.industry,
        sector: security.sector,
        createdAt: now,
        updatedAt: now,
      });
    }

    console.log(`✅ Seeded ${securitiesToInsert.length} cash securities`);
  } else {
    console.log('✅ All cash securities already exist');
  }

  console.log(
    'ℹ️  Note: ETFs and stocks will be automatically populated via NASDAQ feeds after cash securities are seeded',
  );
}
