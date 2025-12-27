-- ============================================================================
-- MIGRATION: Add user_band_roles table for band-specific role assignments
-- 
-- PURPOSE:
-- Allows users in multiple bands to have different roles per band.
-- Previously, roles were global (stored in public.users.roles), which caused
-- "role bleeding" across bands.
--
-- DATA MODEL:
-- - user_band_roles: Stores per-band role assignments
-- - Unique constraint on (user_id, band_id) ensures one row per user per band
-- - roles is text[] to support multiple roles per band
--
-- MIGRATION/COMPAT:
-- - When first accessing a band in multi-band mode, the app will seed
--   user_band_roles.roles from the user's global roles if no row exists
-- - This happens at app level, not database level
-- ============================================================================

-- Create the user_band_roles table
create table if not exists public.user_band_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  band_id uuid not null references public.bands(id) on delete cascade,
  roles text[] not null default '{}',
  updated_at timestamptz not null default now(),
  unique (user_id, band_id)
);

-- Create indexes for efficient lookups
create index if not exists idx_user_band_roles_user_id on public.user_band_roles(user_id);
create index if not exists idx_user_band_roles_band_id on public.user_band_roles(band_id);

-- Enable RLS
alter table public.user_band_roles enable row level security;

-- Drop existing policies if they exist (for idempotent migrations)
drop policy if exists "ubr: select own" on public.user_band_roles;
drop policy if exists "ubr: insert own" on public.user_band_roles;
drop policy if exists "ubr: update own" on public.user_band_roles;

-- RLS Policy: Users can only SELECT their own rows
create policy "ubr: select own"
on public.user_band_roles for select
using (user_id = auth.uid());

-- RLS Policy: Users can only INSERT their own rows
create policy "ubr: insert own"
on public.user_band_roles for insert
with check (user_id = auth.uid());

-- RLS Policy: Users can only UPDATE their own rows
create policy "ubr: update own"
on public.user_band_roles for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- ============================================================================
-- BANDMATES READ POLICY
-- Allow band members to read roles of other members in the same band
-- (needed for Members screen to display roles)
-- ============================================================================

drop policy if exists "ubr: select bandmates" on public.user_band_roles;

create policy "ubr: select bandmates"
on public.user_band_roles for select
using (
  exists (
    select 1 from public.band_members bm
    where bm.band_id = user_band_roles.band_id
      and bm.user_id = auth.uid()
      and bm.status in ('active', 'invited')
  )
);
