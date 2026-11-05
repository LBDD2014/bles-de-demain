/* ============================================================
   v20.339 — Le menu « caisse » des boutiques enregistre des CAISSES (Phil, 05/11/2026).

   Constat : Tours ou Veigné commande « 1 caisse (60 pces) » de Pain Suisse → l'app
   enregistrait 60 ; le congélo du Local, compté en caisses, retirait 60 caisses au
   « ✓ préparé » (stock à −50). Désormais, une fiche avec « pièces par caisse » ET un
   contenant (caisse / sac / grille) enregistre 0,5 / 1 / 2… comme le Croissant ;
   le « (N pces) » du menu vient de la fiche. Sans contenant (crêpes) : pièces, comme avant.
   Base factice, rien vers Supabase. Horloge : mercredi 22/07/2026 10h00.
   ============================================================ */
import { preparePage, gotoApp, enterBoutique, assert } from '../helpers/harness.mjs';
import { makeDB, TENANT_ID, TEST_TODAY, TEST_YESTERDAY } from '../helpers/fixtures.mjs';
const T = TENANT_ID;
const SUP = JSON.stringify({ veigne: 'local', tours: 'local', 'saint-avertin': 'local' });

function db() {
  const d = makeDB();
  d.products.push({ id: 'suisse_reap', tenant_id: T, name: 'Pain Suisse', category: 'viennoiserie', actif: true, usage: 'reappro',
    pces_per_caisse: 60, conditioning_unit: 'caisse', conditioning_qty: 60, supply_by_boutique: SUP });
  d.products.push({ id: 'mini_reap', tenant_id: T, name: 'Mini Croissant', category: 'viennoiserie', actif: true, usage: 'reappro',
    pces_per_caisse: 50, conditioning_unit: 'sac', conditioning_qty: 50, supply_by_boutique: SUP });
  d.products.push({ id: 'crepes_reap', tenant_id: T, name: 'Crêpes', category: 'viennoiserie', actif: true, usage: 'reappro',
    pces_per_caisse: 30, conditioning_unit: null, conditioning_qty: null, supply_by_boutique: SUP });
  d.tourier_stock = [{ tenant_id: T, product_id: 'suisse_reap', stock: 10, mini: 6 }];
  d.stock_entries = []; d.stock_comptages = []; d.production_done = [];
  return d;
}
async function ecran(ctx, site, vue, d) {
  const page = await preparePage(ctx, { db: d || db() });
  await gotoApp(page); await enterBoutique(page, site);
  await page.evaluate((v) => setVue(v), vue);
  await page.waitForTimeout(500);
  return page;
}
const options = (page, pid) => page.evaluate((pid) => Array.from(document.querySelectorAll('select.caisse-select[data-pid="' + pid + '"][data-field="commander"] option'))
  .map((o) => ({ val: o.value, lbl: o.textContent, sel: o.selected })), pid);

