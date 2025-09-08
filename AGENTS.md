# Repository Guidelines

## Project Structure & Module Organization

- `src/routes/`: File‑based routes (TanStack Router). Example: `src/routes/login.tsx`.
- `src/components/`, `src/lib/`, `src/utils/`: Reusable UI, domain logic, and helpers.
- `src/db/` and `drizzle/`: ORM schema and D1 migration files.
- `public/`: Static assets served by Vite.
- `scripts/`: Local utilities and development tools.
- Cloudflare/Workers: `wrangler.jsonc`, `worker-configuration.d.ts`.
- Key files: server functions `src/lib/server-functions.ts`, DB schema `src/db/schema.ts`, DB ops `src/lib/db-api.ts`, rebalancing engine `src/lib/rebalance-logic.ts`.

## Architecture Overview

- Tax‑loss harvesting platform enforcing wash‑sale rules with “sleeves” (interchangeable securities) to maintain exposure.
- Stack: TanStack Start + React/Tailwind (UI), Cloudflare Workers (API), D1 + Drizzle (DB), KV/R2 (config/exports), Better Auth.

## Build, Test, and Development Commands

- `npm run dev`: Start Vite dev server on port 3000.
- `npm run build`: Production build and TypeScript check.
- `npm start`: Run built server from `.output/`.
- `npm run deploy`: Build then deploy via Cloudflare Wrangler.
- `npm run lint` / `npm run format` / `npm run typecheck`: Lint, format with Prettier, type‑check.
- `npm run db:generate`: Generate Drizzle migrations from schema.
- `npm run db:migrate`: Apply D1 migrations locally to `tax-loss-harvesting`.
- `npm run db:migrate:prod`: Apply migrations to production.
- `npm run db:studio`: Open Drizzle Studio.
- `npm run seed`: Seed local data (see `src/lib/seeds/main.ts`).
- `npm run cf-typegen`: Regenerate Cloudflare Worker types when bindings change.

## Coding Style & Naming Conventions

- Language: TypeScript + React. Prefer functional components and hooks.
- Formatting: Prettier (2‑space indent, single quotes default). Run `npm run format`.
- Linting: ESLint with TypeScript/React plugins. Fix issues or add rationale.
- Naming: Components `PascalCase.tsx` in `src/components`; utilities `camelCase.ts` in `src/lib`/`src/utils`; routes `kebab-case.tsx` in `src/routes` with `index.tsx` for folders.
- Types: Prefer exported return types and `Awaited<ReturnType<typeof fn>>`; avoid `as any` and redundant manual type aliases.

## UI Guidelines

- Use shadcn/ui components and Tailwind CSS by default for all new UI. Prefer composition over custom CSS. Keep styling consistent with existing `src/components/ui/` primitives.

## Testing Guidelines

- No test harness is configured yet. If adding tests, use Vitest and colocate as `*.test.ts`/`*.test.tsx` next to source or in `src/__tests__`.
- Keep tests deterministic; mock network/Workers APIs.

## Commit & Pull Request Guidelines

- Commits: Imperative mood (“Add…”, “Refactor…”), concise subject (<72 chars) and a clear body when needed. Group related changes.
- PRs: Include purpose, screenshots for UI, steps to validate, and any migration notes. Link related issues. Ensure `lint`, `typecheck`, and local build pass.

## Security & Configuration Tips

- Copy `.env.example` to `.env.local`; never commit secrets. Required for local auth, email, and integrations.
- For Cloudflare D1/Workers, install and auth Wrangler; run `npm run cf-typegen` if types change.
- Local dev uses SQLite file `local.db`; production uses Cloudflare D1 via Wrangler bindings.
- For HTTPS testing, use local HTTPS setup (see docs/LOCAL_HTTPS_SETUP.md).
- Production Workers schedule: Corporate Actions 13:00 UTC, Harvest 16:00 UTC.

## TanStack Start

- File‑based routing: Root layout in `src/routes/__root.tsx` via `createRootRoute`; pages via `createFileRoute()` (e.g., `src/routes/index.tsx`). Don’t edit `src/routeTree.gen.ts` (generated).
- Router setup: `src/router.tsx` sets `defaultPreload: "intent"`, default error and not‑found components, and enables scroll restoration.
- Server data: Use `Route.loader` for server‑only work and call server functions there (see `index.tsx` loader calling `getDashboardDataServerFn`).
- Client hydration: Pass loader results into React Query as `initialData` to avoid waterfalls and enable caching.
- Mutations: Wrap `createServerFn` calls with React Query `useMutation` for side effects; keep secrets and external API calls inside server functions.
- Layout & providers: Use the root `shellComponent` to wire global providers (`src/components/Providers.tsx`), nav, and meta via `<HeadContent />` and `utils/seo.ts`.
- Auth gating: Prefer `beforeLoad` or server loaders for route protection; fall back to `useSession` in components for UI state.
