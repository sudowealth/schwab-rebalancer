import { AlertTriangle, RefreshCw } from 'lucide-react';
import type { ErrorInfo, ReactNode } from 'react';
import { Component } from 'react';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showDetails?: boolean;
  title?: string;
  description?: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    this.setState({
      error,
      errorInfo,
    });

    // Call optional error handler
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <Card className="w-full max-w-2xl mx-auto my-8">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <CardTitle className="text-destructive">
                {this.props.title || 'Something went wrong'}
              </CardTitle>
            </div>
            <CardDescription>
              {this.props.description ||
                'An unexpected error occurred. Please try again or contact support if the problem persists.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button onClick={this.handleRetry} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
              <Button onClick={() => window.location.reload()} variant="outline" size="sm">
                Reload Page
              </Button>
            </div>

            {this.props.showDetails && this.state.error && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                  Error Details (for debugging)
                </summary>
                <pre className="mt-2 p-4 bg-muted rounded-md text-xs overflow-auto max-h-64">
                  <code>
                    {this.state.error.toString()}
                    {this.state.errorInfo?.componentStack && (
                      <>
                        {'\n\nComponent Stack:'}
                        {this.state.errorInfo.componentStack}
                      </>
                    )}
                  </code>
                </pre>
              </details>
            )}
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

// Functional component wrapper for easier usage with hooks
interface ErrorBoundaryWrapperProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showDetails?: boolean;
  title?: string;
  description?: string;
}

export function ErrorBoundaryWrapper({
  children,
  fallback,
  onError,
  showDetails = false,
  title,
  description,
}: ErrorBoundaryWrapperProps) {
  return (
    <ErrorBoundary
      fallback={fallback}
      onError={onError}
      showDetails={showDetails}
      title={title}
      description={description}
    >
      {children}
    </ErrorBoundary>
  );
}

// Hook for error reporting (can be extended with error reporting services)
export function useErrorReporting() {
  const reportError = (error: Error, context?: string) => {
    console.error(`Error in ${context || 'unknown context'}:`, error);

    // TODO: Send to error reporting service (Sentry, etc.)
    // Example: Sentry.captureException(error, { tags: { context } });
  };

  return { reportError };
}

// Higher-order component for wrapping features with consistent error boundaries
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  options: {
    title?: string;
    description?: string;
    showDetails?: boolean;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
  } = {},
) {
  const {
    title = 'Feature Error',
    description = 'Something went wrong with this feature. Please try again.',
    showDetails = false,
    onError,
  } = options;

  const WrappedComponent = (props: P) => (
    <ErrorBoundaryWrapper
      title={title}
      description={description}
      showDetails={showDetails}
      onError={onError}
    >
      <Component {...props} />
    </ErrorBoundaryWrapper>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
}

// Feature-specific error boundary HOCs for common patterns
export const withDashboardErrorBoundary = <P extends object>(Component: React.ComponentType<P>) =>
  withErrorBoundary(Component, {
    title: 'Dashboard Error',
    description: 'Failed to load dashboard data. This might be due to a temporary data issue.',
  });

export const withModelErrorBoundary = <P extends object>(Component: React.ComponentType<P>) =>
  withErrorBoundary(Component, {
    title: 'Model Error',
    description: 'Failed to load model data. This might be due to a temporary data issue.',
  });

export const withRebalancingErrorBoundary = <P extends object>(Component: React.ComponentType<P>) =>
  withErrorBoundary(Component, {
    title: 'Rebalancing Error',
    description: 'Failed to load rebalancing data. This might be due to a temporary data issue.',
  });

export const withDataFeedsErrorBoundary = <P extends object>(Component: React.ComponentType<P>) =>
  withErrorBoundary(Component, {
    title: 'Data Feeds Error',
    description: 'Failed to load data feeds. This might be due to a temporary connection issue.',
  });

export const withAdminErrorBoundary = <P extends object>(Component: React.ComponentType<P>) =>
  withErrorBoundary(Component, {
    title: 'Admin Error',
    description:
      'Failed to load admin functionality. This might be due to a temporary system issue.',
    showDetails: true, // Show more details for admin features
  });
