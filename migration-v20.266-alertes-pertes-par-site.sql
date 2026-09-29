-- ============================================================================
-- LBDD — migration v20.266 : alerte pertes PAR BOUTIQUE (Phil, 29/09/2026)
-- « les récap ventes et pertes arrivent seulement sur les sites concernés : en ce
-- moment au Local on voit les pertes et ventes de Veigné, alors que le Local doit
-- voir celles de Saint-Avertin ».
--
-- Avant (v20.162) : un seul calcul, Veigné, envoyé à Veigné + Le Local.
-- Après : un calcul par boutique, envoyé à qui est concerné :
--   · Veigné       → Veigné
--   · St-Avertin   → St-Avertin + Le Local (le Local produit pour St-Av)
--   · Tours        → Tours (passé en réel le 29/09)
-- Même formule que v20.162 (7 jours glissants, journées validées, perte > 5 % et ≥ 3).
-- Même nom de fonction : le job pg_cron « lbdd-alerte-pertes » (6h) n'a pas à changer.
--
-- ⚠️ À exécuter dans le SQL Editor Supabase. Relançable sans risque (anti-doublon
-- par boutique et par jour : ce matin, Veigné a déjà reçu son message → pas renvoyé).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.run_alerte_pertes() RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  src record;
  msg text;
  n int;
  bilan text := '';
BEGIN
  FOR src IN
    SELECT * FROM (VALUES
      ('veigne',        'Veigné',     ARRAY['veigne']),
      ('saint-avertin', 'St-Avertin', ARRAY['saint-avertin','local']),
      ('tours',         'Tours',      ARRAY['tours'])
    ) AS t(boutique, label, destinataires)
  LOOP
    -- anti-doublon du jour, par boutique source (le libellé est dans le message)
    IF EXISTS (SELECT 1 FROM livreur_messages
               WHERE sender_name = 'Alerte pertes auto' AND msg_date = current_date
                 AND content LIKE '%(' || src.label || ')%') THEN
      bilan := bilan || src.label || ' : déjà envoyé · ';
      CONTINUE;
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
      WHERE s.boutique_id = src.boutique
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

    IF n = 0 OR msg IS NULL THEN
      bilan := bilan || src.label || ' : RAS · ';
      CONTINUE;
    END IF;

    msg := '⚠️ Pertes élevées sur 7 jours (' || src.label || ') : ' || msg
        || ' — Attention à adapter vos productions à la baisse.';
    INSERT INTO livreur_messages
      (tenant_id, sender_boutique, sender_device, recipient_boutique,
       sender_name, msg_date, content, urgent, stop_boutique)
    SELECT '00000000-0000-0000-0000-000000000001', 'local', 'agent_pertes', r,
           'Alerte pertes auto', current_date, msg, false, NULL
    FROM unnest(src.destinataires) r;
    bilan := bilan || src.label || ' : ' || n || ' produit(s) → ' || array_to_string(src.destinataires, ' + ') || ' · ';
  END LOOP;
  RETURN bilan;
END $fn$;

REVOKE EXECUTE ON FUNCTION public.run_alerte_pertes() FROM public, anon, authenticated;

-- Exécution immédiate : St-Avertin et Tours reçoivent leur 1re alerte ce matin
-- (Veigné, déjà servi à 6h, est sauté par l'anti-doublon). Le verdict s'affiche.
SELECT public.run_alerte_pertes() AS alerte_pertes;
