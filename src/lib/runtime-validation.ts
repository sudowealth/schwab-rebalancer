import { z } from 'zod';

/**
 * Runtime Type Validation Utilities
 *
 * Provides comprehensive runtime type validation for critical server functions.
 * Ensures data integrity at runtime while maintaining type safety.
 */

// Branded types for runtime validation
const UUIDSchema = z.string().uuid('Invalid UUID format');
const NonEmptyStringSchema = z.string().min(1, 'Cannot be empty');

// Critical data schemas for server functions
const GroupIdSchema = z.object({
  groupId: UUIDSchema,
});

const AccountIdsSchema = z.object({
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

export const AssignModelSchema = z.object({
  modelId: UUIDSchema,
  groupId: UUIDSchema,
});

// Validation helper functions
function validateCriticalData<T>(data: unknown, schema: z.ZodSchema<T>, context: string): T {
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
