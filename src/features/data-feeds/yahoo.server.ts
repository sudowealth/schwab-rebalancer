import { createServerFn } from '@tanstack/react-start';
import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import yahooFinance from 'yahoo-finance2';
import * as schema from '~/db/schema';
import { requireAuth } from '~/features/auth/auth-utils';
import { isAnyCashTicker } from '~/lib/constants';
import { clearCache, getPositions } from '~/lib/db-api';
import { getDb } from '~/lib/db-config';
import { getErrorMessage } from '~/lib/error-handler';

// biome-ignore lint/complexity/noBannedTypes: Change tracking needs to accept arbitrary non-null values
export type FieldChangeSet = Record<string, { old: {}; new: {} }>;

type FieldChangeValue = FieldChangeSet[string]['old'];

export interface YahooSyncChangeDetail {
  ticker: string;
  success: boolean;
  error?: string;
  changes?: FieldChangeSet;
}

export interface SyncYahooFundamentalsResult {
  success: boolean;
  recordsProcessed: number;
  errorMessage?: string;
  details: YahooSyncChangeDetail[];
  logId: `${string}-${string}-${string}-${string}-${string}`;
}

const normalizeChangeValue = (value: unknown): FieldChangeValue => {
  if (value === null) return 'null' as FieldChangeValue;
  if (typeof value === 'undefined') return 'undefined' as FieldChangeValue;
  return value as FieldChangeValue;
};

