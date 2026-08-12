-- ============================================================================
-- LBDD — migration v20.176 : RÉPARATION du Tableau marché (colonnes manquantes)
-- À EXÉCUTER DANS SUPABASE. Idempotent : peut être relancé sans risque.
-- ----------------------------------------------------------------------------
-- BUG constaté le 2026-08-12 : toute saisie du Tableau marché échouait avec
--   « Could not find the 'product_notes' column of 'market_entries' »
-- → la table market_entries contenait 0 ligne : RIEN n'a jamais été enregistré
--   depuis que le front écrit product_notes (note par produit) et note (note du
--   jour). Les 2 colonnes avaient été codées côté app sans migration associée.
--
-- Rien à voir avec la découpe (v20.175) : market_entries.decoupe existe bien.
-- ============================================================================

alter table public.market_entries   add column if not exists product_notes text;
alter table public.market_day_notes add column if not exists note          text;

notify pgrst, 'reload schema';

-- Verdict (doit afficher OUI ✓ deux fois)
select
  case when exists (select 1 from information_schema.columns
    where table_name = 'market_entries' and column_name = 'product_notes')
  then 'OUI ✓ market_entries.product_notes' else 'NON ✗ market_entries.product_notes' end as col1,
  case when exists (select 1 from information_schema.columns
    where table_name = 'market_day_notes' and column_name = 'note')
  then 'OUI ✓ market_day_notes.note' else 'NON ✗ market_day_notes.note' end as col2;
