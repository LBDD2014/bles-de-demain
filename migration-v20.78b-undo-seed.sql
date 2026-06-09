-- ============================================================================
-- LBDD — migration v20.78b : annuler l'import de catalogue (v20.78)
-- À exécuter dans Supabase. Idempotent.
-- ----------------------------------------------------------------------------
-- Choix Phil (A) : Stock Pât. = uniquement les produits gérés par le pâtissier.
-- On retire les lignes créées par le seed v20.78 (signature exacte : inactives,
-- stock_unit 'piece', stock 0, sans nb de pièces). Les vrais produits suivis
-- (actifs, ou grille, ou unit_pieces renseigné) ne sont PAS touchés.
-- ============================================================================

delete from veigne_pat_stock
where actif = false
  and stock_unit = 'piece'
  and coalesce(stock, 0) = 0
  and unit_pieces is null;
