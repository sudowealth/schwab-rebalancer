import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { throwServerError } from '~/lib/error-utils';
import { createModel, deleteModel, getModelById, getModels, updateModel } from '../../lib/db-api';
import { requireAuth } from '../auth/auth-utils';

// Zod schemas for type safety
const createModelSchema = z.object({
  name: z.string().min(1, 'Model name is required'),
  description: z.string().optional(),
  members: z
    .array(
      z.object({
        sleeveId: z.string().min(1, 'Sleeve ID is required'),
        targetWeight: z.number().min(0).max(100, 'Weight must be between 0 and 100'),
      }),
    )
    .min(1, 'At least one member is required'),
  updateExisting: z.boolean().optional().default(false),
});

const updateModelSchema = z.object({
  modelId: z.string().min(1, 'Model ID is required'),
  name: z.string().min(1, 'Model name is required'),
  description: z.string().optional(),
  members: z
    .array(
      z.object({
        sleeveId: z.string().min(1, 'Sleeve ID is required'),
        targetWeight: z.number().min(0).max(100, 'Weight must be between 0 and 100'),
      }),
    )
    .min(1, 'At least one member is required'),
});

const modelIdOnlySchema = z.object({
  modelId: z.string().min(1, 'Model ID is required'),
});

// Server function to get all models - runs ONLY on server
export const getModelsServerFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { user } = await requireAuth();

  // Import database API only on the server

  const models = await getModels(user.id);
  return models;
});

// Server function to create a new model - runs ONLY on server
export const createModelServerFn = createServerFn({ method: 'POST' })
  .validator(createModelSchema)
  .handler(async ({ data }) => {
    const { user } = await requireAuth();

    const { name, description, members, updateExisting } = data;

    if (!name || !members || !Array.isArray(members)) {
      throwServerError('Invalid request: name and members array required', 400);
    }

    // Import database API only on the server

    const modelId = await createModel(
      {
        name,
        description,
        members,
        updateExisting,
      },
      user.id,
    );
    return { success: true, modelId };
  });

// Server function to update a model - runs ONLY on server
export const updateModelServerFn = createServerFn({ method: 'POST' })
  .validator(updateModelSchema)
  .handler(async ({ data }) => {
    await requireAuth();

    const { modelId, name, description, members } = data;

    if (!modelId || !name || !members || !Array.isArray(members)) {
      throwServerError('Invalid request: modelId, name and members array required', 400);
    }

    // Import database API only on the server

    await updateModel(modelId, { name, description, members });
    return { success: true };
  });

// Server function to delete a model - runs ONLY on server
export const deleteModelServerFn = createServerFn({ method: 'POST' })
  .validator(modelIdOnlySchema)
  .handler(async ({ data }) => {
    await requireAuth();

    const { modelId } = data;

    if (!modelId) {
      throwServerError('Invalid request: modelId required', 400);
    }

    // Import database API only on the server

    await deleteModel(modelId);
    return { success: true };
  });

// Server function to get model by ID - runs ONLY on server
export const getModelByIdServerFn = createServerFn({ method: 'POST' })
  .validator(modelIdOnlySchema)
  .handler(async ({ data }) => {
    await requireAuth();

    const { modelId } = data;

    if (!modelId) {
      throwServerError('Invalid request: modelId required', 400);
    }

    // Import database API only on the server

    const model = await getModelById(modelId);
    return model;
  });
