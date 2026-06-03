-- ============================================================================
-- LBDD — Module FABRICATION / TRAÇABILITÉ BIO
-- Migration 13 : décomposition du levain en farine bio (cœur BV)
-- ----------------------------------------------------------------------------
-- Le levain est fait maison → il n'a pas de « reçu ». Pour le bilan, ce qui
-- compte c'est la FARINE BIO qui part dans le levain. On stocke, par levain,
-- la farine bio utilisée. Le front décompose : farine = total ÷ (1 + eau_ratio)
--   - levain dur (eau_ratio 0,6) → T80 Bio Bise   : farine = total ÷ 1,6
--   - levain liquide (eau_ratio 1,0) → T65 Bio    : farine = total ÷ 2
-- Les levains n'apparaissent plus comme lignes du bilan (remplacés par farine).
-- ============================================================================

alter table fab_ingredients add column if not exists farine_levain_id text;

-- Données posées via API REST (pour mémoire) :
--   ing_t65_bio « Farine T65 Bio » (bio) créée
--   ing_levain_dur.farine_levain_id     = 'ing_t80_bise'
--   ing_levain_liquide.farine_levain_id = 'ing_t65_bio'
-- Éditable ensuite dans l'app : Gérer → un levain → champ « Farine du levain ».

-- ============================================================================
-- FIN migration 13.
-- ============================================================================
