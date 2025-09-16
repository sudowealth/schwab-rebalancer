# Neon PostgreSQL Setup Guide

This guide explains how Neon PostgreSQL is automatically configured with Netlify deployment.

## Automatic Setup (Recommended)

When you deploy to Netlify, the `@netlify/neon` extension automatically:

1. **Creates a Neon PostgreSQL database** for your project
2. **Sets the DATABASE_URL environment variable** automatically
3. **Configures connection pooling** for optimal performance
4. **Handles SSL connections** securely

## Manual Setup (Alternative)

If you need to set up Neon manually:

### 1. Create a Neon Account

1. Go to [Neon Console](https://console.neon.tech)
2. Sign up with your email or GitHub account
3. Create a new project

### 2. Create Database

1. In the Neon console, create a new database
2. Copy the connection string from the dashboard
3. Add it to your environment variables:

```env
DATABASE_URL=postgresql://username:password@hostname/dbname?sslmode=require
```

### 3. Environment Variables

The following environment variables are automatically set by Netlify:

- `DATABASE_URL` - Main database connection string
- `DATABASE_URL_UNPOOLED` - Direct connection (no pooling)

### 4. Database Schema

Push your schema to Neon:

```bash
npm run db:push:prod
```

## Connection Details

- **Database Type**: PostgreSQL 15
- **Connection**: Serverless (auto-scaling)
- **SSL**: Required (automatically enabled)
- **Pooling**: Automatic connection pooling
- **Location**: Global edge network

## Troubleshooting

### Connection Issues

1. **Check Environment Variables**: Ensure `DATABASE_URL` is set correctly
2. **Verify SSL**: Neon requires SSL connections
3. **Check Permissions**: Ensure your database user has proper permissions

### Performance Issues

1. **Connection Pooling**: Use the pooled connection string for better performance
2. **Database Location**: Choose a region close to your users
3. **Compute Settings**: Adjust compute settings based on your usage

## Free Tier Limits

- **Storage**: 0.5 GB
- **Compute Hours**: 100 hours/month
- **Projects**: 1 free project per account

## Support

For Neon-specific issues:
- [Neon Documentation](https://neon.tech/docs)
- [Neon Community](https://community.neon.tech)
