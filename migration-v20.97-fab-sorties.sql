-- v20.97 — Pesées/sorties de farines NON-BIO
-- Décompte du stock à la validation de la journée (Scénario A : ce qui est sorti pour produire).
-- Les farines bio restent déduites automatiquement via les recettes (fab_production) — inchangé.

create table if not exists public.fab_sorties (
  id            bigint generated always as identity primary key,
  ingredient_id text        not null,   -- convention LBDD : id produit/ingrédient en TEXT
  site          text        not null,   -- 'local' | 'veigne' | 'tours'
  date_sortie   date        not null,
  quantite_kg   numeric     not null,
  valide        boolean     not null default false,  -- false = brouillon du jour ; true = validé → déduit du stock
  created_at    timestamptz not null default now()
);

alter table public.fab_sorties enable row level security;

create policy "fab_sorties all" on public.fab_sorties
  for all using (true) with check (true);
