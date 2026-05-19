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
- Valeurs persistantes semaine en semaine
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

### Quantités par caisse (viennoiserie)

Croissant 70 / Pain choc 130 / Pain raisin 80 / Suisse 60 / Tartelettes 12 / Cannelé 170.
(Chausson aux pommes + croissant amande : à confirmer)

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
