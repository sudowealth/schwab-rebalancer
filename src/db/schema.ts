import {
  bigint,
  boolean,
  index,
  integer,
  pgTable,
  real,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  email: text('email').unique().notNull(),
  emailVerified: boolean('emailVerified'),
  name: text('name'),
  image: text('image'),
  role: text('role').default('user'),
  // Account lockout fields
  failedLoginAttempts: integer('failedLoginAttempts').default(0).notNull(),
  lastFailedLoginAt: timestamp('lastFailedLoginAt'),
  lockedUntil: timestamp('lockedUntil'),
  createdAt: timestamp('createdAt').notNull(),
  updatedAt: timestamp('updatedAt').notNull(),
});

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expiresAt').notNull(),
  token: text('token').unique().notNull(),
  createdAt: timestamp('createdAt').notNull(),
  updatedAt: timestamp('updatedAt').notNull(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
});

export const authAccount = pgTable('auth_account', {
  id: text('id').primaryKey(),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: timestamp('accessTokenExpiresAt'),
  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('createdAt').notNull(),
  updatedAt: timestamp('updatedAt').notNull(),
});

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt').notNull(),
  createdAt: timestamp('createdAt'),
  updatedAt: timestamp('updatedAt'),
});

// Financial data tables
export const security = pgTable('security', {
  ticker: text('ticker').primaryKey(),
  name: text('name').notNull(),
  price: real('price').notNull(),
  marketCap: integer('marketCap'), // Store in millions
  peRatio: real('peRatio'),
  industry: text('industry'),
  sector: text('sector'),
  assetType: text('assetType').notNull().default('EQUITY'), // BOND, EQUITY, FOREX, FUTURE, FUTURE_OPTION, INDEX, MUTUAL_FUND, OPTION
  assetTypeSub: text('assetTypeSub'), // null or one of: COE, PRF, ADR, GDR, CEF, ETF, ETN, UIT, WAR, RGT, OEF, MMF
  createdAt: bigint('createdAt', { mode: 'number' }).notNull(),
  updatedAt: bigint('updatedAt', { mode: 'number' }).notNull(),
});

export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    userId: text('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    type: text('type').notNull().default(''), // "TAXABLE", "TAX_DEFERRED", "TAX_EXEMPT", or empty string
    accountNumber: text('accountNumber'), // Optional for migration
    schwabAccountId: text('schwabAccountId'), // Schwab account identifier
    dataSource: text('dataSource').notNull().default('MANUAL'), // "MANUAL" | "SCHWAB"
    lastSyncAt: timestamp('lastSyncAt'), // Last sync with Schwab
    createdAt: bigint('createdAt', { mode: 'number' }).notNull(),
    updatedAt: bigint('updatedAt', { mode: 'number' }).notNull(),
  },
  (table) => [
    // Ensure a user cannot have duplicate account numbers; allows multiple NULLs
    unique().on(table.userId, table.accountNumber),
  ],
);

