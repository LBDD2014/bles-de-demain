# LBDD — Les Blés de Demain

Contexte projet pour Claude Code. À lire en premier à chaque session.

## Qui

Phil, propriétaire de Les Blés de Demain. Boulangerie artisanale multi-sites en France. Communication **en français, casual et pragmatique**. Utilisateurs finaux de l'app = boulangers, vendeurs, livreurs **non-techniques**. (Noé, ancien apprenti BTS GPME, a quitté l'entreprise le 29/10/2026.)

## Sites

- **Le Local** : atelier central de production, hub principal
- **Veigné** : boutique autonome (pains + pâtisserie sur place)
- **Tours** : boutique autonome (pains + sandwiches traiteur sur place)
- **St-Avertin** : boutique cold, livrée quotidiennement par Le Local
- **Marché Amboise** (vendredi matin) + **Marché Beaujardin** (samedi matin)
- **Pros** (v21, pas encore codé) : restos, cafés, hôtels livrés par Le Local

## Coordonnées des boutiques (fiches contact de Phil, 29/10/2026)

| Site | Téléphone (ticket client) | Adresse |
|---|---|---|
| Tours | 02 47 64 14 51 (fixe) | 31 Place du Grand Marché, 37000 Tours |
| Veigné | 02 47 26 02 82 (fixe) ; portable 07 57 77 05 39 | 20 Place du Maréchal Leclerc, 37250 Veigné |
| Saint-Avertin | 09 80 99 96 52 | 17 Mail René Cassin, 37550 Saint-Avertin |
| Le Local | 07 50 05 22 96 (portable) | 1 bis rue Alexandre Darracq, 37320 Esvres-sur-Indre |
| Marchés Amboise / Beaujardin | numéro de Veigné | — |

Dans l'app : `SHOP_TELS_FIXES` (tickets), `SHOP_ADRESSES`, `SHOP_TELS` (portables, message d'accès pros).

## Stack

- **Frontend** : HTML/JS vanilla single-file (~6500 lignes, ~280 Ko)
- **Backend** : Supabase (PostgreSQL + RLS)
- **Realtime** : Supabase Realtime channels
- **Déploiement** : GitHub Pages
- **Pas de build tools**. Pas de webpack, pas de React.

## Fichiers clés

- `index-cloud-test.html` : fichier principal de l'app (tout est dedans)
- URL live : https://lbdd2014.github.io/bles-de-demain/index-cloud-test.html
- Supabase : https://utavpdhphdztvrmzyeeo.supabase.co

## Convention BDD critique

`product_id` est stocké en **TEXT** (ex : `vt_fou`, `vp_ord`), **pas en UUID**.
Toute nouvelle table doit utiliser `product_id TEXT`.

## Sécurité BDD (migration-securite-v1b, 2026-07-30)

- La clé publique n'a **plus le droit DELETE** sauf sur ~20 tables où l'app supprime
  réellement (liste dans `migration-securite-v1b.sql`). Les nouvelles tables n'ont
  **pas** DELETE par défaut : si une nouvelle fonctionnalité fait du `.delete()`,
  ajouter `GRANT DELETE ON public.ma_table TO anon;` dans sa migration.
- **Sauvegarde nocturne** (pg_cron, 1h30 UTC) : toutes les tables → `db_backups`
  (jsonb, rétention 10 jours). Table append-only : l'app peut lire, jamais modifier.
  Restauration = régénérer les lignes depuis `db_backups.data`.

## Connexion équipe (v20.289 — front EN LIGNE depuis le 25/10/2026 avec la v20.290, SQL pas encore lancé : mode doux)

Constat : app équipe et page client partagent la même clé publique, les règles de base disent
« tout le monde peut tout ». Le code boutique et le PIN sont des barrières d'écran. Réponse validée
par Phil : **le code boutique devient la clé**, sans rien distribuer de nouveau.

- **Comptes** : un compte Supabase Auth par ligne de `boutique_codes` (`<boutique>@lbdd.app`,
  mot de passe = le code), créés et tenus à jour par un trigger (`migration-v20.289-auth-equipe.sql`).
  Compte `backoffice` = le PIN. `master` = code maître. Nouveau code possible : `marche` (marchés).
- **App** : taper le code = `signInWithPassword`. Le code est mémorisé sur l'appareil (`boutiqueCode`)
  pour rouvrir la session sans rien demander (rechargement, session expirée, lock day). Mode « doux »
  tant que le verrou n'est pas posé : un code juste sans compte créé laisse entrer comme avant.
  `authStrict` = la base a répondu « permission denied » à la clé publique → le code est toujours demandé
  (marchés compris) ; l'accueil reste affiché. fabrication.html ouvre la même session (même navigateur).
- **Page client pro.html** : plus aucune lecture/écriture directe des tables, uniquement les fonctions
  `pro_page_*` (SECURITY DEFINER) qui ne répondent qu'au lien présenté ; le lien secret ne sort jamais.
- **État au 25/10** : le front est en ligne (fusion de la branche pour la v20.290), mais
  `migration-v20.289-auth-equipe.sql` n'a pas été lancé : l'app tourne en mode doux, rien ne change pour l'équipe.
  ⚠️ pro.html passe déjà par les fonctions `pro_page_*` : elles existent en base (sinon la page client
  afficherait « Connexion impossible ») — vérifier au moindre doute avec `select proname from pg_proc where proname like 'pro_page%'`.
- **Bascule en 3 temps** : (1) `migration-v20.289-auth-equipe.sql` (sans risque, comptes + droits
  authenticated + fonctions) ; (2) mise en ligne du front, chaque appareil retape son code une fois ;
  (3) le jour choisi, `migration-v20.289b-verrou.sql` (clé publique révoquée). Retour arrière :
  `migration-v20.289c-deverrou.sql`. Avant (3) : un code réglé pour CHAQUE site utilisé, marchés compris.
- Tests : `tests/specs/43-connexion-equipe.spec.mjs` ; le faux Supabase simule auth, les fonctions
  `pro_page_*` et le verrou (`preparePage(ctx, { strict: true })`).

## Convention "supply" par produit × boutique

Chaque produit a une origine par boutique destinataire :
- `on_site` : produit sur place
- `local` : livré par Le Local
- `veigne` : livré par Veigné
- `none` : pas disponible

Exemples :
- Pain Tradition : Veigné=`on_site`, Tours=`on_site`, St-Av=`local`
- Croissant (frozen) : partout=`local`

## RÈGLES DE TRAVAIL OBLIGATOIRES

**Avant d'écrire DU CODE, toujours :**
1. **Reformuler** la demande pour vérifier la compréhension
2. **Lister les questions ouvertes** (ne jamais supposer)
3. **Proposer 2-3 approches** avec pros/cons/effort
4. **Attendre validation EXPLICITE** avant de coder

**Autres règles :**
- SQL séparé du front-end (jamais mélangés dans le même fichier)
- Mobile-first (cible iPad/tablette en boutique)
- Convention `product_id TEXT` pour toute nouvelle table
- Toute règle métier émergente doit être consignée
- Réponses pragmatiques : pas de théorie inutile, solutions concrètes
- Éviter le jargon technique côté communication équipe

## Charte graphique (CSS variables actuelles)

