#!/usr/bin/env tsx

/**
 * Generate a secure encryption key for database credential encryption
 * This key encrypts sensitive Schwab API credentials before storing in the database
 * Run: tsx scripts/generate-encryption-key.ts
 */

import { generateSecret } from '../src/lib/crypto';

async function main() {
  console.log('🔐 Generating secure database encryption key for Schwab API credentials...\n');

  const key = await generateSecret(32); // 32 bytes for AES-256 encryption

  console.log('✅ Encryption key generated successfully!\n');
  console.log('Add this to your .env.local file:');
  console.log('────────────────────────────────────────────────');
  console.log(`DB_ENCRYPTION_KEY=${key}`);
  console.log('────────────────────────────────────────────────\n');
  console.log('⚠️  IMPORTANT:');
  console.log('1. This key encrypts Schwab API credentials before database storage');
  console.log('2. Keep this key secret and secure');
  console.log('3. Use the same key across all environments that share encrypted credentials');
  console.log('4. Back up this key - losing it means losing access to encrypted Schwab API tokens');
  console.log(
    '5. For production, set as DB_ENCRYPTION_KEY environment variable in your hosting platform',
  );
}

main().catch(console.error);
