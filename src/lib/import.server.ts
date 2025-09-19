import { createServerFn } from '@tanstack/react-start';
import { eq, inArray, sql } from 'drizzle-orm';
import * as schema from '../db/schema';
import { CASH_TICKER, isAnyCashTicker } from './constants';
import { getDatabaseSync } from './db-config';
import { getErrorMessage, ValidationError } from './error-handler';
import type { SyncYahooFundamentalsResult } from './yahoo.server';

// Defer server-only auth utilities to runtime to avoid bundling them in the client build
const requireAuth = async () => {
  const mod = await import('./auth-utils');
  return mod.requireAuth();
};

const requireAdmin = async () => {
  const mod = await import('./auth-utils');
  return mod.requireAdmin();
};

// Server function to seed demo data - runs ONLY on server
export const seedDemoDataServerFn = createServerFn({ method: 'POST' }).handler(async () => {
  const { user } = await requireAuth();

  const { seedDatabase } = await import('./seeds/main');
  await seedDatabase(user.id);

  return {
    success: true,
    summary: {
      securitiesSeeded: 503,
      accountsSeeded: 2,
      sleevesCreated: 8,
      holdingsSeeded: 7,
      transactionsSeeded: 8,
    },
  };
});

// Server function to seed securities data - runs ONLY on server
export const seedSecuritiesDataServerFn = createServerFn({ method: 'POST' }).handler(async () => {
  await requireAuth();

  const db = getDatabaseSync();
  const { seedSecurities } = await import('./seeds/securities');
  const { seedSP500Securities } = await import('./seeds/sp500-model-seeder');

  // Seed cash securities first
  await seedSecurities(db);

  // Then run the equity securities sync to populate ETFs and stocks
  console.log('🔄 Running equity securities sync...');
  const equitySyncResult = await importNasdaqSecuritiesServerFn({
    data: { feedType: 'all', skipExisting: true },
  });

  if (!equitySyncResult.success) {
    console.warn('⚠️  Equity securities sync completed with warnings:', equitySyncResult.errors);
  } else {
    console.log(
      `✅ Equity securities sync completed: ${equitySyncResult.imported} imported, ${equitySyncResult.skipped} skipped`,
    );
  }

  // Seed S&P 500 securities after equity sync
  console.log('🔄 Seeding S&P 500 securities...');
  await seedSP500Securities(db);
  console.log('✅ S&P 500 securities seeding completed');

  // Check if Schwab is connected and trigger price sync for newly imported securities that appear in holdings, indices, or sleeves
  let schwabSyncResult = null;
  if (
    equitySyncResult.success &&
    equitySyncResult.imported > 0 &&
    equitySyncResult.importedTickers &&
    equitySyncResult.importedTickers.length > 0
  ) {
    try {
      const { getSchwabCredentialsStatusServerFn } = await import('./schwab.server');
      const schwabStatus = await getSchwabCredentialsStatusServerFn();
      if (schwabStatus?.hasCredentials) {
        // Filter tickers to only include those that appear in holdings, indices, or sleeves
        const relevantTickers = await filterImportedTickersForPriceSync(
          db,
          equitySyncResult.importedTickers,
        );

        if (relevantTickers.length > 0) {
          console.log(
            '🔄 Starting automatic Schwab price sync for relevant newly imported securities:',
            relevantTickers,
          );
          const { syncSchwabPricesServerFn } = await import('./schwab.server');
          schwabSyncResult = await syncSchwabPricesServerFn({
            data: { symbols: relevantTickers },
          });
          console.log('✅ Schwab price sync completed:', schwabSyncResult);
        } else {
          console.log(
            'ℹ️ No newly imported securities found in holdings, indices, or sleeves - skipping Schwab price sync',
          );
          schwabSyncResult = {
            success: true,
            recordsProcessed: 0,
            message: 'No relevant securities to sync',
          };
        }
      }
    } catch (error) {
      console.error('❌ Schwab price sync failed:', error);
      schwabSyncResult = {
        success: false,
        recordsProcessed: 0,
        errorMessage: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  // Run Yahoo sync for held/sleeve securities missing data
  let yahooSyncResult: SyncYahooFundamentalsResult | null = null;
  try {
    console.log('🔄 Starting Yahoo sync for held/sleeve securities missing data...');
    const { syncYahooFundamentalsServerFn } = await import('./yahoo.server');
    yahooSyncResult = (await syncYahooFundamentalsServerFn({
      data: { scope: 'held-sleeve-securities-missing-data' },
    })) as SyncYahooFundamentalsResult;
    console.log('✅ Yahoo sync completed:', yahooSyncResult);
  } catch (error) {
    console.error('❌ Yahoo sync failed:', error);
    yahooSyncResult = {
      success: false,
      recordsProcessed: 0,
      errorMessage: error instanceof Error ? error.message : 'Unknown error occurred',
      details: [],
      logId: crypto.randomUUID(),
    };
  }

  return {
    success: true,
    message: (() => {
      let message = `Securities data seeded successfully. Cash securities seeded, ${equitySyncResult.imported} equity securities imported from NASDAQ feeds, and S&P 500 securities seeded.`;

      if (schwabSyncResult?.recordsProcessed && schwabSyncResult.recordsProcessed > 0) {
        message += ` Prices updated for ${schwabSyncResult.recordsProcessed} securities via Schwab.`;
      }

      if (yahooSyncResult && yahooSyncResult.recordsProcessed > 0) {
        message += ` Yahoo data synced for ${yahooSyncResult.recordsProcessed} securities.`;
      }

      return message;
    })(),
    equitySyncResult,
    schwabSyncResult,
    yahooSyncResult,
  };
});

// Server function to seed models data - runs ONLY on server
export const seedModelsDataServerFn = createServerFn({ method: 'POST' }).handler(async () => {
  const { user } = await requireAuth();

  const db = getDatabaseSync();
  const { seedSleeves, seedModels } = await import('./seeds/sp500-model-seeder');

  const sleevesResult = await seedSleeves(db, user.id);
  const modelsResult = await seedModels(db, user.id);

  return {
    success: true,
    models: modelsResult.models,
    sleeves: sleevesResult.sleeves,
    sleeveMembers: sleevesResult.sleeveMembers,
  };
});

// Server function to seed Global Equity Model data - runs ONLY on server
export const seedGlobalEquityModelServerFn = createServerFn({ method: 'POST' }).handler(
  async () => {
    const { user } = await requireAuth();

    const db = getDatabaseSync();
    const { seedGlobalEquitySleeves, seedGlobalEquityModelData } = await import(
      './seeds/global-equity-model-seeder'
    );

    const sleevesResult = await seedGlobalEquitySleeves(db, user.id);
    const modelsResult = await seedGlobalEquityModelData(db, user.id);

    return {
      success: true,
      models: modelsResult.models,
      sleeves: sleevesResult.sleeves,
      sleeveMembers: sleevesResult.sleeveMembers,
    };
  },
);

// Server function to import Nasdaq securities - runs ONLY on server
export const importNasdaqSecuritiesServerFn = createServerFn({
  method: 'POST',
})
  .validator(
    (data: {
      limit?: number;
      skipExisting?: boolean;
      feedType?: 'all' | 'nasdaqonly' | 'nonnasdaq';
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireAuth();

    const { limit, skipExisting = true, feedType = 'all' } = data;

    try {
      // Determine URLs to fetch based on feed type
      const urls: string[] = [];
      if (feedType === 'all') {
        urls.push(
          'https://nasdaqtrader.com/dynamic/symdir/nasdaqlisted.txt',
          'https://nasdaqtrader.com/dynamic/symdir/otherlisted.txt',
        );
      } else if (feedType === 'nasdaqonly') {
        urls.push('https://nasdaqtrader.com/dynamic/symdir/nasdaqlisted.txt');
      } else if (feedType === 'nonnasdaq') {
        urls.push('https://nasdaqtrader.com/dynamic/symdir/otherlisted.txt');
      }

      // Fetch data from all URLs
      const fetchPromises = urls.map(async (url) => {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(
            `Failed to fetch Nasdaq data from ${url}: ${response.status} ${response.statusText}`,
          );
        }
        return response.text();
      });

      const responses = await Promise.all(fetchPromises);

      // Combine all lines from all responses
      const allLines: string[] = [];
      for (const responseText of responses) {
        const lines = responseText.split('\n').filter((line) => line.trim());
        allLines.push(...lines.slice(1)); // Skip header from each file
      }

      // Parse pipe-delimited data based on feed type
      interface NasdaqSecurity {
        ticker: string;
        securityName: string;
        exchange?: string;
        marketCategory?: string;
        etf: string;
        roundLotSize: string;
        testIssue: string;
        financialStatus?: string;
      }

      const parsedSecurities: NasdaqSecurity[] = [];
      for (const line of allLines) {
        const parts = line.split('|');
        if (parts.length >= 7) {
          // Determine format based on ETF field position
          // otherlisted.txt: ACT Symbol|Security Name|Exchange|CQS Symbol|ETF|Round Lot Size|Test Issue|NASDAQ Symbol
          // nasdaqlisted.txt: Symbol|Security Name|Market Category|Test Issue|Financial Status|Round Lot Size|ETF|NextShares

          if (parts.length === 8) {
            // Check if this looks like nasdaqlisted format (Test Issue field at index 3)
            const testIssueField = parts[3]?.trim() || '';
            if (testIssueField === 'N' || testIssueField === 'Y') {
              // nasdaqlisted.txt format: ETF at index 6
              parsedSecurities.push({
                ticker: parts[0]?.trim() || '',
                securityName: parts[1]?.trim() || '',
                marketCategory: parts[2]?.trim() || '',
                testIssue: parts[3]?.trim() || '',
                financialStatus: parts[4]?.trim() || '',
                roundLotSize: parts[5]?.trim() || '',
                etf: parts[6]?.trim() || '',
                exchange: 'NASDAQ', // nasdaqlisted.txt is specifically NASDAQ securities
              });
            } else {
              // otherlisted.txt format: ETF at index 4
              parsedSecurities.push({
                ticker: parts[0]?.trim() || parts[7]?.trim() || '', // Use ACT Symbol or NASDAQ Symbol as fallback
                securityName: parts[1]?.trim() || '',
                exchange: parts[2]?.trim() || '',
                etf: parts[4]?.trim() || '',
                roundLotSize: parts[5]?.trim() || '',
                testIssue: parts[6]?.trim() || '',
              });
            }
          } else if (parts.length === 7) {
            // nasdaqlisted.txt without NextShares field: ETF at index 6
            parsedSecurities.push({
              ticker: parts[0]?.trim() || '',
              securityName: parts[1]?.trim() || '',
              marketCategory: parts[2]?.trim() || '',
              testIssue: parts[3]?.trim() || '',
              financialStatus: parts[4]?.trim() || '',
              roundLotSize: parts[5]?.trim() || '',
              etf: parts[6]?.trim() || '',
              exchange: 'NASDAQ',
            });
          }
        }
      }

      // Apply limit if specified
      const securitiesToProcess = limit ? parsedSecurities.slice(0, limit) : parsedSecurities;

      // Import to database
      const db = getDatabaseSync();

      let importedCount = 0;
      let skippedCount = 0;
      const errors: string[] = [];
      const importedTickers: string[] = [];
      const recordsByTicker = new Map<string, typeof schema.security.$inferInsert>();

      for (const security of securitiesToProcess) {
        try {
          // Skip test issues
          if (security.testIssue === 'Y') {
            skippedCount++;
            continue;
          }

          // Use ticker field (already determined based on feed type)
          const ticker = security.ticker;
          if (!ticker) {
            skippedCount++;
            continue;
          }

          // Validate ticker format: must be 9 characters or less and all uppercase
          if (ticker.length > 9) {
            skippedCount++;
            continue;
          }

          if (ticker !== ticker.toUpperCase()) {
            skippedCount++;
            continue;
          }

          // Skip duplicates within the feed to avoid redundant inserts
          if (recordsByTicker.has(ticker)) {
            skippedCount++;
            continue;
          }

          // Determine asset type
          let assetType = 'EQUITY';
          let assetTypeSub = null;

          if (security.etf === 'Y') {
            assetType = 'EQUITY';
            assetTypeSub = 'ETF';
          }

          // Create a descriptive name
          const exchangeInfo = security.exchange || security.marketCategory || 'NASDAQ';
          const name = security.securityName || `${ticker} - ${exchangeInfo}`;

          recordsByTicker.set(ticker, {
            ticker,
            name,
            price: 1,
            marketCap: null,
            peRatio: null,
            industry: null,
            sector: null,
            assetType,
            assetTypeSub,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
        } catch (error) {
          const errorMsg = `Failed to import ${security.ticker}: ${getErrorMessage(error)}`;
          errors.push(errorMsg);
          console.error(errorMsg);
        }
      }

      let recordsToInsert = Array.from(recordsByTicker.values());

      if (skipExisting && recordsToInsert.length > 0) {
        const existingTickers = new Set<string>();
        const tickers = Array.from(recordsByTicker.keys());
        const chunkSize = 500;
        for (let i = 0; i < tickers.length; i += chunkSize) {
          const chunk = tickers.slice(i, i + chunkSize);
          const existing = await db
            .select({ ticker: schema.security.ticker })
            .from(schema.security)
            .where(inArray(schema.security.ticker, chunk));
          for (const row of existing) {
            existingTickers.add(row.ticker);
          }
        }

        if (existingTickers.size > 0) {
          skippedCount += existingTickers.size;
          recordsToInsert = recordsToInsert.filter((record) => !existingTickers.has(record.ticker));
        }
      }

      if (recordsToInsert.length > 0) {
        const nowTimestamp = Date.now();
        recordsToInsert = recordsToInsert.map((record) => ({
          ...record,
          createdAt: nowTimestamp,
          updatedAt: nowTimestamp,
        }));

        const chunkSize = 500;
        for (let i = 0; i < recordsToInsert.length; i += chunkSize) {
          const chunk = recordsToInsert.slice(i, i + chunkSize);
          const inserted = await db
            .insert(schema.security)
            .values(chunk)
            .onConflictDoNothing({ target: schema.security.ticker })
            .returning({ ticker: schema.security.ticker });

          importedCount += inserted.length;
          importedTickers.push(...inserted.map((row) => row.ticker));
          skippedCount += chunk.length - inserted.length;
        }
      }

      // Clear cache to refresh data
      const { clearCache } = await import('../lib/db-api');
      clearCache();

      return {
        success: true,
        imported: importedCount,
        skipped: skippedCount,
        errors: errors,
        totalParsed: parsedSecurities.length,
        totalProcessed: securitiesToProcess.length,
        importedTickers: importedTickers,
      };
    } catch (error) {
      console.error('Failed to import Nasdaq securities');
      throw new ValidationError('Failed to import Nasdaq securities', getErrorMessage(error));
    }
  });

// Server function to truncate data - runs ONLY on server
export const truncateDataServerFn = createServerFn({ method: 'POST' })
  .validator((data: { confirmText?: string }) => data)
  .handler(async ({ data }) => {
    // Only admins can truncate data
    const { user } = await requireAdmin();

    // Safety check - require confirmation text
    if (data.confirmText !== 'TRUNCATE_ALL_DATA') {
      throw new Error('Confirmation text required: "TRUNCATE_ALL_DATA"');
    }

    const db = getDatabaseSync();

    try {
      // Get request info for audit logging
      if (!import.meta.env.SSR) {
        throw new Error('truncateDataServerFn is only available on the server');
      }
      const { getWebRequest } = await import('@tanstack/react-start/server');
      const request = getWebRequest();

      // Tables to truncate (all financial data and user-created content)
      // PRESERVE: user, session, auth_account, verification, audit_log (system-level)
      // NOTE: Neon HTTP driver doesn't support transactions, so operations may partially succeed

      const tablesToTruncate = [
        'security',
        'account',
        'sleeve',
        'sleeve_member',
        'holding',
        'transaction',
        'restricted_security',
        'index',
        'index_member',
        'model',
        'model_group_assignment',
        'model_member',
        'rebalancing_group',
        'rebalancing_group_member',
        'schwab_credentials',
        'sync_log',
        'sync_log_detail',
        'schwab_holding',
        'schwab_account',
        'schwab_security',
        'schwab_transaction',
        'trade_order',
        'order_execution',
      ];

      // Track successfully truncated tables for error reporting
      const truncatedTables: string[] = [];
      const failedTables: string[] = [];

      // Truncate each table individually (no transaction support in Neon HTTP)
      for (const tableName of tablesToTruncate) {
        try {
          await db.execute(sql`DELETE FROM ${sql.identifier(tableName)}`);
          truncatedTables.push(tableName);
        } catch (tableError) {
          failedTables.push(tableName);
          console.error(`Failed to truncate table: ${tableName}`, tableError);
        }
      }

      // Log the truncation in audit log
      await db.insert(schema.auditLog).values({
        id: crypto.randomUUID(),
        userId: user.id,
        action: 'TRUNCATE_ALL_DATA',
        entityType: 'SYSTEM',
        entityId: null,
        metadata: JSON.stringify({
          truncatedTables: truncatedTables.length,
          failedTables: failedTables.length,
          tables: truncatedTables,
          failed: failedTables,
          note: 'Neon HTTP driver used - no transaction support',
        }),
        createdAt: new Date(),
        ipAddress: request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() || null,
        userAgent: request.headers.get('User-Agent') || null,
      });

      // If any tables failed to truncate, include this in the response
      const hasPartialFailure = failedTables.length > 0;

      // Clear all caches to ensure UI reflects truncated data
      const { clearCache } = await import('./db-api');
      clearCache();

      // Prepare response based on success/failure
      const totalTables = tablesToTruncate.length;
      const successCount = truncatedTables.length;
      const failureCount = failedTables.length;

      let message: string;
      if (hasPartialFailure) {
        message = `Partial truncation completed. ${successCount}/${totalTables} tables truncated successfully. Failed tables: ${failedTables.join(', ')}. User accounts and authentication data preserved.`;
      } else {
        message = `All financial data has been truncated successfully. User accounts and authentication data preserved.`;
      }

      return {
        success: !hasPartialFailure,
        message,
        truncatedTables: successCount,
        failedTables: failureCount,
        totalTables,
        failedTableNames: failedTables,
        invalidateAllCaches: true, // Flag to tell client to invalidate all React Query caches
      };
    } catch (error) {
      console.error('Failed to truncate data');
      throw new ValidationError('Failed to truncate data', getErrorMessage(error));
    }
  });

// Get counts for Yahoo Finance sync scopes
export const getYahooSyncCountsServerFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { user } = await requireAuth();
  const { count, and, or, inArray, isNull, ne } = await import('drizzle-orm');
  const db = getDatabaseSync();

  // Get total securities count
  const totalSecurities = await db
    .select({ count: count() })
    .from(schema.security)
    .where(ne(schema.security.ticker, CASH_TICKER));

  // Get securities missing fundamentals
  const missingFundamentals = await db
    .select({ count: count() })
    .from(schema.security)
    .where(
      and(
        ne(schema.security.ticker, CASH_TICKER),
        or(
          isNull(schema.security.sector),
          isNull(schema.security.industry),
          isNull(schema.security.marketCap),
        ),
      ),
    );

  // Get held securities
  const { getPositions } = await import('./db-api');
  const positions = await getPositions(user.id);
  const heldTickers = [...new Set(positions.map((p) => p.ticker))].filter(
    (t) => !isAnyCashTicker(t),
  );

  // Get held securities missing fundamentals
  const heldMissingFundamentals = await db
    .select({ count: count() })
    .from(schema.security)
    .where(
      and(
        inArray(schema.security.ticker, heldTickers),
        or(
          isNull(schema.security.sector),
          isNull(schema.security.industry),
          isNull(schema.security.marketCap),
        ),
      ),
    );

  // Get sleeve securities missing fundamentals
  const sleeveSecurities = await db
    .select({
      ticker: schema.sleeveMember.ticker,
    })
    .from(schema.sleeveMember)
    .innerJoin(schema.sleeve, eq(schema.sleeveMember.sleeveId, schema.sleeve.id))
    .where(eq(schema.sleeve.userId, user.id));

  const sleeveTickers = new Set(sleeveSecurities.map((s) => s.ticker));

  const sleeveMissingFundamentals = await db
    .select({ count: count() })
    .from(schema.security)
    .where(
      and(
        inArray(schema.security.ticker, Array.from(sleeveTickers)),
        or(
          isNull(schema.security.sector),
          isNull(schema.security.industry),
          isNull(schema.security.marketCap),
        ),
      ),
    );

  // Get held and sleeve securities missing fundamentals
  const heldSleeveMissingFundamentals = await db
    .select({ count: count() })
    .from(schema.security)
    .where(
      and(
        inArray(schema.security.ticker, Array.from(new Set([...heldTickers, ...sleeveTickers]))),
        or(
          isNull(schema.security.sector),
          isNull(schema.security.industry),
          isNull(schema.security.marketCap),
        ),
      ),
    );

  return {
    'all-securities': Number(totalSecurities[0]?.count ?? 0),
    'held-sleeve-securities': heldTickers.length + sleeveTickers.size,
    'held-sleeve-securities-missing-data': Number(heldSleeveMissingFundamentals[0]?.count ?? 0),
    'all-holdings': heldTickers.length,
    'all-sleeves': sleeveTickers.size,
    'missing-fundamentals': Number(missingFundamentals[0]?.count ?? 0),
    'missing-fundamentals-holdings': Number(heldMissingFundamentals[0]?.count ?? 0),
    'missing-fundamentals-sleeves': Number(sleeveMissingFundamentals[0]?.count ?? 0),
  };
});

// Check if securities exist in the database
export const checkSecuritiesExistServerFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { user: _user } = await requireAuth();
  const { count, ne } = await import('drizzle-orm');
  const db = getDatabaseSync();

  // Get count of securities (excluding cash)
  const securitiesCount = await db
    .select({ count: count() })
    .from(schema.security)
    .where(ne(schema.security.ticker, CASH_TICKER));

  return {
    hasSecurities: Number(securitiesCount[0]?.count ?? 0) > 0,
    securitiesCount: Number(securitiesCount[0]?.count ?? 0),
  };
});

// Check if models exist for the user
export const checkModelsExistServerFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { user } = await requireAuth();
  const { count, eq } = await import('drizzle-orm');
  const db = getDatabaseSync();

  // Get count of models for this user
  const modelsCount = await db
    .select({ count: count() })
    .from(schema.model)
    .where(eq(schema.model.userId, user.id));

  return {
    hasModels: Number(modelsCount[0]?.count ?? 0) > 0,
    modelsCount: Number(modelsCount[0]?.count ?? 0),
  };
});

