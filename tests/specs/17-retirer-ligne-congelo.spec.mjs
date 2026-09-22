/* ============================================================
   v20.249 — Bouton 🗑 « retirer du congélo » dans le mode chef tourier.

   Besoin réel : un même produit a souvent une fiche vente ET une fiche
   réassort. Les deux se retrouvaient inscrites au congélo, celle qui ne porte
   pas le stock traînant à 0 — 11 lignes vides au 22/09. Jusqu'ici seul un SQL
   pouvait les enlever.

   Garde-fous vérifiés ici : on ne retire jamais une ligne qui a encore du
   stock, et retirer la ligne ne touche pas au produit lui-même (il reste au
   catalogue, réinscriptible).
   ============================================================ */
import { preparePage, gotoApp, enterBoutique, assert } from '../helpers/harness.mjs';
import { makeDB, TENANT_ID } from '../helpers/fixtures.mjs';

const T = TENANT_ID;

function dbCongelo() {
  const db = makeDB();
  db.tourier_stock = [
    { tenant_id: T, product_id: 'vp_croissant', stock: 0, mini: null },   // doublon vide
    { tenant_id: T, product_id: 'vp_painchoc', stock: 12, mini: null },   // ligne pleine
  ];
  return db;
}

async function stockTourier(ctx) {
  const page = await preparePage(ctx, { db: dbCongelo() });
  await gotoApp(page);
  await enterBoutique(page, 'local');
  await page.evaluate(() => { tourierCatalogUnlocked = true; });
  await page.evaluate(() => setVue('stock_tour'));
  await page.waitForTimeout(500);
  return page;
}

const lignes = (page) => page.evaluate(() =>
  Object.keys(tourierStockData).sort());

export const tests = [
  {
    name: 'Congélo — le bouton 🗑 retire bien la ligne vide',
    fn: async (ctx) => {
      const page = await stockTourier(ctx);
      await page.evaluate(() => tourierRemoveLigne('vp_croissant'));
      await page.waitForTimeout(400);
      const apres = await lignes(page);
      assert(apres.indexOf('vp_croissant') === -1, `la ligne devait partir — reste : ${apres.join(', ')}`);
      assert(apres.indexOf('vp_painchoc') !== -1, 'les autres lignes ne bougent pas');
      await page.close();
    },
  },
  {
    name: 'Congélo — refus de retirer une ligne qui a encore du stock',
    fn: async (ctx) => {
      const page = await stockTourier(ctx);
      await page.evaluate(() => tourierRemoveLigne('vp_painchoc'));
      await page.waitForTimeout(400);
      const apres = await lignes(page);
      assert(apres.indexOf('vp_painchoc') !== -1, 'une ligne avec du stock ne doit pas partir');
      await page.close();
    },
  },
  {
    name: 'Congélo — retirer la ligne ne supprime pas le produit du catalogue',
    fn: async (ctx) => {
      const page = await stockTourier(ctx);
      await page.evaluate(() => tourierRemoveLigne('vp_croissant'));
      await page.waitForTimeout(400);
      const encoreLa = await page.evaluate(() =>
        !!window.__mockDB.products.find((p) => p.id === 'vp_croissant'));
      assert(encoreLa, 'le produit doit rester au catalogue, seule la ligne de congélo part');
      await page.close();
    },
  },
  {
    name: 'Congélo — le bouton n\'apparaît que le mode chef déverrouillé',
    fn: async (ctx) => {
      const page = await preparePage(ctx, { db: dbCongelo() });
      await gotoApp(page);
      await enterBoutique(page, 'local');
      await page.evaluate(() => setVue('stock_tour'));
      await page.waitForTimeout(500);
      const n = await page.evaluate(() =>
        Array.from(document.querySelectorAll('#main-content .iconbtn-pat'))
          .filter((b) => b.textContent.indexOf('🗑') !== -1).length);
      assert(n === 0, `aucun bouton 🗑 sans le code chef, ${n} trouvé(s)`);
      await page.close();
    },
  },
];
