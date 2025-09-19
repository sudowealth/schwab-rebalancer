import { createServerFn } from '@tanstack/react-start';
import { DatabaseError, logError, ValidationError, withRetry } from './error-handler';

// Defer server-only auth utilities to runtime to avoid bundling them in the client build
const requireAuth = async () => {
  const mod = await import('./auth-utils');
  return mod.requireAuth();
};

// Server function to get sleeves data - runs ONLY on server
export const getSleevesServerFn = createServerFn({ method: 'GET' }).handler(async () => {
  try {
    const { user } = await requireAuth();

    return await withRetry(
      async () => {
        const { getSleeves } = await import('./db-api');
        return await getSleeves(user.id);
      },
      2,
      500,
      'getSleeves',
    );
  } catch (error) {
    logError(error, 'Failed to get sleeves', { userId: 'redacted' });
    throw new DatabaseError('Failed to retrieve sleeves', error);
  }
});

// Server function to create a new sleeve - runs ONLY on server
export const createSleeveServerFn = createServerFn({ method: 'POST' })
  .validator(
    (data: {
      name: string;
      members: Array<{ ticker: string; rank: number; isLegacy?: boolean }>;
    }) => data,
  )
  .handler(async ({ data }) => {
    try {
      const { user } = await requireAuth();

      const { name, members } = data;

      if (!name?.trim()) {
        throw new ValidationError('Sleeve name is required', 'name');
      }

      if (!members || !Array.isArray(members) || members.length === 0) {
        throw new ValidationError('At least one member is required', 'members');
      }

      if (members.some((m) => !m.ticker?.trim() || typeof m.rank !== 'number')) {
        throw new ValidationError('All members must have valid ticker and rank', 'members');
      }

      return await withRetry(
        async () => {
          const { createSleeve } = await import('./db-api');
          const sleeveId = await createSleeve(name.trim(), members, user.id);
          return { success: true, sleeveId };
        },
        2,
        500,
        'createSleeve',
      );
    } catch (error) {
      if (error instanceof ValidationError) throw error;
      logError(error, 'Failed to create sleeve', {
        name: data.name,
        memberCount: data.members?.length,
      });
      throw new DatabaseError('Failed to create sleeve', error);
    }
  });

// Server function to update a sleeve - runs ONLY on server
export const updateSleeveServerFn = createServerFn({ method: 'POST' })
  .validator(
    (data: {
      sleeveId: string;
      name: string;
      members: Array<{ ticker: string; rank: number; isLegacy?: boolean }>;
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireAuth();

    const { sleeveId, name, members } = data;

    if (!sleeveId || !name || !members || !Array.isArray(members)) {
      throw new Error('Invalid request: sleeveId, name and members array required');
    }

    // Import database API only on the server
    const { updateSleeve } = await import('./db-api');
    await updateSleeve(sleeveId, name, members);
    return { success: true };
  });

// Server function to delete a sleeve - runs ONLY on server
export const deleteSleeveServerFn = createServerFn({ method: 'POST' })
  .validator((data: { sleeveId: string }) => data)
  .handler(async ({ data }) => {
    await requireAuth();

    const { sleeveId } = data;

    if (!sleeveId) {
      throw new Error('Invalid request: sleeveId required');
    }

    // Import database API only on the server
    const { deleteSleeve } = await import('./db-api');
    await deleteSleeve(sleeveId);
    return { success: true };
  });

// Server function to get sleeve by ID - runs ONLY on server
export const getSleeveByIdServerFn = createServerFn({ method: 'POST' })
  .validator((data: { sleeveId: string }) => data)
  .handler(async ({ data }) => {
    const { user } = await requireAuth();

    const { sleeveId } = data;

    if (!sleeveId) {
      throw new Error('Invalid request: sleeveId required');
    }

    // Import database API only on the server
    const { getSleeveById } = await import('./db-api');
    const sleeve = await getSleeveById(sleeveId, user.id);
    return sleeve;
  });

// Server function to get sleeve holdings info - runs ONLY on server
export const getSleeveHoldingsInfoServerFn = createServerFn({ method: 'POST' })
  .validator((data: { sleeveId: string }) => data)
  .handler(async ({ data }) => {
    await requireAuth();

    const { sleeveId } = data;

    if (!sleeveId) {
      throw new Error('Invalid request: sleeveId required');
    }

    // Import database API only on the server
    const { getSleeveHoldingsInfo } = await import('./db-api');
    const holdingsInfo = await getSleeveHoldingsInfo(sleeveId);
    return holdingsInfo;
  });

// Server function to get available sleeves for model creation/editing - runs ONLY on server
export const getAvailableSleevesServerFn = createServerFn({
  method: 'GET',
}).handler(async () => {
  await requireAuth();

  // Import database API only on the server
  const { getAvailableSleeves } = await import('./db-api');
  const sleeves = await getAvailableSleeves();
  return sleeves;
});
