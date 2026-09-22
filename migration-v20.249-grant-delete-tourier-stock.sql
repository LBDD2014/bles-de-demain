-- ============================================================================
-- migration v20.249 — autoriser l'app à retirer une ligne du congélo tourier
--
-- Le mode chef du Stock Tourier gagne un bouton 🗑 « retirer du congélo ».
-- Depuis la sécurisation de juillet (migration-securite-v1b), la clé publique
-- n'a plus le droit DELETE que sur une vingtaine de tables ; tourier_stock n'en
-- fait pas partie. Sans cette ligne, le bouton affiche « suppression refusée ».
--
-- Le risque reste faible : tourier_stock ne contient que l'inventaire du
-- congélo (un stock et un mini par produit), pas d'historique. Une ligne
-- retirée par erreur se réinscrit depuis le mode chef, et la sauvegarde
-- nocturne (db_backups, rétention 10 jours) la garde de toute façon.
-- Côté app, le bouton refuse de retirer une ligne dont le stock n'est pas à 0.
-- ============================================================================

grant delete on public.tourier_stock to anon;
