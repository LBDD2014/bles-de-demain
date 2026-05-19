-- =====================================================================
-- v20.33 — Unités de conditionnement par produit
-- =====================================================================
-- Permet de préciser le conditionnement d'un produit :
-- ex: caisse de 70 croissants, sac de 25 kg de farine, carton de 12 tartelettes.
--
-- Champs ajoutés à products :
--   - conditioning_unit text : sac | caisse | seau | carton | piece | kg | L
--   - conditioning_qty  int  : 1 à 200
--
-- Les deux sont nullable : un produit sans conditionnement renseigné continue
-- de s'afficher normalement (rétro-compat avec unit text libre existant).
--
-- Affichage UI : "Croissant (caisse de 70)" quand les deux sont renseignés.
-- =====================================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS conditioning_unit text,
  ADD COLUMN IF NOT EXISTS conditioning_qty  int;

-- Contraintes (DO block pour gérer l'idempotence)
DO $$ BEGIN
  ALTER TABLE public.products
    ADD CONSTRAINT products_conditioning_unit_chk
    CHECK (conditioning_unit IS NULL OR conditioning_unit IN ('sac','caisse','seau','carton','piece','kg','L'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.products
    ADD CONSTRAINT products_conditioning_qty_chk
    CHECK (conditioning_qty IS NULL OR (conditioning_qty >= 1 AND conditioning_qty <= 200));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- VÉRIFICATION POST-MIGRATION (optionnel) :
-- SELECT column_name, data_type, is_nullable FROM information_schema.columns
--   WHERE table_schema='public' AND table_name='products'
--     AND column_name IN ('conditioning_unit', 'conditioning_qty');
