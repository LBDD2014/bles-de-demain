-- ============================================================================
-- v20.289b — LE VERROU (étape 2 sur 2). À lancer LE JOUR CHOISI, quand tous les appareils
-- ont retapé leur code (ils sont alors connectés). Avant : migration-v20.289-auth-equipe.sql.
-- Effet : la clé publique ne peut plus rien lire ni écrire. Seuls les appareils connectés
-- (code boutique tapé) et la page client (via ses fonctions) continuent de marcher.
-- Retour arrière en 10 secondes : migration-v20.289c-deverrou.sql.
-- ============================================================================
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
-- la page client garde ses fonctions
grant execute on function public.pro_page_bootstrap(text), public.pro_page_orders(text, date, date),
  public.pro_page_upsert_order(text, uuid, jsonb, jsonb), public.pro_page_cancel(text, uuid[], boolean),
  public.pro_page_set_contacts(text, text, jsonb) to anon;
-- Vérification : la clé publique ne doit plus avoir aucun droit sur les tables (0 ligne attendue)
select table_name, privilege_type from information_schema.role_table_grants
where table_schema = 'public' and grantee = 'anon' order by 1, 2;
