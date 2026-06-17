-- v20.113 — Planning semaine : sections colorées (reprend le visuel de la feuille papier)
-- À lancer UNE FOIS dans le SQL Editor Supabase. Ajoute la colonne `section`
-- et range les lignes existantes. Le reste (lignes manquantes, couleurs) est géré côté app.

alter table public.fab_planning_lignes add column if not exists section text;

-- PAINS (bleu) : tradition + déclinaisons + blancs
update public.fab_planning_lignes set section='pains'
  where id in (14,15,25,26,27,28,17,18,9);

-- SPÉCIAUX (orange) : épeautre, méteil, châtaigne, petit automne
update public.fab_planning_lignes set section='speciaux'
  where id in (16,21,7);

-- PAINS BIO / SPÉCIAUX (vert)
update public.fab_planning_lignes set section='bio'
  where id in (3,4,5,6,8,10,11,12,13,19,20);

-- VIENNOISERIE / PÂTE SUCRÉE (brun)
update public.fab_planning_lignes set section='viennoiserie'
  where id in (22,23,29);

-- Sécurité : toute ligne encore sans section → 'pains'
update public.fab_planning_lignes set section='pains' where section is null;
