/* ============================================================
   v20.342 — 🚑 Dépannage (Phil, 09/11/2026) : « passer une commande une fois la date échue pour dire
   que nous avons livré » (Dakota Chambray, samedi 07/11 : 100 burgers oubliés, faits et livrés).
   BackOffice → Pros → 🚑 Dépannage : formulaire habituel, date du jour par défaut (passée possible),
   enregistrée LIVRÉE, created_by 'depannage:backoffice' (badge 🚑), stock sorti comme à la livraison.
   Si le pro a déjà une commande ce jour-là : on l'ouvre pour y ajouter la ligne (pas d'écrasement).
   Base factice, rien vers Supabase. Horloge : mercredi 22/07/2026 10h00.
   ============================================================ */
import { preparePage, gotoApp, enterBoutique, assert } from '../helpers/harness.mjs';
import { makeDB, TENANT_ID } from '../helpers/fixtures.mjs';
const T = TENANT_ID;

function db() {
  const d = makeDB();
  d.pros = [{ id: 'dakota', tenant_id: T, nom: 'Dakota Chambray', actif: true, boutique_principale: 'local', groupe: null, contacts: [], jours_livraison: {}, catalogue_restreint: null }];
  // congélo tourier : fiche réassort « Croissant » caisse de 77 (la fiche vente vp_croissant porte le même nom)
  d.products.push({ id: 'cro_reap', tenant_id: T, name: 'Croissant', category: 'viennoiserie', actif: true, usage: 'reappro', conditioning_unit: 'caisse', conditioning_qty: 77, supply_by_boutique: null });
  d.tourier_stock = [{ tenant_id: T, product_id: 'cro_reap', stock: 10, mini: 4 }];
  d.stock_entries = []; d.pro_stock = []; d.pro_stock_movements = [];
  return d;
}
async function backofficePros(ctx, d) {
  const page = await preparePage(ctx, { db: d });
  await gotoApp(page); await enterBoutique(page, 'backoffice');
  await page.evaluate(() => setVue('pros'));
  await page.waitForFunction(() => /🚑 Dépannage/.test(document.getElementById('main-content').textContent));
  return page;
}

export const tests = [
  {
    name: 'BackOffice — 🚑 Dépannage : commande à une date passée enregistrée LIVRÉE, badge 🚑, note, congélo tourier −2 caisses (154 croissants)',
    fn: async (ctx) => {
      const page = await backofficePros(ctx, db());
      await page.evaluate(() => { openProDepannage(); handleProOrderField('pro_id', 'dakota'); handleProOrderField('date_livraison', '2026-07-18'); });
      await page.waitForTimeout(300);
      const f = await page.evaluate(() => ({ titre: document.querySelector('.pro-form-title').textContent, btn: Array.from(document.querySelectorAll('.pro-form-header .btn-gold')).map((b) => b.textContent).join('|'), bandeau: !!document.querySelector('.pro-dep-banner'), isNew: editingProOrderId === 'new', date: proOrderDraft.date_livraison }));
      assert(/🚑 Dépannage/.test(f.titre) && /Enregistrer livrée/.test(f.btn) && f.bandeau && f.isNew && f.date === '2026-07-18', 'formulaire : ' + JSON.stringify(f));
      await page.evaluate(async () => { addProOrderItem(); handleProOrderItemField(0, 'product_id', 'vp_croissant'); handleProOrderItemField(0, 'qty', '154'); await saveProOrder(); });
      await page.waitForTimeout(400);
      const r = await page.evaluate(() => ({
        orders: window.__mockDB.pro_orders.map((o) => ({ pro: o.pro_id, date: o.date_livraison, statut: o.statut, by: o.created_by, notes: o.notes, src: o.boutique_source })),
        items: window.__mockDB.pro_order_items.map((i) => i.product_id + ':' + i.qty),
        stock: window.__mockDB.tourier_stock[0].stock,
        retour: adminProsView === 'list' && /🚑 Dépannage/.test(document.getElementById('main-content').textContent) && editingProOrderId === null,
        badge: proCreneauBadge({ created_by: 'depannage:backoffice' }, null),
      }));
      assert(r.orders.length === 1 && r.orders[0].statut === 'livre' && r.orders[0].by === 'depannage:backoffice' && /^🚑 Dépannage/.test(r.orders[0].notes) && r.orders[0].date === '2026-07-18' && r.orders[0].src === 'local', 'commande : ' + JSON.stringify(r.orders));
      assert(r.items.join() === 'vp_croissant:154', 'lignes : ' + r.items.join());
      assert(r.stock === 8, 'congélo : 10 − 154/77 = 8, trouvé ' + r.stock);
      assert(r.retour && /🚑 dépannage/.test(r.badge), 'retour liste + badge : ' + JSON.stringify({ retour: r.retour, badge: r.badge }));
      await page.close();
    },
  },
  {
    name: 'BackOffice — 🚑 Dépannage sur un pro qui a déjà une commande ce jour-là : la commande existante s\'ouvre, la ligne s\'ajoute, rien n\'est écrasé',
    fn: async (ctx) => {
      const d = db();
      d.pro_orders = [{ id: 'o1', tenant_id: T, pro_id: 'dakota', date_livraison: '2026-07-18', boutique_source: 'local', statut: 'livre', created_by: 'pro_self:Antoine', creneau: 'matin', notes: null }];
      d.pro_order_items = [{ id: 'i1', pro_order_id: 'o1', product_id: 'vp_painchoc', qty: 70, prix_applique: null }];
      const page = await backofficePros(ctx, d);
      await page.evaluate(() => { openProDepannage(); handleProOrderField('pro_id', 'dakota'); handleProOrderField('date_livraison', '2026-07-18'); });
      await page.waitForFunction(() => editingProOrderId === 'o1');
      const f = await page.evaluate(() => ({ rajout: !!proOrderDraft.rajout, items: proOrderDraft.items.map((i) => i.product_id + ':' + i.qty), btn: Array.from(document.querySelectorAll('.pro-form-header .btn-gold')).map((b) => b.textContent).join('|'), bandeau: document.querySelector('.pro-dep-banner').textContent }));
      assert(f.rajout && f.items.join() === 'vp_painchoc:70' && /Ajouter à la commande/.test(f.btn) && /Rajout/.test(f.bandeau), 'ouverture : ' + JSON.stringify(f));
      await page.evaluate(async () => { addProOrderItem(); handleProOrderItemField(1, 'product_id', 'vp_croissant'); handleProOrderItemField(1, 'qty', '154'); await saveProOrder(); });
      await page.waitForTimeout(400);
      const r = await page.evaluate(() => ({
        orders: window.__mockDB.pro_orders.filter((o) => o.statut !== 'annule').map((o) => ({ id: o.id, statut: o.statut, notes: o.notes })),
        items: window.__mockDB.pro_order_items.map((i) => i.product_id + ':' + i.qty).sort().join(),
        stock: window.__mockDB.tourier_stock[0].stock,
      }));
      assert(r.orders.length === 1 && r.orders[0].id === 'o1' && r.orders[0].statut === 'livre' && /rajout dépannage/.test(r.orders[0].notes), 'commande : ' + JSON.stringify(r.orders));
      assert(r.items === 'vp_croissant:154,vp_painchoc:70', 'lignes : ' + r.items);
      assert(r.stock === 8, 'seule la ligne ajoutée sort du congélo : ' + r.stock);
      await page.close();
    },
  },
];
