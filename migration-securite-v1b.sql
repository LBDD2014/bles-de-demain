-- ============================================================
-- migration-securite-v1b.sql — Sécurisation de la base (2026-07-30)
-- Version blindée : chaque section est indépendante, une erreur
-- dans l'une n'annule pas les autres. Relançable sans risque.
-- ============================================================

-- ===== 1. La clé publique ne peut plus supprimer de lignes =====
DO $sec1$ BEGIN
  REVOKE DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
EXCEPTION WHEN OTHERS THEN RAISE WARNING 'Section 1 (revoke): %', SQLERRM;
END $sec1$;

DO $sec1b$ BEGIN
  ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    REVOKE DELETE, TRUNCATE ON TABLES FROM anon, authenticated;
EXCEPTION WHEN OTHERS THEN RAISE WARNING 'Section 1b (default priv): %', SQLERRM;
END $sec1b$;

-- ===== 2. DELETE ré-autorisé table par table, là où l'app l'utilise =====
DO $sec2$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'deliveries','products','pros',
    'pro_order_items','special_orders','special_order_items',
    'livreur_messages','metro_products','veigne_pat_stock',
    'fab_recette_lignes','fab_production','fab_sorties',
    'fab_livraisons','fab_pertes','fab_mouvements',
    'fab_inventaires','fab_planning_lignes',
    'fab_ingredients','fab_produits','fab_fournisseurs'
  ] LOOP
    BEGIN
      EXECUTE format('GRANT DELETE ON public.%I TO anon', t);
    EXCEPTION WHEN OTHERS THEN RAISE WARNING 'GRANT DELETE % : %', t, SQLERRM;
    END;
  END LOOP;
END $sec2$;

-- ===== 3. Table de sauvegarde (l'app peut lire, jamais modifier) =====
CREATE TABLE IF NOT EXISTS public.db_backups (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at  timestamptz NOT NULL DEFAULT now(),
  table_name  text NOT NULL,
  row_count   integer,
  data        jsonb NOT NULL
);
ALTER TABLE public.db_backups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.db_backups FROM anon, authenticated;
GRANT SELECT ON public.db_backups TO anon;
DROP POLICY IF EXISTS db_backups_select ON public.db_backups;
CREATE POLICY db_backups_select ON public.db_backups FOR SELECT TO anon USING (true);

-- ===== 4. Fonction de sauvegarde (toutes les tables, rétention 10 jours) =====
CREATE OR REPLACE FUNCTION public.run_nightly_backup() RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  t record;
  n integer;
  d jsonb;
  total integer := 0;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> 'db_backups'
  LOOP
    BEGIN
      EXECUTE format('SELECT COALESCE(jsonb_agg(to_jsonb(x)), ''[]''::jsonb), count(*) FROM %I x', t.tablename)
        INTO d, n;
      INSERT INTO db_backups(table_name, row_count, data) VALUES (t.tablename, n, d);
      total := total + 1;
    EXCEPTION WHEN OTHERS THEN RAISE WARNING 'backup % : %', t.tablename, SQLERRM;
    END;
  END LOOP;
  DELETE FROM db_backups WHERE created_at < now() - interval '10 days';
  RETURN total || ' tables sauvegardées';
END
$fn$;
REVOKE EXECUTE ON FUNCTION public.run_nightly_backup() FROM public, anon, authenticated;

-- ===== 5. Planification nocturne (3h30 heure d'été FR) =====
DO $sec5$ BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  PERFORM cron.schedule('lbdd-backup-nuit', '30 1 * * *', 'SELECT public.run_nightly_backup()');
EXCEPTION WHEN OTHERS THEN RAISE WARNING 'Section 5 (pg_cron): %', SQLERRM;
END $sec5$;

-- ===== 6. Première sauvegarde immédiate + bilan =====
SELECT public.run_nightly_backup() AS resultat;
