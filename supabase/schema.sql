-- ============================================================
-- CampCloud — Supabase Datenbankschema
-- Ausführen in: Supabase Dashboard → SQL Editor → "Run"
-- ============================================================

-- Erweiterungen
create extension if not exists "uuid-ossp";

-- ─── Tabellen ─────────────────────────────────────────────

-- Campingplätze (ein Benutzer kann mehrere verwalten)
create table if not exists public.campgrounds (
  id          uuid primary key default uuid_generate_v4(),
  owner_id    uuid references auth.users(id) on delete cascade not null,
  name        text not null,
  email       text,
  phone       text,
  address     text,
  website     text,
  checkin_time  text default '14:00',
  checkout_time text default '11:00',
  currency    text default 'EUR',
  created_at  timestamptz default now()
);

-- Stellplätze / Unterkünfte
create table if not exists public.sites (
  id            uuid primary key default uuid_generate_v4(),
  campground_id uuid references public.campgrounds(id) on delete cascade not null,
  name          text not null,
  area          text not null default 'A',
  type          text not null default 'Stellplatz',
  size          text,
  electric      boolean default true,
  water         boolean default true,
  status        text not null default 'free' check (status in ('free','occupied','blocked')),
  notes         text,
  created_at    timestamptz default now()
);

-- Gäste
create table if not exists public.guests (
  id            uuid primary key default uuid_generate_v4(),
  campground_id uuid references public.campgrounds(id) on delete cascade not null,
  name          text not null,
  email         text,
  phone         text,
  address       text,
  birth_date    date,
  notes         text,
  visits        integer default 0,
  last_visit    date,
  created_at    timestamptz default now()
);

-- Buchungen
create table if not exists public.bookings (
  id            uuid primary key default uuid_generate_v4(),
  campground_id uuid references public.campgrounds(id) on delete cascade not null,
  guest_id      uuid references public.guests(id) on delete set null,
  site_id       uuid references public.sites(id) on delete set null,
  guest_name    text not null,
  email         text,
  site_name     text not null,
  type          text not null default 'Stellplatz',
  arrival       date not null,
  departure     date not null,
  persons       integer default 2,
  status        text not null default 'confirmed' check (status in ('pending','confirmed','arrived','departed','cancelled')),
  payment       text not null default 'pending' check (payment in ('pending','paid','partial')),
  total         numeric(10,2) default 0,
  notes         text,
  created_at    timestamptz default now()
);

-- Preislisten
create table if not exists public.price_lists (
  id            uuid primary key default uuid_generate_v4(),
  campground_id uuid references public.campgrounds(id) on delete cascade not null,
  name          text not null,
  type          text not null default 'Stellplatz',
  base_price    numeric(8,2) default 0,
  per_person    numeric(8,2) default 0,
  electricity   numeric(8,2) default 0,
  active        boolean default true,
  created_at    timestamptz default now()
);

-- ─── Row Level Security (RLS) ─────────────────────────────
-- Jeder Benutzer sieht und verwaltet NUR seine eigenen Daten.

alter table public.campgrounds  enable row level security;
alter table public.sites        enable row level security;
alter table public.guests       enable row level security;
alter table public.bookings     enable row level security;
alter table public.price_lists  enable row level security;

-- Campgrounds: nur der Eigentümer
create policy "campgrounds_owner" on public.campgrounds
  for all using (auth.uid() = owner_id);

-- Sites, Guests, Bookings, Preislisten: über campground_id prüfen
create policy "sites_owner" on public.sites
  for all using (
    campground_id in (select id from public.campgrounds where owner_id = auth.uid())
  );

create policy "guests_owner" on public.guests
  for all using (
    campground_id in (select id from public.campgrounds where owner_id = auth.uid())
  );

create policy "bookings_owner" on public.bookings
  for all using (
    campground_id in (select id from public.campgrounds where owner_id = auth.uid())
  );

create policy "price_lists_owner" on public.price_lists
  for all using (
    campground_id in (select id from public.campgrounds where owner_id = auth.uid())
  );

-- ─── Hilfsfunktion: Campground nach Registrierung anlegen ─
-- Wird per Trigger nach jedem Sign-Up aufgerufen.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.campgrounds (owner_id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'campground_name', 'Mein Campingplatz'),
    new.email
  );
  return new;
end;
$$;

-- Trigger: nach Registrierung
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── Beispieldaten (optional) ────────────────────────────
-- Diese werden NACH der ersten Anmeldung automatisch über
-- die App angelegt. Oder hier manuell einfügen:
-- (Campground-ID erst nach erstem Login bekannt)
