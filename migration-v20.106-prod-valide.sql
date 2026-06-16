-- v20.106 — Validation de la journée de production.
-- Le stock ne décompte (conso) QUE la production validée. Tant que c'est brouillon, rien ne bouge.
-- Toute modif (rajout jour J) repasse la journée en brouillon → re-valider.

alter table public.fab_production
  add column if not exists valide boolean not null default false;

-- Lignes existantes (essais) : marquées validées pour ne pas changer le comportement avant le reset.
update public.fab_production set valide = true where valide = false;
