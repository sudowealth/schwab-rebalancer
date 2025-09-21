import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { AlertTriangle, Database, Trash2 } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { truncateDataServerFn, verifyAdminAccessServerFn } from '~/lib/server-functions';

export const Route = createFileRoute('/admin/')({
  component: AdminDashboardIndex,
  loader: async () => {
    try {
      // Server-side admin verification
      const result = await verifyAdminAccessServerFn();
      return result;
    } catch (error) {
      // If not admin or not authenticated, redirect
      if (error instanceof Error) {
        if (error.message.includes('Admin access required')) {
          throw redirect({ to: '/' }); // Regular users go to dashboard
        }
        if (error.message.includes('Authentication required')) {
          throw redirect({ to: '/login', search: { reset: '', redirect: '/' } });
        }
      }
      throw error;
    }
  },
});

function AdminDashboardIndex() {
  // Route is already protected by server-side loader
  const queryClient = useQueryClient();
  const confirmTextId = useId();
  const [showTruncateModal, setShowTruncateModal] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [isTruncating, setIsTruncating] = useState(false);
  const [truncateResult, setTruncateResult] = useState<{
    success: boolean;
    message: string;
    truncatedTables?: number;
    failedTables?: number;
    totalTables?: number;
    failedTableNames?: string[];
    invalidateAllCaches?: boolean;
  } | null>(null);

  // Auto-dismiss the truncate result message after 10 seconds
  useEffect(() => {
    if (truncateResult) {
      const timer = setTimeout(() => {
        setTruncateResult(null);
      }, 10000); // 10 seconds

      return () => clearTimeout(timer);
    }
  }, [truncateResult]);

  const handleTruncateData = async () => {
    if (confirmText !== 'TRUNCATE_ALL_DATA') {
      return;
    }

    setIsTruncating(true);
    try {
      const result = await truncateDataServerFn({ data: { confirmText } });
      setTruncateResult(result);

      // Invalidate all React Query caches if requested by server
      if (result.invalidateAllCaches) {
        console.log('🔄 Invalidating all React Query caches after data truncation');
        queryClient.invalidateQueries();
      }

      setShowTruncateModal(false);
      setConfirmText('');
    } catch (error) {
      setTruncateResult({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to truncate data',
      });
    } finally {
      setIsTruncating(false);
    }
  };

  return (
    <div className="px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="mt-2 text-sm text-gray-600">Administrative controls and system management</p>
      </div>

      {/* Show truncate result if any */}
      {truncateResult && (
        <Alert
          className={`mb-6 ${truncateResult.success ? 'border-green-200 bg-green-50' : 'border-yellow-200 bg-yellow-50'}`}
        >
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{truncateResult.success ? 'Success' : 'Partial Success'}</AlertTitle>
          <AlertDescription>
            <div className="space-y-2">
              <p>{truncateResult.message}</p>
              {truncateResult.totalTables && truncateResult.failedTables !== undefined && (
                <div className="text-sm">
                  <p>
                    <strong>Results:</strong> {truncateResult.truncatedTables} of{' '}
                    {truncateResult.totalTables} tables truncated successfully
                    {truncateResult.failedTables > 0 && (
                      <>
                        , {truncateResult.failedTables} failed
                        {truncateResult.failedTableNames &&
                          truncateResult.failedTableNames.length > 0 && (
                            <span className="block mt-1 text-xs text-gray-600">
                              Failed tables: {truncateResult.failedTableNames.join(', ')}
                            </span>
                          )}
                      </>
                    )}
                  </p>
                </div>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AdminCard
          title="User Management"
          description="Manage users and their roles"
          href="/admin/users"
        />

        <AdminCard
          title="System Statistics"
          description="View system-wide statistics"
          href="/admin/stats"
        />

        <AdminCard
          title="Truncate Data"
          description="Reset all financial data for testing"
          onClick={() => setShowTruncateModal(true)}
          destructive
        />
      </div>

      {/* Truncate Data Confirmation Modal */}
      {showTruncateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center mb-4">
                <AlertTriangle className="h-6 w-6 text-red-500 mr-3" />
                <h3 className="text-lg font-medium text-gray-900">Danger Zone</h3>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-4">
                  This will permanently delete ALL financial data from the system, including:
                </p>
                <ul className="text-sm text-gray-600 list-disc list-inside space-y-1 mb-4">
                  <li>All securities and price data</li>
                  <li>All accounts, holdings, and transactions</li>
                  <li>All sleeves, models, and rebalancing groups</li>
                  <li>All Schwab import data and credentials</li>
                  <li>All financial plans and tax brackets</li>
                  <li>All trading orders and executions</li>
                </ul>
                <p className="text-sm text-gray-600">
                  <strong>User accounts, authentication, and audit logs will be preserved.</strong>
                </p>
              </div>

              <div className="mb-4">
                <Label htmlFor={confirmTextId} className="text-sm font-medium text-gray-700">
                  Type{' '}
                  <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">TRUNCATE_ALL_DATA</code>{' '}
                  to confirm:
                </Label>
                <Input
                  id={confirmTextId}
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="TRUNCATE_ALL_DATA"
                  className="mt-1"
                />
              </div>

              <div className="flex justify-end space-x-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowTruncateModal(false);
                    setConfirmText('');
                  }}
                  disabled={isTruncating}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleTruncateData}
                  disabled={isTruncating || confirmText !== 'TRUNCATE_ALL_DATA'}
                >
                  {isTruncating ? (
                    <>
                      <Database className="h-4 w-4 mr-2 animate-spin" />
                      Truncating...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Truncate All Data
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminCard({
  title,
  description,
  href,
  onClick,
  destructive,
}: {
  title: string;
  description: string;
  href?: string;
  onClick?: () => void;
  destructive?: boolean;
}) {
  const cardClasses = `block p-6 bg-white rounded-lg shadow hover:shadow-lg transition-shadow border cursor-pointer ${
    destructive ? 'border-red-200 hover:border-red-300' : 'border-gray-200'
  }`;

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cardClasses}>
        <div className="flex items-start justify-between">
          <div>
            <h3
              className={`text-left text-lg leading-6 font-medium mb-2 ${
                destructive ? 'text-red-900' : 'text-gray-900'
              }`}
            >
              {title}
            </h3>
            <p className={`text-sm ${destructive ? 'text-red-600' : 'text-gray-600'}`}>
              {description}
            </p>
          </div>
          {destructive && <Trash2 className="h-5 w-5 text-red-500 flex-shrink-0 ml-2" />}
        </div>
      </button>
    );
  }

  return (
    <a href={href} className={cardClasses}>
      <h3 className="text-left text-lg leading-6 font-medium text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </a>
  );
}
