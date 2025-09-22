# Repository Guidelines

## Project Structure & Module Organization

- `src/routes/`: File‑based routes (TanStack Router). Example: `src/routes/login.tsx`.
- `src/components/`, `src/lib/`, `src/utils/`: Reusable UI, domain logic, and helpers.
- `src/db/` and `drizzle/`: ORM schema and migration files.
- `public/`: Static assets served by Vite.
- `scripts/`: Local utilities and development tools.
- Key files: server functions `src/lib/server-functions.ts`, DB schema `src/db/schema.ts`, DB ops `src/lib/db-api.ts`, DB config `src/lib/db-config.ts` (lazy-loaded), rebalancing engine `src/lib/rebalance-logic.ts`.

## Architecture Overview

- Tax‑loss harvesting platform enforcing wash‑sale rules with “sleeves” (interchangeable securities) to maintain exposure.
- Stack: TanStack Start + React/Tailwind (UI), Node.js (API), PostgreSQL + Drizzle (DB), Better Auth.

## Build, Test, and Development Commands

- `pnpm dev`: Start Vite dev server on port 3000.
- `npm run build`: Production build and TypeScript check.
- `npm start`: Run built server from `.output/`.
- `npm run deploy`: Build then deploy via Netlify CLI.
- `npm run lint` / `npm run format` / `npm run typecheck`: Lint and format with Biome; type‑check.
- `npm run db:generate`: Generate Drizzle migrations from schema.
- `npm run db:migrate`: Apply migrations locally to PostgreSQL database.
- `npm run db:migrate:prod`: Apply migrations to production.
- `npm run db:studio`: Open Drizzle Studio.
- `npm run seed`: Seed local data (see `src/lib/seeds/main.ts`).

## Coding Style & Naming Conventions

- Language: TypeScript + React. Prefer functional components and hooks.
- Formatting & Linting: Biome (2‑space indent, single quotes). Use `npm run format`, `npm run lint`, or `npm run fix`.
- Naming: Components `PascalCase.tsx` in `src/components`; utilities `camelCase.ts` in `src/lib`/`src/utils`; routes `kebab-case.tsx` in `src/routes` with `index.tsx` for folders.
- Types: Prefer exported return types and `Awaited<ReturnType<typeof fn>>`; avoid `as any` and redundant manual type aliases.

## UI Guidelines

- Use shadcn/ui components and Tailwind CSS by default for all new UI. Prefer composition over custom CSS. Keep styling consistent with existing `src/components/ui/` primitives.

## Testing Guidelines

- No test harness is configured yet. If adding tests, use Vitest and colocate as `*.test.ts`/`*.test.tsx` next to source or in `src/__tests__`.
- Keep tests deterministic; mock network APIs.

## Commit & Pull Request Guidelines

- Commits: Imperative mood (“Add…”, “Refactor…”), concise subject (<72 chars) and a clear body when needed. Group related changes.
- PRs: Include purpose, screenshots for UI, steps to validate, and any migration notes. Link related issues. Ensure `lint`, `typecheck`, and local build pass.

## Security & Configuration Tips

- Copy `.env.example` to `.env.local`; never commit secrets. Required for local auth, email, and integrations.
- Local dev uses PostgreSQL database; production uses hosted database.
- For HTTPS testing, use local HTTPS setup (see docs/LOCAL_HTTPS_SETUP.md).
- Production schedules: Corporate Actions 13:00 UTC, Harvest 16:00 UTC.

## TanStack Start Best Practices

### 🎯 Core Principles
- **Server/Client Separation**: Keep secrets, external APIs, and heavy computation on the server
- **Performance First**: Implement code splitting, lazy loading, and optimized data fetching
- **Developer Experience**: Focus on type safety, error boundaries, and clear patterns
- **Progressive Enhancement**: Server-rendered HTML with client-side hydration

