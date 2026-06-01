-- Migration 05 : eau + levure + procédés (complète les recettes bio). Idempotent.
insert into fab_recette_lignes (recette_id,ingredient_id,quantite,unite)
select r.id,'ing_eau',0.94,'kg' from fab_recettes r where r.produit_id='pr_mathis' and r.actif and not exists (select 1 from fab_recette_lignes l where l.recette_id=r.id and l.ingredient_id='ing_eau');
insert into fab_recette_lignes (recette_id,ingredient_id,quantite,unite)
select r.id,'ing_eau',1.05,'kg' from fab_recettes r where r.produit_id='pr_khorasan' and r.actif and not exists (select 1 from fab_recette_lignes l where l.recette_id=r.id and l.ingredient_id='ing_eau');
insert into fab_recette_lignes (recette_id,ingredient_id,quantite,unite)
select r.id,'ing_eau',0.85,'kg' from fab_recettes r where r.produit_id='pr_bp' and r.actif and not exists (select 1 from fab_recette_lignes l where l.recette_id=r.id and l.ingredient_id='ing_eau');
insert into fab_recette_lignes (recette_id,ingredient_id,quantite,unite)
select r.id,'ing_eau',0.95,'kg' from fab_recettes r where r.produit_id='pr_tourte_meule' and r.actif and not exists (select 1 from fab_recette_lignes l where l.recette_id=r.id and l.ingredient_id='ing_eau');
insert into fab_recette_lignes (recette_id,ingredient_id,quantite,unite)
select r.id,'ing_eau',1.05,'kg' from fab_recettes r where r.produit_id='pr_engrain' and r.actif and not exists (select 1 from fab_recette_lignes l where l.recette_id=r.id and l.ingredient_id='ing_eau');
insert into fab_recette_lignes (recette_id,ingredient_id,quantite,unite)
select r.id,'ing_eau',0.95,'kg' from fab_recettes r where r.produit_id='pr_seigle' and r.actif and not exists (select 1 from fab_recette_lignes l where l.recette_id=r.id and l.ingredient_id='ing_eau');
insert into fab_recette_lignes (recette_id,ingredient_id,quantite,unite)
select r.id,'ing_eau',1.0,'kg' from fab_recettes r where r.produit_id='pr_norvegien' and r.actif and not exists (select 1 from fab_recette_lignes l where l.recette_id=r.id and l.ingredient_id='ing_eau');
insert into fab_recette_lignes (recette_id,ingredient_id,quantite,unite)
select r.id,'ing_eau',0.76,'kg' from fab_recettes r where r.produit_id='pr_integral' and r.actif and not exists (select 1 from fab_recette_lignes l where l.recette_id=r.id and l.ingredient_id='ing_eau');
insert into fab_recette_lignes (recette_id,ingredient_id,quantite,unite)
select r.id,'ing_eau',0.7,'kg' from fab_recettes r where r.produit_id='pr_essentiel' and r.actif and not exists (select 1 from fab_recette_lignes l where l.recette_id=r.id and l.ingredient_id='ing_eau');
insert into fab_recette_lignes (recette_id,ingredient_id,quantite,unite)
select r.id,'ing_eau',0.7,'kg' from fab_recettes r where r.produit_id='pr_ideal' and r.actif and not exists (select 1 from fab_recette_lignes l where l.recette_id=r.id and l.ingredient_id='ing_eau');
insert into fab_recette_lignes (recette_id,ingredient_id,quantite,unite)
select r.id,'ing_levure',0.007,'kg' from fab_recettes r where r.produit_id='pr_engrain' and r.actif and not exists (select 1 from fab_recette_lignes l where l.recette_id=r.id and l.ingredient_id='ing_levure');
insert into fab_recette_lignes (recette_id,ingredient_id,quantite,unite)
select r.id,'ing_levure',0.005,'kg' from fab_recettes r where r.produit_id='pr_seigle' and r.actif and not exists (select 1 from fab_recette_lignes l where l.recette_id=r.id and l.ingredient_id='ing_levure');
insert into fab_recette_lignes (recette_id,ingredient_id,quantite,unite)
select r.id,'ing_levure',0.01,'kg' from fab_recettes r where r.produit_id='pr_norvegien' and r.actif and not exists (select 1 from fab_recette_lignes l where l.recette_id=r.id and l.ingredient_id='ing_levure');
update fab_recettes set procede=$proc$Pétrissage : 4 min en 1ère, 12 min en 2ème
Division : moule alu 500 g, ou 1,7 kg grands moules
Apprêt : 45 min à 1h30
Cuisson : programme Petit épeautre$proc$ where produit_id='pr_engrain' and actif;
update fab_recettes set procede=$proc$Pétrissage : 5 min en 1ère, 2 min en 2ème
Pointage : 45 min
Division : 1 kg, bouler dans la farine en banneton (soudure éclatée au four)
Apprêt : 30 à 45 min
Cuisson : 270°C avec beaucoup de buée, four tombant$proc$ where produit_id='pr_seigle' and actif;
update fab_recettes set procede=$proc$Pétrissage : 4 min en 1ère, 6 min en 2ème
Pesage : bac 7,2 à 7,6 kg
Pointage : 1h30 à 2h + RABAT puis frigo 2°C
Division : 20 pièces, façonnage batard
Apprêt : 50 min à 1h30
Cuisson : programme Pain 500 g$proc$ where produit_id='pr_integral' and actif;
update fab_recettes set procede=$proc$Pétrissage : 5 min en 1ère puis 7 min en 2ème
Division : moule de 1,1 kg
Apprêt : 45 min à 1h30 selon la pâte
Cuisson : programme Petit épeautre$proc$ where produit_id='pr_norvegien' and actif;