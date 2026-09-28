/* ============================================================
   v20.261 — « Courses à faire livrer à Veigné par le livreur » : même case que
   Tours au Récap courses (Le Local), vue par le livreur à son étape Veigné.
   Date figée des tests : mercredi 22 juillet 2026.
   ============================================================ */
import { preparePage, gotoApp, enterBoutique, assert } from '../helpers/harness.mjs';
import { makeDB } from '../helpers/fixtures.mjs';

export const tests = [
  {
    name: 'Metro — la case Veigné cochée par Phil allume « Courses Metro à livrer » à l\'étape Veigné du livreur',
    fn: async (ctx) => {
      const page = await preparePage(ctx, { db: makeDB() });
      await gotoApp(page);
      await enterBoutique(page, 'local');
      const r = await page.evaluate(async () => {
        livreurDayData = await loadLivreurDayRow(todayISO());
        await metroToggleLivreur('veigne');
        const row = window.__mockDB.livreur_day.find((x) => x.date === todayISO());
        return { veigne: row.metro_veigne, tours: row.metro_tours };
      });
      assert(r.veigne === true && r.tours === false, 'seule la case Veigné est cochée : ' + JSON.stringify(r));
      await page.close();
      const p2 = await preparePage(ctx, { db: (() => { const db = makeDB(); db.livreur_day = [{ tenant_id: '00000000-0000-0000-0000-000000000001', date: '2026-07-22', metro_tours: false, metro_veigne: true, extra_pros: [], done: {} }]; return db; })() });
      await gotoApp(p2);
      await enterBoutique(p2, 'livreur');
      await p2.evaluate(() => setVue('ma_journee'));
      await p2.waitForTimeout(500);
      const txt = await p2.evaluate(() => {
        const steps = Array.from(document.querySelectorAll('.mj-step'));
        const v = steps.find((s) => s.textContent.indexOf('8h15') !== -1 || (s.querySelector('.mj-place') && s.querySelector('.mj-place').textContent === 'Veigné' && s.textContent.indexOf('pâtisserie') === -1));
        const t = steps.find((s) => s.querySelector('.mj-place') && s.querySelector('.mj-place').textContent === 'Tours');
        return { v: v ? v.textContent : '', t: t ? t.textContent : '' };
      });
      assert(txt.v.indexOf('Courses Metro') !== -1, 'badge à l\'étape Veigné : ' + txt.v);
      assert(txt.t.indexOf('Courses Metro') === -1, 'rien à Tours');
      await p2.close();
    },
  },
];
