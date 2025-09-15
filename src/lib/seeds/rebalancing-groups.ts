import { eq } from 'drizzle-orm';
import type { drizzle } from 'drizzle-orm/libsql';
import * as schema from '../../db/schema';

// Demo rebalancing groups data
const REBALANCING_GROUPS_DATA = [
  {
    id: 'rebalancing-group-1',
    name: 'Retirement Portfolio',
    memberAccountIds: ['account-2', 'account-3'], // Roth IRA + 401k
  },
  {
    id: 'rebalancing-group-2',
    name: 'Taxable Growth',
    memberAccountIds: ['account-1'], // Taxable account
  },
];

export async function seedRebalancingGroups(db: ReturnType<typeof drizzle>, userId?: string) {
  console.log('👥 Seeding rebalancing groups...');

  const now = Date.now();

  // Use provided userId or get the demo user ID
  let targetUserId = userId;

  if (!targetUserId) {
    const existingUser = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.email, 'd@d.com'))
      .limit(1);
    targetUserId = existingUser[0]?.id || 'demo-user';
  }

  console.log(`✅ Using user ID for rebalancing groups: ${targetUserId}`);

  // Clear existing rebalancing groups
  await db.delete(schema.rebalancingGroupMember);
  await db.delete(schema.modelGroupAssignment);
  await db.delete(schema.rebalancingGroup);

  // Insert rebalancing groups
  for (const group of REBALANCING_GROUPS_DATA) {
    try {
      // Create the group
      await db.insert(schema.rebalancingGroup).values({
        id: group.id,
        userId: targetUserId,
        name: group.name,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      // Create group members
      for (const accountId of group.memberAccountIds) {
        await db.insert(schema.rebalancingGroupMember).values({
          id: `${group.id}_member_${accountId}`,
          groupId: group.id,
          accountId: accountId,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        });
      }

      console.log(`✅ Created rebalancing group: ${group.name}`);
    } catch (error) {
      console.error(`❌ Failed to create rebalancing group ${group.name}:`, error);
    }
  }

  // Assign the S&P 500 model to both rebalancing groups
  const modelId = 'model_sp500_index_replication';

  for (const group of REBALANCING_GROUPS_DATA) {
    try {
      await db.insert(schema.modelGroupAssignment).values({
        id: `${modelId}_${group.id}`,
        modelId: modelId,
        rebalancingGroupId: group.id,
        createdAt: now,
        updatedAt: now,
      });
      console.log(`✅ Assigned model ${modelId} to group: ${group.name}`);
    } catch (error) {
      console.error(`❌ Failed to assign model to group ${group.name}:`, error);
    }
  }

  console.log(
    `✅ Seeded ${REBALANCING_GROUPS_DATA.length} rebalancing groups with model assignments`,
  );
}
