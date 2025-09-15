# Schwab Portfolio Rebalancing Platform

A portfolio management platform built for rebalancing and tax-loss harvesting with Charles Schwab. The system manages equity portfolios through rebalancing groups and "sleeves" - groups of similar securities that can substitute for each other during rebalancing while maintaining wash-sale compliance and optimal tax efficiency.

## 🚀 One-Click FREE Deployment

Get your own instance running in minutes:

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=YOUR_REPO_URL)

**Why Netlify + Turso?**
- ✅ **100% FREE** (Netlify's free tier + Turso's free database)
- ✅ One-click deploy for both app AND database
- ✅ Global CDN for fast worldwide performance
- ✅ No credit card required to start
- ✅ Distributed SQLite (Turso) - works perfectly with serverless
- ✅ Perfect for low-usage personal apps

[📖 Full Deployment Guide](./DEPLOYMENT.md) | [🎯 Quick Setup](./DEPLOYMENT.md#automated-setup-super-easy)

## Disclaimer

This is an unofficial, community-developed portfolio management platform for interacting with Charles Schwab APIs. It has not been approved, endorsed, or certified by Charles Schwab. It is provided as-is, and its functionality may be incomplete or unstable. Use at your own risk, especially when dealing with financial data or transactions.

## Architecture

- **Frontend**: TanStack Start (React-based SPA) with TailwindCSS and shadcn/ui
- **Backend**: TypeScript/Node.js with server-side rendering
- **Database**: Turso (distributed SQLite) with Drizzle ORM
- **Authentication**: Better Auth with email/password
- **Market Data**: Yahoo Finance API with intelligent caching
- **Trading**: Charles Schwab API integration
- **Deployment**: Netlify/Vercel + Turso (100% free, one-click setup)

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

# Set up Turso database (see docs/TURSO_SETUP.md for detailed instructions)
# After setting up your Turso database and .env.local file:
npm run test-db
npm run db:push

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

- **Turso account** (database already created: `schwab-rebalancer-db`)
- **Netlify or Vercel account** for hosting
- Environment variables configured (see below)

### 1. Environment Setup

Set up your production environment variables in your deployment platform:

```env
# Turso Database (already configured)
TURSO_CONNECTION_URL=libsql://schwab-rebalancer-db-dyeoman2.aws-us-west-2.turso.io
TURSO_AUTH_TOKEN=your_auth_token_here

# Other required environment variables
# (see .env.example for complete list)
```

### 2. Deploy to Netlify/Vercel

#### Option A: Netlify (Recommended)
[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=YOUR_REPO_URL)

1. Connect your GitHub repository
2. Set build command: `npm run build`
3. Set publish directory: `.output/public`
4. Configure environment variables in Netlify dashboard

#### Option B: Vercel
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository=YOUR_REPO_URL)

1. Import your project
2. Vercel will auto-detect TanStack Start
3. Configure environment variables in Vercel dashboard

### 3. Required Environment Variables

Add these to your Netlify/Vercel environment variables:

```env
# Database (already configured)
TURSO_CONNECTION_URL=libsql://schwab-rebalancer-db-dyeoman2.aws-us-west-2.turso.io
TURSO_AUTH_TOKEN=your_auth_token_here

# Authentication
AUTH_BASE_URL=https://your-domain.com
AUTH_SECRET=your_auth_secret_here

# Schwab API
SCHWAB_CLIENT_ID=your_schwab_client_id
SCHWAB_CLIENT_SECRET=your_schwab_client_secret

# Encryption (generate new key for production)
ENCRYPTION_KEY=your_generated_encryption_key
```

### 4. Generate Production Encryption Key

```bash
# Generate a fresh encryption key for production
npm run generate-key
```

### 5. Optional: Email Configuration

For email notifications, add to your environment variables:

```env
RESEND_API_KEY=your_resend_api_key
```

**⚠️ Security Best Practices**:

- **Always use different encryption keys** for development and production environments
- Generate a fresh key for production: `npm run generate-key`
- Never share keys between environments or commit them to version control
- If migrating data from development to production, you'll need to decrypt with the old key and re-encrypt with the new key

### 4. Set up Production Database

```bash
# For Turso, the database schema is pushed directly to your Turso instance
# Make sure your production environment variables are set correctly
npm run db:push:prod

# Optionally seed production data (be careful!)
# npm run seed
```

### 6. Deploy to Netlify/Vercel

Your application will automatically deploy when you push to your main branch on GitHub. The deployment URLs will be:

- **Netlify**: `https://your-app-name.netlify.app`
- **Vercel**: `https://your-app-name.vercel.app`

Monitor deployment status in your chosen platform's dashboard.

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
- `npm run deploy` - Build and deploy to Netlify/Vercel (via Git push)

### Code Quality

- `npm run typecheck` - Run TypeScript type checking
- `npm run lint` - Lint with Biome
- `npm run format` - Format code with Biome
- `npm run check` - Lint + format check (no writes)
- `npm run fix` - Lint + format and apply fixes

### Database Management

- `npm run db:generate` - Generate Drizzle migrations
- `npm run db:push` - Push schema to local Turso database
- `npm run db:push:prod` - Push schema to production Turso database
- `npm run db:studio` - Open Drizzle Studio for database inspection
- `npm run test-db` - Test Turso database connection
- `npm run seed` - Seed database with initial data

### Utilities
- `npm run generate-key` - Generate secure encryption key for environment

## Database Schema

Using **Drizzle ORM** with **Turso** (distributed SQLite). Key entities:

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

- **Netlify/Vercel**: Serverless deployment with global CDN
- **Server Functions**: Type-safe RPC between client and server
- **Better Auth**: Secure authentication with session management
- **Drizzle ORM**: Type-safe database operations with Turso

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
