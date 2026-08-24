-- ============================================================================
-- v20.199 — Équipe & dotations (BackOffice)
--
-- Suivre qui a reçu quoi : tee-shirts, polos, vestes, chemises, tabliers.
-- Trois besoins : savoir ce qu'il reste en stock pour recommander à temps,
-- suivre les arrivées et les départs, et savoir ce qui n'a pas été rendu.
--
-- Conventions du projet respectées :
--   · identifiants en TEXT (comme product_id)
--   · les sites utilisent les mêmes clés que l'app : tours / veigne /
--     saint-avertin / local. site = NULL veut dire « à trier ».
--   · GRANT DELETE explicite (migration-securite-v1b) : l'app supprime
--     réellement des lignes dans ces tables.
--
-- À exécuter dans l'éditeur SQL Supabase AVANT de déployer le front.
-- ============================================================================

-- ---------------------------------------------------------------- salariés --
create table if not exists public.staff (
  id          text primary key,
  tenant_id   uuid not null,
  nom         text not null,
  site        text,                       -- NULL = à trier
  poste       text,
  date_entree date,
  date_sortie date,                       -- non NULL = parti ; on ne supprime jamais
  notes       text,
  sort_order  integer default 0,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  updated_by  text
);
create index if not exists staff_tenant_site_idx on public.staff (tenant_id, site);

-- ------------------------------------------------- catalogue des articles --
-- Chaque ligne = une colonne du tableau Équipe. Phil en ajoute quand il veut.
create table if not exists public.staff_articles (
  id            text primary key,
  tenant_id     uuid not null,
  nom           text not null,
  jeu_tailles   text not null default 'vetement',  -- vetement | vetement4 | tablier | pantalon | pointure | aucune
  quota_annuel  integer,                            -- NULL = pas de quota (5 pour le tee-shirt)
  actif         boolean not null default true,
  sort_order    integer default 0,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  updated_by    text
);

-- ------------------------------------------------------ stock par taille --
create table if not exists public.staff_stock (
  tenant_id      uuid not null,
  article_id     text not null,
  taille         text not null default '-',
  qty            numeric not null default 0,
  seuil          numeric not null default 0,
  last_reception date,
  updated_at     timestamptz default now(),
  updated_by     text,
  primary key (tenant_id, article_id, taille)
);

-- ------------------------------------------------------------- remises ----
-- Une ligne par remise. rendu : NULL = pas rendu (encore dû),
-- 'stock' = rendu réutilisable (remonté au stock), 'hs' = rendu hors d'usage.
create table if not exists public.staff_dotations (
  id          bigserial primary key,
  tenant_id   uuid not null,
  staff_id    text not null,
  article_id  text not null,
  taille      text,
  qty         numeric not null default 1,
  remis_le    date not null,
  rendu       text,
  rendu_le    date,
  note        text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  updated_by  text
);
create index if not exists staff_dot_staff_idx  on public.staff_dotations (tenant_id, staff_id);
create index if not exists staff_dot_remis_idx  on public.staff_dotations (tenant_id, remis_le);

-- ------------------------------------------------------------ sécurité ----
alter table public.staff            enable row level security;
alter table public.staff_articles   enable row level security;
alter table public.staff_stock      enable row level security;
alter table public.staff_dotations  enable row level security;

do $$
declare t text;
begin
  foreach t in array array['staff','staff_articles','staff_stock','staff_dotations'] loop
    execute format('drop policy if exists %I on public.%I', t || '_all', t);
    execute format('create policy %I on public.%I for all using (true) with check (true)', t || '_all', t);
    execute format('grant select, insert, update, delete on public.%I to anon', t);
  end loop;
end $$;

grant usage, select on sequence public.staff_dotations_id_seq to anon;

-- ------------------------------------------------- catalogue de départ ----
insert into public.staff_articles (id, tenant_id, nom, jeu_tailles, quota_annuel, sort_order) values
  ('sa_tshirt',  '00000000-0000-0000-0000-000000000001', 'Tee-shirt', 'vetement',  5,    10),
  ('sa_polo',    '00000000-0000-0000-0000-000000000001', 'Polo',      'vetement',  null, 20),
  ('sa_veste',   '00000000-0000-0000-0000-000000000001', 'Veste',     'vetement4', null, 30),
  ('sa_chemise', '00000000-0000-0000-0000-000000000001', 'Chemise',   'vetement4', null, 40),
  ('sa_tablier', '00000000-0000-0000-0000-000000000001', 'Tablier',   'tablier',   null, 50)
on conflict (id) do nothing;

