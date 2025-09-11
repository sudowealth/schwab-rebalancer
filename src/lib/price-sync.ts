import { eq, inArray } from 'drizzle-orm';
import yahooFinance from 'yahoo-finance2';
import * as schema from '../db/schema';
import { CASH_TICKER, MANUAL_CASH_TICKER } from './constants';
import { getDatabase } from './db-config';
import { getSchwabApiService } from './schwab-api';

export interface PriceUpdateResult {
  ticker: string;
  oldPrice: number;
  newPrice: number;
  source: 'SCHWAB' | 'YAHOO' | 'CACHED';
  success: boolean;
  error?: string;
  changes?: Record<string, { old: unknown; new: unknown }>;
}

export interface PriceSyncOptions {
  userId?: string;
  symbols?: string[];
  forceRefresh?: boolean;
  maxAge?: number; // Max age in seconds for cached prices
}

export class PriceSyncService {
  private db = getDatabase();
  private cache = new Map<string, { price: number; timestamp: number }>();
  private readonly DEFAULT_MAX_AGE = 60; // 60 seconds default cache
  private readonly MAX_QUOTES_PER_REQUEST = 150;

  async syncPrices(options: PriceSyncOptions = {}): Promise<PriceUpdateResult[]> {
    const { userId, symbols, forceRefresh = false, maxAge = this.DEFAULT_MAX_AGE } = options;

    // Determine which symbols to update
    let symbolsToUpdate: string[];

    if (symbols && symbols.length > 0) {
      symbolsToUpdate = symbols;
    } else {
      // Get all symbols from securities table, excluding cash tickers
      const securities = await this.db
        .select({ ticker: schema.security.ticker })
        .from(schema.security);

      symbolsToUpdate = securities
        .map((s) => s.ticker)
        .filter((t) => t !== CASH_TICKER && t !== MANUAL_CASH_TICKER);
    }

    if (symbolsToUpdate.length === 0) {
      return [];
    }

    const results: PriceUpdateResult[] = [];

    // Get current prices from database
    const currentSecurities = await this.db
      .select({
        ticker: schema.security.ticker,
        price: schema.security.price,
        updatedAt: schema.security.updatedAt,
        name: schema.security.name,
        assetType: schema.security.assetType,
        assetTypeSub: schema.security.assetTypeSub,
      })
      .from(schema.security)
      .where(inArray(schema.security.ticker, symbolsToUpdate));

    const securityMap = new Map(currentSecurities.map((s) => [s.ticker, s]));

    // Partition symbols into cached vs needing refresh
    const symbolsNeedingRefresh: string[] = [];
    for (const symbol of symbolsToUpdate) {
      // Skip cash tickers during price sync
      if (symbol === CASH_TICKER || symbol === MANUAL_CASH_TICKER) {
        results.push({
          ticker: symbol,
          oldPrice: securityMap.get(symbol)?.price || 1,
          newPrice: securityMap.get(symbol)?.price || 1,
          source: 'CACHED',
          success: true,
        });
        continue;
      }
      const currentSecurity = securityMap.get(symbol);
      if (!forceRefresh && this.isPriceFresh(symbol, currentSecurity, maxAge)) {
        const oldPrice = currentSecurity?.price || 0;
        results.push({
          ticker: symbol,
          oldPrice,
          newPrice: oldPrice,
          source: 'CACHED',
          success: true,
        });
        continue;
      }
      symbolsNeedingRefresh.push(symbol);
    }

    if (symbolsNeedingRefresh.length === 0) {
      return results;
    }

    // Helper to chunk an array
    const chunk = <T>(arr: T[], size: number): T[][] => {
      const chunks: T[][] = [];
      for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
      return chunks;
    };

    const schwabApi = userId ? getSchwabApiService() : null;
    let schwabQuotes: Record<
      string,
      {
        lastPrice: number;
        mark: number;
        regularMarketPrice: number;
        assetMainType?: string;
        assetSubType?: string;
        description?: string;
      }
    > = {};
    let canUseSchwab = false;
    if (userId && schwabApi) {
      try {
        canUseSchwab = await schwabApi.hasValidCredentials(userId);
      } catch {
        // Fallback to Yahoo if Schwab credential check fails
        canUseSchwab = false;
      }
    }

    if (canUseSchwab && schwabApi) {
      const batches = chunk(symbolsNeedingRefresh, this.MAX_QUOTES_PER_REQUEST);
      for (const symbolsBatch of batches) {
        try {
          if (!userId) {
            throw new Error('Missing userId for price sync');
          }
          const batchQuotes = await schwabApi.getBulkQuotes(userId, symbolsBatch);
          schwabQuotes = { ...schwabQuotes, ...batchQuotes };
        } catch (err) {
          console.warn(
            '⚠️ [PriceSync] Schwab bulk quote batch failed, continuing with remaining and Yahoo fallback:',
            err,
          );
        }
        // Small delay between batches for safety
        await this.delay(150);
      }
    }

    // Now process each symbol, using Schwab quotes when available, else Yahoo fallback
    for (const symbol of symbolsNeedingRefresh) {
      try {
        const currentSecurity = securityMap.get(symbol);
        const oldPrice = currentSecurity?.price || 0;
        const oldName = (currentSecurity as { name?: string })?.name;
        const oldAssetType = (currentSecurity as { assetType?: string })?.assetType;
        const oldAssetTypeSub = (currentSecurity as { assetTypeSub?: string | null })?.assetTypeSub;
        const fieldChanges: Record<string, { old: unknown; new: unknown }> = {};

        let newPrice: number | null = null;
        let source: 'SCHWAB' | 'YAHOO' = 'YAHOO';

        const schwabQuote = schwabQuotes[symbol];
        if (schwabQuote) {
          newPrice =
            schwabQuote.lastPrice || schwabQuote.mark || schwabQuote.regularMarketPrice || null;
          source = 'SCHWAB';
          // Update optional metadata from Schwab
          const additionalInfo = {
            name: schwabQuote.description,
            assetType: schwabQuote.assetMainType,
            assetTypeSub: schwabQuote.assetSubType,
          } as { name?: string; assetType?: string; assetTypeSub?: string };
          if (additionalInfo.name || additionalInfo.assetType || additionalInfo.assetTypeSub) {
            const infoChanges = await this.updateSecurityInfo(symbol, additionalInfo);
            Object.assign(fieldChanges, infoChanges);
            if (additionalInfo.name && !fieldChanges.name) {
              fieldChanges.name = { old: oldName, new: additionalInfo.name };
            }
            if (additionalInfo.assetType && !fieldChanges.assetType) {
              fieldChanges.assetType = { old: oldAssetType, new: additionalInfo.assetType };
            }
            if (additionalInfo.assetTypeSub && !fieldChanges.assetTypeSub) {
              fieldChanges.assetTypeSub = {
                old: oldAssetTypeSub,
                new: additionalInfo.assetTypeSub,
              };
            }
          }
        }

        if (newPrice === null) {
          try {
            // Disable yahoo-finance2 strict validation to handle occasional schema drifts
            // Replace dots with dashes for Yahoo Finance API (e.g., BRK.A -> BRK-A)
            const yahooTicker = symbol.replace(/\./g, '-');
            const quoteRaw = await yahooFinance.quote(yahooTicker, {
              validateResult: false,
            } as unknown as Record<string, unknown>);
            const quote = (
              Array.isArray(quoteRaw) ? quoteRaw[0] : (quoteRaw as Record<string, unknown>)
            ) as Record<string, unknown>;
            const yahooPrice =
              (quote as { regularMarketPrice?: number; price?: number })?.regularMarketPrice ??
              (quote as { regularMarketPrice?: number; price?: number })?.price ??
              null;
            newPrice = typeof yahooPrice === 'number' ? yahooPrice : null;
            source = 'YAHOO';
          } catch (error) {
            console.warn(`❌ [PriceSync] Failed to get Yahoo price for ${symbol}:`, error);
          }
        }

        if (newPrice === null || newPrice <= 0) {
          results.push({
            ticker: symbol,
            oldPrice,
            newPrice: oldPrice,
            source,
            success: false,
            error: 'Unable to fetch valid price from any source',
          });
          continue;
        }

        // Ensure the security exists
        const existingSecurity = await this.db
          .select()
          .from(schema.security)
          .where(eq(schema.security.ticker, symbol))
          .limit(1);
        if (existingSecurity.length === 0) {
          results.push({
            ticker: symbol,
            oldPrice,
            newPrice: oldPrice,
            source,
            success: false,
            error: `Security ${symbol} not found in database`,
          });
          continue;
        }

        await this.db
          .update(schema.security)
          .set({ price: newPrice, updatedAt: Date.now() })
          .where(eq(schema.security.ticker, symbol));

        this.cache.set(symbol, { price: newPrice, timestamp: Date.now() });
        fieldChanges.price = { old: oldPrice, new: newPrice };
        results.push({
          ticker: symbol,
          oldPrice,
          newPrice,
          source,
          success: true,
          changes: fieldChanges,
        });
      } catch (error) {
        const currentPrice = securityMap.get(symbol)?.price || 0;
        results.push({
          ticker: symbol,
          oldPrice: currentPrice,
          newPrice: currentPrice,
          source: 'YAHOO',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  private isPriceFresh(
    symbol: string,
    security: { price: number; updatedAt: number } | undefined,
    maxAgeSeconds: number,
  ): boolean {
    if (!security) return false;

    // Check database timestamp
    const dbAge = (Date.now() - security.updatedAt) / 1000;
    if (dbAge <= maxAgeSeconds) return true;

    // Check cache
    const cached = this.cache.get(symbol);
    if (cached) {
      const cacheAge = (Date.now() - cached.timestamp) / 1000;
      return cacheAge <= maxAgeSeconds;
    }

    return false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async updateSecurityInfo(
    ticker: string,
    info: { name?: string; assetType?: string; assetTypeSub?: string },
  ): Promise<Record<string, { old: unknown; new: unknown }>> {
    try {
      const updateData: Record<string, unknown> = {};
      const changes: Record<string, { old: unknown; new: unknown }> = {};

      if (info.name) {
        // Fetch current to compute change
        const current = await this.db
          .select({ name: schema.security.name })
          .from(schema.security)
          .where(eq(schema.security.ticker, ticker))
          .limit(1);
        const oldName = current[0]?.name;
        if (oldName !== info.name) {
          updateData.name = info.name;
          changes.name = { old: oldName, new: info.name };
        }
      }

      if (info.assetType) {
        // Validate asset type against allowed values
        const validAssetTypes = [
          'BOND',
          'EQUITY',
          'FOREX',
          'FUTURE',
          'FUTURE_OPTION',
          'INDEX',
          'MUTUAL_FUND',
          'OPTION',
        ];

        const finalType = validAssetTypes.includes(info.assetType) ? info.assetType : 'EQUITY';
        if (!validAssetTypes.includes(info.assetType)) {
          console.warn(
            `⚠️ [PriceSync] Invalid asset type for ${ticker}: ${info.assetType}, using default EQUITY`,
          );
        }
        const current = await this.db
          .select({ assetType: schema.security.assetType })
          .from(schema.security)
          .where(eq(schema.security.ticker, ticker))
          .limit(1);
        const oldType = current[0]?.assetType;
        if (oldType !== finalType) {
          updateData.assetType = finalType;
          changes.assetType = { old: oldType, new: finalType };
        }
      }

      if (info.assetTypeSub !== undefined) {
        const rawSub = (info.assetTypeSub || '').toUpperCase().trim();
        const validAssetTypeSubs = [
          'COE',
          'PRF',
          'ADR',
          'GDR',
          'CEF',
          'ETF',
          'ETN',
          'UIT',
          'WAR',
          'RGT',
          'OEF',
          'MMF',
        ];
        const finalSub = validAssetTypeSubs.includes(rawSub) ? rawSub : null;
        if (rawSub && !validAssetTypeSubs.includes(rawSub)) {
          console.warn(
            `⚠️ [PriceSync] Invalid assetTypeSub for ${ticker}: ${info.assetTypeSub}, storing NULL`,
          );
        }
        const currentSub = await this.db
          .select({ assetTypeSub: schema.security.assetTypeSub })
          .from(schema.security)
          .where(eq(schema.security.ticker, ticker))
          .limit(1);
        const oldSub = currentSub[0]?.assetTypeSub ?? null;
        if (oldSub !== finalSub) {
          updateData.assetTypeSub = finalSub;
          changes.assetTypeSub = { old: oldSub, new: finalSub };
        }
      }

      if (Object.keys(updateData).length > 0) {
        updateData.updatedAt = Date.now();

        await this.db
          .update(schema.security)
          .set(updateData)
          .where(eq(schema.security.ticker, ticker));

        console.log(`✅ [PriceSync] Updated security info for ${ticker}:`, updateData);
      }
      return changes;
    } catch (error) {
      console.error(`❌ [PriceSync] Failed to update security info for ${ticker}:`, error);
      return {};
    }
  }

  // Clear cache (useful for testing or forcing fresh data)
  clearCache(): void {
    this.cache.clear();
  }

  // Get cache statistics
  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys()),
    };
  }

  // Enhanced price sync for specific securities with validation
  async syncSecurityPrices(
    securities: { ticker: string; expectedPrice?: number }[],
    options: Omit<PriceSyncOptions, 'symbols'> = {},
  ): Promise<PriceUpdateResult[]> {
    const symbols = securities.map((s) => s.ticker);
    const results = await this.syncPrices({ ...options, symbols });

    // Add validation for expected prices
    return results.map((result) => {
      const security = securities.find((s) => s.ticker === result.ticker);
      if (security?.expectedPrice) {
        const priceDiff = Math.abs(result.newPrice - security.expectedPrice);
        const priceVariance = priceDiff / security.expectedPrice;

        // Flag prices that vary by more than 20% from expected
        if (priceVariance > 0.2) {
          return {
            ...result,
            success: false,
            error: `Price variance too high: expected ~${security.expectedPrice}, got ${result.newPrice}`,
          };
        }
      }

      return result;
    });
  }
}

// Singleton instance
let priceSyncService: PriceSyncService | null = null;

export function getPriceSyncService(): PriceSyncService {
  if (!priceSyncService) {
    priceSyncService = new PriceSyncService();
  }
  return priceSyncService;
}

// Utility function for scheduled price updates
export async function scheduledPriceSync(userId?: string): Promise<{
  success: boolean;
  updatedCount: number;
  errorCount: number;
  results: PriceUpdateResult[];
}> {
  try {
    const priceSyncService = getPriceSyncService();
    const results = await priceSyncService.syncPrices({
      userId,
      forceRefresh: false,
      maxAge: 300, // 5 minutes for scheduled sync
    });

    const successCount = results.filter((r) => r.success).length;
    const errorCount = results.filter((r) => !r.success).length;

    return {
      success: errorCount === 0,
      updatedCount: successCount,
      errorCount,
      results,
    };
  } catch (error) {
    console.error('Scheduled price sync failed:', error);
    return {
      success: false,
      updatedCount: 0,
      errorCount: 1,
      results: [],
    };
  }
}
