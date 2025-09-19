import { z } from 'zod';
import type { SyncYahooFundamentalsResult } from './yahoo-server-fns';

// Core data schemas
export const PositionSchema = z.object({
  id: z.string(),
  sleeveId: z.string(),
  sleeveName: z.string(),
  ticker: z.string().min(1).max(5),
  qty: z.number().positive('Quantity must be positive'),
  costBasis: z.number().positive('Cost basis must be positive'),
  currentPrice: z.number().positive('Price must be positive'),
  marketValue: z.string().regex(/^\$[\d,]+\.\d{2}$/, 'Invalid market value format'),
  dollarGainLoss: z.string().regex(/^-?\$[\d,]+\.\d{2}$/, 'Invalid gain/loss format'),
  percentGainLoss: z.string().regex(/^-?\d+\.\d{2}%$/, 'Invalid percentage format'),
  daysHeld: z.number().int().min(0),
  openedAt: z.date(),
  accountId: z.string(),
  accountName: z.string(),
  accountType: z.string(),
  accountNumber: z.string().optional(),
});

export const TransactionSchema = z.object({
  id: z.string(),
  sleeveId: z.string(),
  sleeveName: z.string(),
  ticker: z.string().min(1).max(5),
  type: z.enum(['BUY', 'SELL']),
  qty: z.number().positive('Quantity must be positive'),
  price: z.number().positive('Price must be positive'),
  executedAt: z.date(),
  realizedGainLoss: z.number(),
  isLongTerm: z.boolean().optional(),
  accountId: z.string(),
  accountName: z.string(),
  accountType: z.string(),
  accountNumber: z.string().optional(),
});

export const SP500StockSchema = z.object({
  ticker: z.string().min(1).max(10), // Allow for BRK.B type tickers
  name: z.string().min(1, 'Company name required'),
  price: z.number().positive('Price must be positive'),
  marketCap: z.string().regex(/^[\d.]+[BMT]?$/, 'Invalid market cap format'),
  peRatio: z.number().optional(),
  industry: z.string().min(1, 'Industry required'),
  sector: z.string().min(1, 'Sector required'),
});

export const SleeveMemberSchema = z.object({
  id: z.string(),
  ticker: z.string().min(1).max(10),
  rank: z.number().int().positive(),
  isActive: z.boolean(),
  isLegacy: z.boolean(),
});

export const SleevePositionSchema = z.object({
  id: z.string(),
  sleeveId: z.string(),
  ticker: z.string().min(1).max(10),
  qty: z.number().positive('Quantity must be positive'),
  costBasis: z.number().positive('Cost basis must be positive'),
  currentPrice: z.number().positive('Price must be positive'),
  marketValue: z.number(),
  dollarGainLoss: z.number(),
  percentGainLoss: z.number(),
  openedAt: z.date(),
});

export const SleeveSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Sleeve name required'),
  members: z.array(SleeveMemberSchema),
  position: SleevePositionSchema.nullable(),
  restrictedInfo: z
    .object({
      soldAt: z.string(),
      blockedUntil: z.string(),
    })
    .optional(),
});

export const RestrictedSecuritySchema = z.object({
  ticker: z.string().min(1).max(10),
  sleeveId: z.string(),
  sleeveName: z.string(),
  lossAmount: z.string().regex(/^\$[\d,]+(\.\d{2})?$/, 'Invalid loss amount format'),
  soldAt: z.date(),
  blockedUntil: z.date(),
  daysToUnblock: z.number().int().min(0),
});

export const TradeSchema = z.object({
  id: z.string(),
  type: z.enum(['BUY', 'SELL']),
  ticker: z.string().min(1).max(10),
  sleeveId: z.string(),
  sleeveName: z.string(),
  qty: z.number().positive('Quantity must be positive'),
  currentPrice: z.number().positive('Price must be positive'),
  // Allow negative values for sells and positive for buys. Sign semantics are handled by business logic.
  estimatedValue: z.number(),
  reason: z.string().min(1, 'Reason required'),
  realizedGainLoss: z.number().optional(),
  replacementTicker: z.string().optional(),
  canExecute: z.boolean(),
  blockingReason: z.string().optional(),
  accountId: z.string(),
  accountName: z.string(),
  accountType: z.string(),
  accountNumber: z.string().optional(),
});

