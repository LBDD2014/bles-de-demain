/* ============================================================
   v20.332 — Commande spéciale encore plus vite (Phil, 31/10/2026, maquette speciales-favoris-mockup.html,
   « Oui, code les deux ») :
   · ⭐ les plus commandés ici : 8 touches, calculées sur les commandes de la boutique des 60 derniers jours
     (nombre de lignes), sans le surgelé ni les annulées ; un appui = +1, le chiffre sur la touche
   · 📑 refaire sa dernière commande : client reconnu → bandeau → un appui recopie produits, quantités, 🔪,
     notes produit, prix tapés ; pas la note de commande ; pas une commande annulée
   Base factice, rien vers Supabase. Horloge : mercredi 22/07/2026 10h00.
   ============================================================ */
import { preparePage, gotoApp, enterBoutique, assert } from '../helpers/harness.mjs';
import { makeDB, TENANT_ID } from '../helpers/fixtures.mjs';
const T = TENANT_ID;

function db() {
  const d = makeDB();
  const base = d.products.find((p) => p.id === 'vt_trad');
  d.products.push(Object.assign({}, base, { id: 'trad_surg', name: 'Tradition précuite surgelée', usage: 'reappro' }));
  const o = (id, shop, date, nom, extra) => Object.assign({ id, tenant_id: T, origin_shop: shop, production_shop: shop, customer_name: nom, customer_phone: '0611223344',
    paiement: 'non_regle', pickup_date: date, pickup_time: '09:00', status: 'livree', notes: null, created_at: date + 'T08:00:00Z' }, extra || {});
  d.special_orders = [
    o('a1', 'veigne', '2026-07-10', 'M. Lecureuil', { notes: 'Joyeux anniversaire' }),
    o('a2', 'veigne', '2026-07-15', 'Mme Dupont'),
    o('a3', 'veigne', '2026-07-18', 'Mme Durand'),
    o('a4', 'veigne', '2026-07-19', 'M. Lecureuil', { status: 'annulee', created_at: '2026-07-19T09:00:00Z' }),   // annulée : ni favoris ni « dernière »
    o('vieux', 'veigne', '2026-04-01', 'Ancien'),          // > 60 jours : ignoré
    o('tours', 'tours', '2026-07-16', 'Client Tours'),     // autre boutique : ignoré
  ];
  const l = (id, order_id, product_id, qty, extra) => Object.assign({ id, order_id, product_id, product_name_custom: null, qty, notes: null, tranche: false, unit_price: null, position: 0 }, extra || {});
  d.special_order_items = [
    l('1', 'a1', 'vt_trad', 3, { tranche: true }), l('2', 'a1', 'pat_eclair', 2, { notes: 'sans glaçage', unit_price: 3.5, position: 1 }),
    l('3', 'a2', 'vt_trad', 1), l('4', 'a2', 'vp_croissant', 6, { position: 1 }),
    l('5', 'a3', 'vt_trad', 1), l('6', 'a3', 'trad_surg', 4, { position: 1 }),
    l('7', 'a4', 'vt_fou', 9), l('8', 'a4', 'vt_fou', 9, { position: 1 }), l('9', 'a4', 'vt_fou', 9, { position: 2 }),
    l('10', 'vieux', 'vt_epeautre', 1), l('11', 'vieux', 'vt_epeautre', 1, { position: 1 }), l('12', 'vieux', 'vt_epeautre', 1, { position: 2 }), l('13', 'vieux', 'vt_epeautre', 1, { position: 3 }),
    l('14', 'tours', 'vp_painchoc', 1),
  ];
  return d;
}
async function ouvrir(ctx) {
  const page = await preparePage(ctx, { db: db() });
  await gotoApp(page); await enterBoutique(page, 'veigne');
  await page.evaluate(async () => { await setVue('specials'); openNewSpecialOrder(); });
  await page.waitForSelector('#sp-favs-box .sp-fav');
  return page;
}

export const tests = [
  {
    name: '⭐ Les plus commandés — calculés sur 60 jours, la boutique seulement, sans surgelé ni annulée ; un appui = +1 avec le chiffre sur la touche',
    fn: async (ctx) => {
      const page = await ouvrir(ctx);
      const r = await page.evaluate(() => {
        const touches = () => Array.from(document.querySelectorAll('#sp-favs-box .sp-fav')).map((b) => b.textContent.trim());
        const avant = touches();
        const titre = document.querySelector('#sp-favs-box .sp-fav-t').textContent;
        Array.from(document.querySelectorAll('#sp-favs-box .sp-fav'))[0].click();
        document.querySelectorAll('#sp-favs-box .sp-fav')[0].click();
        return { avant, titre, apres: touches(), lignes: specialFormDraft.items.map((i) => i.product_id + ':' + i.qty).join(',') };
      });
      assert(r.titre === '⭐ Les plus commandés à Veigné', 'titre : ' + r.titre);
      assert(r.avant.join('|') === 'Tradition|Croissant|Éclair Chocolat indiv.', 'Tradition (3 lignes) puis les autres, sans surgelé, Fougasse annulée, Épeautre trop vieux, Pain Chocolat de Tours : ' + r.avant.join('|'));
      assert(r.apres[0] === 'Tradition2' && r.lignes === 'vt_trad:2', 'deux appuis = 2 Tradition : ' + JSON.stringify(r));
      await page.close();
    },
  },
  {
    name: '📑 Refaire — client reconnu : bandeau avec sa dernière commande (pas l\'annulée) ; un appui recopie produits, 🔪, note produit et prix, pas la note de commande',
    fn: async (ctx) => {
      const page = await ouvrir(ctx);
      await page.evaluate(async () => {
        await loadSpecialClientsIndex();
        const el = document.getElementById('sp-client-nom'); el.value = 'lecu'; handleSpecialClientInput(el);
        pickSpecialClient(0);
      });
      await page.waitForSelector('#sp-refaire-box .sp-refaire-go');
      const r = await page.evaluate(() => {
        const bandeau = document.querySelector('#sp-refaire-box .sp-refaire').textContent.replace(/\s+/g, ' ').trim();
        specialRefaire();
        const d = specialFormDraft;
        return { bandeau, lignes: d.items.map((i) => i.product_id + ':' + i.qty + (i.tranche ? ':🔪' : '') + (i.notes ? ':' + i.notes : '') + (i.unit_price ? ':' + i.unit_price : '')).join(','),
          note: d.notes, tel: d.customer_phone, ok: document.querySelector('#sp-refaire-box').textContent.trim() };
      });
      assert(/Dernière commande de M\. Lecureuil/.test(r.bandeau) && /3 × Tradition 🔪/.test(r.bandeau) && /2 × Éclair Chocolat indiv\./.test(r.bandeau) && !/Fougasse/.test(r.bandeau), 'bandeau = commande du 10/07, pas l\'annulée du 19 : ' + r.bandeau);
      assert(r.lignes === 'vt_trad:3:🔪,pat_eclair:2:sans glaçage:3.5', 'lignes recopiées : ' + r.lignes);
      assert(!r.note && r.tel === '0611223344', 'note de commande pas recopiée, téléphone repris : ' + JSON.stringify(r));
      assert(/recopiée/.test(r.ok), 'bandeau de confirmation : ' + r.ok);
      await page.close();
    },
  },
];
