import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import {
  AlertCircle,
  CheckCircle,
  Circle,
  Database,
  Eye,
  Layers,
  Link,
  Loader2,
  Plus,
  RotateCcw,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useModelCreation } from '../hooks/useModelCreation';
import { useSchwabConnection } from '../hooks/useSchwabConnection';
import { useSecuritiesSeeding } from '../hooks/useSecuritiesSeeding';
import { checkModelsExistServerFn, checkSecuritiesExistServerFn } from '../lib/server-functions';
import { Button } from './ui/button';
import { SimpleTooltip } from './ui/simple-tooltip';

interface OnboardingTask {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  icon: React.ComponentType<{ className?: string }>;
}

interface OnboardingTrackerProps {
  schwabCredentialsStatus?: { hasCredentials: boolean };
  rebalancingGroupsStatus?: { hasGroups: boolean; groupsCount: number };
  rebalancingRunsStatus?: { hasRuns: boolean; runsCount: number };
  proposedTradesStatus?: { hasTrades: boolean; tradesCount: number };
}

export function OnboardingTracker({
  schwabCredentialsStatus,
  rebalancingGroupsStatus,
  rebalancingRunsStatus,
  proposedTradesStatus,
}: OnboardingTrackerProps) {
  const navigate = useNavigate();

  // Use the Schwab connection hook for managing connection state
  const {
    isConnecting,
    isSyncing,
    syncStep,
    statusLoading,
    oauthMutation,
    isConnected,
    handleConnect,
  } = useSchwabConnection(schwabCredentialsStatus);

  // Query for reactive securities status
  const { data: reactiveSecuritiesStatus } = useQuery({
    queryKey: ['securities-status'],
    queryFn: () => checkSecuritiesExistServerFn(),
  });

  // Query for reactive models status
  const { data: reactiveModelsStatus } = useQuery({
    queryKey: ['models-status'],
    queryFn: () => checkModelsExistServerFn(),
  });

  // Use the securities seeding hook for managing securities import state
  const { isSeeding, hasError, seedResult, showSuccessMessage } =
    useSecuritiesSeeding(reactiveSecuritiesStatus);

  // Use the model creation hook for managing model creation state
  const { handleSeedGlobalEquity, isSeeding: isCreatingModel } = useModelCreation();

  const tasks: OnboardingTask[] = [
    {
      id: 'securities-import',
      title: 'Securities Import (Automatic)',
      description: 'Add ~11,000 stocks and ETFs from NASDAQ feeds to your database',
      completed: reactiveSecuritiesStatus?.hasSecurities || false,
      icon: Database,
    },
    {
      id: 'connect-schwab',
      title: 'Connect to Schwab',
      description: 'Link your Charles Schwab accounts for automatic data import',
      completed: isConnected,
      icon: Link,
    },
    {
      id: 'create-model',
      title: 'Create an Investment Model',
      description: 'Build or use a pre-built investment model for your portfolio',
      completed: reactiveModelsStatus?.hasModels || false,
      icon: Layers,
    },
    {
      id: 'create-rebalancing-group',
      title: 'Create a Rebalancing Group',
      description: 'Group your accounts together for portfolio rebalancing',
      completed: rebalancingGroupsStatus?.hasGroups || false,
      icon: Users,
    },
    {
      id: 'run-first-rebalance',
      title: 'Rebalance your Portfolio',
      description: 'Execute your first portfolio rebalancing operation',
      completed: rebalancingRunsStatus?.hasRuns || false,
      icon: RotateCcw,
    },
    {
      id: 'preview-first-trade',
      title: 'Preview your first Trade',
      description: 'Generate and preview your first set of trading recommendations',
      completed: proposedTradesStatus?.hasTrades || false,
      icon: Eye,
    },
  ];

  const completedTasks = tasks.filter((task) => task.completed).length;
  const totalTasks = tasks.length;
  const isFullyOnboarded = completedTasks === totalTasks;

  // Don't show the tracker if fully onboarded
  if (isFullyOnboarded) {
    return null;
  }

  // Note: previously we returned a standalone syncing banner here which
  // hid the rest of the checklist. To keep UX consistent and always
  // show all steps, we now render syncing progress inline within the
  // "Connect to Schwab" step below instead of returning early.

  return (
    <div className="mb-8">
      <div className="space-y-4">
        {tasks.map((task, index) => {
          const Icon = task.icon;
          return (
            <div
              key={task.id}
              className={`flex items-start gap-4 p-4 rounded-lg border ${
                task.completed ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
              }`}
            >
              <div className="flex-shrink-0 mt-1">
                {task.completed ? (
                  <CheckCircle className="h-6 w-6 text-green-600" />
                ) : (
                  <Circle className="h-6 w-6 text-gray-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="h-5 w-5 text-gray-600 flex-shrink-0" />
                  <h4
                    className={`font-medium ${task.completed ? 'text-green-900' : 'text-gray-900'}`}
                  >
                    {index + 1}. {task.title}
                  </h4>
                </div>
                <p className={`text-sm ${task.completed ? 'text-green-700' : 'text-gray-600'}`}>
                  {task.description}
                </p>
                {(() => {
                  if (!task.completed && task.id === 'connect-schwab') {
                    return (
                      <div className="mt-3">
                        <Button
                          size="sm"
                          onClick={handleConnect}
                          disabled={isConnecting || oauthMutation.isPending || statusLoading}
                          className="text-xs"
                        >
                          {isConnecting || oauthMutation.isPending ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                              Connecting...
                            </>
                          ) : (
                            <>
                              <Link className="h-3 w-3 mr-1" />
                              Connect to Schwab
                            </>
                          )}
                        </Button>
                        {(isConnecting || oauthMutation.isPending || statusLoading) && (
                          <p className="text-xs text-gray-500 mt-1">
                            Redirecting to Schwab for secure authentication...
                          </p>
                        )}
                      </div>
                    );
                  }
                  // Show inline sync progress even if the Schwab
                  // connection is technically completed. This keeps the
                  // checklist visible during data imports and avoids a
                  // jarring style change.
                  if (task.id === 'connect-schwab' && isSyncing) {
                    return (
                      <div className="mt-3">
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                          <span>{syncStep || 'Preparing your data...'}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">This may take a few moments</p>
                      </div>
                    );
                  }
                  if (!task.completed && task.id === 'securities-import') {
                    return (
                      <div className="mt-3 space-y-3">
                        {/* Loading State */}
                        {isSeeding && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Importing ETFs and stocks from NASDAQ feeds (~11,000)</span>
                          </div>
                        )}

                        {/* Success Message */}
                        {showSuccessMessage && seedResult && (
                          <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                            <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <h5 className="font-medium text-green-900 mb-1 text-sm">
                                Securities imported successfully!
                              </h5>
                              <div className="space-y-1 text-xs">
                                <div>
                                  <span className="text-green-700">Imported: </span>
                                  {seedResult.equitySyncResult.imported.toLocaleString()} securities
                                </div>
                                <div>
                                  <span className="text-blue-700">Already existed: </span>
                                  {seedResult.equitySyncResult.skipped.toLocaleString()} securities
                                </div>
                                {seedResult.equitySyncResult.errors.length > 0 && (
                                  <div>
                                    <span className="text-red-700">Errors: </span>
                                    {seedResult.equitySyncResult.errors.length}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Error Message */}
                        {hasError && (
                          <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
                            <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <h5 className="font-medium text-red-900 mb-1 text-sm">
                                Failed to seed securities
                              </h5>
                              <p className="text-xs text-red-700">
                                There was an error populating the securities data. Please try again
                                or check the console for details.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  }
                  if (!task.completed && task.id === 'create-model') {
                    const hasSecurities = reactiveSecuritiesStatus?.hasSecurities || false;
                    const isDisabled = !hasSecurities;

                    return (
                      <div className="mt-3 space-y-3">
                        {/* Show message if securities not imported */}
                        {isDisabled && (
                          <div className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                            <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                            <p className="text-xs text-amber-800">
                              You must complete the Securities Import step before creating models.
                            </p>
                          </div>
                        )}

                        {/* Model Creation Options */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {/* Global Equity Model Option */}
                          <div
                            className={`border-2 rounded-lg p-3 ${
                              isDisabled
                                ? 'border-gray-200 bg-gray-50/50'
                                : 'border-blue-200 bg-blue-50/50'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <TrendingUp
                                className={`h-4 w-4 ${isDisabled ? 'text-gray-400' : 'text-blue-600'}`}
                              />
                              <h5
                                className={`font-medium ${isDisabled ? 'text-gray-500' : 'text-blue-900'}`}
                              >
                                Global Equity Model
                              </h5>
                            </div>
                            <p
                              className={`text-xs mb-3 ${isDisabled ? 'text-gray-500' : 'text-blue-700'}`}
                            >
                              Pre-built model with geographic diversification across US,
                              International, and Emerging markets
                            </p>
                            <ul
                              className={`text-xs space-y-1 mb-3 ${isDisabled ? 'text-gray-400' : 'text-gray-600'}`}
                            >
                              <li>• US Large Cap (40%): VTI</li>
                              <li>• International (20%): VXUS</li>
                              <li>• Emerging Markets (10%): VWO</li>
                              <li>• And more regional ETFs</li>
                            </ul>
                            {isDisabled ? (
                              <SimpleTooltip content="Complete securities import before creating models">
                                <Button disabled={true} className="w-full text-xs" size="sm">
                                  <TrendingUp className="mr-1 h-3 w-3" />
                                  Use Global Equity Model
                                </Button>
                              </SimpleTooltip>
                            ) : (
                              <Button
                                onClick={handleSeedGlobalEquity}
                                disabled={isCreatingModel}
                                className="w-full text-xs"
                                size="sm"
                              >
                                {isCreatingModel ? (
                                  <>
                                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                    Creating Model...
                                  </>
                                ) : (
                                  <>
                                    <TrendingUp className="mr-1 h-3 w-3" />
                                    Use Global Equity Model
                                  </>
                                )}
                              </Button>
                            )}
                          </div>

                          {/* Custom Model Option */}
                          <div
                            className={`border-2 rounded-lg p-3 ${
                              isDisabled ? 'border-gray-200 bg-gray-50/50' : 'border-gray-200'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <Plus
                                className={`h-4 w-4 ${isDisabled ? 'text-gray-400' : 'text-gray-600'}`}
                              />
                              <h5
                                className={`font-medium ${isDisabled ? 'text-gray-500' : 'text-gray-900'}`}
                              >
                                Custom Model
                              </h5>
                            </div>
                            <p
                              className={`text-xs mb-3 ${isDisabled ? 'text-gray-500' : 'text-gray-600'}`}
                            >
                              Create your own model with custom sleeves and allocations
                            </p>
                            <div className="space-y-2">
                              <p
                                className={`text-xs font-medium ${isDisabled ? 'text-gray-500' : 'text-gray-700'}`}
                              >
                                How to create a custom model:
                              </p>
                              <ol
                                className={`text-xs space-y-1 ml-3 list-decimal ${isDisabled ? 'text-gray-400' : 'text-gray-600'}`}
                              >
                                <li>Go to Sleeves page to create sleeves</li>
                                <li>Go to Models page to create your model</li>
                                <li>Add your sleeves with target allocations</li>
                              </ol>
                              <p
                                className={`text-xs mt-2 ${isDisabled ? 'text-gray-400' : 'text-gray-500'}`}
                              >
                                Sleeves group similar securities by industry, sector, or investment
                                style
                              </p>
                            </div>
                            <div className="flex gap-1 mt-3">
                              {isDisabled ? (
                                <>
                                  <SimpleTooltip content="Complete securities import before creating models">
                                    <Button
                                      variant="outline"
                                      disabled={true}
                                      className="flex-1 text-xs"
                                      size="sm"
                                    >
                                      <Plus className="mr-1 h-3 w-3" />
                                      Create Sleeves
                                    </Button>
                                  </SimpleTooltip>
                                  <SimpleTooltip content="Complete securities import before creating models">
                                    <Button
                                      variant="outline"
                                      disabled={true}
                                      className="flex-1 text-xs"
                                      size="sm"
                                    >
                                      <Layers className="mr-1 h-3 w-3" />
                                      Create Model
                                    </Button>
                                  </SimpleTooltip>
                                </>
                              ) : (
                                <>
                                  <Button
                                    onClick={() => window.open('/sleeves', '_blank')}
                                    variant="outline"
                                    className="flex-1 text-xs"
                                    size="sm"
                                  >
                                    <Plus className="mr-1 h-3 w-3" />
                                    Create Sleeves
                                  </Button>
                                  <Button
                                    onClick={() => window.open('/models', '_blank')}
                                    variant="outline"
                                    className="flex-1 text-xs"
                                    size="sm"
                                  >
                                    <Layers className="mr-1 h-3 w-3" />
                                    Create Model
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  if (!task.completed && task.id === 'create-rebalancing-group') {
                    return (
                      <div className="mt-3">
                        {(() => {
                          const hasSchwabConnection = isConnected;
                          const hasModels = reactiveModelsStatus?.hasModels || false;
                          const isDisabled = !hasSchwabConnection || !hasModels;

                          let tooltipMessage = '';
                          if (!hasSchwabConnection && !hasModels) {
                            tooltipMessage =
                              'In order to create a rebalancing group, you must first connect to Schwab and create a model';
                          } else if (!hasSchwabConnection) {
                            tooltipMessage =
                              'In order to create a rebalancing group, you must first connect to Schwab';
                          } else if (!hasModels) {
                            tooltipMessage =
                              'In order to create a rebalancing group, you must first create a model';
                          }

                          if (isDisabled) {
                            return (
                              <SimpleTooltip content={tooltipMessage} cursor="not-allowed">
                                <Button size="sm" disabled={true} className="text-xs">
                                  Create Rebalancing Group
                                </Button>
                              </SimpleTooltip>
                            );
                          }

                          return (
                            <Button
                              size="sm"
                              onClick={() => {
                                navigate({
                                  to: '/rebalancing-groups',
                                  search: { createGroup: 'true' },
                                });
                              }}
                              className="text-xs"
                            >
                              Create Rebalancing Group
                            </Button>
                          );
                        })()}
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