-- -------------------------------------------------------- les 42 noms -----
-- Tours renseigné ; les 31 autres arrivent avec site NULL (« À trier ») et se
-- répartissent entre Veigné, St-Avertin et Le Local d'un clic dans l'app.
insert into public.staff (id, tenant_id, nom, site, sort_order) values
  ('stf_apied_hinault_lenny', '00000000-0000-0000-0000-000000000001', 'APIED HINAULT Lenny', 'tours', 10),
  ('stf_bah_mamadou_korka', '00000000-0000-0000-0000-000000000001', 'BAH Mamadou Korka', 'tours', 20),
  ('stf_carre_alexis', '00000000-0000-0000-0000-000000000001', 'CARRE Alexis', 'tours', 30),
  ('stf_de_carvalho_luca', '00000000-0000-0000-0000-000000000001', 'DE CARVALHO Luca', 'tours', 40),
  ('stf_doucet_noe', '00000000-0000-0000-0000-000000000001', 'DOUCET Noé', 'tours', 50),
  ('stf_fernandes_carvalho_eva', '00000000-0000-0000-0000-000000000001', 'FERNANDES CARVALHO Eva', 'tours', 60),
  ('stf_lambert_christine', '00000000-0000-0000-0000-000000000001', 'LAMBERT Christine', 'tours', 70),
  ('stf_pelger_pierre', '00000000-0000-0000-0000-000000000001', 'PELGER Pierre', 'tours', 80),
  ('stf_postic_laura', '00000000-0000-0000-0000-000000000001', 'POSTIC Laura', 'tours', 90),
  ('stf_riviere_ambre', '00000000-0000-0000-0000-000000000001', 'RIVIERE Ambre', 'tours', 100),
  ('stf_vernat_elia', '00000000-0000-0000-0000-000000000001', 'VERNAT Elia', 'tours', 110),
  ('stf_bobin_fanny', '00000000-0000-0000-0000-000000000001', 'BOBIN Fanny', NULL, 120),
  ('stf_bocquet_boin_thimoty', '00000000-0000-0000-0000-000000000001', 'BOCQUET--BOIN Thimoty', NULL, 130),
  ('stf_boulanger_alexandre', '00000000-0000-0000-0000-000000000001', 'BOULANGER Alexandre', NULL, 140),
  ('stf_catalan_illyes', '00000000-0000-0000-0000-000000000001', 'CATALAN Illyes', NULL, 150),
  ('stf_comte_elodie_nee_boucheron', '00000000-0000-0000-0000-000000000001', 'COMTE Elodie née BOUCHERON', NULL, 160),
  ('stf_conan_romain', '00000000-0000-0000-0000-000000000001', 'CONAN Romain', NULL, 170),
  ('stf_drame_ibrahima', '00000000-0000-0000-0000-000000000001', 'DRAME Ibrahima', NULL, 180),
  ('stf_gabillet_noah', '00000000-0000-0000-0000-000000000001', 'GABILLET Noah', NULL, 190),
  ('stf_gautier_nathan', '00000000-0000-0000-0000-000000000001', 'GAUTIER Nathan', NULL, 200),
  ('stf_guerin_stephan', '00000000-0000-0000-0000-000000000001', 'GUERIN Stephan', NULL, 210),
  ('stf_have_christophe', '00000000-0000-0000-0000-000000000001', 'HAVE Christophe', NULL, 220),
  ('stf_hugon_maorie', '00000000-0000-0000-0000-000000000001', 'HUGON Maorie', NULL, 230),
  ('stf_lepretre_alexandre', '00000000-0000-0000-0000-000000000001', 'LEPRÊTRE Alexandre', NULL, 240),
  ('stf_leriche_jade', '00000000-0000-0000-0000-000000000001', 'LERICHE Jade', NULL, 250),
  ('stf_maussion_marion', '00000000-0000-0000-0000-000000000001', 'MAUSSION Marion', NULL, 260),
  ('stf_merabet_zora', '00000000-0000-0000-0000-000000000001', 'MERABET Zora', NULL, 270),
  ('stf_mesme_laura', '00000000-0000-0000-0000-000000000001', 'MESME Laura', NULL, 280),
  ('stf_niclot_alexandre', '00000000-0000-0000-0000-000000000001', 'NICLOT Alexandre', NULL, 290),
  ('stf_pasticier_louis', '00000000-0000-0000-0000-000000000001', 'PASTICIER Louis', NULL, 300),
  ('stf_paviot_johann', '00000000-0000-0000-0000-000000000001', 'PAVIOT Johann', NULL, 310),
  ('stf_piochon_timothee', '00000000-0000-0000-0000-000000000001', 'PIOCHON Timothée', NULL, 320),
  ('stf_pradie_emmanuel', '00000000-0000-0000-0000-000000000001', 'PRADIÉ Emmanuel', NULL, 330),
  ('stf_rodrigues_matheo', '00000000-0000-0000-0000-000000000001', 'RODRIGUES Mathéo', NULL, 340),
  ('stf_santonie_isabelle_nee_royer', '00000000-0000-0000-0000-000000000001', 'SANTONIE Isabelle née ROYER', NULL, 350),
  ('stf_soubiale_enzo', '00000000-0000-0000-0000-000000000001', 'SOUBIALE Enzo', NULL, 360),
  ('stf_soubise_sandra', '00000000-0000-0000-0000-000000000001', 'SOUBISE Sandra', NULL, 370),
  ('stf_souvant_mareen', '00000000-0000-0000-0000-000000000001', 'SOUVANT Mareen', NULL, 380),
  ('stf_tessier_benoit', '00000000-0000-0000-0000-000000000001', 'TESSIER Benoît', NULL, 390),
  ('stf_thomassian_enzo', '00000000-0000-0000-0000-000000000001', 'THOMASSIAN Enzo', NULL, 400),
  ('stf_tisserand_lolly', '00000000-0000-0000-0000-000000000001', 'TISSERAND Lolly', NULL, 410),
  ('stf_valentin_alicia', '00000000-0000-0000-0000-000000000001', 'VALENTIN Alicia', NULL, 420)
on conflict (id) do nothing;

-- Vérification
select
  (select count(*) from public.staff)                         as salaries,
  (select count(*) from public.staff where site = 'tours')    as a_tours,
  (select count(*) from public.staff where site is null)      as a_trier,
  (select count(*) from public.staff_articles)                as articles;