export const ModelMemberSchema = z.object({
  id: z.string(),
  sleeveId: z.string(),
  sleeveName: z.string().optional(),
  targetWeight: z.number().min(0).max(10000, 'Target weight cannot exceed 100%'),
  isActive: z.boolean(),
});

export const ModelSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Model name required'),
  description: z.string().optional(),
  isActive: z.boolean(),
  members: z.array(ModelMemberSchema),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export const CreateModelSchema = z.object({
  name: z.string().min(1, 'Model name required'),
  description: z.string().optional(),
  members: z.array(
    z.object({
      sleeveId: z.string(),
      targetWeight: z.number().min(0).max(10000),
    }),
  ),
  updateExisting: z.boolean().optional(),
});

export const RebalancingGroupMemberSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  accountName: z.string().optional(),
  accountType: z.string().optional(),
  balance: z.number().optional(),
  isActive: z.boolean(),
});

export const RebalancingGroupSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Group name required'),
  isActive: z.boolean(),
  members: z.array(RebalancingGroupMemberSchema),
  assignedModel: ModelSchema.optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export const CreateRebalancingGroupSchema = z.object({
  name: z.string().min(1, 'Group name required'),
  members: z.array(
    z.object({
      accountId: z.string(),
    }),
  ),
  updateExisting: z.boolean().optional(),
});

export const PortfolioMetricsSchema = z.object({
  totalMarketValue: z.number().min(0),
  totalCostBasis: z.number().min(0),
  unrealizedGain: z.number(),
  unrealizedGainPercent: z.number(),
  realizedGain: z.number(),
  realizedGainPercent: z.number(),
  totalGain: z.number(),
  totalGainPercent: z.number(),
  ytdHarvestedLosses: z.number().min(0),
  harvestablelosses: z.number().min(0),
  harvestingTarget: z.object({
    year1Target: z.number().min(0).max(1),
    steadyStateTarget: z.number().min(0).max(1),
    currentProgress: z.number().min(0),
  }),
});

// Array schemas
export const PositionsSchema = z.array(PositionSchema);
export const TransactionsSchema = z.array(TransactionSchema);
export const SP500DataSchema = z.array(SP500StockSchema);
export const SleevesSchema = z.array(SleeveSchema);
export const RestrictedSecuritiesSchema = z.array(RestrictedSecuritySchema);
export const TradesSchema = z.array(TradeSchema);
export const ModelsSchema = z.array(ModelSchema);
export const RebalancingGroupsSchema = z.array(RebalancingGroupSchema);

// Order/Blotter data types
export const OrderSideSchema = z.enum(['BUY', 'SELL']);
export const OrderTypeSchema = z.enum(['MARKET', 'LIMIT', 'STOP', 'STOP_LIMIT']);
export const TifSchema = z.enum(['DAY', 'GTC']);
export const SessionSchema = z.enum(['NORMAL', 'AM', 'PM', 'ALL']);
export const OrderStatusSchema = z.enum([
  'DRAFT',
  'PREVIEW_OK',
  'PREVIEW_WARN',
  'PREVIEW_ERROR',
  'ACCEPTED',
  'WORKING',
  'PARTIALLY_FILLED',
  'REPLACED',
  'FILLED',
  'CANCELED',
  'REJECTED',
  'EXPIRED',
]);

