-- v20.262 — Coche ✓ « ligne faite et partie » sur les écrans de production (Phil, 29/09/2026)
-- Prod. Boulangers + Prod. Touriers (Le Local), « À produire » de Veigné et de Tours.
-- Une ligne par site × jour × produit. Décocher = done_at remis à null (pas de suppression).
-- Le livreur lit cette table pour afficher « ✓ prêt » sur ce qu'il doit charger.
--
-- ⚠️ À exécuter dans le SQL Editor Supabase AVANT de pousser la v20.262.

create table if not exists public.production_done (
  tenant_id    uuid not null default '00000000-0000-0000-0000-000000000001',
  site         text not null,          -- local | veigne | tours
  service_date date not null,
  product_id   text not null,
  done_at      timestamptz,            -- null = pas (ou plus) coché
  done_by      text,
  updated_at   timestamptz not null default now(),
  primary key (tenant_id, site, service_date, product_id)
);

alter table public.production_done enable row level security;
do $$ begin
  create policy "production_done all" on public.production_done for all using(true) with check(true);
exception when duplicate_object then null; end $$;

grant select, insert, update on public.production_done to anon;