### 🚀 Router Configuration
- File‑based routing: Root layout in `src/routes/__root.tsx` via `createRootRoute`; pages via `createFileRoute()` (e.g., `src/routes/index.tsx`). Don't edit `src/routeTree.gen.ts` (generated).
- Router setup: `src/router.tsx` sets `defaultPreload: "intent"`, aggressive preloading with `defaultPreloadStaleTime: 30_000` and `defaultPreloadGcTime: 5 * 60_000`, default error and not‑found components, and enables scroll restoration.
- **Advanced**: Use `validateSearch` with Zod for type-safe search params
- **Performance**: Implement route-based code splitting with lazy loading
- **SEO**: Comprehensive meta tags including OpenGraph and Twitter cards

#### 🚀 Router Preloading Configuration (Status: ✅ IMPLEMENTED)
- Aggressive preloading: `defaultPreloadStaleTime: 30_000` (30 seconds)
- Extended memory retention: `defaultPreloadGcTime: 5 * 60_000` (5 minutes)
- Preload on intent (hover/focus) for optimal perceived performance

### 📊 Data Fetching & Loading
- **Server Data**: Use `Route.loader` for server-only work and call server functions there (see `index.tsx` loader calling `getDashboardDataServerFn`).
- **Client Hydration**: Pass loader results into React Query as `initialData` to avoid waterfalls and enable caching.
- **Optimization**: Use `Promise.allSettled()` over `Promise.all()` for better error resilience
- **Stale Time**: Set aggressive stale times (5+ minutes) for better perceived performance
- **Error Handling**: Implement comprehensive error boundaries and structured error logging

#### 🔄 React Query Integration (Status: ✅ WELL-STRUCTURED)
- React Query patterns are already consistent and follow best practices
- Main dashboard uses loaders with `initialData` to prevent waterfalls
- Custom hooks properly use `initialData` from loader data
- Appropriate `staleTime` settings (5 minutes for general data, 2 minutes for frequently changing data)
- Proper query key organization with dedicated `queryKeys` utility
- Components use React Query for reactive updates while leveraging loader data

### 🔧 Server Functions
- **Database Imports**: Use static imports for database connections at the top of server functions (e.g., `import { dbProxy } from '~/lib/db-config'`). Avoid dynamic imports for performance.
- **Database Configuration**: Use lazy-loaded database proxies to ensure environment variables are available at runtime (not import time).
- **Single Responsibility Principle**: Each server function should do ONE thing. Avoid mixing data operations, external API calls, OAuth flows, and email sending in single functions.
- **Authentication**: Better Auth sessions don't include custom user fields like roles. Fetch them from the database using the session user ID when needed.
- **Client-side Auth Hook**: Use `useAuth()` hook that shows user data immediately from session, fetching role data in background only when needed for optimal UX.
- **Validation**: Use Zod validators on all server functions for type safety; remove unnecessary `emptySchema` validators for GET endpoints
- **Error Handling**: Standardize error responses with consistent error codes and structured logging
- **Security**: Implement rate limiting and input sanitization
- **Performance**: Use database connection pooling and optimize queries with `select()` instead of selecting all columns
- **Auth Guards**: Use `requireAuth()` and `requireAdmin()` consistently for protecting server functions

#### ✅ Server Function Validation (Status: ✅ IMPLEMENTED)
- Removed unnecessary `.validator(emptySchema)` from GET endpoints that don't expect input
- Cleaned up `getEnvironmentInfoServerFn`, `checkAuthServerFn`, and `checkAdminServerFn`
- Maintains type safety while reducing validation overhead for parameterless endpoints

### ⚛️ Component Architecture
- **Feature-based**: Organize by feature with `components/`, `hooks/`, `server.ts` structure
- **Custom Hooks**: Extract complex logic into reusable hooks
- **Error Boundaries**: Wrap feature sections with error boundaries and structured error logging
- **Loading States**: Implement skeleton components and pending states
- **Code Splitting**: Lazy load heavy components and routes

#### 🚨 Structured Error Logging (Status: ✅ IMPLEMENTED)
- **Environment-aware logging**: Development uses colored console output; production uses structured JSON
- **Available utilities**: `logError()`, `logInfo()`, `logWarn()`, `logSecurityEvent()`, `logPerformance()`
- **Context support**: All logging functions accept structured context (userId, sessionId, component, etc.)
- **Performance monitoring**: `createPerformanceTimer()` utility for operation timing
- **Integration**: Existing `error-handler.ts` functions now use structured logging
- **Future-ready**: Placeholder for error reporting service integration (Sentry, LogRocket, etc.)

