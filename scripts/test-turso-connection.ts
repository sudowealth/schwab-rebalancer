#!/usr/bin/env tsx

import { createClient } from '@libsql/client';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

async function testTursoConnection() {
  const url = process.env.TURSO_CONNECTION_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    console.error(
      '❌ TURSO_CONNECTION_URL and TURSO_AUTH_TOKEN environment variables are required',
    );
    console.log('Please create a .env.local file with your Turso credentials.');
    console.log('See docs/TURSO_SETUP.md for setup instructions.');
    process.exit(1);
  }

  console.log('🔄 Testing Turso connection...');

  try {
    const client = createClient({
      url,
      authToken,
    });

    // Test basic connection
    const result = await client.execute('SELECT 1 as test');
    console.log('✅ Turso connection successful!');
    console.log('📊 Test query result:', result.rows[0]);

    // Test database info
    const dbInfo = await client.execute('SELECT sqlite_version() as version');
    console.log('🗄️  SQLite version:', dbInfo.rows[0].version);

    client.close();
    console.log('🎉 Connection test completed successfully!');
  } catch (error) {
    console.error('❌ Turso connection failed:', error);
    console.log('Please check your TURSO_CONNECTION_URL and TURSO_AUTH_TOKEN values.');
    process.exit(1);
  }
}

testTursoConnection();
