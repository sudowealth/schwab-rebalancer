import { and, eq, inArray } from 'drizzle-orm';
import * as schema from '~/db/schema';
import { getDb } from '~/lib/db-config';

// Global Equity Model data structure
const GLOBAL_EQUITY_MODEL_DATA = [
  {
    ticker: 'VXUS',
    weight: 20,
    sleeve: 'International Equity',
    alternatives: [
      {
        ticker: 'IXUS',
        name: 'iShares Core MSCI Total International Stock ETF',
        expenseRatio: 0.07,
      },
      { ticker: 'VEU', name: 'Vanguard FTSE All-World ex-US ETF', expenseRatio: 0.07 },
    ],
  },
  {
    ticker: 'SPYG',
    weight: 10,
    sleeve: 'US Large Growth',
    alternatives: [
      { ticker: 'SCHG', name: 'Schwab U.S. Large-Cap Growth ETF', expenseRatio: 0.04 },
      { ticker: 'VUG', name: 'Vanguard Growth ETF', expenseRatio: 0.04 },
    ],
  },
  {
    ticker: 'VBR',
    weight: 20,
    sleeve: 'US Small Value',
    alternatives: [
      { ticker: 'ISCV', name: 'iShares Structured Small-Cap Value ETF', expenseRatio: 0.06 },
      { ticker: 'VIOV', name: 'Vanguard S&P Small-Cap 600 Value ETF', expenseRatio: 0.1 },
    ],
  },
  {
    ticker: 'VWO',
    weight: 10,
    sleeve: 'Emerging Markets',
    alternatives: [
      { ticker: 'SCHE', name: 'Schwab Emerging Markets Equity ETF', expenseRatio: 0.11 },
      { ticker: 'IEMG', name: 'iShares Core MSCI Emerging Markets ETF', expenseRatio: 0.11 },
    ],
  },
  {
    ticker: 'VTI',
    weight: 40,
    sleeve: 'US Total Market',
    alternatives: [
      { ticker: 'ITOT', name: 'iShares Core S&P U.S. Total Market ETF', expenseRatio: 0.03 },
      { ticker: 'SCHB', name: 'Schwab U.S. Broad Market ETF', expenseRatio: 0.03 },
    ],
  },
];

// Combined function to seed Global Equity Model securities, sleeves, and model
async function _seedGlobalEquityModel(userId?: string) {
  console.log('🚀 Starting complete Global Equity Model seeding process...');

  // Seed Global Equity securities first (needed for sleeves)
  await seedGlobalEquitySecurities();

  // Seed sleeves (they're needed by models)
  await seedGlobalEquitySleeves(userId);

  // Then seed the model (which depends on sleeves)
  await seedGlobalEquityModelData(userId);

  console.log('🎉 Complete Global Equity Model seeding completed successfully!');
}

// Seed Global Equity securities and index data
async function seedGlobalEquitySecurities() {
  console.log('📊 Seeding Global Equity securities and index...');

  const now = new Date();

  // Collect all securities (primary and alternatives)
  const allSecurities = new Set<string>();
  const securityData = new Map<
    string,
    { ticker: string; name: string; price: number; assetType: string }
  >();

  for (const item of GLOBAL_EQUITY_MODEL_DATA) {
    // Add primary security
    allSecurities.add(item.ticker);
    securityData.set(item.ticker, {
      ticker: item.ticker,
      name: `${item.ticker} ETF`,
      price: 1, // Placeholder price
      assetType: 'ETF',
    });

    // Add alternatives
    for (const alt of item.alternatives) {
      if (!allSecurities.has(alt.ticker)) {
        allSecurities.add(alt.ticker);
        securityData.set(alt.ticker, {
          ticker: alt.ticker,
          name: alt.name,
          price: 1, // Placeholder price
          assetType: 'ETF',
        });
      }
    }
  }

  // Insert Global Equity securities
  const securities = Array.from(securityData.values());
  for (const security of securities) {
    await getDb().insert(schema.security).values({
      ticker: security.ticker,
      name: security.name,
      price: security.price,
      assetType: security.assetType,
      createdAt: now,
      updatedAt: now,
    });
  }

  console.log(`✅ Seeded ${securities.length} Global Equity securities`);

  // Seed Global Equity index and members
  await getDb().insert(schema.indexTable).values({
    id: 'global-equity',
    name: 'Global Equity Model',
    createdAt: now,
    updatedAt: now,
  });

  // Insert all securities as index members
  for (const security of securities) {
    await getDb()
      .insert(schema.indexMember)
      .values({
        id: `global-equity-${security.ticker}`,
        indexId: 'global-equity',
        securityId: security.ticker,
        createdAt: now,
        updatedAt: now,
      });
  }

  console.log(`✅ Seeded Global Equity index with ${securities.length} members`);
}

