-- ============================================================================
-- LBDD — migration v20.186 : onglet « Ma journée » du livreur
-- À EXÉCUTER DANS SUPABASE *AVANT* de pousser le front (convention LBDD).
-- Idempotent : peut être relancé sans risque.
-- ----------------------------------------------------------------------------
-- Feuille de route théorique mais modulable (trame de Phil + son livreur,
-- validée le 2026-08-20). La trame elle-même est dans le code ; cette table
-- porte ce qui change au jour le jour :
--   - metro_tours : Phil coche « courses Metro à faire livrer à Tours »
--   - extra_pros  : pros réactivés ponctuellement (ex : Chevalier) — liste d'ids
--   - done        : étapes cochées « fait » par le livreur ({step_key: true})
-- ============================================================================

create table if not exists public.livreur_day (
  tenant_id   uuid not null default '00000000-0000-0000-0000-000000000001',
  date        date not null,
  metro_tours boolean not null default false,
  extra_pros  jsonb not null default '[]'::jsonb,
  done        jsonb not null default '{}'::jsonb,
  updated_by  text,
  updated_at  timestamptz not null default now(),
  primary key (tenant_id, date)
);

alter table public.livreur_day enable row level security;
drop policy if exists "livreur_day all" on public.livreur_day;
create policy "livreur_day all" on public.livreur_day for all using(true) with check(true);
