-- v20.228 — Jour de fermeture par magasin (Planning) — demande Phil, 31/08/2026
-- « Cacher le jour de congé de l'entreprise mais le garder sous le coude » :
-- Le Local ferme le lundi, Tours le dimanche. La colonne disparaît de la grille
-- et de l'impression, et revient en 1 clic. Rien n'est supprimé : si le jour
-- masqué contient déjà des chiffres, le front le réaffiche tout seul.
--
-- ⚠️ À exécuter dans le SQL Editor Supabase. Sans cette table l'app fonctionne
-- normalement (aucun jour masqué) — elle ne plante pas.

create table if not exists public.fab_jours_off (
  site       text primary key,                 -- 'local' | 'veigne' | 'tours'
  jours      text not null default '',         -- index séparés par des virgules : 0=lundi … 6=dimanche (ex : '0,6')
  updated_at timestamptz not null default now()
);

alter table public.fab_jours_off enable row level security;
do $$ begin
  create policy "fjo all" on public.fab_jours_off for all using(true) with check(true);
exception when duplicate_object then null; end $$;

-- Convention sécurité v1b : l'app n'utilise que SELECT + upsert, jamais DELETE
-- (démasquer = enregistrer une liste plus courte). Rien à accorder de plus.

-- Réglage de départ (demande Phil) : Local fermé le lundi, Tours le dimanche.
insert into public.fab_jours_off (site, jours) values
  ('local','0'), ('tours','6'), ('veigne','')
on conflict (site) do nothing;

-- Vérification
-- select * from public.fab_jours_off order by site;
