# Schwab Portfolio Rebalancing Platform

A portfolio management platform built for rebalancing and tax-loss harvesting with Charles Schwab. The system manages equity portfolios through rebalancing groups and "sleeves" - groups of similar securities that can substitute for each other during rebalancing while maintaining wash-sale compliance and optimal tax efficiency.

## Disclaimer

This is an unofficial, community-developed portfolio management platform for interacting with Charles Schwab APIs. It has not been approved, endorsed, or certified by Charles Schwab. It is provided as-is, and its functionality may be incomplete or unstable. Use at your own risk, especially when dealing with financial data or transactions.

## Architecture

- **Frontend**: TanStack Start (React-based SPA) with TailwindCSS and shadcn/ui
- **Backend**: TypeScript/Node.js on Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite) with Drizzle ORM
- **Storage**: Cloudflare KV (caching/config) + R2 (exports)
- **Authentication**: Better Auth with email/password
- **Market Data**: Yahoo Finance API with 60-second caching
- **Trading**: Charles Schwab API integration
- **Deployment**: Cloudflare Workers with scheduled cron jobs

## Key Features

### Portfolio Management

- **Rebalancing Groups**: Create and manage multiple portfolio groups with custom asset allocations
- **Sleeve-Based Organization**: Group similar securities into sleeves for tax-efficient substitutions
- **Dynamic Allocation**: Real-time portfolio rebalancing with customizable target percentages
- **Multi-Account Support**: Manage multiple brokerage accounts within each rebalancing group

### Tax Optimization

- **Automated Tax-Loss Harvesting**: Configurable loss thresholds and harvesting rules
- **Wash-Sale Compliance**: 31-day blocking mechanism to prevent wash-sale violations
- **Tax-Efficient Rebalancing**: Smart security substitutions to maintain market exposure
- **Schedule D Export**: Generate tax reports for filing

### Trading & Integration

- **Schwab API Integration**: Live trading through Charles Schwab brokerage accounts
- **Real-time Pricing**: Yahoo Finance integration with caching for performance
- **Order Management**: Advanced order blotter with quantity calculations

### Security & Access Control

- **Individual Use Mode**: Single-user security mode for personal deployments
- **Role-Based Access**: Admin and user roles with appropriate permissions
- **Secure Authentication**: Better Auth integration with session management
- **Audit Logging**: Comprehensive audit trail for all user actions

## Local Development Setup

### 1. Prerequisites

- Node.js 22+
- npm or pnpm package manager
- **Charles Schwab Developer Account** (REQUIRED for full functionality)
  - See [SCHWAB_SETUP.md](./SCHWAB_SETUP.md) for detailed setup instructions
  - **HTTPS is REQUIRED** - Schwab OAuth will not work over HTTP
  - Without Schwab integration, the app will operate in limited demo mode only
- Resend API key (for email notifications, optional)

### 2. Installation & Database Setup

```bash
# Clone the repository
git clone <repository-url>
cd schwab-rebalancer

# Install dependencies
npm install
# or
pnpm install

# Initialize local database (creates SQLite DB in .wrangler/state/v3/d1/)
npm run db:migrate

# Seed database with initial data (S&P 500 securities, etc.)
npm run seed
```

### 3. Local HTTPS Setup (REQUIRED for Schwab integration)

**⚠️ CRITICAL: Schwab OAuth requires HTTPS. The application will NOT work with Schwab integration over HTTP.**

Follow the HTTPS setup instructions in `docs/LOCAL_HTTPS_SETUP.md` to:

