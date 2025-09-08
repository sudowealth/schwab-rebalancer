import {
  getSchwabApiService,
  SchwabAccount,
  SchwabPosition,
  SchwabActivity,
} from "./schwab-api";
import { getDatabase } from "./db-config";
import * as schema from "../db/schema";
import { eq, and } from "drizzle-orm";

export interface SyncResult {
  success: boolean;
  recordsProcessed: number;
  errorMessage?: string;
}

export class SchwabSyncService {
  private db = getDatabase();
  private schwabApi = getSchwabApiService();

  async syncAccounts(userId: string): Promise<SyncResult> {
    console.log(
      "🏦 [SchwabSync] Starting account synchronization for user:",
      userId
    );
    const syncLog = await this.startSyncLog(userId, "ACCOUNTS");
    console.log("📝 [SchwabSync] Created sync log:", syncLog.id);

    try {
      // Check if user has valid Schwab credentials
      console.log("🔍 [SchwabSync] Checking for valid Schwab credentials");
      const hasCredentials = await this.schwabApi.hasValidCredentials(userId);
      console.log("✅ [SchwabSync] Credentials check result:", hasCredentials);

      if (!hasCredentials) {
        console.error("❌ [SchwabSync] No valid Schwab credentials found");
        throw new Error("No valid Schwab credentials found");
      }

      // Fetch accounts from Schwab
      console.log("📡 [SchwabSync] Fetching accounts from Schwab API");
      const schwabAccounts = await this.schwabApi.getAccounts(userId);
      console.log(
        "📊 [SchwabSync] Retrieved",
        schwabAccounts.length,
        "accounts from Schwab"
      );
      console.log("📋 [SchwabSync] Account details:", schwabAccounts);

      // Fetch user preferences to get account nicknames
      console.log(
        "🏷️ [SchwabSync] Fetching user preferences for account nicknames"
      );
      let userPreferences: Awaited<
        ReturnType<typeof this.schwabApi.getUserPreference>
      > | null = null;
      try {
        userPreferences = await this.schwabApi.getUserPreference(userId);
        console.log(
          "✅ [SchwabSync] Retrieved user preferences:",
          userPreferences
        );
      } catch (error) {
        console.warn(
          "⚠️ [SchwabSync] Failed to fetch user preferences, continuing without nicknames:",
          error
        );
      }

      // Create a map of account numbers to nicknames
      const nicknameMap = new Map<string, string>();
      if (userPreferences?.accounts) {
        for (const prefAccount of userPreferences.accounts) {
          if (prefAccount.accountNumber && prefAccount.nickName) {
            nicknameMap.set(prefAccount.accountNumber, prefAccount.nickName);
            console.log(
              `🏷️ [SchwabSync] Mapped account ${prefAccount.accountNumber} to nickname: ${prefAccount.nickName}`
            );
          }
        }
      }

      let processedCount = 0;

      // Truncate-and-load schwab_account raw import
      try {
        await this.db.delete(schema.schwabAccount);
        for (const acct of schwabAccounts) {
          await this.db.insert(schema.schwabAccount).values({
            id: crypto.randomUUID(),
            type: acct.type || "CASH",
            accountNumber: acct.accountNumber,
            importedAt: new Date(),
            payload: JSON.stringify(acct),
          });
        }
      } catch (rawErr) {
        console.warn(
          "⚠️ [SchwabSync] Failed raw schwab_account import",
          rawErr
        );
      }

      for (const schwabAccount of schwabAccounts) {
        console.log(
          "🔄 [SchwabSync] Processing account:",
          schwabAccount.accountId,
          schwabAccount.nickName || schwabAccount.type
        );
        await this.syncAccount(userId, schwabAccount, nicknameMap, syncLog.id);
        processedCount++;
        console.log(
          "✅ [SchwabSync] Completed processing account",
          processedCount,
          "of",
          schwabAccounts.length
        );
      }

      console.log("🎉 [SchwabSync] Successfully completed sync log");
      await this.completeSyncLog(syncLog.id, "SUCCESS", processedCount);

      const result = {
        success: true,
        recordsProcessed: processedCount,
      };
      console.log(
        "✅ [SchwabSync] Account sync completed successfully:",
        result
      );
      return result;
    } catch (error) {
      console.error("❌ [SchwabSync] Account sync failed:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.log(
        "📝 [SchwabSync] Updating sync log with error:",
        errorMessage
      );
      await this.completeSyncLog(syncLog.id, "ERROR", 0, errorMessage);

      const result = {
        success: false,
        recordsProcessed: 0,
        errorMessage,
      };
      console.log("🔄 [SchwabSync] Returning error result:", result);
      return result;
    }
  }

