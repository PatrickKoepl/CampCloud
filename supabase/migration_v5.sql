-- ============================================================
-- CampCloud — Migration v5: Gezeichnete Flächen
-- Ausführen in: Supabase Dashboard → SQL Editor → "Run"
-- ============================================================

create table if not exists public.map_areas (
  id            uuid primary key default uuid_generate_v4(),
  campground_id uuid references public.campgrounds(id) on delete cascade not null,
  area_type     text not null default 'grass',
  -- 'grass' | 'path' | 'water' | 'site_zone' | 'building'
  label         text,
  points        jsonb not null,   -- [{x: 12.3, y: 45.6}, ...] in Prozent
  created_at    timestamptz default now()
);

alter table public.map_areas enable row level security;

create policy "map_areas_owner" on public.map_areas
  for all using (
    campground_id in (select id from public.campgrounds where owner_id = auth.uid())
  );
