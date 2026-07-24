-- v20.144 — Historique des Entrées de production (écrans stock)
-- Permet la colonne « Produit » (cumul semaine/mois) sur Stock Tourier / Boul. Pro / Pât. Veigné.
-- Passée dans Supabase SQL Editor le 2026-07-25.

CREATE TABLE IF NOT EXISTS stock_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  product_id TEXT NOT NULL,
  screen TEXT NOT NULL,          -- 'tourier' / 'veigne_pat' / 'boul_pro'
  qty NUMERIC NOT NULL,
  entered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  entered_by TEXT
);
ALTER TABLE stock_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open_all" ON stock_entries FOR ALL USING (true) WITH CHECK (true);
