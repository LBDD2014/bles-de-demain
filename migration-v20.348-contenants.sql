-- v20.348 — « Combien de contenants ? » : plusieurs tickets retrait par commande, numérotés 1/3, 2/3, 3/3
-- (Phil, 22/11/2026 : « par défaut 1 étiquette, mais ils peuvent choisir plus manuellement », et l'app
-- « apprend au quotidien auprès des équipes par rapport aux clics qu'ils font sur la tablette »).
-- nb_contenants  = le nombre choisi par la vendeuse au moment d'imprimer les tickets retrait (boîte, sacs…)
-- contenants_cle = le « type de contenu » de la commande au moment du choix (ex. « buche1+pain »), ce qui permet
--                  de proposer la prochaine fois le nombre le plus souvent choisi dans la même boutique.
-- Sans risque : colonnes ajoutées, rien de modifié. Relançable. Tant que ce n'est pas lancé, les tickets
-- s'impriment quand même (le nombre n'est juste pas mémorisé, l'app prévient une fois).

alter table public.special_orders add column if not exists nb_contenants smallint;
alter table public.special_orders add column if not exists contenants_cle text;
alter table public.fete_orders    add column if not exists nb_contenants smallint;
alter table public.fete_orders    add column if not exists contenants_cle text;

-- Vérification (ce que l'app a appris, par boutique) :
--   select origin_shop, contenants_cle, nb_contenants, count(*) from public.special_orders
--   where nb_contenants is not null group by 1, 2, 3 order by 1, 2, 4 desc;
