/* ============================================================
   v20.328 — Fêtes + Spéciales = une seule commande (Phil, 29-31/10/2026 : « si les clients veulent du pain
   et des bûches, on fait comment ? »).
   · pendant la fête, l'onglet Special est grisé et renvoie vers l'onglet de la fête (même écran)
   · le formulaire porte la carte de la fête (prix fixes, 🔪 sur les pains) + les produits hors carte
   · une commande = un numéro, un ticket, un total, un acompte ; prix figés sur la ligne, canal « boutique »
   · production : bûche (sans fiche) → Veigné, vue Production de la fête ; Tradition (reliée) → règle habituelle
   · BackOffice → Fêtes : grille Tarifs et noms, « +X % » avec aperçu, arrondi 5 centimes
   Base factice, rien vers Supabase. Horloge : mercredi 22/07/2026 10h00.
   ============================================================ */
import { preparePage, gotoApp, enterBoutique, assert } from '../helpers/harness.mjs';
import { makeDB, TENANT_ID, TEST_TODAY } from '../helpers/fixtures.mjs';
const T = TENANT_ID;

function db() {
  const d = makeDB();
  d.fete_events = [{ id: 'noel', tenant_id: T, label: '🎄 Noël', actif: true, date_debut: '2026-07-20', date_fin: '2026-07-31', butoir: null }];
  d.fete_products = [
    { id: 101, event_id: 'noel', groupe: 'BÛCHES PÂTISSIÈRES', nom: 'Bûche Tourangelle', taille: 'Grande', prix: 35, prod_site: 'veigne', product_id: null, ordre: 10, actif: true },
    { id: 102, event_id: 'noel', groupe: 'PAINS DE NOËL', nom: 'Baguette de tradition', taille: '', prix: 1.2, prod_site: 'local', product_id: 'vt_trad', ordre: 20, actif: true },
    { id: 103, event_id: 'noel', groupe: 'PAINS DE NOËL', nom: 'Norvégien', taille: 'demi', prix: 5.5, prod_site: 'local', product_id: null, ordre: 30, actif: true },
    { id: 104, event_id: 'noel', groupe: 'AUTRES DOUCEURS', nom: 'Mont-Blanc', taille: '', prix: 4.5, prod_site: 'veigne', product_id: null, ordre: 40, actif: false },
  ];
  d.fete_orders = [];
  return d;
}
async function ouvrir(ctx, site, d) {
  const page = await preparePage(ctx, { db: d || db() });
  await gotoApp(page);
  await enterBoutique(page, site);
  await page.evaluate(() => { window.__printed = []; _printDocument = (html) => { window.__printed.push(html); }; });
  return page;
}
// Commande type prise à St-Avertin : 1 bûche (Veigné) + 3 Traditions tranchées (Local pour St-Av)
async function creerCommande(page) {
  return page.evaluate(async () => {
    await setVue('fetes');
    openNewSpecialOrder();
    speCarteChg('101', 1);
    speCarteChg('102', 1); speCarteChg('102', 1); speCarteChg('102', 1);
    speCarteTr('102');
    Object.assign(specialFormDraft, { customer_name: 'Mme Martin', customer_phone: '06 12 34 56 78', pickup_date: '2026-07-30', pickup_time: '10:15', paiement: 'acompte', acompte_montant: '10' });
    renderSpecials();
    const total = document.querySelector('.sp-total-l') ? document.querySelector('.sp-total-l').textContent.replace(/\s+/g, ' ').trim() : null;
    const hint = document.querySelector('.sp-prod-hint') ? document.querySelector('.sp-prod-hint').textContent.replace(/\s+/g, ' ').trim() : null;
    await upsertSpecialOrder();
    const o = window.__mockDB.special_orders.find((x) => x.customer_name === 'Mme Martin');
    const items = window.__mockDB.special_order_items.filter((i) => i.order_id === o.id).sort((a, b) => a.position - b.position);
    return { total, hint, o, items };
  });
}

