-- ============================================================
-- CampCloud — Migration: Bild-Upload + Gast-Verknüpfung
-- Ausführen in: Supabase Dashboard → SQL Editor → "Run"
-- ============================================================

-- Storage-Bucket für Campingplatz-Bilder anlegen
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'campground-maps',
  'campground-maps',
  true,
  10485760,  -- 10 MB max
  array['image/jpeg','image/jpg','image/png','image/webp','image/gif']
)
on conflict (id) do nothing;

-- RLS: Nur eingeloggte Nutzer dürfen in ihren eigenen Ordner hochladen
create policy "Authenticated users can upload maps"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'campground-maps' AND auth.uid()::text = (storage.foldername(name))[1]);

-- RLS: Nutzer können ihre eigenen Bilder löschen/ersetzen
create policy "Users can update own maps"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'campground-maps' AND auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can delete own maps"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'campground-maps' AND auth.uid()::text = (storage.foldername(name))[1]);

-- RLS: Bilder sind öffentlich lesbar (für den Browser)
create policy "Public read access for maps"
  on storage.objects for select
  to public
  using (bucket_id = 'campground-maps');
