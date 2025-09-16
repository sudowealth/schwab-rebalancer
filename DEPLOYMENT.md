# 🚀 One-Click FREE Deployment Guide

This guide shows you how to deploy your own instance of the Schwab Rebalancer application **for FREE** with one-click setup using **Netlify + Neon PostgreSQL**.

**⚠️ Important**: Neon PostgreSQL is automatically configured with Netlify deployment - no manual database setup required!

## 🎯 Quick Start (100% FREE Option)

### Netlify + Neon PostgreSQL - Most Recommended ⭐
[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=YOUR_REPO_URL)

**Why Netlify + Neon PostgreSQL?**
- ✅ **100% FREE** (Netlify's free tier + Neon's free PostgreSQL)
- ✅ One-click deploy for both app AND database
- ✅ Global CDN for fast worldwide performance
- ✅ No credit card required to start
- ✅ Perfect for low-usage personal apps

### Alternative FREE Options

### Vercel + Neon PostgreSQL
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository=YOUR_REPO_URL)
- ✅ Free tier available
- ✅ Global CDN performance
- ✅ Built-in database support
- ✅ Zero-config deployment

## 🗄️ Why Neon PostgreSQL? (Better than Local SQLite)

### ❌ **Local SQLite WON'T Work on Netlify**
- **Serverless functions** are stateless - each request gets a fresh environment
- **No persistent file storage** between function calls
- **SQLite files get recreated** on every request
- **Data is lost** between API calls

### ✅ **Neon PostgreSQL Solves This Perfectly**
- **Serverless PostgreSQL** with automatic connection pooling
- **Persistent data** across all serverless functions
- **Global edge network** for fast worldwide access
- **Free tier**: 0.5GB storage, 100 hours compute time/month
- **PostgreSQL-compatible** - industry standard database

## Manual Setup (Alternative)

### Prerequisites
- Node.js 18+
- GitHub account
- Database (PostgreSQL for production)

### Step 1: Fork & Clone
```bash
# Fork this repository on GitHub
# Then clone your fork
git clone https://github.com/YOUR_USERNAME/schwab-rebalancer.git
cd schwab-rebalancer
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Environment Setup
```bash
cp .env.example .env.local
# Edit .env.local with your values
```

### Step 4: Secrets & Database Setup
```bash
# Generate CRON_KEY, DB_ENCRYPTION_KEY, BETTER_AUTH_SECRET
npm run generate-secrets

# Push database schema
npm run db:generate
npm run db:migrate
```

### Step 5: Deploy
Choose your platform:

**Render:**
```bash
# Connect GitHub repo to Render
# Set build command: npm run build
# Set start command: npm start
```

## Environment Variables Required

| Variable | Description | Required |
|----------|-------------|----------|
| `BETTER_AUTH_SECRET` | Session signing secret (Better Auth) | Yes |

**Note:** Base URL is auto-detected at runtime.
| `DATABASE_URL` | Database connection | Yes |
| `CRON_KEY` | Protects scheduled worker endpoints | Yes |
| `DB_ENCRYPTION_KEY` | Encrypts sensitive API credentials before database storage | Yes |

## 🎯 Automated Setup (Super Easy!)

After connecting your GitHub repo to Netlify:

1. **Deploy your app** with one click
2. **Set up Neon database** (we'll create this together)
3. **Configure environment variables** in Netlify dashboard

### Neon Database Setup (2 minutes)

#### Option A: Using Neon CLI (Recommended)

1. **Install Neon CLI:**
   ```bash
   # macOS
   brew install neondatabase/tap/neon

   # Linux/Windows (WSL)
   curl -sSL https://get.neon.tech | bash
   ```

2. **Authenticate with Neon:**
   ```bash
   neon auth login
   ```

3. **Create your database:**
   ```bash
   neon db create schwab-rebalancer
   ```

4. **Get your database URL and create auth token:**
   ```bash
   # Show database info
   neon db show schwab-rebalancer

   # Create auth token (copy this for your environment variables)
   neon db tokens create schwab-rebalancer
   ```

#### Option B: Using Neon Dashboard (Alternative)

1. **Go to [Neon Dashboard](https://neon.dev)**
2. **Create a new database** named `schwab-rebalancer`
3. **Copy the database URL** from the dashboard
4. **Generate an auth token** from the database settings

### Netlify Environment Variables

In your Netlify dashboard, add these variables:

| Variable | Value | Description |
|----------|--------|-------------|
| `DATABASE_URL` | `postgresql://schwab-rebalancer-[username].neon.io` | From `neon db show` |
| `DATABASE_AUTH_TOKEN` | `eyJhbGc...` | From `neon db tokens create` |
| `BETTER_AUTH_SECRET` | `base64url-secret` | `npm run generate-secrets` |
| `CRON_KEY` | `base64url-secret` | `npm run generate-secrets` |
| `DB_ENCRYPTION_KEY` | `base64-secret` | `npm run generate-secrets` |

### Database Migration

After deployment, run the database migration:

```bash
# Push schema to Neon
pnpm run db:push

# Or generate and apply migrations
pnpm run db:generate
```

### Neon CLI Commands Reference

```bash
# Authentication
neon auth login              # Login to Neon
neon auth signup            # Create new account

# Database Management
neon db create <name>       # Create database
neon db show <name>         # Show database info
neon db list               # List all databases
neon db shell <name>       # Open SQL shell

# Tokens
neon db tokens create <name>    # Create auth token
neon db tokens list <name>      # List tokens
neon db tokens revoke <name> <id> # Revoke token

# Groups (for multi-region)
neon group create <name>    # Create group
neon group list            # List groups
```

### Automated Setup Script

For advanced users, run this after deployment:
```bash
npm run setup-app
```

This script will:
- ✅ Validate your environment variables
- ✅ Generate secrets automatically
- ✅ Set up your database schema
- ✅ Seed initial data
- ✅ Configure authentication

## Support

Need help? Check our [troubleshooting guide](./docs/TROUBLESHOOTING.md) or open an issue.
