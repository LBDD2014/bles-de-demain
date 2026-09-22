/* ============================================================
   v20.247 — Les pâtissiers de Veigné ne voyaient pas le réassort de LEUR
   PROPRE boutique.

   Remonté le 22/09 : les vendeuses de Veigné commandent bien dans « Cmd
   Veigné Pât. » (9 gâteaux le 21/09, tracés en base), mais l'écran Stock Pât.
   ne lisait que Tours et St-Avertin, et exigeait en plus que le produit soit
   « livré par Veigné » — alors qu'à Veigné la pâtisserie est SUR PLACE.
   Trois filtres qui excluaient Veigné de son propre atelier depuis la v20.47.

   Ce qu'on verrouille : la section Veigné existe, elle passe en premier, le
   « préparé » décompte le stock du pâtissier (décision Phil du 22/09), et
   Tours continue de marcher comme avant.
   ============================================================ */
import { preparePage, gotoApp, enterBoutique, assert } from '../helpers/harness.mjs';
import { makeDB, TENANT_ID, TEST_TODAY } from '../helpers/fixtures.mjs';

const T = TENANT_ID;

/** Un gâteau fait sur place à Veigné, livré à Tours, suivi au stock pâtissier. */
function dbAvecReassortPat({ veigne = 3, tours = 2 } = {}) {
  const db = makeDB();
  db.products.push({
    id: 'pat_royal', tenant_id: T, name: 'Royal', category: 'patisserie_petits',
    actif: true, usage: 'both', pros_only_id: null, pces_per_caisse: null, seuil_stock: null,
    supply_by_boutique: JSON.stringify({ veigne: 'on_site', tours: 'veigne', 'saint-avertin': 'veigne' }),
  });
  db.veigne_pat_stock = [{
    tenant_id: T, product_id: 'pat_royal', stock: 10, stock_unit: 'piece',
    unit_pieces: null, actif: true, shops: null,
  }];
  db.reappros = [];
  if (veigne) db.reappros.push({
    id: 'rp_v', tenant_id: T, boutique_id: 'veigne', product_id: 'pat_royal',
    service_date: TEST_TODAY, commander: veigne, sent_at: TEST_TODAY + 'T06:00:00',
    prepared_at: null, qty_livree: null, livre_at: null,
  });
  if (tours) db.reappros.push({
    id: 'rp_t', tenant_id: T, boutique_id: 'tours', product_id: 'pat_royal',
    service_date: TEST_TODAY, commander: tours, sent_at: TEST_TODAY + 'T06:00:00',
    prepared_at: null, qty_livree: null, livre_at: null,
  });
  return db;
}

async function stockPat(ctx, db) {
  const page = await preparePage(ctx, { db });
  await gotoApp(page);
  await enterBoutique(page, 'veigne');
  await page.evaluate(() => { stockPatUnlocked = true; });
  await page.evaluate(() => setVue('stock_pat'));
  await page.waitForTimeout(500);
  return page;
}

const sections = (page) => page.evaluate(() =>
  Array.from(document.querySelectorAll('#main-content .section-header span'))
    .map((s) => s.textContent.trim())
    .filter((t) => t.indexOf('À préparer') !== -1));

export const tests = [
  {
    name: 'Stock Pât. — le réassort de la boutique de Veigné est visible',
    fn: async (ctx) => {
      const page = await stockPat(ctx, dbAvecReassortPat());
      const s = await sections(page);
      assert(s.some((t) => t.indexOf('Veigné') !== -1),
        `section Veigné attendue — trouvé : ${s.join(' | ') || '(aucune)'}`);
      await page.close();
    },
  },
  {
    name: 'Stock Pât. — Veigné passe avant Tours',
    fn: async (ctx) => {
      const page = await stockPat(ctx, dbAvecReassortPat());
      const s = await sections(page);
      const iv = s.findIndex((t) => t.indexOf('Veigné') !== -1);
      const it = s.findIndex((t) => t.indexOf('Tours') !== -1);
      assert(iv !== -1 && it !== -1, `les deux sections attendues — trouvé : ${s.join(' | ')}`);
      assert(iv < it, `Veigné doit passer en premier — ordre : ${s.join(' | ')}`);
      await page.close();
    },
  },
  {
    name: 'Stock Pât. — « préparé » pour Veigné décompte le stock du pâtissier',
    fn: async (ctx) => {
      const page = await stockPat(ctx, dbAvecReassortPat({ veigne: 3, tours: 0 }));
      await page.evaluate(() => prepareVeignePatLine('veigne', 'pat_royal'));
      await page.waitForTimeout(400);
      const r = await page.evaluate(() => ({
        stock: (window.__mockDB.veigne_pat_stock.find((x) => x.product_id === 'pat_royal') || {}).stock,
        prepare: !!(window.__mockDB.reappros.find((x) => x.id === 'rp_v') || {}).prepared_at,
      }));
      assert(r.prepare, 'la ligne doit être marquée préparée');
      assert(r.stock === 7, `stock attendu 10 − 3 = 7, reçu ${r.stock}`);
      await page.close();
    },
  },
  {
    name: 'Stock Pât. — Tours continue d\'apparaître comme avant',
    fn: async (ctx) => {
      const page = await stockPat(ctx, dbAvecReassortPat({ veigne: 0, tours: 2 }));
      const s = await sections(page);
      assert(s.some((t) => t.indexOf('Tours') !== -1),
        `section Tours attendue — trouvé : ${s.join(' | ') || '(aucune)'}`);
      assert(!s.some((t) => t.indexOf('Veigné') !== -1),
        'pas de section Veigné quand la boutique n\'a rien commandé');
      await page.close();
    },
  },
];
