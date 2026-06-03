-- ============================================================================
-- LBDD — Module FABRICATION / TRAÇABILITÉ BIO
-- Migration 12 : INVENTAIRES (comptage physique + remise à niveau)
-- ----------------------------------------------------------------------------
-- Un inventaire = comptage physique d'une matière bio à une date sur un site.
-- Il devient la NOUVELLE BASE du stock (remise à niveau) : tout ce qui précède
-- (essais, formation) n'a plus d'impact. L'écart réel − théorique est affiché.
-- Le bilan par période repart du dernier comptage ≤ date de début.
-- ============================================================================

create table if not exists fab_inventaires (
  id            bigint generated always as identity primary key,
  ingredient_id text not null references fab_ingredients(id),
  site          text not null,
  date_inv      date not null,
  qte_reelle_kg numeric not null,
  note          text,
  cree_par      text,
  cree_le       timestamptz not null default now()
);
create index if not exists idx_fab_inv_ing  on fab_inventaires(ingredient_id);
create index if not exists idx_fab_inv_date on fab_inventaires(date_inv);

alter table fab_inventaires enable row level security;
drop policy if exists fab_inventaires_all on fab_inventaires;
create policy fab_inventaires_all on fab_inventaires for all to anon using (true) with check (true);

-- ============================================================================
-- FIN migration 12. Le calcul du bilan par période se fait côté front
-- (fabrication.html) à partir des données brutes — pas de vue à modifier.
-- ============================================================================
