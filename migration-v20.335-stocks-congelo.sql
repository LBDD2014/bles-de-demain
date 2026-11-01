-- v20.335 — Écrans Stock (Boul. Pro, Tourier, Pât.) refaits (Phil, 01/11/2026, maquette stock-congelo-mockup.html)
-- « il me faut rentrer la prod du jour qui va au congélateur pour rentrer dans le stock et décompter de la
--   production totale du mois ou de la semaine ». Un seul geste par jour (＋ au congélo), un « reste à faire »,
-- un comptage 📋 de temps en temps. Les touriers disent si la viennoiserie de St-Avertin sort du congélo
-- ou est plaquée frais. Sans risque : une table et des colonnes ajoutées, rien de modifié. Relançable.
-- ⚠️ À lancer AVANT la mise en ligne de la v20.335.

-- 1) Comptages du congélo : ce que disait l'app, ce qui a été compté, par qui
create table if not exists public.stock_comptages (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null default '00000000-0000-0000-0000-000000000001',
  screen      text not null,          -- 'tourier' | 'veigne_pat' | 'boul_pro'
  product_id  text not null,
  qty_app     numeric,
  qty_compte  numeric not null,
  ecart       numeric,
  compte_par  text,                   -- prénom réglé sur la tablette
  device      text,
  compte_at   timestamptz not null default now()
);
create index if not exists stock_comptages_prod_idx on public.stock_comptages (tenant_id, product_id, compte_at desc);
alter table public.stock_comptages enable row level security;
do $$ begin
  create policy "stock_comptages all" on public.stock_comptages for all using (true) with check (true);
exception when duplicate_object then null; end $$;
grant select, insert on public.stock_comptages to anon;
grant select, insert on public.stock_comptages to authenticated;

-- 2) Prod. Touriers : ❄️ sorti du congélo / 🥐 plaqué frais, par ligne et par jour
--    congelo_mode     : 'frais' quand le tourier a choisi 🥐 (null = ❄️ du congélo, le défaut)
--    congelo_applique : ce que l'app a déjà fait ('congelo' = stock baissé, 'frais' = compté en production)
--    congelo_qty      : combien (dans l'unité du congélo, caisses à virgule) — pour pouvoir défaire
alter table public.production_done add column if not exists congelo_mode text;
alter table public.production_done add column if not exists congelo_applique text;
alter table public.production_done add column if not exists congelo_qty numeric;

-- 3) Stock Pât. : le stock baisse à l'envoi de la boutique. On note sur la ligne ce qui a déjà été retiré
--    (une commande renvoyée après modification ne retire que la différence ; « ✓ préparé » ne retire que le reste).
alter table public.reappros add column if not exists stock_decompte_qty numeric;

-- Vérification :
--   select column_name from information_schema.columns where table_name in ('production_done','reappros') and column_name like '%congelo%' or column_name = 'stock_decompte_qty';
--   select count(*) from public.stock_comptages;