#### 🔐 Auth Context Optimization (Status: ✅ IMPLEMENTED)
- **Memoization**: `useAuth()` hook uses `useMemo()` to prevent unnecessary re-renders
- **User object memoization**: Prevents recreation of user objects on every render
- **Auth state memoization**: Memoizes the complete auth state return object
- **Performance**: Reduces component re-renders when auth state hasn't changed

### 🎨 UI & Performance
- **Bundle Splitting**: Use dynamic imports for heavy libraries and routes
- **Image Optimization**: Implement proper image loading and lazy loading
- **Caching**: Aggressive React Query caching with proper invalidation
- **Bundle Analysis**: Use rollup-plugin-visualizer to monitor bundle size
- **Tree Shaking**: Ensure proper tree shaking of unused dependencies

### 🔒 Security & Best Practices
- **Input Validation**: Validate all inputs on both client and server
- **Rate Limiting**: Implement rate limiting on sensitive endpoints
- **Error Sanitization**: Never expose internal errors to clients
- **HTTPS**: Always use HTTPS in production
- **Secrets**: Keep all secrets server-side, never in client bundles

### 🧪 Development & Testing
- **Type Safety**: Use branded types for IDs and complex types
- **Error Boundaries**: Comprehensive error boundaries in development
- **Hot Reload**: Ensure HMR works properly across all components
- **Linting**: Strict linting rules with Biome
- **Testing**: Component and server function testing with proper mocking

### 📈 Performance Monitoring
- **Bundle Size**: Monitor and optimize bundle sizes regularly
- **Core Web Vitals**: Track FCP, LCP, CLS, FID, and TBT
- **Database Queries**: Monitor and optimize slow queries
- **Memory Usage**: Watch for memory leaks in long-running sessions
- **Network Requests**: Minimize and optimize API calls

### 🚀 Advanced Patterns
- **Route Preloading**: Implement intelligent route preloading based on user behavior
- **Optimistic Updates**: Use optimistic updates for better perceived performance
- **Background Sync**: Implement background data synchronization
- **Progressive Loading**: Load critical data first, enhance progressively
- **Service Workers**: Consider service workers for offline functionality

### 🔄 Migration & Updates
- **TanStack Updates**: Keep TanStack libraries updated for latest features
- **Breaking Changes**: Plan migrations carefully with feature flags
- **Deprecation**: Gradually deprecate old patterns before removal
- **Documentation**: Keep internal docs updated with new patterns

## 🚨 TanStack Start Antipatterns to Avoid

Based on our codebase review and fixes, avoid these common antipatterns that violate TanStack Start best practices:

### ❌ Critical Antipatterns (Performance Impact)

#### 1. Dynamic Imports in Server Functions
```typescript
// ❌ AVOID: Dynamic imports add unnecessary async overhead
export const someServerFn = createServerFn().handler(async () => {
  const { getData } = await import('~/lib/db-api'); // SLOW!
  return getData();
});

// ✅ DO: Static imports at the top
import { getData } from '~/lib/db-api';

export const someServerFn = createServerFn().handler(async () => {
  return getData(); // FAST - synchronous
});
```

#### 2. Server Functions with Multiple Responsibilities
```typescript
// ❌ AVOID: Single function doing too many things
export const complexServerFn = createServerFn().handler(async () => {
  // 1. Authenticate user
  // 2. Fetch data from database
  // 3. Call external API
  // 4. Send email
  // 5. Update multiple tables
  // VIOLATES: Single Responsibility Principle
});

// ✅ DO: One function, one purpose
export const authenticateUserServerFn = createServerFn()...
export const fetchUserDataServerFn = createServerFn()...
export const callExternalAPIServerFn = createServerFn()...
export const sendEmailServerFn = createServerFn()...
```

