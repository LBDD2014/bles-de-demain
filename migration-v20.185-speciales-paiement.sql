-- ============================================================
-- v20.185 — Commandes spéciales : paiement à la prise de commande
-- ============================================================
-- Demande Phil (2026-08-20) : marquer Réglé / Acompte (avec montant)
-- au moment où le client passe sa commande spéciale.
--
-- paiement : null ou 'non_regle' = à régler au retrait (défaut)
--            'acompte'           = acompte versé (montant dans acompte_montant)
--            'regle'             = payé d'avance, rien à encaisser
--
-- ⚠️ À LANCER AVANT le push du code front (règle habituelle).

ALTER TABLE public.special_orders
  ADD COLUMN IF NOT EXISTS paiement TEXT,
  ADD COLUMN IF NOT EXISTS acompte_montant numeric;
