import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ErrorBoundaryWrapper } from '~/components/ErrorBoundary';
import { ToastProvider } from '~/components/ui/toast';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes for better performance
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors
        if (error instanceof Error && 'status' in error && typeof error.status === 'number') {
          if (error.status >= 400 && error.status < 500) {
            return false;
          }
        }
        return failureCount < 3;
      },
    },
  },
});

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundaryWrapper
      title="Application Error"
      description="An unexpected error occurred in the application. Please refresh the page to try again."
      showDetails={process.env.NODE_ENV === 'development'}
    >
      <QueryClientProvider client={queryClient}>
        <ToastProvider>{children}</ToastProvider>
      </QueryClientProvider>
    </ErrorBoundaryWrapper>
  );
}
