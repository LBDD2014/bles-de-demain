/* ============================================================
   v20.250 — 🔁 Répéter une commande client (clients réguliers).

   Besoin réel (Phil, 22/09) : « à Veigné une ficelle sans sel tous les jours ».
   On coche les jours + une durée, l'app crée une vraie commande par jour, toutes
   reliées par serie_id. « Arrêter la série » supprime les commandes à venir.

   Date figée des tests : mercredi 22 juillet 2026.
   ============================================================ */
import { preparePage, gotoApp, enterBoutique, assert } from '../helpers/harness.mjs';
import { makeDB, TENANT_ID } from '../helpers/fixtures.mjs';

const T = TENANT_ID;

function dbFicelle() {
  const db = makeDB();
  db.special_orders.push({
    id: 'ord_ficelle', tenant_id: T, origin_shop: 'veigne', production_shop: 'veigne',
    customer_name: 'Mme Ficelle', customer_phone: '0612345678', paiement: 'regle',
    pickup_date: '2026-07-22', pickup_time: '08:00', status: 'confirmee', notes: 'sans sel',
    taken_by: null, serie_id: null,
  });
  db.special_order_items.push({
    id: 'it_ficelle', order_id: 'ord_ficelle', product_id: 'vp_croissant',
    product_name_custom: null, qty: 2, unit_price: null, notes: null, tranche: false, position: 0,
  });
  return db;
}

async function ouvrir(ctx) {
  const page = await preparePage(ctx, { db: dbFicelle() });
  await gotoApp(page);
  await enterBoutique(page, 'veigne');
  await page.evaluate(() => setVue('specials'));
  await page.waitForTimeout(400);
  await page.evaluate(() => openEditSpecialOrder('ord_ficelle'));
  return page;
}

const serie = (page) => page.evaluate(() =>
  window.__mockDB.special_orders.filter((o) => o.serie_id === 'ord_ficelle')
    .map((o) => o.pickup_date).sort());