export const OrderSchema = z.object({
  id: z.string(),
  userId: z.string(),
  accountId: z.string(),
  symbol: z.string(),
  side: OrderSideSchema,
  qty: z.number(),
  type: OrderTypeSchema,
  limit: z.number().nullable().optional(),
  stop: z.number().nullable().optional(),
  tif: TifSchema,
  session: SessionSchema,
  taxLotMethod: z.string().nullable().optional(),
  specialInstruction: z.string().nullable().optional(),
  quantityType: z.string().nullable().optional(),
  amountIndicator: z.string().nullable().optional(),
  orderStrategyType: z.string().nullable().optional(),
  complexOrderStrategyType: z.string().nullable().optional(),
  requestedDestination: z.string().nullable().optional(),
  destinationLinkName: z.string().nullable().optional(),
  previewJson: z.string().nullable().optional(),
  previewOrderValue: z.number().nullable().optional(),
  previewProjectedCommission: z.number().nullable().optional(),
  previewWarnCount: z.number(),
  previewErrorCount: z.number(),
  previewFirstMessage: z.string().nullable().optional(),
  schwabOrderId: z.string().nullable().optional(),
  status: OrderStatusSchema,
  statusDescription: z.string().nullable().optional(),
  cancelable: z.boolean(),
  editable: z.boolean(),
  quantity: z.number().nullable().optional(),
  filledQuantity: z.number(),
  remainingQuantity: z.number(),
  enteredAt: z.date().nullable().optional(),
  closeAt: z.date().nullable().optional(),
  cancelAt: z.date().nullable().optional(),
  placedAt: z.date().nullable().optional(),
  closedAt: z.date().nullable().optional(),
  cusip: z.string().nullable().optional(),
  instrumentId: z.string().nullable().optional(),
  replacesSchwabOrderId: z.string().nullable().optional(),
  replacedBySchwabOrderId: z.string().nullable().optional(),
  avgFillPrice: z.number().nullable().optional(),
  lastFillPrice: z.number().nullable().optional(),
  filledNotional: z.number().nullable().optional(),
  realizedCommission: z.number().nullable().optional(),
  realizedFeesTotal: z.number().nullable().optional(),
  lastSnapshot: z.string().nullable().optional(),
  idempotencyKey: z.string().nullable().optional(),
  batchLabel: z.string().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const OrderExecutionSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  legId: z.number().nullable().optional(),
  time: z.date(),
  price: z.number(),
  qty: z.number(),
  instrumentId: z.string().nullable().optional(),
  fee: z.number().nullable().optional(),
  raw: z.string().nullable().optional(),
  settlementDate: z.date().nullable().optional(),
  createdAt: z.date(),
});

export const OrdersSchema = z.array(OrderSchema);
export const OrderExecutionsSchema = z.array(OrderExecutionSchema);

// Helper function to validate data with proper error handling
export function validateData<T>(schema: z.ZodSchema<T>, data: unknown, context: string): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(`Schema validation failed for ${context}:`, error.issues);
      throw new Error(`Invalid ${context} data: ${error.issues.map((e) => e.message).join(', ')}`);
    }
    throw error;
  }
}

// Type exports
export type Position = z.infer<typeof PositionSchema>;
export type Transaction = z.infer<typeof TransactionSchema>;
export type SP500Stock = z.infer<typeof SP500StockSchema>;
export type SleeveMember = z.infer<typeof SleeveMemberSchema>;
export type SleevePosition = z.infer<typeof SleevePositionSchema>;
export type Sleeve = z.infer<typeof SleeveSchema>;
export type RestrictedSecurity = z.infer<typeof RestrictedSecuritySchema>;
export type Trade = z.infer<typeof TradeSchema>;
export type PortfolioMetrics = z.infer<typeof PortfolioMetricsSchema>;
export type ModelMember = z.infer<typeof ModelMemberSchema>;
export type Model = z.infer<typeof ModelSchema>;
export type CreateModel = z.infer<typeof CreateModelSchema>;
export type RebalancingGroupMember = z.infer<typeof RebalancingGroupMemberSchema>;
export type RebalancingGroup = z.infer<typeof RebalancingGroupSchema>;
export type CreateRebalancingGroup = z.infer<typeof CreateRebalancingGroupSchema>;
export type Order = z.infer<typeof OrderSchema>;
export type OrderExecution = z.infer<typeof OrderExecutionSchema>;

// Yahoo sync result type
export type YahooSyncResult = SyncYahooFundamentalsResult;