```css
--gold: #CEAB52;       --gold-light: #E8D5A3;    --gold-dark: #8B6914;
--grey: #474950;       --grey-dark: #2E3044;     --grey-light: #5A5C66;
--cream: #FAF6EE;      --brown: #3D2B1F;         --brown-mid: #6B4226;
--green: #4A7C59;      --red: #B83232;           --orange: #D4701A;
--blue: #2C5F8A;       --white: #FFFFFF;
```

Typo : Playfair Display + Georgia.
Logo : `logo-splash.png.png` (fond noir, accent or sur "é").

## Architecture fonctionnelle v20.1

### Modules par site

- **Veigné** (10 onglets) : Reap. / Prev.Pain / Prev.Pat / Traiteur / Ventes / Special / Prod. / Recap / Livr. / Msg
- **Tours** (7 onglets) : Reap. / Prev.Pain / Prev.Pat / Traiteur / Ventes / Special / Recap
- **St-Avertin** (6 onglets) : Reap.Pain / Reap.Vienn / Prev.Trait / Ventes / Special / Recap
- **Le Local** (5 onglets) : Prod.Reap / Prod.St-Av / Stock / Special / Msg
- **Livreur** (2 onglets) : Tournee / Messages
- **Marchés** : Tableau marche
- **BackOffice** (PIN protégé) : Produits / Categ. / Valorisation

### Règles métier clés

**Prévis (prévision quotidienne)** :
- 3 onglets par boutique : Pain (pains+viennoiseries) / Pâtisserie (petits+gros gâteaux) / Traiteur (sandwiches)
- Toggle `a_previs` configuré par catégorie en BackOffice (pas hardcoded)
- Prévis quotidien = ce que la boutique produit/plaque pour le lendemain

**Réappro (réassort externe)** :
- Veigné : 2 sections (Surgelés-Brioches + Ingrédients)
- Tours : 3 sections (Pâtisserie Veigné + Surgelés Local + Ingrédients)
- St-Avertin : 2 onglets séparés (Reap.Pain + Reap.Vienn-Brioche)
- Bouton "Envoyer à X" par section
- ~~Valeurs persistantes semaine en semaine~~ → **v20.253 (23/09/2026)** : une commande
  **déjà envoyée** ne se recopie plus toute seule (envoyé = remis à zéro). Seul un brouillon
  jamais envoyé est reproposé à J+7. Reprise sur demande : ↩️ Comme la dernière fois /
  📅 Comme la semaine dernière (écrans St-Av + Cmd Veigné Pât. ; Tours : Hier / Semaine dernière)
- Priorité affichage : Tradition, Tradition Graines, Baguette Épeautre en tête

**Stock Local** :
- 4 colonnes : Stock théo + Stock réel + Écart + Seuil
- Théo = auto (dernier réel + receptions − sorties réappro)
- Réel = saisi à l'inventaire physique
- Bouton Réception pour livraisons entrantes
- Alerte rouge si réel <30% du seuil, orange 30-50%, vert sinon
- Écart en rouge si gap absolu >10%

**Dépannages de farine entre sites (v20.327, suite contrôle BV Tours 22/10/2026)** :
- C'est **celui qui reçoit** les sacs qui note le dépannage, au moment où il les range :
  Fabrication → Prod. du jour → 📥 « J'ai reçu des sacs d'un autre site » (sacs entiers + kg du sac entamé, au menu)
- Bandeau rouge sur Prod. du jour si une farine bio passe **sous zéro de plus de 10 kg** depuis le dernier
  comptage → il manque une entrée (dépannage ou bon de livraison)
- Même farine + même trajet + même jour déjà noté → l'app demande confirmation (évite le double comptage avec 🚚 Dispatch)

**Tournée livreur** :
- Réappros groupés par boutique
- Validation ligne par ligne OU "Tout valider [Boutique]" (PAS de bouton global)
- Si qty short : livreur saisit qty réellement livrée
- Auto-déduction Stock Local pour viennoiserie + brioches uniquement
- Colonnes : `livre_at`, `qty_livree`, `livre_by`

**Ventes** :
- Matin(J) = Prévis(J-1) − J1(J-1) + ajustements
- Pré-remplie mais éditable, conserve valeur d'origine pour tracking gap
- Bouton ✖ Ventes : désactivation globale via BackOffice

**Commandes spéciales** :
- Heure butoir J-2
- Saisies par boutique, traitées par destinataire (Local ou Veigné)
- **Tout ce qu'une vendeuse tape à la main doit être visible en production, en direct**
  (v20.277-279, 14/10/2026) : note par produit ✏️, note de commande ⭐, produit en texte libre 📝.
  Rendu partagé `specialNotesHtml()`. Écrans concernés : Prod. St-Av, bloc « Spéciales du jour »
  (ouvert tout seul s'il y a quelque chose à lire), colonne ⭐ Spé cliquable (détail client par
  client), vue Production de l'onglet Fêtes, bloc « Plaquettes & messages à écrire » à Veigné
  (une plaquette par note, notes par produit comprises, pour les gâteaux faits ailleurs).
  Rechargement en direct via Realtime, jamais pendant une saisie.
  **Mais chaque atelier ne voit que ce qui le concerne** (v20.281) : une note sur une ligne
  faite au Local n'ouvre rien et ne s'affiche pas à Veigné (et inversement) ; la note de
  commande vaut pour tous ceux qui fabriquent une ligne. Sinon Veigné « voit toutes les commandes ».
  Tout nouvel écran de production qui affiche des commandes doit afficher ces notes, filtrées ainsi.

**Pros — deux créneaux par jour (v20.290, 25/10/2026, cas Le Strapontin et Le Châteauneuf)** :
- Deux restos de Tours qui **viennent chercher** (`tournee: retrait`) et commandent **pour le matin ET pour
  l'après-midi** du même jour. Strapontin : Tradition seule ; Châteauneuf : Tradition + Grande Tourte de Meule.
  Création : `migration-v20.290b-strapontin-chateauneuf.sql` (produits retrouvés par leur nom, lien client généré).
- Modèle : `pro_orders.creneau` (`matin` par défaut / `apres_midi`) ; fiche `pros.creneau_aprem`
  (`null` = un seul créneau, sinon `{ actif, butoir_decalage (0 = jour même), butoir_heure, livraison }`).
  L'après-midi **reprend les jours cochés** du matin avec sa propre heure limite (défaut : jour même 11h,
  retrait vers 15h). Réglable dans la fiche BackOffice et dans « ⏰ Horaires des pros » (bloc partagé).
- Une commande par créneau et par jour, **indépendantes** (modifier/annuler l'une ne touche pas l'autre) ;
  les morceaux par site d'une commande sont ceux du même créneau. Helpers `proCreneauCfg`, `proDeuxCreneaux`,
  `proCreneauBadge` (app) / `creneauCfg`, `deuxCreneaux` (pro.html).
- pro.html : boutons Matin / Après-midi sous les jours, « la dernière fois » lue par créneau, un jour passe
  « déjà commandé » seulement quand plus aucun créneau n'est libre. **Un pro à un seul créneau ne voit rien de nouveau.**
- Écrans équipe : badge 🌅/🌇 sur les cartes (onglet Pros, à anticiper, récap semaine), matin avant après-midi ;
  production : une ligne par pro **et** par créneau dans le détail d'un produit ; grille semaine : ligne 🌇 à part.
