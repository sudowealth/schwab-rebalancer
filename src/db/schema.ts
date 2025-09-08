import {
  sqliteTable,
  text,
  integer,
  real,
  unique,
  index as sqliteIndex,
} from "drizzle-orm/sqlite-core";

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  email: text("email").unique().notNull(),
  emailVerified: integer("emailVerified", { mode: "boolean" }),
  name: text("name"),
  image: text("image"),
  role: text("role").default("user"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
  token: text("token").unique().notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const authAccount = sqliteTable("auth_account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: integer("accessTokenExpiresAt", { mode: "timestamp" }),
  refreshTokenExpiresAt: integer("refreshTokenExpiresAt", {
    mode: "timestamp",
  }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }),
  updatedAt: integer("updatedAt", { mode: "timestamp" }),
});

// Financial data tables
export const security = sqliteTable("security", {
  ticker: text("ticker").primaryKey(),
  name: text("name").notNull(),
  price: real("price").notNull(),
  marketCap: integer("marketCap"), // Store in millions
  peRatio: real("peRatio"),
  industry: text("industry"),
  sector: text("sector"),
  assetType: text("assetType").notNull().default("EQUITY"), // BOND, EQUITY, FOREX, FUTURE, FUTURE_OPTION, INDEX, MUTUAL_FUND, OPTION
  assetTypeSub: text("assetTypeSub"), // null or one of: COE, PRF, ADR, GDR, CEF, ETF, ETN, UIT, WAR, RGT, OEF, MMF
  createdAt: integer("createdAt").notNull(),
  updatedAt: integer("updatedAt").notNull(),
});

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type").notNull().default(""), // "TAXABLE", "TAX_DEFERRED", "TAX_EXEMPT", or empty string
    accountNumber: text("accountNumber"), // Optional for migration
    schwabAccountId: text("schwabAccountId"), // Schwab account identifier
    dataSource: text("dataSource").notNull().default("MANUAL"), // "MANUAL" | "SCHWAB"
    lastSyncAt: integer("lastSyncAt", { mode: "timestamp" }), // Last sync with Schwab
    createdAt: integer("createdAt").notNull(),
    updatedAt: integer("updatedAt").notNull(),
  },
  (table) => [
    // Ensure a user cannot have duplicate account numbers; allows multiple NULLs
    unique().on(table.userId, table.accountNumber),
  ]
);