1. Set up local HTTPS with self-signed certificates
2. Configure your browser to accept the certificates
3. Access the application at `https://127.0.0.1` (NOT http://localhost)

### 4. Schwab API Setup (REQUIRED for Schwab integration)

**⚠️ IMPORTANT: The application requires Schwab API integration to function properly.**

Follow the instructions in [SCHWAB_SETUP.md](./SCHWAB_SETUP.md) to:

1. Register for a Schwab developer account
2. Create an application with the correct callback URLs (`https://127.0.0.1/schwab/callback`)
3. Obtain your API credentials
4. Configure environment variables

### 5. Local Environment Configuration

Create a `.env.local` file (the app uses a local SQLite database automatically):

```env
AUTH_BASE_URL=https://127.0.0.1
INDIVIDUAL_USE=true
NODE_ENV=development
RESEND_API_KEY=your-resend-api-key # optional

# Schwab API Credentials (REQUIRED - see SCHWAB_SETUP.md)
SCHWAB_CLIENT_ID=your-schwab-client-id
SCHWAB_CLIENT_SECRET=your-schwab-client-secret

# Encryption Key for sensitive data (REQUIRED)
# Generate with: npm run generate-key
ENCRYPTION_KEY=your-generated-encryption-key
```

#### Encryption Setup

The application uses AES-256-GCM encryption to protect sensitive data like API tokens. Generate an encryption key:

```bash
# Generate a secure encryption key
npm run generate-key

# Copy the generated key to your .env.local file
```

**⚠️ Important**: Back up your encryption key securely. Losing it means losing access to encrypted data in your database.

#### Individual Use Mode

The `INDIVIDUAL_USE` environment variable controls user registration for enhanced security:

- **`INDIVIDUAL_USE=true`** (default): Restricts the application to a single user account. This is the recommended setting for personal deployments as it:
  - Prevents unauthorized user registration after the first account is created
  - Reduces attack surface by limiting access to one user
  - Automatically grants the first user administrator privileges
  - Ideal for self-hosted individual use

- **`INDIVIDUAL_USE=false`**: This app is really designed for single-user deployments so this should RARELY be set to `false`. However, if you need to allow multiple user accounts, set this to `false` so that users can register themselves and you can manage them in the admin panel.

**Note**: The first user created will always receive administrator privileges regardless of this setting.

### 6. Running Locally

```bash
# Start development server with HTTPS (required for Schwab OAuth)
# Access at https://127.0.0.1 (NOT http://localhost:3000)
npm run dev

# Open Drizzle Studio to inspect database
npm run db:studio

# Run type checking
npm run typecheck

# Run linting
npm run lint
```

## Production Deployment

### Prerequisites

- Cloudflare account with:
  - Workers (for backend hosting)
  - D1 Database (for data storage)
  - KV Storage (for caching and configuration)
  - R2 Storage (for file exports)

### 1. Create Cloudflare Resources

```bash
# Create D1 database
wrangler d1 create tax-loss-harvesting

# Create KV namespaces
wrangler kv:namespace create "CACHE"
wrangler kv:namespace create "CONFIG"

# Create R2 bucket
wrangler r2 bucket create tax-loss-exports
```

### 2. Configure wrangler.jsonc

This repo ships with placeholder IDs in `wrangler.jsonc`. Replace these with your real Cloudflare resource IDs from step 1:

- `CACHE_KV_ID_PLACEHOLDER`
- `CONFIG_KV_ID_PLACEHOLDER`
- `DB_ID_PLACEHOLDER`

```jsonc
{
  "name": "schwab-rebalancer",
  "kv_namespaces": [
    { "binding": "CACHE", "id": "CACHE_KV_ID_PLACEHOLDER" },
    { "binding": "CONFIG", "id": "CONFIG_KV_ID_PLACEHOLDER" },
  ],
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "tax-loss-harvesting",
      "database_id": "DB_ID_PLACEHOLDER",
    },
  ],
  "r2_buckets": [
    {
      "binding": "EXPORTS",
      "bucket_name": "tax-loss-exports",
    },
  ],
  "vars": {
    "INDIVIDUAL_USE": "true",
  },
}
```

Tips:

- Find IDs: `wrangler kv namespace list`, `wrangler d1 list`, `wrangler r2 bucket list`
- You can keep placeholders committed; just swap them locally before `npm run deploy`, or manage env-specific files in CI.

### 3. Set Production Environment Variables

Configure these secrets in Cloudflare Workers:

```bash
# Set Schwab API credentials
wrangler secret put SCHWAB_CLIENT_ID
wrangler secret put SCHWAB_CLIENT_SECRET

# Set authentication base URL
wrangler secret put AUTH_BASE_URL  # Your production URL

# Set encryption key (REQUIRED - generate a new key for production)
# Generate with: npm run generate-key
wrangler secret put ENCRYPTION_KEY

# Optional: Set Resend API key for email notifications
wrangler secret put RESEND_API_KEY
```

**⚠️ Security Best Practices**:

- **Always use different encryption keys** for development and production environments
- Generate a fresh key for production: `npm run generate-key`
- Never share keys between environments or commit them to version control
- If migrating data from development to production, you'll need to decrypt with the old key and re-encrypt with the new key

### 4. Run Production Database Migrations

```bash
# Apply migrations to production D1 database
npm run db:migrate:prod

# Optionally seed production data (be careful!)
# npm run seed:prod
```

### 5. Deploy to Cloudflare Workers

```bash
# Build and deploy to Cloudflare Workers
npm run deploy

# The application will be available at your-app.your-subdomain.workers.dev
```

## Usage

### Getting Started

1. **Create an Account**: Register at your deployed application URL
2. **Create Rebalancing Groups**: Set up your first portfolio group
3. **Add Sleeves**: Organize securities into sleeves for tax-efficient management
4. **Configure Allocations**: Set target percentages for each sleeve
5. **Connect Schwab** (optional): Link your brokerage account for live trading

## Core Concepts

### Rebalancing Groups

Portfolio containers that hold multiple accounts and sleeves. Each group has:

- Target allocation percentages
- Risk tolerance settings
- Rebalancing frequency rules
- Performance tracking

### Sleeves

Groups of 2-3 similar securities that can substitute for each other:

- Maintain market exposure during tax-loss harvesting
- Enable wash-sale compliant trading
- Ranked by preference for automatic selection

### Models

Pre-defined allocation templates that can be applied to rebalancing groups:

- Conservative, Moderate, Aggressive presets
- Custom model creation
- Historical backtesting capabilities

## Development Commands

### Core Development

- `npm run dev` - Start development server on port 3000
- `npm run build` - Build for production (includes TypeScript check)
- `npm run start` - Start production server
- `npm run deploy` - Build and deploy to Cloudflare Workers

### Code Quality

- `npm run typecheck` - Run TypeScript type checking
- `npm run lint` - Lint with Biome
- `npm run format` - Format code with Biome
- `npm run check` - Lint + format check (no writes)
- `npm run fix` - Lint + format and apply fixes

### Database Management

- `npm run db:generate` - Generate Drizzle migrations
- `npm run db:migrate` - Apply migrations locally
- `npm run db:migrate:prod` - Apply migrations to production
- `npm run db:studio` - Open Drizzle Studio for database inspection
- `npm run seed` - Seed database with initial data

### Utilities

- `npm run cf-typegen` - Generate Cloudflare Worker types
- `npm run generate-key` - Generate secure encryption key for environment

## Database Schema

Using **Drizzle ORM** with **Cloudflare D1** (distributed SQLite). Key entities:

**Portfolio Management:**

- `rebalancing_group` - Portfolio containers with allocation rules
- `sleeve` - Groups of similar securities for tax-efficient trading
- `sleeve_member` - Individual securities within sleeves
- `model` - Pre-defined allocation templates

**Financial Data:**

- `security` - Stock metadata, prices, and fundamentals
- `account` - Brokerage account information
- `holding` - Current portfolio positions
- `transaction` - Historical trade records
- `order` - Pending and executed trade orders

**Authentication & Security:**

- `user` - User accounts and profiles
- `session` - Authentication sessions
- `audit_log` - Security and action logging

**Schwab Integration:**

- `schwab_account` - Schwab-specific account data
- `schwab_holding` - Schwab position synchronization
- `schwab_transaction` - Schwab trade history sync

## Architecture Details

### Frontend Architecture

- **TanStack Start**: File-based routing with server functions
- **React 19**: Latest React features with concurrent rendering
- **TailwindCSS + shadcn/ui**: Utility-first styling with accessible components
- **React Query**: Data fetching and caching
- **React Table**: Advanced data grids with virtualization

### Backend Architecture

- **Cloudflare Workers**: Edge computing with global distribution
- **Server Functions**: Type-safe RPC between client and server
- **Better Auth**: Secure authentication with session management
- **Drizzle ORM**: Type-safe database operations

### Security Features

- **Individual Use Mode**: Single-user security for personal deployments
- **Role-based Access Control**: Admin and user permissions
- **CSRF Protection**: Request validation and token verification
- **Audit Logging**: Comprehensive action tracking
- **Rate Limiting**: API protection against abuse

### Performance Optimizations

- **Edge Caching**: 60-second market data caching
- **Virtual Scrolling**: Efficient rendering of large datasets
- **Code Splitting**: Optimized bundle loading
- **Database Indexing**: Optimized query performance

## Contributing

### Development Guidelines

1. **Financial Precision**: All calculations use `decimal.js` for accuracy
2. **Tax Compliance**: Maintain strict wash-sale rule adherence
3. **Testing**: Always test in demo mode before production
4. **Error Handling**: Comprehensive error boundaries and logging
5. **Documentation**: Update docs for all API and feature changes

### Code Standards

- Follow existing TypeScript patterns and conventions
- Use exported return types from functions over manual type definitions
- Prefer editing existing files over creating new ones
- Use shadcn/ui components for consistent UI patterns

### Database Migrations

When schema changes are introduced (e.g., adding `user.role` or `audit_log`), apply migrations locally:

```bash
npm run db:migrate
```

If you are running through Caddy/HTTPS and get auth/session issues, ensure you log in on the same origin and that `AUTH_BASE_URL` matches the origin you are using.

## License

This project is licensed under the MIT License. See the `LICENSE` file for details. Copyright © 2025 Daniel Yeoman.
