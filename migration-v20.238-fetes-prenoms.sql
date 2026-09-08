-- v20.238 — Fêtes : qui prend la commande, qui la remet (demande Phil, 08/09/2026)
-- Même chose que la v20.237 sur les commandes spéciales, appliqué aux commandes
-- de fête (Noël, galettes, Chandeleur, Pâques).
--
-- La liste des prénoms (table shop_people) est celle créée par la v20.237 :
-- ⚠️ lancer migration-v20.237-prenoms-commande.sql AVANT celle-ci.

alter table public.fete_orders
  add column if not exists taken_by text,   -- prénom de qui a PRIS la commande
  add column if not exists given_by text;   -- prénom de qui l'a REMISE au client

-- Vérification
-- select id, customer_name, taken_by, given_by from public.fete_orders order by created_at desc limit 5;
