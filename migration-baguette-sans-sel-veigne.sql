-- Baguette sans sel à Veigné (Phil, 26/10/2026)
-- Cuite SUR PLACE à Veigné, vendue à la pièce, visible dans Ventes et dans la Prévis Pain
-- (catégorie « pains », déjà en prévis). Pas proposée à Tours ni à St-Avertin (none) :
-- pour l'ajouter ailleurs, changer la ligne supply_by_boutique ou la fiche dans le BackOffice.
-- Rejouable sans risque (on conflict → mise à jour de la fiche).

insert into public.products (id, tenant_id, name, category, unit, usage, actif, supply_by_boutique)
values ('baguette_sans_sel', '00000000-0000-0000-0000-000000000001', 'Baguette Sans Sel', 'pains',
        'piece', 'both', true,
        '{"veigne":"on_site","tours":"none","saint-avertin":"none"}'::jsonb)
on conflict (id) do update
  set name = excluded.name, category = excluded.category, unit = excluded.unit,
      usage = excluded.usage, actif = excluded.actif,
      supply_by_boutique = excluded.supply_by_boutique;

-- Vérification : 1 ligne attendue
select id, name, category, unit, usage, actif, supply_by_boutique
  from public.products where id = 'baguette_sans_sel';
