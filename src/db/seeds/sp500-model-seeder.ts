import { and, eq, inArray, like } from 'drizzle-orm';
import * as schema from '~/db/schema';
import { getDb } from '~/lib/db-config';

// Combined function to seed S&P 500 securities, sleeves, and models
async function _seedSp500Model(userId?: string) {
  console.log('🚀 Starting complete S&P 500 model seeding process...');

  // Seed S&P 500 securities first (needed for sleeves)
  await seedSP500Securities();

  // Seed sleeves (they're needed by models)
  await seedSleeves(userId);

  // Then seed models (which depend on sleeves)
  await seedModels(userId);

  console.log('🎉 Complete S&P 500 model seeding completed successfully!');
}

// Function to parse CSV line properly handling quoted fields
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  // Add the last field
  fields.push(current.trim());

  return fields;
}

// Function to fetch S&P 500 data from GitHub CSV
async function fetchSP500Data(): Promise<
  Array<{
    ticker: string;
    name: string;
    sector: string;
    industry: string;
  }>
> {
  console.log('📡 Fetching S&P 500 data from GitHub...');

  const response = await fetch(
    'https://raw.githubusercontent.com/datasets/s-and-p-500-companies/refs/heads/main/data/constituents.csv',
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch S&P 500 data: ${response.status} ${response.statusText}`);
  }

  const csvText = await response.text();
  const lines = csvText.split('\n').filter((line) => line.trim());

  // Skip header row
  const dataRows = lines.slice(1);

  const securities = dataRows
    .map((line) => {
      const fields = parseCSVLine(line);

      if (fields.length < 8) {
        console.warn(`Skipping malformed CSV line: ${line}`);
        return null;
      }

      const [symbol, security, gicsSector, gicsSubIndustry] = fields;

      return {
        ticker: symbol,
        name: security,
        sector: gicsSector,
        industry: gicsSubIndustry,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  console.log(`✅ Fetched ${securities.length} securities from GitHub CSV`);
  return securities;
}

// Generate data for all S&P 500 companies
async function generateSP500SecuritiesData(): Promise<
  Array<{
    ticker: string;
    name: string;
    price: number;
    industry: string | null;
    sector: string | null;
  }>
> {
  const sp500Data = await fetchSP500Data();

  return sp500Data.map((company) => ({
    ticker: company.ticker,
    name: company.name,
    price: 1, // Placeholder price
    industry: company.industry || null,
    sector: company.sector || null,
  }));
}

// Seed S&P 500 securities and index data
export async function seedSP500Securities() {
  console.log('📊 Seeding S&P 500 securities and index...');

  const now = new Date();

  // Generate S&P 500 securities data from GitHub CSV
  const SP500_SECURITIES_DATA = await generateSP500SecuritiesData();

  // Insert S&P 500 securities
  let insertedCount = 0;
  let skippedCount = 0;
  if (SP500_SECURITIES_DATA.length > 0) {
    const chunkSize = 500;
    for (let i = 0; i < SP500_SECURITIES_DATA.length; i += chunkSize) {
      const chunk = SP500_SECURITIES_DATA.slice(i, i + chunkSize).map((security) => ({
        ticker: security.ticker,
        name: security.name,
        price: security.price,
        industry: security.industry,
        sector: security.sector,
        createdAt: now,
        updatedAt: now,
      }));

      const inserted = await getDb()
        .insert(schema.security)
        .values(chunk)
        .onConflictDoNothing({ target: schema.security.ticker })
        .returning({ ticker: schema.security.ticker });

      insertedCount += inserted.length;
      skippedCount += chunk.length - inserted.length;
    }
  }

  console.log(`✅ Seeded ${insertedCount} S&P 500 securities (${skippedCount} already existed)`);

  // Seed S&P 500 index and members
  const indexInsert = await getDb()
    .insert(schema.indexTable)
    .values({
      id: 'sp500',
      name: 'S&P 500',
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing({ target: schema.indexTable.id })
    .returning({ id: schema.indexTable.id });

  if (indexInsert.length > 0) {
    console.log('✅ Created S&P 500 index');
  } else {
    console.log('⚠️  S&P 500 index already exists, skipping creation');
  }

  // Insert all S&P 500 companies as index members
  let membersInsertedCount = 0;
  let membersSkippedCount = 0;
  if (SP500_SECURITIES_DATA.length > 0) {
    const chunkSize = 500;
    for (let i = 0; i < SP500_SECURITIES_DATA.length; i += chunkSize) {
      const chunk = SP500_SECURITIES_DATA.slice(i, i + chunkSize).map((security) => ({
        id: `sp500-${security.ticker}`,
        indexId: 'sp500',
        securityId: security.ticker,
        createdAt: now,
        updatedAt: now,
      }));

      const inserted = await getDb()
        .insert(schema.indexMember)
        .values(chunk)
        .onConflictDoNothing({ target: schema.indexMember.id })
        .returning({ id: schema.indexMember.id });

      membersInsertedCount += inserted.length;
      membersSkippedCount += chunk.length - inserted.length;
    }
  }

  console.log(
    `✅ Seeded SP500 index with ${membersInsertedCount} members (${membersSkippedCount} already existed)`,
  );
}

const createdAt = new Date();

// Function to generate sleeves dynamically from S&P 500 data
async function generateDynamicSleeves() {
  console.log('📊 Generating sleeves from S&P 500 data...');

  // Get all S&P 500 securities with industry and market cap data
  const sp500Securities = await getDb()
    .select({
      ticker: schema.security.ticker,
      industry: schema.security.industry,
      marketCap: schema.security.marketCap,
    })
    .from(schema.security)
    .innerJoin(schema.indexMember, eq(schema.security.ticker, schema.indexMember.securityId))
    .innerJoin(schema.indexTable, eq(schema.indexMember.indexId, schema.indexTable.id))
    .where(eq(schema.indexTable.name, 'S&P 500'))
    .orderBy(schema.security.ticker);

  // Filter out securities without industry data (market cap is optional)
  const validSecurities = sp500Securities.filter(
    (sec) => sec.industry && sec.industry.trim().length > 0,
  );

  console.log(`✅ Found ${validSecurities.length} S&P 500 securities with industry data`);

  // Group securities by industry
  const industryGroups = new Map<string, Array<{ ticker: string; marketCap: number | null }>>();

  for (const security of validSecurities) {
    const industry = security.industry;
    const marketCap = security.marketCap;

    // Type guard to ensure we have industry data
    if (!industry || industry.trim().length === 0) {
      continue;
    }

    if (!industryGroups.has(industry)) {
      industryGroups.set(industry, []);
    }
    const industrySecurities = industryGroups.get(industry);
    if (industrySecurities) {
      industrySecurities.push({
        ticker: security.ticker,
        marketCap: marketCap,
      });
    }
  }

  console.log(`✅ Grouped into ${industryGroups.size} unique industries`);

  // Generate sleeves data
  const sleeves: Array<{ id: string; name: string }> = [];
  const sleeveMembers: Array<{ id: string; sleeveId: string; ticker: string; rank: number }> = [];

  let sleeveIndex = 1;
  let memberIndex = 1;

  for (const [industry, securities] of industryGroups) {
    // Sort securities: those with market cap first (by market cap descending),
    // then those without market cap (alphabetically by ticker)
    securities.sort((a, b) => {
      // Both have market cap: sort by market cap descending
      if (a.marketCap !== null && b.marketCap !== null) {
        return b.marketCap - a.marketCap;
      }
      // Only a has market cap: a comes first
      if (a.marketCap !== null && b.marketCap === null) {
        return -1;
      }
      // Only b has market cap: b comes first
      if (a.marketCap === null && b.marketCap !== null) {
        return 1;
      }
      // Neither has market cap: sort alphabetically by ticker
      return a.ticker.localeCompare(b.ticker);
    });

    // Create sleeve for this industry
    const sleeveId = `sleeve_dynamic_${Math.floor(Date.now() / 1000)}_${sleeveIndex}`;
    const sleeveName = `${industry}`;

    sleeves.push({
      id: sleeveId,
      name: sleeveName,
    });

    // Add securities to sleeve with ranks (1 = highest priority)
    for (let i = 0; i < securities.length; i++) {
      sleeveMembers.push({
        id: `member_dynamic_${Math.floor(Date.now() / 1000)}_${memberIndex}`,
        sleeveId,
        ticker: securities[i].ticker,
        rank: i + 1, // Rank starts at 1 (highest priority)
      });
      memberIndex++;
    }

    sleeveIndex++;
  }

  console.log(`✅ Generated ${sleeves.length} sleeves with ${sleeveMembers.length} total members`);

  return { sleeves, sleeveMembers };
}

export async function seedSleeves(userId?: string) {
  console.log('📂 Seeding sleeves...');

  const now = new Date();

  const targetUserId = userId || 'demo-user';
  console.log(`✅ Using user ID for sleeves: ${targetUserId}`);

  // Generate dynamic sleeves from S&P 500 data
  const { sleeves: dynamicSleeves, sleeveMembers: dynamicMembers } = await generateDynamicSleeves();

  // Clear existing dynamic S&P 500 sleeves for this user (only sleeves created by this seeder)
  const existingDynamicSleeves = await getDb()
    .select({ id: schema.sleeve.id })
    .from(schema.sleeve)
    .where(and(eq(schema.sleeve.userId, targetUserId), like(schema.sleeve.id, 'sleeve_dynamic_%')));

  const sleeveIdsToDelete = existingDynamicSleeves.map((s) => s.id);

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

  // Insert sleeves
  for (const sleeve of dynamicSleeves) {
    await getDb().insert(schema.sleeve).values({
      id: sleeve.id,
      userId: targetUserId, // Use target user ID
      name: sleeve.name,
      createdAt: now,
      updatedAt: now,
    });
  }

  console.log('✅ Inserted sleeves');

  // Insert sleeve members
  for (const member of dynamicMembers) {
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
    `✅ Seeded ${dynamicSleeves.length} sleeves, ${dynamicMembers.length} sleeve members from S&P 500 data`,
  );

  // Clear cache for this user to ensure fresh data
  const { clearCache } = await import('~/lib/db-api');
  clearCache(`sleeves-${userId || 'demo-user'}`);

  return {
    sleeves: dynamicSleeves.length,
    sleeveMembers: dynamicMembers.length,
  };
}

const getModelData = async (userId?: string) => {
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
      console.log(`Using real user ID for model: ${actualUserId}`);
    }
  }

  return [
    {
      id: 'model_sp500_index_replication',
      userId: actualUserId,
      name: 'S&P 500 Index Replication',
      description: null,
      isActive: true,
      createdAt,
      updatedAt: createdAt,
    },
  ];
};

// Function to generate model members dynamically based on existing sleeves
async function generateDynamicModelMembers(modelId: string, userId?: string) {
  console.log('📊 Generating model members from existing sleeves...');

  // Get all sleeves from the database for the specified user
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

  const sleeves = await getDb()
    .select({
      id: schema.sleeve.id,
      name: schema.sleeve.name,
    })
    .from(schema.sleeve)
    .where(eq(schema.sleeve.userId, actualUserId));

  console.log(`✅ Found ${sleeves.length} sleeves to add to model for user ${targetUserId}`);

  // Calculate equal weight for each sleeve (ensure total is exactly 100%)
  if (sleeves.length === 0) {
    console.log('❌ No sleeves found for user, cannot create model members');
    return [];
  }

  // Calculate precise weights that sum to exactly 1000 (representing 100.0%)
  const totalWeight = 10000; // Represent 100% as 1000 (for 0.1% precision)
  const numSleeves = sleeves.length;
  const baseWeight = Math.floor(totalWeight / numSleeves); // Base weight per sleeve
  const remainder = totalWeight % numSleeves; // Distribute remainder

  const modelMembers = sleeves.map((sleeve, index) => {
    // Add 1 to first 'remainder' sleeves to distribute remainder evenly
    const weight = index < remainder ? baseWeight + 1 : baseWeight;

    return {
      id: `model_member_dynamic_${Math.floor(Date.now() / 1000)}_${index}`,
      modelId,
      sleeveId: sleeve.id,
      targetWeight: weight,
      isActive: true,
      createdAt,
      updatedAt: createdAt,
    };
  });

  console.log(`✅ Generated ${modelMembers.length} model members with equal weights (total: 100%)`);

  return modelMembers;
}

export async function seedModels(userId?: string) {
  console.log('🌱 Starting model seeding...');

  // Get model data to insert
  const modelData = await getModelData(userId);
  const modelIdsToInsert = modelData.map((m) => m.id);

  // Only delete models that have the same ID as the S&P 500 model we're creating
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

  // Generate and insert model members dynamically
  const modelMembersData = await generateDynamicModelMembers(
    'model_sp500_index_replication',
    userId,
  );

  for (const member of modelMembersData) {
    await getDb().insert(schema.modelMember).values(member);
  }

  console.log(`✅ Seeded ${modelData.length} models, ${modelMembersData.length} model members`);

  // Clear cache for this user to ensure fresh data
  const { clearCache } = await import('~/lib/db-api');
  clearCache(`models-${userId || 'demo-user'}`);

  return {
    models: modelData.length,
    modelMembers: modelMembersData.length,
  };
}
