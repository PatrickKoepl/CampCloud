-- ============================================================
-- CampCloud — Migration v8: Logo-Upload
-- Ausführen in: Supabase Dashboard → SQL Editor → "Run"
-- ============================================================

-- logo_url Spalte für Campingplatz
alter table public.campgrounds
  add column if not exists logo_url text;

-- ── Storage Bucket für Assets ──────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('campground-assets', 'campground-assets', true)
on conflict (id) do nothing;

-- Bestehende Policies entfernen (falls vorhanden) und neu anlegen
do $$ begin
  drop policy if exists "campground_assets_upload" on storage.objects;
  drop policy if exists "campground_assets_read"   on storage.objects;
  drop policy if exists "campground_assets_update" on storage.objects;
end $$;

create policy "campground_assets_upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'campground-assets');

create policy "campground_assets_read"
  on storage.objects for select
  using (bucket_id = 'campground-assets');

create policy "campground_assets_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'campground-assets');
