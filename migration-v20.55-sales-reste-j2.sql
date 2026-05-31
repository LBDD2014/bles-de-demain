-- =====================================================================
-- v20.55 — Conservation 2 jours : colonne reste_j2 dans la table sales
-- =====================================================================
-- Contexte : certains gâteaux se gardent plus d'un jour. L'onglet Ventes
-- ne gérait qu'un seul jour de conservation (Reste J-1). On ajoute une
-- colonne `reste_j2` = quantité gardée pour un 2e jour, placée entre
-- "Reste J-1" et "Perte" dans l'écran.
--
-- Sémantique (validée avec Phil) :
--   - reste_j1 = invendu gardé pour le lendemain (PAS une perte)
--   - reste_j2 = invendu gardé pour un 2e jour    (PAS une perte non plus)
--   - perte    = jeté = la seule vraie perte (comptée dans le %Perte)
--
-- Calcul Vendu côté front (mis à jour en v20.55) :
--   Vendu = Matin (prévis) + Après-midi − Reste J-1 − Reste J-2 − Perte
--
-- Le %Perte ne change pas : il reste basé sur `perte` uniquement.
-- DEFAULT NULL : les anciennes rows restent inchangées (J-2 vide = 0 au calcul).
-- =====================================================================

ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS reste_j2 INTEGER;

-- Vérif post-migration (optionnel) :
-- SELECT date, product_id, matin, aprem, reste_j1, reste_j2, perte
-- FROM sales ORDER BY date DESC LIMIT 20;
