-- ============================================================
-- CampCloud — Migration v8: Logo-Upload
-- Ausführen in: Supabase Dashboard → SQL Editor → "Run"
-- ============================================================

-- logo_url Spalte für Campingplatz
alter table public.campgrounds
  add column if not exists logo_url text;

-- ── Storage Bucket für Assets ──────────────────────────────────────────────
-- Muss im Supabase Dashboard unter Storage angelegt werden:
-- Name: campground-assets  |  Public: JA  |  Allowed types: image/*

-- Storage-Zugriffsregeln (öffentliches Lesen, Owner darf schreiben)
insert into storage.buckets (id, name, public)
values ('campground-assets', 'campground-assets', true)
on conflict (id) do nothing;

-- Jeder eingeloggte User darf eigene Dateien hochladen
create policy if not exists "campground_assets_upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'campground-assets');

-- Öffentliches Lesen
create policy if not exists "campground_assets_read"
  on storage.objects for select
  using (bucket_id = 'campground-assets');

-- Owner darf überschreiben
create policy if not exists "campground_assets_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'campground-assets');
