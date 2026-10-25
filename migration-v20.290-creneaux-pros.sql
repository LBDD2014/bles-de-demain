-- =====================================================================
-- v20.290 — Pros : deux créneaux par jour (matin + après-midi)
-- =====================================================================
-- Besoin (Phil, 25/10/2026) : Le Strapontin et Le Châteauneuf (restos de
-- Tours, viennent chercher) doivent pouvoir commander POUR LE MATIN ET
-- POUR L'APRÈS-MIDI du même jour. Jusqu'ici une commande = un pro + une
-- date : la page client disait « déjà commandé » dès la première.
--
-- Modèle :
--   pro_orders.creneau   : 'matin' (défaut, toutes les commandes existantes)
--                          ou 'apres_midi'
--   pros.creneau_aprem   : null = un seul créneau (comme avant)
--                          { actif, butoir_decalage, butoir_heure, livraison }
--                          = réglage de l'après-midi, valable les jours cochés
--                          dans jours_livraison (butoir_decalage 0 = jour même)
--
-- La fonction pro_page_upsert_order (page client) enregistre le créneau.
-- pro_page_orders / pro_page_bootstrap renvoient to_jsonb(...) : la colonne
-- arrive toute seule, rien à changer.
--
-- Sans risque : colonnes ajoutées avec valeur par défaut, rien de supprimé.
-- =====================================================================

-- 1. Commandes : le créneau
ALTER TABLE public.pro_orders
  ADD COLUMN IF NOT EXISTS creneau text NOT NULL DEFAULT 'matin';
ALTER TABLE public.pro_orders DROP CONSTRAINT IF EXISTS pro_orders_creneau_check;
ALTER TABLE public.pro_orders ADD CONSTRAINT pro_orders_creneau_check
  CHECK (creneau IN ('matin', 'apres_midi'));
COMMENT ON COLUMN public.pro_orders.creneau IS
  'v20.290 — matin (défaut) ou apres_midi : un pro à deux créneaux peut avoir une commande par créneau et par jour';

-- 2. Fiche pro : réglage de l'après-midi (null = pas d'après-midi)
ALTER TABLE public.pros
  ADD COLUMN IF NOT EXISTS creneau_aprem jsonb;
COMMENT ON COLUMN public.pros.creneau_aprem IS
  'v20.290 — null = un seul créneau ; sinon { actif, butoir_decalage (0 = jour même), butoir_heure, livraison } pour l''après-midi, les jours cochés';

-- 3. Page client : la fonction d'enregistrement garde le créneau
create or replace function public.pro_page_upsert_order(p_token text, p_order_id uuid, p_row jsonb, p_items jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_pro public.pros; v_id uuid; v_creneau text;
begin
  select * into v_pro from public.pro_page_etabs(p_token) where id = p_row ->> 'pro_id';
  if v_pro.id is null then raise exception 'lien invalide pour cet établissement'; end if;
  v_creneau := case when p_row ->> 'creneau' = 'apres_midi' then 'apres_midi' else 'matin' end;
  if p_order_id is not null then
    update public.pro_orders set date_livraison = (p_row ->> 'date_livraison')::date, boutique_source = p_row ->> 'boutique_source',
      statut = coalesce(p_row ->> 'statut', 'confirme'), notes = p_row ->> 'notes', created_by = p_row ->> 'created_by',
      creneau = v_creneau
    where id = p_order_id and pro_id = v_pro.id returning id into v_id;
    if v_id is null then raise exception 'commande introuvable'; end if;
    delete from public.pro_order_items where pro_order_id = v_id;
  else
    insert into public.pro_orders (tenant_id, pro_id, date_livraison, boutique_source, statut, notes, created_by, creneau)
    values (v_pro.tenant_id, v_pro.id, (p_row ->> 'date_livraison')::date, p_row ->> 'boutique_source',
            coalesce(p_row ->> 'statut', 'confirme'), p_row ->> 'notes', p_row ->> 'created_by', v_creneau)
    returning id into v_id;
  end if;
  insert into public.pro_order_items (pro_order_id, product_id, qty, prix_applique)
  select v_id, x ->> 'product_id', (x ->> 'qty')::numeric, nullif(x ->> 'prix_applique', '')::numeric
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) x;
  return jsonb_build_object('id', v_id);
end $$;

-- 4. Vérification
-- SELECT column_name, data_type, column_default FROM information_schema.columns
--   WHERE table_name IN ('pro_orders', 'pros') AND column_name IN ('creneau', 'creneau_aprem');
