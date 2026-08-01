-- ============================================================================
-- LBDD — migration v20.162 : alertes automatiques en pg_cron (dans la base)
-- Remplace 2 routines cloud qui ne parvenaient plus à écrire (diagnostiqué
-- 2026-08-01) : ⚠️ Alerte pertes >5% (quotidien 6h) + 🛒 Rappel Metro (samedi).
-- Même mécanique fiable que la sauvegarde nocturne. Relançable sans risque.
-- ============================================================================

-- ===== 1. Alerte pertes >5% (7 jours glissants, Veigné) =====
CREATE OR REPLACE FUNCTION public.run_alerte_pertes() RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  msg text;
  n int;
BEGIN
  -- anti-doublon du jour
  IF EXISTS (SELECT 1 FROM livreur_messages
             WHERE sender_name = 'Alerte pertes auto' AND msg_date = current_date) THEN
    RETURN 'déjà envoyé aujourd''hui';
  END IF;

  -- formule officielle de l'app (v20.160) : matin, sinon prévis du jour
  -- (sauf catégories "Sortie jour" : gâteaux/traiteur, déjà comptés via aprem)
  WITH lignes AS (
    SELECT
      COALESCE(s.matin,
        CASE WHEN p.category IN ('patisserie_petits','patisserie_gros','traiteur','gateaux_secs')
             THEN 0 ELSE COALESCE(pv.qty, 0) END
      ) + COALESCE(s.aprem, 0) AS production,
      COALESCE(s.perte, 0) AS perte,
      p.name
    FROM sales s
    JOIN products p ON p.id = s.product_id
    LEFT JOIN previs pv ON pv.boutique_id = s.boutique_id
                       AND pv.product_id = s.product_id
                       AND pv.service_date = s.date
    WHERE s.boutique_id = 'veigne'
      AND s.date BETWEEN current_date - 7 AND current_date - 1
      AND s.day_closed
  ), agg AS (
    SELECT name, SUM(production) AS prod, SUM(perte) AS perte
    FROM lignes GROUP BY name
    HAVING SUM(production) > 0 AND SUM(perte) >= 3
       AND 100.0 * SUM(perte) / SUM(production) > 5
  ), top AS (
    SELECT name, prod, perte, ROUND(100.0 * perte / prod) AS pct
    FROM agg ORDER BY 100.0 * perte / prod DESC LIMIT 12
  )
  SELECT COUNT(*),
         STRING_AGG(name || ' ' || pct || ' % (' || perte || ' perdus/' || prod || ')',
                    ' · ' ORDER BY pct DESC)
  INTO n, msg FROM top;

  IF n = 0 OR msg IS NULL THEN RETURN 'RAS — aucune perte >5 %'; END IF;

  msg := '⚠️ Pertes élevées sur 7 jours (Veigné) : ' || msg
      || ' — Attention à adapter vos productions à la baisse.';

  INSERT INTO livreur_messages
    (tenant_id, sender_boutique, sender_device, recipient_boutique,
     sender_name, msg_date, content, urgent, stop_boutique)
  SELECT '00000000-0000-0000-0000-000000000001', 'local', 'agent_pertes', r,
         'Alerte pertes auto', current_date, msg, false, NULL
  FROM unnest(ARRAY['veigne','local']) r;

  RETURN n || ' produit(s) en alerte, message envoyé à veigne + local';
END $fn$;
REVOKE EXECUTE ON FUNCTION public.run_alerte_pertes() FROM public, anon, authenticated;

-- ===== 2. Rappel Metro du samedi =====
CREATE OR REPLACE FUNCTION public.run_rappel_metro() RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF EXISTS (SELECT 1 FROM livreur_messages
             WHERE sender_name = 'Rappel automatique' AND msg_date = current_date) THEN
    RETURN 'déjà envoyé aujourd''hui';
  END IF;
  INSERT INTO livreur_messages
    (tenant_id, sender_boutique, sender_device, recipient_boutique,
     sender_name, msg_date, content, urgent, stop_boutique)
  SELECT '00000000-0000-0000-0000-000000000001', 'local', 'agent_metro', r,
         'Rappel automatique', current_date,
         '🛒 Courses Metro lundi ! Pensez à saisir vos besoins dans l''onglet Metro avant lundi matin. Merci !',
         false, NULL
  FROM unnest(ARRAY['veigne','tours','saint-avertin','local']) r;
  RETURN 'rappel Metro envoyé aux 4 sites';
END $fn$;
REVOKE EXECUTE ON FUNCTION public.run_rappel_metro() FROM public, anon, authenticated;

-- ===== 3. Planification (heures UTC été : 4h = 6h Paris ; lun 2h45 = 4h45) =====
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('lbdd-alerte-pertes', '0 4 * * *',   $$SELECT public.run_alerte_pertes()$$);
SELECT cron.schedule('lbdd-rappel-metro',  '45 2 * * 1',  $$SELECT public.run_rappel_metro()$$);

-- ===== 4. Exécution immédiate (rattrape ce matin) + verdict =====
SELECT public.run_alerte_pertes() AS alerte_pertes,
       public.run_rappel_metro()  AS rappel_metro;
