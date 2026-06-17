-- v20.114 — Planning semaine PAR SITE (Le Local / Veigné / Tours)
-- À lancer UNE FOIS dans le SQL Editor Supabase.
-- Ajoute la colonne `site` et rattache toutes les lignes existantes au Local.
-- La duplication vers Veigné et Tours est faite ensuite par l'app (API), pas ici.

alter table public.fab_planning_lignes add column if not exists site text default 'local';

update public.fab_planning_lignes set site='local' where site is null;
