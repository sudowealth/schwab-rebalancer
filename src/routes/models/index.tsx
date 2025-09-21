import { createFileRoute, Link } from '@tanstack/react-router';
import { FileText } from 'lucide-react';
import { AddModelModal } from '~/features/models/components/add-model-modal';
import { authGuard } from '~/lib/route-guards';
import { getModelsServerFn } from '~/lib/server-functions';

export const Route = createFileRoute('/models/')({
  component: ModelsComponent,
  beforeLoad: authGuard,
  loader: async () => {
    // Now loader only handles data fetching, auth is handled by beforeLoad
    return getModelsServerFn();
  },
});

function ModelsComponent() {
  const loaderData = Route.useLoaderData();
  const models = loaderData || [];
  // Since data is loaded in the loader, we don't need React Query here
  // But we could keep it for cache management if needed

  return (
    <div className="px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Models</h1>
            <p className="mt-2 text-sm text-gray-600">
              Manage portfolio models and their sleeve allocations
            </p>
          </div>
          <AddModelModal />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {models.map((model) => (
          <div
            key={model.id}
            className="bg-white shadow rounded-lg hover:shadow-md transition-shadow relative"
          >
            <div className="p-5">
              <div className="mb-4">
                <Link
                  to="/models/$modelId"
                  params={{ modelId: model.id }}
                  className="text-lg font-medium text-gray-900 cursor-pointer hover:text-blue-600 transition-colors text-left"
                >
                  {model.name}
                </Link>
              </div>

              {model.description && (
                <p className="text-sm text-gray-500 mb-4">{model.description}</p>
              )}

              {/* Model Members */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700">Allocations:</h4>
                {model.members.slice(0, 3).map((member) => (
                  <div key={member.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center space-x-2">
                      <span className="text-gray-900 font-medium">
                        {member.sleeveName || member.sleeveId}
                      </span>
                    </div>
                    <span className="font-mono text-gray-700">
                      {(member.targetWeight / 100).toFixed(1)}%
                    </span>
                  </div>
                ))}
                {model.members.length > 3 && (
                  <p className="text-xs text-gray-400">+{model.members.length - 3} more...</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {models.length === 0 && (
        <div className="text-center py-12">
          <FileText className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No models found</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by creating a new model.</p>
        </div>
      )}
    </div>
  );
}
