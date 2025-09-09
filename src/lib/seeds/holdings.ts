import type { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../../db/schema';

const HOLDINGS_DATA = [
  {
    id: 'holding-cash',
    accountId: 'account-1',
    sleeveId: 'cash',
    ticker: '$$$',
    qty: 10000,
    costBasis: 1.0,
    openedAt: new Date('2024-07-10'),
  },
  {
    id: 'holding-1',
    accountId: 'account-1',
    sleeveId: 'sleeve-1',
    ticker: 'AAPL',
    qty: 100,
    costBasis: 150.0,
    openedAt: new Date('2024-11-01'),
  },
  {
    id: 'holding-2',
    accountId: 'account-1',
    sleeveId: 'sleeve-2',
    ticker: 'JNJ',
    qty: 200,
    costBasis: 351.12,
    openedAt: new Date('2024-11-15'),
  },
  {
    id: 'holding-4',
    accountId: 'account-1',
    sleeveId: 'sleeve-8',
    ticker: 'PG',
    qty: 150,
    costBasis: 310.0,
    openedAt: new Date('2024-10-01'),
  },
  {
    id: 'holding-5',
    accountId: 'account-1',
    sleeveId: 'sleeve-1',
    ticker: 'XOM',
    qty: 100,
    costBasis: 105.0,
    openedAt: new Date('2024-09-15'),
  },
  {
    id: 'holding-6',
    accountId: 'account-1',
    sleeveId: 'sleeve-7',
    ticker: 'JPM',
    qty: 150,
    costBasis: 140.0,
    openedAt: new Date('2024-08-20'),
  },
  {
    id: 'holding-7',
    accountId: 'account-1',
    sleeveId: 'sleeve-1',
    ticker: 'NFLX',
    qty: 50,
    costBasis: 1580.0,
    openedAt: new Date('2024-07-10'),
  },
  {
    id: 'holding-8',
    accountId: 'account-1',
    sleeveId: 'sleeve-8',
    ticker: 'WMT',
    qty: 300,
    costBasis: 85.0,
    openedAt: new Date('2024-06-15'),
  },

  // Roth IRA broad market positions
  {
    id: 'holding-9',
    accountId: 'account-2', // Roth IRA
    sleeveId: null, // Tech-Broad
    ticker: 'IVV',
    qty: 50,
    costBasis: 400.0,
    openedAt: new Date('2024-05-15'),
  },
  {
    id: 'holding-10',
    accountId: 'account-2', // Roth IRA
    sleeveId: null, // Growth-01
    ticker: 'VTI',
    qty: 25,
    costBasis: 125.0,
    openedAt: new Date('2024-04-20'),
  },

  // Traditional 401(k) diversified positions
  {
    id: 'holding-11',
    accountId: 'account-3', // Traditional 401(k)
    sleeveId: null,
    ticker: 'ACWI',
    qty: 75,
    costBasis: 150.0,
    openedAt: new Date('2024-03-10'),
  },
  {
    id: 'holding-12',
    accountId: 'account-3', // Traditional 401(k)
    sleeveId: null,
    ticker: 'SPY',
    qty: 200,
    costBasis: 125.0,
    openedAt: new Date('2024-02-25'),
  },

  // Additional ETF holdings in tax deferred account (Traditional 401k)
  {
    id: 'holding-13',
    accountId: 'account-3', // Traditional 401(k)
    sleeveId: null,
    ticker: 'QQQ',
    qty: 100,
    costBasis: 450.0,
    openedAt: new Date('2024-01-15'),
  },
  {
    id: 'holding-14',
    accountId: 'account-3', // Traditional 401(k)
    sleeveId: null,
    ticker: 'IWM',
    qty: 150,
    costBasis: 220.0,
    openedAt: new Date('2023-12-10'),
  },

  // Additional ETF holdings in tax exempt account (Roth IRA)
  {
    id: 'holding-15',
    accountId: 'account-2', // Roth IRA
    sleeveId: null,
    ticker: 'SPY',
    qty: 50,
    costBasis: 500.0,
    openedAt: new Date('2024-01-20'),
  },
  {
    id: 'holding-16',
    accountId: 'account-2', // Roth IRA
    sleeveId: null,
    ticker: 'QQQ',
    qty: 75,
    costBasis: 480.0,
    openedAt: new Date('2023-11-30'),
  },
];

export async function seedHoldings(db: ReturnType<typeof drizzle>, _userId?: string) {
  console.log('💼 Seeding holdings...');

  const now = Date.now();

  // Clear existing holdings
  await db.delete(schema.holding);

  // Insert holdings
  for (const holding of HOLDINGS_DATA) {
    await db.insert(schema.holding).values({
      id: holding.id,
      accountId: holding.accountId,
      ticker: holding.ticker,
      qty: holding.qty,
      averageCost: holding.costBasis,
      openedAt: holding.openedAt.getTime(),
      createdAt: now,
      updatedAt: now,
    });
  }

  console.log(`✅ Seeded ${HOLDINGS_DATA.length} holdings (positions)`);
}
