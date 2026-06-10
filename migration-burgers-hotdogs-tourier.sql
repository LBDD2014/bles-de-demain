-- ============================================================
-- Burgers/hotdogs pros = frais cuits par les touriers (2026-06-10)
-- Pas de stock surgelé (retirés du Stock Boul. Pro). Apparaissent
-- dans Prod. Touriers via les commandes pros (catégorie viennoiserie).
-- ============================================================

-- 1. Créer le burger "sans graines" (2 produits séparés : avec / sans graines)
INSERT INTO products (id, tenant_id, name, category, usage, actif, suivi_stock_pro, supply_by_boutique)
VALUES ('pain_burger_70g_sg', '00000000-0000-0000-0000-000000000001',
        'Pain Burger 70g sans graines', 'viennoiserie', 'reappro', true, false, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- 2. Sortir burgers + hotdog du Stock Boul. Pro (frais cuit à la commande)
UPDATE products SET suivi_stock_pro = false
 WHERE id IN ('pain_burger_70g_ax8dub', 'pain_hotdog_90g_bvoaav');
