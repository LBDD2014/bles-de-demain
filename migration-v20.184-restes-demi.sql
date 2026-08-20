-- ============================================================
-- v20.184 — Restes J-1 / J-2 en demi-pièces (ex : 1/2 Fruité)
-- ============================================================
-- Demande Phil (2026-08-19) : pouvoir marquer un demi-produit gardé
-- pour le lendemain (0,5 · 1,5 · 2,5 …) dans l'onglet Ventes.
--
-- Les colonnes étaient en INTEGER : un 0,5 envoyé par l'app aurait
-- été arrondi en silence. On passe en NUMERIC (les valeurs entières
-- existantes sont conservées telles quelles).
--
-- ⚠️ À LANCER AVANT le push du code front (règle habituelle).

ALTER TABLE public.sales
  ALTER COLUMN reste_j1 TYPE numeric USING reste_j1::numeric,
  ALTER COLUMN reste_j2 TYPE numeric USING reste_j2::numeric;

-- Vérification (doit s'exécuter sans erreur et montrer numeric) :
-- SELECT column_name, data_type FROM information_schema.columns
--  WHERE table_name = 'sales' AND column_name IN ('reste_j1','reste_j2');