  async syncHoldings(userId: string, accountId?: string): Promise<SyncResult> {
    console.log(
      "📊 [SchwabSync] Starting holdings synchronization for user:",
      userId
    );
    console.log("🔍 [SchwabSync] Account filter:", accountId || "all accounts");
    const syncLog = await this.startSyncLog(userId, "HOLDINGS");
    console.log("📝 [SchwabSync] Created sync log:", syncLog.id);

    try {
      // Get user's Schwab-connected accounts
      console.log("🔍 [SchwabSync] Building query for Schwab accounts");
      let whereClause = and(
        eq(schema.account.userId, userId),
        eq(schema.account.dataSource, "SCHWAB")
      );

      if (accountId) {
        console.log(
          "🎯 [SchwabSync] Filtering by specific account:",
          accountId
        );
        whereClause = and(whereClause, eq(schema.account.id, accountId));
      }

      console.log("🗄️ [SchwabSync] Querying database for Schwab accounts");
      const accounts = await this.db
        .select()
        .from(schema.account)
        .where(whereClause);

      // Filter out demo accounts when using real Schwab credentials
      const realAccounts = accounts.filter((account) => {
        const isDemoAccount =
          account.schwabAccountId?.startsWith("schwab-demo") ||
          account.name?.includes("Demo");
        if (isDemoAccount) {
          console.log(
            "🎭 [SchwabSync] Skipping demo account:",
            account.name,
            account.schwabAccountId
          );
          return false;
        }
        return true;
      });

      console.log(
        "📊 [SchwabSync] Found",
        realAccounts.length,
        "real Schwab accounts to sync (filtered",
        accounts.length - realAccounts.length,
        "demo accounts)"
      );
      console.log(
        "📋 [SchwabSync] Account details:",
        realAccounts.map((a) => ({
          id: a.id,
          name: a.name,
          schwabId: a.schwabAccountId,
        }))
      );

      let processedCount = 0;

      // Fresh discovery set for instruments this run
      try {
        await this.db.delete(schema.schwabSecurity);
      } catch (e) {
        console.warn(
          "⚠️ [SchwabSync] Could not truncate schwab_security before discovery",
          e
        );
      }

      for (const account of realAccounts) {
        console.log(
          "🔄 [SchwabSync] Processing holdings for account:",
          account.name,
          account.schwabAccountId
        );

        if (!account.schwabAccountId) {
          console.warn(
            "⚠️ [SchwabSync] Account has no Schwab ID, skipping:",
            account.name
          );
          continue;
        }

        try {
          // Use accountNumber for positions API, not schwabAccountId (hash)
          const accountIdentifier =
            account.accountNumber || account.schwabAccountId;
          console.log(
            "📡 [SchwabSync] Fetching positions from Schwab API for account:",
            accountIdentifier,
            "(using accountNumber:",
            account.accountNumber,
            ")"
          );
          const positions = await this.schwabApi.getPositions(
            userId,
            accountIdentifier
          );
          // Truncate raw import for this accountNumber then insert
          try {
            const acctNumber =
              account.accountNumber || account.schwabAccountId || "";
            if (acctNumber) {
              await this.db
                .delete(schema.schwabHolding)
                .where(eq(schema.schwabHolding.accountNumber, acctNumber));
              for (const p of positions) {
                await this.db.insert(schema.schwabHolding).values({
                  id: crypto.randomUUID(),
                  accountNumber: acctNumber,
                  symbol: p.instrument.symbol,
                  cusip: p.instrument.cusip,
                  shortQuantity: p.shortQuantity ?? 0,
                  averagePrice: p.averagePrice ?? 0,
                  currentDayProfitLoss: p.currentDayProfitLoss ?? 0,
                  currentDayProfitLossPercentage:
                    p.currentDayProfitLossPercentage ?? 0,
                  longQuantity: p.longQuantity ?? 0,
                  settledLongQuantity: p.settledLongQuantity ?? null,
                  settledShortQuantity: p.settledShortQuantity ?? null,
                  agedQuantity: p.agedQuantity ?? 0,
                  marketValue: p.marketValue ?? 0,
                  maintenanceRequirement: p.maintenanceRequirement ?? null,
                  averageLongPrice: p.averageLongPrice ?? null,
                  averageShortPrice: p.averageShortPrice ?? null,
                  taxLotAverageLongPrice: p.taxLotAverageLongPrice ?? null,
                  taxLotAverageShortPrice: p.taxLotAverageShortPrice ?? null,
                  longOpenProfitLoss: p.longOpenProfitLoss ?? null,
                  shortOpenProfitLoss: p.shortOpenProfitLoss ?? null,
                  previousSessionLongQuantity:
                    p.previousSessionLongQuantity ?? null,
                  previousSessionShortQuantity:
                    p.previousSessionShortQuantity ?? null,
                  currentDayCost: p.currentDayCost ?? null,
                  importedAt: new Date(),
                });
                // Insert/update schwab_security discovery
                try {
                  await this.db.insert(schema.schwabSecurity).values({
                    id: crypto.randomUUID(),
                    symbol: p.instrument.symbol,
                    cusip: p.instrument.cusip ?? null,
                    description: undefined,
                    lastPrice: null,
                    assetMainType: undefined,
                    assetSubType: undefined,
                    exchange: undefined,
                    payload: JSON.stringify(p.instrument),
                    discoveredAt: new Date(),
                  });
                } catch {
                  // Best-effort; ignore dup errors in raw table
                }
              }
            }
          } catch (rawErr) {
            console.warn(
              "⚠️ [SchwabSync] Failed raw import for account",
              account.name,
              rawErr
            );
          }
          console.log(
            "📊 [SchwabSync] Retrieved",
            positions.length,
            "positions for account:",
            account.name
          );

          for (const position of positions) {
            console.log(
              "🔄 [SchwabSync] Processing position:",
              position.instrument.symbol,
              "quantity:",
              position.longQuantity
            );
            await this.syncPosition(account.id, position, syncLog.id);
            processedCount++;
            console.log(
              "✅ [SchwabSync] Completed processing position",
              processedCount
            );
          }

          // Upsert $$$ cash holding using Schwab balances
          try {
            const cash = await this.schwabApi.getAccountCashBalance(
              userId,
              accountIdentifier
            );
            const roundedCash = Math.max(0, Number(cash) || 0);
            console.log(
              "💵 [SchwabSync] Cash balance for account",
              account.name,
              ":",
              roundedCash
            );
            await this.upsertCashHolding(account.id, roundedCash, syncLog.id);
          } catch (cashErr) {
            console.warn(
              "⚠️ [SchwabSync] Failed to upsert cash holding for account",
              account.name,
              cashErr
            );
          }

          // Update account last sync time
          console.log(
            "⏰ [SchwabSync] Updating last sync time for account:",
            account.name
          );
          await this.db
            .update(schema.account)
            .set({ lastSyncAt: new Date(), updatedAt: Date.now() })
            .where(eq(schema.account.id, account.id));
          console.log(
            "✅ [SchwabSync] Updated sync time for account:",
            account.name
          );
        } catch (accountError) {
          console.warn(
            "⚠️ [SchwabSync] Failed to sync account",
            account.name,
            "- continuing with other accounts:",
            accountError instanceof Error ? accountError.message : accountError
          );
          // Continue processing other accounts instead of failing completely
        }
      }

      console.log("🎉 [SchwabSync] Successfully completed holdings sync log");
      await this.completeSyncLog(syncLog.id, "SUCCESS", processedCount);

      const result = {
        success: true,
        recordsProcessed: processedCount,
      };
      console.log(
        "✅ [SchwabSync] Holdings sync completed successfully:",
        result
      );
      return result;
    } catch (error) {
      console.error("❌ [SchwabSync] Holdings sync failed:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.log(
        "📝 [SchwabSync] Updating sync log with error:",
        errorMessage
      );
      await this.completeSyncLog(syncLog.id, "ERROR", 0, errorMessage);

      const result = {
        success: false,
        recordsProcessed: 0,
        errorMessage,
      };
      console.log("🔄 [SchwabSync] Returning error result:", result);
      return result;
    }
  }

