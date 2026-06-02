-- 10 — Suite des pains (Khorasan, Intégral, Essentiel, Idéal, Seigle, Petit épeautre, Tourte de meule)
-- Même méthode que le pilote 09 : tout "pour 1 kg de farine" (rendement_base=1),
-- levain = total pesé, eau = coulage fixe, hydratation_pct reproduit ton bassinage.
-- Idempotent, préserve les recette_id.

-- Petit helper mental : pour chaque produit on (1) garantit une recette active,
-- (2) met à jour ses champs, (3) remplace ses lignes.

------------------------------------------------------------------ KHORASAN (pr_khorasan)
-- Base 5 kg (Khorasan 4500 + Tradition 500) · Eau 4000 · Levain dur 2000 · Levure 20 · Sel 125 · Bassinage ~1125 → hydra ~102%
INSERT INTO fab_recettes(produit_id,version,actif,unite_base,rendement_base,hydratation_pct,procede)
SELECT 'pr_khorasan',1,true,'kg de farine',1,102,'Pétrissage 8 min 1ère vitesse, bassinage en 2ème. Pointage 3h à T° ambiante. Division en pavés. Apprêt 15 à 30 min sur couche. Cuisson programme Khorasan.'
WHERE NOT EXISTS (SELECT 1 FROM fab_recettes WHERE produit_id='pr_khorasan' AND actif=true);
UPDATE fab_recettes SET rendement_base=1, unite_base='kg de farine', hydratation_pct=102, procede='Pétrissage 8 min 1ère vitesse, bassinage en 2ème. Pointage 3h à T° ambiante. Division en pavés. Apprêt 15 à 30 min sur couche. Cuisson programme Khorasan.' WHERE produit_id='pr_khorasan' AND actif=true;
DELETE FROM fab_recette_lignes WHERE recette_id IN (SELECT id FROM fab_recettes WHERE produit_id='pr_khorasan' AND actif=true);
INSERT INTO fab_recette_lignes(recette_id,ingredient_id,quantite,unite)
SELECT r.id, v.iid, v.q, 'kg' FROM fab_recettes r
JOIN (VALUES ('ing_khorasan',0.9),('ing_trad_bio',0.1),('ing_eau',0.8),('ing_levain_dur',0.4),('ing_levure',0.004),('ing_sel',0.025)) AS v(iid,q) ON true
WHERE r.produit_id='pr_khorasan' AND r.actif=true;

------------------------------------------------------------------ INTÉGRAL (pr_integral)
-- Base 3,5 kg (Trad 350 + T150 3150) · Eau 2275 · Levain liquide 1400 · Levure 10 · Sel 85 · Bassinage 360 → hydra 75%
INSERT INTO fab_recettes(produit_id,version,actif,unite_base,rendement_base,hydratation_pct,procede)
SELECT 'pr_integral',1,true,'kg de farine',1,75,'Pétrissage 4 min 1ère vitesse - 6 min 2ème vitesse. Pointage 1h30 à 2h puis RABAT, frigo 2°C. Division 20 pièces. Façonnage bâtard. Apprêt 50 min à 1h30. Cuisson programme Pain 500g.'
WHERE NOT EXISTS (SELECT 1 FROM fab_recettes WHERE produit_id='pr_integral' AND actif=true);
UPDATE fab_recettes SET rendement_base=1, unite_base='kg de farine', hydratation_pct=75, procede='Pétrissage 4 min 1ère vitesse - 6 min 2ème vitesse. Pointage 1h30 à 2h puis RABAT, frigo 2°C. Division 20 pièces. Façonnage bâtard. Apprêt 50 min à 1h30. Cuisson programme Pain 500g.' WHERE produit_id='pr_integral' AND actif=true;
DELETE FROM fab_recette_lignes WHERE recette_id IN (SELECT id FROM fab_recettes WHERE produit_id='pr_integral' AND actif=true);
INSERT INTO fab_recette_lignes(recette_id,ingredient_id,quantite,unite)
SELECT r.id, v.iid, v.q, 'kg' FROM fab_recettes r
JOIN (VALUES ('ing_trad_bio',0.1),('ing_t150',0.9),('ing_eau',0.65),('ing_levain_liquide',0.4),('ing_levure',0.003),('ing_sel',0.024)) AS v(iid,q) ON true
WHERE r.produit_id='pr_integral' AND r.actif=true;

