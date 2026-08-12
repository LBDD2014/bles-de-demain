-- ============================================================================
-- LBDD — migration v20.170 : Metro — cycle « Envoyer → Course faite » + historique
-- À EXÉCUTER DANS SUPABASE *AVANT* de pousser le front (convention LBDD).
-- Idempotent : peut être relancé sans risque.
-- ----------------------------------------------------------------------------
-- Avant : les besoins (metro_needs) étaient visibles en continu dans le Récap
-- de Phil, et « Course faite » remettait tout à zéro — cycle hebdo rigide.
-- Maintenant : la boutique SAISIT (metro_needs = brouillon, inchangé) puis
-- ENVOIE → photo de la commande dans metro_history (done_at NULL = en attente).
-- Le Récap de Phil ne montre que l'envoyé. « Course faite » → done_at = now()
-- (l'envoi devient historique consultable par la boutique), sauf produits en
-- rupture qui restent en attente pour le prochain passage.
-- Convention LBDD : product_id en TEXT. L'app ne fait QUE select/insert/update
-- sur cette table (pas de DELETE → pas de GRANT DELETE, conforme sécurité v1b).
-- ============================================================================

create table if not exists public.metro_history (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null default '00000000-0000-0000-0000-000000000001',
  boutique_id text not null,                -- veigne | tours | saint-avertin | local
  product_id  text not null,                -- pas de FK cascade : l'historique survit
  product_nom text,                         -- nom figé au moment de l'envoi
  qty         int  not null default 0,
  sent_at     timestamptz not null default now(),
  done_at     timestamptz,                  -- NULL = envoyé, en attente de course
  updated_by  text,
  updated_at  timestamptz not null default now()
);

create index if not exists metro_history_pending_idx
  on public.metro_history (tenant_id, boutique_id, done_at);

alter table public.metro_history enable row level security;
drop policy if exists "metro_history all" on public.metro_history;
create policy "metro_history all" on public.metro_history for all using(true) with check(true);
