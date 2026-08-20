-- ============================================================
-- v20.188 — Conditionnements : ajout de « bidon » et « bib »
-- ============================================================
-- Demande Phil (2026-08-20) : la Farine Petit Épeautre arrive en
-- « bidon bleu de 25 kg » et l'Huile Bio en « BIB » (3 L, 5 L, 10 L).
-- La contrainte n'autorisait que sac/caisse/seau/carton/piece/kg/L/grille.
--
-- ⚠️ À LANCER AVANT le push du code front (règle habituelle).

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_conditioning_unit_chk;

ALTER TABLE public.products
  ADD CONSTRAINT products_conditioning_unit_chk
  CHECK (conditioning_unit IS NULL OR conditioning_unit IN
    ('sac','caisse','seau','carton','piece','kg','L','grille','bidon','bib'));
