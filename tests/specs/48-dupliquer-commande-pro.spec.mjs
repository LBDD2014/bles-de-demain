/* ============================================================
   v20.303 — « 📑 Dupliquer » une commande pro dans l'app équipe (Phil, 29/10/2026 :
   « ajoute le même bouton dupliquer dans l'app équipe », après le 📑 Refaire de pro.html).
   · un bouton sur chaque carte de l'onglet Pros → formulaire « Nouvelle commande » déjà rempli
     (pro, produits, quantités, créneau), date = prochain jour coché de la fiche sans commande
   · la date reste modifiable, « Créer » enregistre une commande neuve, l'originale ne bouge pas
   Horloge des tests : mercredi 22/07/2026 10h00.
   ============================================================ */
import { preparePage, gotoApp, enterBoutique, assert } from '../helpers/harness.mjs';
import { makeDB, TENANT_ID } from '../helpers/fixtures.mjs';
const T = TENANT_ID;
const J = { actif: true, butoir_decalage: -1, butoir_heure: '23:59' };

function db() {
  const d = makeDB();
  d.pros = [{ id: 'strap', tenant_id: T, nom: 'Le Strapontin', actif: true, boutique_principale: 'tours', contacts: [], jours_livraison: { mardi: J, jeudi: J, samedi: J }, catalogue_restreint: ['vt_trad', 'vp_croissant'], prix_speciaux: {}, template_items: [], sources_par_categorie: {} }];
  d.pro_orders = [
    { id: 'auj', tenant_id: T, pro_id: 'strap', date_livraison: '2026-07-22', boutique_source: 'tours', statut: 'confirme', created_by: 'tours', notes: 'bien cuit' },
    { id: 'jeu', tenant_id: T, pro_id: 'strap', date_livraison: '2026-07-23', boutique_source: 'tours', statut: 'confirme', created_by: 'tours' },   // jeudi 23 déjà pris → samedi 25 est le prochain jour libre
  ];
  d.pro_order_items = [{ id: 'i1', pro_order_id: 'auj', product_id: 'vt_trad', qty: 20 }, { id: 'i2', pro_order_id: 'auj', product_id: 'vp_croissant', qty: 6 }, { id: 'i3', pro_order_id: 'jeu', product_id: 'vt_trad', qty: 5 }];
  return d;
}