  async syncTransactions(
    userId: string,
    options?: { accountId?: string; startDate?: Date; endDate?: Date }
  ): Promise<SyncResult> {
    const start =
      options?.startDate || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const end = options?.endDate || new Date();

    const syncLog = await this.startSyncLog(userId, "TRANSACTIONS");
    try {
      // Get Schwab accounts for the user
      let whereClause = and(
        eq(schema.account.userId, userId),
        eq(schema.account.dataSource, "SCHWAB")
      );
      if (options?.accountId) {
        whereClause = and(
          whereClause,
          eq(schema.account.id, options.accountId)
        );
      }
      const accounts = await this.db
        .select()
        .from(schema.account)
        .where(whereClause);

      let processed = 0;
      for (const account of accounts) {
        // Prefer Schwab hash; fallback to plain account number
        const primaryId = account.schwabAccountId || "";
        const fallbackId = account.accountNumber || "";
        if (!primaryId && !fallbackId) continue;

        let activities: SchwabActivity[] = [];
        try {
          activities = await this.schwabApi.getTransactions(
            userId,
            primaryId || fallbackId,
            {
              startDate: start,
              endDate: end,
              types: "TRADE",
            }
          );
        } catch (err) {
          // Retry with the other identifier if available
          if (primaryId && fallbackId) {
            activities = await this.schwabApi.getTransactions(
              userId,
              fallbackId,
              {
                startDate: start,
                endDate: end,
                types: "TRADE",
              }
            );
          } else {
            throw err;
          }
        }

        if (!Array.isArray(activities) || activities.length === 0) {
          // No transactions in range for this account
          continue;
        }

        for (const activity of activities) {
          const items = activity.transferItems || [];
          for (const item of items) {
            const symbol = item.instrument?.symbol;
            const qty = Math.abs(item.amount || 0);
            const price = item.price ?? 0;
            const isSell =
              (item.positionEffect || "").toUpperCase() === "CLOSING" ||
              (activity.netAmount || 0) > 0;
            const type = isSell ? "SELL" : "BUY";
            if (!symbol || qty <= 0 || price <= 0) continue;

            await this.ensureSecurityExists(symbol);

            const id = `schwab-${activity.activityId}-${account.id}-${symbol}`;
            const executedAt = new Date(
              activity.tradeDate || activity.time || new Date()
            ).getTime();
            const now = Date.now();

            // Upsert transaction by id
            const existing = await this.db
              .select({ id: schema.transaction.id })
              .from(schema.transaction)
              .where(eq(schema.transaction.id, id))
              .limit(1);

            const record = {
              id,
              accountId: account.id,
              sleeveId: null as unknown as string | null,
              ticker: symbol,
              type,
              qty,
              price,
              realizedGainLoss: null as number | null,
              executedAt,
              createdAt: now,
              updatedAt: now,
            };

            if (existing.length > 0) {
              await this.db
                .update(schema.transaction)
                .set({
                  ticker: record.ticker,
                  type: record.type,
                  qty: record.qty,
                  price: record.price,
                  executedAt: record.executedAt,
                  updatedAt: now,
                })
                .where(eq(schema.transaction.id, id));
            } else {
              await this.db.insert(schema.transaction).values(record);
            }
            processed++;
          }
        }
      }

      await this.completeSyncLog(syncLog.id, "SUCCESS", processed);
      return { success: true, recordsProcessed: processed };
    } catch (error) {
      await this.completeSyncLog(
        syncLog.id,
        "ERROR",
        0,
        error instanceof Error ? error.message : String(error)
      );
      return {
        success: false,
        recordsProcessed: 0,
        errorMessage: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async syncPrices(userId: string, symbols?: string[]): Promise<SyncResult> {
    console.log(
      "💰 [SchwabSync] Starting price synchronization for user:",
      userId
    );
    console.log(
      "🔍 [SchwabSync] Symbol filter:",
      symbols || "all user holdings"
    );
    const syncLog = await this.startSyncLog(userId, "PRICES");
    console.log("📝 [SchwabSync] Created sync log:", syncLog.id);

    try {
      // Get symbols to update
      let symbolsToUpdate: string[];

      if (symbols) {
        console.log("🎯 [SchwabSync] Using provided symbols:", symbols);
        symbolsToUpdate = symbols;
      } else {
        // Get all symbols from user's holdings
        console.log(
          "🗄️ [SchwabSync] Querying database for user holdings to get symbols"
        );
        const holdings = await this.db
          .select({ ticker: schema.holding.ticker })
          .from(schema.holding)
          .innerJoin(
            schema.account,
            eq(schema.account.id, schema.holding.accountId)
          )
          .where(eq(schema.account.userId, userId));

        symbolsToUpdate = [...new Set(holdings.map((h) => h.ticker))];
        console.log(
          "📊 [SchwabSync] Found",
          symbolsToUpdate.length,
          "unique symbols from holdings:",
          symbolsToUpdate
        );
      }

      console.log(
        "🚀 [SchwabSync] Starting price updates for",
        symbolsToUpdate.length,
        "symbols (batched)"
      );
      let processedCount = 0;

      // Schwab quotes endpoint supports multiple symbols via comma-separated list.
      // Chunk to a safe size (keep well under any practical limits).
      const MAX_QUOTES_PER_REQUEST = 150;
      const chunk = <T>(arr: T[], size: number): T[][] => {
        const chunks: T[][] = [];
        for (let i = 0; i < arr.length; i += size)
          chunks.push(arr.slice(i, i + size));
        return chunks;
      };

      const batches = chunk(symbolsToUpdate, MAX_QUOTES_PER_REQUEST);
      for (const batch of batches) {
        try {
          const quotes = await this.schwabApi.getBulkQuotes(userId, batch);
          for (const symbol of batch) {
            const q = quotes[symbol];
            if (!q) continue;
            const price = q.lastPrice || q.mark || q.regularMarketPrice || 0;
            const rawSub = (q.assetSubType || "").toUpperCase().trim();
            const validSubs = [
              "COE",
              "PRF",
              "ADR",
              "GDR",
              "CEF",
              "ETF",
              "ETN",
              "UIT",
              "WAR",
              "RGT",
              "OEF",
              "MMF",
            ];
            const subValue =
              rawSub && validSubs.includes(rawSub) ? rawSub : null;
            await this.db
              .update(schema.security)
              .set({ price, assetTypeSub: subValue, updatedAt: Date.now() })
              .where(eq(schema.security.ticker, symbol));
            processedCount++;
          }
        } catch (error) {
          console.warn(
            `⚠️ [SchwabSync] Failed to update prices for batch (${batch.length} symbols):`,
            error
          );
        }
        // brief delay between batches
        await new Promise((r) => setTimeout(r, 150));
      }

      console.log("🎉 [SchwabSync] Successfully completed price sync log");
      await this.completeSyncLog(syncLog.id, "SUCCESS", processedCount);

      const result = {
        success: true,
        recordsProcessed: processedCount,
      };
      console.log("✅ [SchwabSync] Price sync completed successfully:", result);
      return result;
    } catch (error) {
      console.error("❌ [SchwabSync] Price sync failed:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.log(
        "📝 [SchwabSync] Updating sync log with error:",
        errorMessage
      );
      await this.completeSyncLog(syncLog.id, "ERROR", 0, errorMessage);

      const result = {
        success: false,
        recordsProcessed: 0,
        errorMessage,
      };
      console.log("🔄 [SchwabSync] Returning error result:", result);
      return result;
    }
  }

  private async syncAccount(
    userId: string,
    schwabAccount: SchwabAccount,
    nicknameMap: Map<string, string>,
    logId?: string
  ): Promise<void> {
    console.log(
      "🏦 [SchwabSync] Syncing individual account:",
      schwabAccount.accountId
    );
    console.log("📋 [SchwabSync] Account details:", schwabAccount);
    const now = Date.now();

    // Get the nickname from user preferences, fallback to Schwab account nickname or type
    const preferredNickname = nicknameMap.get(schwabAccount.accountNumber);
    const accountName =
      preferredNickname ||
      schwabAccount.nickName ||
      `${schwabAccount.type} Account`;
    console.log(
      `🏷️ [SchwabSync] Account name resolved: ${accountName} (from ${preferredNickname ? "user preferences" : schwabAccount.nickName ? "schwab data" : "default"})`
    );

    // Check if account already exists by (userId, accountNumber) first to avoid duplicates
    console.log(
      "🔍 [SchwabSync] Checking if account exists by (userId, accountNumber)"
    );
    const existingByNumber = schwabAccount.accountNumber
      ? await this.db
          .select()
          .from(schema.account)
          .where(
            and(
              eq(schema.account.userId, userId),
              eq(schema.account.accountNumber, schwabAccount.accountNumber)
            )
          )
          .limit(1)
      : [];

    if (existingByNumber.length > 0) {
      console.log(
        "📊 [SchwabSync] Found existing account by (userId, accountNumber):",
        existingByNumber[0].id
      );
      const updateData = {
        name: accountName,
        type: this.mapSchwabAccountType(schwabAccount.type, accountName),
        // keep same accountNumber, ensure Schwab ID is set/updated
        accountNumber: existingByNumber[0].accountNumber,
        schwabAccountId: schwabAccount.accountId,
        lastSyncAt: new Date(),
        updatedAt: now,
      } as const;
      console.log("📝 [SchwabSync] Update data (by number):", updateData);

      await this.db
        .update(schema.account)
        .set(updateData)
        .where(eq(schema.account.id, existingByNumber[0].id));

      if (logId) {
        try {
          const before = existingByNumber[0] as Record<string, unknown>;
          const changes: Record<string, { old: unknown; new: unknown }> = {};
          Object.entries(updateData).forEach(([k, v]) => {
            if (before && before[k] !== v)
              changes[k] = { old: before[k], new: v };
          });
          await this.db.insert(schema.syncLogDetail).values({
            id: crypto.randomUUID(),
            logId,
            entityType: "ACCOUNT",
            entityId: existingByNumber[0].id,
            operation: "UPDATE",
            changes: JSON.stringify(changes),
            success: true,
            message: undefined,
            createdAt: new Date(),
          });
        } catch {
          // Non-fatal: continue without syncLogDetail
        }
      }
      console.log("✅ [SchwabSync] Updated account by accountNumber");
      return;
    }

    // Otherwise check if account already exists by Schwab accountId (hash)
    console.log(
      "🔍 [SchwabSync] Checking if account exists by Schwab accountId"
    );
    const existingBySchwabId = await this.db
      .select()
      .from(schema.account)
      .where(
        and(
          eq(schema.account.userId, userId),
          eq(schema.account.schwabAccountId, schwabAccount.accountId)
        )
      )
      .limit(1);

    if (existingBySchwabId.length > 0) {
      // Update existing account
      console.log(
        "🔄 [SchwabSync] Updating existing account:",
        existingBySchwabId[0].id
      );
      const updateData = {
        name: accountName,
        type: this.mapSchwabAccountType(schwabAccount.type, accountName),
        accountNumber: schwabAccount.accountNumber,
        lastSyncAt: new Date(),
        updatedAt: now,
      };
      console.log("📝 [SchwabSync] Update data:", updateData);

      await this.db
        .update(schema.account)
        .set(updateData)
        .where(eq(schema.account.id, existingBySchwabId[0].id));
      if (logId) {
        try {
          const before = existingBySchwabId[0] as Record<string, unknown>;
          const changes: Record<string, { old: unknown; new: unknown }> = {};
          Object.entries(updateData).forEach(([k, v]) => {
            if (before && before[k] !== v)
              changes[k] = { old: before[k], new: v };
          });
          await this.db.insert(schema.syncLogDetail).values({
            id: crypto.randomUUID(),
            logId,
            entityType: "ACCOUNT",
            entityId: existingBySchwabId[0].id,
            operation: "UPDATE",
            changes: JSON.stringify(changes),
            success: true,
            message: undefined,
            createdAt: new Date(),
          });
        } catch {
          // Non-fatal: continue without syncLogDetail
        }
      }

      console.log("✅ [SchwabSync] Successfully updated existing account");
    } else {
      // Create new account
      console.log(
        "🆕 [SchwabSync] Creating new account for Schwab ID:",
        schwabAccount.accountId
      );
      const newAccountId = crypto.randomUUID();
      const insertData = {
        id: newAccountId,
        userId,
        name: accountName,
        type: this.mapSchwabAccountType(schwabAccount.type, accountName),
        accountNumber: schwabAccount.accountNumber,
        schwabAccountId: schwabAccount.accountId,
        dataSource: "SCHWAB",
        lastSyncAt: new Date(),
        createdAt: now,
        updatedAt: now,
      };
      console.log("📝 [SchwabSync] Insert data:", insertData);

      await this.db.insert(schema.account).values(insertData);
      console.log(
        "✅ [SchwabSync] Successfully created new account:",
        newAccountId
      );
      if (logId) {
        try {
          await this.db.insert(schema.syncLogDetail).values({
            id: crypto.randomUUID(),
            logId,
            entityType: "ACCOUNT",
            entityId: newAccountId,
            operation: "CREATE",
            changes: JSON.stringify({
              name: { old: undefined, new: insertData.name },
              type: { old: undefined, new: insertData.type },
              accountNumber: { old: undefined, new: insertData.accountNumber },
            }),
            success: true,
            message: undefined,
            createdAt: new Date(),
          });
        } catch {
          // Non-fatal: continue without syncLogDetail
        }
      }
    }
  }

  private async syncPosition(
    accountId: string,
    position: SchwabPosition,
    logId?: string
  ): Promise<void> {
    console.log(
      "📊 [SchwabSync] Syncing individual position for account:",
      accountId
    );
    console.log("📋 [SchwabSync] Position details:", position);
    const now = Date.now();
    const symbol = position.instrument.symbol;

    // Prefer settled long quantity when provided; otherwise use longQuantity
    const quantity = position.settledLongQuantity ?? position.longQuantity ?? 0;
    if (!symbol || quantity <= 0) {
      console.log(
        "⚠️ [SchwabSync] Skipping position with invalid quantity - symbol:",
        symbol,
        "original quantity:",
        position.longQuantity,
        "floored quantity:",
        quantity
      );
      return; // Skip positions with invalid quantities
    }

    console.log(
      "🔍 [SchwabSync] Processing position for symbol:",
      symbol,
      "quantity:",
      position.longQuantity
    );

    // Ensure security exists
    console.log("🔧 [SchwabSync] Ensuring security exists for symbol:", symbol);
    await this.ensureSecurityExists(symbol);

    // Check if holding already exists
    console.log(
      "🔍 [SchwabSync] Checking if holding already exists for account:",
      accountId,
      "symbol:",
      symbol
    );
    const existingHolding = await this.db
      .select()
      .from(schema.holding)
      .where(
        and(
          eq(schema.holding.accountId, accountId),
          eq(schema.holding.ticker, symbol)
        )
      )
      .limit(1);

    console.log(
      "📊 [SchwabSync] Found",
      existingHolding.length,
      "existing holdings for",
      symbol
    );

    const holdingData = {
      qty: quantity, // Preserve fractional quantity
      averageCost: position.averagePrice || 0,
      lastSyncAt: new Date(),
      updatedAt: now,
    };
    console.log("📝 [SchwabSync] Holding data to sync:", holdingData);

    if (existingHolding.length > 0) {
      // Update existing holding
      console.log(
        "🔄 [SchwabSync] Updating existing holding:",
        existingHolding[0].id
      );
      await this.db
        .update(schema.holding)
        .set(holdingData)
        .where(eq(schema.holding.id, existingHolding[0].id));
      console.log(
        "✅ [SchwabSync] Successfully updated existing holding for",
        symbol
      );
      // Record detail row
      try {
        await this.db.insert(schema.syncLogDetail).values({
          id: crypto.randomUUID(),
          logId: logId ?? "",
          entityType: "HOLDING",
          entityId: `${accountId}:${symbol}`,
          operation: "UPDATE",
          changes: JSON.stringify({
            qty: { old: undefined, new: quantity },
            averageCost: { old: undefined, new: position.averagePrice || 0 },
          }),
          success: true,
          message: undefined,
          createdAt: new Date(),
        });
      } catch {
        // Non-fatal: continue without syncLogDetail
      }
    } else {
      // Create new holding
      console.log("🆕 [SchwabSync] Creating new holding for symbol:", symbol);
      const newHoldingId = crypto.randomUUID();
      const insertData = {
        id: newHoldingId,
        accountId,
        ticker: symbol,
        ...holdingData,
        openedAt: now, // Use current time as opened date for imported positions
        dataSource: "SCHWAB",
        createdAt: now,
      };
      console.log("📝 [SchwabSync] Insert data:", insertData);

      await this.db.insert(schema.holding).values(insertData);
      console.log(
        "✅ [SchwabSync] Successfully created new holding:",
        newHoldingId
      );
      // Record detail row
      try {
        await this.db.insert(schema.syncLogDetail).values({
          id: crypto.randomUUID(),
          logId: logId ?? "",
          entityType: "HOLDING",
          entityId: `${accountId}:${symbol}`,
          operation: "CREATE",
          changes: JSON.stringify(insertData),
          success: true,
          message: undefined,
          createdAt: new Date(),
        });
      } catch {
        // Non-fatal: continue without syncLogDetail
      }
    }
  }

  // Ensure $$$ security exists and upsert a holding with qty equal to cash and averageCost $1
  private async upsertCashHolding(
    accountId: string,
    cashAmount: number,
    logId?: string
  ): Promise<void> {
    const now = Date.now();
    const symbol = "$$$";
    // Ensure cash security exists at $1 and asset type CASH/MMF
    const existingSec = await this.db
      .select()
      .from(schema.security)
      .where(eq(schema.security.ticker, symbol))
      .limit(1);
    if (existingSec.length === 0) {
      await this.db.insert(schema.security).values({
        ticker: symbol,
        name: "Cash",
        price: 1.0,
        assetType: "CASH",
        assetTypeSub: "MMF",
        createdAt: now,
        updatedAt: now,
      });
    } else if (existingSec[0].price !== 1.0) {
      await this.db
        .update(schema.security)
        .set({ price: 1.0, assetType: "CASH", assetTypeSub: "MMF", updatedAt: now })
        .where(eq(schema.security.ticker, symbol));
    }

    // If no cash, set qty to 0 (we keep the holding to keep balance consistent), else set qty=cash
    const qty = Math.max(0, Number(cashAmount) || 0);

    const existingHolding = await this.db
      .select()
      .from(schema.holding)
      .where(and(eq(schema.holding.accountId, accountId), eq(schema.holding.ticker, symbol)))
      .limit(1);

    const holdingData = {
      qty,
      averageCost: 1.0,
      lastSyncAt: new Date(),
      updatedAt: now,
    } as const;

    if (existingHolding.length > 0) {
      await this.db
        .update(schema.holding)
        .set(holdingData)
        .where(eq(schema.holding.id, existingHolding[0].id));
      try {
        await this.db.insert(schema.syncLogDetail).values({
          id: crypto.randomUUID(),
          logId: logId ?? "",
          entityType: "HOLDING",
          entityId: `${accountId}:${symbol}`,
          operation: "UPDATE",
          changes: JSON.stringify(holdingData),
          success: true,
          message: undefined,
          createdAt: new Date(),
        });
      } catch {
        // Ignore logging failure - transaction remains valid
      }
    } else {
      await this.db.insert(schema.holding).values({
        id: crypto.randomUUID(),
        accountId,
        ticker: symbol,
        ...holdingData,
        openedAt: now,
        dataSource: "SCHWAB",
        createdAt: now,
      });
      try {
        await this.db.insert(schema.syncLogDetail).values({
          id: crypto.randomUUID(),
          logId: logId ?? "",
          entityType: "HOLDING",
          entityId: `${accountId}:${symbol}`,
          operation: "CREATE",
          changes: JSON.stringify({ qty, averageCost: 1.0 }),
          success: true,
          message: undefined,
          createdAt: new Date(),
        });
      } catch {
        // Ignore logging failure - transaction remains valid
      }
    }
  }

  private async ensureSecurityExists(ticker: string): Promise<void> {
    console.log(
      "🔍 [SchwabSync] Checking if security exists for ticker:",
      ticker
    );
    const existing = await this.db
      .select()
      .from(schema.security)
      .where(eq(schema.security.ticker, ticker))
      .limit(1);

    console.log(
      "📊 [SchwabSync] Found",
      existing.length,
      "existing securities for ticker:",
      ticker
    );

    if (existing.length === 0) {
      console.log("🆕 [SchwabSync] Creating new security for ticker:", ticker);
      const now = Date.now();
      const insertData = {
        ticker,
        name: ticker, // Will be updated when we get more info
        price: 0.01, // Small positive price to pass validation, will be updated by price sync
        createdAt: now,
        updatedAt: now,
      };
      console.log("📝 [SchwabSync] Security insert data:", insertData);

      await this.db.insert(schema.security).values(insertData);
      console.log(
        "✅ [SchwabSync] Successfully created new security for ticker:",
        ticker
      );
    } else {
      console.log(
        "✅ [SchwabSync] Security already exists for ticker:",
        ticker
      );
    }
  }

  private mapSchwabAccountType(
    schwabType: string,
    accountName?: string
  ): string {
    console.log(
      `🔍 [SchwabSync] Mapping account type: schwabType="${schwabType}", accountName="${accountName}"`
    );

    const typeMap: Record<string, string> = {
      CASH: "TAXABLE",
      MARGIN: "TAXABLE",
      IRA: "TAX_DEFERRED",
      ROTH_IRA: "TAX_EXEMPT",
      ROLLOVER_IRA: "TAX_DEFERRED",
      SEP_IRA: "TAX_DEFERRED",
      SIMPLE_IRA: "TAX_DEFERRED",
      "401K": "TAX_DEFERRED",
      ROTH_401K: "TAX_EXEMPT",
    };

    // Check if we have a direct mapping
    if (typeMap[schwabType]) {
      console.log(
        `✅ [SchwabSync] Direct type mapping: ${schwabType} → ${typeMap[schwabType]}`
      );
      return typeMap[schwabType];
    }

    // If no direct mapping, try to infer from account name for retirement accounts
    if (accountName) {
      const nameUpper = accountName.toUpperCase();
      if (nameUpper.includes("IRA") || nameUpper.includes("ROLLOVER")) {
        console.log(
          `🔍 [SchwabSync] Inferred IRA type from account name: "${accountName}"`
        );
        if (nameUpper.includes("ROTH")) {
          return "TAX_EXEMPT";
        }
        return "TAX_DEFERRED";
      }
      if (nameUpper.includes("401K") || nameUpper.includes("401(K)")) {
        console.log(
          `🔍 [SchwabSync] Inferred 401K type from account name: "${accountName}"`
        );
        if (nameUpper.includes("ROTH")) {
          return "TAX_EXEMPT";
        }
        return "TAX_DEFERRED";
      }
    }

    // Last resort: default to UNKNOWN instead of TAXABLE to avoid incorrect tax treatment
    console.warn(
      `⚠️ [SchwabSync] Unknown account type "${schwabType}" with name "${accountName}". Defaulting to UNKNOWN to avoid incorrect tax treatment.`
    );
    return "UNKNOWN";
  }

  private async startSyncLog(userId: string, syncType: string) {
    console.log(
      "📝 [SchwabSync] Starting sync log for user:",
      userId,
      "type:",
      syncType
    );
    const log = {
      id: crypto.randomUUID(),
      userId,
      syncType,
      status: "RUNNING" as const,
      recordsProcessed: 0,
      startedAt: new Date(),
      createdAt: new Date(),
    };
    console.log("📊 [SchwabSync] Sync log data:", log);

    await this.db.insert(schema.syncLog).values(log);
    console.log("✅ [SchwabSync] Successfully created sync log:", log.id);
    return log;
  }

  private async completeSyncLog(
    logId: string,
    status: "SUCCESS" | "ERROR" | "PARTIAL",
    recordsProcessed: number,
    errorMessage?: string
  ): Promise<void> {
    console.log("🏁 [SchwabSync] Completing sync log:", logId);
    console.log(
      "📊 [SchwabSync] Final status:",
      status,
      "records processed:",
      recordsProcessed
    );
    if (errorMessage) {
      console.log("❌ [SchwabSync] Error message:", errorMessage);
    }

    const updateData = {
      status,
      recordsProcessed,
      errorMessage,
      completedAt: new Date(),
    };
    console.log("📝 [SchwabSync] Sync log update data:", updateData);

    await this.db
      .update(schema.syncLog)
      .set(updateData)
      .where(eq(schema.syncLog.id, logId));

    console.log("✅ [SchwabSync] Successfully completed sync log:", logId);
  }
}

// Singleton instance
let schwabSyncService: SchwabSyncService | null = null;

export function getSchwabSyncService(): SchwabSyncService {
  console.log(
    "🔧 [SchwabSync] Getting or creating Schwab sync service instance"
  );
  if (!schwabSyncService) {
    console.log("🆕 [SchwabSync] Creating new Schwab sync service instance");
    schwabSyncService = new SchwabSyncService();
    console.log("✅ [SchwabSync] Schwab sync service instance created");
  } else {
    console.log("♻️ [SchwabSync] Using existing Schwab sync service instance");
  }
  return schwabSyncService;
}
