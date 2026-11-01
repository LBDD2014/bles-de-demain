/* ============================================================
   v20.335 — Écrans Stock refaits (Phil, 01/11/2026, maquette stock-congelo-mockup.html) :
   · ＋ mettre au congélo : ajoute au stock ET à la production du mois, ↩️ Annuler
   · Reste à faire = prévision du mois − production ; réglages sans code (appui long / ⚙️)
   · 📋 Compter le congélo : le stock prend le chiffre compté, l'écart est gardé
   · Prod. Touriers : ❄️ du congélo (le stock baisse, en caisses à virgule) / 🥐 plaqué frais (compté en production)
   · Boul. Pro : le stock baisse quand le livreur coche la livraison (remonte s'il décoche)
   · Stock Pât. : le stock baisse à l'envoi de la boutique, « ✓ préparé » ne retire pas une 2e fois
   Base factice, rien vers Supabase. Horloge : mercredi 22/07/2026 10h00.
   ============================================================ */
import { preparePage, gotoApp, enterBoutique, assert } from '../helpers/harness.mjs';
import { makeDB, TENANT_ID, TEST_TODAY } from '../helpers/fixtures.mjs';
const T = TENANT_ID;

function dbStock() {
  const d = makeDB();
  // fiche réassort « Croissant » (caisse de 77) au congélo tourier ; la fiche vente vp_croissant porte le même nom
  d.products.push({ id: 'cro_reap', tenant_id: T, name: 'Croissant', category: 'viennoiserie', actif: true, usage: 'reappro',
    conditioning_unit: 'caisse', conditioning_qty: 77, conso_mois_manuel: 60, supply_by_boutique: null });
  d.tourier_stock = [{ tenant_id: T, product_id: 'cro_reap', stock: 10, mini: 4 }];
  d.stock_entries = [];
  d.stock_comptages = [];
  d.production_done = [];
  return d;
}
async function ecran(ctx, site, vue, d) {
  const page = await preparePage(ctx, { db: d || dbStock() });
  await gotoApp(page); await enterBoutique(page, site);
  await page.evaluate((v) => setVue(v), vue);
  await page.waitForTimeout(500);
  return page;
}
const mock = (page, t) => page.evaluate((t) => window.__mockDB[t], t);
const txt = (page, sel) => page.evaluate((sel) => Array.from(document.querySelectorAll(sel)).map((x) => x.textContent.replace(/\s+/g, ' ').trim()), sel);

