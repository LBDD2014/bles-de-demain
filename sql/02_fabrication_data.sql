-- ============================================================================
-- LBDD — Module FABRICATION : migration 02 (données de base, vague 1 = pains bio)
-- À exécuter APRÈS 01_fabrication_schema.sql.
-- Idempotent (ON CONFLICT DO NOTHING) : peut être relancé sans doublon.
-- Recettes : à construire/affiner dans l'app (éditable) ; ce seed pose le catalogue.
-- ============================================================================

-- 1. FOURNISSEURS ------------------------------------------------------------
insert into fab_fournisseurs (id, nom) values
  ('four_suire',   'Minoterie Suire'),
  ('four_revault', 'Michel Revault'),
  ('four_mimosas', 'GAEC des Mimosas – B. Fretté')
on conflict (id) do nothing;

-- 2. INGRÉDIENTS -------------------------------------------------------------
-- Farines BIO (entrent dans le bilan matière)
insert into fab_ingredients (id, nom, categorie, bio, fournisseur_id, unite) values
  ('ing_trad_bio',     'Tradition Bio',            'farine', true,  'four_suire',   'kg'),
  ('ing_t150',         'Farine T150',              'farine', true,  'four_suire',   'kg'),
  ('ing_seigle_t130',  'Seigle T130',              'farine', true,  'four_suire',   'kg'),
  ('ing_t80_bise',     'T80 Bio Bise',             'farine', true,  'four_suire',   'kg'),
  ('ing_khorasan',     'Khorasan',                 'farine', true,  'four_suire',   'kg'),
  ('ing_engrain',      'Engrain (petit épeautre)', 'farine', true,  'four_revault', 'kg'),
  ('ing_bp',           'Blés de pop (anciens)',    'farine', true,  'four_mimosas', 'kg'),
  ('ing_graines',      'Mélange graines bio',      'graine', true,  null,           'kg'),
  -- Levains MAISON (faits à partir de farine bio → tracés bio)
  ('ing_levain_dur',     'Levain dur T80', 'levain', true, null, 'kg'),
  ('ing_levain_liquide', 'Levain liquide', 'levain', true, null, 'kg'),
  -- Non-bio (hors bilan matière, mais utiles aux recettes / fiches de fab)
  ('ing_sel',    'Sel de Guérande', 'sel',    false, null, 'kg'),
  ('ing_levure', 'Levure',          'levure', false, null, 'kg'),
  ('ing_eau',    'Eau',             'eau',    false, null, 'L')
on conflict (id) do nothing;

-- 3. PRODUITS (pains bio — vague 1) ------------------------------------------
insert into fab_produits (id, nom, categorie, bio) values
  ('pr_mathis',       'Mathis',          'pain', true),
  ('pr_bp',           'Blés de pop',     'pain', true),
  ('pr_tourte_meule', 'Tourte de Meule', 'pain', true),
  ('pr_engrain',      'Engrain',         'pain', true),
  ('pr_seigle',       'Seigle',          'pain', true),
  ('pr_integral',     'Intégral',        'pain', true),
  ('pr_essentiel',    'Essentiel',       'pain', true),
  ('pr_ideal',        'Idéal',           'pain', true),
  ('pr_khorasan',     'Khorasan',        'pain', true),
  ('pr_norvegien',    'Norvégien',       'pain', true)
on conflict (id) do nothing;

-- ============================================================================
-- Recettes : créées ensuite dans l'app (principe n°1 : tout éditable par Phil).
-- Données de départ dispo dans SUIVI DE PRODUCTION BIO 2026.xlsx + docs Word.
-- ============================================================================
