import { createFileRoute } from '@tanstack/react-router';
import { ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';

export const Route = createFileRoute('/demo/schwab-oauth')({
  component: DemoSchwabOAuth,
  validateSearch: (search: Record<string, unknown>) => ({
    client_id: search.client_id as string,
    redirect_uri: search.redirect_uri as string,
    response_type: search.response_type as string,
    scope: search.scope as string,
  }),
});

function DemoSchwabOAuth() {
  const { client_id, redirect_uri, response_type, scope } = Route.useSearch();
  const [isAuthorizing, setIsAuthorizing] = useState(false);

  console.log('🎭 [DemoOAuth] Demo Schwab OAuth page loaded');
  console.log('📋 [DemoOAuth] OAuth parameters received');

  const handleAuthorize = () => {
    console.log('✅ [DemoOAuth] User authorized demo OAuth');
    setIsAuthorizing(true);

    // Generate a demo authorization code
    const demoCode = `demo_auth_code_${Date.now()}`;
    console.log('🎫 [DemoOAuth] Demo authorization code generated');

    // Redirect back to the callback URL with the demo code
    const separator = redirect_uri.includes('?') ? '&' : '?';
    const callbackUrl = `${redirect_uri}${separator}code=${demoCode}&state=demo_state`;

    console.log('🔄 [DemoOAuth] Redirecting to callback');

    setTimeout(() => {
      window.location.href = callbackUrl;
    }, 1000);
  };

  const handleDeny = () => {
    console.log('❌ [DemoOAuth] User denied demo OAuth');

    // Redirect back with error
    const separator = redirect_uri.includes('?') ? '&' : '?';
    const callbackUrl = `${redirect_uri}${separator}error=access_denied&error_description=User+denied+authorization`;

    console.log('🔄 [DemoOAuth] Redirecting to callback with error');
    window.location.href = callbackUrl;
  };

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-md mx-auto">
        <Card>
          <CardHeader className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <ExternalLink className="h-6 w-6 text-blue-600" />
              <CardTitle className="text-xl">Demo Schwab Authorization</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground">
              This is a demo OAuth flow for testing purposes
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="font-medium">Application:</span>
                <span>Rebalancer (Demo)</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Permissions:</span>
                <span>Read account data</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Callback:</span>
                <span className="truncate max-w-32" title={redirect_uri}>
                  {redirect_uri ? redirect_uri.split('/')[2] : 'N/A'}
                </span>
              </div>
            </div>

            <div className="border-t pt-4">
              <p className="text-sm text-muted-foreground mb-4">
                Would you like to authorize this demo application to access your simulated Schwab
                account data?
              </p>

              <div className="flex gap-2">
                <Button onClick={handleAuthorize} disabled={isAuthorizing} className="flex-1">
                  {isAuthorizing ? 'Authorizing...' : 'Authorize'}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDeny}
                  disabled={isAuthorizing}
                  className="flex-1"
                >
                  Deny
                </Button>
              </div>
            </div>

            <div className="text-xs text-muted-foreground text-center">
              ⚠️ This is a demo environment. No real Schwab account will be accessed.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
