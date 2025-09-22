import { createFileRoute, useRouter } from '@tanstack/react-router';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { handleSchwabOAuthCallbackServerFn } from '~/lib/server-functions';

export const Route = createFileRoute('/schwab/callback')({
  component: SchwabCallbackPage,
  validateSearch: (search: Record<string, unknown>) => ({
    code: search.code as string,
    state: search.state as string,
    error: search.error as string,
  }),
});

// Helper function to safely access sessionStorage
const getFromSessionStorage = (key: string, defaultValue: string = ''): string => {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return defaultValue;
  }
  return window.sessionStorage.getItem(key) || defaultValue;
};

// Helper function to safely remove from sessionStorage
const removeFromSessionStorage = (key: string): void => {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return;
  }
  window.sessionStorage.removeItem(key);
};

function SchwabCallbackPage() {
  const router = useRouter();
  const { code, state, error } = Route.useSearch();
  const [isProcessing, setIsProcessing] = useState(true);
  const [callbackError, setCallbackError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const hasProcessedRef = useRef(false);

  // Get return URL from sessionStorage
  const returnUrl = getFromSessionStorage('schwabReturnUrl', '/');

  useEffect(() => {
    // Prevent multiple processing of the same OAuth callback
    if (hasProcessedRef.current) {
      console.log('🔄 [Callback] OAuth callback already processed, skipping');
      return;
    }

    const processCallback = async () => {
      // Mark as processed to prevent duplicate calls
      hasProcessedRef.current = true;

      // Validate OAuth state parameter to prevent token interception attacks
      const storedState = getFromSessionStorage('schwab_oauth_state');
      if (storedState && state && storedState !== state) {
        setCallbackError('Invalid OAuth state parameter - security validation failed');
        setIsProcessing(false);
        return;
      }

      if (error) {
        removeFromSessionStorage('schwabReturnUrl');
        setCallbackError(`Schwab OAuth error: ${error}`);
        setIsProcessing(false);
        return;
      }
      if (!code) {
        removeFromSessionStorage('schwabReturnUrl');
        setCallbackError('Authorization code not found in the callback');
        setIsProcessing(false);
        return;
      }
      try {
        // Ensure HTTPS for Schwab OAuth (required by Schwab)
        let redirectUri = `${window.location.origin}/schwab/callback`;
        if (window.location.hostname === 'localhost' && !redirectUri.startsWith('https:')) {
          redirectUri = redirectUri.replace('http:', 'https:');
        }

        await handleSchwabOAuthCallbackServerFn({
          data: { code, redirectUri },
        });

        setSuccess(true);
        setIsProcessing(false);
        setTimeout(() => {
          // Determine where to redirect based on returnUrl, default to home page
          const redirectTo = returnUrl === '/data-feeds' ? '/data-feeds' : '/';
          console.log('🔄 [Callback] Redirecting to:', redirectTo);

          // Clean up sessionStorage
          removeFromSessionStorage('schwabReturnUrl');
          removeFromSessionStorage('schwab_oauth_state');

          // Redirect with safe indicator that OAuth was just completed
          // Components can detect this to trigger post-connection actions
          router.navigate({
            to: redirectTo,
            search: { schwabConnected: 'true' },
          });
        }, 2000);
      } catch (err) {
        // Clean up sessionStorage on error
        removeFromSessionStorage('schwabReturnUrl');
        removeFromSessionStorage('schwab_oauth_state');
        setCallbackError(err instanceof Error ? err.message : 'Failed to connect to Schwab');
        setIsProcessing(false);
      }
    };

    processCallback();
  }, [code, state, error, returnUrl, router]);

  const handleRetry = () => {
    const redirectTo = returnUrl === '/data-feeds' ? '/data-feeds' : '/';
    removeFromSessionStorage('schwabReturnUrl');
    removeFromSessionStorage('schwab_oauth_state');
    router.navigate({ to: redirectTo });
  };

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-md mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-center">
              {isProcessing && 'Connecting to Schwab...'}
              {success && 'Successfully Connected!'}
              {callbackError && 'Connection Failed'}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            {isProcessing && (
              <div className="space-y-3">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-500" />
                <p className="text-sm text-muted-foreground">
                  Please wait while we establish a secure connection with your Schwab account...
                </p>
              </div>
            )}

            {success && (
              <div className="space-y-3">
                <CheckCircle className="h-8 w-8 mx-auto text-green-500" />
                <p className="text-sm text-muted-foreground">
                  Your Schwab account has been successfully connected. You can now sync your
                  accounts and holdings.
                </p>
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Redirecting you back to the dashboard...
                </div>
              </div>
            )}

            {callbackError && (
              <div className="space-y-3">
                <AlertCircle className="h-8 w-8 mx-auto text-red-500" />
                <p className="text-sm text-red-600 font-medium">{callbackError}</p>
                <p className="text-xs text-muted-foreground">
                  Please try connecting again or contact support if the issue persists.
                </p>
                <Button onClick={handleRetry} className="w-full">
                  Back to Dashboard
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
