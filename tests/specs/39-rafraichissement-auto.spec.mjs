/* ============================================================
   v20.276 — Rafraîchissement automatique (Phil, 13/10/2026, approche 1 validée).
   · nouvelle version en ligne (après 2 min sans toucher l'écran) ou 15 min d'inactivité → rechargement
   · jamais pendant une fenêtre ouverte / une saisie en cours
   · après rechargement : retour sur la même boutique et le même onglet (sessionStorage lbdd_resume)
   Base factice, rien vers Supabase.
   ============================================================ */
import { preparePage, gotoApp, enterBoutique, assert } from '../helpers/harness.mjs';

export const tests = [
  {
    name: 'Rafraîchissement auto — règle de décision : version + 2 min, 15 min d\'inactivité, jamais si occupé ; écran normal = pas occupé, fenêtre ouverte = occupé',
    fn: async (ctx) => {
      const page = await preparePage(ctx);
      await gotoApp(page);
      await enterBoutique(page, 'tours');
      const r = await page.evaluate(() => {
        const M = 60 * 1000;
        return {
          busyNormal: autoRefreshBusy(),
          d1: autoRefreshDecide({ newVersion: true, idleMs: 3 * M, ageMs: 1 * M, busy: false }),
          d2: autoRefreshDecide({ newVersion: true, idleMs: 1 * M, ageMs: 1 * M, busy: false }),
          d3: autoRefreshDecide({ newVersion: false, idleMs: 16 * M, ageMs: 16 * M, busy: false }),
          d4: autoRefreshDecide({ newVersion: false, idleMs: 16 * M, ageMs: 2 * M, busy: false }),
          d5: autoRefreshDecide({ newVersion: true, idleMs: 30 * M, ageMs: 30 * M, busy: true }),
          d6: autoRefreshDecide({ newVersion: false, idleMs: 5 * M, ageMs: 30 * M, busy: false }),
          resumeKey: sessionStorage.getItem('lbdd_resume'),
        };
      });
      assert(r.busyNormal === false, 'écran Tours normal : pas occupé');
      assert(r.d1 === true && r.d2 === false, 'nouvelle version : oui après 2 min sans toucher, non avant');
      assert(r.d3 === true && r.d4 === false, '15 min sans toucher : oui, sauf si la page vient d\'être chargée');
      assert(r.d5 === false && r.d6 === false, 'jamais si occupé ; rien si actif');
      assert(r.resumeKey === null, 'pas de reprise mémorisée tant qu\'on ne recharge pas');
      // pavé numérique ouvert = occupé ; refermé = libre
      const busy = await page.evaluate(() => { document.getElementById('np-overlay').classList.add('show'); const a = autoRefreshBusy(); document.getElementById('np-overlay').classList.remove('show'); return [a, autoRefreshBusy()]; });
      assert(busy[0] === true && busy[1] === false, 'pavé numérique ouvert = occupé, refermé = libre : ' + busy);
      await page.close();
    },
  },
  {
    name: 'Rafraîchissement auto — après rechargement, l\'app revient sur Tours / onglet Ventes sans redemander le code',
    fn: async (ctx) => {
      const page = await preparePage(ctx);
      await page.addInitScript(() => {
        try { localStorage.setItem('boutiqueUnlocked', 'tours'); sessionStorage.setItem('lbdd_resume', JSON.stringify({ b: 'tours', v: 'ventes', t: Date.now() })); } catch (e) {}
      });
      // pas gotoApp : la reprise cache le splash avant même qu'on ait pu le voir
      await page.goto('http://127.0.0.1:8787/index-cloud-test.html');
      await page.waitForFunction(() => typeof currentBoutique !== 'undefined' && currentBoutique === 'tours' && currentVue === 'ventes', null, { timeout: 5000 });
      const r = await page.evaluate(() => ({ b: currentBoutique, v: currentVue, app: document.getElementById('app').style.display, left: sessionStorage.getItem('lbdd_resume') }));
      assert(r.b === 'tours' && r.v === 'ventes' && r.app === 'flex', 'reprise sur Tours / Ventes : ' + JSON.stringify(r));
      assert(r.left === null, 'la reprise ne sert qu\'une fois');
      await page.close();
    },
  },
  {
    name: 'Rafraîchissement auto — une reprise trop vieille (plus de 5 min) ou vers le BackOffice est ignorée : on reste à l\'accueil',
    fn: async (ctx) => {
      const page = await preparePage(ctx);
      await page.addInitScript(() => {
        try { localStorage.setItem('boutiqueUnlocked', 'tours'); sessionStorage.setItem('lbdd_resume', JSON.stringify({ b: 'tours', v: 'ventes', t: Date.now() - 10 * 60 * 1000 })); } catch (e) {}
      });
      await gotoApp(page);
      await page.waitForTimeout(400);
      const r = await page.evaluate(() => ({ b: currentBoutique, left: sessionStorage.getItem('lbdd_resume') }));
      assert(r.b === null && r.left === null, 'trop vieille : accueil, clé effacée : ' + JSON.stringify(r));
      await page.close();
    },
  },
];
