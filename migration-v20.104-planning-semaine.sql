-- v20.104 — Planning semaine (grille produits × jours), onglet 📅 Planning du module Fabrication.
-- Lignes gérées par l'utilisateur (ajout/retrait/réordonnancement). Valeurs = texte souple (ex "75+75").
-- Global au fournil (Le Local) — purement visuel, non relié au stock/BV.

create table if not exists public.fab_planning_lignes (
  id         bigint generated always as identity primary key,
  nom        text not null,
  unite      text default 'bacs',   -- bacs | pièces | moules | …
  ordre      int  default 0,         -- pour le tri manuel
  actif      boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.fab_planning_valeurs (
  id         bigint generated always as identity primary key,
  ligne_id   bigint not null references public.fab_planning_lignes(id) on delete cascade,
  date_jour  date not null,
  valeur     text,                   -- texte souple : "40", "75+75", "2 dir"…
  created_at timestamptz not null default now(),
  unique(ligne_id, date_jour)        -- une valeur par ligne et par jour (upsert)
);

alter table public.fab_planning_lignes  enable row level security;
alter table public.fab_planning_valeurs enable row level security;
create policy "fpl all" on public.fab_planning_lignes  for all using(true) with check(true);
create policy "fpv all" on public.fab_planning_valeurs for all using(true) with check(true);
