import { useNavigate } from '@tanstack/react-router';
import { CheckCircle, Circle, Database, Eye, Layers, Link, RotateCcw, Users } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

interface OnboardingTask {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  icon: React.ComponentType<{ className?: string }>;
}

interface OnboardingTrackerProps {
  securitiesStatus?: { hasSecurities: boolean; securitiesCount: number };
  schwabCredentialsStatus?: { hasCredentials: boolean };
  modelsStatus?: { hasModels: boolean; modelsCount: number };
  rebalancingGroupsStatus?: { hasGroups: boolean; groupsCount: number };
  rebalancingRunsStatus?: { hasRuns: boolean; runsCount: number };
  proposedTradesStatus?: { hasTrades: boolean; tradesCount: number };
}

export function OnboardingTracker({
  securitiesStatus,
  schwabCredentialsStatus,
  modelsStatus,
  rebalancingGroupsStatus,
  rebalancingRunsStatus,
  proposedTradesStatus,
}: OnboardingTrackerProps) {
  const navigate = useNavigate();
  const tasks: OnboardingTask[] = [
    {
      id: 'securities-import',
      title: 'Securities Import (Automatic)',
      description: 'Import stock and ETF data from NASDAQ feeds',
      completed: securitiesStatus?.hasSecurities || false,
      icon: Database,
    },
    {
      id: 'connect-schwab',
      title: 'Connect to Schwab',
      description: 'Link your Charles Schwab accounts for automatic data import',
      completed: schwabCredentialsStatus?.hasCredentials || false,
      icon: Link,
    },
    {
      id: 'create-model',
      title: 'Create Investment Model',
      description: 'Build or use a pre-built investment model for your portfolio',
      completed: modelsStatus?.hasModels || false,
      icon: Layers,
    },
    {
      id: 'create-rebalancing-group',
      title: 'Create Rebalancing Group',
      description: 'Group your accounts together for portfolio rebalancing',
      completed: rebalancingGroupsStatus?.hasGroups || false,
      icon: Users,
    },
    {
      id: 'run-first-rebalance',
      title: 'Run your first Rebalance',
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
                    {!task.completed && task.id === 'create-rebalancing-group' && (
                      <div className="mt-3">
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
