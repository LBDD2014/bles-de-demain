/* ============================================================
   v20.255 — « Ma journée » du livreur : toutes les commandes spéciales qui
   changent de site, avec nom, contenu, heure et où les prendre.

   Besoin réel (Phil, 24/09) : LIBAULT (Tours, fait à Veigné) n'apparaissait
   qu'en nombre, et les commandes St-Avertin faites au Local pas du tout.
   Date figée des tests : mercredi 22 juillet 2026.
   ============================================================ */
import { preparePage, gotoApp, enterBoutique, assert } from '../helpers/harness.mjs';
import { makeDB, TENANT_ID } from '../helpers/fixtures.mjs';

const T = TENANT_ID;
const D = '2026-07-22';
function cmd(id, nom, origin, prod, heure, status) {
  return { id, tenant_id: T, customer_name: nom, origin_shop: origin, production_shop: prod,
    pickup_date: D, pickup_time: heure, status: status || 'confirmee' };
}
function ligne(id, oid, txt) {
  return { id, order_id: oid, product_id: null, product_name_custom: txt, qty: 1, position: 0 };
}

async function maJournee(ctx) {
  const db = makeDB();
  db.special_orders.push(
    cmd('o1', 'LIBAULT', 'tours', 'veigne', '10:00'),
    cmd('o2', 'AUBART', 'saint-avertin', 'local', '09:00', 'prete'),
    cmd('o3', 'Blancke', 'tours', 'tours', '12:00'),            // fait sur place : rien à livrer
    cmd('o4', 'Belletoise', 'saint-avertin', 'local', '08:00', 'livree'),  // déjà partie
  );
  db.special_order_items.push(
    ligne('i1', 'o1', 'Royal 6 pers'), ligne('i2', 'o2', 'Gâteau Aubart'),
    ligne('i3', 'o3', 'Tarte Blancke'), ligne('i4', 'o4', 'Gâteau Belletoise'));
  const page = await preparePage(ctx, { db });
  await gotoApp(page);
  await enterBoutique(page, 'livreur');
  await page.evaluate(() => setVue('ma_journee'));
  await page.waitForTimeout(600);
  return page;
}

export const tests = [
  {
    name: 'Ma journée — la commande Tours faite à Veigné est détaillée (nom, contenu, heure, où la prendre)',
    fn: async (ctx) => {
      const page = await maJournee(ctx);
      const t = await page.evaluate(() => document.getElementById('main-content').textContent);
      assert(/LIBAULT[\s\S]*10h[\s\S]*Royal 6 pers[\s\S]*prendre à Veigné/.test(t), 'LIBAULT détaillé : ' + t.slice(0, 400));
      assert(t.indexOf('Blancke') === -1, 'une commande faite sur place n\'est pas à livrer');
      await page.close();
    },
  },
  {
    name: 'Ma journée — les commandes St-Avertin faites au Local apparaissent aussi',
    fn: async (ctx) => {
      const page = await maJournee(ctx);
      const r = await page.evaluate(() => ({
        sa: (maJourneeTransferts['saint-avertin'] || []).map((x) => x.nom),
        t: document.getElementById('main-content').textContent,
      }));
      assert(JSON.stringify(r.sa) === '["AUBART"]', 'St-Av : ' + r.sa.join(', ') + ' (Belletoise déjà remise = exclue)');
      assert(/AUBART[\s\S]*charger au Local/.test(r.t), 'AUBART affichée avec « charger au Local »');
      await page.close();
    },
  },
];
