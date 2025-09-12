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
  RotateCcw,
  Users,
} from 'lucide-react';
import { useSchwabConnection } from '../hooks/useSchwabConnection';
import { useSecuritiesSeeding } from '../hooks/useSecuritiesSeeding';
import { checkSecuritiesExistServerFn } from '../lib/server-functions';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
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
  modelsStatus?: { hasModels: boolean; modelsCount: number };
  rebalancingGroupsStatus?: { hasGroups: boolean; groupsCount: number };
  rebalancingRunsStatus?: { hasRuns: boolean; runsCount: number };
  proposedTradesStatus?: { hasTrades: boolean; tradesCount: number };
}

export function OnboardingTracker({
  schwabCredentialsStatus,
  modelsStatus,
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

  // Use the securities seeding hook for managing securities import state
  const { isSeeding, hasError, seedResult, showSuccessMessage } =
    useSecuritiesSeeding(reactiveSecuritiesStatus);

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
      completed: modelsStatus?.hasModels || false,
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

  // Show sync progress if currently syncing Schwab data
  if (isSyncing) {
    return (
      <div className="mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link className="h-5 w-5" />
              Setting up Your Schwab Data
            </CardTitle>
            <CardDescription>
              We're importing your accounts, holdings, and price data from Schwab
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200 w-full">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600 flex-shrink-0" />
                <div>
                  <h4 className="font-medium text-blue-900 mb-1">Sync in Progress</h4>
                  <p className="text-sm text-blue-700">{syncStep || 'Preparing your data...'}</p>
                  <p className="text-xs text-blue-600 mt-1">This may take a few moments</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="flex items-center gap-2">Get Started</div>
            <div className="ml-auto text-sm text-gray-500">
              {completedTasks} of {totalTasks} complete
            </div>
          </CardTitle>
          <CardDescription>
            Complete these steps to start rebalancing your portfolio at Schwab
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {tasks.map((task, index) => {
              const Icon = task.icon;
              return (
                <div
                  key={task.id}
                  className={`flex items-start gap-4 p-4 rounded-lg border ${
                    task.completed ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
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
                        className={`font-medium ${
                          task.completed ? 'text-green-900' : 'text-gray-900'
                        }`}
                      >
                        {index + 1}. {task.title}
                      </h4>
                    </div>
                    <p className={`text-sm ${task.completed ? 'text-green-700' : 'text-gray-600'}`}>
                      {task.description}
                    </p>
                    {!task.completed && task.id === 'connect-schwab' && (
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
                    )}
                    {!task.completed && task.id === 'securities-import' && (
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
                    )}
                    {!task.completed && task.id === 'create-rebalancing-group' && (
                      <div className="mt-3">
                        {(() => {
                          const hasSchwabConnection = isConnected;
                          const hasModels = modelsStatus?.hasModels || false;
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
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