export async function seedGlobalEquitySleeves(userId?: string) {
  console.log('📂 Seeding Global Equity sleeves...');

  const now = new Date();
  const targetUserId = userId || 'demo-user';
  console.log(`✅ Using user ID for sleeves: ${targetUserId}`);

  // Group securities by sleeve
  const sleeveGroups = new Map<
    string,
    { primary: string; alternatives: Array<{ ticker: string; name: string; expenseRatio: number }> }
  >();

  for (const item of GLOBAL_EQUITY_MODEL_DATA) {
    sleeveGroups.set(item.sleeve, {
      primary: item.ticker,
      alternatives: item.alternatives,
    });
  }

  // Clear existing Global Equity sleeves for this user (only specific sleeve names)
  const globalEquitySleeveNames = [
    'US Total Market',
    'US Large Growth',
    'US Small Value',
    'International Equity',
    'Emerging Markets',
    'Global Equity Model', // Also clear any existing model with this name
  ];

  const existingGlobalEquitySleeves = await getDb()
    .select({ id: schema.sleeve.id })
    .from(schema.sleeve)
    .where(
      and(
        eq(schema.sleeve.userId, targetUserId),
        inArray(schema.sleeve.name, globalEquitySleeveNames),
      ),
    );

  const sleeveIdsToDelete = existingGlobalEquitySleeves.map((s) => s.id);

  if (sleeveIdsToDelete.length > 0) {
    // Delete related data first (foreign key constraints)
    await getDb()
      .delete(schema.restrictedSecurity)
      .where(inArray(schema.restrictedSecurity.sleeveId, sleeveIdsToDelete));
    await getDb()
      .delete(schema.sleeveMember)
      .where(inArray(schema.sleeveMember.sleeveId, sleeveIdsToDelete));
    await getDb().delete(schema.sleeve).where(inArray(schema.sleeve.id, sleeveIdsToDelete));
  }

  console.log('✅ Cleared existing sleeve data');

  // Insert sleeves and members
  const sleeves: Array<{ id: string; name: string }> = [];
  const sleeveMembers: Array<{ id: string; sleeveId: string; ticker: string; rank: number }> = [];

  let sleeveIndex = 1;
  let memberIndex = 1;

  for (const [sleeveName, sleeveData] of sleeveGroups) {
    // Create sleeve
    const sleeveId = `sleeve_global_equity_${Math.floor(Date.now() / 1000)}_${sleeveIndex}`;
    sleeves.push({
      id: sleeveId,
      name: sleeveName,
    });

    // Add primary security with rank 1 (highest priority)
    sleeveMembers.push({
      id: `member_global_equity_${Math.floor(Date.now() / 1000)}_${memberIndex}`,
      sleeveId,
      ticker: sleeveData.primary,
      rank: 1,
    });
    memberIndex++;

    // Add alternatives with lower ranks
    for (let i = 0; i < sleeveData.alternatives.length; i++) {
      sleeveMembers.push({
        id: `member_global_equity_${Math.floor(Date.now() / 1000)}_${memberIndex}`,
        sleeveId,
        ticker: sleeveData.alternatives[i].ticker,
        rank: i + 2, // Rank starts at 2 for alternatives
      });
      memberIndex++;
    }

    sleeveIndex++;
  }

  // Insert sleeves
  for (const sleeve of sleeves) {
    await getDb().insert(schema.sleeve).values({
      id: sleeve.id,
      userId: targetUserId,
      name: sleeve.name,
      createdAt: now,
      updatedAt: now,
    });
  }

  console.log('✅ Inserted sleeves');

  // Insert sleeve members
  for (const member of sleeveMembers) {
    try {
      await getDb().insert(schema.sleeveMember).values({
        id: member.id,
        sleeveId: member.sleeveId,
        ticker: member.ticker,
        rank: member.rank,
        createdAt: now,
        updatedAt: now,
      });
    } catch (error) {
      console.error(`❌ Failed to insert sleeve member ${member.ticker}:`, error);
    }
  }

  console.log('✅ Inserted sleeve members');

  console.log(
    `✅ Seeded ${sleeves.length} Global Equity sleeves, ${sleeveMembers.length} sleeve members`,
  );

  // Clear cache for this user to ensure fresh data
  const { clearCache } = await import('~/lib/db-api');
  clearCache(`sleeves-${userId || 'demo-user'}`);

  return {
    sleeves: sleeves.length,
    sleeveMembers: sleeveMembers.length,
  };
}

