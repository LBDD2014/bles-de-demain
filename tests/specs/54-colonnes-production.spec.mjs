/* ============================================================
   v20.333 — Colonnes de la grille de production (les boulangers du Local, via Phil, 31/10 : « est-ce qu'on peut
   masquer certaines colonnes manuellement ? ») :
   · une colonne vide toute la journée, sans case à remplir, se cache toute seule
   · « ⚙️ Colonnes » : chaque tablette cache ce qu'elle veut (par écran), Produit / Total / ✓ jamais
   · garde-fou : une colonne cachée à la main qui porte un chiffre le dit sur le total (« 👁 … »)
   Base factice, rien vers Supabase. Horloge : mercredi 22/07/2026 10h00.
   ============================================================ */
import { preparePage, gotoApp, enterBoutique, assert } from '../helpers/harness.mjs';
import { makeDB, TENANT_ID, TEST_TODAY } from '../helpers/fixtures.mjs';

// une commande spéciale du jour (2 éclairs, faits à Veigné) : la colonne ⭐ Spé a un chiffre, 💼 Pros reste vide
async function prodVeigne(ctx) {
  const db = makeDB();
  db.special_orders = [{ id: 's1', tenant_id: TENANT_ID, origin_shop: 'veigne', production_shop: 'veigne', customer_name: 'Mme Éclair', pickup_date: TEST_TODAY, pickup_time: '10:00', status: 'confirmee', notes: null }];
  db.special_order_items = [{ id: 'i1', order_id: 's1', product_id: 'pat_eclair', qty: 2, notes: null, tranche: false, position: 0 }];
  const page = await preparePage(ctx, { db });
  await gotoApp(page); await enterBoutique(page, 'veigne');
  await page.evaluate(() => { localStorage.removeItem('lbdd_prod_cols_veigne_production'); setVue('production'); });
  await page.waitForSelector('.prod-filter-bar');
  await page.evaluate(() => { productionFilterEmpty = false; renderProduction(); });
  await page.waitForSelector('.prod-table-header');
  return page;
}
const visibles = (page) => page.evaluate(() => Array.from(document.querySelectorAll('.prod-table-header > *')).filter((x) => x.style.display !== 'none').map((x) => prodColLabel(x)));

export const tests = [
  {
    name: 'Colonnes vides — 💼 Pros à 0 partout se cache toute seule, ⭐ Spé (2 éclairs) reste ; Produit, Total, ✓ restent ; la grille garde le bon nombre de cases',
    fn: async (ctx) => {
      const page = await prodVeigne(ctx);
      const v = await visibles(page);
      const r = await page.evaluate(() => ({ info: prodColonnesInfo.map((c) => c.lbl + (c.auto ? ':auto' : '')),
        alignes: Array.from(document.querySelectorAll('.prod-row')).every((row) => row.style.gridTemplateColumns === document.querySelector('.prod-table-header').style.gridTemplateColumns) }));
      assert(r.info.indexOf('💼 Pros:auto') !== -1 && r.info.indexOf('⭐ Spé') !== -1, 'Pros vide = cachée toute seule, Spé gardée : ' + r.info.join('|'));
      assert(v[0] === 'Produit' && v.indexOf('Total') !== -1 && v[v.length - 1] === '✓' && v.indexOf('⭐ Spé') !== -1 && v.indexOf('💼 Pros') === -1, 'colonnes visibles : ' + v.join('|'));
      assert(r.alignes, 'en-tête et lignes ont la même grille');
      await page.close();
    },
  },
  {
    name: '⚙️ Colonnes — cacher « ⭐ Spé » sur cette tablette : la colonne disparaît, le total affiche « 👁 ⭐ Spé 2 » ; « Tout réafficher » la rend',
    fn: async (ctx) => {
      const page = await prodVeigne(ctx);
      await page.evaluate(() => openProdColonnes());
      const r = await page.evaluate(() => {
        const opts = Array.from(document.querySelectorAll('#prod-cols-host .prod-col-opt')).map((b) => b.textContent.replace(/\s+/g, ' ').trim());
        const k = prodColonnesInfo.findIndex((c) => c.lbl === '⭐ Spé');
        toggleProdColonne(k);
        const pastilles = Array.from(document.querySelectorAll('.prod-col-cache')).map((x) => x.textContent);
        const bouton = document.querySelector('.prod-cols-btn').textContent;
        const memo = localStorage.getItem('lbdd_prod_cols_veigne_production');
        return { opts, pastilles, bouton, memo, ouvert: !!document.getElementById('prod-cols-host') };
      });
      assert(r.opts.some((o) => /⭐ Spé/.test(o) && /visible/.test(o)) && r.opts.some((o) => /💼 Pros/.test(o) && /vide aujourd'hui/.test(o)), 'fenêtre : états des colonnes : ' + r.opts.join(' || '));
      assert((await visibles(page)).indexOf('⭐ Spé') === -1, 'Spé cachée');
      assert(r.pastilles.join('|') === '👁 ⭐ Spé 2', 'pastille sur le total de la ligne Éclair : ' + r.pastilles.join('|'));
      assert(/1 cachée/.test(r.bouton) && r.memo === '["⭐ Spé"]' && r.ouvert, 'bouton, réglage gardé sur la tablette, fenêtre toujours ouverte : ' + JSON.stringify(r));
      await page.evaluate(() => prodColonnesToutVoir());
      assert((await visibles(page)).indexOf('⭐ Spé') !== -1, 'Tout réafficher');
      await page.close();
    },
  },
];
