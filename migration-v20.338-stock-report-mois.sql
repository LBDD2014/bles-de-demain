-- v20.338 — Stock de fin de mois reporté d'office sur le mois suivant (Phil, 01/11/2026)
-- « s'il me reste du stock en fin de mois, tu le reportes d'office le mois suivant ».
-- Reste à faire du mois = prévision − stock au 1er du mois − ce qui a été mis au congélo depuis.
-- Chaque 1er du mois à minuit (heure de Paris), la base prend une photo du stock des 3 écrans
-- (Stock Tourier, Stock Pât., Stock Boul. Pro). Personne n'a rien à faire.
-- Sans risque : une table, une fonction, une tâche planifiée. Rien de modifié. Relançable.
-- ⚠️ À lancer AVANT la mise en ligne de la v20.338.

-- 1) La photo du stock au 1er du mois
create table if not exists public.stock_report_mois (
  tenant_id   uuid not null default '00000000-0000-0000-0000-000000000001',
  mois        date not null,            -- 1er du mois (ex. 2026-11-01)
  screen      text not null,            -- 'tourier' | 'veigne_pat' | 'boul_pro'
  product_id  text not null,
  qty         numeric not null,         -- stock tel quel (l'app compte un négatif comme 0)
  created_at  timestamptz not null default now(),
  primary key (tenant_id, mois, screen, product_id)
);
alter table public.stock_report_mois enable row level security;
do $$ begin
  create policy "stock_report_mois lecture" on public.stock_report_mois for select using (true);
exception when duplicate_object then null; end $$;
grant select on public.stock_report_mois to anon;
grant select on public.stock_report_mois to authenticated;

-- 2) Prendre la photo. Sans date : seulement si on est le 1er du mois à Paris (sinon ne fait rien).
--    Une photo déjà prise n'est jamais remplacée (on conflict do nothing).
create or replace function public.snapshot_stock_mois(p_mois date default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paris date := (now() at time zone 'Europe/Paris')::date;
  v_mois  date;
  n integer := 0;
  k integer;
begin
  if p_mois is null then
    if extract(day from v_paris) <> 1 then return 0; end if;
    v_mois := v_paris;
  else
    v_mois := date_trunc('month', p_mois)::date;
  end if;

  insert into public.stock_report_mois (tenant_id, mois, screen, product_id, qty)
  select tenant_id::uuid, v_mois, 'tourier', product_id, coalesce(stock, 0) from public.tourier_stock
  on conflict do nothing;
  get diagnostics k = row_count; n := n + k;

  insert into public.stock_report_mois (tenant_id, mois, screen, product_id, qty)
  select tenant_id::uuid, v_mois, 'veigne_pat', product_id, coalesce(stock, 0) from public.veigne_pat_stock
  on conflict do nothing;
  get diagnostics k = row_count; n := n + k;

  insert into public.stock_report_mois (tenant_id, mois, screen, product_id, qty)
  select tenant_id::uuid, v_mois, 'boul_pro', product_id, coalesce(qty, 0) from public.pro_stock
  on conflict do nothing;
  get diagnostics k = row_count; n := n + k;

  return n;
end;
$$;
revoke all on function public.snapshot_stock_mois(date) from public, anon, authenticated;

-- 3) Tâche planifiée. pg_cron tourne en heure UTC : minuit 5 à Paris = 23h05 UTC l'hiver, 22h05 UTC l'été
--    (la veille). On passe aux deux heures, la fonction ne fait rien si ce n'est pas le 1er à Paris.
--    Rattrapage à 0h10 UTC le 1er si les deux premiers passages ont raté.
create extension if not exists pg_cron;
do $$ begin perform cron.unschedule('lbdd-stock-report-mois'); exception when others then null; end $$;
do $$ begin perform cron.unschedule('lbdd-stock-report-mois-rattrapage'); exception when others then null; end $$;
select cron.schedule('lbdd-stock-report-mois', '5 22,23 * * *', $$select public.snapshot_stock_mois()$$);
select cron.schedule('lbdd-stock-report-mois-rattrapage', '10 0 1 * *', $$select public.snapshot_stock_mois(((now() at time zone 'Europe/Paris')::date))$$);

-- 4) Novembre 2026 : la photo prise maintenant (01/11, dimanche) sert de stock reporté d'octobre.
select public.snapshot_stock_mois('2026-11-01') as lignes_novembre;

-- Vérification :
--   select screen, count(*) from public.stock_report_mois where mois = '2026-11-01' group by screen;
--   select jobname, schedule from cron.job where jobname like 'lbdd-stock-report%';
