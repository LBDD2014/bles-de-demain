-- v20.328 — L'onglet de la fête (Noël…) et les Spéciales ne font plus qu'un (Phil, 29-31/10/2026 :
-- « si les clients veulent du pain et des bûches, on fait comment ? »).
-- Une commande client peut mêler la carte de la fête (bûches, pains de Noël à prix fixe…) et le reste :
-- un seul numéro, un seul ticket, un seul total, un seul acompte. Tout va dans special_orders / special_order_items.
-- Pensé pour une future commande en ligne (Phil, 31/10) : canal de la commande, prix et total enregistrés sur la commande.
-- Sans risque : des colonnes ajoutées, rien de supprimé. Relançable. À lancer AVANT la mise en ligne du front.

-- 1) La commande : d'où elle vient, à quelle fête elle appartient, son total
alter table public.special_orders add column if not exists canal    text not null default 'boutique';   -- boutique | web (plus tard)
alter table public.special_orders add column if not exists event_id text;                                -- fete_events.id si la commande contient un produit de la carte
alter table public.special_orders add column if not exists total    numeric;                             -- total des lignes à prix, figé à l'enregistrement

-- 2) Les lignes : un produit de la carte garde son prix (unit_price existe déjà) et son atelier
alter table public.special_order_items add column if not exists fete_product_id bigint;   -- fete_products.id
alter table public.special_order_items add column if not exists prod_site       text;     -- atelier d'une ligne de la carte sans fiche produit (veigne | local)

-- 3) La carte : un produit de la carte peut être relié à sa fiche du catalogue.
--    Relié = il part en production comme une commande spéciale ordinaire (Tradition au Local pour St-Avertin,
--    sur place à Veigné et Tours, colonne ⭐ SPÉ…). Pas relié = il va à l'atelier indiqué (prod_site).
alter table public.fete_products add column if not exists product_id text;

create index if not exists special_orders_event_idx on public.special_orders (event_id) where event_id is not null;

-- 4) Liens de la carte de Noël vers le catalogue (validé par Phil le 31/10 : pains et viennoiseries = règle habituelle).
--    Restent NON reliés (atelier fixe) : petits pains de table, ciabatta comté noix, tranches de fruité, demi norvégien,
--    bûches, douceurs, pain d'épices, salé.
update public.fete_products f set product_id = m.pid
from (values
  ('Pain de mie carré', 'vp_mie'), ('Pain de mie rond', 'vp_mie'), ('Tourte de seigle', 'vp_sei'), ('Seigle citron', 'vp_sci'),
  ('Pain aux figues', 'vp_fig'), ('Pain aux noix', 'vp_noi'), ('Petit automne', 'vp_aut'), ('Pain à la châtaigne', 'vp_cha'),
  ('Baguette de tradition', 'vp_tra'), ('Baguette de tradition aux graines', 'vp_trg'), ('Baguette à l''épeautre', 'vp_epe'),
  ('Ciabatta', 'vp_cia'), ('Pain au maïs', 'vp_mai'), ('Petite tourte de meule', 'vp_tme'),
  ('Grande tourte de meule', 'tourte_de_meule_copie_ocxdc5'), ('Idéal', 'vp_ide'), ('Essentiel', 'vp_ess'),
  ('Intégral', 'integral_zc0rc2'), ('Khorazan', 'vp_kho'), ('Blés anciens', 'vp_bla'), ('Mathis', 'vp_mat'),
  ('Petit épeautre', 'vp_pep'),
  ('Croissant', 'vv_cro'), ('Pain au chocolat', 'vv_pch'), ('Brioche cannelle', 'vv_bca'), ('Brioche feuilletée', 'vv_bfe'),
  ('Brioche feuilletée garnie framboise', 'vv_bfg'), ('Brioche feuilletée garnie praliné', 'vv_bfg'),
  ('Brioche Gabriel nature', 'vv_bga'), ('Brioche Gabriel chocolat', 'vv_bga'), ('Brioche Grand-mère', 'bgm')
) as m(nom, pid)
where f.event_id = 'noel' and f.nom = m.nom and f.product_id is null;
-- Norvégien entier seulement (un demi n'est pas un norvégien en production)
update public.fete_products set product_id = 'vp_nor' where event_id = 'noel' and nom = 'Norvégien' and taille = 'entier' and product_id is null;

-- Vérifications :
--   select column_name from information_schema.columns where table_name = 'special_order_items' and column_name in ('fete_product_id','prod_site');
--   select nom, taille, prix, prod_site, product_id from public.fete_products where event_id = 'noel' order by ordre;   -- 32 reliés sur 59
