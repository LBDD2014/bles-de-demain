/* ============================================================
   v20.282 — Commande pro un jour où le site qui fabrique est fermé.

   Cas réel (Phil, 20/10/2026) : Steff (boutique principale = Le Local) commande
   pour un lundi. Le Local ferme le lundi (Planning, fab_jours_off) : la commande
   partait quand même au Local et Veigné ne la voyait jamais.
   Règle validée par Phil : site fermé ce jour-là → boutique de secours de la
   fiche pro, sinon Veigné. Dans le formulaire équipe, la boutique changée à la
   main (dépannage) reprend la main sur la fiche — cassé depuis v20.257.
   Date figée des tests : mercredi 22 juillet 2026 → lundi 27, mardi 28.
   ============================================================ */
import { preparePage, gotoApp, assert } from '../helpers/harness.mjs';
import { makeDB, TENANT_ID } from '../helpers/fixtures.mjs';

const T = TENANT_ID;
const JOURS = {};
['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'].forEach((j) => { JOURS[j] = { actif: true, butoir_decalage: -1, butoir_heure: '23:59', livraison: '08:00' }; });
const LUNDI = '2026-07-27', MARDI = '2026-07-28';

function dbSteff(opts = {}) {
  const db = makeDB();
  db.products.push({ id: 'cadre_royal_surg', tenant_id: T, name: 'Cadre Royal surgelé', category: 'patisserie_gros',
    actif: true, usage: 'reappro', supply_by_boutique: {}, pros_only_id: null, prix_cession: 30 });
  db.pros = [{ id: 'steff', tenant_id: T, nom: 'STEFF LE BOULANGER', boutique_principale: 'local',
    boutique_secours: 'secours' in opts ? opts.secours : 'veigne', contacts: [], actif: true, magic_token: 'tok_steff',
    jours_livraison: JOURS, catalogue_restreint: null, prix_speciaux: {}, template_items: [],
    sources_par_categorie: opts.sources || {} }];
  // Local fermé le lundi (0), Tours le dimanche (6) — réglage réel du Planning
  db.fab_jours_off = 'joursOff' in opts ? opts.joursOff : [{ site: 'local', jours: '0' }, { site: 'tours', jours: '6' }, { site: 'veigne', jours: '' }];
  return db;
}
// lire(date) côté navigateur : « site:produit=qty+… » par commande vivante de Steff
async function appSteff(ctx, opts) {
  const page = await preparePage(ctx, { db: dbSteff(opts) });
  await gotoApp(page);
  await page.evaluate(() => {
    window.lire = (date) => window.__mockDB.pro_orders.filter((o) => o.pro_id === 'steff' && o.date_livraison === date && o.statut !== 'annule')
      .map((o) => o.boutique_source + ':' + window.__mockDB.pro_order_items.filter((i) => i.pro_order_id === o.id).map((i) => i.product_id + '=' + i.qty).sort().join('+')).sort();
  });
  return page;
}

