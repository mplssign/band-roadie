#!/bin/bash
source .env.local

# Function to execute SQL
execute_sql() {
  local sql="$1"
  curl -X POST "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql" \
    -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"sql\": \"$sql\"}"
}

echo "Adding setlist_type column..."
execute_sql "ALTER TABLE public.setlists ADD COLUMN IF NOT EXISTS setlist_type TEXT DEFAULT 'regular' CHECK (setlist_type IN ('regular', 'all_songs'));"

echo "Creating index..."
execute_sql "CREATE INDEX IF NOT EXISTS idx_setlists_type_band ON public.setlists(band_id, setlist_type);"

echo "Creating unique constraint..."
execute_sql "CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_all_songs_per_band ON public.setlists(band_id) WHERE setlist_type = 'all_songs';"

echo "Migration complete!"