- Tests : `tests/specs/44-pros-deux-creneaux.spec.mjs`.
- **v20.291 (25/10)** : dans la carte d'une commande, **changer le pro, la date ou le créneau déplace la commande**
  (les morceaux d'origine sont réécrits, `origProId` / `origDate` / `origCreneau` dans `saveProOrderSplit`) ;
  avant, ça créait un doublon sous le nouveau pro en laissant l'ancien (commande du QG de Loulou tapée sur « la folie »).

**Pros — prix visibles seulement en BackOffice (v20.292, 26/10/2026)** : `prixVisibles()` =
`currentBoutique === 'backoffice'`. Onglet Pros des boutiques (cartes + formulaire), tournée livreur et
ancien espace pro intégré n'affichent que les quantités ; `prix_applique` reste enregistré sur chaque ligne
pour les récaps / la facturation du BackOffice (fiche prix spéciaux, Récap, Semaine inchangés). Tout nouvel
écran équipe qui montre une commande pro doit passer par `prixVisibles()`. Test : spec 45.

**Pros — « 💶 Mise en compte » (v20.293, 26/10/2026)** : « c'est notre façon à nous de dire que c'est entré
dans la caisse ». Colonnes `pro_orders.mise_en_compte_at / _by` (`migration-v20.293-mise-en-compte.sql`). Bouton sur
chaque carte de l'onglet Pros (un tap = heure + boutique, un second = annulé ; rien sur annulée / brouillon).
Chaque boutique compte **les commandes qu'elle prépare** (`boutique_source`), Le Local compris, St-Avertin non.
Bandeau « oublis à rattraper » : ligne « 💶 Commandes pros pas mises en compte » avec les noms des pros, jours
passés + **aujourd'hui à partir de 17h** (`OUBLIS_PROCOMPTE_HEURE`) **ou dès que les ventes du jour sont validées** ;
rappel (toast) à la validation des ventes (`rappelProsEnCompte`). BackOffice → Oublis : ligne par site. Test : spec 46.
**v20.294 — Livreur** : « au Local c'est lui qui met en compte ». Bouton 💶 sur ses cartes de tournée (toutes les
commandes qu'il livre, Local et Veigné), `mise_en_compte_by = 'livreur'`. **Pop-up** (`livreurProsEnComptePopup`,
liste + bouton 💶 par commande + « Plus tard ») : à la **dernière livraison pro cochée** du jour, et à l'ouverture de la
Tournée **à partir de 17h**, une fois par jour. Le Local garde sa ligne dans le bandeau. Test : spec 47.

**Pros — « 📦 Les pros commandent par colis » (v20.340, 05/11/2026, cas Terre y Fruits)** : la fiche « Nougat de Tours Indiv. » est en
caisse de 60 pour le congélo tourier (v20.335) et, depuis la v20.275, un conditionnement sur la fiche s'imposait AUSSI aux pros (compteur pro.html
en colis) → Terre y Fruits tapait 10 et la commande enregistrait 600 (1500 le 28/10 ; Prod. Touriers a retiré 10 caisses du congélo le 05/11).
Désormais `products.pros_colis` (case « Pros » sur la fiche, BackOffice → Produits, édition et création) : **cochée = les pros commandent par
colis** (`proPackOf` / `packOf` de pro.html), décochée = pièces même si la fiche a un conditionnement. Cochée d'office par la migration
`migration-v20.340-pros-colis.sql` pour les 6 produits du Relais d'Amboise seulement (Phil, 09/11 : les Minis restent à la pièce pour les pros ;
règle générale : les pros des touriers commandent à la pièce, sauf ceux qui prennent du surgelé en caisse/sac). Données corrigées le 05/11 (600 → 10,
1500 → 25, stock nti −5 → 4,83, `production_done` 05/11 remis à 10 / 0,17 caisse ; sauvegarde `data-backups/2026-11-05-nougat-terre-y-fruit-avant.json`).
Test : spec 38. Tout nouvel écran pro qui compte des colis passe par `proPackOf` / `packOf`, jamais par `conditioning_qty` directement.

**Marchés — produits du stand (v20.341, 09/11/2026)** : Phil : « une coche pour choisir quel produit figure dans les marchés d'Amboise et
Beaujardin ». `products.marches text[]` (`migration-v20.341-marches-produits.sql` : liste de départ = les produits saisis sur un marché depuis le
01/10, posés sur les DEUX marchés). Tableau marché : seuls les produits cochés pour le marché affiché (`marketProduitChoisi`) **+ tout produit qui a un
chiffre ce jour-là** (`marketRowActive`) ; aucun produit coché pour un marché = tous les produits comme avant. « ⚙️ Choisir les produits » (barre du
filtre, **code maître** via `askCodeModal`) = une case par produit, enregistrée à chaque tap (`marketChoixToggle`), liste à part par marché. Mêmes
cases « Marchés » sur la fiche produit en BackOffice (édition + création). Test : spec 58.

**Pros — « 🚑 Dépannage » (v20.342, 09/11/2026, cas Dakota Chambray)** : Phil : « passer une commande une fois la date échue pour dire que nous
avons livré » (appel le samedi matin pour 100 burgers oubliés, faits et livrés, rien dans l'app). BackOffice → Pros → bouton rouge
**🚑 Dépannage** (`openProDepannage`, `adminProsView = 'depannage'`) = le formulaire habituel (`renderProOrderForm`), date du jour par défaut,
passée possible. À l'enregistrement : **statut `livre` d'office**, `created_by = 'depannage:backoffice'` → badge rouge « 🚑 dépannage » partout où
`proCreneauBadge` s'affiche (cartes Pros, grille semaine, récaps, tournée), note préfixée « 🚑 Dépannage. », **stock sorti comme à la livraison
cochée** (`proDepannageStock` : `proStockSortieCommande` pour le Boul. Pro + congélo tourier pièces ÷ pièces par caisse, règle ❄️). La mise en
compte reste à faire. **Si le pro a déjà une commande ce jour-là (même créneau), elle s'ouvre en modification** (`proDepannageCheckExisting`,
bandeau « Rajout ») : une « Nouvelle commande » écraserait l'existante (`saveProOrderSplit` réécrit les morceaux du jour) ; seules les lignes
ajoutées sortent du stock, note « 🚑 rajout dépannage ». `renderProOrders` en BackOffice ne rend que ce formulaire puis revient à la liste des pros.
Pas de SQL. Test : spec 59. `migration-v20.293-mise-en-compte.sql` n'avait jamais été lancée (constaté le 09/11, bouton 💶 muet depuis le 26/10) → **lancée le 09/11/2026**.

**Pièces par client — par produit (v20.343, 09/11/2026)** : Phil : « trier par sorte : Dakota, nombre de burgers / mois, de hot dogs / mois ».
Dans « 📊 Pièces par client » (onglet Pros de chaque site) : **un client déplié montre d'abord ses produits du mois** (une ligne par produit,
semaines + mois, `prodRows`), puis ses livraisons ; la ligne « ↳ Total Dakota » se déplie aussi (`proRecapOpenClients['groupe:dakota']`).
Boutons **Par client / Par produit** (`proRecapVue`) : la vue produits = une ligne par produit tous clients confondus, un produit déplié = qui en a
pris. Même filtre de site, mêmes exclusions (brouillons, annulées), CSV inchangé. Le Récap du BackOffice (par pro, en €) ne change pas. Test : spec 37.

