/* ============================================================
   v20.270 — Envoi partiel (Phil, 30/09/2026) : « le magasin demande 200,
   j'en envoie 150 : il faut que je sache combien j'ai envoyé et combien il
   reste, et que le magasin le sache aussi. »
   · bouton « partiel… » → pavé (prérempli avec le reste) + heure du reste (5h → 12h)
   · coche orange « 90 » + puce « 90 / 140 · reste 50 vers 10h30 » ; 2e envoi = cumul → ✓ verte « en 2 fois »
   · « Cacher ce qui est fait » ne cache pas les partiels
   · magasin : « 90 / 140 envoyés · reste 50 vers 10h30 » ; livreur : puce + quantité préremplie
   Maquette envoi-partiel-mockup.html validée. Date figée : mercredi 22 juillet 2026.
   ============================================================ */
import { preparePage, gotoApp, enterBoutique, assert } from '../helpers/harness.mjs';
import { makeDB, TENANT_ID } from '../helpers/fixtures.mjs';

const T = TENANT_ID;
const D = '2026-07-22';

function dbBase() {
  const db = makeDB();
  // Tours commande 140 croissants au Local (envoyé) ; Tours prévoit 30 traditions → ligne « À produire » à Tours
  db.reappros.push({ id: 'rp_t', tenant_id: T, boutique_id: 'tours', product_id: 'vp_croissant', service_date: D,
    commander: 140, sent_at: D + 'T05:00:00', qty_livree: null, livre_at: null });
  db.reappros.push({ id: 'rp_tp', tenant_id: T, boutique_id: 'tours', product_id: 'vt_trad', service_date: D, previs: 30, commander: null });
  db.previs.push({ tenant_id: T, boutique_id: 'tours', product_id: 'vt_trad', service_date: D, qty: 30 });
  db.sales.push({ tenant_id: T, boutique_id: 'tours', product_id: 'vt_trad', date: D, matin: 30 });
  db.production_done = [];
  return db;
}
const PARTIEL_LOCAL = { tenant_id: T, site: 'local', service_date: D, product_id: 'vp_croissant', done_at: null, qty_envoyee: 90, qty_total: 140, nb_envois: 1, reste_heure: '10:30' };

async function aProduireTours(ctx, db) {
  const page = await preparePage(ctx, { db: db || dbBase() });
  await gotoApp(page);
  await enterBoutique(page, 'tours');
  await page.evaluate(() => { productionFilterEmpty = false; return setVue('production'); });
  await page.waitForTimeout(600);
  return page;
}

