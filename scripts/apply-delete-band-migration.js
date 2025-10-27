#!/usr/bin/env node

/**
 * Apply database migration: 013_delete_band_function.sql
 *
 * Usage:
 *   node scripts/apply-delete-band-migration.js
 *
 * Requires:
 *   - NEXT_PUBLIC_SUPABASE_URL environment variable
 *   - SUPABASE_SERVICE_ROLE_KEY environment variable
 */

const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Error: Missing environment variables');
  console.error('Required:');
  console.error('  - NEXT_PUBLIC_SUPABASE_URL');
  console.error('  - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

async function applyMigration() {
  console.log('📦 Loading migration file...');

  const migrationPath = path.join(
    __dirname,
    '..',
    'supabase',
    'migrations',
    '013_delete_band_function.sql',
  );
  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log('🔌 Connecting to Supabase...');
  console.log(`   URL: ${SUPABASE_URL}`);
  console.log('');
  console.log('⚙️  Executing migration SQL directly...');

  // Split SQL by semicolons and execute each statement
  const statements = sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('--'));

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    console.log(`   Executing statement ${i + 1}/${statements.length}...`);

    try {
      // Use Supabase SQL endpoint
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify({ query: stmt }),
      });

      if (!response.ok) {
        // Try alternative: direct query via PostgREST
        console.log('   Trying alternative method...');
        const altResponse = await fetch(`${SUPABASE_URL}/rest/v1/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: SERVICE_KEY,
            Authorization: `Bearer ${SERVICE_KEY}`,
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({ query: stmt }),
        });

        if (!altResponse.ok) {
          const error = await response.text();
          console.error(`❌ Statement ${i + 1} failed:`, error);
          console.error('Statement:', stmt);
          process.exit(1);
        }
      }
    } catch (error) {
      console.error(`❌ Error executing statement ${i + 1}:`, error.message);
      console.error('Statement:', stmt);
      process.exit(1);
    }
  }

  console.log('✅ Migration applied successfully!');
  console.log('');
  console.log('The delete_band function is now available.');
  console.log('You can now delete bands from the Edit Band screen.');
}

applyMigration().catch((err) => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});
