# Auth & Database Architecture

## Database

- **Neon PostgreSQL** (serverless) with HTTP driver
- **Drizzle ORM** with type-safe operations
- **Serverless-compatible** with connection pooling and performance optimizations

## Schema

Core tables: `user`, `session`, `auth_account`, `verification` with standard Better Auth fields.

## Authentication

**Better Auth** with Drizzle adapter, email/password, 7-day sessions, role-based access.

### Key Files

- `src/lib/auth.ts` - Better Auth configuration
- `src/lib/auth-client.ts` - Client-side auth helpers
- `src/lib/auth-utils.ts` - `requireAuth()`, `requireAdmin()`, `canAccessResource()`

### Flow

1. **Login/Register** → Better Auth API → Neon PostgreSQL database → Session cookie
2. **Route Protection** → `requireAuth()` in server functions
3. **Client State** → `useSession()` hook for UI updates

## Security

- HTTP-only cookies, CSRF protection, bcrypt hashing
- Email verification in production, role-based access
- Input sanitization, prepared statements

## Production

- **Hosting**: Netlify with server-side rendering and global CDN
- **Database**: Neon PostgreSQL (serverless) with global edge replication
- **API**: Serverless functions with automatic scaling
