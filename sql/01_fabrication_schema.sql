-- ============================================================================
-- LBDD — Module FABRICATION / SUIVI PRODUCTION + TRAÇABILITÉ BIO
-- Migration 01 : schéma (tables + vue bilan)
-- ----------------------------------------------------------------------------
-- À exécuter dans Supabase AVANT tout code front (convention LBDD).
-- Préfixe `fab_` pour ne rien heurter des tables existantes.
-- Clés métier en TEXT (convention LBDD : product_id TEXT, jamais UUID).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. FOURNISSEURS
-- ----------------------------------------------------------------------------
create table if not exists fab_fournisseurs (
  id        text primary key,            -- ex : 'four_suire'
  nom       text not null,               -- ex : 'Minoterie Suire'
  actif     boolean not null default true,
  cree_le   timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 2. INGRÉDIENTS (farines, levains, eau, sel, beurre, sucre, œufs, graines…)
--    Le suivi bio = simple filtre `bio = true` sur cette table.
-- ----------------------------------------------------------------------------
create table if not exists fab_ingredients (
  id             text primary key,       -- ex : 'ing_trad_bio', 'ing_t150'
  nom            text not null,           -- ex : 'Tradition Bio'
  categorie      text not null,           -- 'farine','levain','eau','sel','levure',
                                          -- 'sucre','beurre','oeuf','graine','epice','autre'
  bio            boolean not null default false,
  fournisseur_id text references fab_fournisseurs(id),
  unite          text not null default 'kg',   -- 'kg','g','L','piece'
  actif          boolean not null default true,
  cree_le        timestamptz not null default now()
);
create index if not exists idx_fab_ing_bio on fab_ingredients(bio) where bio;

-- ----------------------------------------------------------------------------
-- 3. PRODUITS (pains ; viennoiserie/pâtisserie plus tard)
--    Données reprises de « poids des pains.xlsx ».
-- ----------------------------------------------------------------------------
create table if not exists fab_produits (
  id            text primary key,         -- ex : 'pr_mathis', 'pr_norvegien'
  nom           text not null,
  categorie     text not null default 'pain',   -- 'pain','viennoiserie','patisserie'
  bio           boolean not null default false,
  poids_bac_kg  numeric,                  -- ex : 6
  nb_pieces     integer,                  -- ex : 20
  poids_piece_g numeric,                  -- ex : 400
  actif         boolean not null default true,
  cree_le       timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 4. RECETTES — VERSIONNÉES (immuables : une modif = une nouvelle version)
--    Garantit qu'éditer une recette aujourd'hui ne fausse pas un bilan passé.
--    La version « courante » d'un produit = actif = true.
-- ----------------------------------------------------------------------------
create table if not exists fab_recettes (
  id             bigint generated always as identity primary key,
  produit_id     text not null references fab_produits(id),
  version        integer not null default 1,
  unite_base     text not null default 'bac',  -- 'bac','piece','kg_farine','kg_pate'
  rendement_base numeric,                  -- ex : poids de pâte pour 1 unité de base
  procede        text,                     -- pétrissage / pointage / cuisson… (imprimé sur la fiche)
  hydratation    text,                     -- notes coulage + bassinage
  actif          boolean not null default true,
  cree_le        timestamptz not null default now()
);
-- une seule version active par produit
create unique index if not exists uq_fab_recette_active
  on fab_recettes(produit_id) where actif;

-- ----------------------------------------------------------------------------
-- 5. LIGNES DE RECETTE — quantité d'ingrédient POUR 1 UNITÉ DE BASE
--    Conso réelle = quantite * (quantité produite dans l'unité de base).
-- ----------------------------------------------------------------------------
create table if not exists fab_recette_lignes (
  id            bigint generated always as identity primary key,
  recette_id    bigint not null references fab_recettes(id) on delete cascade,
  ingredient_id text not null references fab_ingredients(id),
  quantite      numeric not null,         -- pour 1 unité de base
  unite         text not null default 'kg'
);
create index if not exists idx_fab_rl_recette on fab_recette_lignes(recette_id);

-- ----------------------------------------------------------------------------
-- 6. LIVRAISONS — entrées tracées (LA brique qui manquait à l'Excel)
--    date, lot, n° bon, photo du bon de livraison.
-- ----------------------------------------------------------------------------
create table if not exists fab_livraisons (
  id             bigint generated always as identity primary key,
  ingredient_id  text not null references fab_ingredients(id),
  fournisseur_id text references fab_fournisseurs(id),
  site           text not null,           -- lieu de réception ('local','veigne','tours'…)
  date_livraison date not null,
  quantite_kg    numeric not null,
  numero_lot     text,
  numero_bon     text,
  photo_url      text,                    -- 📷 bon de livraison (Supabase Storage)
  note           text,
  cree_par       text,
  cree_le        timestamptz not null default now()
);
create index if not exists idx_fab_liv_ing  on fab_livraisons(ingredient_id);
create index if not exists idx_fab_liv_date on fab_livraisons(date_livraison);

-- ----------------------------------------------------------------------------
-- 7. MOUVEMENTS INTERNES — dispatch Local → boutiques
--    (engrain, blés anciens : livrés au Local puis répartis)
-- ----------------------------------------------------------------------------
create table if not exists fab_mouvements (
  id             bigint generated always as identity primary key,
  ingredient_id  text not null references fab_ingredients(id),
  site_depart    text not null,
  site_arrivee   text not null,
  date_mouvement date not null,
  quantite_kg    numeric not null,
  cree_par       text,
  cree_le        timestamptz not null default now()
);
create index if not exists idx_fab_mvt_ing  on fab_mouvements(ingredient_id);
create index if not exists idx_fab_mvt_date on fab_mouvements(date_mouvement);

-- ----------------------------------------------------------------------------
-- 8. PRODUCTION — déclaration quotidienne (TOUTE la prod, bio + conventionnel)
--    quantite exprimée dans l'unité de base de la recette utilisée.
--    recette_id pointe la VERSION exacte utilisée → conso reproductible.
-- ----------------------------------------------------------------------------
create table if not exists fab_production (
  id          bigint generated always as identity primary key,
  produit_id  text not null references fab_produits(id),
  recette_id  bigint references fab_recettes(id),   -- version figée au moment de la saisie
  site        text not null,
  date_prod   date not null,
  quantite    numeric not null,                     -- nb de bacs / pièces / kg selon unite_base
  cree_par    text,
  cree_le     timestamptz not null default now()
);
create index if not exists idx_fab_prod_date on fab_production(date_prod);
create index if not exists idx_fab_prod_site on fab_production(site);

-- ----------------------------------------------------------------------------
-- 9. VUE BILAN MATIÈRE BIO
--    Par ingrédient bio × site : reçu, dispatch in/out, consommé.
--    Le filtrage par période se fait côté front (passe les dates en where).
--    Pour un bilan daté, filtrer ensuite sur les colonnes de date des CTE.
-- ----------------------------------------------------------------------------
create or replace view fab_bilan_matiere as
with
recu as (        -- entrées fournisseur, par ingrédient × site
  select ingredient_id, site, sum(quantite_kg) as recu_kg
  from fab_livraisons group by ingredient_id, site
),
arrive as (      -- dispatch entrant
  select ingredient_id, site_arrivee as site, sum(quantite_kg) as arrive_kg
  from fab_mouvements group by ingredient_id, site_arrivee
),
parti as (       -- dispatch sortant
  select ingredient_id, site_depart as site, sum(quantite_kg) as parti_kg
  from fab_mouvements group by ingredient_id, site_depart
),
conso as (       -- consommé en production = ligne_recette * quantité produite
  select rl.ingredient_id, p.site,
         sum(rl.quantite * p.quantite) as consomme_kg
  from fab_production p
  join fab_recette_lignes rl on rl.recette_id = p.recette_id
  group by rl.ingredient_id, p.site
)
select
  i.id   as ingredient_id,
  i.nom  as ingredient,
  s.site,
  coalesce(r.recu_kg,0)    as recu_kg,
  coalesce(a.arrive_kg,0)  as dispatch_entrant_kg,
  coalesce(pt.parti_kg,0)  as dispatch_sortant_kg,
  coalesce(c.consomme_kg,0) as consomme_kg,
  coalesce(r.recu_kg,0) + coalesce(a.arrive_kg,0)
    - coalesce(pt.parti_kg,0) - coalesce(c.consomme_kg,0) as stock_theorique_kg
from fab_ingredients i
join (
  select ingredient_id, site from recu
  union select ingredient_id, site from arrive
  union select ingredient_id, site from parti
  union select ingredient_id, site from conso
) s on s.ingredient_id = i.id
left join recu   r  on r.ingredient_id  = i.id and r.site  = s.site
left join arrive a  on a.ingredient_id  = i.id and a.site  = s.site
left join parti  pt on pt.ingredient_id = i.id and pt.site = s.site
left join conso  c  on c.ingredient_id  = i.id and c.site  = s.site
where i.bio = true;

-- ----------------------------------------------------------------------------
-- 10. RLS — convention LBDD : RLS activée + policy FOR ALL TO anon
--     (identique aux tables existantes products / pros).
-- ----------------------------------------------------------------------------
alter table fab_fournisseurs    enable row level security;
alter table fab_ingredients     enable row level security;
alter table fab_produits        enable row level security;
alter table fab_recettes        enable row level security;
alter table fab_recette_lignes  enable row level security;
alter table fab_livraisons      enable row level security;
alter table fab_mouvements      enable row level security;
alter table fab_production      enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'fab_fournisseurs','fab_ingredients','fab_produits','fab_recettes',
    'fab_recette_lignes','fab_livraisons','fab_mouvements','fab_production'
  ] loop
    execute format('drop policy if exists %I_all on %I;', t, t);
    execute format('create policy %I_all on %I for all to anon using (true) with check (true);', t, t);
  end loop;
end $$;

-- ============================================================================
-- FIN migration 01. Données (fournisseurs, farines bio, produits, recettes)
-- → migration 02 séparée, importée depuis tes fichiers Excel/Word.
-- ============================================================================
