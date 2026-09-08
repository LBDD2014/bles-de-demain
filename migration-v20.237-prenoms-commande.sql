-- v20.237 — Qui prend la commande, qui la remet (demande Phil, 08/09/2026)
-- « À la prise de commande on doit pouvoir identifier la personne, par son prénom.
--   Je veux pouvoir ajouter autant de prénoms que je veux et les supprimer.
--   Obligatoire. Et pareil à la remise — attention à ne mettre que les prénoms des
--   employés DU magasin. »
--
-- Avant : special_orders.created_by = l'identifiant de la TABLETTE (dev_xxxx), donc
-- deux vendeuses sur la même tablette étaient indiscernables.
--
-- ⚠️ À exécuter dans le SQL Editor Supabase AVANT d'utiliser la nouvelle version.

-- 1) La liste des prénoms, par magasin. Phil ajoute et supprime librement depuis
--    l'écran Spéciales (bouton « ⚙️ Prénoms »). Volontairement séparée de la table
--    `staff` (Équipe/dotations), où l'on ne supprime jamais personne.
create table if not exists public.shop_people (
  id         bigint generated always as identity primary key,
  tenant_id  uuid not null default '00000000-0000-0000-0000-000000000001',
  site       text not null,                 -- veigne | tours | saint-avertin | local
  prenom     text not null,
  ordre      int  not null default 0,
  created_at timestamptz not null default now()
);
create unique index if not exists shop_people_site_prenom_idx
  on public.shop_people (tenant_id, site, lower(prenom));

alter table public.shop_people enable row level security;
do $$ begin
  create policy "shp all" on public.shop_people for all using(true) with check(true);
exception when duplicate_object then null; end $$;

-- Convention sécurité v1b : l'app supprime vraiment des prénoms ici.
grant delete on public.shop_people to anon;

-- 2) Les deux traces sur la commande
alter table public.special_orders
  add column if not exists taken_by text,   -- prénom de qui a PRIS la commande
  add column if not exists given_by text;   -- prénom de qui l'a REMISE au client

-- 3) Amorçage depuis l'Équipe (prénom extrait de « NOM Prénom »), magasins qui
--    prennent des commandes. Phil enlève ensuite ceux qui ne sont jamais au comptoir.
insert into public.shop_people (site, prenom, ordre) values
  ('veigne', 'Thimoty', 10),
  ('veigne', 'Ibrahima', 20),
  ('veigne', 'Noah', 30),
  ('veigne', 'Maorie', 40),
  ('veigne', 'Alexandre', 50),
  ('veigne', 'Jade', 60),
  ('veigne', 'Zora', 70),
  ('veigne', 'Johann', 80),
  ('veigne', 'Mathéo', 90),
  ('veigne', 'Enzo', 100),
  ('veigne', 'Sandra', 110),
  ('veigne', 'Lolly', 120),
  ('tours', 'Lenny', 10),
  ('tours', 'Mamadou', 20),
  ('tours', 'Alexis', 30),
  ('tours', 'Luca', 40),
  ('tours', 'Noé', 50),
  ('tours', 'Eva', 60),
  ('tours', 'Christine', 70),
  ('tours', 'Pierre', 80),
  ('tours', 'Laura', 90),
  ('tours', 'Ambre', 100),
  ('tours', 'Elia', 110),
  ('tours', 'Benoît', 120),
  ('saint-avertin', 'Isabelle', 10),
  ('saint-avertin', 'Mareen', 20),
  ('saint-avertin', 'Alicia', 30)
on conflict do nothing;

-- Vérification
-- select site, count(*) from public.shop_people group by site order by site;
