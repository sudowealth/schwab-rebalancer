import { z } from 'zod';

/**
 * Runtime Type Validation Utilities
 *
 * Provides comprehensive runtime type validation for critical server functions.
 * Ensures data integrity at runtime while maintaining type safety.
 */

// Branded types for runtime validation
export const UUIDSchema = z.string().uuid('Invalid UUID format');
export const EmailSchema = z.string().email('Invalid email format');
export const PositiveNumberSchema = z.number().positive('Must be positive');
export const NonEmptyStringSchema = z.string().min(1, 'Cannot be empty');

// Critical data schemas for server functions
export const UserIdSchema = z.object({
  userId: UUIDSchema,
});

export const GroupIdSchema = z.object({
  groupId: UUIDSchema,
});

export const AccountIdsSchema = z.object({
  accountIds: z.array(UUIDSchema).min(1, 'At least one account ID required'),
});

export const CreateRebalancingGroupSchema = z.object({
  name: NonEmptyStringSchema.max(100, 'Group name too long'),
  members: z
    .array(
      z.object({
        accountId: UUIDSchema,
        balance: z.number().min(0, 'Balance cannot be negative').optional(),
      }),
    )
    .min(1, 'At least one member required'),
  updateExisting: z.boolean().optional().default(false),
});

export const UpdateRebalancingGroupSchema = z.object({
  groupId: UUIDSchema,
  name: NonEmptyStringSchema.max(100, 'Group name too long'),
  members: z
    .array(
      z.object({
        accountId: UUIDSchema,
        balance: z.number().min(0, 'Balance cannot be negative').optional(),
      }),
    )
    .min(1, 'At least one member required'),
});

export const ModelIdSchema = z.object({
  modelId: UUIDSchema,
});

export const AssignModelSchema = z.object({
  modelId: UUIDSchema,
  groupId: UUIDSchema,
});

export const SecuritySchema = z.object({
  ticker: NonEmptyStringSchema.max(10, 'Ticker too long'),
  name: NonEmptyStringSchema.max(100, 'Security name too long'),
  assetClass: z.enum(['equity', 'fixed_income', 'cash', 'other']),
  sector: NonEmptyStringSchema.optional(),
});

export const SleeveMemberSchema = z.object({
  sleeveId: UUIDSchema,
  securityId: UUIDSchema,
  targetWeight: PositiveNumberSchema.max(1, 'Weight cannot exceed 100%'),
});

export const ModelSchema = z.object({
  name: NonEmptyStringSchema.max(100, 'Model name too long'),
  description: z.string().max(500, 'Description too long').optional(),
  members: z.array(SleeveMemberSchema).min(1, 'At least one member required'),
});

// Trade-related schemas
export const TradeSchema = z.object({
  securityId: UUIDSchema,
  quantity: z.number().int('Quantity must be integer'),
  price: PositiveNumberSchema,
  accountId: UUIDSchema,
  side: z.enum(['buy', 'sell']),
});

// Validation helper functions
export function validateCriticalData<T>(data: unknown, schema: z.ZodSchema<T>, context: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errorMessage = `Validation failed for ${context}: ${result.error.issues
      .map((err) => `${err.path.join('.')}: ${err.message}`)
      .join(', ')}`;
    throw new Error(errorMessage);
  }
  return result.data;
}

// Specific validation functions for common operations
export function validateUserId(data: unknown): { userId: string } {
  return validateCriticalData(data, UserIdSchema, 'user authentication');
}

export function validateGroupId(data: unknown): { groupId: string } {
  return validateCriticalData(data, GroupIdSchema, 'group operations');
}

export function validateAccountIds(data: unknown): { accountIds: string[] } {
  return validateCriticalData(data, AccountIdsSchema, 'account holdings');
}

export function validateCreateGroup(data: unknown): z.infer<typeof CreateRebalancingGroupSchema> {
  return validateCriticalData(data, CreateRebalancingGroupSchema, 'create rebalancing group');
}

export function validateUpdateGroup(data: unknown): z.infer<typeof UpdateRebalancingGroupSchema> {
  return validateCriticalData(data, UpdateRebalancingGroupSchema, 'update rebalancing group');
}

export function validateModelAssignment(data: unknown): z.infer<typeof AssignModelSchema> {
  return validateCriticalData(data, AssignModelSchema, 'model assignment');
}

export function validateTrade(data: unknown): z.infer<typeof TradeSchema> {
  return validateCriticalData(data, TradeSchema, 'trade execution');
}

// Type guards for runtime type checking
export function isValidUUID(value: unknown): value is string {
  return UUIDSchema.safeParse(value).success;
}

export function isValidEmail(value: unknown): value is string {
  return EmailSchema.safeParse(value).success;
}

export function isPositiveNumber(value: unknown): value is number {
  return PositiveNumberSchema.safeParse(value).success;
}

// Schema exports for use in server functions
export const Schemas = {
  UserId: UserIdSchema,
  GroupId: GroupIdSchema,
  AccountIds: AccountIdsSchema,
  CreateRebalancingGroup: CreateRebalancingGroupSchema,
  UpdateRebalancingGroup: UpdateRebalancingGroupSchema,
  AssignModel: AssignModelSchema,
  Security: SecuritySchema,
  SleeveMember: SleeveMemberSchema,
  Model: ModelSchema,
  Trade: TradeSchema,
} as const;
