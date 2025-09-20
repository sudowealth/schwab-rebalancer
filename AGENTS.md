# Repository Guidelines

## Project Structure & Module Organization

- `src/routes/`: File‑based routes (TanStack Router). Example: `src/routes/login.tsx`.
- `src/components/`, `src/lib/`, `src/utils/`: Reusable UI, domain logic, and helpers.
- `src/db/` and `drizzle/`: ORM schema and migration files.
- `public/`: Static assets served by Vite.
- `scripts/`: Local utilities and development tools.
- Key files: server functions `src/lib/server-functions.ts`, DB schema `src/db/schema.ts`, DB ops `src/lib/db-api.ts`, rebalancing engine `src/lib/rebalance-logic.ts`.

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
- Router setup: `src/router.tsx` sets `defaultPreload: "intent"`, default error and not‑found components, and enables scroll restoration.
- **Advanced**: Use `validateSearch` with Zod for type-safe search params
- **Performance**: Implement route-based code splitting with lazy loading
- **SEO**: Comprehensive meta tags including OpenGraph and Twitter cards

### 📊 Data Fetching & Loading
- **Server Data**: Use `Route.loader` for server-only work and call server functions there (see `index.tsx` loader calling `getDashboardDataServerFn`).
- **Client Hydration**: Pass loader results into React Query as `initialData` to avoid waterfalls and enable caching.
- **Optimization**: Use `Promise.allSettled()` over `Promise.all()` for better error resilience
- **Stale Time**: Set aggressive stale times (5+ minutes) for better perceived performance
- **Error Handling**: Implement comprehensive error boundaries and fallbacks

### 🔧 Server Functions
- **Validation**: Use Zod validators on all server functions for type safety
- **Error Handling**: Standardize error responses with consistent error codes
- **Security**: Implement rate limiting and input sanitization
- **Performance**: Use database connection pooling and optimize queries with `select()`
- **Auth**: Use `requireAuth()` and `requireAdmin()` guards consistently

### ⚛️ Component Architecture
- **Feature-based**: Organize by feature with `components/`, `hooks/`, `server.ts` structure
- **Custom Hooks**: Extract complex logic into reusable hooks
- **Error Boundaries**: Wrap feature sections with error boundaries
- **Loading States**: Implement skeleton components and pending states
- **Code Splitting**: Lazy load heavy components and routes

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

Remember: TanStack Start is about **developer experience first**. Focus on making development joyful and performant by default, while building applications that scale both in code and performance.
