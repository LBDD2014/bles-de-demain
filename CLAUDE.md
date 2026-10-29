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

1. **Évolution BackOffice : unités de conditionnement** (sac/caisse/seau/carton/pièce/kg/L + qté 1-200). Périmètre exact à finaliser.
2. **v21 — module Pros** : MVP v21.0 complet en prod (2026-05-19). Paliers suivants v21.1 (génération auto récurrent), v21.2 (magic link client pro), v21.3 (facturation Menlog).
