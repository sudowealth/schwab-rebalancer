import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import * as schema from '~/db/schema';
import {
  type CreateModel,
  type CreateRebalancingGroup,
  type Model,
  ModelsSchema,
  type Order,
  OrdersSchema,
  type PortfolioMetrics,
  PortfolioMetricsSchema,
  type Position,
  PositionsSchema,
  type RebalancingGroup,
  RebalancingGroupsSchema,
  RestrictedSecuritiesSchema,
  type RestrictedSecurity,
  type Sleeve,
  SleevesSchema,
  SP500DataSchema,
  type SP500Stock,
  type Trade,
  TradesSchema,
  type Transaction,
  validateData,
} from '~/features/auth/schemas';
import { getDb } from './db-config';
import { DatabaseError, logError, ValidationError, withRetry } from './error-handler';
import { generateId } from './utils';

// Database connection - using global getDb() proxy for lazy initialization

// Format market cap from millions to appropriate display format
function formatMarketCap(millions: number): string {
  if (millions >= 1000000) {
    return `${(millions / 1000000).toFixed(1)}T`;
  }
  if (millions >= 1000) {
    return `${(millions / 1000).toFixed(1)}B`;
  }
  return `${millions}M`;
}

// Cache for frequently accessed data
const cache = new Map<string, { data: unknown; timestamp: number }>();

function getCached<T>(key: string, maxAge = 3600000): T | null {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < maxAge) {
    return cached.data as T;
  }
  return null;
}

function setCache(key: string, data: unknown): void {
  cache.set(key, { data, timestamp: Date.now() });
}

export const getSnP500Data = async () => {
  const cacheKey = 'sp500-data';
  const cached = getCached<SP500Stock[]>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    return await withRetry(
      async () => {
        const securities = await getDb()
          .select({
            ticker: schema.security.ticker,
            name: schema.security.name,
            price: schema.security.price,
            marketCap: schema.security.marketCap,
            peRatio: schema.security.peRatio,
            industry: schema.security.industry,
            sector: schema.security.sector,
          })
          .from(schema.security);

        // Return empty array if no securities found (e.g., after truncation)
        if (!securities || securities.length === 0) {
          const emptyData: SP500Stock[] = [];
          setCache(cacheKey, emptyData);
          return emptyData;
        }

        const sp500Data: SP500Stock[] = securities.map((security) => ({
          ticker: security.ticker,
          name: security.name,
          price: security.price,
          marketCap: security.marketCap ? formatMarketCap(security.marketCap) : '0',
          peRatio: security.peRatio || undefined,
          industry: security.industry || 'Unknown',
          sector: security.sector || 'Unknown',
        }));

        const validatedData = validateData(SP500DataSchema, sp500Data, 'S&P 500 data');
        setCache(cacheKey, validatedData);

        return validatedData;
      },
      3,
      1000,
      'getSnP500Data',
    );
  } catch (error) {
    logError(error, 'Failed to get S&P 500 data');
    if (error instanceof ValidationError) throw error;
    throw new DatabaseError('Failed to retrieve securities data', error);
  }
};

// Get all indices
export const getIndices = async (): Promise<Array<{ id: string; name: string }>> => {
  const cacheKey = 'indices';
  const cached = getCached<Array<{ id: string; name: string }>>(cacheKey);
  if (cached) {
    return cached;
  }

  const indices = await getDb()
    .select({
      id: schema.indexTable.id,
      name: schema.indexTable.name,
    })
    .from(schema.indexTable);

  setCache(cacheKey, indices);
  return indices;
};

// Get securities filtered by index
export const getSecuritiesByIndex = async (indexId?: string): Promise<SP500Stock[]> => {
  if (!indexId) {
    return getSnP500Data(); // Return all securities if no index specified
  }

  const cacheKey = `securities-by-index-${indexId}`;
  const cached = getCached<SP500Stock[]>(cacheKey);
  if (cached) {
    return cached;
  }

  // Get securities that are members of the specified index
  const securitiesInIndex = await getDb()
    .select({
      ticker: schema.security.ticker,
      name: schema.security.name,
      price: schema.security.price,
      marketCap: schema.security.marketCap,
      peRatio: schema.security.peRatio,
      industry: schema.security.industry,
      sector: schema.security.sector,
    })
    .from(schema.security)
    .innerJoin(schema.indexMember, eq(schema.security.ticker, schema.indexMember.securityId))
    .where(eq(schema.indexMember.indexId, indexId));

  const filteredData: SP500Stock[] = securitiesInIndex.map((security) => ({
    ticker: security.ticker,
    name: security.name,
    price: security.price,
    marketCap: security.marketCap ? formatMarketCap(security.marketCap) : '0',
    peRatio: security.peRatio || undefined,
    industry: security.industry || 'Unknown',
    sector: security.sector || 'Unknown',
  }));

  // Validate data
  const validatedData = validateData(
    SP500DataSchema,
    filteredData,
    `securities for index ${indexId}`,
  );
  setCache(cacheKey, validatedData);

  return validatedData;
};

