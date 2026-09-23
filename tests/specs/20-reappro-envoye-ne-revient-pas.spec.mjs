/* ============================================================
   v20.253 — Une commande de réassort DÉJÀ ENVOYÉE ne revient plus toute seule.

   Besoin réel (Phil, 23/09, St-Avertin, Cmd Veigné Pât.) : en rouvrant l'écran
   la semaine suivante, la commande du même jour J-7 était recopiée en
   « brouillon » — un « Envoyer » la recommandait sans le vouloir.
   Règle : envoyé = remis à zéro. Pour la reprendre : ↩️ / 📅 sur demande.
   Un brouillon jamais envoyé continue, lui, d'être reproposé.
   ============================================================ */
import { preparePage, gotoApp, enterBoutique, assert } from '../helpers/harness.mjs';
import { makeDB, TENANT_ID } from '../helpers/fixtures.mjs';

const T = TENANT_ID;

async function ouvrirStAv(ctx, { envoye }) {
  const page = await preparePage(ctx, { db: makeDB() });
  await gotoApp(page);
  await enterBoutique(page, 'saint-avertin');
  await page.evaluate((envoye) => {
    const j7 = addDaysISO(currentReapproDate, -7);
    window.__mockDB.reappros.push({
      id: 'rp_j7', tenant_id: '00000000-0000-0000-0000-000000000001', boutique_id: 'saint-avertin',
      product_id: 'vp_croissant', service_date: j7, commander: '140', avoir: null,
      sent_at: envoye ? j7 + 'T06:00:00' : null,
    });
  }, envoye);
  await page.evaluate(() => setVue('reappro_local'));
  await page.waitForTimeout(500);
  return page;
}

export const tests = [
  {
    name: 'Réassort — une commande envoyée la semaine dernière ne revient pas toute seule',
    fn: async (ctx) => {
      const page = await ouvrirStAv(ctx, { envoye: true });
      const r = await page.evaluate(() => ({
        cmd: (reapprosData['vp_croissant'] || {}).commander || '',
        box: document.getElementById('main-content').textContent.indexOf('Comme la semaine dernière') !== -1,
      }));
      assert(r.cmd === '', 'écran vide attendu, trouvé commander=' + r.cmd);
      assert(r.box, 'boutons ↩️ / 📅 proposés sur l\'écran vide');
      await page.close();
    },
  },
  {
    name: 'Réassort — un brouillon jamais envoyé est toujours reproposé',
    fn: async (ctx) => {
      const page = await ouvrirStAv(ctx, { envoye: false });
      const cmd = await page.evaluate(() => (reapprosData['vp_croissant'] || {}).commander || '');
      assert(cmd === '140', 'brouillon J-7 repris, trouvé ' + cmd);
      await page.close();
    },
  },
  {
    name: 'Réassort — 📅 Comme la semaine dernière reprend la commande (en brouillon, non envoyée)',
    fn: async (ctx) => {
      const page = await ouvrirStAv(ctx, { envoye: true });
      const r = await page.evaluate(async () => {
        await copyReapproScreen('lastweek');
        const row = window.__mockDB.reappros.find((x) => x.boutique_id === 'saint-avertin'
          && x.product_id === 'vp_croissant' && x.service_date === currentReapproDate);
        return { cmd: (reapprosData['vp_croissant'] || {}).commander, sent: row && row.sent_at };
      });
      assert(String(r.cmd) === '140', 'reprise : ' + r.cmd);
      assert(!r.sent, 'rien n\'est envoyé tant qu\'on ne touche pas Envoyer');
      await page.close();
    },
  },
  {
    name: 'Réassort — ↩️ Comme la dernière fois retrouve la dernière date commandée',
    fn: async (ctx) => {
      const page = await ouvrirStAv(ctx, { envoye: true });
      const cmd = await page.evaluate(async () => {
        await copyReapproScreen('last');
        return (reapprosData['vp_croissant'] || {}).commander;
      });
      assert(String(cmd) === '140', 'reprise de la dernière fois : ' + cmd);
      await page.close();
    },
  },
];
