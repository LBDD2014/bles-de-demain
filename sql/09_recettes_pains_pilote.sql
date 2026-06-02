-- 09 — PILOTE : 3 recettes de pain (Blés de pop, Mathis, Tradition)
-- Modèle : tout exprimé "pour 1 kg de farine" (rendement_base = 1).
--   - levain = TOTAL pesé (levain dur 60% / liquide 100%) ; le bilan bio sortira la farine plus tard.
--   - eau = eau de COULAGE (fixe) ; le bassinage est recalculé sur la fiche depuis hydratation_pct.
--   - hydratation_pct = (coulage + bassinage) / farine, pour reproduire ton bassinage d'origine.
-- Idempotent : peut être relancé. Préserve les recette_id (FK production) : on remplace seulement les lignes.

------------------------------------------------------------------ BLÉS DE POP (pr_bp)
-- Base 1 kg : Farine BP 1000 · Eau 650 · Levain dur 400 · Levure 4 · Sel 25 · Bassinage 200 → hydra (650+200)/1000 = 85%
INSERT INTO fab_recettes(produit_id,version,actif,unite_base,rendement_base,hydratation_pct,procede)
SELECT 'pr_bp',1,true,'kg de farine',1,85,
 'Pétrissage : 10 min 1ère vitesse puis bassiner en 2ème. Pointage 1h30 à 2h puis RABAT, frigo 2°C. Division : plier en 2-3 puis pavé. Apprêt 1h30 à 2h15 sur couche. Cuisson : programme Pain 500g.'
WHERE NOT EXISTS (SELECT 1 FROM fab_recettes WHERE produit_id='pr_bp' AND actif=true);
UPDATE fab_recettes SET rendement_base=1, unite_base='kg de farine', hydratation_pct=85,
 procede='Pétrissage : 10 min 1ère vitesse puis bassiner en 2ème. Pointage 1h30 à 2h puis RABAT, frigo 2°C. Division : plier en 2-3 puis pavé. Apprêt 1h30 à 2h15 sur couche. Cuisson : programme Pain 500g.'
WHERE produit_id='pr_bp' AND actif=true;
DELETE FROM fab_recette_lignes WHERE recette_id IN (SELECT id FROM fab_recettes WHERE produit_id='pr_bp' AND actif=true);
INSERT INTO fab_recette_lignes(recette_id,ingredient_id,quantite,unite)
SELECT r.id, v.iid, v.q, 'kg' FROM fab_recettes r
JOIN (VALUES ('ing_bp',1.0),('ing_eau',0.65),('ing_levain_dur',0.4),('ing_levure',0.004),('ing_sel',0.025)) AS v(iid,q) ON true
WHERE r.produit_id='pr_bp' AND r.actif=true;

------------------------------------------------------------------ MATHIS (pr_mathis)
-- Base 5 kg farine (Trad 3500 + Khorasan 750 + Engrain 750) · Eau 3500 · Levain dur 2000 · Levure 15 · Sel 125 · Bassinage ~1350
-- /5 → Trad 0.7 · Khorasan 0.15 · Engrain 0.15 · Eau 0.70 · Levain dur 0.40 · Levure 0.003 · Sel 0.025 · hydra (3500+1350)/5000 = 97%
INSERT INTO fab_recettes(produit_id,version,actif,unite_base,rendement_base,hydratation_pct,procede)
SELECT 'pr_mathis',1,true,'kg de farine',1,97,
 'Pétrissage : 10 min 1ère vitesse puis bassiner en 2ème. Pointage 1h30 à 2h puis RABAT, frigo 2°C. Division : plier puis pavé. Apprêt 1h30 à 2h15 sur couche. Cuisson : programme Pain 500g.'
WHERE NOT EXISTS (SELECT 1 FROM fab_recettes WHERE produit_id='pr_mathis' AND actif=true);
UPDATE fab_recettes SET rendement_base=1, unite_base='kg de farine', hydratation_pct=97,
 procede='Pétrissage : 10 min 1ère vitesse puis bassiner en 2ème. Pointage 1h30 à 2h puis RABAT, frigo 2°C. Division : plier puis pavé. Apprêt 1h30 à 2h15 sur couche. Cuisson : programme Pain 500g.'
WHERE produit_id='pr_mathis' AND actif=true;
DELETE FROM fab_recette_lignes WHERE recette_id IN (SELECT id FROM fab_recettes WHERE produit_id='pr_mathis' AND actif=true);
INSERT INTO fab_recette_lignes(recette_id,ingredient_id,quantite,unite)
SELECT r.id, v.iid, v.q, 'kg' FROM fab_recettes r
JOIN (VALUES ('ing_trad_bio',0.7),('ing_khorasan',0.15),('ing_engrain',0.15),('ing_eau',0.7),('ing_levain_dur',0.4),('ing_levure',0.003),('ing_sel',0.025)) AS v(iid,q) ON true
WHERE r.produit_id='pr_mathis' AND r.actif=true;

------------------------------------------------------------------ TRADITION (pr_tradition — nouveau produit)
-- Base 1 kg : Farine Tradition 1000 · Eau 650 · Levain (liquide) 140 · Levure ~6 · Sel 22 · Bassinage 90 → hydra (650+90)/1000 = 74%
INSERT INTO fab_produits(id,nom,categorie,bio) VALUES ('pr_tradition','Tradition','pain',true) ON CONFLICT (id) DO NOTHING;
INSERT INTO fab_recettes(produit_id,version,actif,unite_base,rendement_base,hydratation_pct,procede)
SELECT 'pr_tradition',1,true,'kg de farine',1,74,
 'Autolyse 2 à 3h (4-5 min 1ère vitesse puis froid). Pétrissage 8-10 min 1ère vitesse puis bassiner. Pointage 1h à 1h30 puis frigo. Division 20 pièces. Façonnage baguette. Apprêt 20-30 min sur couche. Cuisson programme Tradition.'
WHERE NOT EXISTS (SELECT 1 FROM fab_recettes WHERE produit_id='pr_tradition' AND actif=true);
UPDATE fab_recettes SET rendement_base=1, unite_base='kg de farine', hydratation_pct=74,
 procede='Autolyse 2 à 3h (4-5 min 1ère vitesse puis froid). Pétrissage 8-10 min 1ère vitesse puis bassiner. Pointage 1h à 1h30 puis frigo. Division 20 pièces. Façonnage baguette. Apprêt 20-30 min sur couche. Cuisson programme Tradition.'
WHERE produit_id='pr_tradition' AND actif=true;
DELETE FROM fab_recette_lignes WHERE recette_id IN (SELECT id FROM fab_recettes WHERE produit_id='pr_tradition' AND actif=true);
INSERT INTO fab_recette_lignes(recette_id,ingredient_id,quantite,unite)
SELECT r.id, v.iid, v.q, 'kg' FROM fab_recettes r
JOIN (VALUES ('ing_trad_bio',1.0),('ing_eau',0.65),('ing_levain_liquide',0.14),('ing_levure',0.006),('ing_sel',0.022)) AS v(iid,q) ON true
WHERE r.produit_id='pr_tradition' AND r.actif=true;
