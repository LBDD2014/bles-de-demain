-- v20.261 — Courses Metro à faire livrer à Veigné (Phil, 29/09/2026)
-- La feuille de route du livreur n'avait que la case « Tours » (metro_tours, v20.186).
-- Même case pour Veigné : cochée par Phil au Récap courses, vue par le livreur à l'étape Veigné.
--
-- ⚠️ À exécuter dans le SQL Editor Supabase AVANT de pousser la v20.261.

alter table public.livreur_day
  add column if not exists metro_veigne boolean not null default false;
