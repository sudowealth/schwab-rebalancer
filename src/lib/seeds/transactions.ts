import type { drizzle } from 'drizzle-orm/neon-http';
import * as schema from '../../db/schema';

const TRANSACTIONS_DATA = [
  {
    id: 'txn-1',
    accountId: 'account-2',
    sleeveId: 'sleeve-4',
    ticker: 'PLTR',
    type: 'SELL',
    qty: 500,
    price: 18.1,
    realizedGainLoss: -2450.0,
    executedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
  },
  {
    id: 'txn-2',
    accountId: 'account-2',
    sleeveId: 'sleeve-5',
    ticker: 'DIS',
    type: 'SELL',
    qty: 300,
    price: 62.25,
    realizedGainLoss: -1875.0,
    executedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
  },
  {
    id: 'txn-3',
    accountId: 'account-2',
    sleeveId: 'sleeve-6',
    ticker: 'AMD',
    type: 'SELL',
    qty: 400,
    price: 77.25,
    realizedGainLoss: -3100.0,
    executedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), // 6 days ago
  },
  {
    id: 'txn-4',
    accountId: 'account-1',
    sleeveId: 'sleeve-1',
    ticker: 'AAPL',
    type: 'BUY',
    qty: 100,
    price: 150.0,
    realizedGainLoss: null,
    executedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), // 8 days ago
  },
  {
    id: 'txn-5',
    accountId: 'account-1',
    sleeveId: 'sleeve-2',
    ticker: 'JNJ',
    type: 'BUY',
    qty: 200,
    price: 160.0,
    realizedGainLoss: null,
    executedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
  },
  {
    id: 'txn-6',
    accountId: 'account-1',
    sleeveId: 'sleeve-7',
    ticker: 'JPM',
    type: 'BUY',
    qty: 150,
    price: 140.0,
    realizedGainLoss: null,
    executedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000), // 12 days ago
  },
  {
    id: 'txn-7',
    accountId: 'account-1',
    sleeveId: 'sleeve-8',
    ticker: 'WMT',
    type: 'BUY',
    qty: 300,
    price: 85.0,
    realizedGainLoss: null,
    executedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
  },
  {
    id: 'txn-8',
    accountId: 'account-1',
    sleeveId: 'sleeve-5',
    ticker: 'CMCSA',
    type: 'SELL',
    qty: 250,
    price: 42.8,
    realizedGainLoss: -1200.0,
    executedAt: new Date(Date.now() - 16 * 24 * 60 * 60 * 1000), // 16 days ago
  },
];

export async function seedTransactions(db: ReturnType<typeof drizzle>, _userId?: string) {
  console.log('🔄 Seeding transactions...');

  const now = Math.floor(Date.now() / 1000);

  // Clear existing transactions
  await db.delete(schema.transaction);

  // Insert transactions
  for (const transaction of TRANSACTIONS_DATA) {
    await db.insert(schema.transaction).values({
      id: transaction.id,
      accountId: transaction.accountId,
      sleeveId: transaction.sleeveId,
      ticker: transaction.ticker,
      type: transaction.type,
      qty: transaction.qty,
      price: transaction.price,
      realizedGainLoss: transaction.realizedGainLoss,
      executedAt: transaction.executedAt.getTime(),
      createdAt: now,
      updatedAt: now,
    });
  }

  console.log(`✅ Seeded ${TRANSACTIONS_DATA.length} transactions (trades)`);
}
