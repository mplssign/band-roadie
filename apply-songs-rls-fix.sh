#!/bin/bash

# Apply the songs RLS insert fix migration

SUPABASE_URL="https://nekwjxvgbveheooyorjo.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5la3dqeHZnYnZlaGVvb3lvcmpvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODgyOTM4OCwiZXhwIjoyMDc0NDA1Mzg4fQ.P8CEnYPi7TTXEzD3fswuUWf_nP4GXqjVQd3EZjhUK8k"

echo "Applying songs RLS insert fix..."

# Execute each SQL statement separately
# First: Create the is_band_member function
curl -s -X POST "${SUPABASE_URL}/rest/v1/rpc/exec_sql" \
     -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
     -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
     -H "Content-Type: application/json" \
     -d '{"sql": "CREATE OR REPLACE FUNCTION public.is_band_member(band_uuid UUID) RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT EXISTS ( SELECT 1 FROM band_members WHERE band_id = band_uuid AND user_id = auth.uid() AND status = '\''active'\'' ); $$;"}' && echo "✓ Created is_band_member function"

# Grant execute
curl -s -X POST "${SUPABASE_URL}/rest/v1/rpc/exec_sql" \
     -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
     -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
     -H "Content-Type: application/json" \
     -d '{"sql": "GRANT EXECUTE ON FUNCTION public.is_band_member(UUID) TO authenticated;"}' && echo "✓ Granted execute permission"

# Drop old policy
curl -s -X POST "${SUPABASE_URL}/rest/v1/rpc/exec_sql" \
     -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
     -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
     -H "Content-Type: application/json" \
     -d '{"sql": "DROP POLICY IF EXISTS \"songs: insert if member\" ON songs;"}' && echo "✓ Dropped old policy"

# Create new policy
curl -s -X POST "${SUPABASE_URL}/rest/v1/rpc/exec_sql" \
     -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
     -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
     -H "Content-Type: application/json" \
     -d '{"sql": "CREATE POLICY \"songs: insert if member\" ON songs FOR INSERT TO authenticated WITH CHECK ( band_id IS NOT NULL AND public.is_band_member(band_id) );"}' && echo "✓ Created new insert policy"

# Enable RLS
curl -s -X POST "${SUPABASE_URL}/rest/v1/rpc/exec_sql" \
     -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
     -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
     -H "Content-Type: application/json" \
     -d '{"sql": "ALTER TABLE songs ENABLE ROW LEVEL SECURITY;"}' && echo "✓ Enabled RLS on songs table"

echo ""
echo "Migration complete! Please test bulk add again."