export const sleeve = pgTable(
  'sleeve',
  {
    id: text('id').primaryKey(),
    userId: text('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    isActive: boolean('isActive').notNull().default(true),
    createdAt: bigint('createdAt', { mode: 'number' }).notNull(),
    updatedAt: bigint('updatedAt', { mode: 'number' }).notNull(),
  },
  (table) => [
    // Ensure a user cannot have duplicate sleeve names when active
    unique().on(table.userId, table.name),
  ],
);

export const sleeveMember = pgTable('sleeve_member', {
  id: text('id').primaryKey(),
  sleeveId: text('sleeveId')
    .notNull()
    .references(() => sleeve.id, { onDelete: 'cascade' }),
  ticker: text('ticker')
    .notNull()
    .references(() => security.ticker, { onDelete: 'cascade' }),
  rank: integer('rank').notNull(),
  isActive: boolean('isActive').notNull().default(true),
  isLegacy: boolean('isLegacy').notNull().default(false),
  createdAt: bigint('createdAt', { mode: 'number' }).notNull(),
  updatedAt: bigint('updatedAt', { mode: 'number' }).notNull(),
});

export const holding = pgTable('holding', {
  id: text('id').primaryKey(),
  accountId: text('accountId')
    .notNull()
    .references(() => account.id, { onDelete: 'cascade' }),
  ticker: text('ticker')
    .notNull()
    .references(() => security.ticker, { onDelete: 'cascade' }),
  qty: real('qty').notNull(),
  averageCost: real('averageCost').notNull(),
  openedAt: bigint('openedAt', { mode: 'number' }).notNull(),
  schwabPositionId: text('schwabPositionId'), // Schwab position identifier
  dataSource: text('dataSource').notNull().default('MANUAL'), // "MANUAL" | "SCHWAB"
  lastSyncAt: timestamp('lastSyncAt'), // Last sync with Schwab
  createdAt: bigint('createdAt', { mode: 'number' }).notNull(),
  updatedAt: bigint('updatedAt', { mode: 'number' }).notNull(),
});

export const transaction = pgTable('transaction', {
  id: text('id').primaryKey(),
  accountId: text('accountId')
    .notNull()
    .references(() => account.id, { onDelete: 'cascade' }),
  sleeveId: text('sleeveId').references(() => sleeve.id, {
    onDelete: 'set null',
  }),
  ticker: text('ticker')
    .notNull()
    .references(() => security.ticker, { onDelete: 'cascade' }),
  type: text('type').notNull(), // "BUY", "SELL"
  qty: real('qty').notNull(),
  price: real('price').notNull(),
  realizedGainLoss: real('realizedGainLoss'),
  executedAt: bigint('executedAt', { mode: 'number' }).notNull(),
  createdAt: bigint('createdAt', { mode: 'number' }).notNull(),
  updatedAt: bigint('updatedAt', { mode: 'number' }).notNull(),
});

export const restrictedSecurity = pgTable('restricted_security', {
  id: text('id').primaryKey(),
  ticker: text('ticker')
    .notNull()
    .references(() => security.ticker, { onDelete: 'cascade' }),
  sleeveId: text('sleeveId')
    .notNull()
    .references(() => sleeve.id, { onDelete: 'cascade' }),
  lossAmount: real('lossAmount').notNull(),
  soldAt: bigint('soldAt', { mode: 'number' }).notNull(),
  blockedUntil: bigint('blockedUntil', { mode: 'number' }).notNull(),
  createdAt: bigint('createdAt', { mode: 'number' }).notNull(),
  updatedAt: bigint('updatedAt', { mode: 'number' }).notNull(),
});

export const indexTable = pgTable('index', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: bigint('createdAt', { mode: 'number' }).notNull(),
  updatedAt: bigint('updatedAt', { mode: 'number' }).notNull(),
});

export const indexMember = pgTable('index_member', {
  id: text('id').primaryKey(),
  indexId: text('indexId')
    .notNull()
    .references(() => indexTable.id, { onDelete: 'cascade' }),
  securityId: text('securityId')
    .notNull()
    .references(() => security.ticker, { onDelete: 'cascade' }),
  createdAt: bigint('createdAt', { mode: 'number' }).notNull(),
  updatedAt: bigint('updatedAt', { mode: 'number' }).notNull(),
});

