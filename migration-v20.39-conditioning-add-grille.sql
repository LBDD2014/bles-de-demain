-- =====================================================================
-- v20.39 — Ajouter 'grille' à la liste autorisée de conditioning_unit
-- =====================================================================
-- Phil utilise "grille" comme conditionnement pour la pâtisserie (cf. feuille
-- papier réappro Veigné). La CHECK constraint v20.33 ne l'autorisait pas.
--
-- Cette migration drop + recrée la CHECK pour inclure 'grille'.
-- Liste autorisée v20.39 : sac, caisse, seau, carton, piece, kg, L, grille
-- =====================================================================

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_conditioning_unit_chk;

ALTER TABLE public.products
  ADD CONSTRAINT products_conditioning_unit_chk
  CHECK (conditioning_unit IS NULL OR conditioning_unit IN ('sac','caisse','seau','carton','piece','kg','L','grille'));

-- VÉRIFICATION POST-MIGRATION (optionnel) :
-- SELECT pg_get_constraintdef(oid) FROM pg_constraint
--   WHERE conname = 'products_conditioning_unit_chk';
