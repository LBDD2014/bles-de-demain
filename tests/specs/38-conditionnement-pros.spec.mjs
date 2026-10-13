/* ============================================================
   v20.275 — Conditionnement imposé par produit (Phil, 13/10/2026).
   Fiche produit : conditioning_unit = caisse/sac + conditioning_qty (ex. caisse de 8).
   · pro.html : le compteur compte des colis (+ = +8 pièces), libellé « caisse de 8 pièces »,
     « la dernière fois : 2 caisses (16 p.) », la commande est enregistrée EN PIÈCES.
   · app (saisie équipe) : rappel « 2 caisses de 8 » sous le prix, arrondi au colis supérieur.
   Base factice, rien vers Supabase.
   ============================================================ */
import { preparePage, assert } from '../helpers/harness.mjs';
import { makeDB, TENANT_ID } from '../helpers/fixtures.mjs';
const T = TENANT_ID;
const JOURS = { mardi: { actif: true, livraison: '09:30', butoir_decalage: -1, butoir_heure: '23:59' }, jeudi: { actif: true, livraison: '09:30', butoir_decalage: -1, butoir_heure: '23:59' }, samedi: { actif: true, livraison: '09:30', butoir_decalage: -1, butoir_heure: '23:59' } };

function dbRelais() {
  const db = makeDB();
  db.products.push({ id: 'kho_800', tenant_id: T, name: 'Khorasan 800 g précuit surgelé', category: 'pains', actif: true, usage: 'reappro', conditioning_unit: 'caisse', conditioning_qty: 8, supply_by_boutique: {} });
  db.products.push({ id: 'trad_surg', tenant_id: T, name: 'Tradition précuite surgelée', category: 'pains', actif: true, usage: 'reappro', conditioning_unit: 'sac', conditioning_qty: 20, supply_by_boutique: {} });
  db.pros = [
    { id: 'relais', tenant_id: T, nom: 'Le Relais d\'Amboise', actif: true, boutique_principale: 'local', groupe: null, magic_token: 'tok_relais', contacts: [{ nom: 'Marc', tel: '0600000000' }], jours_livraison: JOURS, catalogue_restreint: ['kho_800', 'trad_surg', 'vp_croissant'] },
  ];
  // jeudi 16/07 livrée : 16 khorasan (= 2 caisses) + 10 croissants → « la dernière fois »
  db.pro_orders = [{ id: 'o1', tenant_id: T, pro_id: 'relais', date_livraison: '2026-07-16', boutique_source: 'local', statut: 'livre', created_by: 'pro_self:Marc' }];
  db.pro_order_items = [{ id: 'i1', pro_order_id: 'o1', product_id: 'kho_800', qty: 16 }, { id: 'i2', pro_order_id: 'o1', product_id: 'vp_croissant', qty: 10 }];
  return db;
}

export const tests = [
  {
    name: 'Page pro — produit en caisse de 8 : compteur en caisses (+ = +8 pièces), libellé, « la dernière fois : 2 caisses (16 p.) », commande enregistrée en pièces',
    fn: async (ctx) => {
      const page = await preparePage(ctx, { db: dbRelais() });
      await page.goto('http://127.0.0.1:8787/pro.html?t=tok_relais');
      await page.waitForFunction(() => document.querySelector('.hello'));
      await page.evaluate(() => { document.querySelector('#tabs button:nth-child(2)').click(); });
      await page.waitForFunction(() => document.querySelector('.prow'));
      const r = await page.evaluate(() => {
        const rows = {};
        document.querySelectorAll('.prow').forEach((p) => { rows[p.querySelector('.nm').firstChild.textContent] = { small: p.querySelector('.nm small').textContent, val: p.querySelector('input').value }; });
        return rows;
      });
      const kho = r['Khorasan 800 g précuit surgelé'], cro = r['Croissant'] || r[Object.keys(r).find((k) => /roissant/.test(k))];
      assert(kho && /caisse de 8 pièces/.test(kho.small) && /la dernière fois : 2 caisses \(16 p\.\)/.test(kho.small), 'libellé khorasan : ' + JSON.stringify(kho));
      assert(kho.val === '2', 'pré-rempli en caisses (2), pas en pièces : ' + kho.val);
      assert(cro && /pièce/.test(cro.small) && cro.val === '10', 'croissant reste à la pièce : ' + JSON.stringify(cro));
      // + sur le khorasan = +8 pièces ; − sur un sac de 20 vide reste à 0 ; saisie « 3 » = 60 pièces
      const q = await page.evaluate(() => {
        bump('relais', 'kho_800', 1); bump('relais', 'trad_surg', -1); setQty('relais', 'trad_surg', 3);
        return { kho: draft.qty.relais.kho_800, khoInp: document.getElementById('q_relais_kho_800').value, trad: draft.qty.relais.trad_surg, tradInp: document.getElementById('q_relais_trad_surg').value, tot: document.getElementById('tot').textContent };
      });
      assert(q.kho === 24 && q.khoInp === '3', '+1 caisse → 24 pièces, compteur 3 : ' + JSON.stringify(q));
      assert(q.trad === 60 && q.tradInp === '3', 'tape 3 sacs → 60 pièces : ' + JSON.stringify(q));
      assert(/94 pièces/.test(q.tot), 'total en pièces (24 + 60 + 10 = 94) : ' + q.tot);
      await page.evaluate(async () => { await saveOrder(); });
      await page.waitForTimeout(200);
      const saved = await page.evaluate(() => window.__mockDB.pro_order_items.filter((i) => window.__mockDB.pro_orders.find((o) => o.id === i.pro_order_id && o.date_livraison > '2026-07-20')).map((i) => i.product_id + ':' + i.qty).sort().join(','));
      assert(saved === 'kho_800:24,trad_surg:60,vp_croissant:10', 'enregistré en pièces : ' + saved);
      await page.close();
    },
  },
];
