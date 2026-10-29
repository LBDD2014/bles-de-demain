-- v20.305 — Tickets Brother QL-820NWB + numéro de commande du jour + coupure matin / après-midi
-- (Phil, 29/10/2026 : « imprimer un ticket pour les clients et pour nous à mettre sur les sacs »)
--
-- 1. special_orders.num_jour / fete_orders.num_jour : numéro donné à l'enregistrement,
--    par boutique de retrait (origin_shop) et par jour de retrait (pickup_date),
--    spéciales et fêtes dans la MÊME suite → jamais deux sacs avec le même numéro le même jour.
-- 2. order_day_counters + next_order_num() : le compteur vit en base (pas de doublon même
--    si deux tablettes enregistrent en même temps).
-- 3. ticket_reglages : coupure matin / après-midi par site (défaut 14h00, réglable en BackOffice).
--
-- À lancer dans l'éditeur SQL Supabase. Sans risque : colonnes ajoutées, rien de modifié.
-- Tant que ce n'est pas lancé, l'app numérote en secours (max + 1) et le réglage de coupure reste à 14h.

alter table public.special_orders add column if not exists num_jour integer;
alter table public.fete_orders    add column if not exists num_jour integer;

create index if not exists special_orders_num_jour_idx on public.special_orders (tenant_id, origin_shop, pickup_date, num_jour);
create index if not exists fete_orders_num_jour_idx    on public.fete_orders    (tenant_id, origin_shop, pickup_date, num_jour);

-- Compteur par boutique × jour
create table if not exists public.order_day_counters (
  tenant_id text not null,
  shop      text not null,
  jour      date not null,
  last      integer not null default 0,
  primary key (tenant_id, shop, jour)
);
alter table public.order_day_counters enable row level security;
drop policy if exists "for all" on public.order_day_counters;
create policy "for all" on public.order_day_counters for all using (true) with check (true);
grant select, insert, update on public.order_day_counters to anon, authenticated;
-- (pas de DELETE : convention migration-securite-v1b)

-- Prochain numéro, atomique (une ligne verrouillée le temps de l'incrément)
create or replace function public.next_order_num(p_tenant text, p_shop text, p_jour date)
returns integer
language plpgsql
as $$
declare v integer;
begin
  insert into public.order_day_counters (tenant_id, shop, jour, last)
  values (p_tenant, p_shop, p_jour, 1)
  on conflict (tenant_id, shop, jour) do update set last = public.order_day_counters.last + 1
  returning last into v;
  return v;
end $$;
grant execute on function public.next_order_num(text, text, date) to anon, authenticated;

-- Si des commandes portent déjà un numéro (secours côté app avant cette migration), on aligne le compteur
insert into public.order_day_counters (tenant_id, shop, jour, last)
select tenant_id, origin_shop, pickup_date, max(num_jour)
from (
  -- tenant_id n'a pas le même type dans les deux tables (uuid / text) : tout en texte
  select tenant_id::text as tenant_id, origin_shop, pickup_date, num_jour from public.special_orders where num_jour is not null
  union all
  select tenant_id::text as tenant_id, origin_shop, pickup_date, num_jour from public.fete_orders where num_jour is not null
) t
group by tenant_id, origin_shop, pickup_date
on conflict (tenant_id, shop, jour) do update set last = greatest(public.order_day_counters.last, excluded.last);

-- Coupure matin / après-midi par site (heure à partir de laquelle une commande est « après-midi »)
create table if not exists public.ticket_reglages (
  tenant_id     text not null,
  boutique_id   text not null,
  coupure_aprem text not null default '14:00',
  updated_at    timestamptz default now(),
  primary key (tenant_id, boutique_id)
);
alter table public.ticket_reglages enable row level security;
drop policy if exists "for all" on public.ticket_reglages;
create policy "for all" on public.ticket_reglages for all using (true) with check (true);
grant select, insert, update on public.ticket_reglages to anon, authenticated;

-- Vérification :
--   select origin_shop, pickup_date, num_jour, customer_name from public.special_orders where num_jour is not null order by 2 desc, 3 limit 20;
--   select * from public.order_day_counters order by jour desc limit 10;
