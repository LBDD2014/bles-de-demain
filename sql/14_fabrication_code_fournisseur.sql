-- ============================================================================
-- LBDD — Module FABRICATION / TRAÇABILITÉ BIO
-- Migration 14 : code article fournisseur sur les ingrédients (optionnel)
-- ----------------------------------------------------------------------------
-- Permet de retrouver une matière par le code du bon de livraison (Girardeau/
-- Suire : ex PF930325 = T150). Optionnel : laissé vide pour les fournisseurs
-- sans code (ex Michel Revault = factures manuscrites).
-- ============================================================================

alter table fab_ingredients add column if not exists code_fournisseur text;

-- Codes posés via API REST (bon Girardeau/Suire du 12/05/26) :
--   ing_graines     = AD036110  (Mélange graines bio)
--   ing_trad_bio    = PF002925  (Far. blé bio Tradibio)
--   ing_trad_conv   = PF011225  (Emilie TF d'exception T65 — Tradition conventionnelle)
--   ing_seigle_t130 = PF905225  (Far. seigle bio T130 meule)
--   ing_t80_bise    = PF930125  (Far. blé bio meule bise)
--   ing_t150        = PF930325  (Far. blé bio meule T150)
-- Éditable dans l'app : Gérer → un ingrédient → champ « Code fournisseur ».

-- ============================================================================
-- FIN migration 14.
-- ============================================================================
