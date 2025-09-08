import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { handleSchwabOAuthCallbackServerFn } from "../../lib/server-functions";

export const Route = createFileRoute("/schwab/callback")({
  component: SchwabCallbackPage,
  validateSearch: (search: Record<string, unknown>) => ({
    code: search.code as string,
    state: search.state as string,
    error: search.error as string,
  }),
});

function SchwabCallbackPage() {
  const router = useRouter();
  const { code, state, error } = Route.useSearch();
  const [isProcessing, setIsProcessing] = useState(true);
  const [callbackError, setCallbackError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const processCallback = async () => {
      if (error) {
        setCallbackError(`Schwab OAuth error: ${error}`);
        setIsProcessing(false);
        return;
      }
      if (!code) {
        setCallbackError("Authorization code not found in the callback");
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
          router.navigate({ to: "/data-feeds" });
        }, 2000);
      } catch (err) {
        setCallbackError(err instanceof Error ? err.message : "Failed to connect to Schwab");
        setIsProcessing(false);
      }
    };

    processCallback();
  }, [code, state, error, router]);

  const handleRetry = () => router.navigate({ to: "/data-feeds" });

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-md mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-center">
              {isProcessing && "Connecting to Schwab..."}
              {success && "Successfully Connected!"}
              {callbackError && "Connection Failed"}
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
                  Your Schwab account has been successfully connected. You can now sync your accounts and holdings.
                </p>
                <p className="text-xs text-muted-foreground">Redirecting you back to the integration page...</p>
              </div>
            )}

            {callbackError && (
              <div className="space-y-3">
                <AlertCircle className="h-8 w-8 mx-auto text-red-500" />
                <p className="text-sm text-red-600 font-medium">{callbackError}</p>
                <p className="text-xs text-muted-foreground">Please try connecting again or contact support if the issue persists.</p>
                <Button onClick={handleRetry} className="w-full">Back to Integration</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}