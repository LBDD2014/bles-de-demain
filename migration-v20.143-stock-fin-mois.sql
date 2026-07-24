-- v20.143 — Colonne « Fin stock » sur les écrans Stock (Tourier / Boul. Pro / Pât. Veigné)
-- Prévision mensuelle manuelle (optionnelle, sinon calcul auto sur 28 jours)
-- + seuil « trop d'avance » par produit (NULL = défaut 21 jours)

ALTER TABLE products ADD COLUMN IF NOT EXISTS conso_mois_manuel NUMERIC;
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_avance_max_jours INTEGER;

-- Produits qui supportent 2 mois de congélateur : cannelés, tartes/tartelettes (dont pommes), nougats de Tours
-- Exclusions :
--  - '%cannelle%' : Brioche Cannelle = viennoiserie → 3 semaines
--  - '%fraise%'   : tartes/tartelettes aux fraises = produits FRAIS jamais congelés
--  - '%vigneronne%' : dérivé de la tarte aux pommes, pas dans le stock congélateur
UPDATE products
SET stock_avance_max_jours = 60
WHERE (
     (name ILIKE '%cannel%' AND name NOT ILIKE '%cannelle%')
  OR (name ILIKE '%tarte%' AND name NOT ILIKE '%fraise%' AND name NOT ILIKE '%vigneronne%')
  OR name ILIKE '%nougat%'
);

-- Correctif si une version précédente de cette migration a déjà été passée :
-- remet à NULL (= défaut 21 j) les exclusions
UPDATE products
SET stock_avance_max_jours = NULL
WHERE name ILIKE '%fraise%' OR name ILIKE '%vigneronne%';

-- Vérification : doit lister Cannelés, Nougats, Tartes/Tartelettes — PAS Brioche Cannelle
SELECT id, name, category, stock_avance_max_jours
FROM products
WHERE stock_avance_max_jours IS NOT NULL
ORDER BY name;
