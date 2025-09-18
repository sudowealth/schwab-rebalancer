import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useId, useState } from 'react';
import { signIn, useSession } from '../lib/auth-client';

export const Route = createFileRoute('/login')({
  component: LoginPage,
  validateSearch: (search) => ({
    reset: typeof search.reset === 'string' ? search.reset : '',
    redirect: typeof search.redirect === 'string' ? search.redirect : '',
  }),
});

function LoginPage() {
  const { reset } = Route.useSearch();
  const { data: session } = useSession();
  const [email, setEmail] = useState(() => (import.meta.env.DEV ? '' : ''));
  const [password, setPassword] = useState(() => (import.meta.env.DEV ? '' : ''));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [validationErrors, setValidationErrors] = useState({
    email: '',
    password: '',
  });
  const emailId = useId();
  const passwordId = useId();

  useEffect(() => {
    if (reset === 'success') {
      setSuccessMessage('Password reset successful! Please sign in with your new password.');
      setPassword('');
    } else {
      setSuccessMessage('');
    }
  }, [reset]);

  useEffect(() => {
    if (session?.user) {
      window.location.href = '/';
    }
  }, [session]);

  if (session?.user) {
    return null;
  }

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) return 'Email is required';
    if (!emailRegex.test(email)) return 'Please enter a valid email address';
    return '';
  };

  const validatePassword = (password: string) => {
    if (!password) return 'Password is required';
    if (password.length < 8) return 'Password must be at least 8 characters long';
    if (password.length > 128) return 'Password must be less than 128 characters';
    return '';
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    setValidationErrors((prev) => ({
      ...prev,
      email: validateEmail(value),
    }));
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    setValidationErrors((prev) => ({
      ...prev,
      password: validatePassword(value),
    }));
  };

  const isFormValid = () => {
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);

    setValidationErrors({
      email: emailError,
      password: passwordError,
    });

    return !emailError && !passwordError;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isFormValid()) {
      return;
    }

    setIsLoading(true);

    try {
      console.log('🔄 Attempting sign-in with:', { email, password: '***' });

      const { data, error } = await signIn.email(
        {
          email,
          password,
          rememberMe: true,
        },
        {
          onSuccess: () => {
            console.log('✅ onSuccess callback triggered');
          },
          onError: (ctx) => {
            console.error('❌ onError callback:', ctx.error);
          },
        },
      );

      console.log('🔍 Sign-in response:', { data, error });

      // Check if there's an error
      if (error) {
        console.error('❌ Sign-in error:', error);
        setIsLoading(false);

        if (error.status === 403) {
          setError('Please verify your email address before signing in.');
        } else if (error.status === 401) {
          setError('Invalid email or password. Please check your credentials and try again.');
        } else {
          setError(error.message || 'Sign-in failed. Please try again.');
        }
        return;
      }

      // If we have data, sign-in was successful
      if (data) {
        console.log('✅ Sign-in successful!', data);

        // Force refresh session to make sure it's available
        try {
          const { getSession } = await import('../lib/auth-client');
          const session = await getSession();
          console.log('🔄 Session after sign-in:', session);
        } catch (e) {
          console.log('⚠️ Could not fetch session immediately:', e);
        }

        // Give the session a moment to be established
        setTimeout(() => {
          console.log('🚀 Redirecting to dashboard...');
          window.location.href = '/';
        }, 200);
      } else {
        // Neither error nor data - shouldn't happen but handle it
        console.warn('⚠️ No error but also no data returned');
        setIsLoading(false);
        setError('An unexpected error occurred. Please try again.');
      }
    } catch (error: unknown) {
      console.error('❌ Login error details:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error',
        code: error && typeof error === 'object' && 'code' in error ? error.code : undefined,
        status: error && typeof error === 'object' && 'status' in error ? error.status : undefined,
        response:
          error && typeof error === 'object' && 'response' in error ? error.response : undefined,
      });

      // Reset loading state immediately on error
      setIsLoading(false);

      // Handle specific error messages - check multiple possible error formats
      const errorObj = error as {
        message?: string;
        code?: string;
        status?: number;
        error?: { message?: string; code?: string };
      };
      const errorMessage = errorObj?.message || errorObj?.error?.message || '';
      const errorCode = errorObj?.code || errorObj?.error?.code || '';

      if (
        errorMessage.includes('Invalid email or password') ||
        errorCode === 'INVALID_EMAIL_OR_PASSWORD' ||
        errorObj?.status === 401
      ) {
        setError('Invalid email or password. Please check your credentials and try again.');
      } else if (errorMessage.includes('User not found') || errorCode === 'USER_NOT_FOUND') {
        setError(
          'No account found with this email address. Please check your email or create an account.',
        );
      } else if (
        errorMessage.includes('Too many attempts') ||
        errorMessage.includes('rate limit')
      ) {
        setError('Too many login attempts. Please wait a few minutes and try again.');
      } else {
        setError(`Login failed. Please try again. (Error: ${errorMessage || 'Unknown error'})`);
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to your account
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {successMessage && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
              {successMessage}
            </div>
          )}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}
          <div>
            <label htmlFor={emailId} className="sr-only">
              Email address
            </label>
            <input
              id={emailId}
              name="email"
              type="email"
              required
              autoComplete="email"
              data-lpignore="true"
              className={`relative block w-full px-3 py-2 bg-white border placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:z-10 sm:text-sm ${
                validationErrors.email
                  ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                  : 'border-gray-300 focus:ring-indigo-500 focus:border-indigo-500'
              }`}
              placeholder="Email address"
              value={email}
              onChange={(e) => handleEmailChange(e.target.value)}
            />
            {validationErrors.email && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.email}</p>
            )}
          </div>
          <div>
            <label htmlFor={passwordId} className="sr-only">
              Password
            </label>
            <input
              id={passwordId}
              name="password"
              type="password"
              required
              autoComplete="current-password"
              data-lpignore="true"
              className={`relative block w-full px-3 py-2 bg-white border placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:z-10 sm:text-sm ${
                validationErrors.password
                  ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                  : 'border-gray-300 focus:ring-indigo-500 focus:border-indigo-500'
              }`}
              placeholder="Password"
              value={password}
              onChange={(e) => handlePasswordChange(e.target.value)}
            />
            {validationErrors.password && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.password}</p>
            )}
          </div>
          <div>
            <button
              type="submit"
              disabled={
                isLoading ||
                !email ||
                !password ||
                !!validationErrors.email ||
                !!validationErrors.password
              }
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
          <div className="text-center space-y-2">
            <div>
              <a
                href={`/forgot-password${email ? `?email=${encodeURIComponent(email)}` : ''}`}
                className="font-medium text-indigo-600 hover:text-indigo-500"
              >
                Forgot your password?
              </a>
            </div>
            <div>
              <a href="/register" className="font-medium text-indigo-600 hover:text-indigo-500">
                Don't have an account? Sign up
              </a>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
