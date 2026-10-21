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
    name: 'Liste des pros (v20.286) — colonnes par boutique avec secours visible ; nouvelle fiche = rien de coché, 0 produit = message rouge, enregistrer demande confirmation ; liste vide = le pro ne voit rien',
    fn: async (ctx) => {
      const page = await backofficePros(ctx);
      const r = await page.evaluate(async () => {
        const cols = Array.from(document.querySelectorAll('.pros-list.pros-cols .pros-col')).map((c) => c.getAttribute('data-site') + ':' + c.querySelectorAll('.pro-card').length);
        const shops = Array.from(document.querySelectorAll('.pro-card-shops')).map((x) => x.textContent.replace(/\s+/g, ' ').trim());
        // nouvelle fiche : rien de coché
        openProForm('new');
        const draftCat = JSON.stringify(adminProsDraft.catalogue_restreint);
        const coches = document.querySelectorAll('.pro-form-section input[type=checkbox]:checked').length;
        const hint = Array.from(document.querySelectorAll('.pro-form-hint')).map((x) => x.textContent).find((t) => /produit autorisé/.test(t)) || '';
        // enregistrer avec 0 produit → confirm() ; ici annulé → rien d'enregistré
        adminProsDraft.nom = 'Test Vide';
        let question = ''; window.confirm = (m) => { question = m; return false; };
        await saveProForm();
        const n1 = window.__mockDB.pros.length;
        // accepté → enregistré avec [] ; et [] = aucun produit disponible pour lui
        window.confirm = () => true;
        await saveProForm();
        const saved = window.__mockDB.pros.find((p) => p.nom === 'Test Vide');
        const dispo = saved ? getProAvailableProducts(saved).length : -1;
        const dispoTout = getProAvailableProducts({ id: 'x', catalogue_restreint: null }).length;
        return { cols, shops, draftCat, coches, hint, question, n1, savedCat: saved && JSON.stringify(saved.catalogue_restreint), dispo, dispoTout };
      });
      assert(r.cols.join(',') === 'local:2,veigne:0,tours:0', 'colonnes Le Local / Veigné / Tours : ' + r.cols.join(','));
      assert(r.shops.every((t) => /Le Local · secours : Veigné \(par défaut\)/.test(t)), 'secours par défaut affiché : ' + JSON.stringify(r.shops));
      assert(r.draftCat === '[]' && r.coches === 0, 'nouvelle fiche : liste vide, rien de coché : ' + r.draftCat + ' / ' + r.coches);
      assert(/0 produit autorisé/.test(r.hint) && /ne pourra rien commander/.test(r.hint), 'message rouge : ' + r.hint);
      assert(/aucun produit autorisé/.test(r.question) && r.n1 === 2, 'confirmation demandée, annulée = pas enregistré : ' + r.question + ' / ' + r.n1);
      assert(r.savedCat === '[]' && r.dispo === 0 && r.dispoTout > 0, 'enregistré à [] = aucun produit dispo (null = tout) : ' + JSON.stringify({ c: r.savedCat, d: r.dispo, t: r.dispoTout }));
      await page.close();
    },
  },
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
