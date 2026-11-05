-- v20.340 — « 📦 Les pros commandent par colis » (Phil, 05/11/2026, cas Terre y Fruits)
--
-- Constat : la fiche « Nougat de Tours Indiv. » est en caisse de 60 pour le congélo tourier (v20.335),
-- et depuis la v20.275 un conditionnement sur la fiche s'impose AUSSI aux pros : sur pro.html le compteur
-- compte des colis → Terre y Fruits tape 10, la commande enregistre 600 (et 1500 le 28/10).
-- Réponse : une case à part sur la fiche produit. Le conditionnement continue de servir au congélo et aux
-- réassorts ; il n'impose plus rien aux pros sauf si `pros_colis` est coché.
-- Cochée d'office : les 6 produits du Relais d'Amboise (v20.275) seulement. Les Minis (sacs de 50 au congélo)
-- restent à la pièce pour les pros (Phil, 09/11 : « à la pièce »).
-- Sans risque, rejouable. À lancer AVANT la mise en ligne du front v20.340.

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS pros_colis boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.products.pros_colis IS
  'v20.340 — true = les pros commandent ce produit par colis (conditioning_unit/qty) : compteur pro.html en colis, arrondi au colis dans l''onglet Pros. false = pièces, même si la fiche a un conditionnement (congélo).';

UPDATE public.products SET pros_colis = true
 WHERE id IN ('khorasan_800g_precuit_su_dwfd55', 'khorasan_boule_200g_cuit', 'mais_precuit_surg',
              'fruite_entier_precuit_su_eetzzi', 'tradition_surgelee', 'tradition_graines_precuite');

-- Vérification
SELECT id, name, conditioning_unit, conditioning_qty, pros_colis
  FROM public.products
 WHERE pros_colis OR id = 'nti'
 ORDER BY pros_colis DESC, name;
