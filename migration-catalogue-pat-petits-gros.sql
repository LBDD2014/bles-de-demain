-- ============================================================
-- Catalogue Stock Pât. (Veigné pâtissier) — mise à jour 2026-06-10
-- AUCUNE SUPPRESSION. Uniquement : créations, branchements (veigne_pat_stock),
-- 1 renommage, et activations/désactivations.
-- Toutes les commandes sont ré-exécutables sans danger (ON CONFLICT DO NOTHING).
-- ============================================================

-- Raccourci tenant
-- tenant_id = 00000000-0000-0000-0000-000000000001

-- ------------------------------------------------------------
-- 1) PETITS — réparer les 4 "orphelins" : les lignes de stock
--    cca / eca / ech / tcm existent déjà, mais le produit manquait.
--    On crée les produits côté RÉASSORT (usage='reappro') pour ne PAS
--    dupliquer dans le catalogue Ventes (où vivent déjà vpg_eca, etc.).
-- ------------------------------------------------------------
INSERT INTO products (id, tenant_id, name, category, usage, actif, supply_by_boutique)
VALUES
 ('cca','00000000-0000-0000-0000-000000000001','Cœur Caramel','patisserie_petits','reappro',true,
   '{"veigne":"on_site","tours":"veigne","saint-avertin":"veigne"}'::jsonb),
 ('eca','00000000-0000-0000-0000-000000000001','Éclair Café','patisserie_petits','reappro',true,
   '{"veigne":"on_site","tours":"veigne","saint-avertin":"veigne"}'::jsonb),
 ('ech','00000000-0000-0000-0000-000000000001','Éclair Choco','patisserie_petits','reappro',true,
   '{"veigne":"on_site","tours":"veigne","saint-avertin":"veigne"}'::jsonb),
 ('tcm','00000000-0000-0000-0000-000000000001','Tartelette Citron Meringuée','patisserie_petits','reappro',true,
   '{"veigne":"on_site","tours":"veigne","saint-avertin":"veigne"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- 2) PETITS — renommer "Fingers Pistache" en "Stick Pistache"
-- ------------------------------------------------------------
UPDATE products
   SET name = 'Stick Pistache'
 WHERE id = 'fingers_noisettes_copie_430e5a';

-- ------------------------------------------------------------
-- 3) GROS — passer en usage='both' les 4 produits "ventes" seuls
--    (pour qu'ils remontent aussi dans Cmd Veigné Pât / réassort)
-- ------------------------------------------------------------
UPDATE products SET usage = 'both'
 WHERE id IN (
   '100_vanille_4_pers_copie_nqt1qx', -- Exotique 4 pers
   'exotique_4_pers_copie_o8nr9o',    -- Exotique 6 pers
   'rouge_plaisir_copie_m5do6c',      -- 100% Vanille 4 pers
   'rouge_plaisir_copie_copi_m8zkxt'  -- 100% Vanille 6 pers
 );

-- ------------------------------------------------------------
-- 4) GROS — créer le seul produit manquant : Paris-Brest 8 pers
-- ------------------------------------------------------------
INSERT INTO products (id, tenant_id, name, category, unit, usage, actif, supply_by_boutique)
VALUES
 ('pb8','00000000-0000-0000-0000-000000000001','Paris-Brest 8 pers','patisserie_gros','pièce','both',true,
   '{"veigne":"on_site","tours":"veigne","saint-avertin":"veigne"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- 5) BRANCHER au Stock Pât. (veigne_pat_stock) — actif + 3 magasins
--    PETITS (grille de 28)
-- ------------------------------------------------------------
INSERT INTO veigne_pat_stock (tenant_id, product_id, stock, actif, shops, stock_unit, unit_pieces)
VALUES
 ('00000000-0000-0000-0000-000000000001','fruit_rouge_copie_avsrk9',0,true,'["veigne","tours","saint-avertin"]'::jsonb,'grille',28), -- 100% Vanille (petit)
 ('00000000-0000-0000-0000-000000000001','fingers_noisettes_copie_430e5a',0,true,'["veigne","tours","saint-avertin"]'::jsonb,'grille',28) -- Stick Pistache
ON CONFLICT (tenant_id, product_id) DO NOTHING;

-- ------------------------------------------------------------
--    GROS (pièce)
-- ------------------------------------------------------------
INSERT INTO veigne_pat_stock (tenant_id, product_id, stock, actif, shops, stock_unit, unit_pieces)
VALUES
 ('00000000-0000-0000-0000-000000000001','tropezienne_6_pers_copie_y60imq',0,true,'["veigne","tours","saint-avertin"]'::jsonb,'piece',1), -- Yuzu Basilic 6 pers
 ('00000000-0000-0000-0000-000000000001','100_vanille_4_pers_copie_nqt1qx',0,true,'["veigne","tours","saint-avertin"]'::jsonb,'piece',1), -- Exotique 4 pers
 ('00000000-0000-0000-0000-000000000001','exotique_4_pers_copie_o8nr9o',0,true,'["veigne","tours","saint-avertin"]'::jsonb,'piece',1),    -- Exotique 6 pers
 ('00000000-0000-0000-0000-000000000001','yuzu_basilic_6_pers_copi_0b1oi4',0,true,'["veigne","tours","saint-avertin"]'::jsonb,'piece',1), -- Fruits Rouge 4 pers
 ('00000000-0000-0000-0000-000000000001','fruits_rouge_4_pers_copi_1lm3l1',0,true,'["veigne","tours","saint-avertin"]'::jsonb,'piece',1), -- Fruits Rouge 6 pers
 ('00000000-0000-0000-0000-000000000001','rouge_plaisir_copie_m5do6c',0,true,'["veigne","tours","saint-avertin"]'::jsonb,'piece',1),      -- 100% Vanille 4 pers
 ('00000000-0000-0000-0000-000000000001','rouge_plaisir_copie_copi_m8zkxt',0,true,'["veigne","tours","saint-avertin"]'::jsonb,'piece',1), -- 100% Vanille 6 pers
 ('00000000-0000-0000-0000-000000000001','fraisier_4_pers_copie_p2cnk4',0,true,'["veigne","tours","saint-avertin"]'::jsonb,'piece',1),    -- Royal 4 pers
 ('00000000-0000-0000-0000-000000000001','royal_4_pers_copie_ptrc3b',0,true,'["veigne","tours","saint-avertin"]'::jsonb,'piece',1),       -- Royal 6 pers
 ('00000000-0000-0000-0000-000000000001','royal_6_pers_copie_q6yhun',0,true,'["veigne","tours","saint-avertin"]'::jsonb,'piece',1),       -- Royal 8 pers
 ('00000000-0000-0000-0000-000000000001','paris_brest_4_6_pers_cop_ulnh8',0,true,'["veigne","tours","saint-avertin"]'::jsonb,'piece',1),  -- Paris-Brest 6 pers
 ('00000000-0000-0000-0000-000000000001','pb8',0,true,'["veigne","tours","saint-avertin"]'::jsonb,'piece',1)                              -- Paris-Brest 8 pers
ON CONFLICT (tenant_id, product_id) DO NOTHING;

-- ------------------------------------------------------------
-- 6) DÉSACTIVER (ne pas supprimer) — retirés de la commande magasins
--    sbi = Sablé Breton Indiv · tfi = Tartelette Fraise indiv. · frs = Fraisier 4 pers (gros)
-- ------------------------------------------------------------
UPDATE veigne_pat_stock
   SET actif = false
 WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
   AND product_id IN ('sbi','tfi','frs');

-- ------------------------------------------------------------
-- 7) VÉRIFICATION (à lire après exécution)
-- ------------------------------------------------------------
SELECT p.category, p.name, s.actif, s.stock_unit, s.unit_pieces, s.shops
  FROM veigne_pat_stock s
  JOIN products p ON p.id = s.product_id
 WHERE s.tenant_id = '00000000-0000-0000-0000-000000000001'
 ORDER BY p.category, p.name;
