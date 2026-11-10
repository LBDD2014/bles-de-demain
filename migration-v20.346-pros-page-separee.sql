-- v20.346 — Dakota : chaque café sa propre page de commande (Phil, 10/11/2026)
--
-- Constat : Dakota Café Tours et Dakota Café Chambray sont dans le même groupe « dakota ». N'importe lequel de leurs
-- deux liens ouvrait une page avec les DEUX cafés côte à côte, et enregistrer la journée réécrivait les lignes des deux
-- (une erreur le 10/11). Phil : « qu'ils puissent commander chacun de leur côté sans toucher la commande de leur collègue ».
-- Réponse : le groupe reste (il sert au « Total Dakota » de Pièces par client), mais une case sur la fiche,
-- `pros.page_separee`, dit que le lien de cet établissement n'ouvre QUE cet établissement.
-- Le 10/11 le groupe a été retiré en urgence des deux fiches (données) ; cette migration le remet, pages séparées.
-- Sans risque, rejouable. À lancer AVANT la mise en ligne du front v20.346.

ALTER TABLE public.pros ADD COLUMN IF NOT EXISTS page_separee boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.pros.page_separee IS
  'v20.346 — true = le lien de cet établissement n''ouvre que sa propre page de commande, même s''il est dans un groupe (le groupe ne sert alors qu''aux récaps).';

-- Les établissements d'un lien : la fiche du lien + son groupe (actifs), SAUF si la fiche du lien a « page séparée »
-- (elle est alors seule) ; un établissement « page séparée » n'apparaît jamais sur la page d'un autre.
create or replace function public.pro_page_etabs(p_token text) returns setof public.pros
language sql security definer stable set search_path = public as $$
  with moi as (select * from public.pros where magic_token = p_token and magic_token is not null and actif)
  select p.* from public.pros p, moi
  where p.id = moi.id
     or (moi.groupe is not null and not moi.page_separee
         and p.groupe = moi.groupe and p.actif and not p.page_separee)
$$;
revoke execute on function public.pro_page_etabs(text) from public, anon, authenticated;

-- Dakota : le groupe revient (total dans les récaps), chaque café garde sa page à lui
UPDATE public.pros SET groupe = 'dakota', page_separee = true
 WHERE id IN ('dakota_cafe', 'dakota_cafe_chambray_les_tours');

-- Vérification
SELECT id, nom, groupe, page_separee, magic_token IS NOT NULL AS lien_pret
  FROM public.pros
 WHERE groupe IS NOT NULL OR page_separee
 ORDER BY groupe, nom;
