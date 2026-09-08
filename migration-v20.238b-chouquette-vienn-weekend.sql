-- v20.238b — Chouquette + Vienn. du Week End visibles dans « Matin » (Phil, 08/09/2026)
-- Déjà appliqué en prod le 08/09/2026 via l'API REST. Rejouable sans risque.
--
-- 1) « Vienn. du Week End » existait mais UNIQUEMENT dans le catalogue réassort
--    (usage = 'reappro') : elle ne pouvait donc pas apparaître dans l'écran Ventes,
--    donc jamais dans la colonne Matin. On la passe en 'both' (vendue ET réassortie).
update public.products set usage = 'both' where id = 'vv_wke';

-- 2) « Chouquette » n'existait pas du tout au catalogue (elle était tapée en texte
--    libre sur les commandes : « 300gr chouquettes »…). Circuit dit par Phil :
--      · Veigné      : cuite sur place            -> on_site
--      · Tours       : reçue surgelée de Veigné, cuite sur place -> veigne
--      · St-Avertin  : livrée CUITE le matin par Le Local        -> local
--    Vendue à la grille, dans les 3 boutiques.
insert into public.products (id, tenant_id, name, category, unit, usage, actif, supply_by_boutique)
values ('chouquette', '00000000-0000-0000-0000-000000000001', 'Chouquette', 'viennoiserie',
        'grille', 'both', true,
        '{"veigne":"on_site","tours":"veigne","saint-avertin":"local"}'::jsonb)
on conflict (id) do update
  set name = excluded.name, category = excluded.category, unit = excluded.unit,
      usage = excluded.usage, actif = excluded.actif,
      supply_by_boutique = excluded.supply_by_boutique;

-- Vérification
-- select id, name, category, unit, usage, supply_by_boutique
--   from public.products where id in ('chouquette','vv_wke');

-- 3) Unités confirmées par Phil (08/09) : la Vienn. du Week End se vend à la pièce,
--    la Chouquette à la grille (nombre de pièces par grille non renseigné à ce jour —
--    dès qu'on l'a, mettre conditioning_unit='grille' + conditioning_qty=N pour que
--    l'app affiche « grille de N » au lieu de « grille »).
update public.products set unit = 'pièce' where id = 'vv_wke';
