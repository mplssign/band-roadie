#!/usr/bin/env node

/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Read environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  // eslint-disable-next-line no-console
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  try {
    // Read the migration file
    const migrationSQL = fs.readFileSync('supabase/migrations/019_fix_reorder_positions_constraint.sql', 'utf8');
    
    // eslint-disable-next-line no-console
    console.log('Applying migration...');
    // eslint-disable-next-line no-console
    console.log('Migration SQL:', migrationSQL);
    
    // Split into individual statements and execute them
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    for (const statement of statements) {
      // eslint-disable-next-line no-console
      console.log(`Executing: ${statement.substring(0, 100)}...`);
      const { error } = await supabase.rpc('exec_sql', { sql: statement });
      
      if (error) {
        // eslint-disable-next-line no-console
        console.error('Error executing statement:', error);
        if (error.message && !error.message.includes('already exists')) {
          throw error;
        }
      } else {
        // eslint-disable-next-line no-console
        console.log('✓ Statement executed successfully');
      }
    }
    
    // eslint-disable-next-line no-console
    console.log('Migration applied successfully!');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to apply migration:', error);
    process.exit(1);
  }
}

applyMigration();