-- =====================================================================
-- v20.5 — Validation explicite de fin de journée
-- =====================================================================
-- Ajoute la colonne `day_closed` à la table sales.
-- Comportement attendu côté front :
--   - Tant que day_closed = false : Vendu et %Perte n'apparaissent pas
--     dans l'onglet Ventes (ni dans le Récap pour cette journée)
--   - Bouton "✓ Valider la journée" passe toutes les rows du jour à
--     day_closed = true et remplit les champs vides (aprem/reste_j1/perte) à 0
--
-- Choix v20.5 : clean slate
-- DEFAULT false s'applique à toutes les rows existantes via ALTER TABLE.
-- Les anciennes "ventes fantômes" (510 baguettes le ven 15 alors qu'on
-- est le 14) disparaîtront donc du Récap après cette migration.
-- =====================================================================

ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS day_closed BOOLEAN NOT NULL DEFAULT false;

-- Vérif post-migration (optionnel, pour ton info) :
-- SELECT date, count(*) FILTER (WHERE day_closed) AS validees,
--                       count(*) FILTER (WHERE NOT day_closed) AS en_attente
-- FROM sales GROUP BY date ORDER BY date DESC LIMIT 14;
