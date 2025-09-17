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
ppnpm dev
```

#### Database Setup

```bash
# Push schema to database
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

## Contributing

This is a personal project for portfolio management. Feel free to fork and customize for your own use.

## 📄 License

MIT License - See `LICENSE` file for details.
