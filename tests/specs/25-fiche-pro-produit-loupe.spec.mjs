/* ============================================================
   v20.258 — Fiche pro : créer un produit manquant sans quitter la fiche,
   bouton Créer/Enregistrer aussi en bas, 🔍 dans la liste des clients.
   (Phil, 28/09, en créant le Relais d'Amboise.)
   ============================================================ */
import { preparePage, gotoApp, assert } from '../helpers/harness.mjs';
import { makeDB, TENANT_ID } from '../helpers/fixtures.mjs';

const T = TENANT_ID;

async function backofficePros(ctx) {
  const db = makeDB();
  db.pros = [
    { id: 'relais', tenant_id: T, nom: 'Relais d\'Amboise', actif: true, boutique_principale: 'local', contacts: [{ nom: 'Marc', tel: '0611223344' }], jours_livraison: {}, catalogue_restreint: ['vp_tra'] },
    { id: 'coop', tenant_id: T, nom: 'Coop Nature', actif: true, boutique_principale: 'local', contacts: [], jours_livraison: {}, catalogue_restreint: null },
  ];
  const page = await preparePage(ctx, { db });
  await gotoApp(page);
  await page.evaluate(async () => { currentVue = 'pros'; await loadAdminPros(); await loadAdminProducts(); renderAdminPros(); });
  return page;
}

export const tests = [
  {
    name: 'Liste des pros — la loupe filtre par nom, contact ou téléphone',
    fn: async (ctx) => {
      const page = await backofficePros(ctx);
      const r = await page.evaluate(() => {
        const visibles = () => Array.from(document.querySelectorAll('.pros-list .pro-card')).filter((c) => c.style.display !== 'none').length;
        const out = { total: visibles() };
        handleProsSearch('marc'); out.marc = visibles();
        handleProsSearch('0611'); out.tel = visibles();
        handleProsSearch('coop'); out.coop = visibles();
        handleProsSearch(''); out.vide = visibles();
        return out;
      });
      assert(r.total === 2 && r.marc === 1 && r.tel === 1 && r.coop === 1 && r.vide === 2, JSON.stringify(r));
      await page.close();
    },
  },
  {
    name: 'Fiche pro — Créer / Enregistrer en haut ET en bas',
    fn: async (ctx) => {
      const page = await backofficePros(ctx);
      const n = await page.evaluate(() => {
        openProForm('relais');
        return Array.from(document.querySelectorAll('#main-content button')).filter((b) => b.textContent.trim() === 'Enregistrer').length;
      });
      assert(n === 2, '2 boutons Enregistrer attendus, trouvé ' + n);
      await page.close();
    },
  },
  {
    name: 'Fiche pro — créer un produit manquant le crée en réappro et le coche pour ce client',
    fn: async (ctx) => {
      const page = await backofficePros(ctx);
      const r = await page.evaluate(async () => {
        openProForm('relais');
        openProQuickProd();
        proQuickProd.name = 'Khorasan petite boule 200 g cuit'; proQuickProd.category = 'pains';
        await saveProQuickProd();
        const p = window.__mockDB.products.find((x) => x.name === 'Khorasan petite boule 200 g cuit');
        return { p: p && { usage: p.usage, actif: p.actif, cat: p.category, pro: p.pros_only_id }, coche: adminProsDraft.catalogue_restreint.indexOf(p && p.id) !== -1,
          formFerme: !proQuickProd, visible: document.getElementById('main-content').textContent.indexOf('Khorasan petite boule') !== -1 };
      });
      assert(r.p && r.p.usage === 'reappro' && r.p.actif && r.p.cat === 'pains' && !r.p.pro, 'produit : ' + JSON.stringify(r.p));
      assert(r.coche && r.formFerme && r.visible, 'coché + formulaire refermé + affiché : ' + JSON.stringify(r));
      await page.close();
    },
  },
  {
    name: 'Fiche pro — « réservé à ce client » pose pros_only_id',
    fn: async (ctx) => {
      const page = await backofficePros(ctx);
      const pro = await page.evaluate(async () => {
        openProForm('relais'); openProQuickProd();
        proQuickProd.name = 'Mini bagels Relais'; proQuickProd.category = 'pains'; proQuickProd.reserve = true;
        await saveProQuickProd();
        return window.__mockDB.products.find((x) => x.name === 'Mini bagels Relais').pros_only_id;
      });
      assert(pro === 'relais', 'pros_only_id = relais, trouvé ' + pro);
      await page.close();
    },
  },
];
