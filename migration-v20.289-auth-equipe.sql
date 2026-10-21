-- ============================================================================
-- v20.289 — Connexion équipe (étape 1 sur 2, SANS RISQUE : n'enlève rien à personne)
-- Phil, 22/10/2026 : « que le code boutique qu'ils tapent déjà serve de clé ».
--
-- Ce que fait ce fichier :
--   1. Un compte de connexion par code boutique (veigne@lbdd.app, tours@…, master@…, backoffice@…).
--      Mot de passe = le code. Mis à jour tout seul quand un code change dans le BackOffice.
--   2. Les appareils connectés (rôle authenticated) ont les mêmes droits que la clé publique aujourd'hui.
--   3. La page client pro.html passe par des fonctions qui ne répondent qu'au lien présenté.
-- La clé publique (anon) garde TOUS ses droits : l'app continue de marcher comme avant.
-- Le verrou, c'est le fichier migration-v20.289b-verrou.sql, à lancer le jour choisi.
-- Relançable sans risque.
-- ============================================================================

create extension if not exists pgcrypto;

-- ===== 1. Comptes de connexion = codes boutique =====
create or replace function public.lbdd_auth_email(p_boutique text) returns text
language sql immutable as $$ select regexp_replace(lower(coalesce(p_boutique, '')), '[^a-z0-9]+', '-', 'g') || '@lbdd.app' $$;

create or replace function public.lbdd_sync_auth_user(p_boutique text, p_code text) returns void
language plpgsql security definer set search_path = public, auth, extensions as $$
declare
  v_email text := public.lbdd_auth_email(p_boutique);
  v_id uuid;
begin
  if p_code is null or btrim(p_code) = '' then return; end if;
  select id into v_id from auth.users where email = v_email;
  if v_id is null then
    v_id := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change)
    values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
      crypt(btrim(p_code), gen_salt('bf')), now(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'boutique', p_boutique),
      jsonb_build_object('boutique', p_boutique), now(), now(), '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_id, v_id::text,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true), 'email', now(), now(), now());
  else
    update auth.users set encrypted_password = crypt(btrim(p_code), gen_salt('bf')), updated_at = now() where id = v_id;
  end if;
end $$;
revoke execute on function public.lbdd_sync_auth_user(text, text) from public, anon, authenticated;

-- Un code modifié dans le BackOffice met le compte à jour tout seul
create or replace function public.lbdd_boutique_codes_sync() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.lbdd_sync_auth_user(new.boutique_id, new.code);
  return new;
end $$;
drop trigger if exists lbdd_boutique_codes_sync on public.boutique_codes;
create trigger lbdd_boutique_codes_sync after insert or update of code on public.boutique_codes
  for each row execute function public.lbdd_boutique_codes_sync();

-- Le PIN du BackOffice ouvre aussi une session (compte backoffice@lbdd.app)
insert into public.boutique_codes (tenant_id, boutique_id, code)
values ('00000000-0000-0000-0000-000000000001', 'backoffice', '2412')
on conflict (tenant_id, boutique_id) do nothing;

-- Comptes pour tous les codes existants
do $$ declare r record; begin
  for r in select boutique_id, code from public.boutique_codes loop
    perform public.lbdd_sync_auth_user(r.boutique_id, r.code);
  end loop;
end $$;

-- ===== 2. Les appareils connectés ont les mêmes droits que la clé publique =====
grant usage on schema public to authenticated;
grant select, insert, update on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
alter default privileges for role postgres in schema public grant select, insert, update on tables to authenticated;
alter default privileges for role postgres in schema public grant usage, select on sequences to authenticated;
-- DELETE là où la clé publique l'a (liste de migration-securite-v1b et suivantes)
do $$ declare r record; begin
  for r in select distinct table_name from information_schema.role_table_grants
           where table_schema = 'public' and grantee = 'anon' and privilege_type = 'DELETE' loop
    execute format('grant delete on public.%I to authenticated', r.table_name);
  end loop;
end $$;
-- Sauvegardes : lecture seule, comme pour la clé publique
revoke all on public.db_backups from authenticated;
grant select on public.db_backups to authenticated;
drop policy if exists db_backups_select_equipe on public.db_backups;
create policy db_backups_select_equipe on public.db_backups for select to authenticated using (true);
-- Une règle « équipe : tout » sur chaque table qui a la sécurité par ligne activée
do $$ declare t record; begin
  for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity and c.relname <> 'db_backups' loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t.relname and policyname = 'lbdd_equipe_all') then
      execute format('create policy lbdd_equipe_all on public.%I for all to authenticated using (true) with check (true)', t.relname);
    end if;
  end loop;
end $$;

