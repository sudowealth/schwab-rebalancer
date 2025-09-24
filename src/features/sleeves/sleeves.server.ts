import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { DatabaseError, logError, ValidationError, withRetry } from '~/lib/error-handler';
import { throwServerError } from '~/lib/error-utils';
import {
  createSleeve,
  deleteSleeve,
  getAvailableSleeves,
  getSleeveById,
  getSleeveHoldingsInfo,
  getSleeves,
  updateSleeve,
} from '../../lib/db-api';
import { requireAuth } from '../auth/auth-utils';

// Zod schemas for type safety
const createSleeveSchema = z.object({
  name: z.string().min(1, 'Sleeve name is required'),
  members: z
    .array(
      z.object({
        ticker: z.string().min(1, 'Ticker is required'),
        rank: z.number().min(0, 'Rank must be non-negative'),
        isLegacy: z.boolean().optional(),
      }),
    )
    .min(1, 'At least one member is required'),
});

const updateSleeveSchema = z.object({
  sleeveId: z.string().min(1, 'Sleeve ID is required'),
  name: z.string().min(1, 'Sleeve name is required'),
  members: z
    .array(
      z.object({
        ticker: z.string().min(1, 'Ticker is required'),
        rank: z.number().min(0, 'Rank must be non-negative'),
        isLegacy: z.boolean().optional(),
      }),
    )
    .min(1, 'At least one member is required'),
});

const sleeveIdOnlySchema = z.object({
  sleeveId: z.string().min(1, 'Sleeve ID is required'),
});

// Server function to get sleeves data - runs ONLY on server
export const getSleevesServerFn = createServerFn({ method: 'GET' }).handler(async () => {
  try {
    const { user } = await requireAuth();

    return await withRetry(
      async () => {
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
  .inputValidator(createSleeveSchema)
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
  .inputValidator(updateSleeveSchema)
  .handler(async ({ data }) => {
    await requireAuth();

    const { sleeveId, name, members } = data;

    if (!sleeveId || !name || !members || !Array.isArray(members)) {
      throwServerError('Invalid request: sleeveId, name and members array required', 400);
    }

    // Import database API only on the server

    await updateSleeve(sleeveId, name, members);
    return { success: true };
  });

// Server function to delete a sleeve - runs ONLY on server
export const deleteSleeveServerFn = createServerFn({ method: 'POST' })
  .inputValidator(sleeveIdOnlySchema)
  .handler(async ({ data }) => {
    await requireAuth();

    const { sleeveId } = data;

    if (!sleeveId) {
      throwServerError('Invalid request: sleeveId required', 400);
    }

    // Import database API only on the server

    await deleteSleeve(sleeveId);
    return { success: true };
  });

// Server function to get sleeve by ID - runs ONLY on server
export const getSleeveByIdServerFn = createServerFn({ method: 'POST' })
  .inputValidator(sleeveIdOnlySchema)
  .handler(async ({ data }) => {
    const { user } = await requireAuth();

    const { sleeveId } = data;

    if (!sleeveId) {
      throwServerError('Invalid request: sleeveId required', 400);
    }

    // Import database API only on the server

    const sleeve = await getSleeveById(sleeveId, user.id);
    return sleeve;
  });

// Server function to get sleeve holdings info - runs ONLY on server
export const getSleeveHoldingsInfoServerFn = createServerFn({ method: 'POST' })
  .inputValidator(sleeveIdOnlySchema)
  .handler(async ({ data }) => {
    await requireAuth();

    const { sleeveId } = data;

    if (!sleeveId) {
      throwServerError('Invalid request: sleeveId required', 400);
    }

    // Import database API only on the server

    const holdingsInfo = await getSleeveHoldingsInfo(sleeveId);
    return holdingsInfo;
  });

// Server function to get available sleeves for model creation/editing - runs ONLY on server
export const getAvailableSleevesServerFn = createServerFn({
  method: 'GET',
}).handler(async () => {
  await requireAuth();

  // Import database API only on the server

  const sleeves = await getAvailableSleeves();
  return sleeves;
});
