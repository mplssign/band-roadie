#!/bin/bash
# Script to apply migration 059_setlist_stats_trigger.sql manually
# Run this if supabase db push fails due to migration history issues

echo "Applying migration 059_setlist_stats_trigger.sql..."
echo ""
echo "To apply this migration, run the SQL in the Supabase Dashboard:"
echo "  1. Go to https://app.supabase.com/project/YOUR_PROJECT_ID/sql/new"
echo "  2. Paste the contents of supabase/migrations/059_setlist_stats_trigger.sql"
echo "  3. Click 'Run'"
echo ""
echo "Alternatively, use psql directly:"
echo "  psql 'postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres' -f supabase/migrations/059_setlist_stats_trigger.sql"
echo ""
echo "After applying, repair the migration history by running:"
echo "  INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('20241223_059_setlist_stats_trigger');"