-- ===== 3. Page client pro.html : des fonctions qui ne répondent qu'au lien présenté =====
-- Les établissements d'un lien : la fiche du lien + son groupe (actifs)
create or replace function public.pro_page_etabs(p_token text) returns setof public.pros
language sql security definer stable set search_path = public as $$
  with moi as (select * from public.pros where magic_token = p_token and magic_token is not null and actif)
  select p.* from public.pros p, moi
  where p.id = moi.id or (moi.groupe is not null and p.groupe = moi.groupe and p.actif)
$$;

create or replace function public.pro_page_bootstrap(p_token text) returns jsonb
language plpgsql security definer stable set search_path = public as $$
declare v_etabs jsonb; v_tenant uuid;
begin
  select tenant_id into v_tenant from public.pros where magic_token = p_token and magic_token is not null limit 1;
  if v_tenant is null then return null; end if;
  select coalesce(jsonb_agg(to_jsonb(e) - 'magic_token' - 'magic_sent_at' order by (e.magic_token = p_token) desc, e.nom), '[]'::jsonb)
    into v_etabs from public.pro_page_etabs(p_token) e;
  if jsonb_array_length(v_etabs) = 0 then return jsonb_build_object('inactif', true); end if;
  return jsonb_build_object(
    'etabs', v_etabs,
    'products', (select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) from public.products p where p.tenant_id = v_tenant and p.actif),
    'jours_off', (select coalesce(jsonb_agg(jsonb_build_object('site', j.site, 'jours', j.jours)), '[]'::jsonb) from public.fab_jours_off j));
end $$;

create or replace function public.pro_page_orders(p_token text, p_from date, p_to date) returns jsonb
language sql security definer stable set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(o) || jsonb_build_object('pro_order_items',
           coalesce((select jsonb_agg(to_jsonb(i)) from public.pro_order_items i where i.pro_order_id = o.id), '[]'::jsonb))
         order by o.date_livraison, o.created_at), '[]'::jsonb)
  from public.pro_orders o
  where o.pro_id in (select id from public.pro_page_etabs(p_token))
    and o.date_livraison between p_from and p_to and o.statut <> 'annule'
$$;

-- Crée ou remplace UN morceau de commande (une ligne pro_orders + ses produits)
create or replace function public.pro_page_upsert_order(p_token text, p_order_id uuid, p_row jsonb, p_items jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_pro public.pros; v_id uuid;
begin
  select * into v_pro from public.pro_page_etabs(p_token) where id = p_row ->> 'pro_id';
  if v_pro.id is null then raise exception 'lien invalide pour cet établissement'; end if;
  if p_order_id is not null then
    update public.pro_orders set date_livraison = (p_row ->> 'date_livraison')::date, boutique_source = p_row ->> 'boutique_source',
      statut = coalesce(p_row ->> 'statut', 'confirme'), notes = p_row ->> 'notes', created_by = p_row ->> 'created_by'
    where id = p_order_id and pro_id = v_pro.id returning id into v_id;
    if v_id is null then raise exception 'commande introuvable'; end if;
    delete from public.pro_order_items where pro_order_id = v_id;
  else
    insert into public.pro_orders (tenant_id, pro_id, date_livraison, boutique_source, statut, notes, created_by)
    values (v_pro.tenant_id, v_pro.id, (p_row ->> 'date_livraison')::date, p_row ->> 'boutique_source',
            coalesce(p_row ->> 'statut', 'confirme'), p_row ->> 'notes', p_row ->> 'created_by')
    returning id into v_id;
  end if;
  insert into public.pro_order_items (pro_order_id, product_id, qty, prix_applique)
  select v_id, x ->> 'product_id', (x ->> 'qty')::numeric, nullif(x ->> 'prix_applique', '')::numeric
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) x;
  return jsonb_build_object('id', v_id);
end $$;

create or replace function public.pro_page_cancel(p_token text, p_ids uuid[], p_delete_items boolean default false) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if p_delete_items then
    delete from public.pro_order_items where pro_order_id in (
      select id from public.pro_orders where id = any(p_ids) and pro_id in (select id from public.pro_page_etabs(p_token)));
  end if;
  update public.pro_orders set statut = 'annule'
  where id = any(p_ids) and pro_id in (select id from public.pro_page_etabs(p_token));
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.pro_page_set_contacts(p_token text, p_etab text, p_contacts jsonb) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update public.pros set contacts = coalesce(p_contacts, '[]'::jsonb)
  where id = p_etab and id in (select id from public.pro_page_etabs(p_token));
  return found;
end $$;

grant execute on function public.pro_page_bootstrap(text), public.pro_page_orders(text, date, date),
  public.pro_page_upsert_order(text, uuid, jsonb, jsonb), public.pro_page_cancel(text, uuid[], boolean),
  public.pro_page_set_contacts(text, text, jsonb) to anon, authenticated;
revoke execute on function public.pro_page_etabs(text) from public, anon, authenticated;

-- Vérification : un compte par code
select u.email, bc.boutique_id, u.created_at
from public.boutique_codes bc join auth.users u on u.email = public.lbdd_auth_email(bc.boutique_id)
order by bc.boutique_id;
