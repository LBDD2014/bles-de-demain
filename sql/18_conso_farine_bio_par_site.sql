-- ============================================================================
-- LBDD — Consommation de FARINE BIO par site, par mois et par semaine (lecture seule)
-- Phil, 27/10/2026 : « notre consommation de farine au mois, seulement les farines bio
-- et les recettes bio, par semaine et par mois, pour chaque site bien distinct »
-- ----------------------------------------------------------------------------
-- Même calcul que le Bilan bio : production VALIDÉE × ligne de recette ÷ rendement de base,
-- + la farine contenue dans les levains (levain = farine × (1 + eau_ratio)).
-- Filtres : farine bio (fab_ingredients.bio, catégorie farine) ET produit bio (fab_produits.bio).
-- Deux tableaux : A) par mois, B) par semaine (semaine ISO, du lundi). Période : 12 derniers mois.
-- À coller dans Supabase → SQL Editor → Run. Le SQL Editor n'affiche que le DERNIER tableau :
-- lance les deux blocs séparément (sélectionne le bloc puis Run).
-- ============================================================================

-- ===== A) PAR MOIS, par site et par farine =====
with conso as (
  select p.site, p.date_prod, i.id as ingredient_id, i.nom as farine,
         rl.quantite * p.quantite / nullif(r.rendement_base, 0) as kg
    from fab_production p
    join fab_recettes r        on r.id = p.recette_id
    join fab_produits pr       on pr.id = r.produit_id and pr.bio
    join fab_recette_lignes rl on rl.recette_id = r.id
    join fab_ingredients i     on i.id = rl.ingredient_id and i.bio and i.categorie = 'farine'
   where p.valide and p.date_prod >= date_trunc('month', current_date) - interval '11 months'
  union all
  select p.site, p.date_prod, i.id, i.nom,
         rl.quantite * p.quantite / nullif(r.rendement_base, 0) / (1 + coalesce(li.eau_ratio, 0))
    from fab_production p
    join fab_recettes r        on r.id = p.recette_id
    join fab_produits pr       on pr.id = r.produit_id and pr.bio
    join fab_recette_lignes rl on rl.recette_id = r.id
    join fab_ingredients li    on li.id = rl.ingredient_id and li.categorie = 'levain'
    join fab_ingredients i     on i.id = li.farine_levain_id and i.bio
   where p.valide and p.date_prod >= date_trunc('month', current_date) - interval '11 months'
)
select to_char(date_trunc('month', date_prod), 'YYYY-MM') as mois,
       site, farine,
       round(sum(kg)) as kg,
       round(sum(kg) / 25, 1) as sacs_25kg,
       count(distinct date_prod) as journees
  from conso
 group by 1, 2, 3
 order by mois desc, site, farine;

-- ===== B) PAR SEMAINE (ISO, du lundi), par site et par farine =====
with conso as (
  select p.site, p.date_prod, i.nom as farine,
         rl.quantite * p.quantite / nullif(r.rendement_base, 0) as kg
    from fab_production p
    join fab_recettes r        on r.id = p.recette_id
    join fab_produits pr       on pr.id = r.produit_id and pr.bio
    join fab_recette_lignes rl on rl.recette_id = r.id
    join fab_ingredients i     on i.id = rl.ingredient_id and i.bio and i.categorie = 'farine'
   where p.valide and p.date_prod >= date_trunc('week', current_date) - interval '12 weeks'
  union all
  select p.site, p.date_prod, i.nom,
         rl.quantite * p.quantite / nullif(r.rendement_base, 0) / (1 + coalesce(li.eau_ratio, 0))
    from fab_production p
    join fab_recettes r        on r.id = p.recette_id
    join fab_produits pr       on pr.id = r.produit_id and pr.bio
    join fab_recette_lignes rl on rl.recette_id = r.id
    join fab_ingredients li    on li.id = rl.ingredient_id and li.categorie = 'levain'
    join fab_ingredients i     on i.id = li.farine_levain_id and i.bio
   where p.valide and p.date_prod >= date_trunc('week', current_date) - interval '12 weeks'
)
select to_char(date_trunc('week', date_prod), 'DD/MM/YYYY') as semaine_du,
       to_char(date_prod, 'IYYY-"S"IW') as semaine_iso,
       site, farine,
       round(sum(kg)) as kg,
       round(sum(kg) / 25, 1) as sacs_25kg,
       count(distinct date_prod) as journees
  from conso
 group by 1, 2, 3, 4
 order by min(date_prod) desc, site, farine;

-- ===== C) TOTAL toutes farines bio, par mois et par site (vue rapide) =====
-- select mois, site, sum(kg) from ( …tableau A… ) group by 1,2 order by 1 desc, 2;
