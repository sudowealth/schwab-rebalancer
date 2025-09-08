# Schwab API Setup Guide

## Prerequisites

1. **Schwab Brokerage Account**: You must have an active Schwab brokerage account to access developer tools.

2. **Schwab Developer Account**: Register at [https://developer.schwab.com/register](https://developer.schwab.com/register)
   - Use your existing Schwab login credentials
   - Complete the developer profile information
   - Accept the Terms of Service

## Application Setup

### 1. Create a New Application

1. Navigate to [https://developer.schwab.com/dashboard/apps](https://developer.schwab.com/dashboard/apps)
2. Click "Create a new app"
3. Fill in the application details:
   - **App Name**: Choose a descriptive name (e.g., "Rebalancer App")
   - **Description**: Brief description of your application
   - **App Type**: Select "Personal Use"

### 2. Configure OAuth Settings

1. In your application settings, configure the OAuth redirect URI:
   - **Callback URL**: `https://127.0.0.1/schwab/callback` (for local development)
   - **Production URL**: `https://{your-domain}.com/schwab/callback`

2. Select the required API products:
   - **Accounts and Trading API** - For account information, balances, and trading
   - **Market Data API** - For real-time quotes and market data

### 3. Obtain Credentials

1. From your application page, copy the following and add them to your `.env.local` file:
   - **App Key (Client ID)**: This will be your `SCHWAB_CLIENT_ID`
   - **Secret**: This will be your `SCHWAB_CLIENT_SECRET`

2. Note the **App Status**:
   - Development apps are limited to your own accounts
   - Production approval required for third-party access

## Environment Configuration

Add the following to your `.env.local` file:

```bash
# Schwab API Credentials
SCHWAB_CLIENT_ID=your_app_key_here
SCHWAB_CLIENT_SECRET=your_secret_here

```

## Authentication Flow

### Local Development

1. Follow the HTTPS setup instructions in `docs/LOCAL_HTTPS_SETUP.md` as Schwab requires HTTPS for OAuth callbacks.

2. Run the development server:

   ```bash
   npm run dev  # Open https://127.0.0.1 in your browser
   ```

3. Test OAuth flow:
   - Navigate to `/data-feeds` and click "Connect Schwab"
   - Complete Schwab login
   - Verify callback handling

## Common Issues

### SSL Certificate Errors

- Sometimes Schwab needs an overnight sync before your SCHWAB_REDIRECT_URI is activated
- Schwab requires HTTPS for OAuth callbacks (see `docs/LOCAL_HTTPS_SETUP.md`)
- Use self-signed certificates for local development (see `docs/LOCAL_HTTPS_SETUP.md`)
- Add certificate exceptions in browser (see `docs/LOCAL_HTTPS_SETUP.md`)

### Account Access

- Development apps only access developer's own accounts (no multi-account access)
- Production approval needed for customer accounts

## Additional Resources

- [Schwab API Documentation](https://developer.schwab.com/products)
- [OAuth 2.0 Guide](https://developer.schwab.com/user-guides/get-started/authenticate-with-oauth)
- [API Reference](https://developer.schwab.com/api-documentation)
- [Support Forum](https://developer.schwab.com/community)

## Support

For API-specific issues:

- Email: [traderapi@schwab.com](mailto:traderapi@schwab.com)
