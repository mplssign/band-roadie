#!/bin/bash

# Script to apply migration 019 directly to Supabase

SUPABASE_URL="https://nekwjxvgbveheooyorjo.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5la3dqeHZnYnZlaGVvb3lvcmpvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODgyOTM4OCwiZXhwIjoyMDc0NDA1Mzg4fQ.P8CEnYPi7TTXEzD3fswuUWf_nP4GXqjVQd3EZjhUK8k"

echo "Dropping trigger..."
curl -X POST "${SUPABASE_URL}/rest/v1/rpc/query" \
     -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
     -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
     -H "Content-Type: application/json" \
     -d '{"query": "DROP TRIGGER IF EXISTS reorder_setlist_positions_on_delete ON public.setlist_songs;"}'

echo "Creating new function..."
curl -X POST "${SUPABASE_URL}/rest/v1/rpc/query" \
     -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
     -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
     -H "Content-Type: application/json" \
     -d '{"query": "CREATE OR REPLACE FUNCTION reorder_setlist_positions() RETURNS TRIGGER AS $$ BEGIN UPDATE public.setlist_songs SET position = -(ROW_NUMBER() OVER (ORDER BY position)) WHERE setlist_id = COALESCE(NEW.setlist_id, OLD.setlist_id); WITH ordered_songs AS (SELECT id, ROW_NUMBER() OVER (ORDER BY -position) as new_position FROM public.setlist_songs WHERE setlist_id = COALESCE(NEW.setlist_id, OLD.setlist_id)) UPDATE public.setlist_songs SET position = ordered_songs.new_position FROM ordered_songs WHERE public.setlist_songs.id = ordered_songs.id; RETURN COALESCE(NEW, OLD); END; $$ LANGUAGE plpgsql SECURITY DEFINER;"}'

echo "Creating trigger..."
curl -X POST "${SUPABASE_URL}/rest/v1/rpc/query" \
     -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
     -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
     -H "Content-Type: application/json" \
     -d '{"query": "CREATE TRIGGER reorder_setlist_positions_on_delete AFTER DELETE ON public.setlist_songs FOR EACH ROW EXECUTE FUNCTION reorder_setlist_positions();"}'

echo "Migration complete!"