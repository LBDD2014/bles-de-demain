-- =====================================================================
-- v21.0.2 — Fiche pro étendue : St-Av source + multi-contacts + multi-source
-- =====================================================================
-- 3 changements suite aux retours de Phil 2026-05-18 :
--   1. St-Avertin peut être boutique source (principale en propre OU
--      secours en click & collect)
--   2. Multi-contacts : remplace contact_nom/tel/email par contacts jsonb
--      array — un pro peut renseigner plusieurs n° de tél de son équipe
--   3. Sources par catégorie : un pro peut commander pain au Local et
--      pâtisserie à Veigné (par exemple). sources_par_categorie jsonb
--      mappe { category_id: boutique_source }
--
-- Rollback-safe : on garde contact_nom/tel/email (deprecated mais non
-- droppé). On droppera dans une migration future une fois v21.0.2 stable.
-- =====================================================================

-- 1. AUTORISER ST-AV COMME BOUTIQUE SOURCE ---------------------------

ALTER TABLE public.pros DROP CONSTRAINT IF EXISTS pros_boutique_principale_check;
ALTER TABLE public.pros ADD CONSTRAINT pros_boutique_principale_check
  CHECK (boutique_principale IN ('veigne','tours','local','saint-avertin'));

ALTER TABLE public.pros DROP CONSTRAINT IF EXISTS pros_boutique_secours_check;
ALTER TABLE public.pros ADD CONSTRAINT pros_boutique_secours_check
  CHECK (boutique_secours IS NULL OR boutique_secours IN ('veigne','tours','local','saint-avertin'));

ALTER TABLE public.pro_orders DROP CONSTRAINT IF EXISTS pro_orders_boutique_source_check;
ALTER TABLE public.pro_orders ADD CONSTRAINT pro_orders_boutique_source_check
  CHECK (boutique_source IN ('veigne','tours','local','saint-avertin'));

-- 2. MULTI-CONTACTS --------------------------------------------------

ALTER TABLE public.pros ADD COLUMN IF NOT EXISTS contacts jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Migration des données existantes : si contacts est vide et au moins 1
-- champ contact_* est rempli, on construit le 1er contact à partir des
-- anciens champs.
UPDATE public.pros
SET contacts = jsonb_build_array(
  jsonb_strip_nulls(jsonb_build_object(
    'nom',   contact_nom,
    'tel',   contact_tel,
    'email', contact_email,
    'role',  'principal'
  ))
)
WHERE contacts = '[]'::jsonb
  AND (contact_nom IS NOT NULL OR contact_tel IS NOT NULL OR contact_email IS NOT NULL);

-- Note : on garde contact_nom/tel/email comme deprecated pour rollback safe.
-- À DROP dans une migration future une fois v21.0.2 validée en prod.

-- 3. SOURCES PAR CATÉGORIE -------------------------------------------

ALTER TABLE public.pros ADD COLUMN IF NOT EXISTS sources_par_categorie jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Structure attendue : { 'pains': 'local', 'patisserie_gros': 'veigne', ... }
-- Si une catégorie n'est pas listée → utilise boutique_principale comme défaut.

-- 4. VÉRIFICATIONS POST-MIGRATION (à exécuter séparément si tu veux) -
-- SELECT id, nom, contacts, sources_par_categorie FROM public.pros;
--
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--   WHERE conrelid = 'public.pros'::regclass AND conname LIKE '%check%';
