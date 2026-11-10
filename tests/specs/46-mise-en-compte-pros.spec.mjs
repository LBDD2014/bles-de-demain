/* ============================================================
   v20.293 — « 💶 Mise en compte » des commandes pros (Phil, 26/10/2026 :
   « c'est notre façon à nous de dire que c'est entré dans la caisse »).
   · un bouton sur chaque carte de l'onglet Pros : un tap = passée en caisse (heure + boutique), un second = annulé
   · bandeau « oublis à rattraper » : les jours passés pas mis en compte, et aujourd'hui à partir de 17h
     ou dès que les ventes du jour sont validées ; rappel (toast) à la validation des ventes
   Horloge des tests : mercredi 22/07/2026 10h00 (Tours ouvert mardi 21).
   ============================================================ */
import { preparePage, gotoApp, enterBoutique, assert } from '../helpers/harness.mjs';
import { makeDB, TENANT_ID } from '../helpers/fixtures.mjs';
const T = TENANT_ID;
const JOURS = { mardi: { actif: true, butoir_decalage: -1, butoir_heure: '23:59' }, mercredi: { actif: true, butoir_decalage: -1, butoir_heure: '23:59' } };

function db() {
  const d = makeDB();
  d.pros = [
    { id: 'clapotis', tenant_id: T, nom: 'Le Clapotis', actif: true, boutique_principale: 'tours', contacts: [], jours_livraison: JOURS, catalogue_restreint: ['vt_trad'], prix_speciaux: {}, template_items: [], sources_par_categorie: {} },
    { id: 'strap', tenant_id: T, nom: 'Le Strapontin', actif: true, boutique_principale: 'tours', contacts: [], jours_livraison: JOURS, catalogue_restreint: ['vt_trad'], prix_speciaux: {}, template_items: [], sources_par_categorie: {} },
  ];
  d.pro_orders = [
    { id: 'hier', tenant_id: T, pro_id: 'clapotis', date_livraison: '2026-07-21', boutique_source: 'tours', statut: 'livre', created_by: 'tours' },
    { id: 'hier_ok', tenant_id: T, pro_id: 'strap', date_livraison: '2026-07-21', boutique_source: 'tours', statut: 'livre', created_by: 'tours', mise_en_compte_at: '2026-07-21T17:05:00Z', mise_en_compte_by: 'tours' },
    { id: 'auj', tenant_id: T, pro_id: 'strap', date_livraison: '2026-07-22', boutique_source: 'tours', statut: 'confirme', created_by: 'tours' },
    { id: 'auj_annulee', tenant_id: T, pro_id: 'clapotis', date_livraison: '2026-07-22', boutique_source: 'tours', statut: 'annule', created_by: 'tours' },
    { id: 'veigne', tenant_id: T, pro_id: 'clapotis', date_livraison: '2026-07-21', boutique_source: 'veigne', statut: 'confirme', created_by: 'veigne' },
  ];
  d.pro_order_items = [{ id: 'i1', pro_order_id: 'hier', product_id: 'vt_trad', qty: 10 }, { id: 'i2', pro_order_id: 'auj', product_id: 'vt_trad', qty: 20 }, { id: 'i3', pro_order_id: 'hier_ok', product_id: 'vt_trad', qty: 5 }];
  return d;
}
const barre = (page) => page.evaluate(async () => { await refreshOublis(true); const b = document.getElementById('oublis-bar'); return b && b.style.display !== 'none' ? b.textContent.replace(/\s+/g, ' ') : ''; });

