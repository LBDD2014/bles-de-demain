/* ============================================================
   v20.193 — Le message à écrire sur le gâteau doit être VISIBLE
   sans ouvrir la commande.

   Cas réel (Lebreton, 21/08/2026) : commande prise à St-Avertin,
   produite à Veigné, note « Joyeux anniversaire Isabelle ».
   Avant v20.193, la note n'existait que dans le formulaire d'édition
   et sur le ticket imprimé — le pâtissier ne la voyait jamais.
   ============================================================ */
import { preparePage, gotoApp, enterBoutique, assert } from '../helpers/harness.mjs';
import { makeDB, TENANT_ID, TEST_TODAY } from '../helpers/fixtures.mjs';

const NOTE_CMD = 'Joyeux anniversaire Isabelle';
const NOTE_ITEM = 'Ecriture en chocolat blanc';

/** Base avec une commande spéciale St-Avertin → produite à Veigné, avec les 2 notes. */
function dbAvecCommandeNotee() {
  const db = makeDB();
  db.special_orders.push({
    id: 'cmd-test-1',
    tenant_id: TENANT_ID,
    origin_shop: 'saint-avertin',
    production_shop: 'veigne',
    customer_name: 'Lebreton',
    customer_phone: null,
    paiement: 'non_regle',
    acompte_montant: null,
    pickup_date: TEST_TODAY,
    pickup_time: '10:00',
    delivery_type: 'pickup',
    status: 'nouvelle',
    notes: NOTE_CMD,
  });
  db.special_order_items.push({
    id: 'item-test-1',
    order_id: 'cmd-test-1',
    product_id: 'vt_trad',
    qty: 1,
    tranche: false,
    notes: NOTE_ITEM,
    product_name_custom: null,
  });
  return db;
}

export const tests = [
  {
    name: 'Spéciales — la note de commande est visible sur la carte, sans l\'ouvrir',
    fn: async (ctx) => {
      const page = await preparePage(ctx, { db: dbAvecCommandeNotee() });
      await gotoApp(page);
      await enterBoutique(page, 'saint-avertin');
      await page.evaluate(() => setVue('specials'));
      await page.waitForSelector('.sp-card');

      const txt = await page.textContent('#main-content');
      assert(txt.includes(NOTE_CMD),
        `la note de commande « ${NOTE_CMD} » devrait apparaître sur la carte`);
      assert(txt.includes(NOTE_ITEM),
        `la note du produit « ${NOTE_ITEM} » devrait apparaître sur la carte`);
      await page.close();
    },
  },
  {
    name: 'Spéciales — la boutique qui produit voit la note en lecture seule',
    fn: async (ctx) => {
      const page = await preparePage(ctx, { db: dbAvecCommandeNotee() });
      await gotoApp(page);
      // Veigné produit la commande prise à St-Avertin → section « À produire »
      await enterBoutique(page, 'veigne');
      await page.evaluate(() => setVue('specials'));
      await page.waitForSelector('.sp-card');

      const txt = await page.textContent('#main-content');
      assert(txt.includes(NOTE_CMD),
        'Veigné produit ce gâteau : elle doit lire le message à écrire dessus');
      await page.close();
    },
  },
  {
    name: 'À produire — le bloc « Spéciales du jour » affiche le message du gâteau',
    fn: async (ctx) => {
      const page = await preparePage(ctx, { db: dbAvecCommandeNotee() });
      await gotoApp(page);
      await enterBoutique(page, 'veigne');
      await page.evaluate(() => setVue('production'));
      await page.waitForSelector('.prod-specials-box');

      // Déplier le bloc. NB : on passe par la fonction et pas par un clic, car le
      // pop-up d'alerte des spéciales (v20.182) recouvre l'écran et intercepte les clics.
      await page.evaluate(() => {
        if (!document.querySelector('.prod-specials-body')) toggleProductionSpecials();
      });
      await page.waitForSelector('.prod-specials-body');

      const txt = await page.textContent('.prod-specials-box');
      assert(txt.includes(NOTE_CMD),
        `le pâtissier doit voir « ${NOTE_CMD} » sur son écran de production`);
      assert(txt.includes(NOTE_ITEM),
        `la consigne produit « ${NOTE_ITEM} » doit aussi être visible`);
      await page.close();
    },
  },
  {
    name: 'Spéciales — une commande sans note n\'affiche aucun bandeau vide',
    fn: async (ctx) => {
      const db = dbAvecCommandeNotee();
      db.special_orders[0].notes = null;
      db.special_order_items[0].notes = null;
      const page = await preparePage(ctx, { db });
      await gotoApp(page);
      await enterBoutique(page, 'saint-avertin');
      await page.evaluate(() => setVue('specials'));
      await page.waitForSelector('.sp-card');

      const nb = await page.evaluate(() => document.querySelectorAll('.sp-note').length);
      assert(nb === 0, `aucun bandeau de note attendu, ${nb} trouvé(s)`);
      await page.close();
    },
  },
];
