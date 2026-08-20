-- ============================================================================
-- LBDD — migration v20.190 : dispatch bio automatique depuis la tournée livreur
-- À EXÉCUTER DANS SUPABASE *AVANT* de pousser le front (convention LBDD).
-- Idempotent : peut être relancé sans risque.
-- ----------------------------------------------------------------------------
-- Demande Phil (2026-08-20) : « ça éviterait de devoir se taper le dispatch à la main ».
-- Quand le livreur valide la livraison d'une farine bio (Farine Blé Ancien, Farine Petit
-- Épeautre, Huile Bio) à Veigné ou Tours, l'app crée toute seule la ligne de dispatch
-- dans Fabrication (fab_mouvements), avec la quantité RÉELLEMENT livrée convertie en kg/L.
--
-- reappro_id = la ligne de réassort à l'origine du dispatch. Sert à deux choses :
--   1) idempotence — re-valider ne crée pas un second dispatch (index unique)
--   2) annulation — si le livreur dé-valide, on supprime le dispatch correspondant
-- ============================================================================

ALTER TABLE public.fab_mouvements
  ADD COLUMN IF NOT EXISTS reappro_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS fab_mouvements_reappro_uq
  ON public.fab_mouvements (reappro_id)
  WHERE reappro_id IS NOT NULL;

-- Vérification :
-- SELECT column_name, data_type FROM information_schema.columns
--  WHERE table_name = 'fab_mouvements' AND column_name = 'reappro_id';
