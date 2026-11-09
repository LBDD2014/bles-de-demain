-- v20.341 — Produits des marchés (Phil, 09/11/2026) : « une coche pour choisir quel produit figure
-- dans les marchés d'Amboise et Beaujardin ».
--
-- Avant : le Tableau marché listait les 240 produits actifs. Désormais products.marches dit sur quel(s)
-- marché(s) le produit figure ; le tableau n'affiche que ceux-là (plus tout produit qui a un chiffre ce jour-là).
-- Liste vide pour un marché = aucune liste réglée = tous les produits, comme avant.
-- Liste de départ : les produits saisis sur un marché depuis le 01/10/2026 (21 à Amboise), posés sur les DEUX marchés
-- pour que Phil n'ait qu'à ajuster Beaujardin (⚙️ Choisir les produits, code maître, ou fiche produit en BackOffice).
-- Sans risque, rejouable. À lancer AVANT la mise en ligne du front v20.341.

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS marches text[] NOT NULL DEFAULT '{}';
COMMENT ON COLUMN public.products.marches IS
  'v20.341 — marchés où le produit figure au Tableau marché : amboise, beaujardin. Vide = pas dans la liste (si aucun produit n''est réglé pour un marché, tout s''affiche).';

UPDATE public.products
   SET marches = ARRAY['amboise', 'beaujardin']
 WHERE actif
   AND cardinality(marches) = 0
   AND id IN (SELECT DISTINCT product_id FROM public.market_entries WHERE service_date >= '2026-10-01');

-- Vérification : les produits cochés
SELECT id, name, category, marches
  FROM public.products
 WHERE cardinality(marches) > 0
 ORDER BY category, name;
