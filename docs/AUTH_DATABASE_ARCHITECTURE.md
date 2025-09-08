# Auth & Database Architecture

## Database

- **D1** (Cloudflare SQLite) with local better-sqlite3 driver
- **Drizzle ORM** with type-safe operations
- **Connection pooling** and performance optimizations

## Schema

Core tables: `user`, `session`, `auth_account`, `verification` with standard Better Auth fields.

## Authentication

**Better Auth** with Drizzle adapter, email/password, 7-day sessions, role-based access.

### Key Files

- `src/lib/auth.ts` - Better Auth configuration
- `src/lib/auth-client.ts` - Client-side auth helpers
- `src/lib/auth-utils.ts` - `requireAuth()`, `requireAdmin()`, `canAccessResource()`

### Flow

1. **Login/Register** → Better Auth API → D1 database → Session cookie
2. **Route Protection** → `requireAuth()` in server functions
3. **Client State** → `useSession()` hook for UI updates

## Security

- HTTP-only cookies, CSRF protection, bcrypt hashing
- Email verification in production, role-based access
- Input sanitization, prepared statements

## Production (Cloudflare)

- **Pages**: SSR at edge locations, automatic scaling
- **D1**: Global SQLite replicas, eventual consistency
- **Workers**: Serverless API routes with sub-100ms latency
