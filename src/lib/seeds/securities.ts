import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../../db/schema';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Convert market cap string to millions
function convertMarketCapToMillions(marketCapStr: string): number {
  const numStr = marketCapStr.replace(/[^\d.]/g, '');
  const num = parseFloat(numStr);

  if (marketCapStr.includes('T')) {
    return Math.round(num * 1000000); // Trillions to millions
  } else if (marketCapStr.includes('B')) {
    return Math.round(num * 1000); // Billions to millions
  } else if (marketCapStr.includes('M')) {
    return Math.round(num); // Already in millions
  } else {
    return Math.round(num); // Assume millions if no suffix
  }
}

// Load S&P 500 data (all 503 securities)
const sp500DataPath = path.resolve(__dirname, '../sp500.json');
const sp500Data = JSON.parse(fs.readFileSync(sp500DataPath, 'utf-8'));

// Generate data for all S&P 500 companies using real financial data from Yahoo Finance
const SECURITIES_DATA = sp500Data.map(
  (company: {
    ticker: string;
    name: string;
    price?: string;
    marketCap?: string;
    peRatio?: string;
    industry?: string;
    sector?: string;
  }) => ({
    ticker: company.ticker,
    name: company.name,
    price: parseFloat(company.price || '0') || 50 + Math.random() * 450,
    marketCap: company.marketCap
      ? convertMarketCapToMillions(company.marketCap)
      : Math.round(10 + Math.random() * 2990), // Convert to millions
    peRatio: company.peRatio ? parseFloat(company.peRatio) : null,
    industry: company.industry || null,
    sector: company.sector || null,
  }),
);

// Add ETF data
const ETF_DATA = [
  {
    ticker: 'SPY',
    name: 'SPDR S&P 500 ETF Trust',
    price: 585.0,
    marketCap: 523000, // $523B in millions
    peRatio: null,
    industry: 'Exchange Traded Fund',
    sector: 'Financial Services',
  },
  {
    ticker: 'QQQ',
    name: 'Invesco QQQ Trust ETF',
    price: 521.0,
    marketCap: 234000, // $234B in millions
    peRatio: null,
    industry: 'Exchange Traded Fund',
    sector: 'Financial Services',
  },
  {
    ticker: 'VTI',
    name: 'Vanguard Total Stock Market ETF',
    price: 283.0,
    marketCap: 382000, // $382B in millions
    peRatio: null,
    industry: 'Exchange Traded Fund',
    sector: 'Financial Services',
  },
  {
    ticker: 'IWM',
    name: 'iShares Russell 2000 ETF',
    price: 238.0,
    marketCap: 34000, // $34B in millions
    peRatio: null,
    industry: 'Exchange Traded Fund',
    sector: 'Financial Services',
  },
  {
    ticker: 'IVV',
    name: 'iShares Core S&P 500 ETF',
    price: 584.0,
    marketCap: 485000, // $485B in millions
    peRatio: null,
    industry: 'Exchange Traded Fund',
    sector: 'Financial Services',
  },
  {
    ticker: 'ACWI',
    name: 'iShares MSCI ACWI ETF',
    price: 112.0,
    marketCap: 21000, // $21B in millions
    peRatio: null,
    industry: 'Exchange Traded Fund',
    sector: 'Financial Services',
  },
];

const CASH_DATA = [
  {
    ticker: '$$$',
    name: 'Cash',
    price: 1.0,
    marketCap: null,
    peRatio: null,
    industry: 'Cash',
    sector: 'Cash',
  },
  {
    ticker: 'MCASH',
    name: 'Manual Cash',
    price: 1.0,
    marketCap: null,
    peRatio: null,
    industry: 'Manual Cash',
    sector: 'Cash',
  },
];

// Combine all securities
const ALL_SECURITIES_DATA = [...SECURITIES_DATA, ...ETF_DATA, ...CASH_DATA];

export async function seedSecurities(db: ReturnType<typeof drizzle>) {
  console.log('📊 Seeding securities...');

  const now = Date.now();

  // Clear existing securities
  await db.delete(schema.security);

  // Insert securities
  for (const security of ALL_SECURITIES_DATA) {
    await db.insert(schema.security).values({
      ticker: security.ticker,
      name: security.name,
      price: security.price,
      marketCap: security.marketCap,
      peRatio: security.peRatio,
      industry: security.industry,
      sector: security.sector,
      createdAt: now,
      updatedAt: now,
    });
  }

  console.log(`✅ Seeded ${ALL_SECURITIES_DATA.length} securities (S&P 500 + ETFs)`);
}

export async function seedIndices(db: ReturnType<typeof drizzle>) {
  console.log('📈 Seeding indices...');

  const now = Date.now();

  // Clear existing indices and index members
  await db.delete(schema.indexMember);
  await db.delete(schema.index);

  // Insert SP500 index
  await db.insert(schema.index).values({
    id: 'sp500',
    name: 'S&P 500',
    createdAt: now,
    updatedAt: now,
  });

  // Insert all S&P 500 companies as index members
  for (const security of SECURITIES_DATA) {
    await db.insert(schema.indexMember).values({
      id: `sp500-${security.ticker}`,
      indexId: 'sp500',
      securityId: security.ticker,
      createdAt: now,
      updatedAt: now,
    });
  }

  console.log(`✅ Seeded SP500 index with ${SECURITIES_DATA.length} members`);
}
