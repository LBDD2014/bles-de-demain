-- v20.286 — Catalogue pro : une liste vide veut maintenant dire « rien d'autorisé » (Phil, 21/10/2026)
-- Avant : liste vide = tout autorisé (comme null). Après : null = tout, [] = rien.
-- Une nouvelle fiche démarre à [] (rien de coché) ; on coche ce que le pro commande.
--
-- Cette migration remet à null les fiches EXISTANTES qui sont à [] pour qu'elles gardent
-- « tout autorisé » comme aujourd'hui. À exécuter dans le SQL Editor Supabase AVANT de pousser le front.
-- Idempotente.

update public.pros
set catalogue_restreint = null
where catalogue_restreint is not null
  and jsonb_typeof(catalogue_restreint) = 'array'
  and jsonb_array_length(catalogue_restreint) = 0;

-- Vérification : doit renvoyer 0 ligne
-- select id, nom from public.pros where jsonb_typeof(catalogue_restreint) = 'array' and jsonb_array_length(catalogue_restreint) = 0;