const getGlobalEquityModelData = async (userId?: string) => {
  // Determine the correct user ID to use
  let actualUserId = userId || 'demo-user';

  if (actualUserId === 'demo-user') {
    const users = await getDb()
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(eq(schema.user.role, 'admin'))
      .limit(1);

    if (users.length > 0) {
      actualUserId = users[0].id;
      console.log(`Using real user ID for Global Equity model: ${actualUserId}`);
    }
  }

  const now = new Date();

  return [
    {
      id: 'model_global_equity',
      userId: actualUserId,
      name: 'Global Equity Model',
      description: 'Diversified global equity allocation with tax-loss harvesting sleeves',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
  ];
};

// Function to generate model members based on Global Equity data
async function generateGlobalEquityModelMembers(modelId: string, userId?: string) {
  console.log('📊 Generating Global Equity model members...');

  const targetUserId = userId || 'demo-user';

  // If no userId provided, check if there's a real user in the database
  let actualUserId = targetUserId;
  if (targetUserId === 'demo-user') {
    const users = await getDb()
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(eq(schema.user.role, 'admin'))
      .limit(1);

    if (users.length > 0) {
      actualUserId = users[0].id;
      console.log(`Using real user ID: ${actualUserId}`);
    }
  }

  // Get all sleeves for this user
  const sleeves = await getDb()
    .select({
      id: schema.sleeve.id,
      name: schema.sleeve.name,
    })
    .from(schema.sleeve)
    .where(eq(schema.sleeve.userId, actualUserId));

  console.log(`✅ Found ${sleeves.length} sleeves for Global Equity model`);

  if (sleeves.length === 0) {
    console.log('❌ No sleeves found for user, cannot create Global Equity model members');
    return [];
  }

  const now = new Date();
  const modelMembers = [];

  // Create model members based on the predefined weights
  for (const item of GLOBAL_EQUITY_MODEL_DATA) {
    // Find the sleeve that matches this item's sleeve name
    const sleeve = sleeves.find((s) => s.name === item.sleeve);
    if (!sleeve) {
      console.warn(`⚠️  Could not find sleeve "${item.sleeve}" for ${item.ticker}`);
      continue;
    }

    modelMembers.push({
      id: `model_member_global_equity_${Math.floor(Date.now() / 1000)}_${modelMembers.length}`,
      modelId,
      sleeveId: sleeve.id,
      targetWeight: item.weight * 100, // Convert percentage to basis points (20% = 2000)
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  console.log(
    `✅ Generated ${modelMembers.length} Global Equity model members with specified weights`,
  );

  return modelMembers;
}

export async function seedGlobalEquityModelData(userId?: string) {
  console.log('🌱 Starting Global Equity model seeding...');

  // Get model data to insert
  const modelData = await getGlobalEquityModelData(userId);
  const modelIdsToInsert = modelData.map((m) => m.id);

  // Only delete models that have the same ID as the Global Equity model we're creating
  const modelsToDelete = await getDb()
    .select({ id: schema.model.id })
    .from(schema.model)
    .where(inArray(schema.model.id, modelIdsToInsert));

  if (modelsToDelete.length > 0) {
    console.log('⚠️  Clearing existing models to avoid ID conflicts...');

    const modelIdsToDelete = modelsToDelete.map((m) => m.id);

    // Delete model assignments first
    await getDb()
      .delete(schema.modelGroupAssignment)
      .where(inArray(schema.modelGroupAssignment.modelId, modelIdsToDelete));

    // Delete existing model members (due to foreign key constraints)
    await getDb()
      .delete(schema.modelMember)
      .where(inArray(schema.modelMember.modelId, modelIdsToDelete));

    // Then delete models
    await getDb().delete(schema.model).where(inArray(schema.model.id, modelIdsToDelete));

    console.log('✅ Cleared existing model data');
  }

  // Insert models
  for (const model of modelData) {
    await getDb().insert(schema.model).values(model);
  }

  // Generate and insert model members
  const modelMembersData = await generateGlobalEquityModelMembers('model_global_equity', userId);

  for (const member of modelMembersData) {
    await getDb().insert(schema.modelMember).values(member);
  }

  console.log(
    `✅ Seeded ${modelData.length} Global Equity models, ${modelMembersData.length} model members`,
  );

  // Clear cache for this user to ensure fresh data
  const { clearCache } = await import('~/lib/db-api');
  clearCache(`models-${userId || 'demo-user'}`);

  return {
    models: modelData.length,
    modelMembers: modelMembersData.length,
  };
}