**BackOffice → « Pièces » — pièces par boutique (v20.344, 09/11/2026)** : Phil : « les besoins des boutiques, ventilés par site et produits,
suivant les réassorts et les ventes », « je veux voir ça moi mais pas accessible à tout le monde » → onglet BackOffice (PIN) `pieces_boutiques`.
Un mois (◀ ▶) : par boutique (Veigné, Tours, St-Avertin) puis par produit, ou **Par produit** puis par boutique. Colonnes **Commandé** (réassorts
`sent_at` non nul, `commander` × pièces du contenant de la fiche, règle v20.337 : pas si la fiche est déjà dans cette unité ; grilles pâtissières via
`veigne_pat_stock.unit_pieces`), **Livré** (`qty_livree`, sinon commandé si `livre_at`), **Vendu** et **Perte** (`sales`, **journées validées
seulement**, Vendu = Matin + Après-midi − restes − perte comme l'onglet Récap, **Matin vide → prévis du jour** sauf catégories « sortie du jour » ;
journées non validées comptées et signalées en orange), % perte. Raccord par nom avec œ → oe (« Cœur Caramel » ↔ « Coeur Caramel »). Constat sur octobre
(09/11) : Veigné 25 j et Tours 21 j non validés → vendu très partiel ; les réassorts Chaussons / Minis d'avant le 15/10 étaient en pièces → gonflés ×80 / ×50.
**Raccord** réassort ↔ vente : `pbVenteKey` = la fiche `ventes`/`both` de même nom (comme `tourierStockPidFor`). Ingrédients et consommables exclus,
marchés pas encore. Lecture paginée (`oublisFetchAll`, > 1000 lignes). CSV Boutique;Catégorie;Produit;Commandé;Livré;Vendu;Perte. Test : spec 60.

**Fabrication — Bilan bio, feuille BV tous sites (v20.295, 27/10/2026, jour du contrôle Bureau Veritas)** :
bouton « 🖨️ Feuille BV tous sites » (code maître seulement) = un document : tableau consolidé entreprise farine par
farine (les envois entre sites s'annulent : Entrées = bons seulement, Sorties = production + pertes, Compté = somme
des comptages, sites sans comptage signalés), puis une page par site (tableau + bons à pointer + envois), signatures
une fois. `bilExportToutHtml` réutilise `bilComputeRows` et `bilExportHtml(site, d1, d2, sansSignature)`. Test : spec 33.
Vue globale des bons = Livraisons → « Registre des lots » avec Site = Tous les sites + période → PDF.
**v20.296** : les champs photo (bon, facture, perte, planning) n'imposent plus l'appareil photo (`capture` retiré) :
sur iPad on choisit photo / photothèque / fichier ; **PDF accepté** pour bon, facture et perte (ouvert en lien 📷 / 🧾) ;
la lecture automatique (IA) reste réservée aux photos. **v20.297** : une pièce jointe refusée par le stockage ne bloque
plus la saisie (confirmation « enregistrer sans la pièce jointe ») ; `migration-v20.297-storage-bons-bio-pdf.sql` ajoute
les règles Storage pour les PDF dans `bons-bio` (la règle d'origine, créée dans le tableau de bord, n'accepte que les images). Requête de diagnostic `sql/17_bilan_ce_qui_manque_par_site.sql`
(lecture seule) : même calcul que le Bilan, à aujourd'hui, une ligne par farine × site. Chez le GAEC des Mimosas,
« farine de blé type bise » = **Blés de pop** (`ing_bp`), pas le T80 Bio Bise.
**v20.298 — « 🌾 Conso farine bio »** (carte sous le Bilan) : par site, **par mois ou par semaine** (du lundi), une
colonne par farine bio + total ; seulement les **produits bio** (`fab_produits.bio`) et les farines bio, production
validée, farine des levains comprise ; période = celle du Bilan ; impression A4. `consoCompute` lit `bilProd`
(qui charge désormais `produit_id`). Équivalent SQL : `sql/18_conso_farine_bio_par_site.sql`. Test : spec 33.
**v20.299** : colonne **« Fleurage / pesées »** = sorties validées de farine bio (`fab_sorties`), c'est-à-dire le
fleurage posé à la validation de la journée (`FLEURAGE_PCT` = 5 % du total farine du jour, pains bio et non bio,
imputé sur Tradition Bio) + les pesées à la main. Le tableau colle ainsi au Bilan (qui comptait déjà ces sorties).

**Commandes pros — site fermé ce jour-là** (v20.282 → v20.286, 20-21/10/2026, cas Steff le boulanger) :
- Le site qui fabrique vient de la fiche pro (principale / sources par catégorie), **puis** on vérifie
  les jours de fermeture du Planning (`fab_jours_off`, 0=lundi…6=dimanche). Site fermé → **boutique
  de secours** de la fiche. Sans réglage (Phil, 21/10) : **Le Local → Veigné** ; **Tours → pas de
  secours, commande refusée** avec un message clair (le jour est grisé « fermé » sur pro.html) ;
  **Veigné ouvert 7/7**. Même règle dans l'app (`proSourceEffective`, null = refusé) et dans `pro.html`
  (`sourceEffective`) ; la génération auto passe par le même chemin.
- Formulaire équipe (onglet Pros) : une boutique **changée à la main** = dépannage, elle vaut pour
  toute la commande et gagne sur la fiche (cassé entre v20.257 et v20.281). L'équipe voit un message
  « Le Local fermé ce lundi → commande envoyée à Veigné ».

**Pros — fiches et liens** (v20.283-286, 21/10/2026) :
- Liste des pros (BackOffice) et « 📱 Liens pros » : **une colonne par boutique qui fabrique**
  (Le Local / Veigné / Tours ; St-Avertin seulement si un pro l'a en principale), en-tête avec la règle
  de fermeture/secours, **boutique de secours à droite du nom** (« Veigné (par défaut) » pour le Local
  sans réglage, « — » sinon), un tap ouvre la fiche.
- **Catalogue restreint** : `null` = tout autorisé, **`[]` = rien** (avant v20.286, `[]` valait « tout »).
  Une **nouvelle fiche démarre à `[]`** (rien de coché), message rouge « 0 produit autorisé », confirmation
  à l'enregistrement. Migration `migration-v20.286-catalogue-vide.sql` : les fiches existantes à `[]`
  repassent à `null`.
- **Jours de livraison** : ligne « Tous les jours cochés » (v20.287) = un réglage posé sur les jours cochés,
  cases vides seulement (case « remplacer » pour écraser). **« ⏰ Horaires des pros »** (v20.288) dans l'onglet
  Pros de chaque site : les pros dont ce site est la boutique principale, bouton ⏰ Régler → fenêtre avec les
  jours seuls (bloc partagé `proJoursBlockHtml`), enregistrée sans passer par le BackOffice.
- Envoi de l'accès : « 📤 Image + message » = image QR + message dans la feuille de partage (iPhone/iPad :
  WhatsApp met le texte en légende) ; partage abouti = « envoyé le … ». « 📋 Copier » ne marque « envoyé »
  qu'après confirmation. Message signé Philippe, 4 boutiques (portables) en fin, la sienne en premier.