export const tests = [
  {
    name: 'Réassort Tours — « 1 caisse (60 pces) » de Pain Suisse enregistre 1, la demi-caisse 0,5 ; sac de 50 idem',
    fn: async (ctx) => {
      const page = await ecran(ctx, 'tours', 'reappro');
      const o = await options(page, 'suisse_reap');
      assert(o.length > 3, 'menu caisse attendu pour le Pain Suisse, trouvé ' + o.length + ' options');
      const demi = o.find((x) => x.val === '0.5'), une = o.find((x) => x.val === '1'), deux = o.find((x) => x.val === '2');
      assert(demi && /1\/2 caisse \(30 pces\)/.test(demi.lbl), 'demi-caisse : ' + JSON.stringify(demi));
      assert(une && /1 caisse \(60 pces\)/.test(une.lbl), 'caisse entière : ' + JSON.stringify(une));
      assert(deux && /2 caisses \(120 pces\)/.test(deux.lbl), '2 caisses : ' + JSON.stringify(deux));
      assert(!o.some((x) => x.val === '60'), 'plus aucune option « 60 » (pièces)');
      const m = await options(page, 'mini_reap');
      assert(m.some((x) => x.val === '1' && /1 sac \(50 pces\)/.test(x.lbl)) && m.some((x) => x.val === '2' && /2 sacs/.test(x.lbl)), 'sac de 50 : ' + JSON.stringify(m.slice(0, 4)));
      // choisir 1 caisse → commander = '1'
      await page.evaluate(() => { const s = document.querySelector('select.caisse-select[data-pid="suisse_reap"][data-field="commander"]'); s.value = '1'; handleReapproInput(s); });
      const cmd = await page.evaluate(() => reapprosData['suisse_reap'].commander);
      assert(cmd === '1', 'enregistré en caisses, trouvé ' + cmd);
      await page.close();
    },
  },
  {
    name: 'Réassort Tours — une fiche sans contenant (crêpes, 30 par caisse) reste en pièces : « 1 caisse (30 pces) » = 30',
    fn: async (ctx) => {
      const page = await ecran(ctx, 'tours', 'reappro');
      const o = await options(page, 'crepes_reap');
      assert(o.some((x) => x.val === '30' && /1 caisse \(30 pces\)/.test(x.lbl)) && o.some((x) => x.val === '15'), 'crêpes en pièces : ' + JSON.stringify(o.slice(0, 4)));
      await page.close();
    },
  },
  {
    name: 'Réassort Tours — une vieille valeur en pièces (60) se voit : « 60 caisses ⚠️ à vérifier », une valeur 1 est bien « 1 caisse »',
    fn: async (ctx) => {
      const d = db();
      d.reappros.push({ id: 'rp_old', tenant_id: T, boutique_id: 'tours', product_id: 'suisse_reap', service_date: TEST_TODAY, commander: '60', sent_at: null });
      d.reappros.push({ id: 'rp_new', tenant_id: T, boutique_id: 'tours', product_id: 'mini_reap', service_date: TEST_TODAY, commander: '1', sent_at: null });
      const page = await ecran(ctx, 'tours', 'reappro', d);
      const o = await options(page, 'suisse_reap');
      const sel = o.find((x) => x.sel);
      assert(sel && sel.val === '60' && /60 caisses ⚠️ à vérifier/.test(sel.lbl), 'vieille valeur signalée : ' + JSON.stringify(sel));
      const m = (await options(page, 'mini_reap')).find((x) => x.sel);
      assert(m && m.val === '1' && /1 sac \(50 pces\)/.test(m.lbl), 'valeur 1 = 1 sac : ' + JSON.stringify(m));
      await page.close();
    },
  },
  {
    name: 'Ventes Tours — fiche vendue ET commandée (Chausson, caisse de 80) : 1 caisse commandée hier → Matin pré-rempli 80 pièces, pas 1',
    fn: async (ctx) => {
      const d = db();
      d.products.push({ id: 'chausson_both', tenant_id: T, name: 'Chausson aux Pommes', category: 'viennoiserie', actif: true, usage: 'both',
        pces_per_caisse: 80, conditioning_unit: 'caisse', conditioning_qty: 80, supply_by_boutique: SUP });
      d.reappros.push({ id: 'rp_y', tenant_id: T, boutique_id: 'tours', product_id: 'chausson_both', service_date: TEST_YESTERDAY, commander: '1', sent_at: TEST_YESTERDAY + 'T06:00:00' });
      const page = await preparePage(ctx, { db: d });
      await gotoApp(page); await enterBoutique(page, 'tours');
      await page.evaluate(() => setVue('ventes'));
      await page.waitForFunction(() => { const m = document.getElementById('main-content'); return m && !m.querySelector('.loading') && salesData && Object.keys(salesData).length > 0; });
      const r = await page.evaluate(() => salesData['chausson_both']);
      assert(r && String(r.matin) === '80' && r.matin_auto === 80, 'Matin attendu 80, trouvé ' + JSON.stringify(r));
      await page.close();
    },
  },
  {
    name: 'Stock Tourier (Local) — « 1 caisse de 60 » à préparer pour Tours ; ✓ préparé retire 1 caisse (10 → 9), plus 60',
    fn: async (ctx) => {
      const d = db();
      d.reappros.push({ id: 'rp_t', tenant_id: T, boutique_id: 'tours', product_id: 'suisse_reap', service_date: TEST_TODAY, commander: '1', sent_at: TEST_TODAY + 'T06:00:00', prepared_at: null });
      const page = await ecran(ctx, 'local', 'stock_tour', d);
      const ligne = await page.evaluate(() => Array.from(document.querySelectorAll('.reappro-section .produit-row')).map((x) => x.textContent.replace(/\s+/g, ' ').trim()).join(' | '));
      assert(/Pain Suisse ❄️ ?1 caisse de 60/.test(ligne), 'ligne à préparer : ' + ligne);
      await page.evaluate(async () => { await prepareTourierLine('tours', 'suisse_reap'); });
      const st = await page.evaluate(() => window.__mockDB.tourier_stock[0].stock);
      assert(st === 9, 'stock après préparé : ' + st);
      await page.close();
    },
  },
];
