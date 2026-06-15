-- RESET des données d'ESSAI du module Fabrication (avant mise en service réelle).
-- Efface UNIQUEMENT les mouvements (transactions). GARDE le catalogue + recettes.
--
-- ✅ Conservé : fab_ingredients, fab_produits, fab_fournisseurs, fab_recettes, fab_recette_lignes
-- 🗑️ Effacé   : réceptions, production, pertes, dispatch, comptages, pesées
--
-- ⚠️ IRRÉVERSIBLE. À lancer une seule fois, le matin du démarrage réel.

delete from public.fab_sorties;      -- pesées du jour (sorties non-bio)
delete from public.fab_inventaires;  -- comptages physiques
delete from public.fab_mouvements;   -- dispatch inter-sites
delete from public.fab_pertes;       -- pertes
delete from public.fab_production;   -- production du jour
delete from public.fab_livraisons;   -- réceptions (bons de livraison)
