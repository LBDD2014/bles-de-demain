-- ============================================================================
-- LBDD — migration v20.78 : aligner le catalogue pâtissier sur tous les produits
-- À EXÉCUTER DANS SUPABASE *AVANT* de pousser le front (convention LBDD).
-- Idempotent (NOT EXISTS) : peut être relancé sans risque.
-- ----------------------------------------------------------------------------
-- But : la commande "Cmd Veigné Pât." doit lister UNIQUEMENT les produits du
-- stock pâtissier. Pour que le chef retrouve tous les gâteaux et puisse
-- (ré)activer ceux qu'il veut, on crée une ligne de stock INACTIVE pour chaque
-- produit pâtisserie qui n'en a pas encore.
--   - actif = false  → n'apparaît PAS dans la commande (mais visible dans le
--                      stock pâtissier, grisé, réactivable d'un clic par le chef)
--   - stock_unit 'piece' par défaut (le chef ajuste grille/pièce + taille ensuite)
-- Les produits déjà suivis (Paris-Brest, etc.) gardent leur ligne actuelle (actifs).
-- ============================================================================

insert into veigne_pat_stock (tenant_id, product_id, stock, stock_unit, actif)
select p.tenant_id, p.id, 0, 'piece', false
from products p
where p.category in ('patisserie_petits', 'patisserie_gros', 'gateaux_secs')
  and p.actif = true
  and not exists (
    select 1 from veigne_pat_stock v
    where v.product_id = p.id and v.tenant_id = p.tenant_id
  );
