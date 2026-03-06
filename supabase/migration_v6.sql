-- ============================================================
-- CampCloud — Migration v6: Kundennummern + Rechnungen
-- Ausführen in: Supabase Dashboard → SQL Editor → "Run"
-- ============================================================

-- ─── Gästenummer (sequenziell pro Campingplatz) ───────────
alter table public.guests
  add column if not exists customer_number integer;

-- Bestehende Gäste bekommen aufsteigende Nummern
do $$
declare
  cg_id uuid;
  counter integer;
  g record;
begin
  for cg_id in select id from public.campgrounds loop
    counter := 1;
    for g in
      select id from public.guests
      where campground_id = cg_id
        and customer_number is null
      order by created_at
    loop
      update public.guests set customer_number = counter where id = g.id;
      counter := counter + 1;
    end loop;
  end loop;
end $$;

-- Trigger: neue Gäste bekommen automatisch die nächste Nummer
create or replace function public.assign_customer_number()
returns trigger language plpgsql as $$
begin
  if new.customer_number is null then
    select coalesce(max(customer_number), 0) + 1
      into new.customer_number
      from public.guests
     where campground_id = new.campground_id;
  end if;
  return new;
end;
$$;

drop trigger if exists set_customer_number on public.guests;
create trigger set_customer_number
  before insert on public.guests
  for each row execute procedure public.assign_customer_number();

-- ─── Buchungsnummer (sequenziell pro Campingplatz) ────────
alter table public.bookings
  add column if not exists booking_number integer;

do $$
declare
  cg_id uuid;
  counter integer;
  b record;
begin
  for cg_id in select id from public.campgrounds loop
    counter := 1;
    for b in
      select id from public.bookings
      where campground_id = cg_id
        and booking_number is null
      order by created_at
    loop
      update public.bookings set booking_number = counter where id = b.id;
      counter := counter + 1;
    end loop;
  end loop;
end $$;

create or replace function public.assign_booking_number()
returns trigger language plpgsql as $$
begin
  if new.booking_number is null then
    select coalesce(max(booking_number), 0) + 1
      into new.booking_number
      from public.bookings
     where campground_id = new.campground_id;
  end if;
  return new;
end;
$$;

drop trigger if exists set_booking_number on public.bookings;
create trigger set_booking_number
  before insert on public.bookings
  for each row execute procedure public.assign_booking_number();

-- ─── Rechnungen ───────────────────────────────────────────
create table if not exists public.invoices (
  id             uuid primary key default uuid_generate_v4(),
  campground_id  uuid references public.campgrounds(id) on delete cascade not null,
  booking_id     uuid references public.bookings(id) on delete set null,
  guest_id       uuid references public.guests(id) on delete set null,
  invoice_number integer not null,
  type           text not null default 'Rechnung' check (type in ('Rechnung','Mahnung')),
  amount         numeric(10,2) default 0,
  issued_date    date not null default current_date,
  due_date       date,
  paid_date      date,
  notes          text,
  created_at     timestamptz default now()
);

alter table public.invoices enable row level security;

create policy "invoices_owner" on public.invoices
  for all using (
    campground_id in (select id from public.campgrounds where owner_id = auth.uid())
  );

-- Rechnungsnummer automatisch vergeben
create or replace function public.assign_invoice_number()
returns trigger language plpgsql as $$
begin
  if new.invoice_number is null or new.invoice_number = 0 then
    select coalesce(max(invoice_number), 0) + 1
      into new.invoice_number
      from public.invoices
     where campground_id = new.campground_id;
  end if;
  return new;
end;
$$;

drop trigger if exists set_invoice_number on public.invoices;
create trigger set_invoice_number
  before insert on public.invoices
  for each row execute procedure public.assign_invoice_number();
