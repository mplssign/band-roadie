#!/usr/bin/env node

/**
 * Apply database migration: 012_add_invite_tokens.sql
 *
 * Usage:
 *   node scripts/apply-migration.js
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
    '012_add_invite_tokens.sql',
  );
  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log('🔌 Connecting to Supabase...');
  console.log(`   URL: ${SUPABASE_URL}`);

  // Use Supabase REST API to execute SQL
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }

  console.log('✅ Migration applied successfully!');
  console.log('');
  console.log('Verify:');
  console.log('  1. Go to Supabase Dashboard → Table Editor');
  console.log('  2. Open band_invitations table');
  console.log('  3. Check that "token" column exists');
  console.log('  4. Existing rows should have tokens generated');
}

applyMigration().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
