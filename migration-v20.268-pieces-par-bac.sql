-- v20.268 — Pièces par bac, PAR SITE, sur les lignes du Planning (Phil, 30/09/2026)
-- « Pain burger encre de seiche : bacs de 40 pièces à Veigné, de 30 au Local et à Tours »
-- La recette d'un mélange (ex : Pain burger = 2,7 kg de pâte à viennoise par bac) est
-- commune à tous les sites. Pour être juste dans chaque site, la taille du bac devient un
-- réglage de la LIGNE du Planning (donc par site), et le poids d'une pièce est sur la fiche
-- produit (fab_produits.poids_piece_g existe déjà) :
--   pâte par bac = pièces par bac × poids d'une pièce   (sinon : la recette, comme avant)
--
-- ⚠️ À exécuter dans le SQL Editor Supabase AVANT la mise en ligne de la v20.268.
-- Relançable sans risque.

alter table public.fab_planning_lignes
  add column if not exists pieces_par_bac integer;

comment on column public.fab_planning_lignes.pieces_par_bac is
  'v20.268 — nombre de pièces dans un bac pour CE site (ex : 40 à Veigné, 30 au Local) ; vide = on garde la recette';

-- Vérification
-- select site, nom, unite, pieces_par_bac from public.fab_planning_lignes where nom ilike '%burger%' order by site, ordre;
