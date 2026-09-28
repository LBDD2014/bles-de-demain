/* ============================================================
   v20.259 — BackOffice → Pros → Semaine : grille pros × jours / produits × jours,
   brouillons compris (⏳), filtre par site. (Phil, 28/09 : « regarder par pro et
   par jour pour organiser la prod, vision globale des récurrences ».)
   Date figée des tests : mercredi 22 juillet 2026 (semaine du lundi 20).
   ============================================================ */
import { preparePage, gotoApp, assert } from '../helpers/harness.mjs';
import { makeDB, TENANT_ID } from '../helpers/fixtures.mjs';

const T = TENANT_ID;

async function semaine(ctx) {
  const db = makeDB();
  db.products.push({ id: 'cadre_royal_surg', tenant_id: T, name: 'Cadre Royal surgelé', category: 'patisserie_gros', actif: true, usage: 'reappro', supply_by_boutique: {} });
  db.pros = [
    { id: 'artigny', tenant_id: T, nom: 'Artigny', actif: true, boutique_principale: 'local', contacts: [], jours_livraison: {} },
    { id: 'coop', tenant_id: T, nom: 'Coop', actif: true, boutique_principale: 'local', contacts: [], jours_livraison: {} },
  ];
  const o = (id, pro, date, src, statut) => ({ id, tenant_id: T, pro_id: pro, date_livraison: date, boutique_source: src, statut });
  db.pro_orders = [
    o('o1', 'artigny', '2026-07-20', 'local', 'confirme'), o('o2', 'artigny', '2026-07-21', 'local', 'brouillon'),
    o('o3', 'artigny', '2026-07-21', 'veigne', 'confirme'), o('o4', 'coop', '2026-07-22', 'local', 'confirme'),
    o('o5', 'coop', '2026-07-23', 'local', 'annule'),
  ];
  db.pro_order_items = [
    { id: 'i1', pro_order_id: 'o1', product_id: 'vt_trad', qty: 20 }, { id: 'i2', pro_order_id: 'o2', product_id: 'vt_trad', qty: 20 },
    { id: 'i3', pro_order_id: 'o3', product_id: 'cadre_royal_surg', qty: 1 }, { id: 'i4', pro_order_id: 'o4', product_id: 'vt_trad', qty: 10 },
    { id: 'i5', pro_order_id: 'o5', product_id: 'vt_trad', qty: 99 },
  ];
  const page = await preparePage(ctx, { db });
  await gotoApp(page);
  await page.evaluate(async () => {
    currentVue = 'pros'; await loadAdminPros(); await loadAdminProducts();
    adminProsView = 'week'; recapWeekStart = '2026-07-20'; await loadRecapWeekOrders(); renderAdminPros();
  });
  return page;
}
const rows = (page) => page.evaluate(() => Array.from(document.querySelectorAll('#pw-grid-table tbody tr'))
  .map((tr) => Array.from(tr.children).map((td) => td.textContent.replace(/\s+/g, ' ').trim())));

export const tests = [
  {
    name: 'Grille par pro — une ligne par client, le détail par jour, brouillon marqué, annulée ignorée',
    fn: async (ctx) => {
      const page = await semaine(ctx);
      const r = await rows(page);
      const art = r.find((x) => x[0] === 'Artigny'), coop = r.find((x) => x[0] === 'Coop'), tot = r.find((x) => x[0] === 'Total');
      assert(art && art[1] === '20 Tradition' && art[2].indexOf('⏳') === 0 && art[2].indexOf('Cadre Royal') !== -1 && art[8] === '41 pces', 'Artigny : ' + JSON.stringify(art));
      assert(coop && coop[3] === '10 Tradition' && coop[4] === '' && coop[8] === '10 pces', 'Coop (annulée ignorée) : ' + JSON.stringify(coop));
      assert(tot && tot[1].indexOf('20 pces') === 0 && tot[1].indexOf('1 client') !== -1 && tot[8] === '51 pces', 'totaux : ' + JSON.stringify(tot));
      await page.close();
    },
  },
  {
    name: 'Grille par produit — cumul par site et par jour',
    fn: async (ctx) => {
      const page = await semaine(ctx);
      await page.evaluate(() => setProsWeekGrid('produit'));
      const r = await rows(page);
      const trad = r.find((x) => x[0] === 'Tradition'), cadre = r.find((x) => x[0] === 'Cadre Royal surgelé');
      assert(trad && trad[1] === '20' && trad[2] === '⏳ 20' && trad[3] === '10' && trad[8] === '50', 'Tradition : ' + JSON.stringify(trad));
      assert(cadre && cadre[2] === '1' && cadre[8] === '1', 'Cadre : ' + JSON.stringify(cadre));
      assert(r.some((x) => x[0] === 'Le Local') && r.some((x) => x[0] === 'Veigné'), 'sections par site');
      await page.close();
    },
  },
  {
    name: 'Grille — le filtre par site ne garde que ce que ce site fabrique',
    fn: async (ctx) => {
      const page = await semaine(ctx);
      await page.evaluate(() => setProsWeekGrid('pro', 'veigne'));
      const r = await rows(page);
      const art = r.find((x) => x[0] === 'Artigny');
      assert(art && art[1] === '' && art[2].indexOf('Cadre Royal') !== -1 && art[2].indexOf('Tradition') === -1, 'Veigné seul : ' + JSON.stringify(art));
      assert(!r.some((x) => x[0] === 'Coop'), 'Coop (Local) absent avec le filtre Veigné');
      await page.close();
    },
  },
];
