-- v20.270 — Envoi partiel sur les écrans de production (Phil, 30/09/2026)
-- « Le magasin demande 200, j'en envoie 150 à la 1re tournée : il faut que je sache combien
-- j'ai envoyé et combien il reste, et que le magasin le sache aussi. »
-- La coche ✓ (production_done, v20.262) porte maintenant une quantité :
--   qty_envoyee  = cumul de ce qui est parti (150, puis 200)
--   qty_total    = le total de la ligne au moment de la saisie (200) — le magasin affiche « 150 / 200 »
--   nb_envois    = combien de fois on a envoyé (« en 2 fois »)
--   reste_heure  = heure prévue du reste ('10:00' par défaut, menu 5h → 12h), null quand tout est parti
-- done_at reste la « ligne complète » ; partiel = done_at null + qty_envoyee > 0. Rien ne se reporte au lendemain.
--
-- ⚠️ À exécuter dans le SQL Editor Supabase AVANT de pousser la v20.270 (sinon l'app garde
-- seulement la coche et affiche un avertissement orange à chaque envoi partiel).

alter table public.production_done
  add column if not exists qty_envoyee numeric,
  add column if not exists qty_total   numeric,
  add column if not exists nb_envois   integer not null default 0,
  add column if not exists reste_heure text;

-- vérification :
-- select column_name from information_schema.columns where table_name = 'production_done';
