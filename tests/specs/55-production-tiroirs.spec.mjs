/* ============================================================
   v20.334 — Écran de production plus direct (Phil, 31/10/2026, maquette production-veigne-mockup.html) :
   · plus de fenêtre « X commandes spéciales à produire » à l'ouverture : le bandeau suffit
   · les blocs deviennent des tiroirs (un seul ouvert), pastille rouge « à lire », la grille juste après
   · 🎄 Noël à produire : les produits de la carte sans fiche du jour, dans l'écran de production
   Base factice, rien vers Supabase. Horloge : mercredi 22/07/2026 10h00.
   ============================================================ */
import { preparePage, gotoApp, enterBoutique, assert } from '../helpers/harness.mjs';
import { makeDB, TENANT_ID, TEST_TODAY } from '../helpers/fixtures.mjs';
const T = TENANT_ID;

function db(fete) {
  const d = makeDB();
  d.special_orders = [
    { id: 's1', tenant_id: T, origin_shop: fete ? 'saint-avertin' : 'veigne', production_shop: 'veigne', customer_name: 'Mme Éclair', customer_phone: '0600000000', pickup_date: TEST_TODAY, pickup_time: '10:00', status: 'confirmee', notes: 'Joyeux 90 ans', event_id: fete ? 'noel' : null, total: fete ? 35 : null },
  ];
  d.special_order_items = [
    { id: 'i1', order_id: 's1', product_id: 'pat_eclair', qty: 2, notes: null, tranche: false, position: 1 },
  ];
  if (fete) {
    d.fete_events = [{ id: 'noel', tenant_id: T, label: '🎄 Noël', actif: true, date_debut: '2026-07-20', date_fin: '2026-07-31', butoir: null }];
    d.fete_products = [{ id: 101, event_id: 'noel', groupe: 'BÛCHES', nom: 'Bûche Tourangelle', taille: 'Grande', prix: 35, prod_site: 'veigne', product_id: null, ordre: 10, actif: true }];
    d.fete_orders = [];
    d.special_order_items.push({ id: 'i0', order_id: 's1', fete_product_id: 101, product_id: null, product_name_custom: 'Bûche Tourangelle Grande', qty: 1, unit_price: 35, prod_site: 'veigne', tranche: false, notes: null, position: 0 });
  }
  return d;
}
async function prod(ctx, site, vue, d) {
  const page = await preparePage(ctx, { db: d });
  await gotoApp(page); await enterBoutique(page, site);
  await page.evaluate((v) => setVue(v), vue);
  await page.waitForSelector('.prod-filter-bar');
  await page.waitForTimeout(400);
  return page;
}

export const tests = [
  {
    name: 'Ouverture — pas de fenêtre « commandes à produire », le bandeau est là ; tiroirs fermés avant la grille, pastille rouge « à lire » sur les Spéciales',
    fn: async (ctx) => {
      const page = await prod(ctx, 'veigne', 'production', db(false));
      await page.evaluate(() => checkSpecialsProductionAlert()); await page.waitForTimeout(300);
      const r = await page.evaluate(() => {
        const mc = document.getElementById('main-content');
        const tir = mc.querySelector('.prod-tiroirs'), table = mc.querySelector('.prod-table, .prod-filter-bar');
        return { popup: !!document.getElementById('specials-popup'), bandeau: /commande spéciale à produire/.test(mc.textContent),
          tiroirs: tir ? Array.from(tir.children).map((t) => t.querySelector('.prod-specials-header').textContent.replace(/\s+/g, ' ').trim()) : null,
          ordre: tir && table ? !!(tir.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING) : null,
          rouge: tir ? tir.querySelector('.prod-tiroir.a-lire') !== null : null, ouvert: !!mc.querySelector('.prod-specials-body') };
      });
      assert(r.popup === false && r.bandeau, 'pas de fenêtre, le bandeau oui : ' + JSON.stringify(r));
      assert(r.tiroirs && /Spéciales du jour/.test(r.tiroirs[0]) && /✏️ 1 à lire/.test(r.tiroirs[0]), 'tiroir Spéciales avec pastille : ' + JSON.stringify(r.tiroirs));
      assert(r.ordre === true && r.rouge === true && r.ouvert === false, 'tiroirs fermés, avant la grille : ' + JSON.stringify(r));
      await page.close();
    },
  },
  {
    name: 'Tiroirs — un appui ouvre, un seul ouvert à la fois, un 2e appui referme',
    fn: async (ctx) => {
      const page = await prod(ctx, 'veigne', 'production', db(true));
      const r = await page.evaluate(() => {
        const ouverts = () => Array.from(document.querySelectorAll('.prod-tiroirs > .prod-tiroir.open')).map((t) => t.querySelector('.prod-specials-header').textContent.replace(/\s+/g, ' ').trim().slice(0, 20));
        toggleProductionTiroir('spe'); const a = ouverts();
        toggleProductionTiroir('noel'); const b = ouverts();
        toggleProductionTiroir('noel'); const c = ouverts();
        return { a, b, c };
      });
      assert(r.a.length === 1 && /Spéciales/.test(r.a[0]), 'Spéciales ouvert : ' + JSON.stringify(r.a));
      assert(r.b.length === 1 && /Noël/.test(r.b[0]), 'Noël ouvert, Spéciales refermé : ' + JSON.stringify(r.b));
      assert(r.c.length === 0, 'tout refermé : ' + JSON.stringify(r.c));
      await page.close();
    },
  },
  {
    name: '🎄 Noël à produire — à Veigné, la bûche du jour (carte sans fiche) avec ✏️ ; un appui sur le total ouvre le détail client ; rien au Local pour une bûche',
    fn: async (ctx) => {
      let page = await prod(ctx, 'veigne', 'production', db(true));
      const r = await page.evaluate(() => {
        const t = (el) => el.textContent.replace(/\s+/g, ' ').trim();
        const tir = Array.from(document.querySelectorAll('.prod-tiroir')).find((x) => /Noël/.test(x.textContent));
        const tete = tir ? t(tir.querySelector('.prod-specials-header')) : null;
        toggleProductionTiroir('noel');
        const rows = Array.from(document.querySelectorAll('.prod-tiroir.open .fete-prod-row')).map(t);
        document.querySelector('.prod-tiroir.open .fete-prod-row').click();
        const modal = document.querySelector('#fete-detail-host .pros-detail-modal');
        return { tete, rows, detail: modal ? t(modal) : null };
      });
      assert(r.tete && /🎄 Noël à produire — 1 pièce · 1 commande/.test(r.tete) && /✏️ 1 à lire/.test(r.tete), 'en-tête du tiroir Noël : ' + r.tete);
      assert(r.rows.join('|') === 'Bûche Tourangelle Grande1 ✏️', 'la bûche, avec ✏️ (message) : ' + r.rows.join('|'));
      assert(r.detail && /Mme Éclair/.test(r.detail) && /Joyeux 90 ans/.test(r.detail), 'détail client avec le message : ' + r.detail);
      await page.close();
      page = await prod(ctx, 'local', 'prod_boul', db(true));
      const local = await page.evaluate(() => Array.from(document.querySelectorAll('.prod-tiroir')).some((x) => /Noël/.test(x.textContent)));
      assert(local === false, 'au Local : pas de tiroir Noël pour une bûche faite à Veigné');
      await page.close();
    },
  },
];