// Central audit log
export const auditLog = pgTable('audit_log', {
  id: text('id').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  action: text('action').notNull(),
  entityType: text('entityType').notNull(),
  entityId: text('entityId'),
  metadata: text('metadata'),
  createdAt: timestamp('createdAt').notNull(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
});

export const model = pgTable(
  'model',
  {
    id: text('id').primaryKey(),
    userId: text('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    isActive: boolean('isActive').notNull().default(true),
    createdAt: bigint('createdAt', { mode: 'number' }).notNull(),
    updatedAt: bigint('updatedAt', { mode: 'number' }).notNull(),
  },
  (table) => [
    // Ensure a user cannot have duplicate model names when active
    unique().on(table.userId, table.name),
  ],
);

export const modelGroupAssignment = pgTable(
  'model_group_assignment',
  {
    id: text('id').primaryKey(),
    modelId: text('modelId')
      .notNull()
      .references(() => model.id, { onDelete: 'cascade' }),
    rebalancingGroupId: text('rebalancingGroupId')
      .notNull()
      .references(() => rebalancingGroup.id, { onDelete: 'cascade' }),
    createdAt: bigint('createdAt', { mode: 'number' }).notNull(),
    updatedAt: bigint('updatedAt', { mode: 'number' }).notNull(),
  },
  (table) => ({
    uniqueAssignment: unique().on(table.modelId, table.rebalancingGroupId),
  }),
);

export const modelMember = pgTable('model_member', {
  id: text('id').primaryKey(),
  modelId: text('modelId')
    .notNull()
    .references(() => model.id, { onDelete: 'cascade' }),
  sleeveId: text('sleeveId')
    .notNull()
    .references(() => sleeve.id, { onDelete: 'cascade' }),
  targetWeight: integer('targetWeight').notNull(), // Store as basis points (10000 = 100%)
  isActive: boolean('isActive').notNull().default(true),
  createdAt: bigint('createdAt', { mode: 'number' }).notNull(),
  updatedAt: bigint('updatedAt', { mode: 'number' }).notNull(),
});

export const rebalancingGroup = pgTable('rebalancing_group', {
  id: text('id').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  isActive: boolean('isActive').notNull().default(true),
  createdAt: bigint('createdAt', { mode: 'number' }).notNull(),
  updatedAt: bigint('updatedAt', { mode: 'number' }).notNull(),
});

export const rebalancingGroupMember = pgTable('rebalancing_group_member', {
  id: text('id').primaryKey(),
  groupId: text('groupId')
    .notNull()
    .references(() => rebalancingGroup.id, { onDelete: 'cascade' }),
  accountId: text('accountId')
    .notNull()
    .references(() => account.id, { onDelete: 'cascade' }),
  isActive: boolean('isActive').notNull().default(true),
  createdAt: bigint('createdAt', { mode: 'number' }).notNull(),
  updatedAt: bigint('updatedAt', { mode: 'number' }).notNull(),
});

// New table for Schwab API credentials
export const schwabCredentials = pgTable('schwab_credentials', {
  id: text('id').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  encryptedAccessToken: text('encryptedAccessToken').notNull(),
  encryptedRefreshToken: text('encryptedRefreshToken').notNull(),
  tokenExpiresAt: timestamp('tokenExpiresAt').notNull(),
  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt').notNull(),
  encryptedSchwabClientId: text('encryptedSchwabClientId').notNull(),
  isActive: boolean('isActive').notNull().default(true),
  createdAt: timestamp('createdAt').notNull(),
  updatedAt: timestamp('updatedAt').notNull(),
});

// New table for sync audit logs
export const syncLog = pgTable('sync_log', {
  id: text('id').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  syncType: text('syncType').notNull(), // "ACCOUNTS" | "HOLDINGS" | "PRICES"
  status: text('status').notNull(), // "SUCCESS" | "ERROR" | "PARTIAL"
  recordsProcessed: integer('recordsProcessed').notNull().default(0),
  errorMessage: text('errorMessage'),
  startedAt: timestamp('startedAt').notNull(),
  completedAt: timestamp('completedAt'),
  createdAt: timestamp('createdAt').notNull(),
});

// Details for price sync logs (per-ticker)
export const syncLogDetail = pgTable('sync_log_detail', {
  id: text('id').primaryKey(),
  logId: text('logId')
    .notNull()
    .references(() => syncLog.id, { onDelete: 'cascade' }),
  // Generic targeting info for any sync entity
  entityType: text('entityType').notNull(), // SECURITY | ACCOUNT | HOLDING | MODEL | ...
  entityId: text('entityId').notNull(),
  operation: text('operation').notNull(), // CREATE | UPDATE | DELETE | UPSERT | NOOP
  // JSON string of field changes: { field: { old: any, new: any } }
  changes: text('changes'),
  success: boolean('success').notNull().default(true),
  message: text('message'),
  createdAt: timestamp('createdAt').notNull(),
});

// Raw import table for Schwab positions (truncate-and-load on each import)
export const schwabHolding = pgTable(
  'schwab_holding',
  {
    id: text('id').primaryKey(),
    accountNumber: text('accountNumber').notNull(),
    symbol: text('symbol').notNull(),
    cusip: text('cusip'),
    shortQuantity: real('shortQuantity'),
    averagePrice: real('averagePrice'),
    currentDayProfitLoss: real('currentDayProfitLoss'),
    currentDayProfitLossPercentage: real('currentDayProfitLossPercentage'),
    longQuantity: real('longQuantity'),
    settledLongQuantity: real('settledLongQuantity'),
    settledShortQuantity: real('settledShortQuantity'),
    agedQuantity: real('agedQuantity'),
    marketValue: real('marketValue'),
    maintenanceRequirement: real('maintenanceRequirement'),
    averageLongPrice: real('averageLongPrice'),
    averageShortPrice: real('averageShortPrice'),
    taxLotAverageLongPrice: real('taxLotAverageLongPrice'),
    taxLotAverageShortPrice: real('taxLotAverageShortPrice'),
    longOpenProfitLoss: real('longOpenProfitLoss'),
    shortOpenProfitLoss: real('shortOpenProfitLoss'),
    previousSessionLongQuantity: real('previousSessionLongQuantity'),
    previousSessionShortQuantity: real('previousSessionShortQuantity'),
    currentDayCost: real('currentDayCost'),
    importedAt: timestamp('importedAt').notNull(),
  },
  (table) => [index('idx_schwab_holding_account_symbol').on(table.accountNumber, table.symbol)],
);

// Raw import table for Schwab accounts (truncate-and-load on each import)
export const schwabAccount = pgTable(
  'schwab_account',
  {
    id: text('id').primaryKey(),
    type: text('type').notNull(), // CASH | MARGIN
    accountNumber: text('accountNumber').notNull(),
    roundTrips: integer('roundTrips'),
    isDayTrader: boolean('isDayTrader'),
    isClosingOnlyRestricted: boolean('isClosingOnlyRestricted'),
    pfcbFlag: boolean('pfcbFlag'),
    cashAvailableForTrading: real('cashAvailableForTrading'),
    cashAvailableForWithdrawal: real('cashAvailableForWithdrawal'),
    cashCall: real('cashCall'),
    longNonMarginableMarketValue: real('longNonMarginableMarketValue'),
    totalCash: real('totalCash'),
    cashDebitCallValue: real('cashDebitCallValue'),
    unsettledCash: real('unsettledCash'),
    importedAt: timestamp('importedAt').notNull(),
    payload: text('payload'),
  },
  (table) => [unique().on(table.accountNumber), index('idx_schwab_account_type').on(table.type)],
);

// Raw import table for Schwab securities/instruments
export const schwabSecurity = pgTable(
  'schwab_security',
  {
    id: text('id').primaryKey(),
    symbol: text('symbol').notNull(),
    cusip: text('cusip'),
    description: text('description'),
    lastPrice: real('lastPrice'),
    assetMainType: text('assetMainType'),
    assetSubType: text('assetSubType'),
    exchange: text('exchange'),
    payload: text('payload'),
    discoveredAt: timestamp('discoveredAt').notNull(),
  },
  (table) => [
    unique().on(table.symbol),
    index('idx_schwab_security_cusip').on(table.cusip),
    index('idx_schwab_security_discoveredAt').on(table.discoveredAt),
  ],
);

// Raw import table for Schwab transactions/activity
export const schwabTransaction = pgTable(
  'schwab_transaction',
  {
    id: text('id').primaryKey(),
    activityId: integer('activityId'),
    time: text('time'),
    description: text('description'),
    accountNumber: text('accountNumber').notNull(),
    type: text('type'),
    status: text('status'),
    subAccount: text('subAccount'),
    tradeDate: text('tradeDate'),
    settlementDate: text('settlementDate'),
    positionId: integer('positionId'),
    orderId: integer('orderId'),
    netAmount: real('netAmount'),
    activityType: text('activityType'),
    importedAt: timestamp('importedAt').notNull(),
    payload: text('payload'),
  },
  (table) => [
    unique().on(table.activityId),
    index('idx_schwab_transaction_accountNumber').on(table.accountNumber),
    index('idx_schwab_transaction_time').on(table.time),
    index('idx_schwab_transaction_type').on(table.type),
  ],
);

// Trading order management
export const tradeOrder = pgTable(
  'trade_order',
  {
    id: text('id').primaryKey(),
    userId: text('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accountId: text('accountId')
      .notNull()
      .references(() => account.id, { onDelete: 'cascade' }),

    // Core inputs (single-leg, long-only)
    symbol: text('symbol').notNull(),
    side: text('side').notNull(), // BUY | SELL
    qty: real('qty').notNull(),
    type: text('type').notNull().default('MARKET'), // MARKET | LIMIT | STOP | STOP_LIMIT
    limit: real('limit'),
    stop: real('stop'),
    tif: text('tif').notNull().default('DAY'), // DAY | GTC
    session: text('session').notNull().default('NORMAL'), // NORMAL | AM | PM | ALL

    // Broker/UI flags
    taxLotMethod: text('taxLotMethod'),
    specialInstruction: text('specialInstruction'),
    quantityType: text('quantityType'), // ALL_SHARES | SHARES | DOLLARS
    amountIndicator: text('amountIndicator'), // SHARES | DOLLARS
    orderStrategyType: text('orderStrategyType'),
    complexOrderStrategyType: text('complexOrderStrategyType'),
    requestedDestination: text('requestedDestination'),
    destinationLinkName: text('destinationLinkName'),

    // Preview cache
    previewJson: text('previewJson'), // JSON string
    previewOrderValue: real('previewOrderValue'),
    previewProjectedCommission: real('previewProjectedCommission'),
    previewWarnCount: integer('previewWarnCount').notNull().default(0),
    previewErrorCount: integer('previewErrorCount').notNull().default(0),
    previewFirstMessage: text('previewFirstMessage'),

    // Live mapping / status
    schwabOrderId: text('schwabOrderId'),
    status: text('status').notNull().default('DRAFT'),
    statusDescription: text('statusDescription'),
    cancelable: boolean('cancelable').notNull().default(false),
    editable: boolean('editable').notNull().default(false),
    quantity: real('quantity'),
    filledQuantity: real('filledQuantity').notNull().default(0),
    remainingQuantity: real('remainingQuantity').notNull().default(0),

    // Times
    enteredAt: timestamp('enteredAt'),
    closeAt: timestamp('closeAt'),
    cancelAt: timestamp('cancelAt'),
    placedAt: timestamp('placedAt'),
    closedAt: timestamp('closedAt'),

    // Instrument refs
    cusip: text('cusip'),
    instrumentId: text('instrumentId'),

    // Replace chain
    replacesSchwabOrderId: text('replacesSchwabOrderId'),
    replacedBySchwabOrderId: text('replacedBySchwabOrderId'),

    // Economics
    avgFillPrice: real('avgFillPrice'),
    lastFillPrice: real('lastFillPrice'),
    filledNotional: real('filledNotional'),
    realizedCommission: real('realizedCommission'),
    realizedFeesTotal: real('realizedFeesTotal'),

    // Raw snapshot
    lastSnapshot: text('lastSnapshot'), // JSON string

    // Ops
    idempotencyKey: text('idempotencyKey'),
    batchLabel: text('batchLabel'),

    createdAt: timestamp('createdAt').notNull(),
    updatedAt: timestamp('updatedAt').notNull(),
  },
  (table) => [
    index('idx_trade_order_user_account_status').on(table.userId, table.accountId, table.status),
    index('idx_trade_order_account_schwab').on(table.accountId, table.schwabOrderId),
    unique().on(table.accountId, table.idempotencyKey),
  ],
);

export const orderExecution = pgTable(
  'order_execution',
  {
    id: text('id').primaryKey(),
    orderId: text('orderId')
      .notNull()
      .references(() => tradeOrder.id, { onDelete: 'cascade' }),
    legId: integer('legId'),
    time: timestamp('time').notNull(),
    price: real('price').notNull(),
    qty: real('qty').notNull(),
    instrumentId: text('instrumentId'),
    fee: real('fee'),
    raw: text('raw'), // JSON string
    settlementDate: timestamp('settlementDate'),
    createdAt: timestamp('createdAt').notNull(),
  },
  (table) => [index('idx_order_execution_order_time').on(table.orderId, table.time)],
);

// Financial Planning Tables
export const financialPlan = pgTable('financial_plan', {
  id: text('id').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  createdAt: timestamp('createdAt').notNull(),
  updatedAt: timestamp('updatedAt').notNull(),
});

export const financialPlanInput = pgTable('financial_plan_input', {
  id: text('id').primaryKey(),
  planId: text('planId')
    .notNull()
    .references(() => financialPlan.id, { onDelete: 'cascade' }),
  filingStatus: text('filingStatus').notNull().default('single'), // single, married_filing_jointly, head_of_household
  primaryUserAge: integer('primaryUserAge').notNull(),
  spouseAge: integer('spouseAge'),
  simulationPeriod: integer('simulationPeriod').notNull().default(50),
  returnRate: real('returnRate').notNull().default(10.0),
  inflationRate: real('inflationRate').notNull().default(2.0),
  dividendRate: real('dividendRate').notNull().default(2.0),
  taxableBalance: real('taxableBalance').notNull().default(100000),
  taxableCostBasis: real('taxableCostBasis').notNull().default(100000),
  rothBalance: real('rothBalance').notNull().default(100000),
  deferredBalance: real('deferredBalance').notNull().default(100000),
  updatedAt: timestamp('updatedAt').notNull(),
});

export const financialPlanGoal = pgTable('financial_plan_goal', {
  id: text('id').primaryKey(),
  planId: text('planId')
    .notNull()
    .references(() => financialPlan.id, { onDelete: 'cascade' }),
  purpose: text('purpose'),
  type: text('type').notNull(), // contribution, fixed_withdrawal
  amount: real('amount').notNull(),
  inflationAdjusted: boolean('inflationAdjusted').notNull().default(true),
  startTiming: text('startTiming').notNull().default('immediately'),
  durationYears: integer('durationYears').notNull(),
  frequency: text('frequency').notNull().default('annually'), // annually, monthly
  repeatPattern: text('repeatPattern').notNull().default('none'),
  occurrences: integer('occurrences').notNull().default(1),
  createdAt: timestamp('createdAt').notNull(),
});

export const taxBracket = pgTable('tax_bracket', {
  id: text('id').primaryKey(),
  bracketType: text('bracketType').notNull(), // federal_income, federal_capital_gains, california_income
  filingStatus: text('filingStatus').notNull(), // single, married_filing_jointly, head_of_household
  minIncome: real('minIncome').notNull(),
  maxIncome: real('maxIncome'), // null for top bracket
  rate: real('rate').notNull(),
  year: integer('year').notNull().default(2025),
  createdAt: timestamp('createdAt').notNull(),
});

export const financialPlanResult = pgTable('financial_plan_result', {
  id: text('id').primaryKey(),
  planId: text('planId')
    .notNull()
    .references(() => financialPlan.id, { onDelete: 'cascade' }),
  year: integer('year').notNull(),
  startingTaxable: real('startingTaxable').notNull(),
  startingRoth: real('startingRoth').notNull(),
  startingDeferred: real('startingDeferred').notNull(),
  growthTaxable: real('growthTaxable').notNull(),
  growthRoth: real('growthRoth').notNull(),
  growthDeferred: real('growthDeferred').notNull(),
  contributionsTaxable: real('contributionsTaxable').notNull(),
  contributionsRoth: real('contributionsRoth').notNull(),
  contributionsDeferred: real('contributionsDeferred').notNull(),
  withdrawalsTaxable: real('withdrawalsTaxable').notNull(),
  withdrawalsRoth: real('withdrawalsRoth').notNull(),
  withdrawalsDeferred: real('withdrawalsDeferred').notNull(),
  federalIncomeTax: real('federalIncomeTax').notNull(),
  californiaIncomeTax: real('californiaIncomeTax').notNull(),
  federalCapitalGainsTax: real('federalCapitalGainsTax').notNull(),
  californiaCapitalGainsTax: real('californiaCapitalGainsTax').notNull(),
  federalDividendTax: real('federalDividendTax').notNull(),
  californiaDividendTax: real('californiaDividendTax').notNull(),
  totalTaxes: real('totalTaxes').notNull(),
  endingTaxable: real('endingTaxable').notNull(),
  endingRoth: real('endingRoth').notNull(),
  endingDeferred: real('endingDeferred').notNull(),
  totalPortfolioNominal: real('totalPortfolioNominal').notNull(),
  totalPortfolioReal: real('totalPortfolioReal').notNull(),
  calculatedAt: timestamp('calculatedAt').notNull(),
});
