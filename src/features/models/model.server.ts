import { createServerFn } from '@tanstack/react-start';
import { requireAuth } from '../auth/auth-utils';

// Server function to get all models - runs ONLY on server
export const getModelsServerFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { user } = await requireAuth();

  // Import database API only on the server
  const { getModels } = await import('../../lib/db-api');
  const models = await getModels(user.id);
  return models;
});

// Server function to create a new model - runs ONLY on server
export const createModelServerFn = createServerFn({ method: 'POST' })
  .validator(
    (data: {
      name: string;
      description?: string;
      members: Array<{ sleeveId: string; targetWeight: number }>;
      updateExisting?: boolean;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { user } = await requireAuth();

    const { name, description, members, updateExisting } = data;

    if (!name || !members || !Array.isArray(members)) {
      throw new Error('Invalid request: name and members array required');
    }

    // Import database API only on the server
    const { createModel } = await import('../../lib/db-api');
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
  .validator(
    (data: {
      modelId: string;
      name: string;
      description?: string;
      members: Array<{ sleeveId: string; targetWeight: number }>;
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireAuth();

    const { modelId, name, description, members } = data;

    if (!modelId || !name || !members || !Array.isArray(members)) {
      throw new Error('Invalid request: modelId, name and members array required');
    }

    // Import database API only on the server
    const { updateModel } = await import('../../lib/db-api');
    await updateModel(modelId, { name, description, members });
    return { success: true };
  });

// Server function to delete a model - runs ONLY on server
export const deleteModelServerFn = createServerFn({ method: 'POST' })
  .validator((data: { modelId: string }) => data)
  .handler(async ({ data }) => {
    await requireAuth();

    const { modelId } = data;

    if (!modelId) {
      throw new Error('Invalid request: modelId required');
    }

    // Import database API only on the server
    const { deleteModel } = await import('../../lib/db-api');
    await deleteModel(modelId);
    return { success: true };
  });

// Server function to get model by ID - runs ONLY on server
export const getModelByIdServerFn = createServerFn({ method: 'POST' })
  .validator((data: { modelId: string }) => data)
  .handler(async ({ data }) => {
    await requireAuth();

    const { modelId } = data;

    if (!modelId) {
      throw new Error('Invalid request: modelId required');
    }

    // Import database API only on the server
    const { getModelById } = await import('../../lib/db-api');
    const model = await getModelById(modelId);
    return model;
  });
