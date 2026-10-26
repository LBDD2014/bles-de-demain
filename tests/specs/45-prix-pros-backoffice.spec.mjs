/* ============================================================
   v20.292 — Les prix des pros ne s'affichent qu'en BackOffice (Phil, 26/10/2026 :
   « enlève les prix pour les pros et pour la production, juste moi en back office »).
   En boutique : cartes et formulaire de l'onglet Pros sans aucun €, les quantités restent.
   Les prix sont toujours enregistrés sur les lignes (prix_applique) pour les récaps du BackOffice.
   ============================================================ */
import { preparePage, gotoApp, enterBoutique, assert } from '../helpers/harness.mjs';
import { makeDB, TENANT_ID } from '../helpers/fixtures.mjs';
const T = TENANT_ID;
const JOURS = { jeudi: { actif: true, butoir_decalage: -1, butoir_heure: '23:59', livraison: '08:00' } };

function db() {
  const d = makeDB();
  d.products.forEach((p) => { if (p.id === 'vt_trad') p.prix_cession = 0.95; });
  d.pros = [{ id: 'clapotis', tenant_id: T, nom: 'Le Clapotis', actif: true, boutique_principale: 'tours', contacts: [], jours_livraison: JOURS, catalogue_restreint: ['vt_trad'], prix_speciaux: { vt_trad: 0.9 }, template_items: [], sources_par_categorie: {} }];
  d.pro_orders = [{ id: 'o1', tenant_id: T, pro_id: 'clapotis', date_livraison: '2026-07-23', boutique_source: 'tours', statut: 'confirme', created_by: 'tours' }];
  d.pro_order_items = [{ id: 'i1', pro_order_id: 'o1', product_id: 'vt_trad', qty: 40, prix_applique: 0.9 }];
  return d;
}

export const tests = [
  {
    name: 'Onglet Pros à Tours — aucun prix sur les cartes ni dans le formulaire (quantités conservées) ; le prix reste enregistré sur la ligne ; en BackOffice la règle dit « visible »',
    fn: async (ctx) => {
      const page = await preparePage(ctx, { db: db() });
      await gotoApp(page);
      await enterBoutique(page, 'tours');
      await page.evaluate(async () => { currentVue = 'pros'; proOrderFilterPeriod = 'tomorrow'; await loadAdminPros(); await loadProOrders('tours'); renderProOrders(); });
      await page.waitForSelector('.pro-order-card');
      const carte = await page.evaluate(() => ({ txt: document.querySelector('.pro-orders-list').textContent.replace(/\s+/g, ' '), total: document.querySelectorAll('.pro-order-card-total').length, prix: document.querySelectorAll('.pro-order-item-prix-inline').length, visible: prixVisibles() }));
      assert(!/€/.test(carte.txt) && carte.total === 0 && carte.prix === 0 && /40×\s*Tradition/.test(carte.txt), 'carte sans € mais avec la quantité : ' + JSON.stringify(carte));
      assert(carte.visible === false, 'prixVisibles() = false en boutique');
      await page.evaluate(async () => { await openProOrderForm('o1'); });
      await page.waitForSelector('.pro-order-item-row');
      const form = await page.evaluate(() => ({ txt: document.querySelector('.pro-form').textContent.replace(/\s+/g, ' '), total: document.querySelectorAll('.pro-order-total').length, qty: document.querySelector('.pro-order-item-qty').value }));
      assert(!/€/.test(form.txt) && form.total === 0 && form.qty === '40', 'formulaire sans € ni total, quantité 40 : ' + JSON.stringify(form));
      // enregistrer depuis la boutique garde le prix sur la ligne (pour le BackOffice)
      await page.evaluate(async () => { proOrderDraft.items[0].qty = 42; await saveProOrder(); });
      const ligne = await page.evaluate(() => window.__mockDB.pro_order_items.filter((i) => i.product_id === 'vt_trad' && i.qty === 42).map((i) => i.prix_applique));
      assert(JSON.stringify(ligne) === '[0.9]', 'prix spécial toujours enregistré sur la ligne : ' + JSON.stringify(ligne));
      const bo = await page.evaluate(() => { const b = currentBoutique; currentBoutique = 'backoffice'; const v = prixVisibles(); currentBoutique = b; return v; });
      assert(bo === true, 'prixVisibles() = true en BackOffice');
      await page.close();
    },
  },
];
