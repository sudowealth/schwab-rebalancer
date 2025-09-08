# Schwab Integration Guide

For setup instructions, see `SCHWAB_SETUP.md`.

## Architecture Overview

**Core Components:**

- OAuth 2.0 with encrypted token storage (`schwab_credentials`)
- Sync services (`SchwabSyncService`, `PriceSyncService`)
- Audit logging (`sync_log`, `sync_log_detail`)
- UI controls (`/data-feeds` page)

**Data Flow:** UI → Server Functions → Sync Services → Database Tables

## Sync Operations

### Accounts

- **Entry:** `syncSchwabAccountsServerFn` → `SchwabSyncService.syncAccounts()`
- **Logic:** Fetch from Schwab API → staging table `schwab_account` → upsert to `account`
- **Keys:** Match by `(userId, accountNumber)` or `(userId, schwabAccountId)`

### Holdings

- **Entry:** `syncSchwabHoldingsServerFn` → `SchwabSyncService.syncHoldings()`
- **Logic:** Fetch positions → staging `schwab_holding` → ensure `security` exists → upsert `holding`
- **Keys:** Match by `(accountId, ticker)`

### Transactions

- **Entry:** `syncSchwabTransactionsServerFn` → `SchwabSyncService.syncTransactions()`
- **Logic:** Fetch activities → derive trades → upsert `transaction`
- **Keys:** Deterministic ID: `schwab-${activityId}-${accountId}-${symbol}`

### Prices

- **Entry:** `syncSchwabPricesServerFn` → `PriceSyncService.syncPrices()`
- **Logic:** Schwab quotes (batches ≤150) → Yahoo fallback → update `security.price`
- **Caching:** 60-second TTL, skip recent updates unless `forceRefresh`

## Database Schema

```typescript
// Core tables
account: {
  (userId, accountNumber, schwabAccountId, name, type, dataSource);
}
holding: {
  (accountId, ticker, qty, averageCost, openedAt, dataSource);
}
security: {
  (ticker, name, price, assetType);
}
transaction: {
  (id, accountId, ticker, type, qty, price, executedAt);
}

// Staging tables
(schwab_account, schwab_holding, schwab_security, schwab_transaction);

// Audit
sync_log: {
  (type, status, entityCount, errorCount);
}
sync_log_detail: {
  (syncLogId, entityType, entityId, changeType, changes);
}

// Credentials
schwab_credentials: {
  (userId, accessToken, refreshToken, expiresAt);
}
```

## Key Files

- **UI:** `src/components/SchwabIntegrationSimple.tsx`
- **Server Functions:** `src/lib/server-functions.ts` (lines 1179-1412)
- **Sync Services:** `src/lib/schwab-sync.ts`, `src/lib/price-sync.ts`
- **API Client:** `src/lib/schwab-api.ts`
- **Schema:** `src/db/schema.ts`

## Adding New Sync Types

1. **UI:** Add button/handler calling new server function
2. **Server Function:** Resolve `userId` → create `sync_log` → call service → log details
3. **Service:** Optional staging → ensure dependencies → upsert final tables
4. **Patterns:** Use natural keys, track field changes, maintain timestamps

**Standard Flow:** Staging → Validation → Upsert → Audit → Complete
