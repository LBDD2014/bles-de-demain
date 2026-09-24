/* ============================================================
   v20.257 — « Sources par catégorie » : une commande pro découpée par site.

   Besoin réel (Phil, 24/09) : Château d'Artigny commande son pain au Local et
   parfois des cadres de gâteaux faits par les pâtissiers de Veigné. Le réglage
   existait dans la fiche pro mais n'était lu nulle part.
   Règle : pour le pro, UNE commande par date ; l'app la découpe en une commande
   par site, et rassemble les morceaux quand on la modifie.
   Date figée des tests : mercredi 22 juillet 2026.
   ============================================================ */
import { preparePage, gotoApp, assert } from '../helpers/harness.mjs';
import { makeDB, TENANT_ID } from '../helpers/fixtures.mjs';

const T = TENANT_ID;
const TOUS = {};
['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'].forEach((j) => { TOUS[j] = { actif: true, butoir_decalage: -1, butoir_heure: '14:00' }; });

function dbArtigny(sources) {
  const db = makeDB();
  db.products.push({ id: 'cadre_royal_surg', tenant_id: T, name: 'Cadre Royal surgelé', category: 'patisserie_gros',
    actif: true, usage: 'reappro', supply_by_boutique: {}, pros_only_id: null, prix_cession: 30 });
  db.pros = [{ id: 'artigny', tenant_id: T, nom: 'CHÂTEAU D\'ARTIGNY', boutique_principale: 'local', contacts: [], actif: true,
    magic_token: 'tok_artigny', jours_livraison: TOUS, catalogue_restreint: null, prix_speciaux: {}, template_items: [],
    sources_par_categorie: sources === undefined ? { patisserie_gros: 'veigne' } : sources }];
  return db;
}

async function espacePro(ctx, sources) {
  const page = await preparePage(ctx, { db: dbArtigny(sources) });
  await gotoApp(page);
  await page.evaluate(async () => { await initProInterface('tok_artigny'); });
  await page.waitForTimeout(300);
  return page;
}

const commander = async (page, items) => page.evaluate(async (items) => {
  openProInterfaceForm('new');
  proInterfaceDraft.date_livraison = '2026-07-24';
  proInterfaceDraft.items = items.map((it) => ({ id: null, product_id: it[0], qty: it[1], prix_applique: null }));
  await saveProInterfaceOrder();
  return window.__mockDB.pro_orders.filter((o) => o.pro_id === 'artigny' && o.statut !== 'annule')
    .map((o) => ({ id: o.id, src: o.boutique_source, date: o.date_livraison,
      items: window.__mockDB.pro_order_items.filter((i) => i.pro_order_id === o.id).map((i) => i.product_id) }));
}, items);

export const tests = [
  {
    name: 'Sources — pain au Local + cadre à Veigné = deux commandes, une par site, même date',
    fn: async (ctx) => {
      const page = await espacePro(ctx);
      const rows = await commander(page, [['vp_tra', 10], ['cadre_royal_surg', 2]]);
      const local = rows.find((r) => r.src === 'local'), veigne = rows.find((r) => r.src === 'veigne');
      assert(rows.length === 2 && local && veigne, 'deux commandes attendues : ' + JSON.stringify(rows));
      assert(JSON.stringify(local.items) === '["vp_tra"]' && JSON.stringify(veigne.items) === '["cadre_royal_surg"]', 'produits bien répartis : ' + JSON.stringify(rows));
      const txt = await page.evaluate(() => document.getElementById('pro-interface').textContent);
      assert(txt.indexOf('Le Local + Veigné') !== -1, 'côté pro : UNE commande affichée « Le Local + Veigné »');
      await page.close();
    },
  },
  {
    name: 'Sources — modifier la commande rassemble les morceaux ; retirer le cadre annule la part Veigné',
    fn: async (ctx) => {
      const page = await espacePro(ctx);
      const rows = await commander(page, [['vp_tra', 10], ['cadre_royal_surg', 2]]);
      const r = await page.evaluate(async (localId) => {
        openProInterfaceForm(localId);
        const nb = proInterfaceDraft.items.length;
        proInterfaceDraft.items = proInterfaceDraft.items.filter((it) => it.product_id !== 'cadre_royal_surg');
        proInterfaceDraft.items[0].qty = 12;
        await saveProInterfaceOrder();
        const os = window.__mockDB.pro_orders.filter((o) => o.pro_id === 'artigny');
        return { nb, statuts: os.map((o) => o.boutique_source + ':' + o.statut).sort(),
          qty: window.__mockDB.pro_order_items.filter((i) => i.pro_order_id === localId).map((i) => i.qty) };
      }, rows.find((x) => x.src === 'local').id);
      assert(r.nb === 2, 'la modification ouvre les 2 produits ensemble, trouvé ' + r.nb);
      assert(JSON.stringify(r.statuts) === '["local:confirme","veigne:annule"]', 'statuts : ' + r.statuts.join(', '));
      assert(JSON.stringify(r.qty) === '[12]', 'quantité du pain mise à jour : ' + r.qty);
      await page.close();
    },
  },
  {
    name: 'Sources — annuler côté pro annule tous les morceaux',
    fn: async (ctx) => {
      const page = await espacePro(ctx);
      const rows = await commander(page, [['vp_tra', 10], ['cadre_royal_surg', 2]]);
      const statuts = await page.evaluate(async (id) => {
        window.confirm = () => true;
        await cancelProInterfaceOrder(id);
        return window.__mockDB.pro_orders.filter((o) => o.pro_id === 'artigny').map((o) => o.statut);
      }, rows[0].id);
      assert(statuts.every((s) => s === 'annule'), 'tout annulé : ' + statuts.join(', '));
      await page.close();
    },
  },
  {
    name: 'Sources — sans réglage, une seule commande comme avant',
    fn: async (ctx) => {
      const page = await espacePro(ctx, {});
      const rows = await commander(page, [['vp_tra', 10], ['cadre_royal_surg', 2]]);
      assert(rows.length === 1 && rows[0].src === 'local' && rows[0].items.length === 2, 'une commande au Local : ' + JSON.stringify(rows));
      await page.close();
    },
  },
  {
    name: 'Sources — la génération auto et le BackOffice passent par le même découpage',
    fn: async (ctx) => {
      const page = await espacePro(ctx);
      const rows = await page.evaluate(async () => {
        const pro = window.__mockDB.pros[0];
        const r = await saveProOrderSplit({ pro, date: '2026-07-28', editingId: null, statut: 'brouillon', notes: 'Généré auto', created_by: 'v21.1 auto',
          items: [{ product_id: 'vp_tra', qty: 5, prix_applique: null }, { product_id: 'cadre_royal_surg', qty: 1, prix_applique: null }] });
        return { err: r.error, n: r.ids.length, rows: window.__mockDB.pro_orders.filter((o) => o.date_livraison === '2026-07-28').map((o) => o.boutique_source + ':' + o.statut).sort() };
      });
      assert(!rows.err && rows.n === 2, 'deux commandes créées : ' + JSON.stringify(rows));
      assert(JSON.stringify(rows.rows) === '["local:brouillon","veigne:brouillon"]', rows.rows.join(', '));
      await page.close();
    },
  },
];
