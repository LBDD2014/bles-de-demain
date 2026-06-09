-- ============================================================================
-- LBDD — migration v20.74 : case "Trancher" sur les commandes spéciales (pains)
-- À EXÉCUTER DANS SUPABASE *AVANT* de pousser le front (convention LBDD).
-- Idempotent : peut être relancé sans risque.
-- ----------------------------------------------------------------------------
-- Ajoute un booléen `tranche` sur chaque ligne de commande spéciale.
-- Utilisé seulement pour les produits "pains" côté UI, mais la colonne est
-- générique. Sert pour les fêtes (Noël) et les marchés.
-- ============================================================================

alter table special_order_items
  add column if not exists tranche boolean not null default false;