------------------------------------------------------------------ ESSENTIEL (pr_essentiel)
-- Base 3,5 kg (Trad 2450 + Seigle 525 + T150 525) · Eau 2275 · Levain liquide 1400 · Levure 10 · Sel 80 · Bassinage 475 → hydra 79%
INSERT INTO fab_recettes(produit_id,version,actif,unite_base,rendement_base,hydratation_pct,procede)
SELECT 'pr_essentiel',1,true,'kg de farine',1,79,'Pétrissage 4 min 1ère - 6 min 2ème puis bassiner. Division 20 pièces. Façonnage bâtard. Apprêt 50 min à 1h30 sur couche. Cuisson programme Ess/Idéal/Int.'
WHERE NOT EXISTS (SELECT 1 FROM fab_recettes WHERE produit_id='pr_essentiel' AND actif=true);
UPDATE fab_recettes SET rendement_base=1, unite_base='kg de farine', hydratation_pct=79, procede='Pétrissage 4 min 1ère - 6 min 2ème puis bassiner. Division 20 pièces. Façonnage bâtard. Apprêt 50 min à 1h30 sur couche. Cuisson programme Ess/Idéal/Int.' WHERE produit_id='pr_essentiel' AND actif=true;
DELETE FROM fab_recette_lignes WHERE recette_id IN (SELECT id FROM fab_recettes WHERE produit_id='pr_essentiel' AND actif=true);
INSERT INTO fab_recette_lignes(recette_id,ingredient_id,quantite,unite)
SELECT r.id, v.iid, v.q, 'kg' FROM fab_recettes r
JOIN (VALUES ('ing_trad_bio',0.7),('ing_seigle_t130',0.15),('ing_t150',0.15),('ing_eau',0.65),('ing_levain_liquide',0.4),('ing_levure',0.003),('ing_sel',0.023)) AS v(iid,q) ON true
WHERE r.produit_id='pr_essentiel' AND r.actif=true;

------------------------------------------------------------------ IDÉAL (pr_ideal) = Essentiel + graines bio
-- Idem Essentiel + Mélange graines bio 0.2/kg (graines trempées au préalable). hydra 79%
INSERT INTO fab_recettes(produit_id,version,actif,unite_base,rendement_base,hydratation_pct,procede)
SELECT 'pr_ideal',1,true,'kg de farine',1,79,'Comme l''Essentiel + 0,2 kg de mélange graines bio par kg de farine (trempées au préalable). Pétrissage 4 min 1ère - 6 min 2ème puis bassiner. Division 20 pièces. Façonnage bâtard. Apprêt 50 min à 1h30. Cuisson programme Ess/Idéal/Int.'
WHERE NOT EXISTS (SELECT 1 FROM fab_recettes WHERE produit_id='pr_ideal' AND actif=true);
UPDATE fab_recettes SET rendement_base=1, unite_base='kg de farine', hydratation_pct=79, procede='Comme l''Essentiel + 0,2 kg de mélange graines bio par kg de farine (trempées au préalable). Pétrissage 4 min 1ère - 6 min 2ème puis bassiner. Division 20 pièces. Façonnage bâtard. Apprêt 50 min à 1h30. Cuisson programme Ess/Idéal/Int.' WHERE produit_id='pr_ideal' AND actif=true;
DELETE FROM fab_recette_lignes WHERE recette_id IN (SELECT id FROM fab_recettes WHERE produit_id='pr_ideal' AND actif=true);
INSERT INTO fab_recette_lignes(recette_id,ingredient_id,quantite,unite)
SELECT r.id, v.iid, v.q, 'kg' FROM fab_recettes r
JOIN (VALUES ('ing_trad_bio',0.7),('ing_seigle_t130',0.15),('ing_t150',0.15),('ing_graines',0.2),('ing_eau',0.65),('ing_levain_liquide',0.4),('ing_levure',0.003),('ing_sel',0.023)) AS v(iid,q) ON true
WHERE r.produit_id='pr_ideal' AND r.actif=true;

------------------------------------------------------------------ SEIGLE AUVERGNAT (pr_seigle)
-- Base 1 kg Seigle T130 · Levain dur 1000 · Eau chaude 950 · Sel 35 · Levure 1.25 · (pas de bassinage) → hydra 95%
INSERT INTO fab_recettes(produit_id,version,actif,unite_base,rendement_base,hydratation_pct,procede)
SELECT 'pr_seigle',1,true,'kg de farine',1,95,'Pétrissage 6 min en 1ère vitesse. Pointage 1h à 1h30. Division 800 g. Bouler dans la farine en banneton (soudure éclatée au four). Apprêt 30 à 45 min. Cuisson 270°C avec beaucoup de buée, four tombant.'
WHERE NOT EXISTS (SELECT 1 FROM fab_recettes WHERE produit_id='pr_seigle' AND actif=true);
UPDATE fab_recettes SET rendement_base=1, unite_base='kg de farine', hydratation_pct=95, procede='Pétrissage 6 min en 1ère vitesse. Pointage 1h à 1h30. Division 800 g. Bouler dans la farine en banneton (soudure éclatée au four). Apprêt 30 à 45 min. Cuisson 270°C avec beaucoup de buée, four tombant.' WHERE produit_id='pr_seigle' AND actif=true;
DELETE FROM fab_recette_lignes WHERE recette_id IN (SELECT id FROM fab_recettes WHERE produit_id='pr_seigle' AND actif=true);
INSERT INTO fab_recette_lignes(recette_id,ingredient_id,quantite,unite)
SELECT r.id, v.iid, v.q, 'kg' FROM fab_recettes r
JOIN (VALUES ('ing_seigle_t130',1.0),('ing_levain_dur',1.0),('ing_eau',0.95),('ing_sel',0.035),('ing_levure',0.00125)) AS v(iid,q) ON true
WHERE r.produit_id='pr_seigle' AND r.actif=true;