#### 3. Client-Side Navigation with window.location
```typescript
// ❌ AVOID: Bypasses router, causes hydration issues
const handleRedirect = () => {
  window.location.href = '/new-page'; // BAD!
};

// ✅ DO: Use TanStack Router
import { useRouter } from '@tanstack/react-router';

const handleRedirect = () => {
  const router = useRouter();
  router.navigate({ to: '/new-page' }); // GOOD!
};
```

#### 4. Broad Query Invalidation
```typescript
// ❌ AVOID: Invalidates everything, defeats caching
queryClient.invalidateQueries(); // SLOWS DOWN APP!

// ✅ DO: Targeted invalidation
queryClient.invalidateQueries({
  queryKey: ['specific-data', userId]
});
```

### ❌ Architecture Antipatterns

#### 5. Auth Logic in Components
```typescript
// ❌ AVOID: Auth logic scattered in UI components
function MyComponent() {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated) return <LoginPrompt />;
  // Component logic mixed with auth...
}

// ✅ DO: Route-level auth guards
export const Route = createFileRoute('/protected')({
  beforeLoad: authGuard, // Auth handled here
  component: MyComponent, // Pure UI component
});
```

#### 6. Mixed Data Fetching Strategies
```typescript
// ❌ AVOID: Route loader + React Query waterfall
loader: async () => {
  const data1 = await fetchData1(); // Loader gets some data
},
// Component also fetches more data - creates waterfall!

// ✅ DO: Consistent strategy
// Either: Full loader + initialData in React Query
// Or: Pure React Query with proper loading states
```

#### 7. Over-Engineering Database Connections
```typescript
// ❌ AVOID: Unnecessarily complex proxy patterns
export const dbProxy = new Proxy({} as Database, { /* complex logic */ });

// ✅ DO: Simple lazy initialization
let dbInstance: Database | null = null;
export function getDb() {
  if (!dbInstance) {
    dbInstance = createDatabaseClient();
  }
  return dbInstance;
}
```

### ✅ When Dynamic Imports ARE Acceptable

- **Heavy libraries**: `await import('exceljs')` for large optional dependencies
- **Conditional features**: Loading features only when needed (e.g., admin panels)
- **Client-side code splitting**: `lazy(() => import('./HeavyComponent'))`
- **Server-only utilities**: Intentionally preventing client bundling

### 📋 Server Function Complexity Guidelines

When creating server functions, ask: "Does this function do ONE thing well?"

**Good Server Function Examples:**
- `getUserProfileServerFn` - Only fetches user data
- `updateUserEmailServerFn` - Only updates email
- `validatePasswordServerFn` - Only validates password
- `sendWelcomeEmailServerFn` - Only sends email

**Red Flags for Refactoring:**
- Function name contains "and" (e.g., `createUserAndSendEmail`)
- Function has multiple external API calls
- Function updates multiple database tables
- Function handles both data and side effects
- Function is longer than 50 lines

**Refactoring Strategy:**
1. Extract pure data operations into separate functions
2. Move side effects (emails, external APIs) to dedicated functions
3. Use composition: `createUserServerFn` calls `sendWelcomeEmailServerFn`
4. Keep database operations synchronous within each function

## 🏗️ Architecture Decision Records

### ADR: Database Connection Pattern - Simplified Lazy Initialization
**Date:** September 22, 2025
**Status:** ✅ **IMPLEMENTED**

**Context:**
- Need lazy database initialization for serverless environments
- Previous implementation used complex proxy patterns
- TanStack Start review recommended simplification

**Decision:**
Use simple lazy initialization with a getter function instead of proxy patterns:

```typescript
let dbInstance: Database | null = null;
export function getDb() {
  if (!dbInstance) {
    dbInstance = createDatabaseClient();
  }
  return dbInstance;
}
```

**Consequences:**
- ✅ Simpler and more maintainable code
- ✅ Eliminates proxy overhead
- ✅ Still maintains lazy loading for serverless compatibility
- ✅ Easier to understand and debug

### ADR: Router Preloading Strategy - Aggressive Intent-Based Preloading
**Date:** September 22, 2025
**Status:** ✅ **IMPLEMENTED**

