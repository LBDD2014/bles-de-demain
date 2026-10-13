-- v20.273 — Espace client pro, page dédiée pro.html (Phil, 13/10/2026)
-- Un client avec PLUSIEURS établissements livrés au même endroit (Dakota Tours + Dakota Chambray,
-- même patronne) garde une fiche par établissement (ventilation) mais UN SEUL lien : les fiches
-- partagent un « groupe ». Sur sa page, une colonne par établissement ; en base, une commande par fiche.
--
-- ⚠️ À exécuter dans le SQL Editor Supabase AVANT de pousser la v20.273.

alter table public.pros add column if not exists groupe text;

-- Dakota : les deux établissements de Doline
update public.pros set groupe = 'dakota'
 where id in ('dakota_cafe', 'dakota_cafe_chambray_les_tours');
