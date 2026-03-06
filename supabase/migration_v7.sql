-- ============================================================
-- CampCloud — Migration v7: GPS-Koordinaten für OSM-Karte
-- Ausführen in: Supabase Dashboard → SQL Editor → "Run"
-- ============================================================

-- GPS-Koordinaten für den Campingplatz selbst
alter table public.campgrounds
  add column if not exists lat double precision,
  add column if not exists lng double precision;

-- GPS-Koordinaten für Stellplätze (ersetzt x_pos / y_pos)
alter table public.sites
  add column if not exists lat double precision,
  add column if not exists lng double precision;

-- GPS-Koordinaten für Karten-Symbole
alter table public.map_symbols
  add column if not exists lat double precision,
  add column if not exists lng double precision;
