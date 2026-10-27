-- ============================================================================
-- LBDD — Bilan bio : « ce qui manque, par site » (lecture seule, rien n'est modifié)
-- Phil, 27/10/2026 (contrôle Bureau Veritas) : « je veux savoir ce qu'il manque par site »
-- ----------------------------------------------------------------------------
-- Même calcul que l'onglet 📊 Bilan bio de la Fabrication, à AUJOURD'HUI :
--   départ   = dernier comptage (inventaire) de la farine sur le site, quelle que soit sa date
--   entrées  = bons de livraison + reçu d'un autre site, APRÈS ce comptage
--   sorties  = production validée (recettes, farine du levain comprise) + pesées validées
--              + envoyé à un autre site + pertes, APRÈS ce comptage
--   devrait_rester = départ + entrées − sorties   → négatif = il manque une saisie
-- Une ligne par farine bio × site. Tri : le plus négatif en haut.
-- À coller tel quel dans Supabase → SQL Editor → Run, puis copier le tableau.
-- ============================================================================
with sites(site) as (values ('local'), ('veigne'), ('tours')),
inv as (
  select distinct on (ingredient_id, site) ingredient_id, site, date_inv, qte_reelle_kg
    from fab_inventaires
   order by ingredient_id, site, date_inv desc, id desc
),
base as (
  select i.id as ingredient_id, i.nom, s.site, inv.date_inv, coalesce(inv.qte_reelle_kg, 0) as depart
    from fab_ingredients i
    cross join sites s
    left join inv on inv.ingredient_id = i.id and inv.site = s.site
   where i.bio and i.categorie <> 'levain' and i.actif
),
bons as (
  select b.ingredient_id, b.site, sum(l.quantite_kg) as kg, count(*) as nb
    from base b join fab_livraisons l
      on l.ingredient_id = b.ingredient_id and l.site = b.site and (b.date_inv is null or l.date_livraison > b.date_inv)
   group by 1, 2
),
d_in as (
  select b.ingredient_id, b.site, sum(m.quantite_kg) as kg
    from base b join fab_mouvements m
      on m.ingredient_id = b.ingredient_id and m.site_arrivee = b.site and (b.date_inv is null or m.date_mouvement > b.date_inv)
   group by 1, 2
),
d_out as (
  select b.ingredient_id, b.site, sum(m.quantite_kg) as kg
    from base b join fab_mouvements m
      on m.ingredient_id = b.ingredient_id and m.site_depart = b.site and (b.date_inv is null or m.date_mouvement > b.date_inv)
   group by 1, 2
),
pertes as (
  select b.ingredient_id, b.site, sum(p.quantite_kg) as kg
    from base b join fab_pertes p
      on p.ingredient_id = b.ingredient_id and p.site = b.site and (b.date_inv is null or p.date_perte > b.date_inv)
   group by 1, 2
),
prod as (   -- farine directe des recettes
  select b.ingredient_id, b.site, sum(rl.quantite * p.quantite / nullif(r.rendement_base, 0)) as kg
    from base b
    join fab_production p on p.site = b.site and p.valide and (b.date_inv is null or p.date_prod > b.date_inv)
    join fab_recettes r on r.id = p.recette_id
    join fab_recette_lignes rl on rl.recette_id = r.id and rl.ingredient_id = b.ingredient_id
   group by 1, 2
),
levain as (   -- farine contenue dans le levain (levain = farine × (1 + eau_ratio))
  select b.ingredient_id, b.site, sum(rl.quantite * p.quantite / nullif(r.rendement_base, 0) / (1 + coalesce(li.eau_ratio, 0))) as kg
    from base b
    join fab_production p on p.site = b.site and p.valide and (b.date_inv is null or p.date_prod > b.date_inv)
    join fab_recettes r on r.id = p.recette_id
    join fab_recette_lignes rl on rl.recette_id = r.id
    join fab_ingredients li on li.id = rl.ingredient_id and li.categorie = 'levain' and li.farine_levain_id = b.ingredient_id
   group by 1, 2
),
pesees as (
  select b.ingredient_id, b.site, sum(s.quantite_kg) as kg
    from base b join fab_sorties s
      on s.ingredient_id = b.ingredient_id and s.site = b.site and s.valide and (b.date_inv is null or s.date_sortie > b.date_inv)
   group by 1, 2
)
select
  b.site,
  b.nom                                              as farine,
  coalesce(to_char(b.date_inv, 'DD/MM/YYYY'), 'JAMAIS COMPTÉ') as dernier_comptage,
  round(b.depart)                                    as depart_kg,
  round(coalesce(bons.kg, 0))                        as bons_kg,
  coalesce(bons.nb, 0)                               as nb_bons,
  round(coalesce(d_in.kg, 0))                        as recu_autre_site_kg,
  round(coalesce(d_out.kg, 0))                       as envoye_kg,
  round(coalesce(prod.kg, 0) + coalesce(levain.kg, 0) + coalesce(pesees.kg, 0)) as production_kg,
  round(coalesce(pertes.kg, 0))                      as pertes_kg,
  round(b.depart + coalesce(bons.kg, 0) + coalesce(d_in.kg, 0)
        - coalesce(d_out.kg, 0) - coalesce(prod.kg, 0) - coalesce(levain.kg, 0) - coalesce(pesees.kg, 0) - coalesce(pertes.kg, 0)) as devrait_rester_kg
from base b
left join bons   on bons.ingredient_id   = b.ingredient_id and bons.site   = b.site
left join d_in   on d_in.ingredient_id   = b.ingredient_id and d_in.site   = b.site
left join d_out  on d_out.ingredient_id  = b.ingredient_id and d_out.site  = b.site
left join pertes on pertes.ingredient_id = b.ingredient_id and pertes.site = b.site
left join prod   on prod.ingredient_id   = b.ingredient_id and prod.site   = b.site
left join levain on levain.ingredient_id = b.ingredient_id and levain.site = b.site
left join pesees on pesees.ingredient_id = b.ingredient_id and pesees.site = b.site
where b.date_inv is not null or bons.kg is not null or d_in.kg is not null or d_out.kg is not null
   or prod.kg is not null or levain.kg is not null or pesees.kg is not null or pertes.kg is not null
order by devrait_rester_kg, b.site, b.nom;
