# Tests automatisés — Les Blés de Demain

Suite de tests de l'application (`index-cloud-test.html`), pilotée par des agents IA dans un vrai navigateur Chromium.

## Ce qui est important à savoir

**Aucun test ne touche la vraie base Supabase.** Les tests utilisent une fausse base de données en mémoire (`helpers/mock-supabase.js`) avec un jeu de données factice (`helpers/fixtures.mjs` : Tradition, Croissant, Fougasse…). Un test de sécurité vérifie même qu'aucune requête ne part vers `supabase.co`. Tu peux donc lancer les tests autant de fois que tu veux, jour et nuit, sans risque pour les données des boutiques.

La date est **figée au mercredi 22 juillet 2026, 10h00** pendant les tests, pour que les calculs (prévis J-1, marchés du vendredi/samedi, règle des 2h du matin) donnent toujours le même résultat.

## Installation (une seule fois, sur Mac)

```bash
cd tests
npm install
npx playwright install chromium
```

## Lancer les tests

```bash
cd tests
node run-tests.mjs          # tous les tests
node run-tests.mjs 04       # seulement le fichier 04 (règles métier)
```

Résultat attendu : `34 réussi(s), 0 échoué(s)`. Les parcours utilisateur déposent des captures d'écran dans `tests/screenshots/`.

## Ce que couvrent les tests

| Fichier | Contenu |
|---|---|
| `specs/01-fonctions-metier.spec.mjs` | Les fonctions de calcul : dates (règle des 2h du matin, lundi de semaine, prochains marchés), tri prioritaire Tradition, options caisses, virgule décimale, origine produit par boutique, défauts de production |
| `specs/02-navigation.spec.mjs` | L'app démarre, chaque boutique s'ouvre, chaque onglet se charge sans erreur JavaScript |
| `specs/03-acces-pin.spec.mjs` | PIN BackOffice (bon/mauvais code), codes d'accès boutique, code maître |
| `specs/04-regles-metier.spec.mjs` | Le cœur du métier : pré-remplissage Matin(J) = Prévis(J-1) − Reste J-1, jamais négatif, produits livrés = réappro envoyée, enregistrement en base, test de sécurité réseau |
| `specs/05-parcours-utilisateur.spec.mjs` | Parcours complets avec de vrais clics : vendeur Veigné (ventes + pavé numérique), réappro croissants, BackOffice au PIN, livreur — avec captures d'écran |

## Le bon réflexe

Avant chaque déploiement (push sur GitHub Pages) : lancer `node run-tests.mjs`. Si tout est vert, tu peux pousser. Si un test casse, c'est qu'une modification a changé un comportement existant — à vérifier avant de mettre en ligne.

## Ajouter un test

Copier un bloc `{ name, fn }` dans un des fichiers `specs/`, ou créer un nouveau fichier `specs/06-xxx.spec.mjs` qui exporte `export const tests = [...]`. Les données de test se modifient dans `helpers/fixtures.mjs`.
