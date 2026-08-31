-- v20.227 — Châtaigne et Baguette épeautre passent en SPÉCIAUX (demande Phil, 31/08/2026)
-- Déjà appliqué en prod le 31/08/2026 via l'API REST. Rejouable sans risque.
-- Concerne les 3 magasins (Le Local, Veigné, Tours).
UPDATE public.fab_planning_lignes
   SET section = 'speciaux'
 WHERE section = 'pains'
   AND lower(nom) IN ('châtaigne', 'baguette épeautre');

-- Vérification
-- SELECT site, nom, section, ordre FROM public.fab_planning_lignes
--  WHERE lower(nom) IN ('châtaigne','baguette épeautre') ORDER BY site, ordre;
