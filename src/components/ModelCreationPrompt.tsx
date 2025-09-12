import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle, Layers, Loader2, Plus, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { seedGlobalEquityModelServerFn } from '../lib/server-functions';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

interface SeedGlobalEquityResult {
  success: boolean;
  models: number;
  sleeves: number;
  sleeveMembers: number;
}

interface ModelCreationPromptProps {
  modelsStatus?: {
    hasModels: boolean;
    modelsCount: number;
  };
}

export function ModelCreationPrompt({ modelsStatus }: ModelCreationPromptProps) {
  const queryClient = useQueryClient();
  const [isCompleted, setIsCompleted] = useState(false);

  // Global Equity Model seeding mutation
  const seedGlobalEquityMutation = useMutation({
    mutationFn: seedGlobalEquityModelServerFn,
    onSuccess: (_data: SeedGlobalEquityResult) => {
      setIsCompleted(true);
      // Invalidate all queries to refresh the dashboard
      queryClient.invalidateQueries();
      // Set a timeout to hide the component after success
      setTimeout(() => {
        setIsCompleted(false);
      }, 5000);
    },
    onError: (error) => {
      console.error('Error seeding Global Equity Model:', error);
    },
  });

  // Don't show if models already exist and not completed
  if (modelsStatus?.hasModels && !isCompleted) {
    return null;
  }

  // Don't show if no modelsStatus is provided (shouldn't happen with SSR)
  if (!modelsStatus) {
    return null;
  }

  const handleSeedGlobalEquity = () => {
    seedGlobalEquityMutation.mutate(undefined);
  };

  return (
    <div className="mb-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Create Your Investment Model
          </CardTitle>
          <CardDescription>
            Now that you have securities in your database, you need an investment model to organize
            your portfolio. Choose from our pre-built Global Equity Model or create your own custom
            model.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Global Equity Model Option */}
              <Card className="border-2 border-blue-200 bg-blue-50/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Global Equity Model
                  </CardTitle>
                  <CardDescription>
                    Pre-built model with geographic diversification across US, International, and
                    Emerging markets
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• US Large Cap (40%): VTI</li>
                      <li>• International (20%): VXUS</li>
                      <li>• Emerging Markets (10%): VWO</li>
                      <li>• And more regional ETFs</li>
                    </ul>
                    <Button
                      onClick={handleSeedGlobalEquity}
                      disabled={seedGlobalEquityMutation.isPending}
                      className="w-full"
                      size="sm"
                    >
                      {seedGlobalEquityMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating Model...
                        </>
                      ) : (
                        <>
                          <TrendingUp className="mr-2 h-4 w-4" />
                          Use Global Equity Model
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Custom Model Option */}
              <Card className="border-2 border-gray-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Custom Model
                  </CardTitle>
                  <CardDescription>
                    Create your own model with custom sleeves and allocations
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    <div className="text-sm text-gray-600 space-y-2">
                      <p>
                        <strong>How to create a custom model:</strong>
                      </p>
                      <ol className="list-decimal list-inside space-y-1 ml-2">
                        <li>
                          Go to <strong>Sleeves</strong> page to create sleeves
                        </li>
                        <li>
                          Go to <strong>Models</strong> page to create your model
                        </li>
                        <li>Add your sleeves with target allocations</li>
                      </ol>
                      <p className="text-xs mt-2">
                        Sleeves group similar securities (e.g., by industry, sector, or investment
                        style)
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => window.open('/sleeves', '_blank')}
                        variant="outline"
                        className="flex-1"
                        size="sm"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Create Sleeves
                      </Button>
                      <Button
                        onClick={() => window.open('/models', '_blank')}
                        variant="outline"
                        className="flex-1"
                        size="sm"
                      >
                        <Layers className="mr-2 h-4 w-4" />
                        Create Model
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Success Message */}
            {isCompleted && seedGlobalEquityMutation.data && (
              <div className="flex items-start gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="font-medium text-green-900 mb-2">
                    Global Equity Model created successfully!
                  </h4>
                  <div className="space-y-1 text-sm">
                    <div>
                      <span className="text-green-700">Models created: </span>
                      {seedGlobalEquityMutation.data.models}
                    </div>
                    <div>
                      <span className="text-blue-700">Sleeves created: </span>
                      {seedGlobalEquityMutation.data.sleeves}
                    </div>
                    <div>
                      <span className="text-purple-700">Sleeve members: </span>
                      {seedGlobalEquityMutation.data.sleeveMembers}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Error Message */}
            {seedGlobalEquityMutation.isError && (
              <div className="flex items-start gap-3 p-4 bg-red-50 rounded-lg border border-red-200">
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="font-medium text-red-900 mb-1">
                    Failed to create Global Equity Model
                  </h4>
                  <p className="text-sm text-red-700">
                    There was an error creating the model. Please try again or check the console for
                    details.
                  </p>
                </div>
              </div>
            )}

            {/* Loading State */}
            {seedGlobalEquityMutation.isPending && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Creating Global Equity Model with sleeves and allocations...</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