export const tests = [
  {
    name: 'Répéter — le bouton apparaît dans le formulaire d\'une commande',
    fn: async (ctx) => {
      const page = await ouvrir(ctx);
      const txt = await page.evaluate(() => document.getElementById('main-content').innerText);
      assert(txt.indexOf('Répéter cette commande') !== -1, 'bouton 🔁 Répéter attendu');
      await page.close();
    },
  },
  {
    name: 'Répéter — Lun→Sam sur 1 semaine = 6 commandes, dimanche sauté, contenu copié',
    fn: async (ctx) => {
      const page = await ouvrir(ctx);
      await page.evaluate(async () => {
        await openRepeatSpecialModal('ord_ficelle');
        repeatDraft.dows = [1, 2, 3, 4, 5, 6];
        setRepeatWeeks(1);
        await confirmRepeatSpecial();
      });
      const dates = await serie(page);
      const attendu = ['2026-07-22', '2026-07-23', '2026-07-24', '2026-07-25', '2026-07-27', '2026-07-28', '2026-07-29'];
      assert(JSON.stringify(dates) === JSON.stringify(attendu), `dates de la série : ${dates.join(', ')}`);
      const check = await page.evaluate(() => {
        const db = window.__mockDB;
        const o = db.special_orders.find((x) => x.pickup_date === '2026-07-24');
        const its = db.special_order_items.filter((i) => i.order_id === o.id);
        return { nom: o.customer_name, pay: o.paiement, notes: o.notes, n: its.length, pid: its[0] && its[0].product_id, qty: its[0] && its[0].qty };
      });
      assert(check.nom === 'Mme Ficelle' && check.notes === 'sans sel', 'client + note copiés');
      assert(check.pay === 'non_regle', 'paiement repart à « non réglé » : ' + check.pay);
      assert(check.n === 1 && check.pid === 'vp_croissant' && check.qty === 2, 'produits copiés : ' + JSON.stringify(check));
      await page.close();
    },
  },
  {
    name: 'Répéter — prolonger ne crée jamais deux fois le même jour',
    fn: async (ctx) => {
      const page = await ouvrir(ctx);
      await page.evaluate(async () => {
        await openRepeatSpecialModal('ord_ficelle');
        repeatDraft.dows = [1, 2, 3, 4, 5, 6];
        setRepeatWeeks(1);
        await confirmRepeatSpecial();
        openEditSpecialOrder('ord_ficelle');
        await openRepeatSpecialModal('ord_ficelle');
        setRepeatWeeks(1);
        await confirmRepeatSpecial();
      });
      const dates = await serie(page);
      const uniques = new Set(dates);
      assert(uniques.size === dates.length, 'doublon de date : ' + dates.join(', '));
      assert(dates[dates.length - 1] === '2026-08-05', 'la prolongation part de la dernière date : ' + dates.join(', '));
      await page.close();
    },
  },
  {
    name: 'Répéter — les fériés où la boutique est fermée sont sautés',
    fn: async (ctx) => {
      const page = await preparePage(ctx, { db: dbFicelle() });
      await gotoApp(page);
      const r = await page.evaluate(() => ({
        veigne: repeatSpecialDates('2026-12-30', 1, [0, 1, 2, 3, 4, 5, 6], 'veigne', {}),
        tours: repeatSpecialDates('2026-11-10', 1, [3], 'tours', {}),
      }));
      assert(r.veigne.dates.indexOf('2027-01-01') === -1, '1er janvier doit être sauté');
      assert(r.veigne.sautes.some((s) => s.iso === '2027-01-01'), '1er janvier listé comme sauté');
      assert(r.tours.dates.indexOf('2026-11-11') === -1, 'Tours fermé le 11 novembre');
      await page.close();
    },
  },
  {
    name: 'Arrêter la série — supprime les commandes à venir, garde aujourd\'hui',
    fn: async (ctx) => {
      const page = await ouvrir(ctx);
      await page.evaluate(async () => {
        await openRepeatSpecialModal('ord_ficelle');
        repeatDraft.dows = [1, 2, 3, 4, 5, 6];
        setRepeatWeeks(1);
        await confirmRepeatSpecial();
        window.confirm = () => true;
        await stopSpecialSerie('ord_ficelle');
      });
      const dates = await serie(page);
      assert(JSON.stringify(dates) === JSON.stringify(['2026-07-22']), 'seule la commande du jour reste : ' + dates.join(', '));
      const orphelins = await page.evaluate(() => {
        const ids = new Set(window.__mockDB.special_orders.map((o) => o.id));
        return window.__mockDB.special_order_items.filter((i) => !ids.has(i.order_id)).length;
      });
      assert(orphelins === 0, orphelins + ' ligne(s) produit orpheline(s)');
      await page.close();
    },
  },
  {
    name: 'Dès la prise de commande — « Commande régulière » crée la commande + la série',
    fn: async (ctx) => {
      const page = await preparePage(ctx, { db: dbFicelle() });
      await gotoApp(page);
      await enterBoutique(page, 'veigne');
      await page.evaluate(() => setVue('specials'));
      await page.waitForTimeout(400);
      const ids = await page.evaluate(async () => {
        openNewSpecialOrder();
        Object.assign(specialFormDraft, { customer_name: 'M. Régulier', customer_phone: '0600000000',
          pickup_date: '2026-07-23', taken_by: 'X' });
        specialFormDraft.items = [{ product_id: 'vp_croissant', product_name_custom: '', qty: '1', notes: '', category: 'viennoiserie', tranche: false }];
        toggleNewOrderRepeat();                 // jeudi pré-coché
        const txt = document.getElementById('main-content').textContent;
        toggleNewOrderRepeatDow(5);             // + vendredi
        setNewOrderRepeatWeeks(2);
        await upsertSpecialOrder();
        return { txt, rows: window.__mockDB.special_orders.filter((o) => o.customer_name === 'M. Régulier') };
      });
      assert(ids.txt.indexOf('Pendant combien de temps') !== -1, 'jours + durée affichés quand on coche');
      const dates = ids.rows.map((o) => o.pickup_date).sort();
      const attendu = ['2026-07-23', '2026-07-24', '2026-07-30', '2026-07-31', '2026-08-06'];
      assert(JSON.stringify(dates) === JSON.stringify(attendu), 'dates : ' + dates.join(', '));
      const orig = ids.rows.find((o) => o.pickup_date === '2026-07-23');
      assert(ids.rows.every((o) => o.serie_id === orig.id), 'toutes reliées à la 1re commande');
      const nbItems = await page.evaluate(() => window.__mockDB.special_order_items.filter((i) => i.product_id === 'vp_croissant').length);
      assert(nbItems === 6, '1 ligne produit par commande (5) + celle de la fixture : ' + nbItems);
      await page.close();
    },
  },
  {
    name: 'Dès la prise de commande — case non cochée = une seule commande, comme avant',
    fn: async (ctx) => {
      const page = await preparePage(ctx, { db: dbFicelle() });
      await gotoApp(page);
      await enterBoutique(page, 'veigne');
      await page.evaluate(() => setVue('specials'));
      await page.waitForTimeout(400);
      const n = await page.evaluate(async () => {
        openNewSpecialOrder();
        Object.assign(specialFormDraft, { customer_name: 'M. Unique', customer_phone: '0600000000',
          pickup_date: '2026-07-23', taken_by: 'X' });
        specialFormDraft.items = [{ product_id: 'vp_croissant', product_name_custom: '', qty: '1', notes: '', category: 'viennoiserie', tranche: false }];
        await upsertSpecialOrder();
        const rows = window.__mockDB.special_orders.filter((o) => o.customer_name === 'M. Unique');
        return { n: rows.length, serie: rows[0] && rows[0].serie_id };
      });
      assert(n.n === 1 && !n.serie, 'une seule commande sans série : ' + JSON.stringify(n));
      await page.close();
    },
  },
];
