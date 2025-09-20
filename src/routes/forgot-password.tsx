import { useForm } from '@tanstack/react-form';
import { createFileRoute } from '@tanstack/react-router';
import { useId, useState } from 'react';
import { ClientOnly } from '~/components/ClientOnly';
import { authClient } from '~/features/auth/auth-client';

export const Route = createFileRoute('/forgot-password')({
  component: ForgotPasswordPage,
  validateSearch: (search) => ({
    email: typeof search.email === 'string' ? search.email : '',
  }),
});

function ForgotPasswordPage() {
  const { email: emailFromQuery } = Route.useSearch();
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [error, setError] = useState('');
  const emailId = useId();

  const form = useForm({
    defaultValues: {
      email: emailFromQuery,
    },
    onSubmit: async ({ value }) => {
      setError('');
      setSubmittedEmail(value.email);

      try {
        await authClient.forgetPassword({
          email: value.email,
          redirectTo: 'http://localhost:3000/reset-password',
        });
        setIsSubmitted(true);
      } catch {
        setError('Failed to send reset email. Please try again.');
      }
    },
  });

  if (isSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Check your email</h2>
            <p className="mt-2 text-sm text-gray-600">
              We've sent a password reset link to <strong>{submittedEmail}</strong>
            </p>
            <p className="mt-4 text-sm text-gray-500">
              Check your console in development mode to see the reset link.
            </p>
          </div>
          <div className="text-center">
            <a href="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
              Back to sign in
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Forgot your password?
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Enter your email address and we'll send you a link to reset your password.
          </p>
        </div>
        <ClientOnly
          fallback={
            <div className="mt-8 space-y-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto"></div>
              <div className="space-y-4">
                <div className="h-10 bg-gray-200 rounded"></div>
                <div className="h-10 bg-gray-200 rounded"></div>
              </div>
            </div>
          }
        >
          <form
            className="mt-8 space-y-6"
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
          >
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}
            <form.Field
              name="email"
              validators={{
                onChange: ({ value }) => {
                  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                  if (!value) return 'Email is required';
                  if (!emailRegex.test(value)) return 'Please enter a valid email address';
                  return undefined;
                },
              }}
            >
              {(field) => (
                <div>
                  <label htmlFor={emailId} className="sr-only">
                    Email address
                  </label>
                  <input
                    id={emailId}
                    name={field.name}
                    type="email"
                    required
                    autoComplete="email"
                    className={`relative block w-full px-3 py-2 bg-white border placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:z-10 sm:text-sm ${
                      field.state.meta.errors.length > 0
                        ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                        : 'border-gray-300 focus:ring-indigo-500 focus:border-indigo-500'
                    }`}
                    placeholder="Email address"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                  />
                  {field.state.meta.errors.length > 0 && (
                    <p className="mt-1 text-sm text-red-600">{field.state.meta.errors[0]}</p>
                  )}
                </div>
              )}
            </form.Field>
            <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
              {([canSubmit, isSubmitting]) => (
                <div>
                  <button
                    type="submit"
                    disabled={!canSubmit}
                    className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Sending...' : 'Send reset link'}
                  </button>
                </div>
              )}
            </form.Subscribe>
            <div className="text-center">
              <a href="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
                Back to sign in
              </a>
            </div>
          </form>
        </ClientOnly>
      </div>
    </div>
  );
}
