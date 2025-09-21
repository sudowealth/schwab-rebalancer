import { createFileRoute } from '@tanstack/react-router';
import { useEffect } from 'react';
import { SeedDataSection } from '~/features/data-feeds/components/SeedDataSection';
import { SyncHistory } from '~/features/data-feeds/components/SyncHistory';
import { YahooIntegration } from '~/features/data-feeds/components/YahooIntegration';
import { SchwabIntegration } from '~/features/schwab/components/SchwabIntegration';
import { authGuard } from '~/lib/route-guards';

export const Route = createFileRoute('/data-feeds/')({
  component: DataFeedsPage,
  beforeLoad: authGuard,
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
