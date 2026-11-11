-- RAPELO - Supabase schema
-- Run this in Supabase dashboard > SQL Editor.

create table if not exists public.fiches_reparation (
  id           bigint generated always as identity primary key,
  created_at   timestamptz not null default now(),

  -- Workshop that owns the ticket
  atelier_nom  text not null,
  atelier_tel  text not null,

  -- Customer + device
  client_nom   text not null,
  client_tel   text not null,
  appareil     text not null,
  probleme     text not null,
  prix_estime  integer not null default 0 check (prix_estime >= 0),
  photo_url    text,

  -- en_cours = in repair, pret = customer notified, livre = handed back
  statut       text not null default 'en_cours'
               check (statut in ('en_cours', 'pret', 'livre')),
  pret_le      timestamptz,
  livre_le     timestamptz
);

-- If the table already existed before the photo feature, add the column:
alter table public.fiches_reparation
  add column if not exists photo_url text;

create index if not exists fiches_reparation_atelier_idx
  on public.fiches_reparation (atelier_tel, statut, created_at desc);

-- Row Level Security
alter table public.fiches_reparation enable row level security;

-- WARNING: these policies let anyone holding the anon key read/insert/update
-- rows. Fine for a pilot. For production, switch to Supabase Auth and restrict
-- rows with `auth.uid()` (see README).
drop policy if exists "rapelo_select" on public.fiches_reparation;
drop policy if exists "rapelo_insert" on public.fiches_reparation;
drop policy if exists "rapelo_update" on public.fiches_reparation;

create policy "rapelo_select" on public.fiches_reparation
  for select to anon using (true);

create policy "rapelo_insert" on public.fiches_reparation
  for insert to anon with check (true);

create policy "rapelo_update" on public.fiches_reparation
  for update to anon using (true) with check (true);

-- ---------- Storage bucket for device photos ----------
insert into storage.buckets (id, name, public)
values ('photos_appareils', 'photos_appareils', true)
on conflict (id) do nothing;

drop policy if exists "rapelo_photos_select" on storage.objects;
drop policy if exists "rapelo_photos_insert" on storage.objects;

create policy "rapelo_photos_select" on storage.objects
  for select to anon using (bucket_id = 'photos_appareils');

create policy "rapelo_photos_insert" on storage.objects
  for insert to anon with check (bucket_id = 'photos_appareils');