- **Case « envoyé » à la main** (v20.300, 29/10/2026) : dans « 📱 Liens pros », chaque ligne a une case à cocher
  devant le repère. Coche = `magic_sent_at` à maintenant (lien envoyé autrement : SMS, mail, de vive voix), décoche =
  `null` (repère retiré). Ne crée ni ne touche le lien lui-même. Un seul point d'écriture : `proLinksSetSent(pro, iso)`. **v20.301** : la même case dans la
  fiche du pro (section Magic link, avec ou sans lien, pas sur une nouvelle fiche) ; le réglage met à jour les deux écrans.
- **pro.html — « la dernière fois » et « 📑 Refaire »** (v20.302, 29/10/2026, photo d'un nouveau pro « tout à 0 ») :
  le pré-remplissage reprend la commande **la plus proche avant le jour choisi, même pas encore livrée** (même créneau) ;
  sans commande avant ce jour : la plus récente, sinon la commande de base de la fiche, sinon 0 avec l'étiquette
  « première commande : rien à pré-remplir ». Bouton **📑** sur chaque ligne (à venir + livrées) et « 📑 Refaire cette
  commande pour <jour> » dans le détail : ouvre le **prochain jour libre** (`nextFreeDate`, même créneau si possible) avec
  les quantités de cette commande (produits sortis du catalogue ignorés) ; dans un groupe, seul l'établissement de la
  commande est rempli. Pas de bouton quand aucun jour n'est libre. Tests : specs 36 et 44.
- **App équipe — « 📑 Dupliquer »** (v20.303, 29/10/2026) : bouton sur chaque carte de l'onglet Pros (`proOrderDuplicate`) →
  formulaire « Nouvelle commande » déjà rempli (pro, lignes, prix appliqués, créneau ; note pas recopiée), date = **prochain
  jour coché de la fiche sans commande du même créneau** (`proNextFreeDate`, 3 semaines ; à défaut prochain jour coché, à
  défaut demain), modifiable avant « Créer ». Boutique non forcée (la fiche décide). Brouillon partagé `proOrderDraftFrom(o)`.
  **v20.304** : le même bouton dans le détail d'une commande (formulaire de modification, bloc « 📑 Refaire cette commande »,
  à partir de la commande enregistrée). Test : spec 48.

**Fêtes + Spéciales = une seule commande (v20.328, EN LIGNE le 31/10/2026, migration `migration-v20.328-fetes-dans-speciales.sql` lancée)** :
Phil (29/10) : « si les clients veulent du pain et des bûches, on fait comment ? ». Maquette `fetes-speciales-mockup.html`.
- **Pendant une fête active, l'onglet Special est grisé** (barré, `bnav-ghost`) et un appui renvoie vers l'onglet de la fête
  (`feteRemplaceSpecial`), qui affiche **le même écran** (semaine, + Nouvelle commande, récap du jour, prénoms, 🔁…) avec le bandeau de
  la fête ; Veigné et Le Local ont en plus « 🍰 Production ». Le lendemain de la fête, Special revient tout seul avec toutes les commandes.
