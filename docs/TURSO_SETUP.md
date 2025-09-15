# Turso Database Setup Guide

This guide explains how to set up Turso database for the schwab-rebalancer project.

## Prerequisites

1. Install Turso CLI:
   ```bash
   curl -sSfL https://get.turso.tech/install.sh | bash
   ```

2. Login to Turso:
   ```bash
   turso auth login
   ```

## Database Setup

1. Create a new Turso database:
   ```bash
   turso db create schwab-rebalancer-db
   ```

2. Get the database URL:
   ```bash
   turso db show schwab-rebalancer-db
   ```

3. Create an authentication token:
   ```bash
   turso db tokens create schwab-rebalancer-db
   ```

## Environment Variables

Create a `.env.local` file in the project root with the following variables:

```env
# Turso Database Configuration
TURSO_CONNECTION_URL=libsql://schwab-rebalancer-db-your-org.turso.io
TURSO_AUTH_TOKEN=your_auth_token_here
```

Replace the values with the actual URL and token from the Turso CLI commands above.

## Migration

After setting up the environment variables, run the migrations:

```bash
# Generate migrations from your schema
pnpm run db:generate

# Push the schema to Turso (recommended for initial setup)
npx drizzle-kit push

# Or apply migrations if you prefer that approach
# Note: Turso doesn't support traditional migrations the same way as other databases
```

## Testing

Test the connection in multiple ways:

### 1. Quick Connection Test

```bash
pnpm run test-db
```

This will verify your Turso connection, show the SQLite version, and confirm everything is working.

### 2. Full Application Test

```bash
pnpm run dev
```

Start the development server to test the full application with Turso database integration.

## Troubleshooting

### Connection Issues

If `pnpm run test-db` fails:

1. **Check environment variables** in `.env.local`:
   ```bash
   cat .env.local
   ```

2. **Verify Turso database exists**:
   ```bash
   turso db show schwab-rebalancer-db
   ```

3. **Test Turso CLI connection**:
   ```bash
   turso auth status
   ```

### Schema Issues

If you need to reset the database schema:

```bash
# Drop and recreate the database (⚠️ destroys all data)
turso db destroy schwab-rebalancer-db
turso db create schwab-rebalancer-db

# Then recreate the schema
pnpm run db:push
pnpm run seed
```
