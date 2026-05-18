-- =====================================================================
-- v21.0.3.2 — Produits spécifiques à un pro (sur mesure)
-- =====================================================================
-- Permet à Phil de créer des variantes (taille, poids) qui ne sont
-- destinées qu'à UN seul pro et qui ne polluent pas les vues internes
-- standards (Ventes, Prévis, Réappros, Marchés, etc.).
--
-- Mécanisme :
--   - products.pros_only_id = pro_id → produit dédié à ce pro
--   - products.pros_only_id IS NULL → produit standard (visible partout)
--
-- Filtrage côté front :
--   - loadProducts (vues internes) : .is('pros_only_id', null)
--   - loadAdminProducts (BackOffice) : pas de filtre, voit tout
--   - Catalogue restreint d'un pro : affiche standard + ses propres
--     produits spécifiques (jamais ceux d'un autre pro)
--
-- ON DELETE SET NULL : si le pro est supprimé, le produit redevient
-- "standard" plutôt que d'être supprimé en cascade. Phil pourra le
-- supprimer manuellement si besoin.
-- =====================================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS pros_only_id text
  REFERENCES public.pros(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_pros_only ON public.products(pros_only_id);

-- VÉRIFICATION POST-MIGRATION (optionnel) :
-- SELECT column_name, data_type, is_nullable FROM information_schema.columns
--   WHERE table_schema='public' AND table_name='products' AND column_name='pros_only_id';
