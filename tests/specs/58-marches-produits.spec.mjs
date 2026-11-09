/* ============================================================
   v20.341 — Produits des marchés (Phil, 09/11/2026) : « une coche pour choisir quel produit
   figure dans les marchés d'Amboise et Beaujardin ».
   products.marches = liste des marchés où le produit figure. Le Tableau marché n'affiche que
   les produits cochés pour le marché affiché, plus tout produit qui a un chiffre ce jour-là.
   Aucun produit coché pour un marché = tous les produits (comme avant).
   ⚙️ Choisir les produits (code maître) : une case par produit, enregistrée à chaque tap.
   Base factice, rien vers Supabase. Horloge : mercredi 22/07/2026 10h00.
   ============================================================ */
import { preparePage, gotoApp, enterBoutique, assert } from '../helpers/harness.mjs';
import { makeDB, TENANT_ID } from '../helpers/fixtures.mjs';
const T = TENANT_ID;

function dbMarches() {
  const d = makeDB();
  d.products.find((p) => p.id === 'vt_trad').marches = ['amboise'];
  d.products.find((p) => p.id === 'vp_croissant').marches = ['amboise', 'beaujardin'];
  d.market_entries = [];
  return d;
}
async function tableau(ctx, marche, d) {
  const page = await preparePage(ctx, { db: d || dbMarches() });
  await gotoApp(page); await enterBoutique(page, marche);
  await page.evaluate(() => setVue('marche'));
  await page.waitForTimeout(500);
  // le tableau s'ouvre sur le PROCHAIN jour de marché : la Fougasse a un chiffre ce jour-là (activité → visible même non cochée)
  await page.evaluate(async () => {
    window.__mockDB.market_entries.push({ tenant_id: '00000000-0000-0000-0000-000000000001', market_id: 'amboise', service_date: currentMarketDate, product_id: 'vt_fou', marche: '4', commande: '', commande_tranchee: '', pertes: '', product_notes: '' });
    await loadMarketEntries(currentMarketId, currentMarketDate);
    marketFilterEmpty = false; renderMarket();
  });
  return page;
}
const visibles = (page) => page.evaluate(() => Array.from(document.querySelectorAll('input[data-field="marche"]')).map((i) => i.dataset.pid).sort());

export const tests = [
  {
    name: 'Marché Amboise — seuls les produits cochés s\'affichent, plus la Fougasse qui a un chiffre du jour',
    fn: async (ctx) => {
      const page = await tableau(ctx, 'amboise');
      const v = await visibles(page);
      assert(v.join(',') === 'vp_croissant,vt_fou,vt_trad', 'visibles : ' + v.join(','));
      const etat = await page.evaluate(() => document.querySelector('.market-choix-etat').textContent);
      assert(/3 produits sur ce marché/.test(etat), 'état : ' + etat);
      await page.close();
    },
  },
  {
    name: 'Marché Beaujardin — sa propre liste (Croissant seul) ; sans aucune coche → tous les produits comme avant',
    fn: async (ctx) => {
      const page = await tableau(ctx, 'beaujardin');
      assert((await visibles(page)).join(',') === 'vp_croissant', 'Beaujardin : ' + (await visibles(page)).join(','));
      await page.close();
      const page2 = await tableau(ctx, 'beaujardin', makeDB());
      const all = await page2.evaluate(() => products.length);
      const v2 = await visibles(page2);
      assert(v2.length === all && /liste pas réglée/.test(await page2.evaluate(() => document.querySelector('.market-choix-etat').textContent)), 'sans liste : ' + v2.length + ' / ' + all);
      await page2.close();
    },
  },
  {
    name: 'Marché — ⚙️ Choisir les produits : une case par produit, un tap enregistre products.marches, le tableau suit',
    fn: async (ctx) => {
      const page = await tableau(ctx, 'amboise');
      await page.evaluate(() => { marketChoixMode = true; renderMarket(); });
      const r = await page.evaluate(() => ({
        nb: document.querySelectorAll('.market-choix-row input').length, all: products.length,
        coches: Array.from(document.querySelectorAll('.market-choix-row input')).filter((i) => i.checked).length,
        n: document.getElementById('market-choix-n').textContent,
      }));
      assert(r.nb === r.all && r.coches === 2 && r.n === '2', JSON.stringify(r));
      await page.evaluate(async () => { await marketChoixToggle('vp_painchoc', true); await marketChoixToggle('vt_trad', false); });
      const db = await page.evaluate(() => ({ pc: window.__mockDB.products.find((p) => p.id === 'vp_painchoc').marches, tr: window.__mockDB.products.find((p) => p.id === 'vt_trad').marches, n: document.getElementById('market-choix-n').textContent }));
      assert(db.pc.join() === 'amboise' && db.tr.join() === '' && db.n === '2', 'enregistré : ' + JSON.stringify(db));
      await page.evaluate(() => { marketChoixMode = false; renderMarket(); });
      const v = await visibles(page);
      assert(v.join(',') === 'vp_croissant,vp_painchoc,vt_fou', 'après réglage : ' + v.join(','));
      // Beaujardin pas touché par le réglage d'Amboise
      const cro = await page.evaluate(() => window.__mockDB.products.find((p) => p.id === 'vp_croissant').marches);
      assert(cro.join() === 'amboise,beaujardin', 'Croissant : ' + cro.join());
      await page.close();
    },
  },
];
