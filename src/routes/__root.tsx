/// <reference types="vite/client" />
import { createRootRoute, HeadContent, Link, Scripts } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import type * as React from 'react';
import { DefaultCatchBoundary } from '~/components/DefaultCatchBoundary';
import { MobileNavigation } from '~/components/MobileNavigation';
import { NotFound } from '~/components/NotFound';
import { Providers } from '~/components/Providers';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from '~/components/ui/navigation-menu';
import { useAuth } from '~/hooks/useAuth';
import { signOut, useSession } from '~/lib/auth-client';
import { cn } from '~/lib/utils';
import appCss from '~/styles/app.css?url';
import { seo } from '~/utils/seo';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      ...seo({
        title: 'Tax Loss Harvesting Platform',
        description:
          'Advanced tax-loss harvesting for equity portfolios with 150 three-stock sleeves.',
      }),
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      {
        rel: 'apple-touch-icon',
        sizes: '180x180',
        href: '/apple-touch-icon.png',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '32x32',
        href: '/favicon-32x32.png',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '16x16',
        href: '/favicon-16x16.png',
      },
      { rel: 'manifest', href: '/site.webmanifest', color: '#fffff' },
      { rel: 'icon', href: '/favicon.ico' },
    ],
    scripts: [],
  }),
  errorComponent: DefaultCatchBoundary,
  notFoundComponent: () => <NotFound />,
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <Providers>
          <div className="min-h-screen bg-gray-50">
            <nav className="bg-white shadow-sm border-b">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16 overflow-visible">
                  {/* Mobile Navigation - Left side */}
                  <div className="flex items-center md:hidden">
                    <MobileNavigation />
                  </div>

                  {/* Desktop Navigation - Hidden on mobile */}
                  <div className="hidden md:flex items-center space-x-1">
                    <Link
                      to="/"
                      className={cn(navigationMenuTriggerStyle(), 'no-underline')}
                      activeOptions={{ exact: true }}
                    >
                      Dashboard
                    </Link>
                    <Link
                      to="/rebalancing-groups"
                      className={cn(navigationMenuTriggerStyle(), 'no-underline')}
                    >
                      Rebalancing Groups
                    </Link>
                    <Link to="/models" className={cn(navigationMenuTriggerStyle(), 'no-underline')}>
                      Models
                    </Link>
                    <Link
                      to="/sleeves"
                      className={cn(navigationMenuTriggerStyle(), 'no-underline')}
                    >
                      Sleeves
                    </Link>
                    <Link
                      to="/planning"
                      className={cn(navigationMenuTriggerStyle(), 'no-underline')}
                    >
                      Planning
                    </Link>

                    {/* Settings Dropdown */}
                    <div className="relative">
                      <NavigationMenu>
                        <NavigationMenuList>
                          <NavigationMenuItem>
                            <NavigationMenuTrigger>Settings</NavigationMenuTrigger>
                            <NavigationMenuContent>
                              <ul className="grid w-[200px] gap-3 p-4">
                                <AdminSettingsLink />
                                <li>
                                  <NavigationMenuLink asChild>
                                    <Link
                                      to="/data-feeds"
                                      className="block text-sm leading-none px-2 py-1.5 rounded-sm hover:bg-accent hover:text-accent-foreground"
                                    >
                                      Data Feeds
                                    </Link>
                                  </NavigationMenuLink>
                                </li>
                                <li>
                                  <NavigationMenuLink asChild>
                                    <Link
                                      to="/settings/securities"
                                      className="block text-sm leading-none px-2 py-1.5 rounded-sm hover:bg-accent hover:text-accent-foreground"
                                    >
                                      Securities
                                    </Link>
                                  </NavigationMenuLink>
                                </li>
                              </ul>
                            </NavigationMenuContent>
                          </NavigationMenuItem>
                        </NavigationMenuList>
                      </NavigationMenu>
                    </div>
                  </div>

                  {/* Right side - Auth and Demo badge */}
                  <div className="flex items-center space-x-4">
                    {/* Hide auth nav on mobile since it's in the mobile menu */}
                    <div className="hidden md:block">
                      <AuthNav />
                    </div>
                  </div>
                </div>
              </div>
            </nav>
            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">{children}</main>
          </div>
        </Providers>
        <TanStackRouterDevtools position="bottom-right" />
        <Scripts />
      </body>
    </html>
  );
}

function AdminSettingsLink() {
  const { isAdmin } = useAuth();

  if (!isAdmin) {
    return null;
  }

  return (
    <li>
      <NavigationMenuLink asChild>
        <Link
          to="/admin"
          className="block text-sm leading-none px-2 py-1.5 rounded-sm hover:bg-accent text-red-600 hover:text-red-700"
        >
          Admin
        </Link>
      </NavigationMenuLink>
    </li>
  );
}

function AuthNav() {
  const { data: session, isPending: isLoading } = useSession();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (session?.user) {
    return (
      <div className="flex items-center space-x-4">
        <span className="text-sm text-gray-700">
          Welcome, {session.user.name || session.user.email}
        </span>
        <button
          type="button"
          onClick={() => signOut()}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-4">
      <Link
        to="/login"
        search={{ reset: '' }}
        className="text-sm text-gray-500 hover:text-gray-700"
      >
        Sign in
      </Link>
      <Link
        to="/register"
        className="text-sm bg-indigo-600 text-white px-3 py-2 rounded-md hover:bg-indigo-700"
      >
        Sign up
      </Link>
    </div>
  );
}