export const tests = [
  {
    name: 'Carte de commande pro à Tours — bouton 💶 Mise en compte : un tap = heure + boutique en base et « ✓ En compte », un second tap = annulé ; pas de bouton sur une commande annulée',
    fn: async (ctx) => {
      const page = await preparePage(ctx, { db: db() });
      await gotoApp(page);
      await enterBoutique(page, 'tours');
      await page.evaluate(async () => { currentVue = 'pros'; proOrderFilterPeriod = 'week'; await loadAdminPros(); await loadProOrders('tours'); renderProOrders(); });
      await page.waitForSelector('.pro-compte-btn');
      const avant = await page.evaluate(() => Array.from(document.querySelectorAll('.pro-order-card')).map((c) => c.querySelector('.pro-order-name').textContent.trim() + ':' + (c.querySelector('.pro-compte-btn') ? c.querySelector('.pro-compte-btn').textContent : 'aucun')));
      assert(avant.some((x) => /^Le Strapontin:💶 Mise en compte$/.test(x)), 'commande du jour : bouton à faire : ' + JSON.stringify(avant));
      await page.evaluate(async () => { await toggleProMiseEnCompte('auj'); });
      const apres = await page.evaluate(() => ({ row: window.__mockDB.pro_orders.find((o) => o.id === 'auj'), btn: Array.from(document.querySelectorAll('.pro-compte-btn')).map((b) => b.className + ':' + b.textContent) }));
      assert(apres.row.mise_en_compte_by === 'tours' && /^2026-07-22T/.test(apres.row.mise_en_compte_at), 'heure + boutique enregistrées : ' + JSON.stringify(apres.row));
      assert(apres.btn.some((b) => /fait:✓ En compte 10h00 · Tours/.test(b)), 'bouton vert avec l\'heure : ' + JSON.stringify(apres.btn));
      await page.evaluate(async () => { await toggleProMiseEnCompte('auj'); });   // confirm() accepté par le harnais
      const annule = await page.evaluate(() => window.__mockDB.pro_orders.find((o) => o.id === 'auj').mise_en_compte_at);
      assert(annule === null, 'second tap = annulé : ' + annule);
      // la commande annulée (si on l'affichait) n'a pas de bouton
      const btnAnnulee = await page.evaluate(() => proMiseEnCompteBtnHtml({ id: 'x', statut: 'annule' }) + '|' + proMiseEnCompteBtnHtml({ id: 'y', statut: 'brouillon' }));
      assert(btnAnnulee === '|', 'pas de bouton sur annulée / brouillon');
      await page.close();
    },
  },
  {
    name: 'Bandeau oublis à Tours — hier pas mis en compte (Le Clapotis) apparaît, celle déjà en compte non, celle de Veigné non ; aujourd\'hui n\'apparaît qu\'à partir de 17h (ou ventes validées) ; mise en compte = la ligne disparaît',
    fn: async (ctx) => {
      // 10h : seulement hier
      let page = await preparePage(ctx, { db: db() });
      await gotoApp(page);
      await enterBoutique(page, 'tours');
      let txt = await barre(page);
      assert(/💶 Commandes pros pas mises en compte : mar\. 21\/07 — Le Clapotis/.test(txt) && !/Strapontin/.test(txt) && !/aujourd'hui/.test(txt), 'à 10h : hier seulement, sans le Strapontin (déjà en compte) : ' + txt);
      assert(/oubli/.test(txt), 'compté comme un oubli : ' + txt);
      // ventes du jour validées à 10h → aujourd'hui entre dans le bandeau
      await page.evaluate(() => { window.__mockDB.sales.push({ tenant_id: '00000000-0000-0000-0000-000000000001', boutique_id: 'tours', product_id: 'vt_trad', date: '2026-07-22', matin: 1, day_closed: true }); });
      txt = await barre(page);
      assert(/aujourd'hui — Le Strapontin/.test(txt), 'ventes validées → aujourd\'hui dans le bandeau : ' + txt);
      await page.evaluate(async () => { currentVue = 'pros'; await loadAdminPros(); await loadProOrders('tours'); await toggleProMiseEnCompte('auj'); });
      txt = await barre(page);
      assert(!/aujourd'hui/.test(txt) && /mar\. 21\/07 — Le Clapotis/.test(txt), 'mise en compte → aujourd\'hui sort, hier reste : ' + txt);
      await page.evaluate(async () => { await toggleProMiseEnCompte('hier'); });
      txt = await barre(page);
      assert(!/Mise en compte|mises en compte/.test(txt), 'tout en compte → plus de ligne : ' + txt);
      await page.close();
      // 17h30 : aujourd'hui apparaît tout seul
      page = await preparePage(ctx, { db: db(), nowMs: new Date('2026-07-22T17:30:00').getTime() });
      await gotoApp(page);
      await enterBoutique(page, 'tours');
      txt = await barre(page);
      assert(/mar\. 21\/07 — Le Clapotis · aujourd'hui — Le Strapontin/.test(txt), 'à 17h30 : hier et aujourd\'hui : ' + txt);
      // le rappel à la validation des ventes : noms des pros pas en compte
      const toast = await page.evaluate(async () => { currentDate = '2026-07-22'; await loadAdminPros(); await rappelProsEnCompte(); return document.getElementById('toast').textContent; });
      assert(/💶 1 commande pro pas encore mise en compte : Le Strapontin/.test(toast), 'rappel à la validation des ventes : ' + toast);
      await page.close();
    },
  },
  {
    name: 'v20.347 — commande INTERNE (groupe « interne ») : pas de bouton 💶 sur la carte, absente du bandeau des oublis et du rappel, et pas de prix appliqué',
    fn: async (ctx) => {
      const d = db();
      d.pros.push({ id: 'marc', tenant_id: T, nom: 'Marc Antoine', actif: true, boutique_principale: 'tours', groupe: 'interne', page_separee: true, contacts: [], jours_livraison: JOURS, catalogue_restreint: null, prix_speciaux: { vt_trad: 1.2 }, template_items: [], sources_par_categorie: {} });
      d.pro_orders.push({ id: 'int_hier', tenant_id: T, pro_id: 'marc', date_livraison: '2026-07-21', boutique_source: 'tours', statut: 'livre', created_by: 'tours' });
      d.pro_orders.push({ id: 'int_auj', tenant_id: T, pro_id: 'marc', date_livraison: '2026-07-22', boutique_source: 'tours', statut: 'confirme', created_by: 'tours' });
      d.pro_order_items.push({ id: 'i8', pro_order_id: 'int_hier', product_id: 'vt_trad', qty: 6 }, { id: 'i9', pro_order_id: 'int_auj', product_id: 'vt_trad', qty: 6 });
      const page = await preparePage(ctx, { db: d });
      await gotoApp(page); await enterBoutique(page, 'tours');
      // bandeau : hier, seulement Le Clapotis (pas Marc Antoine) ; ventes validées → aujourd'hui : seulement Le Strapontin
      let txt = await barre(page);
      assert(/mar\. 21\/07 — Le Clapotis/.test(txt) && !/Marc Antoine/.test(txt), 'oublis sans l\'interne : ' + txt);
      await page.evaluate(() => { window.__mockDB.sales.push({ tenant_id: '00000000-0000-0000-0000-000000000001', boutique_id: 'tours', product_id: 'vt_trad', date: '2026-07-22', matin: 1, day_closed: true }); });
      txt = await barre(page);
      assert(/aujourd'hui — Le Strapontin/.test(txt) && !/Marc Antoine/.test(txt), 'aujourd\'hui sans l\'interne : ' + txt);
      // cartes de l'onglet Pros : 💶 sur la commande du Strapontin, rien sur celle de Marc Antoine ; prix : aucun
      const r = await page.evaluate(async () => {
        await setVue('pros_orders'); await loadAdminPros(); await loadProOrders('tours');
        const marc = adminPros.find((p) => p.id === 'marc'), strap = adminPros.find((p) => p.id === 'strap');
        return { btnInterne: proMiseEnCompteBtnHtml(proOrdersData.find((o) => o.id === 'int_auj')), btnPro: proMiseEnCompteBtnHtml(proOrdersData.find((o) => o.id === 'auj')),
          prixInterne: getProAppliedPrice(marc, 'vt_trad'), prixPro: getProAppliedPrice(Object.assign({}, strap, { prix_speciaux: { vt_trad: 1.2 } }), 'vt_trad'), interne: proEstInterne(marc) };
      });
      assert(r.interne && r.btnInterne === '' && /Mise en compte/.test(r.btnPro), 'bouton 💶 : ' + JSON.stringify({ i: r.btnInterne, p: r.btnPro.slice(0, 40) }));
      assert(r.prixInterne === null && r.prixPro === 1.2, 'prix : interne ' + r.prixInterne + ', pro ' + r.prixPro);
      await page.close();
    },
  },
];
