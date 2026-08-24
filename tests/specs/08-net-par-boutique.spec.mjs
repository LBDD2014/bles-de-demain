/* ============================================================
   v20.197 — Le net à produire doit être ventilé PAR BOUTIQUE.

   Avant, les restes de Veigné et de St-Avertin étaient additionnés dans une
   colonne unique « Reste hier » : le pâtissier voyait « −8 » sans savoir si
   ça venait de Veigné ou de St-Av, donc sans savoir quoi mettre dans quel bac.
   ============================================================ */
import { preparePage, gotoApp, enterBoutique, assert } from '../helpers/harness.mjs';
import { makeDB, TENANT_ID, TEST_TODAY, TEST_YESTERDAY } from '../helpers/fixtures.mjs';

const PROD = 'tr_parisien';
const NOM = 'Le Parisien';

/** Veigné prévoit 6 et en a gardé 4 ; St-Avertin en veut 5 et en a gardé 1. */
function dbDeuxBoutiques() {
  const db = makeDB();
  // Sandwich fabriqué à Veigné, livré à St-Avertin. La colonne Matin SA n'existe
  // que pour traiteur / gros gâteaux / gâteaux secs (v20.23) — d'où le traiteur ici.
  // Ajouté localement pour ne pas fausser le compte de produits des autres tests.
  db.products.push({
    id: PROD, tenant_id: TENANT_ID, name: NOM, category: 'traiteur', actif: true,
    pros_only_id: null, pces_per_caisse: null, seuil_stock: null, usage: 'both',
    supply_by_boutique: JSON.stringify({ veigne: 'on_site', tours: 'on_site', 'saint-avertin': 'veigne' }),
  });
  [['veigne', 6], ['saint-avertin', 5]].forEach(([b, q]) =>
    db.previs.push({ tenant_id: TENANT_ID, boutique_id: b, product_id: PROD, service_date: TEST_TODAY, qty: q }));
  [['veigne', 3, 1], ['saint-avertin', 1, 0]].forEach(([b, j1, j2]) =>
    db.sales.push({ tenant_id: TENANT_ID, boutique_id: b, product_id: PROD, date: TEST_YESTERDAY,
                    matin: 6, aprem: null, reste_j1: j1, reste_j2: j2, perte: 0, day_closed: true }));
  return db;
}

async function ligneSandwich(ctx) {
  const page = await preparePage(ctx, { db: dbDeuxBoutiques() });
  await gotoApp(page);
  await enterBoutique(page, 'veigne');
  await page.evaluate(() => setVue('production'));
  await page.waitForSelector('.prod-table-header');
  const data = await page.evaluate((NOM) => {
    const head = Array.from(document.querySelectorAll('.prod-table-header > *')).map((e) => e.textContent.trim());
    const r = Array.from(document.querySelectorAll('.prod-row'))
      .find((x) => ((x.querySelector('.prod-name') || {}).textContent || '').includes(NOM));
    if (!r) return { head, absent: true };
    const net = (sel) => {
      const i = r.querySelector(sel);
      if (!i) return null;
      const n = i.parentElement.querySelector('.prod-shop-net');
      return { brut: i.value, net: n ? n.querySelector('.net-val').textContent.trim() : null };
    };
    return { head, v: net('.matin-v-input'), sa: net('.matin-sa-input'),
             total: r.querySelector('.cell.total').textContent.trim() };
  }, NOM);
  return { page, data };
}

export const tests = [
  {
    name: 'À produire — plus de colonne « Reste hier » fusionnée',
    fn: async (ctx) => {
      const { page, data } = await ligneSandwich(ctx);
      assert(!data.head.includes('Reste hier'),
        `la colonne fusionnée devrait avoir disparu — en-têtes : ${data.head.join(' | ')}`);
      await page.close();
    },
  },
  {
    name: 'À produire — chaque boutique affiche SON net sous sa case',
    fn: async (ctx) => {
      const { page, data } = await ligneSandwich(ctx);
      assert(!data.absent, 'ligne '+NOM+' introuvable');
      // Veigné : 6 prévus − 4 gardés (3 + 1) = 2
      assert(data.v && data.v.brut === '6', `case Veigné = prévis brut 6 attendu, obtenu "${data.v && data.v.brut}"`);
      assert(data.v.net === '2', `net Veigné = 2 attendu, obtenu "${data.v.net}"`);
      // St-Avertin : 5 prévus − 1 gardé = 4
      assert(data.sa && data.sa.brut === '5', `case St-Av = prévis brut 5 attendu, obtenu "${data.sa && data.sa.brut}"`);
      assert(data.sa.net === '4', `net St-Av = 4 attendu, obtenu "${data.sa.net}"`);
      await page.close();
    },
  },
  {
    name: 'À produire — le Total reste la somme des deux boutiques',
    fn: async (ctx) => {
      const { page, data } = await ligneSandwich(ctx);
      assert(data.total === '6', `Total = 2 (Veigné) + 4 (St-Av) = 6 attendu, obtenu "${data.total}"`);
      await page.close();
    },
  },
  {
    name: 'À produire — corriger une case met à jour le net de CETTE boutique seulement',
    fn: async (ctx) => {
      const page = await preparePage(ctx, { db: dbDeuxBoutiques() });
      await gotoApp(page);
      await enterBoutique(page, 'veigne');
      await page.evaluate(() => setVue('production'));
      await page.waitForSelector('.prod-row');
      // le boulanger passe la prévis Veigné de 6 à 10 → net Veigné 10 − 4 = 6
      await page.evaluate((NOM) => {
        const r = Array.from(document.querySelectorAll('.prod-row'))
          .find((x) => ((x.querySelector('.prod-name') || {}).textContent || '').includes(NOM));
        const i = r.querySelector('.matin-v-input');
        i.value = '10';
        handleMatinVInput(i);
      }, NOM);
      const apres = await page.evaluate((NOM) => {
        const r = Array.from(document.querySelectorAll('.prod-row'))
          .find((x) => ((x.querySelector('.prod-name') || {}).textContent || '').includes(NOM));
        const g = (sel) => {
          const n = r.querySelector(sel).parentElement.querySelector('.prod-shop-net');
          return n ? n.querySelector('.net-val').textContent.trim() : null;
        };
        return { v: g('.matin-v-input'), sa: g('.matin-sa-input'), total: r.querySelector('.cell.total').textContent.trim() };
      }, NOM);
      assert(apres.v === '6', `net Veigné = 10 − 4 = 6 attendu, obtenu "${apres.v}"`);
      assert(apres.sa === '4', `net St-Av ne doit pas bouger (4), obtenu "${apres.sa}"`);
      assert(apres.total === '10', `Total = 6 + 4 = 10 attendu, obtenu "${apres.total}"`);
      await page.close();
    },
  },
];
