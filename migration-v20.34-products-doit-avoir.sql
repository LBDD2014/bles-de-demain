-- =====================================================================
-- v20.34 — Cible de stock "doit avoir" par boutique × produit
-- =====================================================================
-- Permet de configurer la quantité cible (doit avoir) par boutique
-- destinataire pour chaque produit. Utilisé en Réappro pour calculer
-- automatiquement "à commander" = max(0, cible - j'ai).
--
-- Note : pas besoin d'ajouter "j_ai" : la colonne reappros.avoir existe
-- déjà et joue exactement ce rôle (le code l'utilise comme "stock constaté"
-- saisi par la vendeuse, header colonne renommé "J'ai" en v20.34).
--
-- Format jsonb : { veigne: 70, tours: 24, "saint-avertin": 12, local: 200 }
-- Boutiques absentes = pas de cible (= auto-calc désactivé pour cette
-- boutique). Reste éditable manuellement comme avant.
-- =====================================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS doit_avoir_par_boutique jsonb DEFAULT '{}'::jsonb;

-- VÉRIFICATION POST-MIGRATION (optionnel) :
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_schema='public' AND table_name='products'
--     AND column_name='doit_avoir_par_boutique';
