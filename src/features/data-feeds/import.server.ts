import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { and, count, eq, inArray, isNull, ne, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import * as schema from '~/db/schema';
import {
  seedGlobalEquityModelData,
  seedGlobalEquitySleeves,
} from '~/db/seeds/global-equity-model-seeder';
// Static imports for seed functions (previously dynamic)
import { seedDatabase } from '~/db/seeds/main';
import { seedSecurities } from '~/db/seeds/securities';
import { seedModels, seedSleeves, seedSP500Securities } from '~/db/seeds/sp500-model-seeder';
import { requireAdmin, requireAuth } from '~/features/auth/auth-utils';
import { CASH_TICKER, isAnyCashTicker } from '~/lib/constants';
import { clearCache, getPositions } from '~/lib/db-api';
import { getDb } from '~/lib/db-config';
import { getEnv } from '~/lib/env';
import { getErrorMessage, ValidationError } from '~/lib/error-handler';
import { throwServerError } from '~/lib/error-utils';
import {
  getSchwabCredentialsStatusServerFn,
  syncSchwabPricesServerFn,
} from '../schwab/schwab.server';
import type { SyncYahooFundamentalsResult } from './yahoo.server';
import { syncYahooFundamentalsServerFn } from './yahoo.server';

// Zod schemas for validation
const truncateDataSchema = z.object({
  confirmText: z.literal('TRUNCATE_ALL_DATA'),
});

const importNasdaqSecuritiesSchema = z.object({
  limit: z.number().min(1).max(10000).optional(),
  skipExisting: z.boolean().optional().default(true),
  feedType: z.enum(['all', 'nasdaqonly', 'nonnasdaq']).optional().default('all'),
});

// ================================
// NASDAQ IMPORT UTILITY FUNCTIONS (Single Responsibility)
// ================================

/**
 * Interface for parsed NASDAQ security data
 */
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

/**
 * Determines URLs to fetch based on feed type
 */
function determineNasdaqUrls(feedType: 'all' | 'nasdaqonly' | 'nonnasdaq'): string[] {
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
  return urls;
}

/**
 * Fetches data from NASDAQ URLs
 */
async function fetchNasdaqData(urls: string[]): Promise<string[]> {
  const fetchPromises = urls.map(async (url) => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch Nasdaq data from ${url}: ${response.status} ${response.statusText}`,
      );
    }
    return response.text();
  });

  return Promise.all(fetchPromises);
}

/**
 * Parses raw NASDAQ data into structured format
 */
function parseNasdaqData(responses: string[]): NasdaqSecurity[] {
  // Combine all lines from all responses
  const allLines: string[] = [];
  for (const responseText of responses) {
    const lines = responseText.split('\n').filter((line) => line.trim());
    allLines.push(...lines.slice(1)); // Skip header from each file
  }

  const parsedSecurities: NasdaqSecurity[] = [];
  for (const line of allLines) {
    const parts = line.split('|');
    if (parts.length >= 7) {
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

  return parsedSecurities;
}

/**
 * Imports parsed securities to database using bulk operations for better performance
 */
async function importSecuritiesToDatabase(
  securities: NasdaqSecurity[],
  skipExisting: boolean,
): Promise<{
  imported: number;
  skipped: number;
  errors: string[];
  importedTickers: string[];
}> {
  let skippedCount = 0;
  const errors: string[] = [];
  const importedTickers: string[] = [];

  // First pass: filter out test issues, invalid tickers, and prepare valid securities
  const validSecurities: NasdaqSecurity[] = [];
  for (const security of securities) {
    // Skip test issues
    if (security.testIssue === 'Y') {
      skippedCount++;
      continue;
    }

    const ticker = security.ticker;
    if (!ticker) {
      errors.push(`Security missing ticker: ${JSON.stringify(security)}`);
      continue;
    }

    // Filter out tickers that are too long (database constraint)
    if (ticker.length > 10) {
      skippedCount++;
      continue;
    }

    validSecurities.push(security);
  }

  if (validSecurities.length === 0) {
    return { imported: 0, skipped: skippedCount, errors, importedTickers };
  }

  // Check for existing securities in bulk if skipExisting is enabled
  let existingTickers = new Set<string>();
  if (skipExisting) {
    const allTickers = validSecurities.map((s) => s.ticker);
    const existing = await getDb()
      .select({ ticker: schema.security.ticker })
      .from(schema.security)
      .where(inArray(schema.security.ticker, allTickers));

    existingTickers = new Set(existing.map((e) => e.ticker));
  }

  // Filter out existing securities and prepare bulk insert data
  const securitiesToInsert = validSecurities.filter((security) => {
    if (skipExisting && existingTickers.has(security.ticker)) {
      skippedCount++;
      return false;
    }
    return true;
  });

  if (securitiesToInsert.length === 0) {
    return { imported: 0, skipped: skippedCount, errors, importedTickers };
  }

  // Prepare bulk insert data
  const insertData = securitiesToInsert.map((security) => {
    const ticker = security.ticker;

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

    return {
      ticker,
      name,
      price: 1, // Default price, will be updated later
      marketCap: null,
      peRatio: null,
      industry: null,
      sector: null,
      assetType,
      assetTypeSub,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  });

  // Perform batched bulk inserts with conflict handling
  const BATCH_SIZE = 500; // Insert in batches of 500 to avoid call stack issues
  let successfullyInserted = 0;

  try {
    // Process securities in batches
    for (let i = 0; i < insertData.length; i += BATCH_SIZE) {
      const batch = insertData.slice(i, i + BATCH_SIZE);

      await getDb()
        .insert(schema.security)
        .values(batch)
        .onConflictDoNothing({ target: schema.security.ticker });

      successfullyInserted += batch.length;
    }

    // Note: Drizzle doesn't return the number of affected rows for bulk inserts
    // We track successfully processed batches instead
    const importedCount = successfullyInserted;

    importedTickers.push(...securitiesToInsert.map((s) => s.ticker));

    return { imported: importedCount, skipped: skippedCount, errors, importedTickers };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    errors.push(`Batched bulk insert failed: ${errorMessage}`);
    return {
      imported: successfullyInserted,
      skipped: skippedCount + (securitiesToInsert.length - successfullyInserted),
      errors,
      importedTickers,
    };
  }
}

// ================================
// EXISTING UTILITY FUNCTIONS (Single Responsibility)
// ================================

/**
 * Seeds basic securities data
 */
async function seedBasicSecurities(): Promise<void> {
  await seedSecurities();
}

/**
 * Runs equity securities sync and returns result
 */
async function syncEquitySecurities(): Promise<EquitySyncResult> {
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

  return equitySyncResult;
}

/**
 * Seeds S&P 500 securities if they don't exist
 */
async function seedSP500SecuritiesIfNeeded(): Promise<void> {
  const sp500Index = await getDb()
    .select({ id: schema.indexTable.id })
    .from(schema.indexTable)
    .where(eq(schema.indexTable.id, 'sp500'))
    .limit(1);

  if (sp500Index.length === 0) {
    console.log('🔄 S&P 500 index not found, seeding S&P 500 securities...');
    await seedSP500Securities();
    console.log('✅ S&P 500 securities seeding completed');
  } else {
    console.log('⏭️ Skipping S&P 500 seeding - index already exists');
  }
}

// Define the equity sync result type
interface EquitySyncResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: string[];
  totalParsed: number;
  totalProcessed: number;
  importedTickers: string[];
}

/**
 * Performs automatic price sync for newly imported securities
 */
async function performPriceSyncForImportedSecurities(equitySyncResult: EquitySyncResult) {
  if (
    !equitySyncResult.success ||
    equitySyncResult.imported === 0 ||
    !equitySyncResult.importedTickers ||
    equitySyncResult.importedTickers.length === 0
  ) {
    return { success: true, recordsProcessed: 0, message: 'No securities to sync' };
  }

  try {
    const schwabStatus = await getSchwabCredentialsStatusServerFn();
    if (!schwabStatus?.hasCredentials) {
      return { success: true, recordsProcessed: 0, message: 'Schwab not connected' };
    }

    const relevantTickers = await filterImportedTickersForPriceSync(
      equitySyncResult.importedTickers,
    );

    if (relevantTickers.length === 0) {
      console.log(
        'ℹ️ No newly imported securities found in holdings, indices, or sleeves - skipping Schwab price sync',
      );
      return {
        success: true,
        recordsProcessed: 0,
        message: 'No relevant securities to sync',
      };
    }

    console.log(
      '🔄 Starting automatic Schwab price sync for relevant newly imported securities:',
      relevantTickers,
    );

    const syncResult = await syncSchwabPricesServerFn({
      data: { symbols: relevantTickers },
    });

    console.log('✅ Schwab price sync completed:', syncResult);
    return syncResult;
  } catch (error) {
    console.error('❌ Schwab price sync failed:', error);
    return {
      success: false,
      recordsProcessed: 0,
      errorMessage: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

// Server function to seed demo data - runs ONLY on server
export const seedDemoDataServerFn = createServerFn({ method: 'POST' }).handler(async () => {
  const { user } = await requireAuth();
  const _db = getDb();
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

// Server function to seed securities data - orchestrates the seeding process
export const seedSecuritiesDataServerFn = createServerFn({ method: 'POST' }).handler(async () => {
  console.log('🚀 seedSecuritiesDataServerFn: Starting securities seeding process');

  // Step 1: Authenticate user
  await requireAuth();
  console.log('✅ seedSecuritiesDataServerFn: Authentication successful');

  try {
    // Step 2: Seed basic securities data
    await seedBasicSecurities();

    // Step 3: Run equity securities sync
    const equitySyncResult = await syncEquitySecurities();

    // Step 4: Seed S&P 500 securities if needed
    await seedSP500SecuritiesIfNeeded();

    // Step 5: Perform price sync for imported securities
    const schwabSyncResult = await performPriceSyncForImportedSecurities(equitySyncResult);

    // Step 6: Run Yahoo sync for missing data (if securities were imported)
    let yahooSyncResult: SyncYahooFundamentalsResult | null = null;
    if (equitySyncResult.imported > 0) {
      try {
        console.log('🔄 Starting Yahoo sync for newly imported securities missing data...');
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
    } else {
      console.log('⏭️ Skipping Yahoo sync - no new securities were imported');
      yahooSyncResult = {
        success: true,
        recordsProcessed: 0,
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
  } catch (error) {
    console.error('❌ Securities seeding failed:', error);
    throw error;
  }
});

// Server function to seed models data - runs ONLY on server
export const seedModelsDataServerFn = createServerFn({ method: 'POST' }).handler(async () => {
  const { user } = await requireAuth();
  const _db = getDb();

  const sleevesResult = await seedSleeves(user.id);
  const modelsResult = await seedModels(user.id);

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
    const _db = getDb();

    const sleevesResult = await seedGlobalEquitySleeves(user.id);
    const modelsResult = await seedGlobalEquityModelData(user.id);

    return {
      success: true,
      models: modelsResult.models,
      sleeves: sleevesResult.sleeves,
      sleeveMembers: sleevesResult.sleeveMembers,
    };
  },
);

// Server function to import Nasdaq securities - runs ONLY on server
export const importNasdaqSecuritiesServerFn = createServerFn({ method: 'POST' })
  .inputValidator(importNasdaqSecuritiesSchema)
  .handler(async ({ data }) => {
    await requireAuth();
    const { limit, skipExisting = true, feedType = 'all' } = data;

    try {
      // Step 1: Determine URLs to fetch
      const urls = determineNasdaqUrls(feedType);

      // Step 2: Fetch data from NASDAQ
      const responses = await fetchNasdaqData(urls);

      // Step 3: Parse the raw data
      const parsedSecurities = parseNasdaqData(responses);

      // Step 4: Apply limit if specified
      const securitiesToProcess = limit ? parsedSecurities.slice(0, limit) : parsedSecurities;

      // Step 5: Import to database
      const result = await importSecuritiesToDatabase(securitiesToProcess, skipExisting);

      // Step 6: Clear cache to refresh data
      clearCache();

      return {
        success: true,
        imported: result.imported,
        skipped: result.skipped,
        errors: result.errors,
        totalParsed: parsedSecurities.length,
        totalProcessed: securitiesToProcess.length,
        importedTickers: result.importedTickers,
      };
    } catch (error) {
      console.error('Failed to import Nasdaq securities');
      throw new ValidationError('Failed to import Nasdaq securities', getErrorMessage(error));
    }
  });

// Server function to truncate data - runs ONLY on server
export const truncateDataServerFn = createServerFn({ method: 'POST' })
  .inputValidator(truncateDataSchema)
  .handler(async ({ data: _data }) => {
    // Only admins can truncate data
    const { user } = await requireAdmin();

    try {
      // Get request info for audit logging
      if (!import.meta.env.SSR) {
        throwServerError('truncateDataServerFn is only available on the server', 500);
      }
      const request = getRequest();

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
          await getDb().execute(sql`DELETE FROM ${sql.identifier(tableName)}`);
          truncatedTables.push(tableName);
        } catch (tableError) {
          failedTables.push(tableName);
          console.error(`Failed to truncate table: ${tableName}`, tableError);
        }
      }

      // Log the truncation in audit log
      await getDb()
        .insert(schema.auditLog)
        .values({
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
  const _db = getDb();

  // Get total securities count
  const totalSecurities = await getDb()
    .select({ count: count() })
    .from(schema.security)
    .where(ne(schema.security.ticker, CASH_TICKER));

  // Get securities missing fundamentals
  const missingFundamentals = await getDb()
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

  const positions = await getPositions(user.id);
  const heldTickers = [...new Set(positions.map((p) => p.ticker))].filter(
    (t) => !isAnyCashTicker(t),
  );

  // Get held securities missing fundamentals
  const heldMissingFundamentals = await getDb()
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
  const sleeveSecurities = await getDb()
    .select({
      ticker: schema.sleeveMember.ticker,
    })
    .from(schema.sleeveMember)
    .innerJoin(schema.sleeve, eq(schema.sleeveMember.sleeveId, schema.sleeve.id))
    .where(eq(schema.sleeve.userId, user.id));

  const sleeveTickers = new Set(sleeveSecurities.map((s) => s.ticker));

  const sleeveMissingFundamentals = await getDb()
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
  const heldSleeveMissingFundamentals = await getDb()
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
  const _db = getDb();

  // Get count of securities (excluding only cash securities)
  // Securities import is complete when there are equity securities available
  const securitiesCount = await getDb()
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
  const _db = getDb();

  // Get count of models for this user
  const modelsCount = await getDb()
    .select({ count: count() })
    .from(schema.model)
    .where(eq(schema.model.userId, user.id));

  return {
    hasModels: Number(modelsCount[0]?.count ?? 0) > 0,
    modelsCount: Number(modelsCount[0]?.count ?? 0),
  };
});

// Check if rebalancing groups exist for the user
export const checkRebalancingGroupsExistServerFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { user } = await requireAuth();
    const _db = getDb();

    // Get count of rebalancing groups for this user
    const groupsCount = await getDb()
      .select({ count: count() })
      .from(schema.rebalancingGroup)
      .where(eq(schema.rebalancingGroup.userId, user.id));

    return {
      hasGroups: Number(groupsCount[0]?.count ?? 0) > 0,
      groupsCount: Number(groupsCount[0]?.count ?? 0),
    };
  },
);

// Check if Schwab API credentials are configured
export const checkSchwabCredentialsServerFn = createServerFn({ method: 'GET' }).handler(
  async () => {
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
async function filterImportedTickersForPriceSync(importedTickers: string[]): Promise<string[]> {
  if (importedTickers.length === 0) {
    return [];
  }

  // Get all tickers from holdings
  const holdingsTickers = await getDb()
    .select({ ticker: schema.holding.ticker })
    .from(schema.holding)
    .where(inArray(schema.holding.ticker, importedTickers));

  // Get all tickers from sleeve members
  const sleeveTickers = await getDb()
    .select({ ticker: schema.sleeveMember.ticker })
    .from(schema.sleeveMember)
    .where(inArray(schema.sleeveMember.ticker, importedTickers));

  // Get all tickers from index members
  const indexTickers = await getDb()
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