export const getPositions = async (userId?: string) => {
  if (!userId?.trim()) {
    throw new ValidationError('User ID is required', 'userId');
  }

  console.log(`🔍 [getPositions] Called with userId: ${userId.substring(0, 10)}...`);

  const cacheKey = `positions-${userId}`;
  const cached = getCached<Position[]>(cacheKey);
  if (cached) {
    console.log('🔍 [getPositions] Returning cached result:', cached.length, 'positions');
    return cached;
  }

  console.log('🔍 [getPositions] Cache miss, querying database...');

  try {
    return await withRetry(
      async () => {
        // Get S&P 500 data for current prices
        const sp500Data = await getSnP500Data();
        const priceMap = new Map<string, number>(
          sp500Data.map((stock) => [stock.ticker, stock.price]),
        );

        // Also get prices from securities table for securities not in S&P 500
        const securitiesData = await getDb()
          .select({
            ticker: schema.security.ticker,
            price: schema.security.price,
          })
          .from(schema.security);

        // Merge securities prices into priceMap (S&P 500 takes precedence)
        for (const security of securitiesData) {
          if (!priceMap.has(security.ticker) && security.price > 0) {
            priceMap.set(security.ticker, security.price);
          }
        }

        // Ensure cash tickers are valued at $1
        priceMap.set('$$$', 1.0);
        priceMap.set('MCASH', 1.0);

        // Get holdings with related data - try with accountNumber first, fallback without it
        interface HoldingWithAccount {
          id: string;
          ticker: string;
          qty: number;
          costBasis: number;
          openedAt: Date;
          accountId: string;
          accountName: string;
          accountType: string;
          accountNumber?: string | null;
        }

        let holdings: HoldingWithAccount[];
        try {
          holdings = await getDb()
            .select({
              id: schema.holding.id,
              ticker: schema.holding.ticker,
              qty: schema.holding.qty,
              costBasis: schema.holding.averageCost,
              openedAt: schema.holding.openedAt,
              accountId: schema.account.id,
              accountName: schema.account.name,
              accountType: schema.account.type,
              accountNumber: schema.account.accountNumber,
            })
            .from(schema.holding)
            .innerJoin(schema.account, eq(schema.holding.accountId, schema.account.id))
            .where(eq(schema.account.userId, userId));

          console.log('🔍 [getPositions] Query result:', holdings.length, 'holdings found');
          if (holdings.length > 0) {
            console.log(
              '🔍 [getPositions] Sample holdings:',
              holdings.slice(0, 2).map((h) => ({
                id: h.id,
                ticker: h.ticker,
                accountId: h.accountId,
                accountName: h.accountName,
              })),
            );
          }
        } catch (_error) {
          console.log('🔍 [getPositions] Primary query failed, trying fallback query...');
          // If accountNumber column doesn't exist, query without it
          holdings = await getDb()
            .select({
              id: schema.holding.id,
              ticker: schema.holding.ticker,
              qty: schema.holding.qty,
              costBasis: schema.holding.averageCost,
              openedAt: schema.holding.openedAt,
              accountId: schema.account.id,
              accountName: schema.account.name,
              accountType: schema.account.type,
            })
            .from(schema.holding)
            .innerJoin(schema.account, eq(schema.holding.accountId, schema.account.id))
            .where(eq(schema.account.userId, userId));

          console.log(
            '🔍 [getPositions] Fallback query result:',
            holdings.length,
            'holdings found',
          );
        }

        // Get sleeve information for each ticker
        const sleeveMembers = await getDb()
          .select({
            ticker: schema.sleeveMember.ticker,
            sleeveId: schema.sleeve.id,
            sleeveName: schema.sleeve.name,
          })
          .from(schema.sleeveMember)
          .innerJoin(schema.sleeve, eq(schema.sleeveMember.sleeveId, schema.sleeve.id))
          .where(eq(schema.sleeveMember.isActive, true));

        // Create a map of ticker to sleeves
        const tickerToSleeves = new Map<string, Array<{ sleeveId: string; sleeveName: string }>>();
        for (const member of sleeveMembers) {
          if (!tickerToSleeves.has(member.ticker)) {
            tickerToSleeves.set(member.ticker, []);
          }
          tickerToSleeves.get(member.ticker)?.push({
            sleeveId: member.sleeveId,
            sleeveName: member.sleeveName,
          });
        }

        const positions: Position[] = holdings
          .map((holding) => {
            const currentPrice = priceMap.get(holding.ticker);

            // Skip holdings where we can't find price or quantity is not positive
            if (!currentPrice || holding.qty <= 0) {
              return null;
            }

            const qty = holding.qty;
            const costBasis = holding.costBasis;
            const marketValue = qty * currentPrice;
            const costValue = qty * costBasis;
            const dollarGainLoss = marketValue - costValue;
            const percentGainLoss = costValue > 0 ? (dollarGainLoss / costValue) * 100 : 0;

            const openedAt = holding.openedAt;
            const daysHeld = Math.floor((Date.now() - openedAt.getTime()) / (1000 * 60 * 60 * 24));

            // Get sleeve information from sleeve_member table
            const sleeves = tickerToSleeves.get(holding.ticker) || [];
            const primarySleeve = sleeves[0]; // For now, just use the first sleeve if multiple exist
            const sleeveId = primarySleeve?.sleeveId || '';
            const sleeveName = primarySleeve?.sleeveName || 'No Sleeve';

            return {
              id: holding.id,
              sleeveId: sleeveId,
              sleeveName: sleeveName,
              ticker: holding.ticker,
              qty: qty,
              costBasis: costBasis,
              currentPrice: currentPrice,
              marketValue: `$${marketValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              dollarGainLoss: `${dollarGainLoss >= 0 ? '' : '-'}$${Math.abs(dollarGainLoss).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              percentGainLoss: `${percentGainLoss >= 0 ? '' : '-'}${Math.abs(percentGainLoss).toFixed(2)}%`,
              daysHeld,
              openedAt,
              accountId: holding.accountId,
              accountName: holding.accountName,
              accountType: holding.accountType,
              accountNumber: holding.accountNumber || 'N/A', // Use actual value or fallback
            };
          })
          .filter((position): position is NonNullable<typeof position> => position !== null);

        setCache(cacheKey, positions);

        // Validate data
        const validatedData = validateData(PositionsSchema, positions, 'positions');

        setCache(cacheKey, validatedData);

        return validatedData;
      },
      3,
      1000,
      'getPositions',
    );
  } catch (error) {
    logError(error, 'Failed to get positions', { userId: 'redacted' });
    if (error instanceof ValidationError) throw error;
    throw new DatabaseError('Failed to retrieve positions', error);
  }
};

export async function getTransactions(userId: string) {
  const userAccounts = await getDb()
    .select({ id: schema.account.id })
    .from(schema.account)
    .where(eq(schema.account.userId, userId));

  if (userAccounts.length === 0) {
    return [];
  }
  const accountIds = userAccounts.map((a) => a.id);
  return getGroupTransactions(accountIds);
}

export async function getGroupTransactions(accountIds: string[]) {
  if (accountIds.length === 0) {
    return [];
  }

  // Join transactions with accounts and sleeves to get enriched data
  const rawTransactions = await getDb()
    .select({
      id: schema.transaction.id,
      accountId: schema.transaction.accountId,
      sleeveId: schema.transaction.sleeveId,
      ticker: schema.transaction.ticker,
      type: schema.transaction.type,
      qty: schema.transaction.qty,
      price: schema.transaction.price,
      realizedGainLoss: schema.transaction.realizedGainLoss,
      executedAt: schema.transaction.executedAt,
      createdAt: schema.transaction.createdAt,
      updatedAt: schema.transaction.updatedAt,
      accountName: schema.account.name,
      accountType: schema.account.type,
      accountNumber: schema.account.accountNumber,
      sleeveName: schema.sleeve.name,
    })
    .from(schema.transaction)
    .innerJoin(schema.account, eq(schema.transaction.accountId, schema.account.id))
    .leftJoin(schema.sleeve, eq(schema.transaction.sleeveId, schema.sleeve.id))
    .where(inArray(schema.transaction.accountId, accountIds))
    .orderBy(desc(schema.transaction.executedAt));

  // Transform to match Transaction type expectations
  const transactions: Transaction[] = rawTransactions.map((tx) => ({
    id: tx.id,
    accountId: tx.accountId,
    sleeveId: tx.sleeveId || '', // Convert null to empty string as expected by type
    ticker: tx.ticker,
    type: tx.type as 'BUY' | 'SELL',
    qty: tx.qty,
    price: tx.price,
    executedAt: tx.executedAt, // Already a Date object
    realizedGainLoss: tx.realizedGainLoss || 0, // Convert null to 0
    sleeveName: tx.sleeveName || '',
    accountName: tx.accountName,
    accountType: tx.accountType,
    accountNumber: tx.accountNumber || undefined,
    isLongTerm: undefined, // Not available in current schema
  }));

  return transactions;
}

export const getSleeves = async (userId?: string) => {
  // If no userId provided, return empty array for security
  if (!userId) {
    console.warn('getSleeves called without userId - returning empty array for security');
    return [];
  }

  const cacheKey = `sleeves-${userId}`;
  const cached = getCached<Sleeve[]>(cacheKey);
  if (cached) {
    return cached;
  }

  // Get S&P 500 data for current prices
  const sp500Data = await getSnP500Data();
  const priceMap = new Map<string, number>(sp500Data.map((stock) => [stock.ticker, stock.price]));

  // Get restricted securities
  const restrictedSecurities = await getRestrictedSecurities();
  const restrictedTickers = new Map(
    restrictedSecurities.map((r) => [
      r.ticker,
      {
        soldAt: r.soldAt.toLocaleDateString(),
        blockedUntil: r.blockedUntil.toLocaleDateString(),
      },
    ]),
  );

  // Get sleeves and members in one query
  const sleevesAndMembers = await getDb()
    .select({
      // Sleeve data
      sleeveId: schema.sleeve.id,
      sleeveName: schema.sleeve.name,
      sleeveIsActive: schema.sleeve.isActive,
      // Member data
      memberId: schema.sleeveMember.id,
      memberTicker: schema.sleeveMember.ticker,
      memberRank: schema.sleeveMember.rank,
      memberIsActive: schema.sleeveMember.isActive,
      memberIsLegacy: schema.sleeveMember.isLegacy,
    })
    .from(schema.sleeve)
    .leftJoin(
      schema.sleeveMember,
      and(
        eq(schema.sleeve.id, schema.sleeveMember.sleeveId),
        eq(schema.sleeveMember.isActive, true),
      ),
    )
    .where(and(eq(schema.sleeve.isActive, true), eq(schema.sleeve.userId, userId)))
    .orderBy(schema.sleeve.name, schema.sleeveMember.rank);

  // Get member tickers for holdings query
  const memberTickers = [
    ...new Set(
      sleevesAndMembers.map((row) => row.memberTicker).filter((ticker) => ticker !== null),
    ),
  ];

  // Get holdings for member tickers that belong to the user
  let holdingsData: Array<{
    id: string;
    ticker: string;
    qty: number;
    costBasis: number;
    openedAt: Date;
  }> = [];

  if (memberTickers.length > 0) {
    holdingsData = await getDb()
      .select({
        id: schema.holding.id,
        ticker: schema.holding.ticker,
        qty: schema.holding.qty,
        costBasis: schema.holding.averageCost,
        openedAt: schema.holding.openedAt,
      })
      .from(schema.holding)
      .innerJoin(schema.account, eq(schema.holding.accountId, schema.account.id))
      .where(and(inArray(schema.holding.ticker, memberTickers), eq(schema.account.userId, userId)));
  }

  // Group data by sleeve
  const sleevesMap = new Map<
    string,
    {
      id: string;
      name: string;
      members: Array<{
        id: string;
        ticker: string;
        rank: number;
        isActive: boolean;
        isLegacy: boolean;
      }>;
      holdings: Array<{
        id: string;
        ticker: string;
        qty: number;
        costBasis: number;
        openedAt: Date;
      }>;
    }
  >();

  // First, group sleeves and members
  for (const row of sleevesAndMembers) {
    let sleeve = sleevesMap.get(row.sleeveId);
    if (!sleeve) {
      sleeve = {
        id: row.sleeveId,
        name: row.sleeveName,
        members: [],
        holdings: [],
      };
      sleevesMap.set(row.sleeveId, sleeve);
    }

    // Add member if not already added
    if (row.memberId && row.memberTicker && !sleeve.members.some((m) => m.id === row.memberId)) {
      sleeve.members.push({
        id: row.memberId,
        ticker: row.memberTicker,
        rank: row.memberRank || 0,
        isActive: !!row.memberIsActive,
        isLegacy: !!row.memberIsLegacy || restrictedTickers.has(row.memberTicker),
      });
    }
  }

  // Then add holdings to the appropriate sleeves
  const holdingsByTicker = new Map<string, (typeof holdingsData)[0]>();
  holdingsData.forEach((holding) => {
    holdingsByTicker.set(holding.ticker, holding);
  });

  // Add holdings to sleeves that have members with matching tickers
  for (const sleeve of sleevesMap.values()) {
    for (const member of sleeve.members) {
      const holding = holdingsByTicker.get(member.ticker);
      if (holding && !sleeve.holdings.some((h) => h.ticker === holding.ticker)) {
        sleeve.holdings.push(holding);
      }
    }
  }

  // Process each sleeve to find position and create final result
  const sleevesWithMembers: Array<{
    id: string;
    name: string;
    members: Array<{
      id: string;
      ticker: string;
      rank: number;
      isActive: boolean;
      isLegacy: boolean;
    }>;
    position?: {
      id: string;
      sleeveId?: string;
      ticker: string;
      qty: number;
      costBasis: number;
      openedAt: Date;
      currentPrice?: number;
      marketValue?: number;
      dollarGainLoss?: number;
      percentGainLoss?: number;
    } | null;
    restrictedInfo?: string | { soldAt: string; blockedUntil: string };
  }> = [];

  for (const sleeve of sleevesMap.values()) {
    let position = null;

    // Find first available holding for any of this sleeve's member tickers
    for (const holding of sleeve.holdings) {
      const currentPrice = priceMap.get(holding.ticker) || 0;
      const qty = holding.qty;
      const costBasis = holding.costBasis;
      const marketValue = qty * currentPrice;
      const costValue = qty * costBasis;
      const dollarGainLoss = marketValue - costValue;
      const percentGainLoss = costValue > 0 ? (dollarGainLoss / costValue) * 100 : 0;

      position = {
        id: holding.id,
        sleeveId: sleeve.id,
        ticker: holding.ticker,
        qty: qty,
        costBasis: costBasis,
        currentPrice: currentPrice,
        marketValue,
        dollarGainLoss,
        percentGainLoss,
        openedAt: holding.openedAt,
      };
      break; // Use first available holding
    }

    sleevesWithMembers.push({
      id: sleeve.id,
      name: sleeve.name,
      members: sleeve.members,
      position,
      restrictedInfo: restrictedTickers.get(position?.ticker || ''),
    });
  }

  // Validate data
  const validatedData = validateData(SleevesSchema, sleevesWithMembers, 'sleeves');
  setCache(cacheKey, validatedData);

  return validatedData;
};

export const getRestrictedSecurities = async (): Promise<RestrictedSecurity[]> => {
  const cacheKey = 'restricted-securities';
  const cached = getCached<RestrictedSecurity[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const restrictedSecurities = await getDb()
    .select({
      ticker: schema.restrictedSecurity.ticker,
      sleeveId: schema.restrictedSecurity.sleeveId,
      sleeveName: schema.sleeve.name,
      lossAmount: schema.restrictedSecurity.lossAmount,
      soldAt: schema.restrictedSecurity.soldAt,
      blockedUntil: schema.restrictedSecurity.blockedUntil,
    })
    .from(schema.restrictedSecurity)
    .innerJoin(schema.sleeve, eq(schema.restrictedSecurity.sleeveId, schema.sleeve.id))
    .where(sql`${schema.restrictedSecurity.blockedUntil} > ${new Date()}`);

  const formattedRestrictedSecurities: RestrictedSecurity[] = restrictedSecurities.map((rs) => {
    const soldAt = rs.soldAt;
    const blockedUntil = rs.blockedUntil;
    const daysToUnblock = Math.ceil((blockedUntil.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    return {
      ticker: rs.ticker,
      sleeveId: rs.sleeveId,
      sleeveName: rs.sleeveName,
      lossAmount: `$${rs.lossAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      soldAt,
      blockedUntil,
      daysToUnblock: Math.max(0, daysToUnblock),
    };
  });

  // Validate data
  const validatedData = validateData(
    RestrictedSecuritiesSchema,
    formattedRestrictedSecurities,
    'restricted securities',
  );
  setCache(cacheKey, validatedData);

  return validatedData;
};

export const getPortfolioMetrics = async (userId?: string) => {
  // If no userId provided, return default empty metrics for security
  if (!userId) {
    console.warn(
      'getPortfolioMetrics called without userId - returning empty metrics for security',
    );
    return {
      totalMarketValue: 0,
      totalCostBasis: 0,
      unrealizedGain: 0,
      unrealizedGainPercent: 0,
      realizedGain: 0,
      realizedGainPercent: 0,
      totalGain: 0,
      totalGainPercent: 0,
      ytdHarvestedLosses: 0,
      harvestablelosses: 0,
      harvestingTarget: {
        year1Target: 0.03,
        steadyStateTarget: 0.02,
        currentProgress: 0,
      },
    };
  }

  const cacheKey = `portfolio-metrics-${userId}`;
  const cached = getCached<PortfolioMetrics>(cacheKey);
  if (cached) {
    return cached;
  }

  // Use recursion-safe approach to avoid circular dependencies
  const positions = await getPositions(userId);
  const transactions = await getTransactions(userId);

  // Calculate portfolio metrics
  let totalMarketValue = 0;
  let totalCostBasis = 0;

  for (const position of positions) {
    const marketValue = Number.parseFloat(position.marketValue.replace(/[$,]/g, '')) || 0;
    const costBasis = (position.costBasis || 0) * (position.qty || 0);

    totalMarketValue += marketValue;
    totalCostBasis += costBasis;
  }

  const unrealizedGain = totalMarketValue - totalCostBasis;
  const unrealizedGainPercent = totalCostBasis > 0 ? (unrealizedGain / totalCostBasis) * 100 : 0;

  // Calculate realized gains from transactions
  const realizedGain = transactions.reduce((sum, tx) => sum + (tx.realizedGainLoss || 0), 0);
  const realizedGainPercent = totalCostBasis > 0 ? (realizedGain / totalCostBasis) * 100 : 0;

  const totalGain = unrealizedGain + realizedGain;
  const totalGainPercent = totalCostBasis > 0 ? (totalGain / totalCostBasis) * 100 : 0;

  // Calculate YTD harvested losses (negative realized gains)
  const ytdHarvestedLosses = Math.abs(Math.min(0, realizedGain));

  // Calculate harvestable losses (positions meeting harvesting criteria) - only for taxable accounts
  let harvestablelosses = 0;
  const taxablePositionsForMetrics = positions.filter(
    (position) => position.accountType === 'TAXABLE',
  );
  for (const position of taxablePositionsForMetrics) {
    const dollarGainLoss = Number.parseFloat(position.dollarGainLoss.replace(/[$,]/g, '')) || 0;
    const percentGainLoss = Number.parseFloat(position.percentGainLoss.replace(/%/g, '')) || 0;

    // Same criteria as in getProposedTrades: -5% OR -$2,500 threshold
    if (
      dollarGainLoss < 0 &&
      (Math.abs(percentGainLoss) >= 5 || Math.abs(dollarGainLoss) >= 2500)
    ) {
      harvestablelosses += Math.abs(dollarGainLoss);
    }
  }

  const portfolioMetrics = {
    totalMarketValue,
    totalCostBasis,
    unrealizedGain,
    unrealizedGainPercent,
    realizedGain,
    realizedGainPercent,
    totalGain,
    totalGainPercent,
    ytdHarvestedLosses,
    harvestablelosses,
    harvestingTarget: {
      year1Target: 0.03, // 3% target for year 1
      steadyStateTarget: 0.02, // 2% target for steady state
      currentProgress: totalMarketValue > 0 ? ytdHarvestedLosses / totalMarketValue : 0,
    },
  };

  // Validate data
  const validatedData = validateData(PortfolioMetricsSchema, portfolioMetrics, 'portfolio metrics');
  setCache(cacheKey, validatedData);

  return validatedData;
};

export const getProposedTrades = async (userId?: string) => {
  // If no userId provided, return empty array for security
  if (!userId) {
    console.warn('getProposedTrades called without userId - returning empty array for security');
    return [];
  }

  const cacheKey = `proposed-trades-${userId}`;
  const cached = getCached<Trade[]>(cacheKey);
  if (cached) {
    return cached;
  }

  // Get current positions and restricted securities for this user
  const positions = await getPositions(userId);
  const restrictedSecurities = await getRestrictedSecurities();
  const sleeves = await getSleeves(userId);
  const sp500Data = await getSnP500Data();

  // Create a map of restricted tickers for quick lookup
  const restrictedTickers = new Set(restrictedSecurities.map((rs) => rs.ticker));

  // Create a map of sleeve names for quick lookup
  const sleeveNameMap = new Map(sleeves.map((s) => [s.id, s.name]));

  // Create a map of stock prices for quick lookup
  const priceMap = new Map(sp500Data.map((stock) => [stock.ticker, stock.price]));

  const trades: Trade[] = [];

  // Filter positions to only include taxable accounts (TLH only applies to taxable accounts)
  const taxablePositions = positions.filter((position) => position.accountType === 'TAXABLE');

  // Analyze each position for tax-loss harvesting opportunities
  for (const position of taxablePositions) {
    // Parse the gain/loss to determine if it's a loss
    const dollarGainLossStr = position.dollarGainLoss.replace(/[$,]/g, '');
    const dollarGainLoss = Number.parseFloat(dollarGainLossStr);

    // Only consider positions with losses (negative gain/loss)
    if (dollarGainLoss >= 0) {
      continue;
    }

    // Check if this security is restricted due to wash sale rules
    const isCurrentlyRestricted = restrictedTickers.has(position.ticker);

    // Calculate the loss amount (make it positive)
    const lossAmount = Math.abs(dollarGainLoss);

    // Calculate percentage loss for threshold check
    const percentLoss = Math.abs(Number.parseFloat(position.percentGainLoss.replace(/%/g, '')));

    // Only consider losses meeting the -5% OR -$2,500 threshold
    if (!(percentLoss >= 5 || lossAmount >= 2500)) {
      continue;
    }

    // Calculate days held to determine if it's long-term (>365 days) or short-term
    const isLongTerm = position.daysHeld > 365;

    // Calculate estimated tax savings (simplified calculation)
    // Long-term capital gains tax is typically lower than short-term
    // const taxRate = isLongTerm ? 0.2 : 0.37; // 20% for long-term, 37% for short-term (top bracket)
    // const estimatedTaxSavings = lossAmount * taxRate;

    // Find the sleeve to check for available replacement securities
    const sleeve = sleeves.find((s) => s.id === position.sleeveId);
    let canExecute = false;
    let blockingReason = '';
    let replacementTicker = '';

    if (isCurrentlyRestricted) {
      // This position itself is restricted due to wash sale rules
      blockingReason = 'Wash sale restriction';
      canExecute = false;
    } else if (sleeve) {
      // Look for an available replacement security in this sleeve
      // Find the next available security that's not the current position and not restricted
      const availableReplacements = sleeve.members.filter(
        (member) =>
          member.ticker !== position.ticker &&
          member.isActive &&
          !member.isLegacy &&
          !restrictedTickers.has(member.ticker),
      );

      if (availableReplacements.length > 0) {
        // Use the highest ranked available replacement
        const replacement = availableReplacements.sort((a, b) => a.rank - b.rank)[0];
        replacementTicker = replacement.ticker;
        canExecute = true;
      } else {
        // Check what's blocking execution
        const restrictedMembers = sleeve.members.filter(
          (member) =>
            member.ticker !== position.ticker &&
            (member.isLegacy || restrictedTickers.has(member.ticker)),
        );
        const inactiveMembers = sleeve.members.filter(
          (member) => member.ticker !== position.ticker && !member.isActive,
        );

        if (restrictedMembers.length > 0 && inactiveMembers.length === 0) {
          // Get detailed wash sale information for restricted members
          const washSaleDetails = await Promise.all(
            restrictedMembers.map(async (member) => {
              const restrictedInfo = restrictedSecurities.find((rs) => rs.ticker === member.ticker);
              if (restrictedInfo) {
                const soldDate = restrictedInfo.soldAt.toLocaleDateString('en-US', {
                  month: '2-digit',
                  day: '2-digit',
                  year: 'numeric',
                });
                return `- ${member.ticker} sold on ${soldDate} (${restrictedInfo.daysToUnblock} days left)`;
              }
              return `- ${member.ticker} (wash sale restriction)`;
            }),
          );

          const lossAmount = Math.abs(dollarGainLoss);
          const percentLoss = Math.abs(
            Number.parseFloat(position.percentGainLoss.replace(/%/g, '')),
          );

          blockingReason = `Unable to harvest $${lossAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${percentLoss.toFixed(2)}%) loss because of potential wash sales with all replacement securities:\n${washSaleDetails.join('\n')}`;
        } else if (inactiveMembers.length > 0 && restrictedMembers.length === 0) {
          blockingReason = `All replacement securities in this sleeve are inactive: ${inactiveMembers.map((m) => m.ticker).join(', ')}`;
        } else if (sleeve.members.length <= 1) {
          blockingReason = 'No replacement securities available in this sleeve';
        } else {
          blockingReason = `No available replacement securities: ${restrictedMembers.map((m) => `${m.ticker} (restricted)`).join(', ')}${restrictedMembers.length > 0 && inactiveMembers.length > 0 ? ', ' : ''}${inactiveMembers.map((m) => `${m.ticker} (inactive)`).join(', ')}`;
        }
        canExecute = false;
      }
    } else {
      blockingReason = `Sleeve not found: ${position.sleeveId}`;
      canExecute = false;
    }

    // Generate the proposed SELL trade
    const sellTrade = {
      id: `sell-${position.id}`,
      type: 'SELL' as const,
      ticker: position.ticker,
      sleeveId: position.sleeveId,
      sleeveName: sleeveNameMap.get(position.sleeveId) || position.sleeveName,
      qty: position.qty,
      currentPrice: position.currentPrice,
      estimatedValue: Number.parseFloat(position.marketValue.replace(/[$,]/g, '')),
      reason: `Sell ${position.ticker} to harvest $${lossAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${isLongTerm ? 'long-term' : 'short-term'} loss`,
      realizedGainLoss: dollarGainLoss, // This will be negative for losses
      replacementTicker: replacementTicker || undefined,
      canExecute,
      blockingReason: blockingReason || undefined,
      accountId: position.accountId,
      accountName: position.accountName,
      accountType: position.accountType,
      accountNumber: position.accountNumber || 'N/A', // Use actual value or fallback
    };

    trades.push(sellTrade);

    // Generate the corresponding BUY trade if we can execute
    if (canExecute && replacementTicker) {
      // Get the price for the replacement security with safety guards
      const rawReplacementPrice = priceMap.get(replacementTicker);
      const replacementPrice =
        typeof rawReplacementPrice === 'number' &&
        Number.isFinite(rawReplacementPrice) &&
        rawReplacementPrice > 0
          ? rawReplacementPrice
          : position.currentPrice && position.currentPrice > 0
            ? position.currentPrice
            : 0;

      // Calculate how many shares we can buy with the proceeds
      const sellProceeds = Number.parseFloat(position.marketValue.replace(/[$,]/g, ''));
      const buyQty = replacementPrice > 0 ? Math.floor(sellProceeds / replacementPrice) : 0;

      // Only create a buy trade when we can size at least 1 share and price is valid
      if (buyQty > 0 && replacementPrice > 0) {
        const buyTrade = {
          id: `buy-${position.id}`,
          type: 'BUY' as const,
          ticker: replacementTicker,
          sleeveId: position.sleeveId,
          sleeveName: sleeveNameMap.get(position.sleeveId) || position.sleeveName,
          qty: buyQty,
          currentPrice: replacementPrice,
          estimatedValue: buyQty * replacementPrice,
          reason: `Buy ${replacementTicker} as replacement for ${position.ticker}`,
          realizedGainLoss: 0, // BUY trades don't have realized gain/loss
          replacementTicker: position.ticker, // The ticker being replaced
          canExecute: true,
          blockingReason: undefined,
          accountId: position.accountId,
          accountName: position.accountName,
          accountType: position.accountType,
          accountNumber: position.accountNumber || 'N/A', // Use actual value or fallback
        };

        trades.push(buyTrade);
      }
    }
  }

  // Sort trades by sleeve ASC, then type DESC (SELL before BUY)
  trades.sort((a, b) => {
    // First sort by sleeve name
    const sleeveCompare = a.sleeveName.localeCompare(b.sleeveName);
    if (sleeveCompare !== 0) {
      return sleeveCompare;
    }
    // Then sort by type DESC (SELL before BUY)
    return b.type.localeCompare(a.type);
  });

  // Validate data
  const validatedData = validateData(TradesSchema, trades, 'trades');
  setCache(cacheKey, validatedData);

  return validatedData;
};

// Create a new sleeve with members
export const createSleeve = async (
  name: string,
  members: Array<{ ticker: string; rank: number; isLegacy?: boolean }>,
  userId: string,
): Promise<string> => {
  const sleeveId = generateId();

  // Check if sleeve name already exists
  const existingSleeves = await getDb()
    .select({ name: schema.sleeve.name })
    .from(schema.sleeve)
    .where(sql`${schema.sleeve.name} = ${name} AND ${schema.sleeve.userId} = ${userId}`);

  if (existingSleeves.length > 0) {
    throw new Error(`Sleeve name "${name}" already exists`);
  }

  // Ensure member tickers are unique within this sleeve definition
  const memberTickers = members.map((m) => m.ticker);
  const dupInMembers = memberTickers.filter((t, i) => memberTickers.indexOf(t) !== i);
  if (dupInMembers.length > 0) {
    throw new Error(
      `Duplicate tickers within the sleeve: ${Array.from(new Set(dupInMembers)).join(', ')}`,
    );
  }

  // Verify that all tickers exist in securities table
  const securities = await getDb()
    .select({ ticker: schema.security.ticker })
    .from(schema.security)
    .where(inArray(schema.security.ticker, memberTickers));

  const securityTickers = new Set(securities.map((s) => s.ticker));
  const invalidTickers = memberTickers.filter((ticker) => !securityTickers.has(ticker));

  if (invalidTickers.length > 0) {
    throw new Error(`Invalid tickers (not found in securities): ${invalidTickers.join(', ')}`);
  }

  const now = new Date();

  // Start transaction
  try {
    // Create the sleeve
    await getDb().insert(schema.sleeve).values({
      id: sleeveId,
      userId: userId,
      name: name,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    // Create sleeve members
    const memberRecords = members.map((member) => ({
      id: generateId(),
      sleeveId: sleeveId,
      ticker: member.ticker,
      rank: member.rank,
      isActive: true,
      isLegacy: member.isLegacy ?? false,
      createdAt: now,
      updatedAt: now,
    }));

    await getDb().insert(schema.sleeveMember).values(memberRecords);

    // Clear cache so that the new sleeve appears (user-scoped)
    clearCache(`sleeves-${userId}`);

    return sleeveId;
  } catch (error) {
    console.error('Error creating sleeve:', error);
    throw error;
  }
};

// Get all available securities for dropdown/autocomplete
export const getAvailableSecurities = async (): Promise<
  Array<{ ticker: string; name: string }>
> => {
  const cacheKey = 'available-securities';
  const cached = getCached<Array<{ ticker: string; name: string }>>(cacheKey);
  if (cached) {
    return cached;
  }

  const securities = await getDb()
    .select({
      ticker: schema.security.ticker,
      name: schema.security.name,
    })
    .from(schema.security)
    .where(sql`${schema.security.ticker} NOT IN ('$$$', 'MCASH')`)
    .orderBy(schema.security.ticker);

  setCache(cacheKey, securities);
  return securities;
};

// Update an existing sleeve
export const updateSleeve = async (
  sleeveId: string,
  name: string,
  members: Array<{ ticker: string; rank: number; isLegacy?: boolean }>,
): Promise<void> => {
  // Check if sleeve exists
  const existingSleeve = await getDb()
    .select({ id: schema.sleeve.id, name: schema.sleeve.name, userId: schema.sleeve.userId })
    .from(schema.sleeve)
    .where(eq(schema.sleeve.id, sleeveId))
    .limit(1);

  if (existingSleeve.length === 0) {
    throw new Error(`Sleeve with ID "${sleeveId}" not found`);
  }

  // Check if new name conflicts with other sleeves (excluding current sleeve)
  const conflictingSleeves = await getDb()
    .select({ name: schema.sleeve.name })
    .from(schema.sleeve)
    .where(
      sql`${schema.sleeve.name} = ${name} AND ${schema.sleeve.id} != ${sleeveId} AND ${schema.sleeve.userId} = ${existingSleeve[0].userId}`,
    );

  if (conflictingSleeves.length > 0) {
    throw new Error(`Sleeve name "${name}" already exists`);
  }

  // Ensure member tickers are unique within this sleeve definition
  const memberTickers = members.map((m) => m.ticker);
  const dupInMembers = memberTickers.filter((t, i) => memberTickers.indexOf(t) !== i);
  if (dupInMembers.length > 0) {
    throw new Error(
      `Duplicate tickers within the sleeve: ${Array.from(new Set(dupInMembers)).join(', ')}`,
    );
  }

  // Verify that all tickers exist in securities table
  const securities = await getDb()
    .select({ ticker: schema.security.ticker })
    .from(schema.security)
    .where(inArray(schema.security.ticker, memberTickers));

  const securityTickers = new Set(securities.map((s) => s.ticker));
  const invalidTickers = memberTickers.filter((ticker) => !securityTickers.has(ticker));

  if (invalidTickers.length > 0) {
    throw new Error(`Invalid tickers (not found in securities): ${invalidTickers.join(', ')}`);
  }

  const now = new Date();

  try {
    // Update sleeve name
    await getDb()
      .update(schema.sleeve)
      .set({
        name: name,
        updatedAt: now,
      })
      .where(eq(schema.sleeve.id, sleeveId));

    // Delete existing members
    await getDb().delete(schema.sleeveMember).where(eq(schema.sleeveMember.sleeveId, sleeveId));

    // Create new sleeve members
    const memberRecords = members.map((member) => ({
      id: generateId(),
      sleeveId: sleeveId,
      ticker: member.ticker,
      rank: member.rank,
      isActive: true,
      isLegacy: member.isLegacy ?? false,
      createdAt: now,
      updatedAt: now,
    }));

    await getDb().insert(schema.sleeveMember).values(memberRecords);

    // Clear cache so that the updated sleeve appears (user-scoped)
    clearCache(`sleeves-${existingSleeve[0].userId}`);
  } catch (error) {
    console.error('Error updating sleeve:', error);
    throw error;
  }
};

// Delete a sleeve
export const deleteSleeve = async (sleeveId: string): Promise<void> => {
  // Check if sleeve exists
  const existingSleeve = await getDb()
    .select({ id: schema.sleeve.id, name: schema.sleeve.name, userId: schema.sleeve.userId })
    .from(schema.sleeve)
    .where(eq(schema.sleeve.id, sleeveId))
    .limit(1);

  if (existingSleeve.length === 0) {
    throw new Error(`Sleeve with ID "${sleeveId}" not found`);
  }

  // Note: We don't check for holdings or transactions because the schema is set up with
  // onDelete: "set null" for sleeveId in both tables, so they will be preserved
  // with sleeveId set to null when the sleeve is deleted

  try {
    // Delete sleeve members first (due to foreign key constraints)
    await getDb().delete(schema.sleeveMember).where(eq(schema.sleeveMember.sleeveId, sleeveId));

    // Delete the sleeve
    await getDb().delete(schema.sleeve).where(eq(schema.sleeve.id, sleeveId));

    // Clear cache so that the deleted sleeve is removed (user-scoped)
    clearCache(`sleeves-${existingSleeve[0].userId}`);
  } catch (error) {
    console.error('Error deleting sleeve:', error);
    throw error;
  }
};

// Get sleeve by ID for editing
export const getSleeveById = async (sleeveId: string, userId?: string): Promise<Sleeve | null> => {
  const sleeves = await getSleeves(userId);
  return sleeves.find((sleeve) => sleeve.id === sleeveId) || null;
};

// Get holdings info for a sleeve (for delete confirmation)
export const getSleeveHoldingsInfo = async (
  sleeveId: string,
): Promise<{
  hasHoldings: boolean;
  holdingTicker?: string;
  holdingValue?: number;
}> => {
  // First get the sleeve member tickers
  const members = await getDb()
    .select({
      ticker: schema.sleeveMember.ticker,
    })
    .from(schema.sleeveMember)
    .where(eq(schema.sleeveMember.sleeveId, sleeveId));

  const memberTickers = members.map((m) => m.ticker);

  interface SleeveHoldingData {
    ticker: string;
    qty: number;
    costBasis: number;
  }

  let holdings: SleeveHoldingData[] = [];
  if (memberTickers.length > 0) {
    holdings = await getDb()
      .select({
        ticker: schema.holding.ticker,
        qty: schema.holding.qty,
        costBasis: schema.holding.averageCost,
      })
      .from(schema.holding)
      .where(inArray(schema.holding.ticker, memberTickers))
      .limit(1);
  }

  if (holdings.length === 0) {
    return { hasHoldings: false };
  }

  const holding = holdings[0];
  const holdingValue = holding.qty * holding.costBasis;
  return {
    hasHoldings: true,
    holdingTicker: holding.ticker,
    holdingValue: holdingValue,
  };
};

// Get all models with their members for a specific user
export const getModels = async (userId?: string) => {
  // If no userId provided, return empty array for security
  if (!userId) {
    console.warn('getModels called without userId - returning empty array for security');
    return [];
  }

  const cacheKey = `models-${userId}`;
  const cached = getCached<Model[]>(cacheKey);
  if (cached) {
    return cached;
  }

  // Single relational query to get all models with their members
  const modelsWithMembers = await getDb()
    .select({
      // Model data
      modelId: schema.model.id,
      modelName: schema.model.name,
      modelDescription: schema.model.description,
      modelIsActive: schema.model.isActive,
      modelCreatedAt: schema.model.createdAt,
      modelUpdatedAt: schema.model.updatedAt,
      // Member data
      memberId: schema.modelMember.id,
      memberSleeveId: schema.modelMember.sleeveId,
      memberTargetWeight: schema.modelMember.targetWeight,
      memberIsActive: schema.modelMember.isActive,
      sleeveName: schema.sleeve.name,
    })
    .from(schema.model)
    .leftJoin(
      schema.modelMember,
      and(eq(schema.model.id, schema.modelMember.modelId), eq(schema.modelMember.isActive, true)),
    )
    .leftJoin(schema.sleeve, eq(schema.modelMember.sleeveId, schema.sleeve.id))
    .where(and(eq(schema.model.isActive, true), eq(schema.model.userId, userId)))
    .orderBy(schema.model.name, schema.modelMember.targetWeight);

  // Group data by model
  const modelsMap = new Map<
    string,
    {
      id: string;
      name: string;
      description: string | null;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
      members: Array<{
        id: string;
        sleeveId: string;
        targetWeight: number;
        isActive: boolean;
        sleeveName?: string;
      }>;
    }
  >();

  for (const row of modelsWithMembers) {
    let model = modelsMap.get(row.modelId);
    if (!model) {
      model = {
        id: row.modelId,
        name: row.modelName,
        description: row.modelDescription,
        isActive: row.modelIsActive,
        createdAt: row.modelCreatedAt,
        updatedAt: row.modelUpdatedAt,
        members: [],
      };
      modelsMap.set(row.modelId, model);
    }

    // Add member if exists
    if (row.memberId && row.memberSleeveId) {
      model.members.push({
        id: row.memberId,
        sleeveId: row.memberSleeveId,
        sleeveName: row.sleeveName || undefined,
        targetWeight: row.memberTargetWeight || 0,
        isActive: !!row.memberIsActive,
      });
    }
  }

  // Convert to final format
  const finalModels: Model[] = Array.from(modelsMap.values()).map((model) => ({
    id: model.id,
    name: model.name,
    description: model.description || undefined,
    isActive: model.isActive,
    members: model.members,
    createdAt: model.createdAt,
    updatedAt: model.updatedAt,
  }));

  // Validate data
  const validatedData = validateData(ModelsSchema, finalModels, 'models');
  setCache(cacheKey, validatedData);

  return validatedData;
};

// Get model by ID
export const getModelById = async (modelId: string): Promise<Model | null> => {
  const model = await getDb()
    .select({
      id: schema.model.id,
      name: schema.model.name,
      description: schema.model.description,
      isActive: schema.model.isActive,
      createdAt: schema.model.createdAt,
      updatedAt: schema.model.updatedAt,
    })
    .from(schema.model)
    .where(eq(schema.model.id, modelId))
    .limit(1);

  if (model.length === 0) {
    return null;
  }

  // Get model members
  const members = await getDb()
    .select({
      id: schema.modelMember.id,
      sleeveId: schema.modelMember.sleeveId,
      targetWeight: schema.modelMember.targetWeight,
      isActive: schema.modelMember.isActive,
      sleeveName: schema.sleeve.name,
    })
    .from(schema.modelMember)
    .innerJoin(schema.sleeve, eq(schema.modelMember.sleeveId, schema.sleeve.id))
    .where(eq(schema.modelMember.modelId, modelId));

  return {
    id: model[0].id,
    name: model[0].name,
    description: model[0].description || undefined,
    isActive: model[0].isActive,
    members: members.map((member) => ({
      id: member.id,
      sleeveId: member.sleeveId,
      sleeveName: member.sleeveName,
      targetWeight: member.targetWeight,
      isActive: member.isActive,
    })),
    createdAt: model[0].createdAt,
    updatedAt: model[0].updatedAt,
  };
};

// Create a new model with members
export const createModel = async (data: CreateModel, userId: string): Promise<string> => {
  // Check if model name already exists
  const existingModels = await getDb()
    .select({ id: schema.model.id, name: schema.model.name })
    .from(schema.model)
    .where(sql`${schema.model.name} = ${data.name} AND ${schema.model.userId} = ${userId}`);

  if (existingModels.length > 0) {
    if (data.updateExisting) {
      // Update existing model instead of creating new one
      const existingModelId = existingModels[0].id;
      await updateModel(existingModelId, data);
      return existingModelId;
    }
    throw new Error(`Model name "${data.name}" already exists`);
  }

  const modelId = generateId();

  // Validate that sleeve IDs exist
  const memberSleeveIds = data.members.map((m) => m.sleeveId);
  if (memberSleeveIds.length > 0) {
    const sleeves = await getDb()
      .select({ id: schema.sleeve.id })
      .from(schema.sleeve)
      .where(inArray(schema.sleeve.id, memberSleeveIds));

    const existingSleeveIds = new Set(sleeves.map((s) => s.id));
    const invalidSleeveIds = memberSleeveIds.filter((id) => !existingSleeveIds.has(id));

    if (invalidSleeveIds.length > 0) {
      throw new Error(`Invalid sleeve IDs: ${invalidSleeveIds.join(', ')}`);
    }
  }

  // Validate that target weights sum to 10000 (100%)
  const totalWeight = data.members.reduce((sum, member) => sum + member.targetWeight, 0);
  if (totalWeight !== 10000) {
    throw new Error(
      `Target weights must sum to 100% (10000 basis points), got ${totalWeight / 100}%`,
    );
  }

  const now = new Date();

  try {
    // Create the model
    await getDb()
      .insert(schema.model)
      .values({
        id: modelId,
        userId: userId,
        name: data.name,
        description: data.description || null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

    // Create model members
    if (data.members.length > 0) {
      const memberRecords = data.members.map((member) => ({
        id: generateId(),
        modelId: modelId,
        sleeveId: member.sleeveId,
        targetWeight: member.targetWeight,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      }));

      await getDb().insert(schema.modelMember).values(memberRecords);
    }

    // Clear cache so that the new model appears (user-scoped)
    clearCache(`models-${userId}`);

    return modelId;
  } catch (error) {
    console.error('Error creating model:', error);
    throw error;
  }
};

// Update an existing model
export const updateModel = async (modelId: string, data: CreateModel): Promise<void> => {
  // Check if model exists
  const existingModel = await getDb()
    .select({ id: schema.model.id, name: schema.model.name, userId: schema.model.userId })
    .from(schema.model)
    .where(eq(schema.model.id, modelId))
    .limit(1);

  if (existingModel.length === 0) {
    throw new Error(`Model with ID "${modelId}" not found`);
  }

  // Check if new name conflicts with other models (excluding current model)
  const conflictingModels = await getDb()
    .select({ name: schema.model.name })
    .from(schema.model)
    .where(
      sql`${schema.model.name} = ${data.name} AND ${schema.model.id} != ${modelId} AND ${schema.model.userId} = ${existingModel[0].userId}`,
    );

  if (conflictingModels.length > 0) {
    throw new Error(`Model name "${data.name}" already exists`);
  }

  // Validate that sleeve IDs exist
  const memberSleeveIds = data.members.map((m) => m.sleeveId);
  if (memberSleeveIds.length > 0) {
    const sleeves = await getDb()
      .select({ id: schema.sleeve.id })
      .from(schema.sleeve)
      .where(inArray(schema.sleeve.id, memberSleeveIds));

    const existingSleeveIds = new Set(sleeves.map((s) => s.id));
    const invalidSleeveIds = memberSleeveIds.filter((id) => !existingSleeveIds.has(id));

    if (invalidSleeveIds.length > 0) {
      throw new Error(`Invalid sleeve IDs: ${invalidSleeveIds.join(', ')}`);
    }
  }

  // Validate that target weights sum to 10000 (100%)
  const totalWeight = data.members.reduce((sum, member) => sum + member.targetWeight, 0);
  if (totalWeight !== 10000) {
    throw new Error(
      `Target weights must sum to 100% (10000 basis points), got ${totalWeight / 100}%`,
    );
  }

  const now = new Date();

  try {
    // Update the model
    await getDb()
      .update(schema.model)
      .set({
        name: data.name,
        description: data.description || null,
        updatedAt: now,
      })
      .where(eq(schema.model.id, modelId));

    // Delete existing members
    await getDb().delete(schema.modelMember).where(eq(schema.modelMember.modelId, modelId));

    // Create new model members
    if (data.members.length > 0) {
      const memberRecords = data.members.map((member) => ({
        id: generateId(),
        modelId: modelId,
        sleeveId: member.sleeveId,
        targetWeight: member.targetWeight,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      }));

      await getDb().insert(schema.modelMember).values(memberRecords);
    }

    // Clear cache so that updated model appears (user-scoped)
    clearCache(`models-${existingModel[0].userId}`);
  } catch (error) {
    console.error('Error updating model:', error);
    throw error;
  }
};

// Delete a model and its members
export const deleteModel = async (modelId: string): Promise<void> => {
  // Check if model exists
  const existingModel = await getDb()
    .select({ id: schema.model.id, name: schema.model.name, userId: schema.model.userId })
    .from(schema.model)
    .where(eq(schema.model.id, modelId))
    .limit(1);

  if (existingModel.length === 0) {
    throw new Error(`Model with ID "${modelId}" not found`);
  }

  try {
    // Delete model members first (due to foreign key constraints)
    await getDb().delete(schema.modelMember).where(eq(schema.modelMember.modelId, modelId));

    // Delete the model
    await getDb().delete(schema.model).where(eq(schema.model.id, modelId));

    // Clear cache so that deleted model disappears (user-scoped)
    clearCache(`models-${existingModel[0].userId}`);
  } catch (error) {
    console.error('Error deleting model:', error);
    throw error;
  }
};

// Get all available sleeves for model creation/editing
export const getAvailableSleeves = async (): Promise<Array<{ id: string; name: string }>> => {
  const cacheKey = 'available-sleeves';
  const cached = getCached<Array<{ id: string; name: string }>>(cacheKey);
  if (cached) {
    return cached;
  }

  const sleeves = await getDb()
    .select({
      id: schema.sleeve.id,
      name: schema.sleeve.name,
    })
    .from(schema.sleeve)
    .where(eq(schema.sleeve.isActive, true))
    .orderBy(schema.sleeve.name);

  setCache(cacheKey, sleeves);
  return sleeves;
};

// Utility function to clear cache
export const clearCache = (key?: string): void => {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
};

const clearCacheByPattern = (pattern: string): void => {
  for (const key of cache.keys()) {
    if (key.startsWith(pattern)) {
      cache.delete(key);
    }
  }
};

// --- Orders / Blotter ---
export async function getOrdersForAccounts(accountIds: string[]): Promise<Order[]> {
  if (!accountIds.length) return [];
  const rows = await getDb()
    .select()
    .from(schema.tradeOrder)
    .where(inArray(schema.tradeOrder.accountId, accountIds))
    .orderBy(desc(schema.tradeOrder.createdAt));

  // Normalize date fields to Date
  const normalized = rows.map((r) => ({
    ...r,
    enteredAt: r.enteredAt ? new Date(r.enteredAt) : null,
    closeAt: r.closeAt ? new Date(r.closeAt) : null,
    cancelAt: r.cancelAt ? new Date(r.cancelAt) : null,
    placedAt: r.placedAt ? new Date(r.placedAt) : null,
    closedAt: r.closedAt ? new Date(r.closedAt) : null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
  return validateData(OrdersSchema, normalized, 'orders');
}

export async function addDraftOrdersFromProposedTrades(params: {
  userId: string;
  groupId: string;
  trades: Trade[];
  accountId?: string; // optional override
  batchLabel?: string;
}): Promise<{ created: number }> {
  const now = new Date();
  let created = 0;

  for (const t of params.trades) {
    // Skip if no qty or price
    if (!t.qty || !t.currentPrice) continue;
    const qty = Math.abs(t.qty);
    const side = t.type === 'BUY' ? 'BUY' : 'SELL';
    const accountId = params.accountId || t.accountId;
    if (!accountId) continue;

    const id = `order_${crypto.randomUUID()}`;
    const idempotencyKey = `${accountId}_${t.ticker}_${side}_${qty}_${Math.round(t.currentPrice * 100)}`;

    try {
      const row: typeof schema.tradeOrder.$inferInsert = {
        id,
        userId: params.userId,
        accountId,
        symbol: t.ticker,
        side,
        qty,
        type: 'MARKET',
        tif: 'DAY',
        session: 'NORMAL',
        status: 'DRAFT',
        previewWarnCount: 0,
        previewErrorCount: 0,
        cancelable: false,
        editable: true,
        filledQuantity: 0,
        remainingQuantity: qty,
        idempotencyKey,
        batchLabel: params.batchLabel || `rebalance-${params.groupId}`,
        createdAt: new Date(now),
        updatedAt: new Date(now),
      };
      await getDb().insert(schema.tradeOrder).values(row);
      created += 1;
    } catch {
      // Likely unique idempotency violation -> skip
      console.warn('Skipping duplicate draft order:', idempotencyKey);
    }
  }

  clearCache('orders');
  return { created };
}

export async function updateTradeOrder(
  id: string,
  updates: Partial<{
    symbol: string;
    side: 'BUY' | 'SELL';
    qty: number;
    type: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT';
    limit: number | null;
    stop: number | null;
    tif: 'DAY' | 'GTC';
    session: 'NORMAL' | 'AM' | 'PM' | 'ALL';
  }>,
): Promise<void> {
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof updates.symbol === 'string') set.symbol = updates.symbol;
  if (updates.side) set.side = updates.side;
  if (typeof updates.qty === 'number') set.qty = updates.qty;
  if (updates.type) set.type = updates.type;
  if (typeof updates.limit === 'number' || updates.limit === null)
    set.limit = updates.limit ?? null;
  if (typeof updates.stop === 'number' || updates.stop === null) set.stop = updates.stop ?? null;
  if (updates.tif) set.tif = updates.tif;
  if (updates.session) set.session = updates.session;

  await getDb().update(schema.tradeOrder).set(set).where(eq(schema.tradeOrder.id, id));
  clearCache('orders');
}

export async function deleteTradeOrder(id: string): Promise<void> {
  await getDb().delete(schema.tradeOrder).where(eq(schema.tradeOrder.id, id));
  clearCache('orders');
}

// Get securities data with optional filtering by index and search term
export const getFilteredSecuritiesData = async (
  indexId?: string,
  searchTerm?: string,
  page?: number,
  pageSize?: number,
  sortBy?: string,
  sortOrder?: 'asc' | 'desc',
): Promise<{
  securities: Array<{
    ticker: string;
    name: string;
    price: number;
    sector?: string;
    industry?: string;
    marketCap?: string;
    peRatio?: number;
  }>;
  indices: Array<{
    id: string;
    name: string;
    description?: string;
  }>;
  indexMembers: Array<{
    indexId: string;
    securityId: string;
  }>;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}> => {
  // Get base data
  const [securities, indices, indexMembers] = await Promise.all([
    getSnP500Data(),
    getIndices(),
    getIndexMembers(),
  ]);

  let filteredSecurities = securities;

  // Filter by index if specified
  if (indexId) {
    const membersInIndex = indexMembers
      .filter((member) => member.indexId === indexId)
      .map((member) => member.securityId);

    filteredSecurities = securities.filter((security) => membersInIndex.includes(security.ticker));
  }

  // Filter by search term if specified
  if (searchTerm?.trim()) {
    const term = searchTerm.toLowerCase().trim();
    filteredSecurities = filteredSecurities.filter(
      (security) =>
        security.ticker.toLowerCase().includes(term) ||
        security.name.toLowerCase().includes(term) ||
        security.sector?.toLowerCase().includes(term) ||
        security.industry?.toLowerCase().includes(term),
    );
  }

  // Apply sorting server-side
  const sortByField = sortBy || 'ticker';
  const sortOrderDirection = sortOrder || 'asc';

  filteredSecurities = filteredSecurities.sort((a, b) => {
    const aValue = a[sortByField as keyof typeof a] || '';
    const bValue = b[sortByField as keyof typeof b] || '';
    const comparison = String(aValue).localeCompare(String(bValue));
    return sortOrderDirection === 'desc' ? -comparison : comparison;
  });

  // Apply pagination server-side
  const currentPage = page || 1;
  const itemsPerPage = pageSize || 100;
  const totalItems = filteredSecurities.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedSecurities = filteredSecurities.slice(startIndex, endIndex);

  // Ensure all securities have required properties with defaults
  const securitiesWithDefaults = paginatedSecurities.map((security) => ({
    ...security,
    marketCap: security.marketCap || 'N/A',
    industry: security.industry || 'Unknown',
    sector: security.sector || 'Unknown',
  }));

  return {
    securities: securitiesWithDefaults,
    indices,
    indexMembers,
    pagination: {
      page: currentPage,
      pageSize: itemsPerPage,
      total: totalItems,
      totalPages,
    },
  };
};

// Get all index members mapping
export const getIndexMembers = async (): Promise<
  Array<{ indexId: string; securityId: string }>
> => {
  const cacheKey = 'index-members';
  const cached = getCached<Array<{ indexId: string; securityId: string }>>(cacheKey);
  if (cached) {
    return cached;
  }
  const indexMembers = await getDb()
    .select({
      indexId: schema.indexMember.indexId,
      securityId: schema.indexMember.securityId,
    })
    .from(schema.indexMember);
  setCache(cacheKey, indexMembers);
  return indexMembers;
};

// Get all rebalancing groups with their members and assigned models
export const getRebalancingGroups = async (userId: string): Promise<RebalancingGroup[]> => {
  const cacheKey = `rebalancing-groups-${userId}`;
  const cached = getCached<RebalancingGroup[]>(cacheKey);
  if (cached) {
    // Temporarily disable cache to debug
    // return cached;
  }

  // Single relational query to get all groups with their members and assigned models
  const groupsWithData = await getDb()
    .select({
      // Group data
      groupId: schema.rebalancingGroup.id,
      groupName: schema.rebalancingGroup.name,
      groupIsActive: schema.rebalancingGroup.isActive,
      groupCreatedAt: schema.rebalancingGroup.createdAt,
      groupUpdatedAt: schema.rebalancingGroup.updatedAt,
      // Member data
      memberId: schema.rebalancingGroupMember.id,
      memberAccountId: schema.rebalancingGroupMember.accountId,
      memberIsActive: schema.rebalancingGroupMember.isActive,
      accountName: schema.account.name,
      accountType: schema.account.type,
      // Model assignment data
      modelId: schema.model.id,
      modelName: schema.model.name,
      modelDescription: schema.model.description,
      modelIsActive: schema.model.isActive,
      modelCreatedAt: schema.model.createdAt,
      modelUpdatedAt: schema.model.updatedAt,
    })
    .from(schema.rebalancingGroup)
    .leftJoin(
      schema.rebalancingGroupMember,
      and(
        eq(schema.rebalancingGroup.id, schema.rebalancingGroupMember.groupId),
        eq(schema.rebalancingGroupMember.isActive, true),
      ),
    )
    .leftJoin(schema.account, eq(schema.rebalancingGroupMember.accountId, schema.account.id))
    .leftJoin(
      schema.modelGroupAssignment,
      eq(schema.rebalancingGroup.id, schema.modelGroupAssignment.rebalancingGroupId),
    )
    .leftJoin(
      schema.model,
      and(
        eq(schema.modelGroupAssignment.modelId, schema.model.id),
        eq(schema.model.isActive, true),
      ),
    )
    .where(
      and(eq(schema.rebalancingGroup.userId, userId), eq(schema.rebalancingGroup.isActive, true)),
    )
    .orderBy(schema.rebalancingGroup.name);

  // Group data by group ID
  const groupsMap = new Map<
    string,
    {
      id: string;
      name: string;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
      members: Array<{
        id: string;
        accountId: string;
        isActive: boolean;
        accountName?: string;
        accountType?: string;
        balance?: number;
      }>;
      assignedModel?: {
        id: string;
        name: string;
        description?: string;
        isActive: boolean;
        members: Array<{
          id: string;
          sleeveId: string;
          targetWeight: number;
          isActive: boolean;
          sleeveName?: string;
        }>;
        createdAt: Date;
        updatedAt: Date;
      };
    }
  >();

  for (const row of groupsWithData) {
    let group = groupsMap.get(row.groupId);
    if (!group) {
      group = {
        id: row.groupId,
        name: row.groupName,
        isActive: row.groupIsActive,
        createdAt: row.groupCreatedAt,
        updatedAt: row.groupUpdatedAt,
        members: [],
      };
      groupsMap.set(row.groupId, group);
    }

    // Add member if exists and not already added
    if (row.memberId && row.memberAccountId && !group.members.some((m) => m.id === row.memberId)) {
      group.members.push({
        id: row.memberId,
        accountId: row.memberAccountId,
        accountName: row.accountName || undefined,
        accountType: row.accountType || undefined,
        balance: 0, // Will be calculated from holdings
        isActive: !!row.memberIsActive,
      });
    }

    // Add assigned model if exists and not already added
    if (
      row.modelId &&
      row.modelName &&
      row.modelCreatedAt &&
      row.modelUpdatedAt &&
      !group.assignedModel
    ) {
      group.assignedModel = {
        id: row.modelId,
        name: row.modelName,
        description: row.modelDescription || undefined,
        isActive: !!row.modelIsActive,
        members: [], // We don't need full member details for the group view
        createdAt: row.modelCreatedAt,
        updatedAt: row.modelUpdatedAt,
      };
    }
  }

  // Convert to final format
  const finalGroups: RebalancingGroup[] = Array.from(groupsMap.values()).map((group) => ({
    id: group.id,
    name: group.name,
    isActive: group.isActive,
    members: group.members,
    assignedModel: group.assignedModel,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
  }));

  // Validate data
  const validatedData = validateData(RebalancingGroupsSchema, finalGroups, 'rebalancing groups');
  setCache(cacheKey, validatedData);

  return validatedData;
};

// Get rebalancing group by ID
export const getRebalancingGroupById = async (
  groupId: string,
  userId: string,
): Promise<RebalancingGroup | null> => {
  const group = await getDb()
    .select({
      id: schema.rebalancingGroup.id,
      name: schema.rebalancingGroup.name,
      isActive: schema.rebalancingGroup.isActive,
      createdAt: schema.rebalancingGroup.createdAt,
      updatedAt: schema.rebalancingGroup.updatedAt,
    })
    .from(schema.rebalancingGroup)
    .where(
      sql`${schema.rebalancingGroup.id} = ${groupId} AND ${schema.rebalancingGroup.userId} = ${userId}`,
    )
    .limit(1);

  if (group.length === 0) {
    return null;
  }

  // Get group members
  const members = await getDb()
    .select({
      id: schema.rebalancingGroupMember.id,
      accountId: schema.rebalancingGroupMember.accountId,
      isActive: schema.rebalancingGroupMember.isActive,
      accountName: schema.account.name,
      accountType: schema.account.type,
      accountNumber: schema.account.accountNumber,
    })
    .from(schema.rebalancingGroupMember)
    .innerJoin(schema.account, eq(schema.rebalancingGroupMember.accountId, schema.account.id))
    .where(
      sql`${schema.rebalancingGroupMember.groupId} = ${groupId} AND ${schema.rebalancingGroupMember.isActive} = true`,
    );

  // Get assigned model via junction table
  const assignedModel = await getDb()
    .select({
      id: schema.model.id,
      name: schema.model.name,
      description: schema.model.description,
      isActive: schema.model.isActive,
      createdAt: schema.model.createdAt,
      updatedAt: schema.model.updatedAt,
    })
    .from(schema.model)
    .innerJoin(
      schema.modelGroupAssignment,
      eq(schema.model.id, schema.modelGroupAssignment.modelId),
    )
    .where(
      sql`${schema.modelGroupAssignment.rebalancingGroupId} = ${groupId} AND ${schema.model.isActive} = true`,
    )
    .limit(1);

  interface ModelMemberData {
    id: string;
    sleeveId: string;
    targetWeight: number;
    isActive: boolean;
    sleeveName: string;
  }

  // Get model members if model exists
  let modelMembers: ModelMemberData[] = [];
  if (assignedModel.length > 0) {
    modelMembers = await getDb()
      .select({
        id: schema.modelMember.id,
        sleeveId: schema.modelMember.sleeveId,
        targetWeight: schema.modelMember.targetWeight,
        isActive: schema.modelMember.isActive,
        sleeveName: schema.sleeve.name,
      })
      .from(schema.modelMember)
      .innerJoin(schema.sleeve, eq(schema.modelMember.sleeveId, schema.sleeve.id))
      .where(eq(schema.modelMember.modelId, assignedModel[0].id));
  }

  return {
    id: group[0].id,
    name: group[0].name,
    isActive: group[0].isActive,
    members: members.map((member) => ({
      id: member.id,
      accountId: member.accountId,
      accountName: member.accountName,
      accountType: member.accountType,
      accountNumber: member.accountNumber,
      balance: 0, // Will be calculated from holdings
      isActive: member.isActive,
    })),
    assignedModel:
      assignedModel.length > 0
        ? {
            id: assignedModel[0].id,
            name: assignedModel[0].name,
            description: assignedModel[0].description || undefined,
            isActive: assignedModel[0].isActive,
            members: modelMembers.map((member) => ({
              id: member.id,
              sleeveId: member.sleeveId,
              sleeveName: member.sleeveName,
              targetWeight: member.targetWeight,
              isActive: member.isActive,
            })),
            createdAt: assignedModel[0].createdAt,
            updatedAt: assignedModel[0].updatedAt,
          }
        : undefined,
    createdAt: group[0].createdAt,
    updatedAt: group[0].updatedAt,
  };
};

// Get holdings for specific accounts
export const getAccountHoldings = async (accountIds: string[]) => {
  // Get S&P 500 data for current prices and security information (baseline)
  const sp500Data = await getSnP500Data();
  const priceMap = new Map<string, number>(sp500Data.map((stock) => [stock.ticker, stock.price]));

  // Create a map for sector and industry information
  const securityInfoMap = new Map<string, { sector: string; industry: string }>(
    sp500Data.map((stock) => [stock.ticker, { sector: stock.sector, industry: stock.industry }]),
  );

  // Get holdings for the specified accounts
  const holdings = await getDb()
    .select({
      id: schema.holding.id,
      ticker: schema.holding.ticker,
      qty: schema.holding.qty,
      costBasis: schema.holding.averageCost,
      openedAt: schema.holding.openedAt,
      accountId: schema.account.id,
      accountName: schema.account.name,
      accountType: schema.account.type,
      accountNumber: schema.account.accountNumber,
    })
    .from(schema.holding)
    .innerJoin(schema.account, eq(schema.holding.accountId, schema.account.id))
    .where(inArray(schema.account.id, accountIds));

  // Prefer our latest stored security price (e.g., from preview) over SP500 baseline
  try {
    const tickers = Array.from(new Set(holdings.map((h) => h.ticker)));
    if (tickers.length > 0) {
      const rows = await getDb()
        .select({ ticker: schema.security.ticker, price: schema.security.price })
        .from(schema.security)
        .where(inArray(schema.security.ticker, tickers));
      for (const r of rows) {
        if (typeof r.price === 'number' && Number.isFinite(r.price) && r.price > 0) {
          priceMap.set(r.ticker, r.price);
        }
      }
    }
  } catch (e) {
    console.warn(
      '⚠️ getAccountHoldings: fallback to SP500 prices due to security price overlay failure',
      e,
    );
  }

  // Get sleeve information for each ticker
  const sleeveMembers = await getDb()
    .select({
      ticker: schema.sleeveMember.ticker,
      sleeveId: schema.sleeve.id,
      sleeveName: schema.sleeve.name,
    })
    .from(schema.sleeveMember)
    .innerJoin(schema.sleeve, eq(schema.sleeveMember.sleeveId, schema.sleeve.id))
    .where(eq(schema.sleeveMember.isActive, true));

  // Create a map of ticker to sleeves
  const tickerToSleeves = new Map<string, Array<{ sleeveId: string; sleeveName: string }>>();
  for (const member of sleeveMembers) {
    if (!tickerToSleeves.has(member.ticker)) {
      tickerToSleeves.set(member.ticker, []);
    }
    tickerToSleeves.get(member.ticker)?.push({
      sleeveId: member.sleeveId,
      sleeveName: member.sleeveName,
    });
  }

  // Group holdings by account
  interface AccountHoldingMap {
    accountId: string;
    accountName: string;
    accountType: string;
    accountNumber: string;
    accountBalance: number;
    totalValue: number;
    holdings: Array<{
      id: string;
      ticker: string;
      qty: number;
      currentPrice: number;
      marketValue: number;
      costBasisPerShare: number;
      costBasisTotal: number;
      unrealizedGain: number;
      unrealizedGainPercent: number;
      sleeves: Array<{
        sleeveId: string;
        sleeveName: string;
      }>;
      sector: string;
      industry: string;
      openedAt: Date;
    }>;
  }
  const accountHoldings = new Map<string, AccountHoldingMap>();

  for (const holding of holdings) {
    const accountId = holding.accountId;
    if (!accountHoldings.has(accountId)) {
      accountHoldings.set(accountId, {
        accountId: holding.accountId,
        accountName: holding.accountName,
        accountType: holding.accountType,
        accountNumber: holding.accountNumber || '',
        accountBalance: 0, // Will be calculated from holdings
        totalValue: 0, // Will be calculated from holdings
        holdings: [],
      });
    }

    const currentPrice = priceMap.get(holding.ticker) || 0;
    const marketValue = holding.qty * currentPrice;
    const costBasisTotal = holding.costBasis * holding.qty;
    const unrealizedGain = marketValue - costBasisTotal;

    const sleeves = tickerToSleeves.get(holding.ticker) || [];
    const securityInfo = securityInfoMap.get(holding.ticker) || {
      sector: 'Unknown',
      industry: 'Unknown',
    };

    accountHoldings.get(accountId)?.holdings.push({
      id: holding.id,
      ticker: holding.ticker,
      qty: holding.qty,
      currentPrice,
      marketValue,
      costBasisPerShare: holding.costBasis,
      costBasisTotal,
      unrealizedGain,
      unrealizedGainPercent: costBasisTotal > 0 ? (unrealizedGain / costBasisTotal) * 100 : 0,
      sleeves,
      sector: securityInfo.sector,
      industry: securityInfo.industry,
      openedAt: holding.openedAt,
    });
  }

  // Calculate actual account balance from holdings
  const result = Array.from(accountHoldings.values()).map((account) => {
    const calculatedBalance = account.holdings.reduce(
      (sum, holding) => sum + holding.marketValue,
      0,
    );
    return {
      ...account,
      accountBalance: calculatedBalance, // Use calculated balance instead of DB balance
    };
  });

  return result;
};

export type SP500DataResult = Awaited<ReturnType<typeof getSnP500Data>>;
export type PositionsResult = Awaited<ReturnType<typeof getPositions>>;
export type TransactionsResult = Awaited<ReturnType<typeof getTransactions>>;
export type AccountHoldingsResult = Awaited<ReturnType<typeof getAccountHoldings>>;
export type RebalancingGroupsResult = Awaited<ReturnType<typeof getRebalancingGroups>>;

// Get sleeve members (target securities) for specific sleeves
export const getSleeveMembers = async (sleeveIds: string[]) => {
  if (!sleeveIds || sleeveIds.length === 0) {
    return [];
  }

  // Get S&P 500 data for current prices
  const sp500Data = await getSnP500Data();
  const priceMap = new Map<string, number>(sp500Data.map((stock) => [stock.ticker, stock.price]));

  // Get sleeve members (securities within each sleeve) - process in smaller batches

  const batchSize = 10; // Process sleeves in smaller batches
  const finalSleeveMap = new Map<
    string,
    {
      sleeveId: string;
      sleeveName: string;
      members: {
        id: string;
        ticker: string;
        rank: number;
        isActive: boolean;
        currentPrice: number;
        targetWeight: number;
      }[];
    }
  >();

  for (let i = 0; i < sleeveIds.length; i += batchSize) {
    const batchIds = sleeveIds.slice(i, i + batchSize);

    try {
      // Get sleeve members for this batch
      const batchMembers = await getDb()
        .select({
          id: schema.sleeveMember.id,
          sleeveId: schema.sleeveMember.sleeveId,
          ticker: schema.sleeveMember.ticker,
          rank: schema.sleeveMember.rank,
          isActive: schema.sleeveMember.isActive,
          sleeveName: schema.sleeve.name,
        })
        .from(schema.sleeveMember)
        .innerJoin(schema.sleeve, eq(schema.sleeveMember.sleeveId, schema.sleeve.id))
        .where(
          and(
            inArray(schema.sleeveMember.sleeveId, batchIds),
            eq(schema.sleeveMember.isActive, true),
          ),
        );

      // Group by sleeve
      for (const member of batchMembers) {
        if (!finalSleeveMap.has(member.sleeveId)) {
          finalSleeveMap.set(member.sleeveId, {
            sleeveId: member.sleeveId,
            sleeveName: member.sleeveName,
            members: [],
          });
        }

        const currentPrice = priceMap.get(member.ticker) || 0;
        finalSleeveMap.get(member.sleeveId)?.members.push({
          id: member.id,
          ticker: member.ticker,
          rank: member.rank,
          isActive: member.isActive,
          currentPrice,
          targetWeight: 0, // Will be calculated below
        });
      }
    } catch (error) {
      console.error(
        `Error fetching sleeve members for batch ${Math.floor(i / batchSize) + 1}:`,
        error,
      );
    }
  }

  // Calculate equal weights for each sleeve
  for (const sleeveData of finalSleeveMap.values()) {
    const memberCount = sleeveData.members.length;
    if (memberCount > 0) {
      const equalWeight = Math.floor(10000 / memberCount);
      const remainder = 10000 - equalWeight * memberCount;

      sleeveData.members.forEach((member: { targetWeight: number }, index: number) => {
        member.targetWeight = equalWeight + (index < remainder ? 1 : 0);
      });
    }
  }

  const finalResult = Array.from(finalSleeveMap.values());
  return finalResult;
};

// Create a new rebalancing group with members
export const createRebalancingGroup = async (
  data: CreateRebalancingGroup,
  userId: string,
): Promise<string> => {
  // Check if group name already exists for this user
  const existingGroups = await getDb()
    .select({
      id: schema.rebalancingGroup.id,
      name: schema.rebalancingGroup.name,
    })
    .from(schema.rebalancingGroup)
    .where(
      sql`${schema.rebalancingGroup.name} = ${data.name} AND ${schema.rebalancingGroup.userId} = ${userId}`,
    );

  if (existingGroups.length > 0) {
    if (data.updateExisting) {
      // Update existing group instead of creating new one
      const existingGroupId = existingGroups[0].id;
      await updateRebalancingGroup(existingGroupId, data, userId);
      return existingGroupId;
    }
    throw new Error(`Rebalancing group name "${data.name}" already exists`);
  }

  const groupId = generateId();

  // Validate that account IDs exist and belong to the user
  const memberAccountIds = data.members.map((m) => m.accountId);
  if (memberAccountIds.length > 0) {
    const accounts = await getDb()
      .select({ id: schema.account.id })
      .from(schema.account)
      .where(and(inArray(schema.account.id, memberAccountIds), eq(schema.account.userId, userId)));

    const existingAccountIds = new Set(accounts.map((a) => a.id));
    const invalidAccountIds = memberAccountIds.filter((id) => !existingAccountIds.has(id));

    if (invalidAccountIds.length > 0) {
      throw new Error(`Invalid account IDs: ${invalidAccountIds.join(', ')}`);
    }
  }

  const now = new Date();

  try {
    // Create the rebalancing group
    await getDb().insert(schema.rebalancingGroup).values({
      id: groupId,
      userId: userId,
      name: data.name,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    // Create group members
    if (data.members.length > 0) {
      const memberRecords = data.members.map((member) => ({
        id: generateId(),
        groupId: groupId,
        accountId: member.accountId,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      }));

      await getDb().insert(schema.rebalancingGroupMember).values(memberRecords);
    }

    // Clear cache so that the new group appears
    clearCache(`rebalancing-groups-${userId}`);

    return groupId;
  } catch (error) {
    console.error('Error creating rebalancing group:', error);
    throw error;
  }
};

// Update an existing rebalancing group
export const updateRebalancingGroup = async (
  groupId: string,
  data: CreateRebalancingGroup,
  userId: string,
): Promise<void> => {
  // Check if group exists and belongs to user
  const existingGroup = await getDb()
    .select({
      id: schema.rebalancingGroup.id,
      name: schema.rebalancingGroup.name,
    })
    .from(schema.rebalancingGroup)
    .where(
      sql`${schema.rebalancingGroup.id} = ${groupId} AND ${schema.rebalancingGroup.userId} = ${userId}`,
    )
    .limit(1);

  if (existingGroup.length === 0) {
    throw new Error(`Rebalancing group with ID "${groupId}" not found`);
  }

  // Check if new name conflicts with other groups (excluding current group)
  const conflictingGroups = await getDb()
    .select({ name: schema.rebalancingGroup.name })
    .from(schema.rebalancingGroup)
    .where(
      sql`${schema.rebalancingGroup.name} = ${data.name} AND ${schema.rebalancingGroup.userId} = ${userId} AND ${schema.rebalancingGroup.id} != ${groupId}`,
    );

  if (conflictingGroups.length > 0) {
    throw new Error(`Rebalancing group name "${data.name}" already exists`);
  }

  // Validate that account IDs exist and belong to the user
  const memberAccountIds = data.members.map((m) => m.accountId);
  if (memberAccountIds.length > 0) {
    const accounts = await getDb()
      .select({ id: schema.account.id })
      .from(schema.account)
      .where(and(inArray(schema.account.id, memberAccountIds), eq(schema.account.userId, userId)));

    const existingAccountIds = new Set(accounts.map((a) => a.id));
    const invalidAccountIds = memberAccountIds.filter((id) => !existingAccountIds.has(id));

    if (invalidAccountIds.length > 0) {
      throw new Error(`Invalid account IDs: ${invalidAccountIds.join(', ')}`);
    }
  }

  const now = new Date();

  try {
    // Update the group
    await getDb()
      .update(schema.rebalancingGroup)
      .set({
        name: data.name,
        updatedAt: now,
      })
      .where(eq(schema.rebalancingGroup.id, groupId));

    // Delete existing members and recreate them
    await getDb()
      .delete(schema.rebalancingGroupMember)
      .where(eq(schema.rebalancingGroupMember.groupId, groupId));

    // Create new members
    if (data.members.length > 0) {
      const memberRecords = data.members.map((member) => ({
        id: generateId(),
        groupId: groupId,
        accountId: member.accountId,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      }));

      await getDb().insert(schema.rebalancingGroupMember).values(memberRecords);
    }

    // Clear cache so that updated group appears
    clearCache(`rebalancing-groups-${userId}`);
    // Clear accounts cache so account availability is refreshed
    clearCacheByPattern(`accounts-for-rebalancing-${userId}`);
  } catch (error) {
    console.error('Error updating rebalancing group:', error);
    throw error;
  }
};

// Delete a rebalancing group (soft delete)
export const deleteRebalancingGroup = async (groupId: string, userId: string): Promise<void> => {
  // Check if group exists and belongs to user
  const existingGroup = await getDb()
    .select({
      id: schema.rebalancingGroup.id,
      name: schema.rebalancingGroup.name,
    })
    .from(schema.rebalancingGroup)
    .where(
      sql`${schema.rebalancingGroup.id} = ${groupId} AND ${schema.rebalancingGroup.userId} = ${userId}`,
    )
    .limit(1);

  if (existingGroup.length === 0) {
    throw new Error(`Rebalancing group with ID "${groupId}" not found`);
  }

  try {
    // Delete group members first (due to foreign key constraint)
    await getDb()
      .delete(schema.rebalancingGroupMember)
      .where(eq(schema.rebalancingGroupMember.groupId, groupId));

    // Remove any model assignments for this group
    await getDb()
      .delete(schema.modelGroupAssignment)
      .where(eq(schema.modelGroupAssignment.rebalancingGroupId, groupId));

    // Delete the group itself
    await getDb().delete(schema.rebalancingGroup).where(eq(schema.rebalancingGroup.id, groupId));

    // Clear cache so that deleted group disappears
    clearCache(`rebalancing-groups-${userId}`);
    clearCache(`models-${userId}`);
    // Clear accounts cache so account availability is refreshed
    clearCacheByPattern(`accounts-for-rebalancing-${userId}`);
  } catch (error) {
    console.error('Error deleting rebalancing group:', error);
    throw error;
  }
};

// Get all available accounts for group creation/editing
export const getAvailableAccounts = async (
  userId: string,
): Promise<Array<{ id: string; name: string; type: string; balance: number }>> => {
  const cacheKey = `available-accounts-${userId}`;
  const cached =
    getCached<Array<{ id: string; name: string; type: string; balance: number }>>(cacheKey);
  if (cached) {
    return cached;
  }

  const accounts = await getDb()
    .select({
      id: schema.account.id,
      name: schema.account.name,
      type: schema.account.type,
    })
    .from(schema.account)
    .where(eq(schema.account.userId, userId))
    .orderBy(schema.account.name);

  const processedAccounts = accounts.map((account) => ({
    id: account.id,
    name: account.name,
    type: account.type || '', // Convert null to empty string
    balance: 0, // Will be calculated from holdings
  }));

  setCache(cacheKey, processedAccounts);

  return processedAccounts;
};

// Get accounts with their assignment status for rebalancing group selection
export const getAccountsForRebalancingGroups = async (
  userId: string,
  excludeGroupId?: string,
): Promise<
  Array<{
    id: string;
    name: string;
    type: string | null;
    accountNumber: string | null;
    dataSource: string;
    balance: number;
    isAssigned: boolean;
    assignedGroupName?: string;
  }>
> => {
  const cacheKey = `accounts-for-rebalancing-${userId}-${excludeGroupId || 'all'}`;
  const cached =
    getCached<
      Array<{
        id: string;
        name: string;
        type: string;
        accountNumber: string | null;
        dataSource: string;
        balance: number;
        isAssigned: boolean;
        assignedGroupName?: string;
      }>
    >(cacheKey);
  if (cached) {
    return cached;
  }

  // Get all accounts for the user
  let accounts: Array<{
    id: string;
    name: string;
    type: string | null;
    accountNumber: string | null;
    dataSource: string;
  }> = [];
  try {
    accounts = await getDb()
      .select({
        id: schema.account.id,
        name: schema.account.name,
        type: schema.account.type,
        accountNumber: schema.account.accountNumber,
        dataSource: schema.account.dataSource,
      })
      .from(schema.account)
      .where(eq(schema.account.userId, userId))
      .orderBy(schema.account.name);
  } catch (error) {
    // If database tables don't exist or there's a connection issue, return empty accounts
    console.warn('Failed to fetch accounts, returning empty result:', error);
    accounts = [];
  }

  // Get all active rebalancing group memberships
  let memberships: Array<{
    accountId: string;
    groupId: string;
    groupName: string;
  }> = [];
  try {
    memberships = await getDb()
      .select({
        accountId: schema.rebalancingGroupMember.accountId,
        groupId: schema.rebalancingGroupMember.groupId,
        groupName: schema.rebalancingGroup.name,
      })
      .from(schema.rebalancingGroupMember)
      .innerJoin(
        schema.rebalancingGroup,
        eq(schema.rebalancingGroupMember.groupId, schema.rebalancingGroup.id),
      )
      .where(
        sql`${schema.rebalancingGroupMember.isActive} = true AND ${schema.rebalancingGroup.isActive} = true AND ${schema.rebalancingGroup.userId} = ${userId}${
          excludeGroupId ? sql` AND ${schema.rebalancingGroup.id} != ${excludeGroupId}` : sql``
        }`,
      );
  } catch (error) {
    // If database tables don't exist or there's a connection issue, return empty memberships
    console.warn('Failed to fetch rebalancing group memberships, returning empty result:', error);
    memberships = [];
  }

  // Create a map of account assignments
  const assignmentMap = new Map<string, { groupName: string }>();
  memberships.forEach((membership) => {
    assignmentMap.set(membership.accountId, {
      groupName: membership.groupName,
    });
  });

  // Calculate actual balances from holdings
  const accountBalances = new Map<string, number>();

  if (accounts.length > 0) {
    let holdings: Array<{
      accountId: string;
      ticker: string;
      qty: number;
    }> = [];
    let priceMap = new Map<string, number>();

    try {
      const sp500Data = await getSnP500Data();
      priceMap = new Map<string, number>(sp500Data.map((stock) => [stock.ticker, stock.price]));

      const accountIds = accounts.map((account) => account.id);
      holdings = await getDb()
        .select({
          accountId: schema.holding.accountId,
          ticker: schema.holding.ticker,
          qty: schema.holding.qty,
        })
        .from(schema.holding)
        .innerJoin(schema.account, eq(schema.holding.accountId, schema.account.id))
        .where(inArray(schema.account.id, accountIds));
    } catch (error) {
      // If holdings query fails, use empty holdings (balances will be 0)
      console.warn('Failed to fetch holdings, using empty holdings:', error);
      holdings = [];
      priceMap = new Map<string, number>();
    }

    // Calculate balance for each account
    for (const holding of holdings) {
      const currentPrice = priceMap.get(holding.ticker) || 0;
      const marketValue = holding.qty * currentPrice;
      const currentBalance = accountBalances.get(holding.accountId) || 0;
      accountBalances.set(holding.accountId, currentBalance + marketValue);
    }
  }

  const processedAccounts = accounts.map((account) => {
    const assignment = assignmentMap.get(account.id);
    return {
      id: account.id,
      name: account.name,
      type: account.type || '', // Convert null to empty string
      accountNumber: account.accountNumber,
      dataSource: account.dataSource,
      balance: accountBalances.get(account.id) || 0,
      isAssigned: !!assignment,
      assignedGroupName: assignment?.groupName,
    };
  });

  setCache(cacheKey, processedAccounts);

  return processedAccounts;
};

// Assign a model to a rebalancing group
export const assignModelToGroup = async (
  modelId: string,
  groupId: string,
  userId: string,
): Promise<void> => {
  // Verify the model exists
  const model = await getDb()
    .select({ id: schema.model.id })
    .from(schema.model)
    .where(eq(schema.model.id, modelId))
    .limit(1);

  if (model.length === 0) {
    throw new Error(`Model with ID "${modelId}" not found`);
  }

  // Verify the group exists and belongs to the user
  console.log('DEBUG: assignModelToGroup - Checking group existence:', { groupId, userId });

  // First, check if the group exists at all
  const groupExists = await getDb()
    .select({
      id: schema.rebalancingGroup.id,
      userId: schema.rebalancingGroup.userId,
      isActive: schema.rebalancingGroup.isActive,
    })
    .from(schema.rebalancingGroup)
    .where(eq(schema.rebalancingGroup.id, groupId))
    .limit(1);

  console.log('DEBUG: Group exists check:', groupExists);

  const group = await getDb()
    .select({ id: schema.rebalancingGroup.id })
    .from(schema.rebalancingGroup)
    .where(
      sql`${schema.rebalancingGroup.id} = ${groupId} AND ${schema.rebalancingGroup.userId} = ${userId} AND ${schema.rebalancingGroup.isActive} = true`,
    )
    .limit(1);

  console.log('DEBUG: Group ownership check result:', group);

  if (group.length === 0) {
    throw new Error(
      `Rebalancing group with ID "${groupId}" not found or does not belong to user "${userId}" or is not active. Group exists: ${groupExists.length > 0 ? 'YES' : 'NO'}, User match: ${groupExists.length > 0 ? groupExists[0].userId === userId : 'N/A'}, Is active: ${groupExists.length > 0 ? groupExists[0].isActive : 'N/A'}`,
    );
  }

  try {
    // Check if assignment already exists
    const existingAssignment = await getDb()
      .select({ id: schema.modelGroupAssignment.id })
      .from(schema.modelGroupAssignment)
      .where(
        and(
          eq(schema.modelGroupAssignment.modelId, modelId),
          eq(schema.modelGroupAssignment.rebalancingGroupId, groupId),
        ),
      )
      .limit(1);

    if (existingAssignment.length === 0) {
      // Create new assignment in junction table
      const assignmentId = generateId();
      await getDb().insert(schema.modelGroupAssignment).values({
        id: assignmentId,
        modelId: modelId,
        rebalancingGroupId: groupId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Clear caches
    clearCache(`rebalancing-groups-${userId}`);
    clearCache(`models-${userId}`);
  } catch (error) {
    console.error('Error assigning model to group:', error);
    throw error;
  }
};

// Unassign a model from a rebalancing group
export const unassignModelFromGroup = async (modelId: string, groupId: string): Promise<void> => {
  try {
    // Determine userId from the group
    const group = await getDb()
      .select({ userId: schema.rebalancingGroup.userId })
      .from(schema.rebalancingGroup)
      .where(eq(schema.rebalancingGroup.id, groupId))
      .limit(1);

    // Delete the assignment from junction table
    await getDb()
      .delete(schema.modelGroupAssignment)
      .where(
        and(
          eq(schema.modelGroupAssignment.modelId, modelId),
          eq(schema.modelGroupAssignment.rebalancingGroupId, groupId),
        ),
      );

    // Clear caches (user-scoped if found)
    if (group.length > 0) {
      const uid = group[0].userId;
      clearCache(`rebalancing-groups-${uid}`);
      clearCache(`models-${uid}`);
    }
  } catch (error) {
    console.error('Error unassigning model from group:', error);
    throw error;
  }
};

// Update account details
export const updateAccount = async (
  accountId: string,
  updates: { name: string; type: string },
  userId: string,
): Promise<void> => {
  try {
    // Verify the account belongs to the user
    const existingAccount = await getDb()
      .select({ id: schema.account.id })
      .from(schema.account)
      .where(and(eq(schema.account.id, accountId), eq(schema.account.userId, userId)))
      .limit(1);

    if (existingAccount.length === 0) {
      throw new Error('Account not found or unauthorized');
    }

    // Update the account
    await getDb()
      .update(schema.account)
      .set({
        name: updates.name,
        type: updates.type,
        updatedAt: new Date(),
      })
      .where(eq(schema.account.id, accountId));

    // Clear relevant caches
    clearCache(`rebalancing-groups-${userId}`);
    clearCache(`available-accounts-${userId}`);
  } catch (error) {
    console.error('Error updating account:', error);
    throw error;
  }
};
