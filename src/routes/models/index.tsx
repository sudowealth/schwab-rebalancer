import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { FileText, Trash2 } from "lucide-react";
import { AddModelModal } from "../../components/models/add-model-modal";
import { EditModelModal } from "../../components/models/edit-model-modal";
import { DeleteModelModal } from "../../components/models/delete-model-modal";
import { Button } from "../../components/ui/button";
import type { Model } from "../../lib/schemas";
import { getModelsServerFn } from "../../lib/server-functions";

export const Route = createFileRoute("/models/")({
  component: ModelsComponent,
  loader: async () => {
    try {
      // Server function handles authentication
      const models = await getModelsServerFn();
      return { models };
    } catch (error) {
      // If authentication error, redirect to login
      if (
        error instanceof Error &&
        error.message.includes("Authentication required")
      ) {
        throw redirect({ to: "/login", search: { reset: "" } });
      }
      // Re-throw other errors
      throw error;
    }
  },
});

function ModelsComponent() {
  const loaderData = Route.useLoaderData();
  const models = loaderData.models;

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);

  const handleEditModel = (model: Model) => {
    setSelectedModel(model);
    setEditModalOpen(true);
  };

  const handleDeleteModel = (model: Model) => {
    setSelectedModel(model);
    setDeleteModalOpen(true);
  };

  const closeModals = () => {
    setEditModalOpen(false);
    setDeleteModalOpen(false);
    setSelectedModel(null);
  };

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
              <div className="flex items-center justify-between mb-4">
                <h3
                  className="text-lg font-medium text-gray-900 cursor-pointer hover:text-blue-600 transition-colors"
                  onClick={() => handleEditModel(model)}
                >
                  {model.name}
                </h3>
                <div className="flex items-center space-x-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteModel(model)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {model.description && (
                <p className="text-sm text-gray-500 mb-4">
                  {model.description}
                </p>
              )}

              {/* Model Members */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700">
                  Allocations:
                </h4>
                {model.members.slice(0, 3).map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between text-sm"
                  >
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
                  <div
                    className="text-xs text-gray-400 cursor-pointer hover:text-blue-600 transition-colors"
                    onClick={() => handleEditModel(model)}
                  >
                    +{model.members.length - 3} more...
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      {models.length === 0 && (
        <div className="text-center py-12">
          <FileText className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            No models found
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Get started by creating a new model.
          </p>
        </div>
      )}

      {/* Edit Modal */}
      {selectedModel && (
        <EditModelModal
          model={selectedModel}
          open={editModalOpen}
          onOpenChange={setEditModalOpen}
          onClose={closeModals}
        />
      )}

      {/* Delete Modal */}
      {selectedModel && (
        <DeleteModelModal
          model={selectedModel}
          open={deleteModalOpen}
          onOpenChange={setDeleteModalOpen}
          onClose={closeModals}
        />
      )}
    </div>
  );
}
