#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-var-requires, no-console, no-unused-vars */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Load environment variables
const path = require('path');

const envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf8');
  envFile.split('\n').forEach(line => {
    if (line && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length) {
        process.env[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
} else {
  console.log('Running without .env.local, using environment variables directly');
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  try {
    const migrationFile = process.argv[2] || '009_fix_setlist_songs_rls_policy.sql';
    console.log(`Applying migration: ${migrationFile}...`);
    
    const migrationSQL = fs.readFileSync(`./lib/supabase/migrations/${migrationFile}`, 'utf8');
    
    const { error } = await supabase.rpc('exec_sql', { sql: migrationSQL });
    
    if (error) {
      console.error('Migration failed:', error);
      process.exit(1);
    }
    
    console.log('Migration applied successfully!');
  } catch (err) {
    console.error('Error running migration:', err.message);
    process.exit(1);
  }
}

runMigration();