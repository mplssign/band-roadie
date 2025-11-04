#!/bin/bash

# Script to apply song_notes migration directly to Supabase

SUPABASE_URL="https://nekwjxvgbveheooyorjo.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5la3dqeHZnYnZlaGVvb3lvcmpvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODgyOTM4OCwiZXhwIjoyMDc0NDA1Mzg4fQ.P8CEnYPi7TTXEzD3fswuUWf_nP4GXqjVQd3EZjhUK8k"

# Read the migration file
MIGRATION_SQL=$(cat supabase/migrations/019_fix_reorder_positions_constraint.sql)

# Execute the migration using the Supabase REST API
curl -X POST "${SUPABASE_URL}/rest/v1/rpc/exec_sql" \
     -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
     -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
     -H "Content-Type: application/json" \
     -d "{\"sql\": \"${MIGRATION_SQL}\"}"