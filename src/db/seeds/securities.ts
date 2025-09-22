import { inArray } from 'drizzle-orm';
import * as schema from '~/db/schema';
import { getDb } from '~/lib/db-config';

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
export async function seedSecurities() {
  console.log('📊 Seeding cash securities...');

  const now = Math.floor(Date.now() / 1000);

  // Only seed cash securities, ETFs and stocks will be populated via equity securities sync
  const existingCash = await getDb()
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

  let insertedCount = 0;

  if (securitiesToInsert.length > 0) {
    const inserted = await getDb()
      .insert(schema.security)
      .values(
        securitiesToInsert.map((security) => ({
          ticker: security.ticker,
          name: security.name,
          price: security.price,
          industry: security.industry,
          sector: security.sector,
          createdAt: now,
          updatedAt: now,
        })),
      )
      .onConflictDoNothing({ target: schema.security.ticker })
      .returning({ ticker: schema.security.ticker });

    insertedCount = inserted.length;
  }

  if (insertedCount > 0) {
    console.log(`✅ Seeded ${insertedCount} cash securities`);
  } else {
    console.log('✅ All cash securities already exist');
  }

  console.log(
    'ℹ️  Note: ETFs and stocks will be automatically populated via NASDAQ feeds after cash securities are seeded',
  );
}
