-- ============================================================================
-- migration v20.248 — Nettoyage du congélo tourier : 11 lignes vides en double
--
-- POURQUOI
-- Chaque produit du congélo existe souvent en DEUX fiches : une fiche « vente »
-- (ce que la boutique vend) et une fiche « réassort » (ce que la boutique
-- commande). Le stock du congélo doit être porté par la fiche RÉASSORT, comme
-- pour le Cookie Chocolat.
-- Pour ces 11 produits, les DEUX fiches étaient inscrites au congélo : la fiche
-- réassort avec le vrai stock, et la fiche vente avec un stock à 0. Le tourier
-- voyait donc une ligne vide en double dans « Mon stock ».
-- Cas découvert le 22/09 sur la Brioche Gabriel : c'était même l'inverse, seule
-- la fiche vente était inscrite — les 30 brioches commandées par Veigné
-- n'apparaissaient nulle part. L'inscription a été déplacée sur la fiche
-- réassort le jour même ; il reste l'ancienne ligne, vidée à 0, à supprimer.
--
-- L'app ne peut pas faire ce ménage elle-même : depuis la sécurisation de
-- juillet (migration-securite-v1b), la clé publique n'a plus le droit DELETE
-- sur cette table. On ne le lui redonne PAS pour autant — l'app n'a aucun code
-- qui supprime ici, le mode chef se contente d'activer/désactiver.
--
-- SANS RISQUE : on ne supprime que des lignes à 0, dont le jumeau réassort est
-- déjà inscrit au congélo avec le stock réel. Aucun stock n'est perdu.
-- ============================================================================

-- ÉTAPE 1 — REGARDER AVANT DE SUPPRIMER.
-- Lance d'abord cette requête seule : elle affiche exactement ce qui partira,
-- avec le stock de la ligne (doit être 0 partout) et le nom du produit.
select ts.product_id, p.name, ts.stock, p.usage
from tourier_stock ts
join products p on p.id = ts.product_id
where ts.product_id in (
  'vv_bga',                          -- Brioche Gabriel
  'vv_pch',                          -- Pain au Chocolat
  'vv_cro',                          -- Croissant
  'vv_pra',                          -- Pain aux Raisins
  'vv_bfe',                          -- Brioche Feuilletée
  'vv_bfg',                          -- Brioche Feuilletée Garnie
  'psu',                             -- Pain Suisse
  'fl4',                             -- Flan 4 pers.
  'fl6',                             -- Flan 6 pers.
  'croissant_copie_xdnqbw',          -- Croissant amandes
  'nougat_de_tours_indiv_co_gwzp85'  -- Nougat de Tours Indiv.
)
order by p.name;

-- ÉTAPE 2 — SUPPRIMER.
-- Le « and ts.stock = 0 » est la sécurité : si quelqu'un a saisi du stock sur
-- une de ces lignes entre-temps, elle ne sera pas supprimée.
delete from tourier_stock ts
where ts.product_id in (
  'vv_bga', 'vv_pch', 'vv_cro', 'vv_pra', 'vv_bfe', 'vv_bfg',
  'psu', 'fl4', 'fl6', 'croissant_copie_xdnqbw', 'nougat_de_tours_indiv_co_gwzp85'
)
and ts.stock = 0;

-- ÉTAPE 3 — VÉRIFIER.
-- Doit renvoyer 44 (55 lignes avant, 11 supprimées).
select count(*) as lignes_congelo from tourier_stock;

-- Et vérifier qu'aucun produit du congélo n'a perdu son stock :
-- les 11 jumeaux réassort doivent toujours être là.
select ts.product_id, p.name, ts.stock
from tourier_stock ts
join products p on p.id = ts.product_id
where p.name in (
  'Brioche Gabriel', 'Pain au Chocolat', 'Croissant', 'Pain aux Raisins',
  'Brioche Feuilletée', 'Brioche Feuilletee', 'Brioche Feuilletée Garnie',
  'Brioche Feuilletee Garnie', 'Pain Suisse', 'Flan 4 pers.', 'Flan 6 pers.',
  'Croissant amandes', 'Nougat de Tours Indiv.'
)
order by p.name;
