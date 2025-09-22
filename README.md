# Schwab Portfolio Rebalancing Platform

A portfolio management platform built for rebalancing and tax-loss harvesting with Charles Schwab. The system manages equity portfolios through rebalancing groups and "sleeves" - groups of similar securities that can substitute for each other during rebalancing while maintaining wash-sale compliance and optimal tax efficiency.

## Disclaimer

This is an unofficial, community-developed portfolio management platform for interacting with Charles Schwab APIs. It has not been approved, endorsed, or certified by Charles Schwab. It is provided as-is, and its functionality may be incomplete or unstable. Use at your own risk, especially when dealing with financial data or transactions.

## 🚀 Setup Guide

[![Use this template](https://img.shields.io/badge/Use%20this%20template-2ea44f?style=for-the-badge&logo=github)](https://github.com/sudowealth/schwab-rebalancer/generate)

This creates a fresh copy of the codebase in your GitHub account.

### One-Click Deploy to Netlify (Production)

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start)

**What happens automatically:**

- Connect your GitHub account
- Select your new repository
- Netlify creates a Neon PostgreSQL database
- Generates required secrets (BETTER_AUTH_SECRET, DB_ENCRYPTION_KEY, CRON_KEY)
- Builds and deploys your app
- Sets up automatic deployments on every push

**✅ FREE TIER** - No credit card required. Uses Netlify's free tier + Neon PostgreSQL.

That's it! Your app will be live at `https://your-app-name.netlify.app`

### Local Setup (Development)

#### Prerequisites

- Node.js 22+
- pnpm
- [Neon CLI](https://neon.tech/docs/reference/neon-cli) (`neonctl`)

  **Install neonctl:**

  ```bash
  # Using npm
  npm install -g neonctl

  # Or using Homebrew (macOS/Linux)
  brew install neonctl

  # Or download directly from GitHub releases
  # https://github.com/neondatabase/neonctl/releases
  ```

  **Verify installation:**

  ```bash
  neonctl --version
  ```

##### Installation & Setup

```bash
# Clone your repository
git clone <your-repo-url>
cd schwab-rebalancer

# Install dependencies
pnpm install

# Set up development environment
pnpm run setup

# Start development server
pnpm dev
```

#### Database Setup

This project uses **Neon PostgreSQL** with database branching for safe local development.

##### 1. Authenticate with Neon

```bash
# Login to your Neon account
neonctl auth

# List your projects
neonctl projects list
```

##### 2. Create a Local Development Branch

```bash
# Get your project ID from the list above, then create a branch
neonctl branches create --project-id YOUR_PROJECT_ID --name local
```

This creates an isolated database branch for development that won't affect your production data.

##### 3. Configure Database Connection

After creating the branch, you'll get a connection string. Add it to your `.env.local`:

```bash
# Add to .env.local (created by pnpm run setup)
# For local development with your Neon branch:
NETLIFY_DATABASE_URL=postgresql://neondb_owner:your_password@ep-your-endpoint.neon.tech/neondb?sslmode=require
```

##### 4. Push Schema and Seed Data

```bash
# Push database schema to your local branch
pnpm run db:push

# Seed with sample data
pnpm run seed
```

#### Local HTTPS Setup

For local HTTPS setup see the [Local HTTPS Setup Guide](./docs/LOCAL_HTTPS_SETUP.md).

#### Schwab Integration

For full Schwab API integration see the [Schwab Setup Guide](./docs/SCHWAB_SETUP.md).

## ✨ Key Features

## Portfolio Management

- **Rebalancing Groups**: Custom asset allocations with multiple accounts
- **Smart Sleeves**: Groups of similar securities for tax-efficient trading
- **Real-time Rebalancing**: Automatic portfolio adjustments
- **Multi-Account Support**: Manage multiple brokerage accounts

## Tax Optimization

- **Automated Tax-Loss Harvesting**: Intelligent loss capture and reinvestment
- **Wash-Sale Compliance**: 31-day blocking to prevent violations
- **Tax-Efficient Rebalancing**: Smart substitutions maintaining market exposure

## Trading Integration

- **Schwab API**: Live trading through Charles Schwab accounts
- **Real-time Pricing**: Yahoo Finance data with intelligent caching
- **Order Management**: Advanced order tracking and execution
- **Automatic Data Sync**: 12-hour refresh cycle for portfolio data

## Security

- **Single-User Mode**: Secure personal deployments
- **Role-Based Access**: Admin and user permissions
- **Audit Logging**: Complete action tracking

## Tech Stack

- **Frontend**: TanStack Start + React + TailwindCSS + shadcn/ui
- **Backend**: TypeScript/Node.js with server functions
- **Database**: Neon PostgreSQL (serverless) + Drizzle ORM
- **Auth**: Better Auth with session management
- **Deployment**: Netlify (free tier) + automatic builds

## Usage

### Getting Started

1. **Create an Account**: Register at your deployed URL
2. **Create Rebalancing Groups**: Set up portfolio groups with target allocations
3. **Add Sleeves**: Group similar securities for tax-efficient trading
4. **Connect Schwab** (optional): Link brokerage accounts for live trading

## Core Concepts

- **Rebalancing Groups**: Portfolio containers with custom allocations
- **Sleeves**: 2-3 similar securities that can substitute for each other during tax-loss harvesting
- **Models**: Pre-built allocation templates (Conservative, Moderate, Aggressive)

## Schwab Data Synchronization

The platform automatically synchronizes portfolio data from Charles Schwab with intelligent timing to balance freshness and API usage:

### Sync Triggers

- **Post-OAuth**: Immediate full sync after connecting Schwab account
- **12-Hour Cycle**: Automatic refresh every 12 hours while browser tab is open (on any page)
- **Browser Reopen**: Automatic sync when reopening site after closing browser (if 12+ hours passed)
- **Manual**: User-initiated syncs via Data Feeds page

### Sync Sequence

When a sync runs, it executes in this order:
1. **Accounts** → Fetch account information and create/update local records
2. **Holdings** → Sync current positions and cash balances
3. **Prices** → Update security prices for held positions
4. **Yahoo Fundamentals** → Fetch additional data for missing securities

### Smart Timing

- **Global Hook**: Sync logic runs on every route via root component
- **localStorage Tracking**: Uses timestamps that persist across browser sessions
- **Background Operation**: Syncs happen automatically without user interaction
- **Session Persistence**: Data stays fresh even after closing/reopening browser
- **Error Handling**: Failed syncs don't break the application

### Manual Controls

Users can manually trigger syncs via `/data-feeds` page:
- **All**: Full sequence (accounts → holdings → prices)
- **Accounts**: Account information only
- **Holdings**: Positions and balances only
- **Prices**: Security pricing updates
- **Transactions**: Trade history (last 365 days)

## Contributing

This is a personal project for portfolio management. Feel free to fork and customize for your own use.

## 📄 License

MIT License - See `LICENSE` file for details.
