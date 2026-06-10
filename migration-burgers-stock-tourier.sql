-- ============================================================
-- Pain Burger 70g + Pain hotdog 90g → Stock Tourier (2026-06-10)
-- Viennoiserie faite par les touriers : ils y suivent leur stock.
-- (Le "sans graines" = même produit/option, pas de stock séparé.)
-- ============================================================
INSERT INTO tourier_stock (tenant_id, product_id, stock, mini)
VALUES
 ('00000000-0000-0000-0000-000000000001', 'pain_burger_70g_ax8dub', 0, NULL),
 ('00000000-0000-0000-0000-000000000001', 'pain_hotdog_90g_bvoaav', 0, NULL)
ON CONFLICT (tenant_id, product_id) DO NOTHING;
