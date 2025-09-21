import { createServerFn } from '@tanstack/react-start';
import { desc, eq, sql } from 'drizzle-orm';
import * as schema from '~/db/schema';
import { requireAdmin } from '~/features/auth/auth-utils';
import { dbProxy } from '~/lib/db-config';

// Get all users (admin only)
export const getAllUsersServerFn = createServerFn({ method: 'GET' }).handler(async () => {
  await requireAdmin();

  const users = await dbProxy
    .select({
      id: schema.user.id,
      email: schema.user.email,
      name: schema.user.name,
      role: schema.user.role,
      emailVerified: schema.user.emailVerified,
      createdAt: schema.user.createdAt,
      updatedAt: schema.user.updatedAt,
    })
    .from(schema.user)
    .orderBy(schema.user.createdAt);

  return users;
});

// Update user role (admin only)
export const updateUserRoleServerFn = createServerFn({ method: 'POST' })
  .validator((data: { userId: string; role: 'user' | 'admin' }) => data)
  .handler(async ({ data }) => {
    const { userId, role } = data;

    await requireAdmin();

    // Verify user exists
    const existingUser = await dbProxy
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(eq(schema.user.id, userId))
      .limit(1);

    if (existingUser.length === 0) {
      throw new Error('User not found');
    }

    // Update role
    await dbProxy
      .update(schema.user)
      .set({
        role,
        updatedAt: new Date(),
      })
      .where(eq(schema.user.id, userId));

    return { success: true, message: `User role updated to ${role}` };
  });

// Get system statistics (admin only)
export const getSystemStatsServerFn = createServerFn({ method: 'GET' }).handler(async () => {
  await requireAdmin();

  // Get various counts
  const userCount = await dbProxy.select({ count: sql<number>`count(*)` }).from(schema.user);

  const accountCount = await dbProxy.select({ count: sql<number>`count(*)` }).from(schema.account);

  const sleeveCount = await dbProxy.select({ count: sql<number>`count(*)` }).from(schema.sleeve);

  const modelCount = await dbProxy.select({ count: sql<number>`count(*)` }).from(schema.model);

  const holdingCount = await dbProxy.select({ count: sql<number>`count(*)` }).from(schema.holding);

  const transactionCount = await dbProxy
    .select({ count: sql<number>`count(*)` })
    .from(schema.transaction);

  const rebalancingGroupCount = await dbProxy
    .select({ count: sql<number>`count(*)` })
    .from(schema.rebalancingGroup);

  const orderCount = await dbProxy.select({ count: sql<number>`count(*)` }).from(schema.tradeOrder);

  return {
    users: Number(userCount[0]?.count ?? 0),
    accounts: Number(accountCount[0]?.count ?? 0),
    sleeves: Number(sleeveCount[0]?.count ?? 0),
    models: Number(modelCount[0]?.count ?? 0),
    holdings: Number(holdingCount[0]?.count ?? 0),
    transactions: Number(transactionCount[0]?.count ?? 0),
    rebalancingGroups: Number(rebalancingGroupCount[0]?.count ?? 0),
    orders: Number(orderCount[0]?.count ?? 0),
  };
});

// Get audit logs (admin only)
export const getAuditLogsServerFn = createServerFn({ method: 'GET' })
  .validator((data?: { limit?: number; offset?: number; userId?: string }) => data || {})
  .handler(async ({ data = {} }) => {
    await requireAdmin();
    const { limit = 100, offset = 0, userId } = data;

    const baseQuery = dbProxy
      .select({
        id: schema.auditLog.id,
        userId: schema.auditLog.userId,
        userEmail: schema.user.email,
        action: schema.auditLog.action,
        entityType: schema.auditLog.entityType,
        entityId: schema.auditLog.entityId,
        metadata: schema.auditLog.metadata,
        createdAt: schema.auditLog.createdAt,
        ipAddress: schema.auditLog.ipAddress,
        userAgent: schema.auditLog.userAgent,
      })
      .from(schema.auditLog)
      .leftJoin(schema.user, eq(schema.auditLog.userId, schema.user.id))
      .orderBy(desc(schema.auditLog.createdAt))
      .limit(limit)
      .offset(offset);

    const logs = userId
      ? await baseQuery.where(eq(schema.auditLog.userId, userId))
      : await baseQuery;
    return logs;
  });

// Get all data for a specific user (admin only)
export const getUserDataServerFn = createServerFn({ method: 'GET' })
  .validator((data: { userId: string }) => data)
  .handler(async ({ data }) => {
    const { userId } = data;

    await requireAdmin();

    // Get user info
    const user = await dbProxy
      .select()
      .from(schema.user)
      .where(eq(schema.user.id, userId))
      .limit(1);

    if (user.length === 0) {
      throw new Error('User not found');
    }

    // Get all user data
    const accounts = await dbProxy
      .select()
      .from(schema.account)
      .where(eq(schema.account.userId, userId));

    const sleeves = await dbProxy
      .select()
      .from(schema.sleeve)
      .where(eq(schema.sleeve.userId, userId));

    const models = await dbProxy.select().from(schema.model).where(eq(schema.model.userId, userId));

    const rebalancingGroups = await dbProxy
      .select()
      .from(schema.rebalancingGroup)
      .where(eq(schema.rebalancingGroup.userId, userId));

    return {
      user: user[0],
      accounts,
      sleeves,
      models,
      rebalancingGroups,
    };
  });
