/* ============================================================
   v20.198 — Prod. Touriers : « Matin SA » et « SA » disaient la même chose.

   Deux colonnes pour un seul besoin (le prévis de St-Avertin d'un côté, son
   réappro de l'autre), et le Total les ADDITIONNAIT. La v20.20 avait déjà
   tranché chez les Boulangers ; les Touriers avaient été oubliés.

   Règle : on retient le plus grand des deux, jamais la somme — additionner
   ferait produire le double en silence, ce qui finit à la poubelle le soir.
   ============================================================ */
import { preparePage, gotoApp, enterBoutique, assert } from '../helpers/harness.mjs';
import { makeDB, TENANT_ID, TEST_TODAY } from '../helpers/fixtures.mjs';

const PROD = 'vp_croissant';
const NOM = 'Croissant';

/** previs = ce que St-Av a saisi dans Ventes ; reappro = ce qu'elle a commandé. */
function db({ previs, reappro }) {
  const d = makeDB();
  d.previs = d.previs.filter((r) => r.boutique_id !== 'saint-avertin');
  if (previs != null) {
    d.previs.push({ tenant_id: TENANT_ID, boutique_id: 'saint-avertin',
                    product_id: PROD, service_date: TEST_TODAY, qty: previs });
  }
  if (reappro != null) {
    d.reappros.push({ tenant_id: TENANT_ID, boutique_id: 'saint-avertin',
                      product_id: PROD, service_date: TEST_TODAY,
                      commander: reappro, avoir: null, previs: null });
  }
  return d;
}

async function ligne(ctx, data) {
  const page = await preparePage(ctx, { db: db(data) });
  await gotoApp(page);
  await enterBoutique(page, 'local');
  await page.evaluate(() => setVue('prod_tour'));
  await page.waitForSelector('.prod-table-header');
  const out = await page.evaluate((NOM) => {
    const head = Array.from(document.querySelectorAll('.prod-table-header > *')).map((e) => e.textContent.trim());
    const r = Array.from(document.querySelectorAll('.prod-row'))
      .find((x) => ((x.querySelector('.prod-name') || {}).textContent || '').trim() === NOM);
    if (!r) return { head, absent: true };
    const i = r.querySelector('.matin-sa-input');
    return {
      head,
      besoin: i ? i.value : null,
      total: r.querySelector('.cell.total').textContent.trim(),
      conflit: !!r.querySelector('.sa-conflit'),
      conflitTxt: r.querySelector('.sa-conflit') ? r.querySelector('.sa-conflit').textContent.trim() : null,
    };
  }, NOM);
  return { page, out };
}

export const tests = [
  {
    name: 'Prod. Touriers — la colonne « SA » en doublon a disparu',
    fn: async (ctx) => {
      const { page, out } = await ligne(ctx, { previs: 60 });
      const nbSA = out.head.filter((h) => h === 'SA').length;
      assert(nbSA === 0, `plus de colonne « SA » attendue — en-têtes : ${out.head.join(' | ')}`);
      await page.close();
    },
  },
  {
    name: 'Prod. Touriers — prévis seul : le besoin est le prévis',
    fn: async (ctx) => {
      const { page, out } = await ligne(ctx, { previs: 60 });
      assert(out.besoin === '60', `besoin 60 attendu, obtenu "${out.besoin}"`);
      assert(out.total === '60', `total 60 attendu, obtenu "${out.total}"`);
      assert(!out.conflit, 'aucune anomalie attendue');
      await page.close();
    },
  },
  {
    name: 'Prod. Touriers — réappro seul : le besoin ne disparaît pas du plan',
    fn: async (ctx) => {
      const { page, out } = await ligne(ctx, { reappro: 40 });
      assert(out.besoin === '40', `besoin 40 attendu, obtenu "${out.besoin}"`);
      assert(out.total === '40', `total 40 attendu, obtenu "${out.total}"`);
      await page.close();
    },
  },
  {
    name: 'Prod. Touriers — les deux remplis : on retient le max, PAS la somme',
    fn: async (ctx) => {
      const { page, out } = await ligne(ctx, { previs: 60, reappro: 40 });
      assert(out.besoin === '60', `max(60, 40) = 60 attendu, obtenu "${out.besoin}"`);
      assert(out.total === '60', `total 60 attendu (surtout pas 100), obtenu "${out.total}"`);
      await page.close();
    },
  },
  {
    name: 'Prod. Touriers — les deux remplis : l\'anomalie est signalée, pas masquée',
    fn: async (ctx) => {
      const { page, out } = await ligne(ctx, { previs: 60, reappro: 40 });
      assert(out.conflit, 'un marqueur ⚠️ devrait signaler la double saisie');
      assert(out.conflitTxt.includes('60') && out.conflitTxt.includes('40'),
        `le marqueur doit montrer les deux chiffres, obtenu "${out.conflitTxt}"`);
      await page.close();
    },
  },
];
