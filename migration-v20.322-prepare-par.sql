-- v20.322 — « Qui a préparé la commande » (Phil, 29/10/2026 : « j'ai besoin de voir sur la tablette qui a préparé »)
-- Quand une vendeuse appuie sur « Mis de côté ✓ », l'app enregistre le prénom réglé sur la tablette et l'heure.
-- Sans risque : deux colonnes ajoutées sur chaque table, rien de modifié. Relançable.
-- Tant que ce n'est pas lancé, « Mis de côté » marche comme avant (sans le prénom) et l'app prévient une fois.

alter table public.special_orders add column if not exists prepared_by text;
alter table public.special_orders add column if not exists prepared_at timestamptz;
alter table public.fete_orders    add column if not exists prepared_by text;
alter table public.fete_orders    add column if not exists prepared_at timestamptz;

-- Vérification :
--   select customer_name, status, prepared_by, prepared_at from public.special_orders where prepared_by is not null order by prepared_at desc limit 10;