export const tests = [
  {
    name: 'Envoi partiel — « partiel… » ouvre le pavé prérempli, 90 sur 30 demandés → coche orange, puce « reste », heure, compteur « en cours »',
    fn: async (ctx) => {
      const page = await aProduireTours(ctx);
      const r = await page.evaluate(async () => {
        const btn = document.querySelector('.prod-part-btn');
        const m = btn.getAttribute('onclick').match(/'([^']+)', *([\d.]+)/);
        const pid = m[1], total = +m[2];
        openEnvoiPartiel(pid, total);
        const pad = {
          visible: document.getElementById('np-overlay').classList.contains('show'),
          prerempli: document.getElementById('np-display').textContent,
          sub: document.querySelector('.ep-sub').textContent,
          heure: document.getElementById('ep-heure').value,
          heures: Array.from(document.querySelectorAll('#ep-heure option')).map((o) => o.value),
        };
        epClear(); epKey('2'); epKey('0');
        const hint = document.getElementById('ep-reste').textContent;
        document.getElementById('ep-heure').value = '10:30'; document.getElementById('ep-heure').dispatchEvent(new Event('change'));
        await epValidate(false);
        await new Promise((res) => setTimeout(res, 150));
        const row = window.__mockDB.production_done.find((x) => x.product_id === pid);
        const pr = document.querySelector('.prod-row.prod-part');
        return { pid, total, pad, hint,
          row: row && { done: !!row.done_at, q: row.qty_envoyee, t: row.qty_total, nb: row.nb_envois, h: row.reste_heure },
          padFerme: !document.getElementById('np-overlay').classList.contains('show'),
          rowPart: !!pr, chip: pr ? pr.querySelector('.prod-envoi').textContent : '', coche: pr ? pr.querySelector('.prod-done-btn').className + '|' + pr.querySelector('.prod-done-btn').textContent : '',
          partBtnRestant: pr ? pr.querySelectorAll('.prod-part-btn').length : -1,
          compteur: document.querySelector('.prod-done-count').textContent };
      });
      assert(r.pad.visible && r.pad.prerempli === String(r.total), `pavé ouvert, prérempli avec le reste (${r.total}) : ${JSON.stringify(r.pad)}`);
      assert(/Demandé 30 · déjà envoyé 0/.test(r.pad.sub), 'sous-titre « Demandé 30 · déjà envoyé 0 » : ' + r.pad.sub);
      assert(r.pad.heure === '10:00' && r.pad.heures[0] === '05:00' && r.pad.heures[r.pad.heures.length - 1] === '12:00' && r.pad.heures.length === 29, 'heure 10h00 par défaut, menu 5h → 12h par quart d\'heure : ' + r.pad.heures.length);
      assert(r.hint === 'reste 10 à envoyer', 'indication du reste pendant la saisie : ' + r.hint);
      assert(r.row && !r.row.done && r.row.q === 20 && r.row.t === 30 && r.row.nb === 1 && r.row.h === '10:30', 'enregistré partiel : ' + JSON.stringify(r.row));
      assert(r.padFerme && r.rowPart, 'pavé fermé, ligne en état partiel');
      assert(r.chip === '20 / 30 · reste 10 vers 10h30', 'puce : ' + r.chip);
      assert(/prod-done-btn part\|20$/.test(r.coche), 'coche orange avec la quantité : ' + r.coche);
      assert(r.partBtnRestant === 0, 'plus de bouton « partiel… » sur une ligne partielle (la coche rouvre le pavé)');
      assert(/✓ 0 \/ 1 lignes faites · 1 en cours/.test(r.compteur), 'compteur : ' + r.compteur);
      await page.close();
    },
  },
  {
    name: 'Envoi partiel — « Cacher ce qui est fait » garde les partiels ; 2e envoi « Tout est parti » = cumul, ✓ verte « en 2 fois » ; décocher remet à zéro',
    fn: async (ctx) => {
      const page = await aProduireTours(ctx);
      const r = await page.evaluate(async () => {
        const pid = document.querySelector('.prod-part-btn').getAttribute('onclick').match(/'([^']+)'/)[1];
        openEnvoiPartiel(pid, 30); epClear(); epKey('2'); epKey('0'); await epValidate(false);
        await new Promise((res) => setTimeout(res, 100));
        toggleProductionHideDone();
        const visibleEnCache = !!document.querySelector('.prod-row.prod-part');
        toggleProductionHideDone();
        // 2e envoi : la coche orange rouvre le pavé, déjà envoyé 20, prérempli 10
        document.querySelector('.prod-row.prod-part .prod-done-btn').click();
        const sub = document.querySelector('.ep-sub').textContent, pre = document.getElementById('np-display').textContent;
        const zero = !!document.querySelector('.ep-zero');
        await epValidate(true);
        await new Promise((res) => setTimeout(res, 100));
        const r1 = window.__mockDB.production_done.find((x) => x.product_id === pid);
        const row = r1 && { done: !!r1.done_at, q: r1.qty_envoyee, nb: r1.nb_envois, h: r1.reste_heure };   // photo AVANT la remise à zéro (la base factice modifie la ligne en place)
        const done = document.querySelector('.prod-row.prod-done');
        const chip = done ? done.querySelector('.prod-envoi').textContent : '';
        // décocher = remise à zéro
        await toggleProductionDone(pid, 30);
        await new Promise((res) => setTimeout(res, 100));
        const row2 = window.__mockDB.production_done.find((x) => x.product_id === pid);
        return { visibleEnCache, sub, pre, zero, row, chip,
          apres: row2 && { done: !!row2.done_at, q: row2.qty_envoyee, nb: row2.nb_envois }, partBtn: document.querySelectorAll('.prod-part-btn').length };
      });
      assert(r.visibleEnCache, 'une ligne partielle reste visible quand on cache ce qui est fait');
      assert(/déjà envoyé 20/.test(r.sub) && r.pre === '10' && r.zero, `2e ouverture : déjà envoyé 20, prérempli 10, bouton remise à zéro — ${r.sub} / ${r.pre} / ${r.zero}`);
      assert(r.row && r.row.done && r.row.q === 30 && r.row.nb === 2 && r.row.h === null, 'complet : ' + JSON.stringify(r.row));
      assert(r.chip === '✓ 30 / 30 · en 2 fois', 'puce verte « en 2 fois » : ' + r.chip);
      assert(r.apres && !r.apres.done && r.apres.q === null && r.apres.nb === 0 && r.partBtn === 1, 'décoché : tout remis à zéro, bouton « partiel… » de retour : ' + JSON.stringify(r.apres));
      await page.close();
    },
  },
  {
    name: 'Magasin — Tours voit « 90 / 140 envoyés · reste 50 vers 10h30 » sur son réassort ; livreur : puce + 90 prérempli',
    fn: async (ctx) => {
      const db = dbBase();
      db.production_done = [Object.assign({}, PARTIEL_LOCAL)];
      const page = await preparePage(ctx, { db });
      await gotoApp(page);
      await enterBoutique(page, 'tours');
      await page.evaluate(() => setVue('reappro'));
      await page.waitForTimeout(600);
      const shop = await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('.produit-row'));
        const cro = rows.find((x) => x.textContent.indexOf('Croissant') !== -1);
        const chip = cro && cro.querySelector('.prod-envoi');
        return { chip: chip ? chip.className + '|' + chip.textContent : '' };
      });
      assert(shop.chip === 'prod-envoi part|90 / 140 envoyés · reste 50 vers 10h30', 'puce magasin : ' + shop.chip);
      await enterBoutique(page, 'livreur');
      await page.evaluate(() => setVue('tournee'));
      await page.waitForTimeout(600);
      const lv = await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('.livreur-row'));
        const cro = rows.find((x) => x.textContent.indexOf('Croissant') !== -1);
        const chip = cro && cro.querySelector('.prod-envoi');
        return { chip: chip ? chip.textContent : '', val: cro ? cro.querySelector('.livreur-qty').value : '', pret: cro ? cro.querySelectorAll('.lv-pret').length : -1 };
      });
      assert(lv.chip === '90 / 140 · reste 50 vers 10h30' && lv.val === '90' && lv.pret === 0, 'livreur : ' + JSON.stringify(lv));
      await page.close();
    },
  },
];
