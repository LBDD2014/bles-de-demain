-- v20.251 — Ardoise des garnitures (focaccias) — demande Phil, 22/09/2026
-- « On fait des focaccias à Veigné (pour Veigné + St-Avertin), à Tours (pour Tours) et
--   au Local (pour les marchés). Je veux marquer les sortes du moment sans que ce soit
--   gravé dans le marbre. Quand il y a des restes le soir, je dois savoir lesquels. »
--
-- ⚠️ À exécuter dans le SQL Editor Supabase AVANT de pousser la v20.251.
-- Pas de DELETE : l'app ne supprime jamais rien dans ces deux tables (on réécrit).

-- 1) L'ardoise : 4 cases par site qui fabrique (veigne | tours | local) et par produit.
--    boutiques = coches des lieux servis, ex. {"saint-avertin": false} (coché par défaut).
create table if not exists public.ardoise_variantes (
  tenant_id  uuid not null default '00000000-0000-0000-0000-000000000001',
  site       text not null,
  product_id text not null,
  slot       int  not null check (slot between 1 and 4),
  nom        text,
  boutiques  jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, site, product_id, slot)
);

-- 2) Le détail par garniture d'un Reste / d'une Perte, avec le NOM du jour
--    (l'historique reste juste quand l'ardoise change).
--    lieu = boutique (veigne, tours, saint-avertin) ou marché (amboise, beaujardin)
--    champ = reste_j1 | reste_j2 | perte (Ventes) · pertes (Tableau marché)
create table if not exists public.variantes_detail (
  tenant_id  uuid not null default '00000000-0000-0000-0000-000000000001',
  lieu       text not null,
  date       date not null,
  product_id text not null,
  champ      text not null,
  slot       int  not null,
  nom        text,
  qty        numeric not null default 0,
  updated_by text,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, lieu, date, product_id, champ, slot)
);

alter table public.ardoise_variantes enable row level security;
alter table public.variantes_detail  enable row level security;
do $$ begin
  create policy "ardoise all" on public.ardoise_variantes for all using(true) with check(true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "variantes all" on public.variantes_detail for all using(true) with check(true);
exception when duplicate_object then null; end $$;

grant select, insert, update on public.ardoise_variantes to anon;
grant select, insert, update on public.variantes_detail  to anon;

-- Vérification
-- select * from public.ardoise_variantes;
