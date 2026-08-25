-- v20.222 — Onglet Fêtes (éphémère, activable) : Noël, Galettes, Chandeleur, Pâques…
-- Commandes clients AVEC PRIX (total, acompte, ticket), produits saisonniers gérés en BackOffice.
-- Décisions Phil (25/08/2026) : pains de fête à la pièce à PRIX FIXE · bûches produites à Veigné
-- · pas de mention « décongelé » sur le ticket client.
-- ⚠️ À exécuter dans le SQL Editor Supabase AVANT d'utiliser l'onglet (le front la détecte :
-- sans les tables, l'onglet n'apparaît simplement pas).

-- 1) Les fêtes (une ligne par fête ; « actif » + fenêtre de dates = onglet visible en boutique)
create table if not exists public.fete_events (
  id         text primary key,            -- 'noel', 'galettes', 'chandeleur', 'paques'
  label      text not null,               -- '🎄 Noël'
  date_debut date,                        -- onglet visible à partir de…
  date_fin   date,                        -- …jusqu'à (inclus)
  butoir     timestamptz,                 -- fin de prise de commandes (après : consultation seule)
  actif      boolean not null default false,
  created_at timestamptz not null default now()
);

-- 2) Le catalogue de la fête (prix fixés en BackOffice ; une ligne par produit × taille)
create table if not exists public.fete_products (
  id         bigint generated always as identity primary key,
  event_id   text not null references public.fete_events(id) on delete cascade,
  groupe     text default '',             -- bandeau d'affichage : 'BÛCHES PÂTISSIÈRES'…
  nom        text not null,
  taille     text default '',             -- 'Indiv.', 'Grande', '6 parts', '2 kg'…
  prix       numeric,
  prod_site  text not null default 'veigne',  -- veigne | local (où c'est produit)
  ordre      int default 0,
  actif      boolean not null default true,
  created_at timestamptz not null default now()
);

-- 3) Les commandes clients
create table if not exists public.fete_orders (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      text,
  event_id       text not null references public.fete_events(id),
  origin_shop    text not null,           -- boutique de prise de commande = boutique de retrait
  customer_name  text not null,
  customer_phone text,
  pickup_date    date not null,
  pickup_time    text,
  items          jsonb not null default '[]',  -- [{fp_id, nom, taille, prix, qty}]
  total          numeric,
  paiement       text default 'non_regle',     -- non_regle | acompte | regle
  acompte        numeric,
  status         text default 'a_faire',       -- a_faire | prete | recuperee | annulee
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz
);

alter table public.fete_events   enable row level security;
alter table public.fete_products enable row level security;
alter table public.fete_orders   enable row level security;
create policy "fev all" on public.fete_events   for all using(true) with check(true);
create policy "fpr all" on public.fete_products for all using(true) with check(true);
create policy "for all" on public.fete_orders   for all using(true) with check(true);

-- Convention sécurité v1b : DELETE à accorder explicitement là où l'app supprime vraiment.
grant delete on public.fete_products to anon;  -- BackOffice : retirer un produit du catalogue
grant delete on public.fete_orders   to anon;  -- boutique : supprimer une commande saisie par erreur

-- 4) Amorçage — les 4 fêtes (inactives : Phil les active en BackOffice le moment venu)
insert into public.fete_events (id, label, date_debut, date_fin, butoir, actif) values
  ('noel',       '🎄 Noël',       '2026-12-01', '2026-12-24', '2026-12-20 18:00+01', false),
  ('galettes',   '👑 Galettes',   '2027-01-02', '2027-01-31', null,                  false),
  ('chandeleur', '🥞 Chandeleur', '2027-01-25', '2027-02-07', null,                  false),
  ('paques',     '🐣 Pâques',     '2027-03-15', '2027-04-05', null,                  false)
on conflict (id) do nothing;

-- Catalogue Noël depuis le fichier de Phil (Éphémères, màj 25/08/2026) — modifiable en BackOffice
insert into public.fete_products (event_id, groupe, nom, taille, prix, prod_site, ordre)
select v.* from (values
  ('noel','BÛCHES PÂTISSIÈRES','Bûche Tourangelle','Indiv.',6.00,'veigne',10),
  ('noel','BÛCHES PÂTISSIÈRES','Bûche Tourangelle','Grande',35.00,'veigne',11),
  ('noel','BÛCHES PÂTISSIÈRES','Bûche fruits rouges','Indiv.',6.00,'veigne',20),
  ('noel','BÛCHES PÂTISSIÈRES','Bûche fruits rouges','Grande',35.00,'veigne',21),
  ('noel','BÛCHES PÂTISSIÈRES','Bûche choco','Indiv.',6.00,'veigne',30),
  ('noel','BÛCHES PÂTISSIÈRES','Bûche choco','Grande',35.00,'veigne',31),
  ('noel','BÛCHES TRADITIONNELLES','Bûche traditionnelle praliné','Indiv.',4.75,'veigne',40),
  ('noel','BÛCHES TRADITIONNELLES','Bûche traditionnelle praliné','Grande',28.50,'veigne',41),
  ('noel','BÛCHES TRADITIONNELLES','Bûche traditionnelle chocolat','Indiv.',4.75,'veigne',50),
  ('noel','BÛCHES TRADITIONNELLES','Bûche traditionnelle chocolat','Grande',28.50,'veigne',51),
  ('noel','BÛCHES TRADITIONNELLES','Bûche traditionnelle café','Indiv.',4.75,'veigne',60),
  ('noel','BÛCHES TRADITIONNELLES','Bûche traditionnelle café','Grande',28.50,'veigne',61),
  ('noel','AUTRES DOUCEURS','Le bonnet de père Noël','',4.95,'veigne',70),
  ('noel','AUTRES DOUCEURS','Mont-Blanc','',4.50,'veigne',80)
) as v(event_id,groupe,nom,taille,prix,prod_site,ordre)
where not exists (select 1 from public.fete_products where event_id='noel');
-- Les PAINS DE FÊTE à la pièce (prix fixe, prod_site='local') : à ajouter en BackOffice
-- quand Phil aura fixé les poids/prix des pièces (le fichier ne donne que le €/kg).
