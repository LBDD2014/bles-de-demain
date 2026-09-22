/* ============================================================
   v20.248 — Le bandeau des commandes que personne ne peut préparer.

   Une commande ne devient « à préparer » que si le produit est inscrit au
   catalogue de l'atelier destinataire : tourier_stock au Local,
   veigne_pat_stock chez le pâtissier de Veigné. Sinon la ligne était jetée
   au chargement, en silence : la commande partait, le livreur la marquait
   livrée, et personne ne l'avait jamais vue.

   Constaté le 22/09 : 30 Brioches Gabriel commandées par Veigné, les Quiches
   et Crêpes de Tours, les Coonies. Désormais ces lignes s'affichent dans un
   bandeau orange au lieu de disparaître.
   ============================================================ */
import { preparePage, gotoApp, enterBoutique, assert } from '../helpers/harness.mjs';
import { makeDB, TENANT_ID, TEST_TODAY } from '../helpers/fixtures.mjs';

const T = TENANT_ID;

/** Deux produits livrés par le Local : un inscrit au congélo, l'autre pas. */
function dbLocal({ auCongelo = true } = {}) {
  const db = makeDB();
  db.products.push({
    id: 'brioche_gab', tenant_id: T, name: 'Brioche Gabriel', category: 'viennoiserie',
    actif: true, usage: 'reappro', pros_only_id: null, pces_per_caisse: null, seuil_stock: null,
    supply_by_boutique: JSON.stringify({ veigne: 'local', tours: 'local', 'saint-avertin': 'local' }),
  });
  db.tourier_stock = [{ tenant_id: T, product_id: 'vp_croissant', stock: 5, mini: null }];
  if (auCongelo) db.tourier_stock.push({ tenant_id: T, product_id: 'brioche_gab', stock: 2, mini: null });
  db.reappros = [{
    id: 'rp_bg', tenant_id: T, boutique_id: 'veigne', product_id: 'brioche_gab',
    service_date: TEST_TODAY, commander: 30, sent_at: TEST_TODAY + 'T06:00:00',
    prepared_at: null, qty_livree: null, livre_at: null,
  }];
  return db;
}

/** Un gâteau fait à Veigné et commandé par Tours, absent du catalogue pâtissier. */
function dbVeigne({ auCatalogue = false } = {}) {
  const db = makeDB();
  db.products.push({
    id: 'quiche', tenant_id: T, name: 'Quiche', category: 'sec_traiteur',
    actif: true, usage: 'reappro', pros_only_id: null, pces_per_caisse: null, seuil_stock: null,
    supply_by_boutique: JSON.stringify({ veigne: 'on_site', tours: 'veigne', 'saint-avertin': 'veigne' }),
  });
  db.veigne_pat_stock = auCatalogue
    ? [{ tenant_id: T, product_id: 'quiche', stock: 0, stock_unit: 'piece', unit_pieces: null, actif: true, shops: null }]
    : [];
  db.reappros = [{
    id: 'rp_q', tenant_id: T, boutique_id: 'tours', product_id: 'quiche',
    service_date: TEST_TODAY, commander: 2, sent_at: TEST_TODAY + 'T06:00:00',
    prepared_at: null, qty_livree: null, livre_at: null,
  }];
  return db;
}

async function ecran(ctx, boutique, vue, db) {
  const page = await preparePage(ctx, { db });
  await gotoApp(page);
  await enterBoutique(page, boutique);
  await page.evaluate(() => { stockPatUnlocked = true; });
  await page.evaluate((v) => setVue(v), vue);
  await page.waitForTimeout(500);
  return page;
}

const bandeau = (page) => page.evaluate(() => {
  const el = document.querySelector('#main-content .orph-banner');
  return el ? el.textContent.replace(/\s+/g, ' ').trim() : null;
});

export const tests = [
  {
    name: 'Local — une commande hors congélo s\'affiche au lieu de disparaître',
    fn: async (ctx) => {
      const page = await ecran(ctx, 'local', 'stock_tour', dbLocal({ auCongelo: false }));
      const t = await bandeau(page);
      assert(t, 'un bandeau était attendu');
      assert(t.indexOf('Brioche Gabriel') !== -1, `le produit doit être nommé — reçu : ${t}`);
      assert(t.indexOf('30') !== -1, `la quantité doit apparaître — reçu : ${t}`);
      assert(t.indexOf('Veigné') !== -1, `le magasin demandeur doit apparaître — reçu : ${t}`);
      await page.close();
    },
  },
  {
    name: 'Local — pas de bandeau quand le produit est bien au congélo',
    fn: async (ctx) => {
      const page = await ecran(ctx, 'local', 'stock_tour', dbLocal({ auCongelo: true }));
      assert(await bandeau(page) === null, 'aucun bandeau ne doit s\'afficher');
      await page.close();
    },
  },
  {
    name: 'Local — la commande reste préparable normalement quand elle est au congélo',
    fn: async (ctx) => {
      const page = await ecran(ctx, 'local', 'stock_tour', dbLocal({ auCongelo: true }));
      const n = await page.evaluate(() => (tourierReassort.veigne || []).length);
      assert(n === 1, `la ligne doit rester dans « À préparer » (${n} trouvée(s))`);
      await page.close();
    },
  },
  {
    name: 'Veigné — une commande hors catalogue pâtissier s\'affiche',
    fn: async (ctx) => {
      const page = await ecran(ctx, 'veigne', 'stock_pat', dbVeigne({ auCatalogue: false }));
      const t = await bandeau(page);
      assert(t, 'un bandeau était attendu');
      assert(t.indexOf('Quiche') !== -1, `le produit doit être nommé — reçu : ${t}`);
      assert(t.indexOf('Tours') !== -1, `le magasin demandeur doit apparaître — reçu : ${t}`);
      await page.close();
    },
  },
  {
    name: 'Veigné — pas de bandeau une fois le produit inscrit au catalogue',
    fn: async (ctx) => {
      const page = await ecran(ctx, 'veigne', 'stock_pat', dbVeigne({ auCatalogue: true }));
      assert(await bandeau(page) === null, 'aucun bandeau ne doit s\'afficher');
      const n = await page.evaluate(() => (veignePatReassort.tours || []).length);
      assert(n === 1, `la ligne doit être passée dans « À préparer » (${n} trouvée(s))`);
      await page.close();
    },
  },
];
