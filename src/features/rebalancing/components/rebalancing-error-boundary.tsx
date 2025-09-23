import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  feature: string;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class RebalancingErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error with feature context
    console.error(`[RebalancingErrorBoundary] Error in feature "${this.props.feature}":`, {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      feature: this.props.feature,
      timestamp: new Date().toISOString(),
    });

    // In a real app, you might send this to an error reporting service
    // logError(error, {
    //   feature: this.props.feature,
    //   component: 'RebalancingErrorBoundary',
    //   errorInfo,
    //   userId: 'current-user-id', // Would get from auth context
    // });
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback or default error UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="p-6 border border-red-200 rounded-lg bg-red-50">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-red-400"
                viewBox="0 0 20 20"
                fill="currentColor"
                role="img"
                aria-label="Error icon"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-medium text-red-800">{this.props.feature} Error</h3>
              <p className="text-sm text-red-700 mt-1">
                Something went wrong in the {this.props.feature} feature. Please try refreshing the
                page.
              </p>
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="mt-2">
                  <summary className="text-xs text-red-600 cursor-pointer">
                    Error details (development only)
                  </summary>
                  <pre className="text-xs text-red-500 mt-1 whitespace-pre-wrap">
                    {this.state.error.message}
                    {this.state.error.stack}
                  </pre>
                </details>
              )}
            </div>
          </div>
          <div className="mt-4">
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, error: undefined })}
              className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Convenience wrapper for common rebalancing features
export function SleeveAllocationErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <RebalancingErrorBoundary feature="Sleeve Allocation">{children}</RebalancingErrorBoundary>
  );
}

export function ChartsErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <RebalancingErrorBoundary feature="Charts & Analytics">{children}</RebalancingErrorBoundary>
  );
}

export function AccountSummaryErrorBoundary({ children }: { children: ReactNode }) {
  return <RebalancingErrorBoundary feature="Account Summary">{children}</RebalancingErrorBoundary>;
}
