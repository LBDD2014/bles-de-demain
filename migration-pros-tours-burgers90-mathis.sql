-- ============================================================
-- Pros Tours : burgers 90g (Snak) + Mathis 2,5kg (Miettes) — 2026-06-10
-- Base burger = 90g. On garde aussi le 70g existant.
-- ============================================================

-- 1. Pain Burger 90g : base, général, viennoiserie (frais touriers)
INSERT INTO products (id, tenant_id, name, category, usage, actif, suivi_stock_pro, supply_by_boutique)
VALUES ('pain_burger_90g','00000000-0000-0000-0000-000000000001',
        'Pain Burger 90g','viennoiserie','reappro',true,false,'{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- 2. Burgers colorés : réservés à Snak (pros_only)
INSERT INTO products (id, tenant_id, name, category, usage, actif, suivi_stock_pro, supply_by_boutique, pros_only_id)
VALUES
 ('pain_burger_rouge_90g','00000000-0000-0000-0000-000000000001','Pain Burger Rouge 90g','viennoiserie','reappro',true,false,'{}'::jsonb,'snak'),
 ('pain_burger_noir_90g','00000000-0000-0000-0000-000000000001','Pain Burger Noir 90g','viennoiserie','reappro',true,false,'{}'::jsonb,'snak'),
 ('pain_burger_jaune_90g','00000000-0000-0000-0000-000000000001','Pain Burger Jaune 90g','viennoiserie','reappro',true,false,'{}'::jsonb,'snak')
ON CONFLICT (id) DO NOTHING;

-- 3. Mathis 2,5 kg : réservé à Miettes (pain). Tours autonome → produit À TOURS,
--    donc PAS de suivi dans le Stock Boul. Pro du Local (suivi_stock_pro=false).
INSERT INTO products (id, tenant_id, name, category, usage, actif, suivi_stock_pro, supply_by_boutique, pros_only_id)
VALUES ('mathis_2_5kg','00000000-0000-0000-0000-000000000001',
        'Mathis 2,5 kg','pains','reappro',true,false,'{}'::jsonb,'miettes')
ON CONFLICT (id) DO NOTHING;
