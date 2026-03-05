-- ============================================================
-- CampCloud — Migration v4: Preise + Kartensymbole
-- Ausführen in: Supabase Dashboard → SQL Editor → "Run"
-- ============================================================

-- ─── Kartensymbole (Bäume, Duschen, Wege etc.) ───────────
create table if not exists public.map_symbols (
  id            uuid primary key default uuid_generate_v4(),
  campground_id uuid references public.campgrounds(id) on delete cascade not null,
  symbol_type   text not null,   -- 'tree','shower','toilet','parking','reception','shop','power','water','fire','playground','trash','road','tent_area'
  label         text,            -- optionale Beschriftung
  x_pos         float not null,
  y_pos         float not null,
  created_at    timestamptz default now()
);

alter table public.map_symbols enable row level security;

create policy "map_symbols_owner" on public.map_symbols
  for all using (
    campground_id in (select id from public.campgrounds where owner_id = auth.uid())
  );

-- ─── Preislisten (Standardpreise) ────────────────────────
-- Diese werden als Startwerte eingefügt wenn der Benutzer
-- zum ersten Mal die Preislisten-Seite öffnet (über die App).
-- Alternativ: manuell hier einfügen nach erster Anmeldung.
-- 
-- Der folgende Block ist ein Beispiel – ersetze CAMPGROUND_ID
-- mit der echten ID aus deinem Campground nach dem Login:
--
-- insert into public.price_lists (campground_id, name, type, base_price, per_person, electricity, active) values
--   ('CAMPGROUND_ID', 'Wohnwagen (inkl. PKW)',    'Stellplatz',     9.00, 0, 0, true),
--   ('CAMPGROUND_ID', 'Wohnmobil bis 8,5m',        'Stellplatz',     9.00, 0, 0, true),
--   ('CAMPGROUND_ID', 'Wohnmobil bis 11m',          'Stellplatz',    10.00, 0, 0, true),
--   ('CAMPGROUND_ID', 'Zelt + PKW',                 'Stellplatz',     7.50, 0, 0, true),
--   ('CAMPGROUND_ID', 'Strompauschale Zelt/PKW',    'Stellplatz',     0.00, 0, 5.00, true),
--   ('CAMPGROUND_ID', 'Strompauschale WW/WM',       'Stellplatz',     0.00, 0, 3.50, true),
--   ('CAMPGROUND_ID', 'Erwachsene',                 'Stellplatz',     0.00, 9.00, 0, true),
--   ('CAMPGROUND_ID', 'Kinder 4–15 Jahre',          'Stellplatz',     0.00, 5.00, 0, true),
--   ('CAMPGROUND_ID', 'Haustiere',                  'Stellplatz',     0.00, 3.00, 0, true);
