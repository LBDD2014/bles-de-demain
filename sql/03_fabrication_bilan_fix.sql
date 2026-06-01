-- ============================================================================
-- LBDD — Module FABRICATION : migration 03
-- Corrige le calcul du « consommé » dans la vue bilan :
-- conso = quantité_ligne × (quantité produite / quantité de référence de la recette)
-- (les lignes de recette sont saisies pour rendement_base, pas pour 1 unité)
-- ============================================================================
create or replace view fab_bilan_matiere as
with
recu as (
  select ingredient_id, site, sum(quantite_kg) as recu_kg
  from fab_livraisons group by ingredient_id, site
),
arrive as (
  select ingredient_id, site_arrivee as site, sum(quantite_kg) as arrive_kg
  from fab_mouvements group by ingredient_id, site_arrivee
),
parti as (
  select ingredient_id, site_depart as site, sum(quantite_kg) as parti_kg
  from fab_mouvements group by ingredient_id, site_depart
),
conso as (
  select rl.ingredient_id, p.site,
         sum(rl.quantite * p.quantite / nullif(rec.rendement_base,0)) as consomme_kg
  from fab_production p
  join fab_recettes rec      on rec.id = p.recette_id
  join fab_recette_lignes rl on rl.recette_id = p.recette_id
  group by rl.ingredient_id, p.site
)
select
  i.id as ingredient_id, i.nom as ingredient, s.site,
  coalesce(r.recu_kg,0)     as recu_kg,
  coalesce(a.arrive_kg,0)   as dispatch_entrant_kg,
  coalesce(pt.parti_kg,0)   as dispatch_sortant_kg,
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
