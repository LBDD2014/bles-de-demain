-- ============================================================
-- Stock Boul. Pro sur modèle tourier — 2026-06-10
-- Ajoute les colonnes nécessaires. AUCUNE suppression. Idempotent.
-- ============================================================

-- 1. Seuil "Mini" sur le stock pro (modèle Entrée/Stock/Mini/À partir)
ALTER TABLE pro_stock
  ADD COLUMN IF NOT EXISTS mini INTEGER;

-- Reprise : si un seuil existait déjà sur products.seuil_stock, on le copie en mini
UPDATE pro_stock s
   SET mini = p.seuil_stock
  FROM products p
 WHERE p.id = s.product_id
   AND s.mini IS NULL
   AND p.seuil_stock IS NOT NULL;

-- 2. Marquer "préparé" au niveau de chaque ligne de commande pro
ALTER TABLE pro_order_items
  ADD COLUMN IF NOT EXISTS prepared_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS prepared_by TEXT;

-- Note RLS : clé anon a déjà select/insert/update sur ces 2 tables (flux pros existant).