------------------------------------------------------------------ PETIT ÉPEAUTRE / ENGRAIN (pr_engrain)
-- Base 1 kg Petit épeautre · Levain dur 500 · Eau chaude 1050 · Sel 25 · Levure 7 · (pas de bassinage) → hydra 105%
INSERT INTO fab_recettes(produit_id,version,actif,unite_base,rendement_base,hydratation_pct,procede)
SELECT 'pr_engrain',1,true,'kg de farine',1,105,'Pétrissage 3 min en 1ère vitesse puis 17 min en 2ème vitesse. Division en moule alu 500 g (moulé au cul de poule). Apprêt 45 min à 1h30. Cuisson programme Petit épeautre.'
WHERE NOT EXISTS (SELECT 1 FROM fab_recettes WHERE produit_id='pr_engrain' AND actif=true);
UPDATE fab_recettes SET rendement_base=1, unite_base='kg de farine', hydratation_pct=105, procede='Pétrissage 3 min en 1ère vitesse puis 17 min en 2ème vitesse. Division en moule alu 500 g (moulé au cul de poule). Apprêt 45 min à 1h30. Cuisson programme Petit épeautre.' WHERE produit_id='pr_engrain' AND actif=true;
DELETE FROM fab_recette_lignes WHERE recette_id IN (SELECT id FROM fab_recettes WHERE produit_id='pr_engrain' AND actif=true);
INSERT INTO fab_recette_lignes(recette_id,ingredient_id,quantite,unite)
SELECT r.id, v.iid, v.q, 'kg' FROM fab_recettes r
JOIN (VALUES ('ing_engrain',1.0),('ing_levain_dur',0.5),('ing_eau',1.05),('ing_sel',0.025),('ing_levure',0.007)) AS v(iid,q) ON true
WHERE r.produit_id='pr_engrain' AND r.actif=true;

------------------------------------------------------------------ TOURTE DE MEULE (pr_tourte_meule)
-- Base 1 kg (Meule T80 900 + Seigle T130 100) · Eau 700 · Levain dur 400 · Levure 3 · Sel 25 · Bassinage 240 → hydra 94%
-- NB : "Meule T80" → réutilise l'ingrédient T80 Bio Bise (à confirmer / sinon créer un ingrédient séparé)
INSERT INTO fab_recettes(produit_id,version,actif,unite_base,rendement_base,hydratation_pct,procede)
SELECT 'pr_tourte_meule',1,true,'kg de farine',1,94,'Pétrissage 10 min en 1ère vitesse puis bassinage. Pointage en bac de 8 kg, 2h à 3h. Diviser par 1 kg ou 500 g. Bouler en banneton. Apprêt une nuit minimum à 2-4°C. Cuisson 250°C programme Pain 500g ou Tourte de meule.'
WHERE NOT EXISTS (SELECT 1 FROM fab_recettes WHERE produit_id='pr_tourte_meule' AND actif=true);
UPDATE fab_recettes SET rendement_base=1, unite_base='kg de farine', hydratation_pct=94, procede='Pétrissage 10 min en 1ère vitesse puis bassinage. Pointage en bac de 8 kg, 2h à 3h. Diviser par 1 kg ou 500 g. Bouler en banneton. Apprêt une nuit minimum à 2-4°C. Cuisson 250°C programme Pain 500g ou Tourte de meule.' WHERE produit_id='pr_tourte_meule' AND actif=true;
DELETE FROM fab_recette_lignes WHERE recette_id IN (SELECT id FROM fab_recettes WHERE produit_id='pr_tourte_meule' AND actif=true);
INSERT INTO fab_recette_lignes(recette_id,ingredient_id,quantite,unite)
SELECT r.id, v.iid, v.q, 'kg' FROM fab_recettes r
JOIN (VALUES ('ing_t80_bise',0.9),('ing_seigle_t130',0.1),('ing_eau',0.7),('ing_levain_dur',0.4),('ing_levure',0.003),('ing_sel',0.025)) AS v(iid,q) ON true
WHERE r.produit_id='pr_tourte_meule' AND r.actif=true;
