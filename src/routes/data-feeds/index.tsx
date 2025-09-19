import { createFileRoute, redirect } from '@tanstack/react-router';
import { useEffect } from 'react';
import { SchwabIntegration } from '../../components/SchwabIntegration';
import { SeedDataSection } from '../../components/SeedDataSection';
import { SyncHistory } from '../../components/SyncHistory';
import { YahooIntegration } from '../../components/YahooIntegration';
import { ensureAuthenticatedServerFn } from '../../lib/server-functions';

export const Route = createFileRoute('/data-feeds/')({
  component: DataFeedsPage,
  loader: async () => {
    try {
      // Use consistent authentication pattern
      const { user } = await ensureAuthenticatedServerFn();
      return { user };
    } catch (error) {
      // If authentication error, redirect to login
      if (error instanceof Error && error.message.includes('Authentication required')) {
        throw redirect({ to: '/login', search: { reset: '', redirect: '/data-feeds' } });
      }
      // Re-throw other errors
      throw error;
    }
  },
});

function DataFeedsPage() {
  // Clean up OAuth callback parameters from URL if present
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const hasOAuthCallback = urlParams.has('code') && urlParams.has('state');

    if (hasOAuthCallback) {
      console.log('🔄 [Data Feeds] Detected Schwab OAuth callback, cleaning up URL parameters...');
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, []);

  return (
    <div className="px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Data Feeds</h1>
            <p className="mt-2 text-sm text-gray-600">
              Manage data feed integrations and update securities.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-8">
        <section>
          <SeedDataSection />
        </section>

        <section>
          <SchwabIntegration />
        </section>

        <section>
          <YahooIntegration />
        </section>

        <section>
          <SyncHistory />
        </section>
      </div>
    </div>
  );
}