export const tests = [
  {
    name: 'Site fermé — Steff commande pour lundi (Local fermé) : la commande part à Veigné ; pour mardi elle reste au Local',
    fn: async (ctx) => {
      const page = await appSteff(ctx);
      const r = await page.evaluate(async (dates) => {
        const pro = window.__mockDB.pros[0];
        const out = {};
        for (const d of dates) {
          const res = await saveProOrderSplit({ pro, date: d, editingId: null, statut: 'confirme', notes: null, created_by: 'test',
            items: [{ product_id: 'vt_trad', qty: 20, prix_applique: null }] });
          out[d] = { basc: res.bascules, rows: lire(d), txt: proBasculesTexte(res.bascules, d) };
        }
        return out;
      }, [LUNDI, MARDI]);
      assert(JSON.stringify(r[LUNDI].rows) === '["veigne:vt_trad=20"]', 'lundi → Veigné : ' + JSON.stringify(r[LUNDI].rows));
      assert(r[LUNDI].txt === 'Le Local fermé ce lundi → commande envoyée à Veigné', 'message équipe : ' + r[LUNDI].txt);
      assert(JSON.stringify(r[MARDI].rows) === '["local:vt_trad=20"]' && !r[MARDI].basc.length, 'mardi → Le Local, sans bascule : ' + JSON.stringify(r[MARDI]));
      await page.close();
    },
  },
  {
    name: 'Site fermé — pas de secours sur la fiche = Veigné d\'office ; secours Tours = Tours ; secours fermé lui aussi = Veigné ; une note seule suit la même règle',
    fn: async (ctx) => {
      const p1 = await appSteff(ctx, { secours: null });
      const r1 = await p1.evaluate(async (d) => {
        const pro = window.__mockDB.pros[0];
        await saveProOrderSplit({ pro, date: d, editingId: null, statut: 'confirme', notes: 'juste un mot', created_by: 'test', items: [] });
        return lire(d);
      }, LUNDI);
      assert(JSON.stringify(r1) === '["veigne:"]', 'sans secours, note seule → Veigné : ' + JSON.stringify(r1));
      await p1.close();
      const p2 = await appSteff(ctx, { secours: 'tours' });
      const r2 = await p2.evaluate(async (dates) => {
        const pro = window.__mockDB.pros[0];
        const out = {};
        for (const d of dates) {
          await saveProOrderSplit({ pro, date: d, editingId: null, statut: 'confirme', notes: null, created_by: 'test', items: [{ product_id: 'vt_trad', qty: 5, prix_applique: null }] });
          out[d] = lire(d);
        }
        return out;
      }, [LUNDI]);
      assert(JSON.stringify(r2[LUNDI]) === '["tours:vt_trad=5"]', 'secours Tours → Tours le lundi : ' + JSON.stringify(r2));
      await p2.close();
      // Local fermé lundi ET Tours fermé lundi (secours fermé aussi) → Veigné
      const p3 = await appSteff(ctx, { secours: 'tours', joursOff: [{ site: 'local', jours: '0' }, { site: 'tours', jours: '0,6' }] });
      const r3 = await p3.evaluate(async (d) => {
        const pro = window.__mockDB.pros[0];
        await saveProOrderSplit({ pro, date: d, editingId: null, statut: 'confirme', notes: null, created_by: 'test', items: [{ product_id: 'vt_trad', qty: 5, prix_applique: null }] });
        return lire(d);
      }, LUNDI);
      assert(JSON.stringify(r3) === '["veigne:vt_trad=5"]', 'secours fermé aussi → Veigné : ' + JSON.stringify(r3));
      await p3.close();
    },
  },
  {
    name: 'Site fermé — sources par catégorie : pain (Local fermé) + cadre (Veigné) le lundi = UNE seule commande à Veigné, pas de morceau vide au Local',
    fn: async (ctx) => {
      const page = await appSteff(ctx, { sources: { patisserie_gros: 'veigne' } });
      const r = await page.evaluate(async (d) => {
        const pro = window.__mockDB.pros[0];
        const res = await saveProOrderSplit({ pro, date: d, editingId: null, statut: 'confirme', notes: null, created_by: 'test',
          items: [{ product_id: 'vt_trad', qty: 10, prix_applique: null }, { product_id: 'cadre_royal_surg', qty: 2, prix_applique: null }] });
        return { n: res.ids.length, rows: lire(d) };
      }, LUNDI);
      assert(r.n === 1 && JSON.stringify(r.rows) === '["veigne:cadre_royal_surg=2+vt_trad=10"]', 'tout à Veigné : ' + JSON.stringify(r));
      await page.close();
    },
  },
  {
    name: 'Formulaire équipe — sans toucher à la boutique : bascule + message ; boutique changée à la main (dépannage) : elle gagne sur la fiche, même un jour ouvert',
    fn: async (ctx) => {
      const page = await appSteff(ctx);
      await page.evaluate(() => window.enterBoutique('local'));
      await page.waitForSelector('#app', { state: 'visible' });
      const r = await page.evaluate(async (dates) => {
        currentVue = 'pros';
        adminPros = window.__mockDB.pros.map((p) => JSON.parse(JSON.stringify(p)));
        proOrdersData = [];
        const toasts = [];
        const _t = window.showToast; window.showToast = function(m, k) { toasts.push(m); return _t ? _t(m, k) : null; };
        // 1. lundi, rien forcé → Veigné + message
        await openProOrderForm('new');
        handleProOrderField('pro_id', 'steff');
        handleProOrderField('date_livraison', dates[0]);
        proOrderDraft.items = [{ id: null, product_id: 'vt_trad', qty: 12, prix_applique: null }];
        const forcee1 = !!proOrderDraft.source_forcee;
        await saveProOrder();
        const a = lire(dates[0]);
        // 2. mardi (ouvert), boutique mise sur Tours à la main → Tours
        await openProOrderForm('new');
        handleProOrderField('pro_id', 'steff');
        handleProOrderField('date_livraison', dates[1]);
        handleProOrderField('boutique_source', 'tours');
        proOrderDraft.items = [{ id: null, product_id: 'vt_trad', qty: 7, prix_applique: null }];
        await saveProOrder();
        const b = lire(dates[1]);
        return { forcee1, a, b, toasts, hint: (document.body.innerHTML.match(/Modifie si dépannage[^<]*/) || [''])[0] };
      }, [LUNDI, MARDI]);
      assert(!r.forcee1 && JSON.stringify(r.a) === '["veigne:vt_trad=12"]', 'sans toucher : Veigné : ' + JSON.stringify(r));
      assert(r.toasts.some((t) => /Commande créée — Le Local fermé ce lundi → commande envoyée à Veigné/.test(t)), 'message : ' + r.toasts.join(' | '));
      assert(JSON.stringify(r.b) === '["tours:vt_trad=7"]', 'forcé Tours : ' + JSON.stringify(r.b));
      await page.close();
    },
  },
  {
    name: 'Page pro (pro.html) — Steff commande lundi depuis son téléphone : la commande est enregistrée pour Veigné',
    fn: async (ctx) => {
      const page = await preparePage(ctx, { db: dbSteff() });
      await page.goto('http://127.0.0.1:8787/pro.html?t=tok_steff');
      await page.waitForFunction(() => document.querySelector('.hello'));
      await page.evaluate((d) => openOrder(d), LUNDI);
      await page.waitForSelector('.prow');
      await page.evaluate(async () => { setQty('steff', 'vt_trad', 30); await saveOrder(); });
      await page.waitForSelector('.okbox');
      const rows = await page.evaluate((d) => window.__mockDB.pro_orders.filter((o) => o.pro_id === 'steff' && o.date_livraison === d && o.statut !== 'annule')
        .map((o) => o.boutique_source + ':' + window.__mockDB.pro_order_items.filter((i) => i.pro_order_id === o.id).map((i) => i.product_id + '=' + i.qty).join('+')), LUNDI);
      assert(JSON.stringify(rows) === '["veigne:vt_trad=30"]', 'lundi depuis pro.html → Veigné : ' + JSON.stringify(rows));
      assert(!(await page.evaluate(() => window.__externalRequests)), 'rien vers Supabase');
      await page.close();
    },
  },
];
