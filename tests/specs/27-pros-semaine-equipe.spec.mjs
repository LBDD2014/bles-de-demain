/* ============================================================
   v20.260 — La grille de la semaine dans l'onglet Pros de chaque site (sans le
   code du BackOffice), derrière un bouton 🗓️ Semaine, filtrée sur CE site.
   Date figée des tests : mercredi 22 juillet 2026 (semaine du lundi 20).
   ============================================================ */
import { preparePage, gotoApp, enterBoutique, assert } from '../helpers/harness.mjs';
import { makeDB, TENANT_ID } from '../helpers/fixtures.mjs';

const T = TENANT_ID;

async function ongletPros(ctx, site) {
  const db = makeDB();
  db.products.push({ id: 'cadre_royal_surg', tenant_id: T, name: 'Cadre Royal surgelé', category: 'patisserie_gros', actif: true, usage: 'reappro', supply_by_boutique: {} });
  db.pros = [{ id: 'artigny', tenant_id: T, nom: 'Artigny', actif: true, boutique_principale: 'local', contacts: [], jours_livraison: {} }];
  db.pro_orders = [
    { id: 'o1', tenant_id: T, pro_id: 'artigny', date_livraison: '2026-07-21', boutique_source: 'local', statut: 'confirme' },
    { id: 'o2', tenant_id: T, pro_id: 'artigny', date_livraison: '2026-07-23', boutique_source: 'veigne', statut: 'confirme' },
  ];
  db.pro_order_items = [{ id: 'i1', pro_order_id: 'o1', product_id: 'vt_trad', qty: 20 }, { id: 'i2', pro_order_id: 'o2', product_id: 'cadre_royal_surg', qty: 1 }];
  const page = await preparePage(ctx, { db });
  await gotoApp(page);
  await enterBoutique(page, site);
  await page.evaluate(() => setVue('pros_orders'));
  await page.waitForTimeout(500);
  return page;
}

export const tests = [
  {
    name: 'Onglet Pros — le bouton 🗓️ Semaine ouvre la grille de CE site seulement, sans filtre de site',
    fn: async (ctx) => {
      const page = await ongletPros(ctx, 'veigne');
      const r = await page.evaluate(async () => {
        const avant = !!document.getElementById('pw-grid-table');
        await toggleProOrdersWeekGrid();
        const txt = document.getElementById('pw-grid-table').textContent;
        return { avant, txt, sites: !!document.querySelector('.pw-grid-sites'), nav: !!document.querySelector('.pw-week-nav'),
          btn: Array.from(document.querySelectorAll('#main-content button')).some((b) => b.textContent.indexOf('Fermer la semaine') !== -1) };
      });
      assert(!r.avant && r.nav && r.btn, 'fermée au départ, nav + bouton Fermer une fois ouverte');
      assert(r.txt.indexOf('Cadre Royal') !== -1 && r.txt.indexOf('Tradition') === -1, 'Veigné ne voit que le cadre : ' + r.txt.slice(0, 200));
      assert(!r.sites, 'pas de filtre de site côté équipe');
      await page.close();
    },
  },
  {
    name: 'Onglet Pros — au Local, la grille montre le pain, et les flèches changent de semaine',
    fn: async (ctx) => {
      const page = await ongletPros(ctx, 'local');
      const r = await page.evaluate(async () => {
        await toggleProOrdersWeekGrid();
        const t1 = document.getElementById('pw-grid-table').textContent;
        await setRecapWeekOffset(1);
        const t2 = document.getElementById('pw-grid-table').textContent;
        return { t1, t2, semaine: document.querySelector('.pw-week-nav').textContent };
      });
      assert(r.t1.indexOf('20 Tradition') !== -1 && r.t1.indexOf('Cadre') === -1, 'Local : ' + r.t1.slice(0, 200));
      assert(r.t2.indexOf('Aucune commande') !== -1 && r.semaine.indexOf('27 juillet') !== -1, 'semaine suivante vide : ' + r.semaine);
      await page.close();
    },
  },
];
