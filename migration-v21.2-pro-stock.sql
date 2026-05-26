-- =====================================================================
-- v21.2 — Stock congelé Boulangers (pour les commandes pros)
-- =====================================================================
-- Les boulangers du Local produisent du pain/petits pains/burger congelés
-- pour les commandes pros. On suit le stock pour anticiper.
--
-- Tables :
--   - pro_stock : 1 ligne par produit suivi, qty courante
--   - pro_stock_movements : log des entrées (production) et sorties (livraisons)
--
-- Colonne marqueur sur products :
--   - suivi_stock_pro : si true, le produit apparaît dans Stock Boul. Pro
--     et déclenche un mouvement -qty à chaque livraison de commande pro
--
-- Politique :
--   - Stock peut descendre en dessous de 0 (autorisé, alerte rouge en UI)
--   - Auto-décrément quand pro_order passe en statut 'livre'
--   - Auto-réincrément si statut repasse de 'livre' à 'confirme' (undo)
-- =====================================================================

-- Stock courant
CREATE TABLE IF NOT EXISTS public.pro_stock (
  tenant_id  uuid NOT NULL,
  product_id text NOT NULL,
  qty        integer NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  updated_by text,
  PRIMARY KEY (tenant_id, product_id)
);

-- Mouvements (traçabilité)
CREATE TABLE IF NOT EXISTS public.pro_stock_movements (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL,
  product_id text NOT NULL,
  qty_delta  integer NOT NULL,        -- positif = production, négatif = livraison
  reason     text NOT NULL,           -- 'production' | 'delivery' | 'delivery_cancel' | 'correction'
  ref_id     text,                    -- pro_order_id si reason in ('delivery', 'delivery_cancel')
  created_at timestamptz DEFAULT now(),
  created_by text
);

CREATE INDEX IF NOT EXISTS idx_pro_stock_movements_product ON public.pro_stock_movements(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pro_stock_movements_ref     ON public.pro_stock_movements(ref_id);

-- RLS
ALTER TABLE public.pro_stock           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pro_stock_movements ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY pro_stock_all           ON public.pro_stock           FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY pro_stock_movements_all ON public.pro_stock_movements FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.pro_stock;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pro_stock_movements;

-- Marqueur sur products : produit suivi en stock pro ?
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS suivi_stock_pro boolean DEFAULT false;

-- VÉRIFICATION POST-MIGRATION (optionnel) :
-- SELECT tablename FROM pg_publication_tables
--   WHERE pubname='supabase_realtime' AND tablename IN ('pro_stock', 'pro_stock_movements');
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name='products' AND column_name='suivi_stock_pro';
