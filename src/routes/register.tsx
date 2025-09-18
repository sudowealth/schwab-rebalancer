import { createFileRoute } from '@tanstack/react-router';
import { ArrowRight, Ban, Crown, ShieldCheck } from 'lucide-react';
import { useId, useState } from 'react';
import { ClientOnly } from '../components/ClientOnly';
import { useSession } from '../lib/auth-client';
import {
  checkIsFirstUserServerFn,
  checkUserCreationAllowedServerFn,
  signUpWithFirstAdminServerFn,
} from '../lib/server-functions';

export const Route = createFileRoute('/register')({
  loader: async () => {
    const [firstUserCheck, userCreationCheck] = await Promise.all([
      checkIsFirstUserServerFn(),
      checkUserCreationAllowedServerFn(),
    ]);

    return {
      firstUserCheck,
      userCreationCheck,
    };
  },
  component: RegisterPage,
});

function RegisterPage() {
  const uid = useId();
  const nameId = `${uid}-name`;
  const emailId = `${uid}-email`;
  const passwordId = `${uid}-password`;
  const { data: session } = useSession();

  // Get data from server loader
  const { firstUserCheck, userCreationCheck } = Route.useLoaderData();

  const [email, setEmail] = useState(() => (import.meta.env.DEV ? '' : ''));
  const [password, setPassword] = useState(() => (import.meta.env.DEV ? '' : ''));
  const [name, setName] = useState(() => (import.meta.env.DEV ? '' : ''));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [validationErrors, setValidationErrors] = useState({
    email: '',
    password: '',
    name: '',
  });

  // Redirect if already logged in
  if (session?.user) {
    window.location.href = '/';
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
    if (!/(?=.*[a-z])/.test(password)) return 'Password must contain at least one lowercase letter';
    if (!/(?=.*[A-Z])/.test(password)) return 'Password must contain at least one uppercase letter';
    if (!/(?=.*\d)/.test(password)) return 'Password must contain at least one number';
    if (!/(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?])/.test(password))
      return 'Password must contain at least one symbol';
    return '';
  };

  const validateName = (name: string) => {
    if (!name) return 'Name is required';
    if (name.length < 2) return 'Name must be at least 2 characters long';
    if (name.length > 50) return 'Name must be less than 50 characters';
    if (!/^[a-zA-Z\s'-]+$/.test(name))
      return 'Name can only contain letters, spaces, hyphens, and apostrophes';
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

  const handleNameChange = (value: string) => {
    setName(value);
    setValidationErrors((prev) => ({
      ...prev,
      name: validateName(value),
    }));
  };

  const isFormValid = () => {
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);
    const nameError = validateName(name);

    setValidationErrors({
      email: emailError,
      password: passwordError,
      name: nameError,
    });

    return !emailError && !passwordError && !nameError;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isFormValid()) {
      return;
    }

    setIsLoading(true);

    try {
      const result = await signUpWithFirstAdminServerFn({
        data: { email, password, name },
      });

      // Show success message
      console.log('✅ Registration successful:', result.message);
      setSuccessMessage(result.message || 'Account created successfully!');

      // Redirect after showing success message
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    } catch (error: unknown) {
      console.error('❌ Registration error:', error);

      // Reset loading state immediately on error
      setIsLoading(false);

      // Handle specific error messages
      if (
        (error instanceof Error && error.message?.includes('User already exists')) ||
        (error as { code?: string })?.code === 'USER_ALREADY_EXISTS'
      ) {
        setError('An account with this email already exists. Please try logging in instead.');
      } else if (error instanceof Error && error.message?.includes('Invalid email')) {
        setError('Please enter a valid email address.');
      } else if (error instanceof Error && error.message?.includes('Password')) {
        setError('Password does not meet the requirements. Please check the password criteria.');
      } else if (
        (error instanceof Error && error.message?.includes('rate limit')) ||
        (error instanceof Error && error.message?.includes('Too many'))
      ) {
        setError('Too many registration attempts. Please wait a few minutes and try again.');
      } else {
        setError('Registration failed. Please try again.');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Create your account
          </h2>
          {!userCreationCheck?.allowed && userCreationCheck?.reason && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <div className="shrink-0">
                  <Ban className="h-5 w-5 text-red-600" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">User Registration Disabled</h3>
                  <div className="mt-2 text-sm text-red-700">{userCreationCheck.reason}</div>
                  <div className="mt-3">
                    <a
                      href="/login"
                      className="inline-flex items-center text-sm font-medium text-red-600 hover:text-red-500"
                    >
                      Go to Login
                      <ArrowRight className="ml-1 h-3 w-3" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}
          {userCreationCheck?.allowed && firstUserCheck?.isFirstUser && (
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-md p-4">
              <div className="flex">
                <div className="shrink-0">
                  <Crown className="h-5 w-5 text-blue-600" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">Administrator Account</h3>
                  <div className="mt-2 text-sm text-blue-700">
                    As the first user, you will automatically receive administrator privileges with
                    full access to system management features.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        {userCreationCheck?.allowed ? (
          <ClientOnly
            fallback={
              <div className="mt-8 space-y-6 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto"></div>
                <div className="space-y-4">
                  <div className="h-10 bg-gray-200 rounded"></div>
                  <div className="h-10 bg-gray-200 rounded"></div>
                  <div className="h-10 bg-gray-200 rounded"></div>
                  <div className="h-10 bg-gray-200 rounded"></div>
                </div>
              </div>
            }
          >
            <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
              {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                  {error}
                </div>
              )}
              {successMessage && (
                <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
                  {successMessage}
                  {successMessage.includes('Admin') && (
                    <div className="mt-2 text-sm flex items-center">
                      <ShieldCheck className="h-4 w-4 mr-1" />
                      You have been granted administrator privileges as the first user!
                    </div>
                  )}
                </div>
              )}
              <div>
                <label htmlFor={nameId} className="sr-only">
                  Full Name
                </label>
                <input
                  id={nameId}
                  name="name"
                  type="text"
                  required
                  className={`relative block w-full px-3 py-2 bg-white border placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:z-10 sm:text-sm ${
                    validationErrors.name
                      ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                      : 'border-gray-300 focus:ring-indigo-500 focus:border-indigo-500'
                  }`}
                  placeholder="Full name"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                />
                {validationErrors.name && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.name}</p>
                )}
              </div>
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
                  autoComplete="new-password"
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
                {!validationErrors.password && password && (
                  <div className="mt-1 text-xs text-gray-500">
                    Password must contain: 8+ characters, uppercase, lowercase, and number
                  </div>
                )}
              </div>
              <div>
                <button
                  type="submit"
                  disabled={
                    isLoading ||
                    !!successMessage ||
                    !email ||
                    !password ||
                    !name ||
                    !!validationErrors.email ||
                    !!validationErrors.password ||
                    !!validationErrors.name
                  }
                  className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Creating account...' : 'Create account'}
                </button>
              </div>
              <div className="text-center">
                <a href="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
                  Already have an account? Sign in
                </a>
              </div>
            </form>
          </ClientOnly>
        ) : (
          <div className="mt-8 text-center">
            <p className="text-gray-600">Registration is not available at this time.</p>
          </div>
        )}
      </div>
    </div>
  );
}
