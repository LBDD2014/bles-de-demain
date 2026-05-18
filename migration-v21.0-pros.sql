-- =====================================================================
-- v21.0 — Pros (clients professionnels) : tables + RLS + realtime
-- =====================================================================
-- 3 tables :
--   pros            : 1 ligne par client pro (catalogue restreint, jours
--                     livraison, prix spéciaux, panier type)
--   pro_orders      : 1 ligne par commande (date livraison, statut)
--   pro_order_items : 1 ligne par produit dans une commande
--
-- Convention BDD : product_id en TEXT (pas UUID), id de pros en TEXT
-- aussi (slug human-readable type "cafe_arts").
--
-- RLS : policy ALL pour le rôle anon (cohérent avec le reste de l'app,
-- cf. v20.30 bug RLS sur products).
--
-- Realtime : tables ajoutées à la publication supabase_realtime.
-- =====================================================================

-- 1. TABLES -----------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.pros (
  id                   text PRIMARY KEY,
  tenant_id            uuid NOT NULL,
  nom                  text NOT NULL,
  contact_nom          text,
  contact_tel          text,
  contact_email        text,
  boutique_principale  text NOT NULL CHECK (boutique_principale IN ('veigne','tours','local')),
  boutique_secours     text CHECK (boutique_secours IS NULL OR boutique_secours IN ('veigne','tours','local')),
  jours_livraison      jsonb NOT NULL DEFAULT '{}'::jsonb,
  catalogue_restreint  jsonb,
  prix_speciaux        jsonb NOT NULL DEFAULT '{}'::jsonb,
  template_items       jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes                text,
  actif                boolean NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pro_orders (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL,
  pro_id          text NOT NULL REFERENCES public.pros(id) ON DELETE CASCADE,
  date_livraison  date NOT NULL,
  boutique_source text NOT NULL CHECK (boutique_source IN ('veigne','tours','local')),
  statut          text NOT NULL DEFAULT 'brouillon' CHECK (statut IN ('brouillon','confirme','livre','annule')),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      text
);

CREATE TABLE IF NOT EXISTS public.pro_order_items (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pro_order_id   uuid NOT NULL REFERENCES public.pro_orders(id) ON DELETE CASCADE,
  product_id     text NOT NULL REFERENCES public.products(id),
  qty            numeric NOT NULL CHECK (qty > 0),
  prix_applique  numeric
);

-- 2. INDEX ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_pros_tenant            ON public.pros(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pros_actif             ON public.pros(actif);
CREATE INDEX IF NOT EXISTS idx_pro_orders_tenant_date ON public.pro_orders(tenant_id, date_livraison);
CREATE INDEX IF NOT EXISTS idx_pro_orders_pro         ON public.pro_orders(pro_id);
CREATE INDEX IF NOT EXISTS idx_pro_orders_source_date ON public.pro_orders(boutique_source, date_livraison);
CREATE INDEX IF NOT EXISTS idx_pro_order_items_order  ON public.pro_order_items(pro_order_id);
CREATE INDEX IF NOT EXISTS idx_pro_order_items_prod   ON public.pro_order_items(product_id);

-- 3. RLS POLICIES -----------------------------------------------------
-- Cohérent avec reappros / sales / special_orders : policy ALL anon.

ALTER TABLE public.pros            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pro_orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pro_order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pros_all            ON public.pros;
DROP POLICY IF EXISTS pro_orders_all      ON public.pro_orders;
DROP POLICY IF EXISTS pro_order_items_all ON public.pro_order_items;

CREATE POLICY pros_all            ON public.pros            FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY pro_orders_all      ON public.pro_orders      FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY pro_order_items_all ON public.pro_order_items FOR ALL TO anon USING (true) WITH CHECK (true);

-- 4. REALTIME ---------------------------------------------------------
-- Active la publication pour que supa.channel().on('postgres_changes') marche.

ALTER PUBLICATION supabase_realtime ADD TABLE public.pros;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pro_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pro_order_items;

-- 5. VÉRIFICATIONS POST-MIGRATION (à exécuter séparément si tu veux) --
-- SELECT tablename, rowsecurity FROM pg_tables
--   WHERE schemaname='public' AND tablename IN ('pros','pro_orders','pro_order_items');
--
-- SELECT tablename, policyname, cmd, roles FROM pg_policies
--   WHERE schemaname='public' AND tablename IN ('pros','pro_orders','pro_order_items');
--
-- SELECT schemaname, tablename FROM pg_publication_tables
--   WHERE pubname='supabase_realtime' AND tablename IN ('pros','pro_orders','pro_order_items');
