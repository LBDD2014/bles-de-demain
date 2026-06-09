-- ============================================================================
-- LBDD — migration v20.77 : le Stock Pâtissier devient le catalogue de commande
-- À EXÉCUTER DANS SUPABASE *AVANT* de pousser le front (convention LBDD).
-- Idempotent : peut être relancé sans risque.
-- ----------------------------------------------------------------------------
-- Le pâtissier gère ses produits depuis l'écran "Stock Pât." (autonomie, code chef).
-- La liste "Cmd Veigné Pât." des magasins = les produits du stock pâtissier
-- qui sont ACTIFS et AUTORISÉS pour le magasin courant.
--   - actif  : le chef peut désactiver/réactiver un produit (sans le supprimer)
--   - shops  : magasins autorisés à commander ce produit (JSON, ex ["veigne","tours"])
-- Le nom + la catégorie restent sur la table `products` (liée par product_id).
-- ============================================================================

alter table veigne_pat_stock
  add column if not exists actif boolean not null default true;

alter table veigne_pat_stock
  add column if not exists shops jsonb not null default '["veigne","tours","saint-avertin"]'::jsonb;

-- Index léger pour filtrer vite les produits actifs
create index if not exists idx_vps_actif on veigne_pat_stock(actif) where actif;
