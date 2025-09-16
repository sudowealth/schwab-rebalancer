#!/usr/bin/env tsx

/**
 * Generate all required secrets for local development using unified cryptographically secure generation.
 * - DB_ENCRYPTION_KEY: 32 bytes for AES-256 encryption of Schwab API credentials
 * - CRON_KEY: 32 bytes for API worker authentication
 * - BETTER_AUTH_SECRET: 32 bytes for session signing
 * Run: tsx scripts/generate-secrets.ts
 */

import { generateSecret } from '../src/lib/crypto';

async function main() {
  console.log('🔐 Generating secrets for local development...\n');

  const [encryptionKey, cronKey, authSecret] = await Promise.all([
    generateSecret(32), // DB_ENCRYPTION_KEY: 32 bytes for AES-256
    generateSecret(32), // CRON_KEY: 32 bytes for API auth
    generateSecret(32), // BETTER_AUTH_SECRET: 32 bytes for session signing
  ]);

  console.log(
    'Add these to your .env.local (or set as environment variables in your hosting platform):',
  );
  console.log('────────────────────────────────────────────────');
  console.log(`CRON_KEY=${cronKey}`);
  console.log(`DB_ENCRYPTION_KEY=${encryptionKey}`);
  console.log(`BETTER_AUTH_SECRET=${authSecret}`);
  console.log('────────────────────────────────────────────────\n');
  console.log('📌 Tips:');
  console.log('- Keep these values secret and back them up if they guard real data.');
  console.log('- DB_ENCRYPTION_KEY encrypts Schwab API credentials before database storage.');
  console.log('- Re-run the script anytime you need to rotate a key.');
  console.log(
    '- Use the same DB_ENCRYPTION_KEY in environments that read existing encrypted Schwab API tokens.',
  );
}

main().catch((error) => {
  console.error('\n❌ Failed to generate secrets');
  console.error(error);
  process.exit(1);
});
