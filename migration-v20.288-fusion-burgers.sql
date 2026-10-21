-- ============================================================================
-- v20.288 — Fusion des pains burger (Phil, 22/10/2026) :
--   « pain burger = pain burger 90g » → UNE fiche : vp_bur, renommée « Pain Burger 90g »,
--   ouverte boutiques + pros (usage 'both'). Tout l'historique de pain_burger_90g
--   (ventes, prévis, commandes pros, stock, recettes, catalogues et tarifs des fiches pros)
--   bascule sur vp_bur, puis la fiche en double est supprimée.
--   Les 70 g (avec / sans graines) sont DÉSACTIVÉS (historique conservé), plus fabriqués.
-- À exécuter dans le SQL Editor Supabase. Idempotent (relançable sans risque).
-- Si une ligne ne peut pas basculer (même jour / même commande déjà présent pour vp_bur),
-- elle est supprimée et signalée dans les messages (onglet « Messages » du résultat).
-- ============================================================================

do $$
declare
  canon text   := 'vp_bur';
  dups  text[] := array['pain_burger_90g'];
  off   text[] := array['pain_burger_70g_ax8dub', 'pain_burger_70g_sg'];
  r record; rr record; n int; conflits int;
begin
  -- 0. la fiche gardée : nom, usage boutiques + pros, reste active
  update public.products set name = 'Pain Burger 90g', usage = 'both', actif = true where id = canon;

  -- 1. toutes les tables qui ont une colonne product_id → bascule des doublons sur vp_bur
  for r in
    select table_name from information_schema.columns
    where table_schema = 'public' and column_name = 'product_id' and table_name <> 'db_backups'
    order by table_name
  loop
    n := 0; conflits := 0;
    for rr in execute format('select ctid from public.%I where product_id = any($1)', r.table_name) using dups loop
      begin
        execute format('update public.%I set product_id = $1 where ctid = $2', r.table_name) using canon, rr.ctid;
        n := n + 1;
      exception when unique_violation then
        -- déjà une ligne vp_bur pour la même clé (même jour / même commande) : la ligne en double est retirée
        execute format('delete from public.%I where ctid = $1', r.table_name) using rr.ctid;
        conflits := conflits + 1;
      end;
    end loop;
    if n > 0 or conflits > 0 then
      raise notice '%: % ligne(s) basculée(s), % doublon(s) retiré(s)', r.table_name, n, conflits;
    end if;
  end loop;

  -- 2. fiches pros : catalogue (liste d'ids), tarifs (objet id → prix), panier type (liste {product_id, qty})
  update public.pros p set catalogue_restreint = (
      select jsonb_agg(distinct v) from (
        select case when x #>> '{}' = any(dups) then to_jsonb(canon) else x end as v
        from jsonb_array_elements(p.catalogue_restreint) x) s)
  where jsonb_typeof(p.catalogue_restreint) = 'array'
    and exists (select 1 from jsonb_array_elements_text(p.catalogue_restreint) e where e = any(dups));

  update public.pros p set prix_speciaux = (
      select coalesce(jsonb_object_agg(k2, v), '{}'::jsonb) from (
        select case when k = any(dups) then canon else k end as k2, v,
               row_number() over (partition by case when k = any(dups) then canon else k end
                                  order by case when k = canon then 0 else 1 end) as rn
        from jsonb_each(p.prix_speciaux) as t(k, v)) s
      where rn = 1)
  where jsonb_typeof(p.prix_speciaux) = 'object'
    and exists (select 1 from jsonb_object_keys(p.prix_speciaux) k where k = any(dups));

  update public.pros p set template_items = (
      select coalesce(jsonb_agg(case when x ->> 'product_id' = any(dups) then jsonb_set(x, '{product_id}', to_jsonb(canon)) else x end), '[]'::jsonb)
      from jsonb_array_elements(p.template_items) x)
  where jsonb_typeof(p.template_items) = 'array'
    and exists (select 1 from jsonb_array_elements(p.template_items) x where x ->> 'product_id' = any(dups));

  -- 3. la fiche en double disparaît ; les 70 g sont désactivés (historique conservé)
  delete from public.products where id = any(dups);
  update public.products set actif = false where id = any(off);
  raise notice 'Terminé : % fusionné(s) dans %, % désactivé(s)', array_to_string(dups, ', '), canon, array_to_string(off, ', ');
end $$;

-- Vérification : vp_bur en 'both', actif ; plus de pain_burger_90g ; 70 g inactifs
select id, name, usage, actif, conditioning_qty from public.products
where id in ('vp_bur', 'pain_burger_90g', 'pain_burger_70g_ax8dub', 'pain_burger_70g_sg') order by id;
