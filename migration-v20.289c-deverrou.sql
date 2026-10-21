-- ============================================================================
-- v20.289c — DÉVERROU (retour arrière du verrou v20.289b) : la clé publique retrouve ses droits
-- d'avant (lecture/écriture partout, suppression sur les tables de migration-securite-v1b et suivantes).
-- ============================================================================
grant usage on schema public to anon;
grant select, insert, update on all tables in schema public to anon;
grant usage, select on all sequences in schema public to anon;
alter default privileges for role postgres in schema public grant select, insert, update on tables to anon;
alter default privileges for role postgres in schema public grant usage, select on sequences to anon;
do $$ declare t text; begin
  foreach t in array array[
    'deliveries','products','pros','pro_order_items','special_orders','special_order_items',
    'livreur_messages','metro_products','veigne_pat_stock','fab_recette_lignes','fab_production','fab_sorties',
    'fab_livraisons','fab_pertes','fab_mouvements','fab_inventaires','fab_planning_lignes',
    'fab_ingredients','fab_produits','fab_fournisseurs','tourier_stock','fete_products','shop_people'] loop
    begin execute format('grant delete on public.%I to anon', t);
    exception when others then raise warning 'grant delete % : %', t, sqlerrm; end;
  end loop;
end $$;
revoke all on public.db_backups from anon;
grant select on public.db_backups to anon;
select count(*) as droits_anon from information_schema.role_table_grants where table_schema = 'public' and grantee = 'anon';
