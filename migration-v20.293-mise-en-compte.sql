-- =====================================================================
-- v20.293 — Commandes pros : « 💶 Mise en compte » (Phil, 26/10/2026)
-- =====================================================================
-- « C'est notre façon à nous de dire que c'est entré dans la caisse. »
-- Un bouton sur chaque commande pro dans l'onglet Pros de la boutique qui la
-- prépare ; une alerte dans le bandeau « oublis à rattraper » à partir de 17h
-- (ou dès que les ventes du jour sont validées) tant que ce n'est pas fait.
-- Sans risque : deux colonnes vides ajoutées, rien de supprimé.

ALTER TABLE public.pro_orders
  ADD COLUMN IF NOT EXISTS mise_en_compte_at timestamptz,
  ADD COLUMN IF NOT EXISTS mise_en_compte_by text;
COMMENT ON COLUMN public.pro_orders.mise_en_compte_at IS 'v20.293 — passée en caisse (mise en compte) à cette heure ; null = pas encore';
COMMENT ON COLUMN public.pro_orders.mise_en_compte_by IS 'v20.293 — boutique qui a mis en compte (veigne / tours / local)';

-- Vérification
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'pro_orders' AND column_name LIKE 'mise_en_compte%';