// Yahoo Finance Integration - Update security fundamentals and price
export const syncYahooFundamentalsServerFn = createServerFn({ method: 'POST' })
  .validator(
    (data: {
      scope?:
        | 'all-securities'
        | 'held-sleeve-securities'
        | 'held-sleeve-securities-missing-data'
        | 'all-holdings'
        | 'all-sleeves'
        | 'missing-fundamentals'
        | 'missing-fundamentals-holdings'
        | 'missing-fundamentals-sleeves';
      symbols?: string[];
    }): {
      scope?:
        | 'all-securities'
        | 'held-sleeve-securities'
        | 'held-sleeve-securities-missing-data'
        | 'all-holdings'
        | 'all-sleeves'
        | 'missing-fundamentals'
        | 'missing-fundamentals-holdings'
        | 'missing-fundamentals-sleeves';
      symbols?: string[];
    } => data,
  )

  .handler(async ({ data, context: _context }): Promise<SyncYahooFundamentalsResult> => {
    const { user } = await requireAuth();
    const scope = data.scope;
    const explicitSymbols = data.symbols;

    // Determine symbols to update
    let symbols: string[] = [];
    if (Array.isArray(explicitSymbols) && explicitSymbols.length > 0) {
      symbols = explicitSymbols;
    } else if (scope === 'held-sleeve-securities') {
      // All securities that are either held or appear in sleeves

      const positions = await getPositions(user.id);
      const heldTickers = new Set(positions.map((p) => p.ticker));

      const sleeveSecurities = await getDb()
        .select({
          ticker: schema.sleeveMember.ticker,
        })
        .from(schema.sleeveMember)
        .innerJoin(schema.sleeve, eq(schema.sleeveMember.sleeveId, schema.sleeve.id))
        .where(eq(schema.sleeve.userId, user.id));

      const sleeveTickers = new Set(sleeveSecurities.map((s) => s.ticker));

      // Combine held and sleeve securities
      const combinedTickers = new Set([...heldTickers, ...sleeveTickers]);
      symbols = Array.from(combinedTickers).filter((t) => !isAnyCashTicker(t));
    } else if (scope === 'held-sleeve-securities-missing-data') {
      // All securities that are either held or appear in sleeves AND are missing fundamentals

      const positions = await getPositions(user.id);
      const heldTickers = new Set(positions.map((p) => p.ticker));

      const sleeveSecurities = await getDb()
        .select({
          ticker: schema.sleeveMember.ticker,
        })
        .from(schema.sleeveMember)
        .innerJoin(schema.sleeve, eq(schema.sleeveMember.sleeveId, schema.sleeve.id))
        .where(eq(schema.sleeve.userId, user.id));

      const sleeveTickers = new Set(sleeveSecurities.map((s) => s.ticker));

      // Combine held and sleeve securities
      const combinedTickers = new Set([...heldTickers, ...sleeveTickers]);

      // Filter for securities that are missing fundamentals data or have placeholder price of 1
      const missingDataSecurities = await getDb()
        .select({ ticker: schema.security.ticker, price: schema.security.price })
        .from(schema.security)
        .where(
          and(
            inArray(schema.security.ticker, Array.from(combinedTickers)),
            or(
              isNull(schema.security.sector),
              isNull(schema.security.industry),
              isNull(schema.security.marketCap),
              eq(schema.security.price, 1),
            ),
          ),
        );

      symbols = missingDataSecurities.map((s) => s.ticker).filter((t) => !isAnyCashTicker(t));
    } else if (scope === 'all-holdings') {
      const positions = await getPositions(user.id);
      const tickers = [...new Set(positions.map((p) => p.ticker))];
      symbols = tickers.filter((t) => !isAnyCashTicker(t));
    } else if (scope === 'all-sleeves') {
      // All securities used in sleeves
      const sleeveSecurities = await getDb()
        .select({
          ticker: schema.sleeveMember.ticker,
        })
        .from(schema.sleeveMember)
        .innerJoin(schema.sleeve, eq(schema.sleeveMember.sleeveId, schema.sleeve.id))
        .where(eq(schema.sleeve.userId, user.id));
      const sleeveTickers = new Set(sleeveSecurities.map((s) => s.ticker));
      symbols = Array.from(sleeveTickers).filter((t) => !isAnyCashTicker(t));
    } else if (scope === 'missing-fundamentals') {
      // Securities missing sector, industry, marketCap, or have placeholder price of 1
      const rows = await getDb()
        .select({
          ticker: schema.security.ticker,
          sector: schema.security.sector,
          industry: schema.security.industry,
          marketCap: schema.security.marketCap,
          price: schema.security.price,
        })
        .from(schema.security);
      symbols = rows
        .filter(
          (r) =>
            (!r.sector || !r.industry || !r.marketCap || r.price === 1) &&
            !isAnyCashTicker(r.ticker),
        )
        .map((r) => r.ticker);
    } else if (scope === 'missing-fundamentals-holdings') {
      // Held securities that are missing sector, industry, or marketCap

      const positions = await getPositions(user.id);
      const held = new Set(positions.map((p) => p.ticker));
      const rows = await getDb()
        .select({
          ticker: schema.security.ticker,
          sector: schema.security.sector,
          industry: schema.security.industry,
          marketCap: schema.security.marketCap,
          price: schema.security.price,
        })
        .from(schema.security);
      symbols = rows
        .filter((r) => held.has(r.ticker))
        .filter(
          (r) =>
            (!r.sector || !r.industry || !r.marketCap || r.price === 1) &&
            !isAnyCashTicker(r.ticker),
        )
        .map((r) => r.ticker);
    } else if (scope === 'missing-fundamentals-sleeves') {
      // Get securities used in sleeves that are missing fundamentals, plus model securities missing fundamentals (excluding ETFs)
      const sleeveSecurities = await getDb()
        .select({
          ticker: schema.sleeveMember.ticker,
        })
        .from(schema.sleeveMember)
        .innerJoin(schema.sleeve, eq(schema.sleeveMember.sleeveId, schema.sleeve.id))
        .where(eq(schema.sleeve.userId, user.id));
      const sleeveTickers = new Set(sleeveSecurities.map((s) => s.ticker));

      // Get securities used in models that are missing marketCap and are not ETFs
      const modelSecurities = await getDb()
        .select({
          ticker: schema.sleeveMember.ticker,
        })
        .from(schema.modelMember)
        .innerJoin(schema.sleeve, eq(schema.modelMember.sleeveId, schema.sleeve.id))
        .innerJoin(schema.sleeveMember, eq(schema.sleeveMember.sleeveId, schema.sleeve.id))
        .innerJoin(schema.model, eq(schema.modelMember.modelId, schema.model.id))
        .where(eq(schema.model.userId, user.id));
      const modelTickers = new Set(modelSecurities.map((s) => s.ticker));

      const rows = await getDb()
        .select({
          ticker: schema.security.ticker,
          sector: schema.security.sector,
          industry: schema.security.industry,
          marketCap: schema.security.marketCap,
          price: schema.security.price,
          assetTypeSub: schema.security.assetTypeSub,
        })
        .from(schema.security);

      const sleeveSymbols = rows
        .filter((r) => sleeveTickers.has(r.ticker))
        .filter(
          (r) =>
            (!r.sector || !r.industry || !r.marketCap || r.price === 1) &&
            !isAnyCashTicker(r.ticker),
        )
        .map((r) => r.ticker);

      const modelSymbols = rows
        .filter((r) => modelTickers.has(r.ticker))
        .filter(
          (r) =>
            (!r.sector || !r.industry || !r.marketCap || r.price === 1) &&
            r.assetTypeSub !== 'ETF' &&
            !isAnyCashTicker(r.ticker),
        )
        .map((r) => r.ticker);

      // Combine both sets of symbols
      symbols = [...new Set([...sleeveSymbols, ...modelSymbols])];
    } else {
      // Default and 'all-securities' -> all securities
      const all = await getDb().select({ ticker: schema.security.ticker }).from(schema.security);
      symbols = all.map((s) => s.ticker).filter((t) => !isAnyCashTicker(t));
    }

    if (symbols.length === 0) {
      const emptyLogId = crypto.randomUUID();
      const details: SyncYahooFundamentalsResult['details'] = [];
      return {
        success: true,
        recordsProcessed: 0,
        details,
        logId: emptyLogId as `${string}-${string}-${string}-${string}-${string}`,
      } satisfies SyncYahooFundamentalsResult;
    }

    // Create sync log entry
    const logId = crypto.randomUUID();
    try {
      await getDb()
        .insert(schema.syncLog)
        .values({
          id: logId,
          userId: user.id,
          syncType: 'YAHOO',
          status: 'RUNNING',
          recordsProcessed: 0,
          startedAt: new Date(),
          createdAt: new Date(),
        } as unknown as typeof schema.syncLog.$inferInsert);
    } catch {
      // Ignore logging failure when creating sync log
    }

    const results: SyncYahooFundamentalsResult['details'] = [];

    // Fetch and update each symbol
    for (const symbol of symbols) {
      try {
        // Replace dots with dashes for Yahoo Finance API (e.g., BRK.A -> BRK-A)
        const yahooTicker = symbol.replace(/\./g, '-');
        const summary = await yahooFinance.quoteSummary(yahooTicker, {
          modules: ['assetProfile', 'price', 'summaryDetail', 'defaultKeyStatistics'],
        } as unknown as Record<string, unknown>);

        const price = summary.price?.regularMarketPrice ?? null;
        const marketCapRaw = summary.price?.marketCap ?? summary.summaryDetail?.marketCap ?? null;
        const marketCapMillions = marketCapRaw
          ? Math.round(Number(marketCapRaw) / 1_000_000)
          : null;
        const peRatio = summary.summaryDetail?.trailingPE ?? null;
        const sector = summary.assetProfile?.sector ?? null;
        const industry = summary.assetProfile?.industry ?? null;

        // Read existing values for change set
        const current = await getDb()
          .select({
            price: schema.security.price,
            marketCap: schema.security.marketCap,
            peRatio: schema.security.peRatio,
            sector: schema.security.sector,
            industry: schema.security.industry,
          })
          .from(schema.security)
          .where(eq(schema.security.ticker, symbol))
          .limit(1);

        if (current.length === 0) {
          results.push({
            ticker: symbol,
            success: false,
            error: 'Security not found',
          });
          continue;
        }

        const updateData: Record<string, unknown> = { updatedAt: new Date() };
        const changes: FieldChangeSet = {};

        if (typeof price === 'number') {
          updateData.price = price;
          changes.price = {
            old: normalizeChangeValue(current[0].price),
            new: normalizeChangeValue(price),
          };
        }
        if (typeof marketCapMillions === 'number') {
          updateData.marketCap = marketCapMillions;
          changes.marketCap = {
            old: normalizeChangeValue(current[0].marketCap),
            new: normalizeChangeValue(marketCapMillions),
          };
        }
        if (typeof peRatio === 'number') {
          updateData.peRatio = peRatio;
          changes.peRatio = {
            old: normalizeChangeValue(current[0].peRatio),
            new: normalizeChangeValue(peRatio),
          };
        }
        // Only update sector if we have a valid non-empty value and the current value is null/empty
        if (
          sector &&
          typeof sector === 'string' &&
          sector.trim().length > 0 &&
          !current[0].sector
        ) {
          updateData.sector = sector.trim();
          changes.sector = {
            old: normalizeChangeValue(current[0].sector),
            new: normalizeChangeValue(sector.trim()),
          };
        }
        // Only update industry if we have a valid non-empty value and the current value is null/empty
        if (
          industry &&
          typeof industry === 'string' &&
          industry.trim().length > 0 &&
          !current[0].industry
        ) {
          updateData.industry = industry.trim();
          changes.industry = {
            old: normalizeChangeValue(current[0].industry),
            new: normalizeChangeValue(industry.trim()),
          };
        }

        if (Object.keys(updateData).length > 0) {
          await getDb()
            .update(schema.security)
            .set(updateData)
            .where(eq(schema.security.ticker, symbol));
        }

        // Persist per-symbol detail
        try {
          await getDb()
            .insert(schema.syncLogDetail)
            .values({
              id: crypto.randomUUID(),
              logId,
              entityType: 'SECURITY',
              entityId: symbol,
              operation: 'UPDATE',
              changes: JSON.stringify(changes),
              success: true,
              createdAt: new Date(),
            } as unknown as typeof schema.syncLogDetail.$inferInsert);
        } catch {
          // Non-fatal detail logging failure
        }

        results.push({ ticker: symbol, success: true, changes });
        // small delay to avoid rate limits
        await new Promise((r) => setTimeout(r, 100));
      } catch (error) {
        const message = getErrorMessage(error);
        try {
          await getDb()
            .insert(schema.syncLogDetail)
            .values({
              id: crypto.randomUUID(),
              logId,
              entityType: 'SECURITY',
              entityId: symbol,
              operation: 'NOOP',
              changes: JSON.stringify({}),
              success: false,
              message,
              createdAt: new Date(),
            } as unknown as typeof schema.syncLogDetail.$inferInsert);
        } catch {
          // Non-fatal detail logging failure
        }
        results.push({ ticker: symbol, success: false, error: message });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const errorCount = results.length - successCount;
    try {
      await getDb()
        .update(schema.syncLog)
        .set({
          status: errorCount > 0 ? 'PARTIAL' : 'SUCCESS',
          recordsProcessed: successCount,
          errorMessage: errorCount > 0 ? `${errorCount} updates failed` : undefined,
          completedAt: new Date(),
        })
        .where(eq(schema.syncLog.id, logId));
    } catch {
      // Ignore completion logging failure
    }

    // Clear caches that depend on security data
    if (successCount > 0) {
      console.log('🧹 [ServerFn] Clearing caches after successful Yahoo fundamentals sync');

      // Clear caches that depend on security data
      clearCache('sp500-data'); // Clear S&P 500 data since fundamentals have been updated
      clearCache(`positions-${user.id}`); // Clear positions cache since fundamentals affect position values
      clearCache(`metrics-${user.id}`); // Clear metrics cache since fundamentals affect portfolio metrics
    }

    return {
      success: errorCount === 0,
      recordsProcessed: successCount,
      errorMessage: errorCount > 0 ? `${errorCount} updates failed` : undefined,
      details: results,
      logId: logId as `${string}-${string}-${string}-${string}-${string}`,
    } satisfies SyncYahooFundamentalsResult;
  });