**Context:**
- Want to optimize perceived performance through intelligent preloading
- Need to balance memory usage with performance benefits
- TanStack Start review recommended more aggressive preloading

**Decision:**
Implement aggressive intent-based preloading with extended memory retention:

```typescript
export function createRouter() {
  const router = createTanStackRouter({
    routeTree,
    defaultPreload: 'intent',           // Preload on hover/focus
    defaultPreloadStaleTime: 30_000,    // 30 seconds
    defaultPreloadGcTime: 5 * 60_000,   // 5 minutes
    // ... other options
  });
  return router;
}
```

**Consequences:**
- ✅ Improved perceived performance through faster navigation
- ✅ Reduced server requests for frequently accessed routes
- ✅ Memory usage managed through garbage collection timing
- ⚠️ Slightly higher memory footprint (acceptable for better UX)

### ADR: Server Function Validation - Minimal Validation for GET Endpoints
**Date:** September 22, 2025
**Status:** ✅ **IMPLEMENTED**

**Context:**
- Server functions using `emptySchema` validators for GET endpoints with no parameters
- Unnecessary validation overhead for parameterless endpoints
- TanStack Start review identified this as an improvement opportunity

**Decision:**
Remove unnecessary `emptySchema` validators from GET endpoints that don't expect input parameters:

```typescript
// Before
export const getEnvironmentInfoServerFn = createServerFn({ method: 'GET' })
  .validator(emptySchema)
  .handler(async () => { /* ... */ });

// After
export const getEnvironmentInfoServerFn = createServerFn({ method: 'GET' })
  .handler(async () => { /* ... */ });
```

**Consequences:**
- ✅ Reduced validation overhead for parameterless endpoints
- ✅ Cleaner, more explicit code about intent
- ✅ Maintains type safety where validation is actually needed
- ✅ Follows principle of "validate what you actually need to validate"

### ADR: Error Logging Strategy - Structured Environment-Aware Logging
**Date:** September 22, 2025
**Status:** ✅ **IMPLEMENTED**

**Context:**
- Need consistent error logging across development and production
- Want to support error reporting services in production
- TanStack Start review recommended structured error logging

**Decision:**
Implement environment-aware structured logging with context support:

```typescript
// Development: Colored console output with full details
console.group(`🚨 [ERROR] ${error.message}`);
console.error('Error:', error);
console.log('Context:', context);
console.groupEnd();

// Production: Structured JSON for log aggregation
console.error(JSON.stringify({
  level: 'error',
  timestamp: new Date().toISOString(),
  error: { message, name, stack },
  context,
  environment: 'production',
  service: 'schwab-rebalancer'
}));
```

**Consequences:**
- ✅ Better development experience with readable console output
- ✅ Production-ready structured logging for monitoring tools
- ✅ Context support for better error debugging
- ✅ Future-ready for error reporting service integration
- ✅ Performance monitoring capabilities included

### ADR: Auth Hook Optimization - Memoized State Management
**Date:** September 22, 2025
**Status:** ✅ **IMPLEMENTED**

**Context:**
- `useAuth()` hook was creating new objects on every render
- Causing unnecessary re-renders of dependent components
- TanStack Start review identified performance optimization opportunity

**Decision:**
Implement memoization in the auth hook to prevent unnecessary re-renders:

```typescript
export function useAuth() {
  const { data: session, isPending, error } = useSession();

  const user = useMemo(() => {
    return session?.user ? {
      ...session.user,
      role: (session.user as { role?: UserRole }).role || 'user',
    } : null;
  }, [session?.user]);

  const authState = useMemo(() => ({
    user,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    isPending,
    error,
  }), [user, isPending, error]);

  return authState;
}
```

**Consequences:**
- ✅ Reduced unnecessary component re-renders
- ✅ Improved performance, especially in component trees with many auth-dependent components
- ✅ Maintains reactive behavior when auth state actually changes
- ✅ No breaking changes to hook API

Remember: TanStack Start is about **developer experience first**. Focus on making development joyful and performant by default, while building applications that scale both in code and performance.
