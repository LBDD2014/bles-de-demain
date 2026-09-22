-- v20.250 — Commandes clients répétées (demande Phil, 22/09/2026)
-- « J'ai des commandes récurrentes, genre à Veigné une ficelle sans sel tous les jours. »
--
-- Le bouton 🔁 « Répéter cette commande » crée une commande par jour coché. Toutes
-- portent le même serie_id (= id de la commande d'origine) : c'est ce qui permet de
-- prolonger la série sans doublon, ou de l'arrêter (suppression des commandes à venir).
--
-- ⚠️ À exécuter dans le SQL Editor Supabase AVANT de pousser la v20.250.
-- DELETE sur special_orders / special_order_items : déjà accordé (migration-securite-v1b).

alter table public.special_orders
  add column if not exists serie_id text;

create index if not exists special_orders_serie_idx
  on public.special_orders (serie_id) where serie_id is not null;

-- Vérification
-- select column_name, data_type from information_schema.columns
--  where table_name = 'special_orders' and column_name = 'serie_id';
