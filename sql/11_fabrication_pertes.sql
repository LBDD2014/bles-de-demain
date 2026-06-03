-- ============================================================================
-- LBDD — Module FABRICATION / TRAÇABILITÉ BIO
-- Migration 11 : PERTES de matière + intégration au bilan bio
-- ----------------------------------------------------------------------------
-- À exécuter dans Supabase AVANT le push du front (convention LBDD).
-- Une perte = sortie exceptionnelle de matière bio (graines brûlées à la
-- torréfaction, sac percé, farine renversée, périmé…) qui se déduit du stock.
-- Pour BV : colonne « Pertes » distincte dans le bilan = transparence totale.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. TABLE PERTES  (calquée sur fab_livraisons : même brique, sens inverse)
-- ----------------------------------------------------------------------------
create table if not exists fab_pertes (
  id            bigint generated always as identity primary key,
  ingredient_id text not null references fab_ingredients(id),
  site          text not null,           -- lieu de la perte ('local','veigne','tours')
  date_perte    date not null,
  quantite_kg   numeric not null,
  motif         text,                    -- 'Torréfaction','Sac percé','Renversé','Périmé'…
  photo_url     text,                    -- 📷 preuve éventuelle (Supabase Storage 'bons-bio')
  note          text,
  cree_par      text,
  cree_le       timestamptz not null default now()
);
create index if not exists idx_fab_perte_ing  on fab_pertes(ingredient_id);
create index if not exists idx_fab_perte_date on fab_pertes(date_perte);

-- ----------------------------------------------------------------------------
-- 2. RLS — convention LBDD : RLS activée + policy FOR ALL TO anon
-- ----------------------------------------------------------------------------
alter table fab_pertes enable row level security;
drop policy if exists fab_pertes_all on fab_pertes;
create policy fab_pertes_all on fab_pertes for all to anon using (true) with check (true);

-- ----------------------------------------------------------------------------
-- 3. VUE BILAN MATIÈRE BIO — remplacée pour soustraire les pertes
--    Reçu + Disp.+ − Disp.− − Conso − Pertes = stock théorique
--    drop obligatoire : on insère une colonne (perte_kg) AVANT stock_theorique_kg,
--    or CREATE OR REPLACE VIEW interdit de réordonner les colonnes existantes.
-- ----------------------------------------------------------------------------
drop view if exists fab_bilan_matiere;
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
),
perte as (       -- pertes exceptionnelles, par ingrédient × site
  select ingredient_id, site, sum(quantite_kg) as perte_kg
  from fab_pertes group by ingredient_id, site
)
select
  i.id   as ingredient_id,
  i.nom  as ingredient,
  s.site,
  coalesce(r.recu_kg,0)    as recu_kg,
  coalesce(a.arrive_kg,0)  as dispatch_entrant_kg,
  coalesce(pt.parti_kg,0)  as dispatch_sortant_kg,
  coalesce(c.consomme_kg,0) as consomme_kg,
  coalesce(pe.perte_kg,0)  as perte_kg,
  coalesce(r.recu_kg,0) + coalesce(a.arrive_kg,0)
    - coalesce(pt.parti_kg,0) - coalesce(c.consomme_kg,0)
    - coalesce(pe.perte_kg,0) as stock_theorique_kg
from fab_ingredients i
join (
  select ingredient_id, site from recu
  union select ingredient_id, site from arrive
  union select ingredient_id, site from parti
  union select ingredient_id, site from conso
  union select ingredient_id, site from perte
) s on s.ingredient_id = i.id
left join recu   r  on r.ingredient_id  = i.id and r.site  = s.site
left join arrive a  on a.ingredient_id  = i.id and a.site  = s.site
left join parti  pt on pt.ingredient_id = i.id and pt.site = s.site
left join conso  c  on c.ingredient_id  = i.id and c.site  = s.site
left join perte  pe on pe.ingredient_id = i.id and pe.site = s.site
where i.bio = true;

-- ============================================================================
-- FIN migration 11.
-- Après exécution (« success »), le front fabrication.html ajoute l'onglet
-- 🗑️ Pertes et la colonne « Pertes » au tableau du bilan.
-- ============================================================================