- **Formulaire** : la **carte de la fête** en tête (prix fixes, + / −, 🔪 sur les pains, 🔍 dans la carte, produits en pause masqués),
  puis « ⭐ Hors carte » (gâteau d'anniversaire… sans prix), puis le **Total**. Une commande = un numéro, un ticket, un total, un acompte.
  Pendant la fête, le menu des dates va jusqu'au dernier jour de retrait. Butoir de la fête passé = carte close (commandes hors carte toujours possibles).
- **Base** : tout dans `special_orders` / `special_order_items`. Ligne de la carte = `fete_product_id` + `unit_price` (**prix figé** :
  une commande prise garde son prix si le tarif change) + `product_name_custom` (nom de carte) + `product_id` si le produit de la carte est
  **relié à sa fiche** (`fete_products.product_id` : pains et viennoiseries → production habituelle, ⭐ SPÉ, règle de chaque boutique)
  sinon `prod_site` (bûches, douceurs, salé → Veigné). Commande : `total`, `event_id`, `canal` (`boutique`). Les anciennes `fete_orders`
  restent lues (vue Production, tickets) ; plus rien ne s'y écrit.
- **Vue 🍰 Production de la fête** : anciennes fete_orders + lignes de la carte **sans fiche** (`feteProdCommandes`). Les lignes reliées
  sont dans la production habituelle, pas ici.
- **Tickets** : bandeau de la fête, prix par ligne et total / acompte / reste sur le ticket client (et l'A4) ; ticket retrait sans prix.
- **BackOffice → Fêtes → 💶 Tarifs et noms** (Phil : « facile de changer les tarifs », pareil pour les noms des bûches) : grille nom /
  taille / prix, enregistrée en quittant la case (`feteAdminSet`) ; « Tous les prix de [carte | groupe] + / − X % » avec aperçu jaune
  avant « Appliquer », arrondi aux 5 centimes. ✎ = groupe et atelier.
- **Prêt pour une boutique en ligne** (Phil, 31/10 : « pas encore, mais fais comme si ») : `canal`, prix et total enregistrés, lignes avec
  identifiants stables, un seul chemin de création (`upsertSpecialOrder`) à recopier un jour dans une fonction `SECURITY DEFINER` (comme `pro_page_*`).
  Pas encore : page web, paiement en ligne, délais bloquants, plafond par créneau.
- Carte de Noël en base (31/10) : 59 produits, prix 2025 (Excel feuille « Données »), 32 reliés à leur fiche par la migration ;
  `fete_events.noel` du **01/12/2026 au 01/01/2027**, `actif = false` → **à activer en BackOffice → Fêtes après la migration et la mise en ligne**.
- Tests : `tests/specs/51-fetes-dans-speciales.spec.mjs` (+ spec 41 adaptée).

**Prise de commande plus fluide (v20.329, 31/10/2026, maquette `prise-commande-mockup.html`, Phil : « Oui, les 5 »)** — même formulaire
pour Special et l'onglet de la fête :
1. **Barre fixe en bas** (`.sp-bar`, sticky au-dessus des onglets) : total (ou nombre d'articles) + « ✓ Créer » grisé tant qu'il n'y a aucun produit.
2. **Paiement sous le total** (on choisit l'acompte quand on connaît le montant), boutons **30 % / 50 %**, reste affiché ;
   téléphone et « 👤 Prise par » côte à côte.
3. **Carte de la fête repliée par groupe** : un appui ouvre ; un groupe avec un produit reste ouvert (« 2 pris ») ; la loupe ouvre ce qui correspond.
4. **Produits : plus de menus Catégorie → Produit → Quantité.** Une recherche (2 lettres) **ou** une catégorie (puces) liste les produits,
   un appui ajoute la ligne (ou +1), puis **− [quantité] +** (la liste 1-50 / « Autre… » au clavier reste au milieu, v20.200).
   « ✏️ Autre : « … » » = texte libre (avertissement v20.235 gardé). ✏️ note par produit et 🔪 (pains) sur la ligne. Commande vide au départ.
   Fonctions : `specialPickerHtml`, `specialSearchPick(pid)`, `specialPickCat`, `specialAddLibre`, `specialItemQtyStep`.
5. **« € prix » à la main sur un produit hors carte** (Phil) : prix **à la pièce**, pour cette commande seulement, toute vendeuse ;
   `special_order_items.unit_price` → total de la commande (`special_orders.total`, carte + prix tapés), acompte, ticket client et A4
   (« + produits sans prix, en caisse » s'il en reste). Badge « 💶 total » sur la carte d'une commande hors fête.
Tests : spec 52 (+ specs 11, 12, 13, 30 adaptées au nouveau choix des produits).
**v20.332** (maquette `speciales-favoris-mockup.html`, Phil : « Oui, code les deux ») : **⭐ Les plus commandés ici** = 8 grosses
touches en tête des produits, calculées toutes seules sur les commandes de la boutique des 60 derniers jours (nombre de lignes, sans
surgelé ni annulées ; `loadSpecialFavoris`, cache 30 min, chargées en arrière-plan sans re-rendre le formulaire) ; un appui = +1.
**📑 Refaire sa dernière commande** : client choisi dans les suggestions → bandeau bleu avec sa dernière commande non annulée
(`specialClientsIndex[].lastId`) → un appui recopie produits, quantités, 🔪, notes produit, prix tapés, carte de la fête au tarif du
jour ; **pas** la note de commande, ni date / heure / paiement. Nouvelles commandes seulement. Test : spec 53.
**v20.331** (Phil, 31/10 : « le surgelé, ça pollue la vision de la vente ; ne les supprime pas, mets-les dans un onglet pros ») :
dans le choix des produits des commandes clients, tout produit dont le nom contient **« surgelé »** sort des catégories et de la
recherche et se range dans la catégorie **« 🧊 Pros (surgelé) »**, toujours en dernier (`specialEstPro`, `SPE_CAT_PROS`). Rien n'est
supprimé ; une catégorie qui ne contient que du surgelé n'a plus de puce. Les commandes des pros (onglet Pros, pro.html) ne changent pas.
**v20.330** : l'avertissement d'un produit tapé à la main nomme le **vrai atelier** (atelier principal de la commande, ex. St-Avertin + bûches → Veigné) au lieu de toujours « restera à <boutique> ».

**Écrans de production (v20.333, 31/10/2026, après le tour des écrans sur les vraies données)** :
- **Colonnes de la grille** (les boulangers du Local : « masquer certaines colonnes ») : une colonne **vide toute la journée et sans case
  à remplir** se cache toute seule ; **« ⚙️ Colonnes »** (barre au-dessus de la grille) = chaque tablette cache ce qu'elle veut, par écran
  (`localStorage lbdd_prod_cols_<site>_<vue>`) ; Produit, Total et ✓ jamais. **Garde-fou** : une colonne cachée à la main qui porte un
  chiffre l'affiche sous le total (« 👁 💼 Pros 260 »). Appliqué après l'affichage (`prodColonnesAppliquer`), le calcul ne change pas.
- **Plaquettes à Veigné** : seulement les **gâteaux** (pâtisserie, texte libre, carte de fête sans fiche ; `plaquetteLigne`). Le 31/10 le
  bloc annonçait 5 « plaquettes » qui étaient des consignes de cuisson de pains de Tours (« Bien blanches », « Pas trop cuit »).
- **v20.334 — tiroirs** (maquette `production-veigne-mockup.html`, Phil : 1 ok, 2 ok, 4 oui) : sur tous les écrans de production
  (Veigné, Tours, Boulangers, Touriers), **plus de fenêtre** « X commandes spéciales à produire » à l'ouverture (le bandeau suffit) ;
  ⭐ Spéciales du jour, ✏️ Plaquettes, 🍕 Ardoise focaccia et **🎄 <fête> à produire** deviennent des **tiroirs** (`productionTiroir`,
  `toggleProductionTiroir`, un seul ouvert) ; **plus d'ouverture automatique** des Spéciales (règle v20.277 remplacée) : un tiroir fermé
  qui a quelque chose à lire est bordé de rouge avec la pastille « ✏️ N à lire » ; « Reporter les stocks d'hier » en bas de l'écran.
  Tiroir fête (`feteTiroirHtml`) : produits de la carte **sans fiche** du jour affiché pour ce site (Veigné ; Boulangers du Local), un appui
  sur un total = détail client. Résultat mesuré à Veigné (31/10) : la grille commence à ~660 px au lieu de ~3 000.
- **Coche ✓ « fait »** gardée partout (Phil, 31/10 : « je vais leur demander de s'y mettre, mais c'est juste pour les aider, pas de mal
  s'ils ne le font pas »). Utilisée 29 j/31 au Local, 4 j à Veigné, 1 j à Tours en octobre.
- **Tradition Graines : une seule fiche (01/11/2026, données seulement)** : Phil : « c'est bien des Tradition Graines cuites du matin,
  sauf s'il y a écrit précuite surgelée ». L'ancienne fiche réassort `bp_trg` « Tradition graines » est **désactivée** ; les 7 fiches pros
  qui l'avaient (Dakota ×2, Boui Boui, Bon d'Ici, Kami, QG de Loulou, philippe) et ses 8 lignes de commandes pointent `vp_trg`.
  Prod. Boulangers du Local : une ligne, la part pros dans 💼 Pros (détail par pro d'un appui). `tradition_graines_precuite` (surgelée) inchangée.
  Retour arrière : `data-backups/2026-11-01-tradition-graines-avant.json`.
  Tests : specs 54, 55 (+ specs 12 et 40 : plaquettes sur des tartes, tiroirs).

**Écrans Stock refaits — congélo (v20.335, 01/11/2026, maquette `stock-congelo-mockup.html`, migration `migration-v20.335-stocks-congelo.sql`)** :
Phil : « rentrer la prod du jour qui va au congélateur dans le stock et la décompter de la production du mois ou de la semaine ».
- **Même grille** pour Stock Tourier, Stock Pât. et Stock Boul. Pro (`sgGrilleHtml`) : Produit (nom, unité, état en clair coloré) |
  Stock (lecture seule) | **＋ mettre au congélo** (touches en caisses / sacs entiers, « … Autre ») | **Reste à faire** (barre, « fait / objectif »,
  « dont 🥐 X frais »). Semaine / Mois + résumé « N à produire · N ok · N trop d'avance ». Retirés : menus Entrée / Stock / Mini, « À partir », légende.
- ＋ = stock + production de la période (`stock_entries`), « +X aujourd'hui » sous le bouton, **↩️ Annuler** 6 s (`stockPadAdd`, `stockPadUndo`, `sgStockDelta`).
- **Reste à faire = « ma prévision »** (`products.conso_mois_manuel`) − production ; sans prévision : « — · pas d'objectif ».
  « Trop d'avance » seulement au-delà de la tenue au congélo **et** de la fin de période (avant, rien ne pouvait être vert en début de mois).
  **v20.336 — mode Semaine** (Phil, 01/11 : « ils n'ont pas besoin de tout produire cette semaine ») : à faire cette semaine =
  prévision ÷ 30,4 × **7 prochains jours** + **Mini** − stock (`sgBesoinSemaine`), sinon « ✓ rien d'urgent » ; le reste du mois est
  rappelé en petit (« 100 d'ici fin nov »). Pastille rouge « sous le Mini d'ici 7 jours » quand le stock tient mais passe sous le Mini.
  Avant : prévision coupée en 4, stock ignoré (« 🟢 tient » à côté de « 83 à faire »). Le mode Mois ne change pas.
  **v20.337 — Chouquette au congélo tourier** (Phil, 01/11) : une seule fiche `chouquette`, vendue et stockée en **grilles de 50**.
  Le décompte ❄️ de Prod. Touriers ne divise plus quand la ligne est déjà dans l'unité du congélo (`unit` de la fiche = unité du stock) :
  St-Av 3 grilles = −3 grilles (avant : −0,06). Chouquettes du Local = **St-Avertin seulement** ; Tours les reçoit toujours **de Veigné**
  (supply inchangé), Veigné les fait sur place.
  **v20.338 — stock reporté** (Phil, 01/11 : « s'il me reste du stock en fin de mois, tu le reportes d'office le mois suivant ») :
  reste à faire du mois = prévision − **stock au 1er** − mis au congélo depuis ; « 25 reportés d'oct. », « ✓ couvert par le stock ».
  Photo du stock des 3 écrans chaque 1er à minuit (Paris) par pg_cron : `snapshot_stock_mois()` → `stock_report_mois`
  (`migration-v20.338-stock-report-mois.sql`, jobs `lbdd-stock-report-mois` 22h05/23h05 UTC + rattrapage 0h10 UTC le 1er ;
  une photo prise n'est jamais remplacée). Stock négatif reporté comme 0. Novembre 2026 : photo prise le 01/11 par la migration.
- **📋 Compter le congélo** (tout le monde) : seule façon de changer le stock à la main ; écart gardé dans `stock_comptages` (prénom de la tablette).
- **Réglages sans code** : appui long sur le nom (0,55 s) ou ⚙️ → prévision du mois, pièces par caisse/sac (`products.conditioning_qty` ;
  Pât. : `veigne_pat_stock.unit_pieces`), Mini, tenue au congélo. ⚠️ les pièces par caisse valent partout (réassorts, pros) : averti en orange.
- **Prod. Touriers — ❄️ du congélo / 🥐 plaqué frais** (Phil : « pas de jour fixe, je coche croissant / pain au chocolat et je valide le reste en sortie du
  congélateur ») : bouton sous le nom de chaque ligne qui correspond à un produit du congélo tourier (même nom, fiche vente ≠ fiche réassort, `tourierStockPidFor`).
  ❄️ par défaut. Quand la ligne part (✓, partiel, Tout valider) : ❄️ → congélo − pièces ÷ pièces par caisse (**caisses à virgule**) ;
  🥐 → stock inchangé, compté en production (`stock_entries` screen `tourier_frais`). `production_done.congelo_mode / congelo_applique / congelo_qty` :
  décocher ou changer d'avis défait. Avant, St-Avertin ne faisait jamais baisser le congélo (sa viennoiserie passe par Prod. Touriers, pas par « À préparer »).
- **Boul. Pro : le stock baisse quand le livreur coche la livraison** (`proStockSortieCommande`, rejouable, remonte si décoché, pas deux fois avec un ancien
  « ✓ préparé ») ; bloc « 💼 Pros du jour » à la place de « À préparer », « ✓ parti » pour les retraits.
- **Stock Pât. : le stock baisse à l'envoi de la boutique** (`patDecompteEnvoi`) ; `reappros.stock_decompte_qty` = déjà retiré (renvoi = différence,
  « ✓ préparé » ne retire que le reste). Stock Tourier (Veigné / Tours) : toujours au « ✓ préparé » (coché 232 fois sur 235 en octobre).
- Test : spec 56.

**Tickets Brother QL-820NWB, numéro du jour, récap du jour (v20.305, 29/10/2026)** :
- **Numéro de commande du jour** : `special_orders.num_jour` / `fete_orders.num_jour`, donné à l'enregistrement, **par boutique de
  retrait (`origin_shop`) et par jour de retrait (`pickup_date`), spéciales et fêtes dans la même suite** (fonction SQL
  `next_order_num` + table `order_day_counters`, `migration-v20.305-tickets-numeros.sql`, **lancée le 29/10/2026**). Secours sans migration : max + 1.
  Changer le jour ou la boutique de retrait = nouveau numéro. Anciennes commandes : numéro à la 1re impression (`assignOrderNum`).
- **Étiquettes 62 mm** (rouleau continu DK-22205, noir) : `ticketLabelHtml(o, kind, 'client'|'sac')`, impression par `printLabels`
  (div `#print-label`, classe `printing-label`, `@page 62mm auto` injectée le temps de l'impression). Bouton 🖨 (formulaire spéciale,
  carte fête) → fenêtre `openTicketChoice` (v20.318) : « 🏷️ Étiquette sac » (en premier, une par sac) / « 🎫 Ticket client »
  (réimpression) / « 📄 Ticket A4 ». **Flux validé par Phil (29/10) : à la création d'une commande (spéciale ou fête), le ticket
  client sort d'office, seul ; le matin du retrait, les vendeurs sortent les étiquettes sac** (récap du jour : 🏷️ Sac par ligne,
  « Tous les tickets retrait »). `printOrderTickets(kind, id, false | 'sac' | true)`. **v20.320 : l'étiquette « sac » s'appelle
  « ticket retrait »** (Phil : « je veux le ticket du retrait avec le numéro de téléphone des gens »), code interne inchangé (`'sac'`).
  Retrait : n° du jour en gros, **téléphone client toujours** (« 📞 pas de numéro » sinon),
  **pas de pied de page** (v20.322 : plus de « RETRAIT · Préparé par »), réglé ou non sans montant (v20.312), pas de prix, pas de « fait à X » (retiré v20.313). Client : paiement (réglé / acompte + reste / à régler), téléphone
  de la boutique (`SHOP_TELS_FIXES`, v20.315 : Tours 02 47 64 14 51, Veigné 02 47 26 02 82 (v20.316), St-Av 09 80 99 96 52, Local 07 50 05 22 96 ;
  marchés = Veigné), adresse de la boutique sous le lieu de retrait (v20.317, Tours / Veigné / St-Av, Le Local depuis v20.324 ; pas les marchés ; `SHOP_ADRESSES`), pied « Merci de votre confiance, à très bientôt ! » (v20.321). Marchés : nom du marché en haut.
- **Interrupteur par tablette « 🖨 Brother branchée sur cette tablette »** (v20.325, `brotherBranchee()`, `localStorage lbdd_brother`,
  dans l'onglet Special sous « Récap du jour » et dans la barre de l'onglet Fêtes) : **éteint par défaut** → aucune impression
  automatique à la commande (les imprimantes arrivent en boutique quelques jours après le 29/10) ; allumé → le ticket client sort
  d'office à chaque commande. Les boutons 🖨 marchent dans les deux cas.
- **Rouge** (v20.326) : la QL-820NWB imprime noir + rouge avec le rouleau **DK-22251** (62 mm) ; les lignes « à trancher » sont en
  rouge souligné « — À TRANCHER » (`.lb-tranche`), noires sur le rouleau noir seul (DK-22205). Cocher « Couleur » dans la fenêtre d'impression.
- **Tablettes Logicom (Android)** : impression via la fenêtre de Chrome avec le **Brother Print Service Plugin** installé
  (Paramètres → Impression), Brother choisie comme imprimante, papier 62 mm continu.
  ⚠️ **Sur Android, `window.print()` rend la main tout de suite et l'aperçu se fabrique après** : le mode impression
  (`printing-label`, `_printModeStart`) reste posé jusqu'au premier geste sur la page ou 2 min (v20.310 : `afterprint` ignoré, Chrome Android l'envoie trop tôt) ;
  un retrait au bout de 0,3 s envoyait toute l'app à l'imprimante. **v20.319 : l'impression passe par un document à part
  (`_printDocument`, iframe invisible qui ne contient que les étiquettes + `TICKET_PRINT_CSS`)** ; `_printModeStart` n'est plus
  que le secours. La règle A4 `body::before` (« Les Blés de Demain - »)
  est neutralisée pendant l'impression des étiquettes (v20.308). `APP_VERSION` doit être bumpé à chaque version (il était
  resté à v20.294, impossible de savoir ce que la tablette avait chargé).
- **🧺 Qui a préparé** (v20.322, `migration-v20.322-prepare-par.sql`, **lancée le 29/10/2026** : `special_orders` / `fete_orders.prepared_by, prepared_at`) :
  « Mis de côté ✓ » (récap du jour, carte spéciale, carte fête) enregistre **le prénom réglé sur la tablette** (`rememberedPerson()`,
  demandé une fois via `ticketDemandePreparateur` si rien n'est réglé et que la boutique a sa liste) et l'heure. Écriture tolérante
  `updateAvecPrepare` (sans la migration : statut seul + toast une fois). Affiché : badge 🧺 sur les cartes (`preparedBadge`), ligne
  faite du récap (« ✓ Mis de côté · 🧺 Zora 07h12 »), prénom sous le ✓ de la feuille A4. Rien sur les tickets.
  **↩️ Annuler** (v20.323, erreur de clic) : dans le récap la ligne qu'on vient de mettre de côté reste visible (`justDone`) avec
  « ↩️ Annuler » (aussi sous « Voir les faites »), et sur les cartes spéciale / fête quand le statut est « Mis de côté » → retour
  « À préparer », `prepared_by/at` effacés (`updateAvecPrepare(…, effacer)`, `recapAnnuleMisDeCote`).
- **Coupure matin / après-midi** : `ticket_reglages.coupure_aprem` par site, **défaut 14h00**, réglable en BackOffice → Codes
  (`coupureAprem(site)`, `ticketPeriode(o)`) ; sans heure de retrait = matin.
- **📋 Récap du jour** (`openRecapJour('special'|'fete')`, bouton sous « + Nouvelle commande » de l'onglet Special et dans la barre
  de l'onglet Fêtes) : date + site, tri par heure / par nom (civilité ignorée), Tout / Matin / Après-midi, loupe nom ou n° (filtre
  sans re-rendu), bouton « Mis de côté ✓ » qui **cache la ligne au fur et à mesure** (statut `prete`), « Voir les faites (n) »
  (prête + venu chercher), 🏷️ par ligne (client + sac), « 🏷️ Tous les sacs » (liste affichée, ordre des heures) et « 🖨 Feuille A4 ».
- Test : spec 49.

### Quantités par caisse (viennoiserie)

Croissant 77 / Pain choc 130 / Pain raisin 80 / Suisse 60 / Tartelettes 12 / Cannelé 170 / Chausson aux pommes 80 /
Croissant amandes 72 / Minis (croissant, pain choc, pain raisin) sac de 50 / Flan 6 pers. grille de 4 / Flan 4 pers. grille de 6.
(Chausson 80 validé par les prévis des semaines passées, 13/10/2026.) Source de vérité = fiche produit en BackOffice (`pces_per_caisse` + `conditioning_*`).
**v20.339 (05/11/2026) — le menu « caisse » des boutiques enregistre des CAISSES** : une fiche avec `pces_per_caisse` **et** un
contenant (`conditioning_unit` caisse / sac / grille / carton / seau) → « 1/2 caisse (40 pces) / 1 caisse (80 pces) » enregistre 0,5 / 1
dans `reappros.commander` (`reapproCmdEnCaisses`), comme le Croissant (menu 0-50) ; le « (N pces) » vient de `conditioning_qty`. Sans
contenant (crêpes) : pièces comme avant. Avant : « 1 caisse » de Suisse enregistrait 60 → le congélo tourier du Local (compté en caisses)
retirait 60 caisses au « ✓ préparé » (Suisse à −50, Chaussons à −38 le 05/11). Lignes du 15/10 → 06/11 converties en base (80→1, 40→0,5,
60→1, 50→1 ; sauvegarde `data-backups/2026-11-05-reappros-caisses-avant.json`), stocks remis (Suisse 8,43 ; Chaussons 1,35).
Règle : **tout ce qui entre au congélo tourier du Local se commande et se compte dans l'unité de la fiche** ; une vieille valeur en
pièces s'affiche « 60 caisses ⚠️ à vérifier ». **Matin des Ventes** (fiches vendues ET commandées, ex. Chaussons) : la commande de la veille
est multipliée par les pièces par caisse avant de pré-remplir (1 caisse → 80). Phil (05/11) : les menus tels qu'ils étaient lui plaisaient, pas de refonte. Test : spec 57. ⚠️ Fiche Cannelés `vv_can` : 170 par caisse d'un côté, caisse de 140 de l'autre, à trancher.

## Workflow déploiement

1. Modif faite dans Claude Code → diff revu → validé
2. Commit avec message clair (ex : "Fix v20.1.X — description")
3. Push origin main
4. Attendre 30s redéploiement GitHub Pages
5. Tester sur l'URL live avec `?v=N` pour bypass cache Safari
6. Cmd+Shift+R pour forcer rechargement sans cache

## Maintenir Supabase actif

Les projets gratuits Supabase sont mis en pause après **7 jours d'inactivité**.
Solution : se connecter au dashboard OU utiliser l'app au moins 1× / semaine.
Si pause survient : dashboard Supabase → "Resume project" (30s à 2min).

## Bugs / TODOs connus

0. **Fêtes + Spéciales (v20.328) EN LIGNE le 31/10/2026** (voir la section « Fêtes + Spéciales = une seule commande »).
   Reste à faire par Phil : activer Noël en BackOffice → Fêtes (dates déjà réglées 01/12 → 01/01). Prix 2025 à revoir par Phil dans la grille 💶 Tarifs et noms quand il veut.
   Autre point du 29/10 à garder en tête : imprimantes Brother posées en boutique « dans quelques jours » (interrupteur par tablette
   v20.325 éteint par défaut) ; rouleau noir/rouge DK-22251 à commander pour le rouge des lignes « À TRANCHER » (v20.326).

1. **Évolution BackOffice : unités de conditionnement** (sac/caisse/seau/carton/pièce/kg/L + qté 1-200). Périmètre exact à finaliser.
2. **v21 — module Pros** : MVP v21.0 complet en prod (2026-05-19). Paliers suivants v21.1 (génération auto récurrent), v21.2 (magic link client pro), v21.3 (facturation Menlog).
