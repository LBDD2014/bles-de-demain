-- ============================================================
-- products.stock_sort — tri perso des lignes sur les écrans stock
-- (Stock Boul. Pro / Stock Tourier / Stock Pâtissier, flèches ↑/↓).
-- La migration v20.82 n'avait pas été appliquée sur cette base.
-- ============================================================
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS stock_sort INTEGER;
