/* ============================================================
   v20.245 — 🔍 chercher un produit à la saisie d'une commande spéciale.

   Avant, la vendeuse devait deviner la bonne catégorie puis dérouler une
   liste longue sur tablette. On tape maintenant 2 lettres, toutes catégories
   confondues, et le clic remplit catégorie + produit d'un coup.

   On vérifie aussi que la règle des doublons (v20.201/227) s'applique à la
   recherche : la version réassort d'un produit déjà vendu ne doit pas
   ressortir, sinon la commande repart sur la mauvaise référence.
   ============================================================ */
import { preparePage, gotoApp, enterBoutique, assert } from '../helpers/harness.mjs';
import { makeDB, TENANT_ID } from '../helpers/fixtures.mjs';

const T = TENANT_ID;

function dbCatalogue() {
  const db = makeDB();
  // La base factice a déjà un « Croissant » vendu (vp_croissant) : on n'ajoute
  // que sa version réassort, celle qui doit rester masquée.
  db.products.push(
    { id: 'cro_reappro', tenant_id: T, name: 'Croissant', category: 'viennoiserie',
      actif: true, usage: 'reappro', supply_by_boutique: null, pros_only_id: null,
      pces_per_caisse: null, seuil_stock: null }
  );
  return db;
}

/** Ouvre une nouvelle commande et tape `q` dans la barre de recherche produit. */
async function chercher(ctx, q, db) {
  const page = await preparePage(ctx, { db: db || dbCatalogue() });
  await gotoApp(page);
  await enterBoutique(page, 'veigne');
  await page.evaluate(() => setVue('specials'));
  await page.waitForSelector('#main-content');
  await page.evaluate(() => openNewSpecialOrder());
  await page.waitForSelector('.sp-psearch-box input');
  // v20.329 — une seule recherche pour toute la commande ; « ✏️ Autre » (texte libre) n'est pas un produit
  await page.evaluate((s) => handleSpecialItemSearch(s), q);
  const hits = await page.evaluate(() =>
    Array.from(document.querySelectorAll('#sp-psearch-res .sp-psearch-hit:not(.sp-psearch-libre)'))
      .map((b) => b.childNodes[0].textContent.replace(/^\+\s*/, '').trim()));
  return { page, hits };
}

export const tests = [
  {
    name: 'Recherche — 2 lettres suffisent et traversent les catégories',
    fn: async (ctx) => {
      const { page, hits } = await chercher(ctx, 'ecl');
      assert(hits.indexOf('Éclair Chocolat indiv.') !== -1,
        `« Éclair Chocolat indiv. » attendu — trouvé : ${hits.join(' | ')}`);
      await page.close();
    },
  },
  {
    name: 'Recherche — insensible aux accents et à la casse',
    fn: async (ctx) => {
      const { page, hits } = await chercher(ctx, 'ÉCLAIR');
      assert(hits.length > 0, 'la recherche accentuée en majuscules doit trouver l\'éclair');
      await page.close();
    },
  },
  {
    name: 'Recherche — une seule lettre ne déclenche rien',
    fn: async (ctx) => {
      const { page, hits } = await chercher(ctx, 'e');
      assert(hits.length === 0, `aucun résultat attendu sous 2 lettres — trouvé : ${hits.join(' | ')}`);
      await page.close();
    },
  },
  {
    name: 'Recherche — pas de doublon réassort quand le produit est aussi vendu',
    fn: async (ctx) => {
      const { page, hits } = await chercher(ctx, 'croissant');
      const n = hits.filter((x) => x === 'Croissant').length;
      assert(n === 1, `un seul « Croissant » attendu, ${n} trouvé(s) — liste : ${hits.join(' | ')}`);
      await page.close();
    },
  },
  {
    name: 'Recherche — un appui ajoute le produit (catégorie comprise), un 2e appui fait +1, la recherche se vide',
    fn: async (ctx) => {
      const { page } = await chercher(ctx, 'ecl');
      await page.evaluate(() => specialSearchPick('pat_eclair'));
      const it = await page.evaluate(() => {
        const i = specialFormDraft.items[0];
        return { cat: i.category, pid: i.product_id, q: specialFormDraft.recherche, n: specialFormDraft.items.length };
      });
      assert(it.pid === 'pat_eclair', `product_id attendu pat_eclair, reçu ${it.pid}`);
      assert(it.cat === 'patisserie_petits', `catégorie attendue patisserie_petits, reçue ${it.cat}`);
      assert(!it.q, 'la recherche doit se vider après le choix');
      const r = await page.evaluate(() => { specialSearchPick('pat_eclair'); specialItemQtyStep(0, 1); return { n: specialFormDraft.items.length, q: specialFormDraft.items[0].qty }; });
      assert(r.n === 1 && r.q === '3', 'même produit = même ligne, + / − : ' + JSON.stringify(r));
      await page.close();
    },
  },
  {
    name: 'Recherche — un mot inconnu affiche un message, pas une liste vide',
    fn: async (ctx) => {
      const { page } = await chercher(ctx, 'zzzz');
      const txt = await page.evaluate(() =>
        (document.getElementById('sp-psearch-res').textContent || '').trim());
      assert(txt.indexOf('Pas dans la liste') !== -1 && txt.indexOf('Hors carte : « zzzz »') !== -1, `message + « ✏️ Hors carte » attendus (v20.345) — reçu : « ${txt} »`);
      await page.close();
    },
  },
];
