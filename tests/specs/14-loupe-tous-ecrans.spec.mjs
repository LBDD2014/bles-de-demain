/* ============================================================
   v20.246 — La loupe 🔍 sur tous les écrans qui listent des produits.

   Elle n'existait que sur Réappro et Prévis. Plutôt que d'ajouter l'appel à
   la main dans onze fonctions de rendu, l'app regarde ce qui vient d'être
   affiché : au moins 8 lignes de produit et pas de barre → elle la pose.

   Ce qu'on verrouille ici : la barre arrive toute seule, elle filtre, elle ne
   se duplique pas sur les écrans qui l'affichaient déjà, elle ne s'invite pas
   sur une liste courte, et le texte tapé ne suit pas d'un onglet à l'autre
   (sinon la vendeuse croirait des produits disparus).
   ============================================================ */
import { preparePage, gotoApp, enterBoutique, assert } from '../helpers/harness.mjs';
import { makeDB, TENANT_ID } from '../helpers/fixtures.mjs';

const T = TENANT_ID;

/** Un catalogue fourni : en boutique les listes font 50 à 130 lignes. */
function dbCatalogueFourni() {
  const db = makeDB();
  [['pains', 'on_site'], ['viennoiserie', 'local'], ['patisserie_petits', 'veigne']].forEach(function(paire) {
    const cat = paire[0], sup = paire[1];
    for (let i = 1; i <= 10; i++) {
      db.products.push({
        id: 'x_' + cat + '_' + i, tenant_id: T, name: 'Test ' + cat + ' ' + i, category: cat,
        actif: true, usage: 'both', pros_only_id: null, pces_per_caisse: null, seuil_stock: 10,
        supply_by_boutique: JSON.stringify({ veigne: sup, tours: sup, 'saint-avertin': sup === 'on_site' ? 'local' : sup }),
      });
    }
  });
  return db;
}

async function ecran(ctx, vue, db) {
  const page = await preparePage(ctx, { db: db || dbCatalogueFourni() });
  await gotoApp(page);
  await enterBoutique(page, 'veigne');
  await page.evaluate((v) => setVue(v), vue);
  await page.waitForTimeout(400);
  return page;
}

const etat = (page) => page.evaluate(() => {
  const mc = document.getElementById('main-content');
  const rows = Array.from(mc.querySelectorAll(FILTER_ROW_SEL)).filter((r) => r.querySelector(FILTER_NAME_SEL));
  return { rows: rows.length, barres: mc.querySelectorAll('.product-filter').length };
});

export const tests = [
  {
    name: 'Loupe — arrive toute seule sur Ventes, qui ne l\'avait pas',
    fn: async (ctx) => {
      const page = await ecran(ctx, 'ventes');
      const e = await etat(page);
      assert(e.rows >= 8, `il faut une liste longue pour ce test (${e.rows} lignes)`);
      assert(e.barres === 1, `une barre attendue sur Ventes, ${e.barres} trouvée(s)`);
      await page.close();
    },
  },
  {
    name: 'Loupe — filtre vraiment, et tout revient quand on efface',
    fn: async (ctx) => {
      const page = await ecran(ctx, 'ventes');
      const r = await page.evaluate(() => {
        const mc = document.getElementById('main-content');
        const rows = Array.from(mc.querySelectorAll(FILTER_ROW_SEL)).filter((x) => x.querySelector(FILTER_NAME_SEL));
        const visibles = () => rows.filter((x) => x.style.display !== 'none').length;
        productFilterQuery = 'test pains 3'; applyProductFilter();
        const filtre = visibles();
        clearProductFilter();
        return { total: rows.length, filtre: filtre, apres: visibles() };
      });
      assert(r.filtre === 1, `une seule ligne attendue après filtrage, ${r.filtre} visible(s)`);
      assert(r.apres === r.total, `toutes les lignes doivent revenir (${r.apres}/${r.total})`);
      await page.close();
    },
  },
  {
    name: 'Loupe — pas de deuxième barre sur Réappro, qui l\'affichait déjà',
    fn: async (ctx) => {
      const page = await ecran(ctx, 'reappro');
      const e = await etat(page);
      assert(e.barres === 1, `une seule barre attendue sur Réappro, ${e.barres} trouvée(s)`);
      await page.close();
    },
  },
  {
    name: 'Loupe — pas de barre sur une liste courte',
    fn: async (ctx) => {
      // Catalogue réduit : la base factice en compte déjà 8, soit tout juste le seuil.
      const petit = makeDB();
      petit.products = petit.products.slice(0, 4);
      const page = await ecran(ctx, 'ventes', petit);
      const e = await etat(page);
      assert(e.rows < 8, `ce test suppose une liste courte (${e.rows} lignes)`);
      assert(e.barres === 0, 'une liste qui tient dans l\'écran n\'a pas besoin de loupe');
      await page.close();
    },
  },
  {
    name: 'Loupe — le texte tapé ne suit pas d\'un onglet à l\'autre',
    fn: async (ctx) => {
      const page = await ecran(ctx, 'ventes');
      await page.evaluate(() => { productFilterQuery = 'tradition'; applyProductFilter(); });
      await page.evaluate(() => setVue('reappro'));
      await page.waitForTimeout(400);
      const q = await page.evaluate(() => productFilterQuery);
      assert(q === '', `le filtre doit repartir à vide, reçu « ${q} »`);
      await page.close();
    },
  },
];
