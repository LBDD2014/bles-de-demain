-- ============================================================================
-- LBDD — migration v20.158 : module Commande Metro
-- À EXÉCUTER DANS SUPABASE *AVANT* de pousser le front (convention LBDD).
-- Idempotent : peut être relancé sans risque.
-- ----------------------------------------------------------------------------
-- Metro = grossiste où Phil va (en général) le lundi. Chaque site saisit ses
-- besoins dans l'onglet "Metro" de l'app ; la vue "Récap courses" agrège le
-- total à acheter + la répartition par magasin (pastilles couleur).
--   - metro_products : catalogue (nom, conditionnement, catégorie, photo)
--       photo = data URL compressée (image prise par Phil, référence produit)
--   - metro_needs    : besoins par boutique × produit (persistants ; remis à
--       zéro par le bouton "Course faite" de la vue récap)
--   - metro_checks   : cases cochées pendant la course (par produit, global)
-- Convention LBDD : product_id en TEXT (ex 'salade_poches'), pas d'UUID.
-- ============================================================================

create table if not exists public.metro_products (
  id             text primary key,                 -- ex 'salade_poches'
  tenant_id      uuid not null default '00000000-0000-0000-0000-000000000001',
  nom            text not null,
  conditionnement text,                            -- ex '1 kg', 'sceau 5 kg', 'carton'
  categorie      text not null default 'Divers',
  photo          text,                             -- data URL (JPEG compressé côté client)
  actif          boolean not null default true,
  ordre          int default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists public.metro_needs (
  tenant_id   uuid not null default '00000000-0000-0000-0000-000000000001',
  boutique_id text not null,                       -- veigne | tours | saint-avertin | local
  product_id  text not null references public.metro_products(id) on delete cascade,
  qty         int not null default 0,
  updated_by  text,
  updated_at  timestamptz not null default now(),
  primary key (tenant_id, boutique_id, product_id)
);

create table if not exists public.metro_checks (
  tenant_id  uuid not null default '00000000-0000-0000-0000-000000000001',
  product_id text not null references public.metro_products(id) on delete cascade,
  checked    boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, product_id)
);

alter table public.metro_products enable row level security;
alter table public.metro_needs    enable row level security;
alter table public.metro_checks   enable row level security;

drop policy if exists "metro_products all" on public.metro_products;
drop policy if exists "metro_needs all"    on public.metro_needs;
drop policy if exists "metro_checks all"   on public.metro_checks;
create policy "metro_products all" on public.metro_products for all using(true) with check(true);
create policy "metro_needs all"    on public.metro_needs    for all using(true) with check(true);
create policy "metro_checks all"   on public.metro_checks   for all using(true) with check(true);
