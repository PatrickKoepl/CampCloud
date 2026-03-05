-- ============================================================
-- CampCloud — Migration: Interaktiver Stellplatzplan
-- Ausführen in: Supabase Dashboard → SQL Editor → "Run"
-- ============================================================

-- Koordinaten für Stellplätze auf dem Platzplan (0–100 = Prozent)
ALTER TABLE public.sites
  ADD COLUMN IF NOT EXISTS x_pos float DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS y_pos float DEFAULT NULL;

-- Hintergrundbild-URL für den Platzplan (Luftbild, eigener Plan, etc.)
ALTER TABLE public.campgrounds
  ADD COLUMN IF NOT EXISTS map_bg_url text DEFAULT NULL;
