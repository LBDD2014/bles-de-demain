/* ============================================================
   v20.294 — Mise en compte par le LIVREUR (Phil, 26/10/2026 : « au Local c'est lui qui met en compte »).
   · bouton 💶 sur chaque carte pro de sa Tournée, enregistré « livreur »
   · pop-up avec la liste + bouton par commande : à la dernière livraison cochée, et à l'ouverture à partir de 17h
   Horloge des tests : mercredi 22/07/2026 10h00.
   ============================================================ */
import { preparePage, gotoApp, enterBoutique, assert } from '../helpers/harness.mjs';
import { makeDB, TENANT_ID } from '../helpers/fixtures.mjs';
const T = TENANT_ID;
const J = { mercredi: { actif: true, butoir_decalage: -1, butoir_heure: '23:59', livraison: '08:00', tournee: 'livreur' } };

function db() {
  const d = makeDB();
  d.pros = [
    { id: 'bondici', tenant_id: T, nom: "BON D'ICI", actif: true, boutique_principale: 'local', contacts: [], jours_livraison: J, catalogue_restreint: null, prix_speciaux: {}, template_items: [], sources_par_categorie: {} },
    { id: 'clapotis', tenant_id: T, nom: 'Le Clapotis', actif: true, boutique_principale: 'local', contacts: [], jours_livraison: J, catalogue_restreint: null, prix_speciaux: {}, template_items: [], sources_par_categorie: {} },
  ];
  d.pro_orders = [
    { id: 'o1', tenant_id: T, pro_id: 'bondici', date_livraison: '2026-07-22', boutique_source: 'local', statut: 'confirme', created_by: 'local' },
    { id: 'o2', tenant_id: T, pro_id: 'clapotis', date_livraison: '2026-07-22', boutique_source: 'local', statut: 'confirme', created_by: 'local' },
  ];
  d.pro_order_items = [{ id: 'i1', pro_order_id: 'o1', product_id: 'vt_trad', qty: 30 }, { id: 'i2', pro_order_id: 'o2', product_id: 'vt_trad', qty: 12 }];
  return d;
}
async function tournee(ctx, nowMs) {
  const page = await preparePage(ctx, nowMs ? { db: db(), nowMs } : { db: db() });
  await gotoApp(page);
  await enterBoutique(page, 'livreur');
  await page.evaluate(async () => { await loadAdminPros(); await loadLivreurProOrders(currentDate); await renderLivraison(); });
  await page.waitForSelector('.livreur-check');
  return page;
}
const popup = (page) => page.evaluate(() => { const m = document.getElementById('livreur-compte-modal'); return m && m.classList.contains('show') ? m.textContent.replace(/\s+/g, ' ') : ''; });

export const tests = [
  {
    name: 'Tournée livreur — bouton 💶 sur chaque commande pro (enregistré « livreur ») ; pas de pop-up à 10h ; cocher la dernière livraison ouvre la pop-up avec les commandes pas en compte ; 💶 dedans les fait sortir, vide = fermée',
    fn: async (ctx) => {
      const page = await tournee(ctx);
      const r0 = await page.evaluate(() => ({ btns: document.querySelectorAll('.pro-compte-btn').length, checks: document.querySelectorAll('.livreur-check').length }));
      assert(r0.btns === 2 && r0.checks === 2, 'deux cartes, chacune avec 💶 : ' + JSON.stringify(r0));
      assert((await popup(page)) === '', 'pas de pop-up à 10h à l\'ouverture');
      await page.evaluate(async () => { await toggleProMiseEnCompte('o1'); });
      const o1 = await page.evaluate(() => window.__mockDB.pro_orders.find((o) => o.id === 'o1'));
      assert(o1.mise_en_compte_by === 'livreur' && /^2026-07-22T/.test(o1.mise_en_compte_at), 'enregistré par le livreur : ' + JSON.stringify(o1));
      const lbl = await page.evaluate(() => Array.from(document.querySelectorAll('.pro-compte-btn')).map((b) => b.textContent));
      assert(lbl.some((x) => /✓ En compte 10h00 · Livreur/.test(x)) && lbl.some((x) => x === '💶 Mise en compte'), 'une en compte, une à faire : ' + JSON.stringify(lbl));
      // première livraison cochée : il en reste une → pas de pop-up
      await page.evaluate(async () => { await markProOrderDelivered('o1', 'confirme'); });
      assert((await popup(page)) === '', 'il reste une livraison : pas de pop-up');
      // dernière livraison cochée → pop-up avec Le Clapotis seulement (BON D'ICI déjà en compte)
      await page.evaluate(async () => { await markProOrderDelivered('o2', 'confirme'); });
      let p = await popup(page);
      assert(/💶 Mise en compte — 1 commande pro/.test(p) && /Le Clapotis/.test(p) && /12 Tradition/.test(p) && !/BON D'ICI/.test(p) && /Plus tard/.test(p), 'pop-up à la dernière livraison : ' + p);
      await page.evaluate(async () => { const b = Array.from(document.querySelectorAll('#livreur-compte-modal .pro-compte-btn'))[0]; await toggleProMiseEnCompte('o2'); void b; });
      p = await popup(page);
      assert(p === '', 'tout en compte → pop-up fermée : ' + p);
      const o2 = await page.evaluate(() => window.__mockDB.pro_orders.find((o) => o.id === 'o2').mise_en_compte_by);
      assert(o2 === 'livreur', 'Clapotis en compte par le livreur');
      await page.close();
    },
  },
  {
    name: 'Tournée livreur à 17h30 — la pop-up s\'ouvre toute seule avec les commandes pas en compte, une seule fois ; « Plus tard » la ferme sans rien changer',
    fn: async (ctx) => {
      const page = await tournee(ctx, new Date('2026-07-22T17:30:00').getTime());
      let p = await popup(page);
      assert(/2 commandes pro/.test(p) && /BON D'ICI/.test(p) && /Le Clapotis/.test(p), 'pop-up à 17h30 : ' + p);
      await page.evaluate(() => { document.getElementById('livreur-compte-modal').classList.remove('show'); });
      await page.evaluate(async () => { await renderLivraison(); });
      p = await popup(page);
      assert(p === '', 'pas de second affichage dans la journée : ' + p);
      const rien = await page.evaluate(() => window.__mockDB.pro_orders.filter((o) => o.mise_en_compte_at).length);
      assert(rien === 0, '« Plus tard » ne change rien en base');
      await page.close();
    },
  },
];
