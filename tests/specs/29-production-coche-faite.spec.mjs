/* ============================================================
   v20.262 — Coche ✓ « ligne faite et partie » sur les écrans de production,
   et « ✓ prêt » côté livreur. (Phil, 28-29/09.)
   Date figée des tests : mercredi 22 juillet 2026.
   ============================================================ */
import { preparePage, gotoApp, enterBoutique, assert } from '../helpers/harness.mjs';
import { makeDB, TENANT_ID } from '../helpers/fixtures.mjs';

const T = TENANT_ID;
const D = '2026-07-22';

function dbAvecReassort() {
  const db = makeDB();
  // Tours commande 140 croissants au Local pour aujourd'hui (envoyé)
  db.reappros.push({ id: 'rp_t', tenant_id: T, boutique_id: 'tours', product_id: 'vp_croissant', service_date: D,
    commander: 140, sent_at: D + 'T05:00:00', qty_livree: null, livre_at: null });
  // Tours prévoit 30 traditions aujourd'hui → une ligne à faire dans son « À produire »
  db.reappros.push({ id: 'rp_tp', tenant_id: T, boutique_id: 'tours', product_id: 'vt_trad', service_date: D, previs: 30, commander: null });
  db.previs.push({ tenant_id: T, boutique_id: 'tours', product_id: 'vt_trad', service_date: D, qty: 30 });
  db.sales.push({ tenant_id: T, boutique_id: 'tours', product_id: 'vt_trad', date: D, matin: 30 });
  db.production_done = [];
  return db;
}

async function prodTouriers(ctx, db) {
  const page = await preparePage(ctx, { db: db || dbAvecReassort() });
  await gotoApp(page);
  await enterBoutique(page, 'tours');
  await page.evaluate(() => { productionFilterEmpty = false; return setVue('production'); });
  await page.waitForTimeout(600);
  return page;
}

export const tests = [
  {
    name: 'Production — chaque ligne à faire a sa coche ✓ ; cochée = verte, enregistrée par site/jour/produit',
    fn: async (ctx) => {
      const page = await prodTouriers(ctx);
      const r = await page.evaluate(async () => {
        const btns = document.querySelectorAll('.prod-done-btn').length;
        const pid = document.querySelector('.prod-done-btn').getAttribute('onclick').match(/'([^']+)'/)[1];
        await toggleProductionDone(pid);
        await new Promise((res) => setTimeout(res, 100));
        const row = window.__mockDB.production_done.find((x) => x.product_id === pid);
        return { btns, pid, row: row && { site: row.site, date: row.service_date, done: !!row.done_at },
          vert: document.querySelectorAll('.prod-row.prod-done').length, compteur: document.querySelector('.prod-done-count').textContent };
      });
      assert(r.btns > 0, 'des coches sur les lignes à faire');
      assert(r.row && r.row.site === 'tours' && r.row.date === '2026-07-22' && r.row.done, 'enregistré : ' + JSON.stringify(r.row));
      assert(r.vert === 1 && r.compteur.indexOf('✓ 1 /') === 0, 'ligne verte + compteur : ' + r.compteur);
      await page.close();
    },
  },
  {
    name: 'Production — décocher remet à zéro ; « Cacher ce qui est fait » masque les lignes cochées',
    fn: async (ctx) => {
      const page = await prodTouriers(ctx);
      const r = await page.evaluate(async () => {
        const pid = document.querySelector('.prod-done-btn').getAttribute('onclick').match(/'([^']+)'/)[1];
        const avant = document.querySelectorAll('.prod-row').length;
        await toggleProductionDone(pid);
        toggleProductionHideDone();
        const cache = document.querySelectorAll('.prod-row').length;
        toggleProductionHideDone();
        await toggleProductionDone(pid);
        await new Promise((res) => setTimeout(res, 100));
        const row = window.__mockDB.production_done.find((x) => x.product_id === pid);
        return { avant, cache, doneApres: row && row.done_at };
      });
      assert(r.cache === r.avant - 1, 'une ligne masquée : ' + r.avant + ' → ' + r.cache);
      assert(!r.doneApres, 'décochée : done_at vidé');
      await page.close();
    },
  },
  {
    name: 'Livreur — « ✓ prêt » sur le produit que le Local a coché',
    fn: async (ctx) => {
      const db = dbAvecReassort();
      db.production_done = [{ tenant_id: T, site: 'local', service_date: D, product_id: 'vp_croissant', done_at: D + 'T06:30:00' }];
      const page = await preparePage(ctx, { db });
      await gotoApp(page);
      await enterBoutique(page, 'livreur');
      await page.evaluate(() => setVue('tournee'));
      await page.waitForTimeout(600);
      const r = await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('.livreur-row'));
        const cro = rows.find((x) => x.textContent.indexOf('Croissant') !== -1);
        return { cro: cro ? cro.textContent : '', nbPret: document.querySelectorAll('.lv-pret').length };
      });
      assert(r.cro.indexOf('✓ prêt') !== -1, 'croissant prêt : ' + r.cro);
      await page.close();
    },
  },
];