export const tests = [
  {
    name: 'Pendant la fête — Special grisé, un appui renvoie vers l\'onglet de la fête qui affiche l\'écran des commandes avec son bandeau',
    fn: async (ctx) => {
      const page = await ouvrir(ctx, 'saint-avertin');
      const r = await page.evaluate(async () => {
        const nav = Array.from(document.querySelectorAll('.bnav-item')).map((b) => b.dataset.vue + (b.classList.contains('bnav-ghost') ? ':gris' : ''));
        await setVue('specials');
        return { nav, vue: currentVue, bandeau: !!document.querySelector('.fete-banner'), semaine: !!document.querySelector('.sp-week-bar'),
          nouvelle: Array.from(document.querySelectorAll('button')).some((b) => /Nouvelle commande/.test(b.textContent)) };
      });
      assert(r.nav.indexOf('specials:gris') !== -1 && r.nav.indexOf('fetes') !== -1, 'Special grisé + onglet de la fête : ' + r.nav.join(','));
      assert(r.vue === 'fetes', 'Special renvoie vers la fête : ' + r.vue);
      assert(r.bandeau && r.semaine && r.nouvelle, 'bandeau de la fête + semaine + « Nouvelle commande » : ' + JSON.stringify(r));
      await page.close();
    },
  },
  {
    name: 'Formulaire — carte à prix (produit en pause masqué), total, une commande : prix figés, total, fête, canal, ateliers par ligne',
    fn: async (ctx) => {
      const page = await ouvrir(ctx, 'saint-avertin');
      const vu = await page.evaluate(async () => {
        await setVue('fetes'); openNewSpecialOrder();
        return { lignes: Array.from(document.querySelectorAll('#sp-carte .sp-carte-row .nom')).map((n) => n.textContent.trim()), vide: specialFormDraft.items.length,
          couteau: Array.from(document.querySelectorAll('#sp-carte .sp-carte-row')).map((r) => !!r.querySelector('.sp-carte-tr')) };
      });
      assert(vu.lignes.join('|') === 'Bûche Tourangelle Grande|Baguette de tradition🔪|Norvégien demi🔪', 'carte affichée, Mont-Blanc en pause masqué : ' + vu.lignes.join('|'));
      assert(vu.vide === 0, 'pas de ligne hors carte vide d\'office pendant la fête');
      assert(vu.couteau.join(',') === 'false,true,true', '🔪 seulement sur les pains : ' + vu.couteau.join(','));
      const r = await creerCommande(page);
      assert(r.total === 'Total38,60 €', 'total du formulaire : ' + r.total);
      assert(r.hint && /2 ateliers/.test(r.hint) && /Veigné — Bûche Tourangelle Grande/.test(r.hint) && /Le Local — Baguette de tradition/.test(r.hint), 'répartition par atelier : ' + r.hint);
      assert(r.o.total === 38.6 && r.o.event_id === 'noel' && r.o.canal === 'boutique' && r.o.num_jour === 1, 'commande : total, fête, canal, numéro : ' + JSON.stringify(r.o));
      const [b, t] = r.items;
      assert(b.fete_product_id === 101 && b.unit_price === 35 && b.prod_site === 'veigne' && !b.product_id && b.product_name_custom === 'Bûche Tourangelle Grande', 'ligne bûche : ' + JSON.stringify(b));
      assert(t.fete_product_id === 102 && t.unit_price === 1.2 && t.product_id === 'vt_trad' && t.prod_site === null && t.tranche === true && t.qty === 3, 'ligne Tradition reliée : ' + JSON.stringify(t));
      const ateliers = await page.evaluate(() => { const o = window.__mockDB.special_orders[0]; o.items = window.__mockDB.special_order_items; return o.items.map((it) => getItemProductionShop(it, o)); });
      assert(ateliers.join(',') === 'veigne,local', 'bûche → Veigné, Tradition de St-Av → Local : ' + ateliers.join(','));
      await page.close();
    },
  },
  {
    name: 'Tickets — client : bandeau de la fête, prix par ligne, total, acompte, reste ; retrait : sans prix, 🔪 À TRANCHER ; carte de commande : badge + reste',
    fn: async (ctx) => {
      const page = await ouvrir(ctx, 'saint-avertin');
      await creerCommande(page);
      const r = await page.evaluate(async () => {
        const txt = (h) => { const d = document.createElement('div'); d.innerHTML = h; return d.textContent.replace(/\s+/g, ' ').trim(); };
        const o = Object.assign({}, window.__mockDB.special_orders[0], { items: window.__mockDB.special_order_items.slice().sort((a, b) => a.position - b.position) });
        selectedSpecialDay = '2026-07-30'; currentSpecialWeekStart = getMondayOf('2026-07-30');
        await loadSpecialOrders(currentBoutique, currentSpecialWeekStart); renderSpecials();
        const carte = document.querySelector('.sp-card');
        return { client: txt(ticketLabelHtml(o, 'special', 'client')), sac: txt(ticketLabelHtml(o, 'special', 'sac')),
          carte: carte ? carte.textContent.replace(/\s+/g, ' ').trim() : null };
      });
      assert(/🎄 Noël/.test(r.client) && /1Bûche Tourangelle Grande35,00 €/.test(r.client) && /3Baguette de tradition — À TRANCHER3,60 €/.test(r.client), 'ticket client, lignes à prix : ' + r.client);
      assert(/Total : 38,60 €/.test(r.client) && /Acompte versé : 10,00 €/.test(r.client) && /Reste au retrait : 28,60 €/.test(r.client), 'ticket client, total / acompte / reste : ' + r.client);
      assert(!/35,00/.test(r.sac) && /À TRANCHER/.test(r.sac) && /06 12 34 56 78/.test(r.sac), 'ticket retrait sans prix, téléphone : ' + r.sac);
      assert(r.carte && /🎄 Noël · 38,60 €/.test(r.carte) && /Acompte 10 € · reste 28,60 €/.test(r.carte), 'carte de la commande : ' + r.carte);
      await page.close();
    },
  },
  {
    name: 'Production — Veigné voit la bûche dans la vue Production de la fête ; la Tradition reliée n\'y est pas (production habituelle)',
    fn: async (ctx) => {
      const d = db();
      d.special_orders = [{ id: 'm1', tenant_id: T, origin_shop: 'saint-avertin', production_shop: 'veigne', customer_name: 'Mme Martin', customer_phone: '0612345678', paiement: 'non_regle', pickup_date: TEST_TODAY, pickup_time: '10:15', status: 'confirmee', notes: 'Joyeux Noël Mamie', event_id: 'noel', total: 38.6, canal: 'boutique' }];
      d.special_order_items = [
        { id: 'a', order_id: 'm1', fete_product_id: 101, product_id: null, product_name_custom: 'Bûche Tourangelle Grande', qty: 1, unit_price: 35, prod_site: 'veigne', tranche: false, position: 0 },
        { id: 'b', order_id: 'm1', fete_product_id: 102, product_id: 'vt_trad', product_name_custom: 'Baguette de tradition', qty: 3, unit_price: 1.2, prod_site: null, tranche: true, position: 1 },
      ];
      const page = await ouvrir(ctx, 'veigne', d);
      const r = await page.evaluate(async () => {
        await setVue('fetes'); await feteSetView('prod');
        return { rows: Array.from(document.querySelectorAll('.fete-prod-row')).map((x) => x.textContent.replace(/\s+/g, ' ').trim()),
          notes: Array.from(document.querySelectorAll('.fete-prod-note-row')).map((x) => x.textContent.replace(/\s+/g, ' ').trim()) };
      });
      assert(r.rows.join('|') === 'Bûche Tourangelle Grande1 ✏️', 'Veigné : la bûche seule : ' + r.rows.join('|'));
      assert(r.notes.length === 1 && /Mme Martin/.test(r.notes[0]) && /Joyeux Noël Mamie/.test(r.notes[0]), 'note du client : ' + r.notes.join('|'));
      await page.close();
    },
  },
  {
    name: 'Modifier une commande — la carte revient remplie et les prix restent ceux du jour de la commande, même si le tarif a changé',
    fn: async (ctx) => {
      const page = await ouvrir(ctx, 'saint-avertin');
      await creerCommande(page);
      const r = await page.evaluate(async () => {
        feteProducts.find((fp) => fp.id === 101).prix = 40;   // tarif changé en BackOffice après la commande
        selectedSpecialDay = '2026-07-30'; currentSpecialWeekStart = getMondayOf('2026-07-30');
        await loadSpecialOrders(currentBoutique, currentSpecialWeekStart);
        openEditSpecialOrder(specialOrdersData[0].id);
        const avant = { buche: specialFormDraft.fete['101'] && specialFormDraft.fete['101'].prix, trad: specialFormDraft.fete['102'] && specialFormDraft.fete['102'].qty, horsCarte: specialFormDraft.items.length };
        speCarteChg('103', 1);   // + un demi norvégien au tarif du jour
        await upsertSpecialOrder();
        const o = window.__mockDB.special_orders[0];
        return { avant, total: o.total, n: window.__mockDB.special_order_items.filter((i) => i.order_id === o.id).length };
      });
      assert(r.avant.buche === 35 && r.avant.trad === 3 && r.avant.horsCarte === 0, 'brouillon : prix d\'origine, quantités, pas de ligne hors carte : ' + JSON.stringify(r.avant));
      assert(r.total === 44.1 && r.n === 3, 'total recalculé avec l\'ancien prix de la bûche (35 + 3,60 + 5,50) : ' + JSON.stringify(r));
      await page.close();
    },
  },
  {
    name: 'BackOffice → Fêtes — grille Tarifs et noms : une case enregistrée en la quittant ; +3 % avec aperçu puis appliqué, arrondi aux 5 centimes',
    fn: async (ctx) => {
      const page = await ouvrir(ctx, 'veigne');
      const r = await page.evaluate(async () => {
        feteAdminEvent = 'noel'; await renderAdminFetes();
        const nom = document.querySelector('.ft-row input');
        nom.value = 'Bûche Carrément Tourangelle'; await feteAdminSet(101, 'nom', nom);
        const px = document.querySelectorAll('.ft-row .ft-px')[1];
        px.value = '1,30'; await feteAdminSet(102, 'prix', px);
        const db = () => window.__mockDB.fete_products;
        const apres1 = { nom: db().find((p) => p.id === 101).nom, prix: db().find((p) => p.id === 102).prix };
        document.getElementById('ftBkP').value = '3'; document.getElementById('ftBkG').value = 'BÛCHES PÂTISSIÈRES';
        feteAdminBulkPreview(); await new Promise((res) => setTimeout(res, 200));
        const apercu = { neuf: document.querySelectorAll('.ft-px.ft-new').length, base: db().find((p) => p.id === 101).prix };
        await feteAdminBulkApply(); await new Promise((res) => setTimeout(res, 200));
        return { apres1, apercu, buche: db().find((p) => p.id === 101).prix, trad: db().find((p) => p.id === 102).prix };
      });
      assert(r.apres1.nom === 'Bûche Carrément Tourangelle' && r.apres1.prix === 1.3, 'nom et prix enregistrés : ' + JSON.stringify(r.apres1));
      assert(r.apercu.neuf === 1 && r.apercu.base === 35, 'aperçu : 1 prix en jaune, rien d\'écrit avant « Appliquer » : ' + JSON.stringify(r.apercu));
      assert(r.buche === 36.05 && r.trad === 1.3, '+3 % sur les bûches seulement, arrondi 5 centimes (35 → 36,05) : ' + JSON.stringify(r));
      await page.close();
    },
  },
];
