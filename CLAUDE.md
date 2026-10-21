# LBDD — Les Blés de Demain

Contexte projet pour Claude Code. À lire en premier à chaque session.

## Qui

Phil, propriétaire de Les Blés de Demain. Boulangerie artisanale multi-sites en France. Communication **en français, casual et pragmatique**. Utilisateurs finaux de l'app = boulangers, vendeurs, livreurs **non-techniques**. Apprenti : Noé (BTS GPME).

## Sites

- **Le Local** : atelier central de production, hub principal
- **Veigné** : boutique autonome (pains + pâtisserie sur place)
- **Tours** : boutique autonome (pains + sandwiches traiteur sur place)
- **St-Avertin** : boutique cold, livrée quotidiennement par Le Local
- **Marché Amboise** (vendredi matin) + **Marché Beaujardin** (samedi matin)
- **Pros** (v21, pas encore codé) : restos, cafés, hôtels livrés par Le Local

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
- Envoi de l'accès : « 📤 Image + message » = image QR + message dans la feuille de partage (iPhone/iPad :
  WhatsApp met le texte en légende) ; partage abouti = « envoyé le … ». « 📋 Copier » ne marque « envoyé »
  qu'après confirmation. Message signé Philippe, 4 boutiques (portables) en fin, la sienne en premier.

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
