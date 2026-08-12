-- ============================================================================
-- LBDD — migration v20.175 : Découpe des gros pains (marché) + pesée tourtes
-- À EXÉCUTER DANS SUPABASE *AVANT* de pousser le front (convention LBDD).
-- Idempotent : peut être relancé sans risque.
-- ----------------------------------------------------------------------------
-- La pâte part en bacs (6/7/8 kg selon pain). Au marché, un bac est divisé en
-- 4/5/6/7/8 pour faire des grosses pièces. La consigne (« 30 Mathis, 6 à
-- 1,2 kg, le reste coupé en 8 ») était ORALE → elle devient une saisie sur la
-- ligne du Tableau marché, lue au fournil sur Prod. Boulangers.
--
--   products.decoupe_config (jsonb, NULL = pas de découpe pour ce produit) :
--     { "mode": "bac",   "bac_kg": 6 }            → éditeur ÷4…÷8 au marché
--       (bac_kg peut être null : les ÷ marchent, les poids ≈ ne s'affichent pas)
--     { "mode": "pesee", "cru": 1000, "cuit": 800 } → simple rappel visuel
--       « ⚖️ pesée 1 kg cru → 800 g cuit » (ex : Tourtes de Meule)
--
--   market_entries.decoupe (jsonb, NULL = pas de consigne ce jour-là) :
--     { "cuts": [ { "n": 6, "div": 4 } ], "reste": 8 }
--     = 6 pièces en ÷4, le reste des pièces coupé en ÷8
-- ============================================================================

alter table public.products       add column if not exists decoupe_config jsonb;
alter table public.market_entries add column if not exists decoupe        jsonb;

notify pgrst, 'reload schema';

-- Verdict (doit afficher OUI ✓ deux fois)
select
  case when exists (select 1 from information_schema.columns
    where table_name = 'products' and column_name = 'decoupe_config')
  then 'OUI ✓ products.decoupe_config' else 'NON ✗ products.decoupe_config' end as col1,
  case when exists (select 1 from information_schema.columns
    where table_name = 'market_entries' and column_name = 'decoupe')
  then 'OUI ✓ market_entries.decoupe' else 'NON ✗ market_entries.decoupe' end as col2;
