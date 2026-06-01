-- Migration 04 : recettes pains bio (proportions par kg de farine). Idempotent. Éditable ensuite dans l'app.
-- pr_mathis
insert into fab_recettes (produit_id,version,unite_base,rendement_base,actif)
select 'pr_mathis',1,'kg de farine',1,true where not exists (select 1 from fab_recettes where produit_id='pr_mathis' and actif);
insert into fab_recette_lignes (recette_id,ingredient_id,quantite,unite)
select r.id,v.ing,v.q,'kg' from fab_recettes r join (values ('ing_trad_bio',0.7),('ing_khorasan',0.15),('ing_engrain',0.15),('ing_sel',0.025),('ing_levain_dur',0.275)) as v(ing,q) on true
where r.produit_id='pr_mathis' and r.actif and not exists (select 1 from fab_recette_lignes l where l.recette_id=r.id);

-- pr_bp
insert into fab_recettes (produit_id,version,unite_base,rendement_base,actif)
select 'pr_bp',1,'kg de farine',1,true where not exists (select 1 from fab_recettes where produit_id='pr_bp' and actif);
insert into fab_recette_lignes (recette_id,ingredient_id,quantite,unite)
select r.id,v.ing,v.q,'kg' from fab_recettes r join (values ('ing_bp',1.0),('ing_sel',0.025),('ing_levain_dur',0.275)) as v(ing,q) on true
where r.produit_id='pr_bp' and r.actif and not exists (select 1 from fab_recette_lignes l where l.recette_id=r.id);

-- pr_tourte_meule
insert into fab_recettes (produit_id,version,unite_base,rendement_base,actif)
select 'pr_tourte_meule',1,'kg de farine',1,true where not exists (select 1 from fab_recettes where produit_id='pr_tourte_meule' and actif);
insert into fab_recette_lignes (recette_id,ingredient_id,quantite,unite)
select r.id,v.ing,v.q,'kg' from fab_recettes r join (values ('ing_seigle_t130',0.1),('ing_t80_bise',0.9),('ing_sel',0.025),('ing_levain_dur',0.275)) as v(ing,q) on true
where r.produit_id='pr_tourte_meule' and r.actif and not exists (select 1 from fab_recette_lignes l where l.recette_id=r.id);

-- pr_engrain
insert into fab_recettes (produit_id,version,unite_base,rendement_base,actif)
select 'pr_engrain',1,'kg de farine',1,true where not exists (select 1 from fab_recettes where produit_id='pr_engrain' and actif);
insert into fab_recette_lignes (recette_id,ingredient_id,quantite,unite)
select r.id,v.ing,v.q,'kg' from fab_recettes r join (values ('ing_engrain',1.0),('ing_sel',0.025),('ing_levain_dur',0.275)) as v(ing,q) on true
where r.produit_id='pr_engrain' and r.actif and not exists (select 1 from fab_recette_lignes l where l.recette_id=r.id);

-- pr_seigle
insert into fab_recettes (produit_id,version,unite_base,rendement_base,actif)
select 'pr_seigle',1,'kg de farine',1,true where not exists (select 1 from fab_recettes where produit_id='pr_seigle' and actif);
insert into fab_recette_lignes (recette_id,ingredient_id,quantite,unite)
select r.id,v.ing,v.q,'kg' from fab_recettes r join (values ('ing_seigle_t130',1.0),('ing_sel',0.025),('ing_levain_dur',0.275)) as v(ing,q) on true
where r.produit_id='pr_seigle' and r.actif and not exists (select 1 from fab_recette_lignes l where l.recette_id=r.id);

-- pr_integral
insert into fab_recettes (produit_id,version,unite_base,rendement_base,actif)
select 'pr_integral',1,'kg de farine',1,true where not exists (select 1 from fab_recettes where produit_id='pr_integral' and actif);
insert into fab_recette_lignes (recette_id,ingredient_id,quantite,unite)
select r.id,v.ing,v.q,'kg' from fab_recettes r join (values ('ing_trad_bio',0.1),('ing_t150',0.9),('ing_sel',0.025),('ing_levain_liquide',0.2)) as v(ing,q) on true
where r.produit_id='pr_integral' and r.actif and not exists (select 1 from fab_recette_lignes l where l.recette_id=r.id);

-- pr_essentiel
insert into fab_recettes (produit_id,version,unite_base,rendement_base,actif)
select 'pr_essentiel',1,'kg de farine',1,true where not exists (select 1 from fab_recettes where produit_id='pr_essentiel' and actif);
insert into fab_recette_lignes (recette_id,ingredient_id,quantite,unite)
select r.id,v.ing,v.q,'kg' from fab_recettes r join (values ('ing_trad_bio',0.7),('ing_t150',0.15),('ing_seigle_t130',0.15),('ing_sel',0.025),('ing_levain_liquide',0.2)) as v(ing,q) on true
where r.produit_id='pr_essentiel' and r.actif and not exists (select 1 from fab_recette_lignes l where l.recette_id=r.id);

-- pr_ideal
insert into fab_recettes (produit_id,version,unite_base,rendement_base,actif)
select 'pr_ideal',1,'kg de farine',1,true where not exists (select 1 from fab_recettes where produit_id='pr_ideal' and actif);
insert into fab_recette_lignes (recette_id,ingredient_id,quantite,unite)
select r.id,v.ing,v.q,'kg' from fab_recettes r join (values ('ing_trad_bio',0.7),('ing_t150',0.15),('ing_seigle_t130',0.15),('ing_graines',0.1),('ing_sel',0.025),('ing_levain_liquide',0.2)) as v(ing,q) on true
where r.produit_id='pr_ideal' and r.actif and not exists (select 1 from fab_recette_lignes l where l.recette_id=r.id);

-- pr_khorasan
insert into fab_recettes (produit_id,version,unite_base,rendement_base,actif)
select 'pr_khorasan',1,'kg de farine',1,true where not exists (select 1 from fab_recettes where produit_id='pr_khorasan' and actif);
insert into fab_recette_lignes (recette_id,ingredient_id,quantite,unite)
select r.id,v.ing,v.q,'kg' from fab_recettes r join (values ('ing_trad_bio',0.1),('ing_khorasan',0.9),('ing_sel',0.025),('ing_levain_dur',0.275)) as v(ing,q) on true
where r.produit_id='pr_khorasan' and r.actif and not exists (select 1 from fab_recette_lignes l where l.recette_id=r.id);

-- pr_norvegien
insert into fab_recettes (produit_id,version,unite_base,rendement_base,actif)
select 'pr_norvegien',1,'kg de farine',1,true where not exists (select 1 from fab_recettes where produit_id='pr_norvegien' and actif);
insert into fab_recette_lignes (recette_id,ingredient_id,quantite,unite)
select r.id,v.ing,v.q,'kg' from fab_recettes r join (values ('ing_seigle_t130',0.25),('ing_t80_bise',0.75),('ing_graines',0.4),('ing_sel',0.025),('ing_levain_dur',0.275)) as v(ing,q) on true
where r.produit_id='pr_norvegien' and r.actif and not exists (select 1 from fab_recette_lignes l where l.recette_id=r.id);
