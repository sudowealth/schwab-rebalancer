# CLAUDE.md

## Development Commands

- `pnpm dev` - Start development server on port 3000
- `npm run build` - Build for production (includes TypeScript check)
- `npm run typecheck` - Run TypeScript type checking
- `npm run lint` - Run ESLint
- `npm run db:generate` - Generate Drizzle migrations
- `npm run db:migrate` - Apply migrations locally
- `npm run db:studio` - Open Drizzle Studio for database inspection
- `npm run seed` - Seed database with initial data

## Architecture

**Tax-loss harvesting platform** managing equity portfolios through automated trading and wash-sale compliance.

### Tech Stack

- **Frontend**: TanStack Start (React) + TailwindCSS + shadcn/ui
- **Backend**: TypeScript on Node.js
- **Database**: PostgreSQL with Drizzle ORM
- **Auth**: Better Auth with email/password

### Core Concepts

- **Sleeves**: Groups of 3 similar securities for tax-loss harvesting substitution
- **Tax-Loss Harvesting**: Auto-sells losers (-2% or -$2,500), buys highest-ranked unblocked substitute
- **Wash-Sale Compliance**: 31-day blocking periods prevent violations

### Key Files

- `src/lib/server-functions.ts` - TanStack Start server functions
- `src/db/schema.ts` - Drizzle schema
- `src/lib/db-api.ts` - Database operations
- `src/lib/rebalance-logic.ts` - Core rebalancing engine
- `src/lib/auth.ts` - Better Auth integration

### TypeScript Standards

**Use exported return types over manual definitions:**

```typescript
export type RebalancingGroupByIdResult = Awaited<
  ReturnType<typeof getRebalancingGroupByIdServerFn>
>;
export type SleeveMember = Awaited<
  ReturnType<typeof getSleeveMembersServerFn>
>[number];
```

**Avoid manual type casting with `as any` or explicit type annotations:**

```typescript
const result = await getRebalancingGroupByIdServerFn(groupId);
const members = await getSleeveMembersServerFn();
```

**Avoid creating redundant manual type definitions when function return types exist:**

### UI Standards

Use shadcn/ui components and Tailwind CSS. Favor composition over custom styles.
