-- v20.105 — Lien Planning → Calculette : chaque ligne du planning porte sa PÂTE de base
-- et sa conversion en KG DE FARINE par unité. La calculette regroupera par pâte (somme).
--
-- 1) Ajoute les 2 colonnes.
-- 2) ⚠️ REMPLACE les lignes d'essai par un brouillon pré-rempli (à corriger ensuite dans l'app).

alter table public.fab_planning_lignes add column if not exists pate            text;
alter table public.fab_planning_lignes add column if not exists kg_farine_unite numeric;

delete from public.fab_planning_lignes;  -- ⚠️ efface les lignes d'essai (Phil n'a que des essais)

insert into public.fab_planning_lignes (nom, unite, ordre, pate, kg_farine_unite) values
  ('Mathis',              'bacs',   0,  'Mathis',        2.500),
  ('Blés de pop',         'bacs',   1,  'Blés de pop',   2.632),
  ('Khorasan',            'bacs',   2,  'Khorasan',      3.265),
  ('Tourte de Meule',     'bacs',   3,  'Tourte',        3.376),
  ('Châtaigne',           'bacs',   4,  'Châtaigne',     2.979),
  ('Essentiel',           'bacs',   5,  'Essentiel',     3.559),
  ('Petits pains Fredeville','pièces',6,'Essentiel',     0.178),
  ('Idéal',               'bacs',   7,  'Idéal',         3.581),
  ('Intégral',            'bacs',   8,  'Intégral',      3.647),
  ('Tradition Bio',       'bacs',   9,  'Tradition Bio', 3.560),
  ('Seigle',              'bacs',  10,  'Seigle',        2.676),
  ('Tradition',           'bacs',  11,  'Tradition',     3.560),
  ('Tradition graines',   'bacs',  12,  'Tradition',     3.560),
  ('Baguette épeautre',   'bacs',  13,  'Épeautre',      3.598),
  ('Pain blanc',          'bacs',  14,  'Pain blanc',    5.952),
  ('Baguette ordinaire',  'bacs',  15,  'Pain blanc',    4.048),
  ('Engrain',             'moules',16,  'Engrain',       0.194),
  ('Norvégien',           'moules',17,  'Norvégien',     0.406),
  ('Méteil citron',       'pièces',18,  'Méteil',        0.180),
  ('Pain burger',         'pièces',19,  'Viennoise',     0.049),
  ('Pain hotdog',         'pièces',20,  'Viennoise',     0.049);
