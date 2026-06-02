-- 08 — Eau du levain (ratio) + réparation de la référence de la recette "Idéal"
-- À EXÉCUTER DANS SUPABASE *AVANT* de déployer le nouveau fabrication.html.
-- Idempotent : peut être relancé sans risque.

-- 1) Nouvelle colonne : eau du levain = combien d'eau pour 1 de farine de levain.
--    0 pour tous les ingrédients normaux (pas d'eau ajoutée).
ALTER TABLE fab_ingredients
  ADD COLUMN IF NOT EXISTS eau_ratio numeric NOT NULL DEFAULT 0;

-- 2) Ratios des levains (ensuite modifiables dans l'app → écran "Gérer").
--    Levain dur T80 = 60 % · Levain liquide = 100 %.
UPDATE fab_ingredients SET eau_ratio = 0.60 WHERE id = 'ing_levain_dur';
UPDATE fab_ingredients SET eau_ratio = 1.00 WHERE id = 'ing_levain_liquide';

-- 3) Réparer la recette "Idéal" : sa "Quantité de référence" avait été mise à 10
--    alors que les lignes sont restées exprimées "pour 1 kg de farine" → fiche 10x trop faible.
--    On remet la référence à 1 (les lignes sont déjà correctes pour 1 kg).
UPDATE fab_recettes SET rendement_base = 1
WHERE actif = true
  AND produit_id = (SELECT id FROM fab_produits WHERE nom = 'Idéal' LIMIT 1);