// Check if Schwab API credentials are configured
export const checkSchwabCredentialsServerFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { getEnv } = await import('./env');

    const env = getEnv();
    const hasClientId = Boolean(env.SCHWAB_CLIENT_ID?.trim());
    const hasClientSecret = Boolean(env.SCHWAB_CLIENT_SECRET?.trim());

    return {
      hasCredentials: hasClientId && hasClientSecret,
      hasClientId,
      hasClientSecret,
    };
  },
);

// Helper function to filter imported tickers to only include those in holdings, indices, or sleeves
async function filterImportedTickersForPriceSync(
  db: ReturnType<typeof getDatabaseSync>,
  importedTickers: string[],
): Promise<string[]> {
  if (importedTickers.length === 0) {
    return [];
  }

  // Get all tickers from holdings
  const holdingsTickers = await db
    .select({ ticker: schema.holding.ticker })
    .from(schema.holding)
    .where(inArray(schema.holding.ticker, importedTickers));

  // Get all tickers from sleeve members
  const sleeveTickers = await db
    .select({ ticker: schema.sleeveMember.ticker })
    .from(schema.sleeveMember)
    .where(inArray(schema.sleeveMember.ticker, importedTickers));

  // Get all tickers from index members
  const indexTickers = await db
    .select({ ticker: schema.indexMember.securityId })
    .from(schema.indexMember)
    .where(inArray(schema.indexMember.securityId, importedTickers));

  // Combine all unique tickers
  const relevantTickers = new Set<string>();

  for (const row of holdingsTickers) {
    relevantTickers.add(row.ticker);
  }
  for (const row of sleeveTickers) {
    relevantTickers.add(row.ticker);
  }
  for (const row of indexTickers) {
    relevantTickers.add(row.ticker);
  }

  return Array.from(relevantTickers);
}

// Import dependencies for functions that reference other modules
