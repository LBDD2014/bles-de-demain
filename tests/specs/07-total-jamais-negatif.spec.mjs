/* ============================================================
   v20.196 — Un « Total à produire » ne peut jamais être négatif.

   Cas réel (lundi 24/08/2026, Le Local → Prod. Boulangers) : St-Avertin ne
   commande rien le lundi, mais il lui restait du pain le dimanche soir. Les
   restes étaient déduits d'un besoin inexistant → KPI « TOTAL À PRODUIRE »
   à −23,5 et une liste vide.

   Règle : une déduction ne peut pas dépasser le besoin qu'elle concerne.
   ============================================================ */
import { preparePage, gotoApp, enterBoutique, assert } from '../helpers/harness.mjs';
import { makeDB, TENANT_ID, TEST_TODAY, TEST_YESTERDAY } from '../helpers/fixtures.mjs';

/** St-Avertin : rien de commandé aujourd'hui, mais 6 pains restés hier soir. */
function dbStAvFermee() {
  const db = makeDB();
  db.previs = db.previs.filter((r) => r.boutique_id !== 'saint-avertin');
  db.sales.push({
    tenant_id: TENANT_ID, boutique_id: 'saint-avertin', product_id: 'vt_trad',
    date: TEST_YESTERDAY, matin: 20, aprem: null,
    reste_j1: 4, reste_j2: 2, perte: 0, day_closed: true,
  });
  return db;
}

async function ouvrirProdBoulangers(ctx) {
  const page = await preparePage(ctx, { db: dbStAvFermee() });
  await gotoApp(page);
  await enterBoutique(page, 'local');
  await page.evaluate(() => setVue('prod_boul'));
  await page.waitForSelector('.prod-kpi-val');
  return page;
}

export const tests = [
  {
    name: 'Prod. Boulangers — le total ne part pas en négatif quand St-Av ne commande rien',
    fn: async (ctx) => {
      const page = await ouvrirProdBoulangers(ctx);
      const kpi = await page.evaluate(() =>
        document.querySelector('.prod-kpi-val').textContent.trim());
      const val = parseFloat(kpi.replace(',', '.'));
      assert(!isNaN(val), `KPI illisible : "${kpi}"`);
      assert(val >= 0, `« Total à produire » ne peut pas être négatif (obtenu ${kpi})`);
      await page.close();
    },
  },
  {
    name: 'Prod. Boulangers — aucune ligne ne descend sous zéro',
    fn: async (ctx) => {
      const page = await ouvrirProdBoulangers(ctx);
      // filtre décoché : on veut voir TOUTES les lignes, y compris les vides
      await page.evaluate(() => { productionFilterEmpty = false; renderProduction(); });
      await page.waitForSelector('.prod-row');
      const negatives = await page.evaluate(() =>
        Array.from(document.querySelectorAll('.prod-row')).map((r) => {
          const t = r.querySelector('.cell.total');
          const nom = (r.querySelector('.prod-name') || {}).textContent || '?';
          return { nom, val: parseFloat((t ? t.textContent : '0').replace(',', '.')) };
        }).filter((x) => x.val < 0));
      assert(negatives.length === 0,
        `lignes négatives : ${negatives.map((n) => n.nom + '=' + n.val).join(', ')}`);
      await page.close();
    },
  },
  {
    name: 'La déduction reste appliquée quand St-Avertin commande vraiment',
    fn: async (ctx) => {
      const db = dbStAvFermee();
      // St-Av commande 10 Tradition aujourd'hui, il lui en restait 6 hier soir
      db.previs.push({
        tenant_id: TENANT_ID, boutique_id: 'saint-avertin',
        product_id: 'vt_trad', service_date: TEST_TODAY, qty: 10,
      });
      const page = await preparePage(ctx, { db });
      await gotoApp(page);
      await enterBoutique(page, 'local');
      await page.evaluate(() => setVue('prod_boul'));
      await page.waitForSelector('.prod-row');

      const ligne = await page.evaluate(() => {
        const r = Array.from(document.querySelectorAll('.prod-row'))
          .find((x) => (x.querySelector('.prod-name') || {}).textContent === 'Tradition');
        return r ? r.querySelector('.cell.total').textContent.trim() : null;
      });
      assert(ligne === '4', `Tradition : 10 commandés − 6 restants = 4 attendu, obtenu "${ligne}"`);
      await page.close();
    },
  },
];