export const tests = [
  {
    name: 'Stock Tourier — grille Produit / Stock / ＋ / Reste à faire ; ＋ 2 caisses = stock 12 et « 58 à faire » ; ↩️ Annuler remet 10',
    fn: async (ctx) => {
      const page = await ecran(ctx, 'local', 'stock_tour');
      const r0 = await txt(page, '.sg-row');
      assert(r0.length === 1 && /Croissant/.test(r0[0]) && /caisse de 77/.test(r0[0]) && /10 ?caisses/.test(r0[0]) && /60 à faire/.test(r0[0]), 'ligne : ' + r0[0]);
      assert((await txt(page, '.sg-head > span')).join('|') === 'Produit|Stock|Mis au congélo|Reste à faire ce mois', 'en-tête');
      assert((await page.evaluate(() => document.querySelectorAll('.stock-row select').length)) === 0, 'plus de menus Entrée / Stock / Mini');
      await page.evaluate(() => openStockPad('cro_reap'));
      const touches = await txt(page, '#sg-sheet .sg-pad button');
      assert(touches[0] === '1caisse' && touches[1] === '2caisses' && touches[touches.length - 1] === '…Autre', 'touches en caisses : ' + touches.join(' '));
      await page.evaluate(async () => { await stockPadAdd('cro_reap', 2); });
      const st = (await mock(page, 'tourier_stock'))[0].stock;
      const en = await mock(page, 'stock_entries');
      const row = (await txt(page, '.sg-row'))[0];
      assert(st === 12 && en.length === 1 && en[0].qty === 2 && en[0].screen === 'tourier', 'stock + production : ' + st + ' ' + JSON.stringify(en));
      assert(/\+2 aujourd'hui/.test(row) && /58 à faire/.test(row) && /2 \/ 60 ce mois/.test(row), 'ligne après ＋ : ' + row);
      assert(/✓ \+2 Croissant au congélo/.test((await txt(page, '#sg-toast'))[0]), 'bandeau avec ↩️ Annuler');
      await page.evaluate(async () => { await stockPadUndo(); });
      const st2 = (await mock(page, 'tourier_stock'))[0].stock;
      const sum = (await mock(page, 'stock_entries')).reduce((s, e) => s + e.qty, 0);
      assert(st2 === 10 && sum === 0, 'annulé : stock ' + st2 + ', production ' + sum);
      await page.close();
    },
  },
  {
    name: 'v20.336 — Semaine = ce qu\'il faut pour tenir 7 jours + Mini, stock déduit ; stock suffisant = « ✓ rien d\'urgent » (le mois reste rappelé)',
    fn: async (ctx) => {
      const page = await ecran(ctx, 'local', 'stock_tour');
      await page.evaluate(() => setStockPeriodMode('semaine'));
      // 60 caisses / mois → 13,8 sur 7 jours + Mini 4 − stock 10 = 7,8 → 8
      let row = (await txt(page, '.sg-row'))[0];
      assert(/8 à faire/.test(row) && /pour tenir 7 jours \+ Mini/.test(row) && /60 d'ici fin juil/.test(row), 'stock court : ' + row);
      assert((await txt(page, '.sg-head > span'))[3] === 'Reste à faire cette semaine', 'en-tête semaine');
      await page.evaluate(() => { tourierStockData.cro_reap.stock = 30; renderStock(); });
      row = (await txt(page, '.sg-row'))[0];
      assert(/✓ rien d'urgent/.test(row) && /60 d'ici fin juil/.test(row) && /tient la semaine/.test(row) && !/à faire/.test(row.replace(/d'ici/, '')), 'stock suffisant : ' + row);
      await page.evaluate(() => setStockPeriodMode('mois'));
      row = (await txt(page, '.sg-row'))[0];
      assert(/60 à faire/.test(row) && /0 \/ 60 ce mois/.test(row), 'le mois ne change pas : ' + row);
      await page.close();
    },
  },
  {
    name: 'Réglages sans code — prévision +1, pièces par caisse 78, Mini +1 : enregistrés pour tout le monde',
    fn: async (ctx) => {
      const page = await ecran(ctx, 'local', 'stock_tour');
      await page.evaluate(async () => { openStockReglages('cro_reap'); await stockRegle('prev', 1); await stockRegleSave('cond', 78); await stockRegle('mini', 1); });
      const p = (await mock(page, 'products')).find((x) => x.id === 'cro_reap');
      const s = (await mock(page, 'tourier_stock'))[0];
      assert(p.conso_mois_manuel === 61 && p.conditioning_qty === 78 && s.mini === 5, 'enregistré : ' + JSON.stringify({ c: p.conso_mois_manuel, q: p.conditioning_qty, m: s.mini }));
      const sheet = (await txt(page, '#sg-sheet .sg-sheet'))[0];
      assert(/61 \/ mois/.test(sheet) && /caisse de 78/.test(sheet) && /servent aussi aux commandes/.test(sheet) && /✓ Enregistré/.test(sheet), 'fenêtre : ' + sheet);
      await page.close();
    },
  },
  {
    name: '📋 Compter le congélo — compté 9 au lieu de 10 : le stock passe à 9, l\'écart −1 est gardé',
    fn: async (ctx) => {
      const page = await ecran(ctx, 'local', 'stock_tour');
      await page.evaluate(() => openStockComptage());
      await page.fill('#sg-sheet .sg-crow input[data-pid="cro_reap"]', '9');
      const ec = (await txt(page, '#sg-sheet .sg-ec'))[0];
      assert(ec === '−1', 'écart affiché : ' + ec);
      await page.evaluate(async () => { await stockComptageValider(); });
      const s = (await mock(page, 'tourier_stock'))[0].stock;
      const c = await mock(page, 'stock_comptages');
      assert(s === 9 && c.length === 1 && c[0].qty_app === 10 && c[0].qty_compte === 9 && c[0].ecart === -1 && c[0].screen === 'tourier', 'comptage : ' + s + ' ' + JSON.stringify(c));
      await page.close();
    },
  },
  {
    name: 'Prod. Touriers — 🥐 plaqué frais : le congélo ne bouge pas, 1 caisse comptée en production ; ❄️ : 154 croissants = −2 caisses ; décocher défait',
    fn: async (ctx) => {
      const page = await ecran(ctx, 'local', 'prod_tour');
      const sumFrais = async () => (await mock(page, 'stock_entries')).filter((e) => e.screen === 'tourier_frais').reduce((s, e) => s + e.qty, 0);
      const stock = async () => (await mock(page, 'tourier_stock'))[0].stock;
      const chip = await page.evaluate(() => congeloModeHtml('vp_croissant', 80));
      assert(/❄️ du congélo/.test(chip), 'bouton ❄️ par défaut : ' + chip);
      await page.evaluate(async () => { await toggleCongeloMode('vp_croissant'); });
      assert(/🥐 plaqué frais/.test(await page.evaluate(() => congeloModeHtml('vp_croissant', 80))), 'passe en 🥐');
      await page.evaluate(async () => { await toggleProductionDone('vp_croissant', 77); });
      assert((await stock()) === 10 && (await sumFrais()) === 1, '🥐 : stock ' + (await stock()) + ', frais ' + (await sumFrais()));
      await page.evaluate(async () => { await toggleProductionDone('vp_croissant', 77); });   // décoche
      assert((await stock()) === 10 && (await sumFrais()) === 0, 'décoché : frais ' + (await sumFrais()));
      await page.evaluate(async () => { await toggleCongeloMode('vp_croissant'); await toggleProductionDone('vp_croissant', 154); });
      assert((await stock()) === 8 && (await sumFrais()) === 0, '❄️ : stock ' + (await stock()));
      // changer d'avis après coup : ❄️ → 🥐 rend les 2 caisses et compte 2 en production
      await page.evaluate(async () => { await toggleCongeloMode('vp_croissant'); });
      assert((await stock()) === 10 && (await sumFrais()) === 2, 'changé en 🥐 : stock ' + (await stock()) + ', frais ' + (await sumFrais()));
      await page.close();
    },
  },
  {
    name: 'Boul. Pro — le livreur coche la livraison : −30 Tradition au stock pro ; il décoche : +30',
    fn: async (ctx) => {
      const d = dbStock();
      d.products.find((p) => p.id === 'vt_trad').suivi_stock_pro = true;
      d.pro_stock = [{ tenant_id: T, product_id: 'vt_trad', qty: 100, mini: null }];
      d.pros = [{ id: 'bondici', tenant_id: T, nom: "BON D'ICI", actif: true, boutique_principale: 'local', contacts: [], jours_livraison: {}, catalogue_restreint: null, prix_speciaux: {}, template_items: [], sources_par_categorie: {} }];
      d.pro_orders = [{ id: 'o1', tenant_id: T, pro_id: 'bondici', date_livraison: TEST_TODAY, boutique_source: 'local', statut: 'confirme', created_by: 'local' }];
      d.pro_order_items = [{ id: 'i1', pro_order_id: 'o1', product_id: 'vt_trad', qty: 30 }];
      const page = await preparePage(ctx, { db: d });
      await gotoApp(page); await enterBoutique(page, 'livreur');
      await page.evaluate(async () => { await loadAdminPros(); await loadLivreurProOrders(currentDate); });
      await page.evaluate(async () => { await markProOrderDelivered('o1', 'confirme'); });
      assert((await mock(page, 'pro_stock'))[0].qty === 70, 'livrée : ' + (await mock(page, 'pro_stock'))[0].qty);
      await page.evaluate(async () => { await markProOrderDelivered('o1', 'confirme'); });   // rejouée : pas deux fois
      assert((await mock(page, 'pro_stock'))[0].qty === 70, 'pas retiré deux fois');
      await page.evaluate(async () => { await markProOrderDelivered('o1', 'livre'); });
      assert((await mock(page, 'pro_stock'))[0].qty === 100, 'décochée : ' + (await mock(page, 'pro_stock'))[0].qty);
      await page.close();
    },
  },
  {
    name: 'Stock Pât. — Tours envoie 3 éclairs : −3 au stock du pâtissier ; renvoyée à 4 : −1 de plus ; « ✓ préparé » ne retire rien de plus',
    fn: async (ctx) => {
      const d = dbStock();
      d.veigne_pat_stock = [{ tenant_id: T, product_id: 'pat_eclair', stock: 10, stock_unit: 'piece', unit_pieces: 1, mini: null, actif: true }];
      d.reappros = [];
      const page = await preparePage(ctx, { db: d });
      await gotoApp(page); await enterBoutique(page, 'tours');
      const envoie = (q) => page.evaluate(async (q) => { reapprosData['pat_eclair'] = { avoir: '', commander: String(q), previs: '', sent_at: null }; await sendReapproToSupplier('veigne'); }, q);
      const stock = async () => (await mock(page, 'veigne_pat_stock'))[0].stock;
      await envoie(3);
      const rp = (await mock(page, 'reappros')).find((r) => r.product_id === 'pat_eclair');
      assert((await stock()) === 7 && rp && rp.stock_decompte_qty === 3, 'envoi : stock ' + (await stock()) + ' ' + JSON.stringify(rp));
      await envoie(4);
      assert((await stock()) === 6, 'renvoi à 4 : ' + (await stock()));
      await page.evaluate(async (date) => { veignePatDate = date; veignePatStockData = { pat_eclair: window.__mockDB.veigne_pat_stock[0] }; await loadVeignePatReassort(); await applyVeignePatPrepared(veignePatReassort['tours']); }, await page.evaluate(() => currentReapproDate));
      assert((await stock()) === 6, 'préparé : rien de plus (' + (await stock()) + ')');
      await page.close();
    },
  },
];
