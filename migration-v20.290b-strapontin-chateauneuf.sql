-- =====================================================================
-- v20.290b — Deux nouveaux restos pros à Tours : Le Strapontin, Le Châteauneuf
-- =====================================================================
-- À lancer APRÈS migration-v20.290-creneaux-pros.sql (colonne creneau_aprem).
--
-- Phil (25/10/2026) :
--   · deux restos clients pros, ils VIENNENT CHERCHER à Tours (jamais en tournée)
--   · Le Strapontin ne commande que des Traditions
--   · Le Châteauneuf : Traditions + Grande Tourte de Meule
--   · ils commandent pour le matin ET pour l'après-midi
--
-- Réglages par défaut (modifiables dans la fiche ou « ⏰ Horaires des pros » à Tours) :
--   · jours : lundi → samedi
--   · matin : commande jusqu'à la veille 23h59, retrait vers 8h
--   · après-midi : commande jusqu'au jour même 11h, retrait vers 15h
--   · pas de prix spécial, catalogue limité aux produits ci-dessus
--   · lien client généré tout de suite (à envoyer depuis « 📱 Liens pros »)
--
-- Les produits sont retrouvés PAR LEUR NOM : le script s'arrête avec un
-- message clair s'il ne trouve pas la Tradition ou la Grande Tourte de Meule.
-- Relançable sans risque (ON CONFLICT DO NOTHING : une fiche existante n'est pas écrasée).
-- =====================================================================

DO $$
DECLARE
  v_tenant   uuid;
  v_trad     text;
  v_tourte   text;
  v_jours    jsonb;
  v_aprem    jsonb;
  v_liste    text;
BEGIN
  SELECT tenant_id INTO v_tenant FROM public.pros LIMIT 1;
  IF v_tenant IS NULL THEN SELECT tenant_id INTO v_tenant FROM public.products LIMIT 1; END IF;
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'tenant introuvable (table pros / products vide ?)'; END IF;

  -- Tradition : la fiche « Tradition » tout court (id vp_tra chez les autres pros), active, pas réservée
  SELECT id INTO v_trad FROM public.products
   WHERE actif AND pros_only_id IS NULL AND lower(name) = 'tradition'
   ORDER BY (id = 'vp_tra') DESC, id LIMIT 1;
  IF v_trad IS NULL THEN
    SELECT string_agg(id || ' = ' || name, ', ' ORDER BY name) INTO v_liste
      FROM public.products WHERE actif AND name ILIKE '%tradition%';
    RAISE EXCEPTION 'Produit « Tradition » introuvable. Produits actifs contenant « tradition » : %', coalesce(v_liste, 'aucun');
  END IF;

  -- Grande Tourte de Meule : nom contenant tourte + meule + grand(e)
  SELECT id INTO v_tourte FROM public.products
   WHERE actif AND pros_only_id IS NULL
     AND name ILIKE '%tourte%' AND name ILIKE '%meule%' AND name ILIKE '%grand%'
   ORDER BY id LIMIT 1;
  IF v_tourte IS NULL THEN
    SELECT string_agg(id || ' = ' || name, ', ' ORDER BY name) INTO v_liste
      FROM public.products WHERE actif AND name ILIKE '%tourte%';
    RAISE EXCEPTION 'Produit « Grande Tourte de Meule » introuvable. Produits actifs contenant « tourte » : %  → renomme la bonne fiche en « Tourte de Meule Grande » ou mets son id à la main dans ce script.', coalesce(v_liste, 'aucun');
  END IF;

  v_jours := '{}'::jsonb;
  FOREACH v_liste IN ARRAY ARRAY['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'] LOOP
    v_jours := v_jours || jsonb_build_object(v_liste, jsonb_build_object(
      'actif', true, 'butoir_decalage', -1, 'butoir_heure', '23:59', 'livraison', '08:00', 'tournee', 'retrait'));
  END LOOP;
  v_aprem := jsonb_build_object('actif', true, 'butoir_decalage', 0, 'butoir_heure', '11:00', 'livraison', '15:00');

  INSERT INTO public.pros (id, tenant_id, nom, contacts, boutique_principale, boutique_secours,
                           jours_livraison, creneau_aprem, catalogue_restreint, prix_speciaux, template_items,
                           sources_par_categorie, notes, actif, magic_token)
  VALUES
    ('le_strapontin', v_tenant, 'Le Strapontin', '[]'::jsonb, 'tours', NULL,
     v_jours, v_aprem, jsonb_build_array(v_trad), '{}'::jsonb, '[]'::jsonb,
     '{}'::jsonb, 'Resto, vient chercher à Tours. Traditions seulement. Matin + après-midi.', true,
     replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')),
    ('le_chateauneuf', v_tenant, 'Le Châteauneuf', '[]'::jsonb, 'tours', NULL,
     v_jours, v_aprem, jsonb_build_array(v_trad, v_tourte), '{}'::jsonb, '[]'::jsonb,
     '{}'::jsonb, 'Resto, vient chercher à Tours. Traditions + Grande Tourte de Meule. Matin + après-midi.', true,
     replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE 'OK — Tradition = %, Grande Tourte de Meule = %', v_trad, v_tourte;
END $$;

-- Vérification
SELECT id, nom, boutique_principale, catalogue_restreint, creneau_aprem, magic_token IS NOT NULL AS lien_pret
  FROM public.pros WHERE id IN ('le_strapontin', 'le_chateauneuf');