export const tests = [
  {
    name: 'Onglet Pros — « 📑 Dupliquer » sur une carte : formulaire pré-rempli (pro, 20 trad + 6 croissants, créneau), date = samedi 25 (jeudi 23 déjà commandé), bandeau « copie de … », Créer = nouvelle commande, l\'originale intacte',
    fn: async (ctx) => {
      const page = await preparePage(ctx, { db: db() });
      await gotoApp(page);
      await enterBoutique(page, 'tours');
      await page.evaluate(async () => { currentVue = 'pros'; proOrderFilterPeriod = 'week'; await loadAdminPros(); await loadProOrders('tours'); renderProOrders(); });
      await page.waitForSelector('.pro-dup-btn');
      const r = await page.evaluate(async () => {
        const cards = Array.from(document.querySelectorAll('.pro-order-card'));
        const nbBtn = cards.filter((c) => c.querySelector('.pro-dup-btn')).length;
        const card22 = cards.find((c) => c.closest('.pro-orders-day, .section, div') && c.textContent.indexOf('20') !== -1 && c.textContent.indexOf('6') !== -1);
        await proOrderDuplicate('auj');
        await new Promise((res) => setTimeout(res, 150));
        return {
          nbBtn, nbCards: cards.length, editing: editingProOrderId,
          d: { id: proOrderDraft.id, pro: proOrderDraft.pro_id, date: proOrderDraft.date_livraison, cr: proOrderDraft.creneau, statut: proOrderDraft.statut, notes: proOrderDraft.notes, orig: proOrderDraft.orig_date || null, items: proOrderDraft.items.map((i) => i.product_id + ':' + i.qty + (i.id ? '#' : '')).join(',') },
          title: document.querySelector('.pro-form-title').textContent, banner: (document.querySelector('.pro-dup-banner') || {}).textContent || '',
          toast: (document.getElementById('toast') || document.querySelector('.toast') || {}).textContent || '',
        };
      });
      assert(r.nbBtn === r.nbCards && r.nbCards === 2, 'un bouton 📑 sur chaque carte : ' + r.nbBtn + ' / ' + r.nbCards);
      assert(r.editing === 'new' && r.d.id === null && r.d.orig === null, 'le formulaire est en création (pas une modification de l\'originale) : ' + JSON.stringify(r.d));
      assert(r.d.pro === 'strap' && r.d.cr === 'matin' && r.d.statut === 'confirme' && r.d.notes === '' && r.d.items === 'vt_trad:20,vp_croissant:6', 'pro, créneau, lignes copiées (sans id), note pas recopiée : ' + JSON.stringify(r.d));
      assert(r.d.date === '2026-07-25', 'date = samedi 25, prochain jour coché sans commande (jeudi 23 déjà pris) : ' + r.d.date);
      assert(/Copie d'une commande/.test(r.title) && /Le Strapontin/.test(r.banner) && /mercredi 22 juillet/.test(r.banner) && /samedi 25 juillet/.test(r.banner), 'titre + bandeau : ' + r.title + ' / ' + r.banner);
      // Créer → nouvelle commande le 25, l'originale du 22 inchangée
      const s = await page.evaluate(async () => {
        await saveProOrder();
        await new Promise((res) => setTimeout(res, 150));
        const items = (id) => window.__mockDB.pro_order_items.filter((i) => i.pro_order_id === id).map((i) => i.product_id + ':' + i.qty).join(',');
        return window.__mockDB.pro_orders.filter((o) => o.pro_id === 'strap' && o.statut !== 'annule').sort((a, b) => a.date_livraison.localeCompare(b.date_livraison)).map((o) => o.date_livraison + '|' + o.boutique_source + '|' + (o.creneau || 'matin') + '|' + items(o.id) + '|' + (o.notes || ''));
      });
      assert(JSON.stringify(s) === JSON.stringify(['2026-07-22|tours|matin|vt_trad:20,vp_croissant:6|bien cuit', '2026-07-23|tours|matin|vt_trad:5|', '2026-07-25|tours|matin|vt_trad:20,vp_croissant:6|']), 'nouvelle commande du 25 identique, les deux autres intactes : ' + JSON.stringify(s));
      await page.close();
    },
  },
  {
    name: 'Dupliquer — pro sans jour libre dans les 3 semaines : prochain jour coché quand même ; pro sans jours cochés : demain',
    fn: async (ctx) => {
      const d = db();
      // jeudi 23 et samedi 25, mardi 28… tous pris pendant 3 semaines
      const prises = [];
      for (let i = 1; i <= 21; i++) { const dt = new Date('2026-07-22T12:00'); dt.setDate(dt.getDate() + i); const iso = dt.toISOString().slice(0, 10); if ([2, 4, 6].indexOf(dt.getDay()) !== -1) prises.push(iso); }
      d.pro_orders = d.pro_orders.concat(prises.map((iso, i) => ({ id: 'p' + i, tenant_id: T, pro_id: 'strap', date_livraison: iso, boutique_source: 'tours', statut: 'confirme', created_by: 'tours' })));
      d.pros.push({ id: 'sansjour', tenant_id: T, nom: 'Sans Jour', actif: true, boutique_principale: 'tours', contacts: [], jours_livraison: {}, catalogue_restreint: null, prix_speciaux: {}, template_items: [], sources_par_categorie: {} });
      const page = await preparePage(ctx, { db: d });
      await gotoApp(page);
      await enterBoutique(page, 'tours');
      const r = await page.evaluate(async () => {
        currentVue = 'pros'; await loadAdminPros(); await loadProOrders('tours');
        const strap = adminPros.find((p) => p.id === 'strap'), sans = adminPros.find((p) => p.id === 'sansjour');
        return { plein: await proNextFreeDate(strap, 'matin'), aprem: await proNextFreeDate(strap, 'apres_midi'), sans: await proNextFreeDate(sans, 'matin') };
      });
      assert(r.plein === '2026-07-23', 'tout pris → le prochain jour coché (jeudi 23) : ' + r.plein);
      assert(r.aprem === '2026-07-23', 'l\'après-midi n\'est pas pris → jeudi 23 libre pour ce créneau : ' + r.aprem);
      assert(r.sans === '2026-07-23', 'pas de jours cochés → demain : ' + r.sans);
      await page.close();
    },
  },
  {
    name: 'Dupliquer — v20.304 : le bouton est aussi dans le détail d\'une commande (formulaire de modification), pas sur une nouvelle commande',
    fn: async (ctx) => {
      const page = await preparePage(ctx, { db: db() });
      await gotoApp(page);
      await enterBoutique(page, 'tours');
      const r = await page.evaluate(async () => {
        currentVue = 'pros'; proOrderFilterPeriod = 'week'; await loadAdminPros(); await loadProOrders('tours'); renderProOrders();
        await openProOrderForm('auj');
        await new Promise((res) => setTimeout(res, 100));
        const btn = document.querySelector('.pro-form .pro-dup-btn');
        const avant = { editing: editingProOrderId, bouton: !!btn, titre: document.querySelector('.pro-form-title').textContent };
        btn.click();
        await new Promise((res) => setTimeout(res, 150));
        const apres = { editing: editingProOrderId, date: proOrderDraft.date_livraison, items: proOrderDraft.items.map((i) => i.product_id + ':' + i.qty).join(','), titre: document.querySelector('.pro-form-title').textContent, boutonSurNeuve: !!document.querySelector('.pro-form .pro-dup-btn') };
        closeProOrderForm(); await openProOrderForm('new'); await new Promise((res) => setTimeout(res, 50));
        const neuve = { bouton: !!document.querySelector('.pro-form .pro-dup-btn') };
        return { avant, apres, neuve };
      });
      assert(r.avant.editing === 'auj' && r.avant.bouton && r.avant.titre === 'Le Strapontin', 'détail de la commande du 22 avec le bouton 📑 : ' + JSON.stringify(r.avant));
      assert(r.apres.editing === 'new' && r.apres.date === '2026-07-25' && r.apres.items === 'vt_trad:20,vp_croissant:6' && /Copie d'une commande/.test(r.apres.titre) && !r.apres.boutonSurNeuve, 'un tap → copie pour samedi 25, pas de bouton sur la copie : ' + JSON.stringify(r.apres));
      assert(!r.neuve.bouton, 'pas de bouton sur une commande neuve : ' + JSON.stringify(r.neuve));
      await page.close();
    },
  },
];
