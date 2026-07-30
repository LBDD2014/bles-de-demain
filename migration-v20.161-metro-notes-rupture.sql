-- ============================================================================
-- LBDD — migration v20.161 : Metro — notes par site + rupture produit
-- À EXÉCUTER DANS SUPABASE *AVANT* de pousser le front (convention LBDD).
-- Idempotent : peut être relancé sans risque.
-- ----------------------------------------------------------------------------
--   - metro_notes : une petite annotation libre par site (ex : produit
--       ponctuel hors catalogue à prendre). Affichée dans le Récap courses
--       avec le nom du site ; remise à vide par "Course faite".
--   - metro_checks.rupture : produit en rupture chez Metro. Garde sa quantité
--       au "Course faite" (Phil y retourne) + badge visible côté boutiques.
-- NB : pas de DELETE nécessaire (tout se fait en UPDATE) → conforme à la
-- convention sécurité v1b (les nouvelles tables n'ont pas DELETE par défaut).
-- ============================================================================

create table if not exists public.metro_notes (
  tenant_id   uuid not null default '00000000-0000-0000-0000-000000000001',
  boutique_id text not null,                       -- veigne | tours | saint-avertin | local
  note        text not null default '',
  updated_by  text,
  updated_at  timestamptz not null default now(),
  primary key (tenant_id, boutique_id)
);

alter table public.metro_notes enable row level security;
drop policy if exists "metro_notes all" on public.metro_notes;
create policy "metro_notes all" on public.metro_notes for all using(true) with check(true);

alter table public.metro_checks add column if not exists rupture boolean not null default false;

-- Diagnostic + rechargement du cache API (ajout suite aux 2 runs sans effet)
notify pgrst, 'reload schema';
select
  case when to_regclass('public.metro_notes') is not null then 'OUI ✓' else 'NON ✗' end as table_metro_notes,
  case when exists (select 1 from information_schema.columns
                    where table_schema='public' and table_name='metro_checks' and column_name='rupture')
       then 'OUI ✓' else 'NON ✗' end as colonne_rupture;
