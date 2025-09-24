import { createRootRoute, HeadContent, Scripts } from '@tanstack/react-router';
import { AppShell } from '~/components/AppShell';
import { DefaultCatchBoundary } from '~/components/DefaultCatchBoundary';
import { NotFound } from '~/components/NotFound';
import { getCachedAuth, setCachedAuth } from '~/lib/auth-cache';
import { seo } from '~/lib/seo';
import { getCurrentUserServerFn } from '~/lib/server-functions';
import type { RouterAuthContext } from '~/router';
import appCss from '~/styles/app.css?url';

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
  // Use cached auth state to avoid redundant fetches
  loader: async () => {
    // Check cache first
    const cachedAuth = getCachedAuth();
    if (cachedAuth) {
      console.log('🚀 [Auth] Using cached auth state');
      return cachedAuth;
    }

    // Fetch fresh auth data and cache it
    console.log('🔄 [Auth] Fetching fresh auth state');
    try {
      const auth = await getCurrentUserServerFn();
      setCachedAuth(auth);
      return auth;
    } catch {
      // Cache the unauthenticated state too
      const unauthenticatedState = {
        user: null,
        authenticated: false,
      };
      setCachedAuth(unauthenticatedState);
      return unauthenticatedState;
    }
  },
  // Pass auth context to child routes and shell component
  context: ({ context }: { context: RouterAuthContext }) => ({
    auth: context,
  }),
  errorComponent: DefaultCatchBoundary,
  notFoundComponent: () => <NotFound />,
  component: RootDocument,
});

// Root document component that renders the full HTML structure
function RootDocument() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <AppShell />
        <Scripts />
      </body>
    </html>
  );
}
