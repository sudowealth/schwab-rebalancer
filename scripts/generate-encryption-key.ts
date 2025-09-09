#!/usr/bin/env tsx

/**
 * Generate a secure encryption key for the application
 * Run: tsx scripts/generate-encryption-key.ts
 */

import { generateEncryptionKey } from '../src/lib/crypto';

async function main() {
  console.log('🔐 Generating secure encryption key...\n');

  const key = await generateEncryptionKey();

  console.log('✅ Encryption key generated successfully!\n');
  console.log('Add this to your .env.local file:');
  console.log('────────────────────────────────────────────────');
  console.log(`ENCRYPTION_KEY=${key}`);
  console.log('────────────────────────────────────────────────\n');
  console.log('⚠️  IMPORTANT:');
  console.log('1. Keep this key secret and secure');
  console.log('2. Use the same key across all environments that share data');
  console.log('3. Back up this key - losing it means losing access to encrypted data');
  console.log('4. For production, use: wrangler secret put ENCRYPTION_KEY');
}

main().catch(console.error);