export const sleeve = sqliteTable(
  "sleeve",
  {
    id: text("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    isActive: integer("isActive", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("createdAt").notNull(),
    updatedAt: integer("updatedAt").notNull(),
  },
  (table) => [
    // Ensure a user cannot have duplicate sleeve names when active
    unique().on(table.userId, table.name),
  ]
);

export const sleeveMember = sqliteTable("sleeve_member", {
  id: text("id").primaryKey(),
  sleeveId: text("sleeveId")
    .notNull()
    .references(() => sleeve.id, { onDelete: "cascade" }),
  ticker: text("ticker")
    .notNull()
    .references(() => security.ticker, { onDelete: "cascade" }),
  rank: integer("rank").notNull(),
  isActive: integer("isActive", { mode: "boolean" }).notNull().default(true),
  isRestricted: integer("isRestricted", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: integer("createdAt").notNull(),
  updatedAt: integer("updatedAt").notNull(),
});

export const holding = sqliteTable("holding", {
  id: text("id").primaryKey(),
  accountId: text("accountId")
    .notNull()
    .references(() => account.id, { onDelete: "cascade" }),
  ticker: text("ticker")
    .notNull()
    .references(() => security.ticker, { onDelete: "cascade" }),
  qty: real("qty").notNull(),
  averageCost: real("averageCost").notNull(),
  openedAt: integer("openedAt").notNull(),
  schwabPositionId: text("schwabPositionId"), // Schwab position identifier
  dataSource: text("dataSource").notNull().default("MANUAL"), // "MANUAL" | "SCHWAB"
  lastSyncAt: integer("lastSyncAt", { mode: "timestamp" }), // Last sync with Schwab
  createdAt: integer("createdAt").notNull(),
  updatedAt: integer("updatedAt").notNull(),
});

export const transaction = sqliteTable("transaction", {
  id: text("id").primaryKey(),
  accountId: text("accountId")
    .notNull()
    .references(() => account.id, { onDelete: "cascade" }),
  sleeveId: text("sleeveId").references(() => sleeve.id, {
    onDelete: "set null",
  }),
  ticker: text("ticker")
    .notNull()
    .references(() => security.ticker, { onDelete: "cascade" }),
  type: text("type").notNull(), // "BUY", "SELL"
  qty: real("qty").notNull(),
  price: real("price").notNull(),
  realizedGainLoss: real("realizedGainLoss"),
  executedAt: integer("executedAt").notNull(),
  createdAt: integer("createdAt").notNull(),
  updatedAt: integer("updatedAt").notNull(),
});

export const restrictedSecurity = sqliteTable("restricted_security", {
  id: text("id").primaryKey(),
  ticker: text("ticker")
    .notNull()
    .references(() => security.ticker, { onDelete: "cascade" }),
  sleeveId: text("sleeveId")
    .notNull()
    .references(() => sleeve.id, { onDelete: "cascade" }),
  lossAmount: real("lossAmount").notNull(),
  soldAt: integer("soldAt").notNull(),
  blockedUntil: integer("blockedUntil").notNull(),
  createdAt: integer("createdAt").notNull(),
  updatedAt: integer("updatedAt").notNull(),
});

export const index = sqliteTable("index", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: integer("createdAt").notNull(),
  updatedAt: integer("updatedAt").notNull(),
});

export const indexMember = sqliteTable("index_member", {
  id: text("id").primaryKey(),
  indexId: text("indexId")
    .notNull()
    .references(() => index.id, { onDelete: "cascade" }),
  securityId: text("securityId")
    .notNull()
    .references(() => security.ticker, { onDelete: "cascade" }),
  createdAt: integer("createdAt").notNull(),
  updatedAt: integer("updatedAt").notNull(),
});

// Central audit log
export const auditLog = sqliteTable("audit_log", {
  id: text("id").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  entityType: text("entityType").notNull(),
  entityId: text("entityId"),
  metadata: text("metadata"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
});

export const model = sqliteTable(
  "model",
  {
    id: text("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    isActive: integer("isActive", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("createdAt").notNull(),
    updatedAt: integer("updatedAt").notNull(),
  },
  (table) => [
    // Ensure a user cannot have duplicate model names when active
    unique().on(table.userId, table.name),
  ]
);

export const modelGroupAssignment = sqliteTable(
  "model_group_assignment",
  {
    id: text("id").primaryKey(),
    modelId: text("modelId")
      .notNull()
      .references(() => model.id, { onDelete: "cascade" }),
    rebalancingGroupId: text("rebalancingGroupId")
      .notNull()
      .references(() => rebalancingGroup.id, { onDelete: "cascade" }),
    createdAt: integer("createdAt").notNull(),
    updatedAt: integer("updatedAt").notNull(),
  },
  (table) => ({
    uniqueAssignment: unique().on(table.modelId, table.rebalancingGroupId),
  })
);

export const modelMember = sqliteTable("model_member", {
  id: text("id").primaryKey(),
  modelId: text("modelId")
    .notNull()
    .references(() => model.id, { onDelete: "cascade" }),
  sleeveId: text("sleeveId")
    .notNull()
    .references(() => sleeve.id, { onDelete: "cascade" }),
  targetWeight: integer("targetWeight").notNull(), // Store as basis points (10000 = 100%)
  isActive: integer("isActive", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("createdAt").notNull(),
  updatedAt: integer("updatedAt").notNull(),
});

export const rebalancingGroup = sqliteTable("rebalancing_group", {
  id: text("id").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  isActive: integer("isActive", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("createdAt").notNull(),
  updatedAt: integer("updatedAt").notNull(),
});

export const rebalancingGroupMember = sqliteTable("rebalancing_group_member", {
  id: text("id").primaryKey(),
  groupId: text("groupId")
    .notNull()
    .references(() => rebalancingGroup.id, { onDelete: "cascade" }),
  accountId: text("accountId")
    .notNull()
    .references(() => account.id, { onDelete: "cascade" }),
  isActive: integer("isActive", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("createdAt").notNull(),
  updatedAt: integer("updatedAt").notNull(),
});

// New table for Schwab API credentials
export const schwabCredentials = sqliteTable("schwab_credentials", {
  id: text("id").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  encryptedAccessToken: text("encryptedAccessToken").notNull(),
  encryptedRefreshToken: text("encryptedRefreshToken").notNull(),
  tokenExpiresAt: integer("tokenExpiresAt", { mode: "timestamp" }).notNull(),
  refreshTokenExpiresAt: integer("refreshTokenExpiresAt", {
    mode: "timestamp",
  }).notNull(),
  schwabClientId: text("schwabClientId").notNull(),
  isActive: integer("isActive", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});

// New table for sync audit logs
export const syncLog = sqliteTable("sync_log", {
  id: text("id").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  syncType: text("syncType").notNull(), // "ACCOUNTS" | "HOLDINGS" | "PRICES"
  status: text("status").notNull(), // "SUCCESS" | "ERROR" | "PARTIAL"
  recordsProcessed: integer("recordsProcessed").notNull().default(0),
  errorMessage: text("errorMessage"),
  startedAt: integer("startedAt", { mode: "timestamp" }).notNull(),
  completedAt: integer("completedAt", { mode: "timestamp" }),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
});

// Details for price sync logs (per-ticker)
export const syncLogDetail = sqliteTable("sync_log_detail", {
  id: text("id").primaryKey(),
  logId: text("logId")
    .notNull()
    .references(() => syncLog.id, { onDelete: "cascade" }),
  // Generic targeting info for any sync entity
  entityType: text("entityType").notNull(), // SECURITY | ACCOUNT | HOLDING | MODEL | ...
  entityId: text("entityId").notNull(),
  operation: text("operation").notNull(), // CREATE | UPDATE | DELETE | UPSERT | NOOP
  // JSON string of field changes: { field: { old: any, new: any } }
  changes: text("changes"),
  success: integer("success", { mode: "boolean" }).notNull().default(true),
  message: text("message"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
});

// Raw import table for Schwab positions (truncate-and-load on each import)
export const schwabHolding = sqliteTable(
  "schwab_holding",
  {
    id: text("id").primaryKey(),
    accountNumber: text("accountNumber").notNull(),
    symbol: text("symbol").notNull(),
    cusip: text("cusip"),
    shortQuantity: real("shortQuantity"),
    averagePrice: real("averagePrice"),
    currentDayProfitLoss: real("currentDayProfitLoss"),
    currentDayProfitLossPercentage: real("currentDayProfitLossPercentage"),
    longQuantity: real("longQuantity"),
    settledLongQuantity: real("settledLongQuantity"),
    settledShortQuantity: real("settledShortQuantity"),
    agedQuantity: real("agedQuantity"),
    marketValue: real("marketValue"),
    maintenanceRequirement: real("maintenanceRequirement"),
    averageLongPrice: real("averageLongPrice"),
    averageShortPrice: real("averageShortPrice"),
    taxLotAverageLongPrice: real("taxLotAverageLongPrice"),
    taxLotAverageShortPrice: real("taxLotAverageShortPrice"),
    longOpenProfitLoss: real("longOpenProfitLoss"),
    shortOpenProfitLoss: real("shortOpenProfitLoss"),
    previousSessionLongQuantity: real("previousSessionLongQuantity"),
    previousSessionShortQuantity: real("previousSessionShortQuantity"),
    currentDayCost: real("currentDayCost"),
    importedAt: integer("importedAt", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    sqliteIndex("idx_schwab_holding_account_symbol").on(
      table.accountNumber,
      table.symbol
    ),
  ]
);

// Raw import table for Schwab accounts (truncate-and-load on each import)
export const schwabAccount = sqliteTable(
  "schwab_account",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(), // CASH | MARGIN
    accountNumber: text("accountNumber").notNull(),
    roundTrips: integer("roundTrips"),
    isDayTrader: integer("isDayTrader", { mode: "boolean" }),
    isClosingOnlyRestricted: integer("isClosingOnlyRestricted", {
      mode: "boolean",
    }),
    pfcbFlag: integer("pfcbFlag", { mode: "boolean" }),
    cashAvailableForTrading: real("cashAvailableForTrading"),
    cashAvailableForWithdrawal: real("cashAvailableForWithdrawal"),
    cashCall: real("cashCall"),
    longNonMarginableMarketValue: real("longNonMarginableMarketValue"),
    totalCash: real("totalCash"),
    cashDebitCallValue: real("cashDebitCallValue"),
    unsettledCash: real("unsettledCash"),
    importedAt: integer("importedAt", { mode: "timestamp" }).notNull(),
    payload: text("payload"),
  },
  (table) => [
    unique().on(table.accountNumber),
    sqliteIndex("idx_schwab_account_type").on(table.type),
  ]
);

// Raw import table for Schwab securities/instruments
export const schwabSecurity = sqliteTable(
  "schwab_security",
  {
    id: text("id").primaryKey(),
    symbol: text("symbol").notNull(),
    cusip: text("cusip"),
    description: text("description"),
    lastPrice: real("lastPrice"),
    assetMainType: text("assetMainType"),
    assetSubType: text("assetSubType"),
    exchange: text("exchange"),
    payload: text("payload"),
    discoveredAt: integer("discoveredAt", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    unique().on(table.symbol),
    sqliteIndex("idx_schwab_security_cusip").on(table.cusip),
    sqliteIndex("idx_schwab_security_discoveredAt").on(table.discoveredAt),
  ]
);

// Raw import table for Schwab transactions/activity
export const schwabTransaction = sqliteTable(
  "schwab_transaction",
  {
    id: text("id").primaryKey(),
    activityId: integer("activityId"),
    time: text("time"),
    description: text("description"),
    accountNumber: text("accountNumber").notNull(),
    type: text("type"),
    status: text("status"),
    subAccount: text("subAccount"),
    tradeDate: text("tradeDate"),
    settlementDate: text("settlementDate"),
    positionId: integer("positionId"),
    orderId: integer("orderId"),
    netAmount: real("netAmount"),
    activityType: text("activityType"),
    importedAt: integer("importedAt", { mode: "timestamp" }).notNull(),
    payload: text("payload"),
  },
  (table) => [
    unique().on(table.activityId),
    sqliteIndex("idx_schwab_transaction_accountNumber").on(table.accountNumber),
    sqliteIndex("idx_schwab_transaction_time").on(table.time),
    sqliteIndex("idx_schwab_transaction_type").on(table.type),
  ]
);

// Trading order management
export const tradeOrder = sqliteTable(
  "trade_order",
  {
    id: text("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accountId: text("accountId")
      .notNull()
      .references(() => account.id, { onDelete: "cascade" }),

    // Core inputs (single-leg, long-only)
    symbol: text("symbol").notNull(),
    side: text("side").notNull(), // BUY | SELL
    qty: real("qty").notNull(),
    type: text("type").notNull().default("MARKET"), // MARKET | LIMIT | STOP | STOP_LIMIT
    limit: real("limit"),
    stop: real("stop"),
    tif: text("tif").notNull().default("DAY"), // DAY | GTC
    session: text("session").notNull().default("NORMAL"), // NORMAL | AM | PM | ALL

    // Broker/UI flags
    taxLotMethod: text("taxLotMethod"),
    specialInstruction: text("specialInstruction"),
    quantityType: text("quantityType"), // ALL_SHARES | SHARES | DOLLARS
    amountIndicator: text("amountIndicator"), // SHARES | DOLLARS
    orderStrategyType: text("orderStrategyType"),
    complexOrderStrategyType: text("complexOrderStrategyType"),
    requestedDestination: text("requestedDestination"),
    destinationLinkName: text("destinationLinkName"),

    // Preview cache
    previewJson: text("previewJson"), // JSON string
    previewOrderValue: real("previewOrderValue"),
    previewProjectedCommission: real("previewProjectedCommission"),
    previewWarnCount: integer("previewWarnCount").notNull().default(0),
    previewErrorCount: integer("previewErrorCount").notNull().default(0),
    previewFirstMessage: text("previewFirstMessage"),

    // Live mapping / status
    schwabOrderId: text("schwabOrderId"),
    status: text("status").notNull().default("DRAFT"),
    statusDescription: text("statusDescription"),
    cancelable: integer("cancelable", { mode: "boolean" })
      .notNull()
      .default(false),
    editable: integer("editable", { mode: "boolean" }).notNull().default(false),
    quantity: real("quantity"),
    filledQuantity: real("filledQuantity").notNull().default(0),
    remainingQuantity: real("remainingQuantity").notNull().default(0),

    // Times
    enteredAt: integer("enteredAt", { mode: "timestamp" }),
    closeAt: integer("closeAt", { mode: "timestamp" }),
    cancelAt: integer("cancelAt", { mode: "timestamp" }),
    placedAt: integer("placedAt", { mode: "timestamp" }),
    closedAt: integer("closedAt", { mode: "timestamp" }),

    // Instrument refs
    cusip: text("cusip"),
    instrumentId: text("instrumentId"),

    // Replace chain
    replacesSchwabOrderId: text("replacesSchwabOrderId"),
    replacedBySchwabOrderId: text("replacedBySchwabOrderId"),

    // Economics
    avgFillPrice: real("avgFillPrice"),
    lastFillPrice: real("lastFillPrice"),
    filledNotional: real("filledNotional"),
    realizedCommission: real("realizedCommission"),
    realizedFeesTotal: real("realizedFeesTotal"),

    // Raw snapshot
    lastSnapshot: text("lastSnapshot"), // JSON string

    // Ops
    idempotencyKey: text("idempotencyKey"),
    batchLabel: text("batchLabel"),

    createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    sqliteIndex("idx_trade_order_user_account_status").on(
      table.userId,
      table.accountId,
      table.status
    ),
    sqliteIndex("idx_trade_order_account_schwab").on(
      table.accountId,
      table.schwabOrderId
    ),
    unique().on(table.accountId, table.idempotencyKey),
  ]
);

export const orderExecution = sqliteTable(
  "order_execution",
  {
    id: text("id").primaryKey(),
    orderId: text("orderId")
      .notNull()
      .references(() => tradeOrder.id, { onDelete: "cascade" }),
    legId: integer("legId"),
    time: integer("time", { mode: "timestamp" }).notNull(),
    price: real("price").notNull(),
    qty: real("qty").notNull(),
    instrumentId: text("instrumentId"),
    fee: real("fee"),
    raw: text("raw"), // JSON string
    settlementDate: integer("settlementDate", { mode: "timestamp" }),
    createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    sqliteIndex("idx_order_execution_order_time").on(table.orderId, table.time),
  ]
);

// Financial Planning Tables
export const financialPlan = sqliteTable("financial_plan", {
  id: text("id").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});

export const financialPlanInput = sqliteTable("financial_plan_input", {
  id: text("id").primaryKey(),
  planId: text("planId")
    .notNull()
    .references(() => financialPlan.id, { onDelete: "cascade" }),
  filingStatus: text("filingStatus").notNull().default("single"), // single, married_filing_jointly, head_of_household
  primaryUserAge: integer("primaryUserAge").notNull(),
  spouseAge: integer("spouseAge"),
  simulationPeriod: integer("simulationPeriod").notNull().default(50),
  returnRate: real("returnRate").notNull().default(10.0),
  inflationRate: real("inflationRate").notNull().default(2.0),
  dividendRate: real("dividendRate").notNull().default(2.0),
  taxableBalance: real("taxableBalance").notNull().default(100000),
  taxableCostBasis: real("taxableCostBasis").notNull().default(100000),
  rothBalance: real("rothBalance").notNull().default(100000),
  deferredBalance: real("deferredBalance").notNull().default(100000),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});

export const financialPlanGoal = sqliteTable("financial_plan_goal", {
  id: text("id").primaryKey(),
  planId: text("planId")
    .notNull()
    .references(() => financialPlan.id, { onDelete: "cascade" }),
  purpose: text("purpose"),
  type: text("type").notNull(), // contribution, fixed_withdrawal
  amount: real("amount").notNull(),
  inflationAdjusted: integer("inflationAdjusted", { mode: "boolean" }).notNull().default(true),
  startTiming: text("startTiming").notNull().default("immediately"),
  durationYears: integer("durationYears").notNull(),
  frequency: text("frequency").notNull().default("annually"), // annually, monthly
  repeatPattern: text("repeatPattern").notNull().default("none"),
  occurrences: integer("occurrences").notNull().default(1),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
});

export const taxBracket = sqliteTable("tax_bracket", {
  id: text("id").primaryKey(),
  bracketType: text("bracketType").notNull(), // federal_income, federal_capital_gains, california_income
  filingStatus: text("filingStatus").notNull(), // single, married_filing_jointly, head_of_household
  minIncome: real("minIncome").notNull(),
  maxIncome: real("maxIncome"), // null for top bracket
  rate: real("rate").notNull(),
  year: integer("year").notNull().default(2025),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
});

export const financialPlanResult = sqliteTable("financial_plan_result", {
  id: text("id").primaryKey(),
  planId: text("planId")
    .notNull()
    .references(() => financialPlan.id, { onDelete: "cascade" }),
  year: integer("year").notNull(),
  startingTaxable: real("startingTaxable").notNull(),
  startingRoth: real("startingRoth").notNull(),
  startingDeferred: real("startingDeferred").notNull(),
  growthTaxable: real("growthTaxable").notNull(),
  growthRoth: real("growthRoth").notNull(),
  growthDeferred: real("growthDeferred").notNull(),
  contributionsTaxable: real("contributionsTaxable").notNull(),
  contributionsRoth: real("contributionsRoth").notNull(),
  contributionsDeferred: real("contributionsDeferred").notNull(),
  withdrawalsTaxable: real("withdrawalsTaxable").notNull(),
  withdrawalsRoth: real("withdrawalsRoth").notNull(),
  withdrawalsDeferred: real("withdrawalsDeferred").notNull(),
  federalIncomeTax: real("federalIncomeTax").notNull(),
  californiaIncomeTax: real("californiaIncomeTax").notNull(),
  federalCapitalGainsTax: real("federalCapitalGainsTax").notNull(),
  californiaCapitalGainsTax: real("californiaCapitalGainsTax").notNull(),
  federalDividendTax: real("federalDividendTax").notNull(),
  californiaDividendTax: real("californiaDividendTax").notNull(),
  totalTaxes: real("totalTaxes").notNull(),
  endingTaxable: real("endingTaxable").notNull(),
  endingRoth: real("endingRoth").notNull(),
  endingDeferred: real("endingDeferred").notNull(),
  totalPortfolioNominal: real("totalPortfolioNominal").notNull(),
  totalPortfolioReal: real("totalPortfolioReal").notNull(),
  calculatedAt: integer("calculatedAt", { mode: "timestamp" }).notNull(),
});
