/* ============================================================
   v20.305 — Tickets Brother QL-820NWB (62 mm), numéro de commande du jour, récap du jour
   (Phil, 29/10/2026 : « imprimer un ticket pour les clients et pour nous à mettre sur les sacs »,
   « numéro du jour, jour, heure », « récap par heure / par nom, matin et/ou après-midi »,
   « les commandes faites cachées au fur et à mesure », « une loupe »).
   Horloge des tests : mercredi 22/07/2026 10h00. Rien vers Supabase (faux next_order_num).
   ============================================================ */
import { preparePage, gotoApp, enterBoutique, assert } from '../helpers/harness.mjs';
import { makeDB, TENANT_ID, TEST_TODAY } from '../helpers/fixtures.mjs';
const T = TENANT_ID;

function db() {
  const d = makeDB();
  d.special_orders = [
    { id: 's1', tenant_id: T, origin_shop: 'veigne', production_shop: 'veigne', customer_name: 'Mme Barbier', customer_phone: '0612345678', paiement: 'non_regle', pickup_date: TEST_TODAY, pickup_time: '11:15', status: 'confirmee', notes: null, taken_by: 'Noé' },
    { id: 's2', tenant_id: T, origin_shop: 'veigne', production_shop: 'local', customer_name: 'Dupont Claire', customer_phone: null, paiement: 'regle', pickup_date: TEST_TODAY, pickup_time: '09:30', status: 'confirmee', notes: 'sans graines' },
    { id: 's3', tenant_id: T, origin_shop: 'veigne', production_shop: 'veigne', customer_name: 'M. Aubry', customer_phone: null, paiement: 'acompte', acompte_montant: 10, pickup_date: TEST_TODAY, pickup_time: '15:00', status: 'prete', notes: null },
    { id: 's4', tenant_id: T, origin_shop: 'veigne', production_shop: 'veigne', customer_name: 'Sans Heure', customer_phone: null, paiement: 'non_regle', pickup_date: TEST_TODAY, pickup_time: null, status: 'confirmee', notes: null },
    { id: 'tours', tenant_id: T, origin_shop: 'tours', production_shop: 'tours', customer_name: 'Client Tours', customer_phone: null, paiement: 'non_regle', pickup_date: TEST_TODAY, pickup_time: '10:00', status: 'confirmee', notes: null },
    { id: 'annulee', tenant_id: T, origin_shop: 'veigne', production_shop: 'veigne', customer_name: 'Annulée', customer_phone: null, paiement: 'non_regle', pickup_date: TEST_TODAY, pickup_time: '10:00', status: 'annulee', notes: null },
  ];
  d.special_order_items = [
    { id: 'i1', order_id: 's1', product_id: 'vt_trad', qty: 2, notes: null, tranche: false, position: 0 },
    { id: 'i2', order_id: 's1', product_id: null, product_name_custom: 'Pain aux noix', qty: 1, notes: null, tranche: true, position: 1 },
    { id: 'i3', order_id: 's2', product_id: 'vp_croissant', qty: 12, notes: 'bien dorés', tranche: false, position: 0 },
    { id: 'i4', order_id: 's3', product_id: 'vt_trad', qty: 1, notes: null, tranche: false, position: 0 },
    { id: 'i5', order_id: 's4', product_id: 'vt_trad', qty: 3, notes: null, tranche: false, position: 0 },
  ];
  d.fete_orders = [
    { id: 'f1', tenant_id: T, event_id: 'noel', origin_shop: 'veigne', customer_name: 'M. Lefèvre', customer_phone: '0600000000', pickup_date: TEST_TODAY, pickup_time: '10:00', items: [{ fp_id: 'buche', nom: 'Bûche', taille: '6 pers.', prix: 26, qty: 1 }, { fp_id: 'cro', nom: 'Croissant', prix: 1, qty: 6 }], total: 32, paiement: 'acompte', acompte: 10, status: 'a_faire', notes: 'chocolat-praliné' },
  ];
  return d;
}
async function ouvrir(ctx, d) {
  const page = await preparePage(ctx, { db: d || db() });
  await gotoApp(page);
  await enterBoutique(page, 'veigne');
  await page.evaluate(() => { window.__printed = []; window.print = () => { window.__printed.push(document.getElementById('print-label').innerHTML); }; });
  return page;
}

export const tests = [
  {
    name: 'Numéros du jour — une suite par boutique et par jour de retrait, spéciales et fêtes mélangées, via next_order_num ; une commande déjà numérotée garde son numéro',
    fn: async (ctx) => {
      const page = await ouvrir(ctx);
      const r = await page.evaluate(async () => {
        const s = (id) => window.__mockDB.special_orders.find((o) => o.id === id);
        const a = await assignOrderNum('special_orders', s('s1'));
        const b = await assignOrderNum('fete_orders', window.__mockDB.fete_orders[0]);
        const c = await assignOrderNum('special_orders', s('s2'));
        const again = await assignOrderNum('special_orders', s('s1'));
        const tours = await assignOrderNum('special_orders', s('tours'));
        const autreJour = await nextOrderNum('veigne', '2026-07-23');
        return { a, b, c, again, tours, autreJour, base: [s('s1').num_jour, window.__mockDB.fete_orders[0].num_jour, s('s2').num_jour, s('tours').num_jour], compteur: window.__mockDB.order_day_counters.map((x) => x.shop + '|' + x.jour + '|' + x.last) };
      });
      assert(r.a === 1 && r.b === 2 && r.c === 3, 'Veigné 22/07 : 1 (spéciale), 2 (fête), 3 (spéciale) : ' + JSON.stringify(r));
      assert(r.again === 1, 'déjà numérotée → inchangée : ' + r.again);
      assert(r.tours === 1 && r.autreJour === 1, 'Tours même jour = 1, Veigné le lendemain = 1 : ' + JSON.stringify(r));
      assert(JSON.stringify(r.base) === '[1,2,3,1]', 'numéros écrits en base : ' + JSON.stringify(r.base));
      await page.close();
    },
  },
  {
    name: 'Étiquettes 62 mm — client (paiement, téléphone boutique) et sac (téléphone client, prise par, fait ailleurs) ; fête : cadre, total, acompte, reste ; 🖨 = fenêtre Client / Client + sac, le client part toujours',
    fn: async (ctx) => {
      const page = await ouvrir(ctx);
      const r = await page.evaluate(async () => {
        const s2 = window.__mockDB.special_orders.find((o) => o.id === 's2'); s2.items = window.__mockDB.special_order_items.filter((i) => i.order_id === 's2'); s2.num_jour = 7;
        const txt = (h) => { const d = document.createElement('div'); d.innerHTML = h.replace(/>/g, '> '); return d.textContent.replace(/\s+/g, ' ').trim(); };
        const client = txt(ticketLabelHtml(s2, 'special', 'client')), sac = txt(ticketLabelHtml(s2, 'special', 'sac'));
        const f = window.__mockDB.fete_orders[0]; f.num_jour = 2;
        const fete = txt(ticketLabelHtml(f, 'fete', 'client'));
        // 🖨 depuis l'écran : la fenêtre, puis « Client + sac »
        specialOrdersData = [s2];
        openTicketChoice('special', 's2');
        const modal = document.getElementById('ticket-choice-modal');
        const boutons = Array.from(modal.querySelectorAll('button')).map((b) => b.textContent.trim());
        await printOrderTickets('special', 's2', true);
        await new Promise((res) => setTimeout(res, 150));
        const n1 = (window.__printed[0].match(/class="lb( lb-sac)?"/g) || []).length;
        await printOrderTickets('special', 's2', false);
        await new Promise((res) => setTimeout(res, 150));
        const n2 = (window.__printed[1].match(/class="lb( lb-sac)?"/g) || []).length;
        // v20.309 — Android : l'aperçu se fabrique après window.print() → le mode étiquette doit rester posé, puis tomber sur afterprint
        await printOrderTickets('special', 's2', false);
        await new Promise((res) => setTimeout(res, 500));
        const modeApres = document.body.classList.contains('printing-label') && document.title.trim() === '' && /body::before/.test(document.getElementById('label-page-style').textContent);
        window.dispatchEvent(new Event('afterprint'));   // v20.310 : ignoré (Chrome Android l'envoie trop tôt)
        const modeIgnore = document.body.classList.contains('printing-label');
        await new Promise((res) => setTimeout(res, 1200));
        document.dispatchEvent(new Event('touchstart'));   // premier geste sur la page = retour de la fenêtre d'impression
        const modeFini = !document.body.classList.contains('printing-label') && document.title.trim() !== '' && document.getElementById('label-page-style').textContent === '';
        return { client, sac, fete, boutons, n1, n2, modeApres, modeIgnore, modeFini, ouvert: modal.classList.contains('show'), pageStyle: document.getElementById('label-page-style').textContent, logo: /class="lb-brand"><img src="data:image\/png;base64,/.test(ticketLabelHtml(s2, 'special', 'client')) };
      });
      assert(/^Veigné/.test(r.client) && r.logo && /Votre commande 07/.test(r.client) && /09h30 mercredi 22 juil\./.test(r.client) && /Dupont Claire/.test(r.client), 'client : site, n° 07, heure, jour, nom : ' + r.client);
      assert(/12 Croissant/.test(r.client) && /bien dorés/.test(r.client) && /Réglé ✓/.test(r.client) && /Retrait : Veigné · 07 57 77 05 39/.test(r.client) && /à mercredi !/.test(r.client), 'client : lignes, note, paiement, téléphone boutique : ' + r.client);
      assert(/N° du jour 07/.test(r.sac) && /SAC · fait à Le Local/.test(r.sac) && /Réglé ✓/.test(r.sac) && !/Retrait :/.test(r.sac), 'sac : n° du jour, fait ailleurs, réglé ou non (sans montant), pas le pied client : ' + r.sac);
      assert(/Fêtes · noel/.test(r.fete) && /Votre commande 02/.test(r.fete) && /1 Bûche 6 pers\./.test(r.fete) && /6 Croissant/.test(r.fete) && /Total : 32,00 €/.test(r.fete) && /Acompte versé : 10,00 €/.test(r.fete) && /Reste au retrait : 22,00 €/.test(r.fete) && /chocolat-praliné/.test(r.fete), 'fête : cadre, lignes, total, acompte, reste, note : ' + r.fete);
      assert(r.boutons.map((b) => b.replace(/\s+/g, ' ')).join('|') === '🏷️ Ticket client · Brother 62 mm|🏷️ Client + étiquette sac · Brother 62 mm|📄 Ticket A4 · imprimante classique|Fermer', 'fenêtre 🖨 avec le rappel de l\'imprimante : ' + r.boutons.join('|'));
      assert(r.n1 === 2 && r.n2 === 1, 'Client + sac = 2 étiquettes, Client = 1 : ' + r.n1 + '/' + r.n2);
      assert(r.modeApres && r.modeIgnore && r.modeFini, 'mode étiquette gardé après window.print et après afterprint (Android), levé au premier geste : ' + JSON.stringify({ a: r.modeApres, i: r.modeIgnore, f: r.modeFini }));
      await page.close();
    },
  },
  {
    name: 'Récap du jour — par heure / par nom, Tout / Matin / Après-midi (coupure 14h par défaut, réglable par site), loupe sans re-rendu, « Mis de côté » cache la ligne, « Voir les faites », tous les sacs dans l\'ordre des heures',
    fn: async (ctx) => {
      const page = await ouvrir(ctx);
      const r = await page.evaluate(async () => {
        await openRecapJour('special');
        await new Promise((res) => setTimeout(res, 200));
        const rows = () => Array.from(document.querySelectorAll('#recap-jour-modal .rj-row')).filter((x) => x.style.display !== 'none').map((x) => x.querySelector('.rj-client').textContent.trim().split(' ').slice(0, 2).join(' '));
        const heure = rows();
        recapSet('sort', 'nom');
        const nom = rows();
        recapSet('sort', 'heure');
        recapSet('period', 'pm');
        const pm14 = rows();
        recapSet('period', 'am');
        const am14 = rows();
        // coupure réglée à 11h pour Veigné : Mme Barbier (11h15) passe l'après-midi
        ticketReglages.veigne = '11:00';
        recapSet('period', 'pm');
        const pm11 = rows();
        ticketReglages.veigne = '14:00';
        recapSet('period', 'all');
        // loupe : filtre sans re-rendu
        const inp = document.querySelector('#recap-jour-modal input[type=search]');
        inp.value = 'barb'; inp.dispatchEvent(new Event('input'));
        const loupe = rows(); const memeInput = document.querySelector('#recap-jour-modal input[type=search]') === inp;
        inp.value = ''; inp.dispatchEvent(new Event('input'));
        // mis de côté : la ligne disparaît
        const btn = Array.from(document.querySelectorAll('#recap-jour-modal .rj-row')).find((x) => /Barbier/.test(x.textContent)).querySelector('button.btn-gold-sm');
        btn.click();
        await new Promise((res) => setTimeout(res, 150));
        const apres = rows();
        const enBase = window.__mockDB.special_orders.find((o) => o.id === 's1').status;
        const cb = document.querySelector('#recap-jour-modal .rj-done input'); cb.checked = true; cb.dispatchEvent(new Event('change'));
        const avecFaites = rows();
        const faitesLbl = document.querySelector('#recap-jour-modal .rj-done').textContent.trim();
        cb.checked = false; cb.dispatchEvent(new Event('change'));
        // tous les sacs (liste visible, ordre des heures), numéros attribués au passage
        window.__printed = [];
        await recapPrintSacs();
        await new Promise((res) => setTimeout(res, 150));
        const sacs = window.__printed[0];
        const ordre = (sacs.match(/class="lb-client">[^<]+/g) || []).map((x) => x.replace('class="lb-client">', ''));
        const nums = window.__mockDB.special_orders.filter((o) => o.origin_shop === 'veigne' && o.status === 'confirmee').map((o) => o.customer_name + ':' + o.num_jour);
        const nbSac = (sacs.match(/lb-sac/g) || []).length, nbClient = (sacs.match(/Votre commande/g) || []).length;
        recapSet('period', 'all'); recapSet('sort', 'heure'); recapSet('showDone', '1');   // Barbier (mise de côté) doit figurer sur la feuille
        const feuille = recapSheetHtml();
        return { heure, nom, pm14, am14, pm11, loupe, memeInput, apres, enBase, avecFaites, faitesLbl, ordre, nums, nbSac, nbClient, feuille };
      });
      assert(r.heure.join(',') === 'Dupont Claire,Mme Barbier,Sans Heure', 'par heure, faites cachées (Aubry mis de côté), annulée absente, sans heure en fin : ' + r.heure.join(','));
      assert(r.nom.join(',') === 'Mme Barbier,Dupont Claire,Sans Heure', 'par nom (Mme ignoré : Barbier < Dupont < Sans) : ' + r.nom.join(','));
      assert(r.pm14.length === 0 && r.am14.join(',') === 'Dupont Claire,Mme Barbier,Sans Heure', 'coupure 14h : tout le matin : ' + JSON.stringify({ pm: r.pm14, am: r.am14 }));
      assert(r.pm11.join(',') === 'Mme Barbier', 'coupure 11h réglée pour Veigné : Barbier (11h15) après-midi : ' + r.pm11.join(','));
      assert(r.loupe.join(',') === 'Mme Barbier' && r.memeInput, 'loupe « barb » sans re-rendu : ' + r.loupe.join(','));
      assert(r.apres.join(',') === 'Dupont Claire,Sans Heure' && r.enBase === 'prete', 'mis de côté → cachée, statut prete en base : ' + r.apres.join(',') + ' / ' + r.enBase);
      assert(r.avecFaites.length === 4 && /Voir les faites \(2\)/.test(r.faitesLbl), 'voir les faites : 4 lignes, (2) : ' + r.avecFaites.join(',') + ' / ' + r.faitesLbl);
      assert(r.ordre.join(',') === 'Dupont Claire,Sans Heure' && r.nbSac === 2 && r.nbClient === 0, 'tous les sacs : les 2 à faire, ordre des heures, étiquettes sac seulement : ' + JSON.stringify({ ordre: r.ordre, s: r.nbSac, c: r.nbClient }));
      assert(r.nums.every((x) => /:\d+$/.test(x)), 'numéros attribués au passage : ' + r.nums.join(','));
      assert(/<img src="data:image\/png;base64,/.test(r.feuille) && /Retraits à Veigné/.test(r.feuille) && /📞 0612345678/.test(r.feuille) && /👤 Noé/.test(r.feuille) && /À régler au retrait/.test(r.feuille) && /11h15/.test(r.feuille) && /sans graines/.test(r.feuille), 'feuille A4 : logo, lieu de retrait, téléphone, prise par, paiement, heure, note : ' + r.feuille.slice(0, 200));
      await page.close();
    },
  },
  {
    name: 'Enregistrer une commande spéciale lui donne son numéro ; déplacer son jour de retrait en donne un nouveau ; fêtes : récap et ticket client à la création',
    fn: async (ctx) => {
      const page = await ouvrir(ctx);
      const r = await page.evaluate(async () => {
        setVue('specials'); openNewSpecialOrder();
        Object.assign(specialFormDraft, { customer_name: 'Nouveau Client', customer_phone: '0611223344', pickup_date: '2026-07-24', pickup_time: '10:00', taken_by: 'Noé', items: [{ product_id: 'vt_trad', product_name_custom: '', qty: '2', notes: '', category: '', tranche: false }] });
        await upsertSpecialOrder();
        await new Promise((res) => setTimeout(res, 200));
        const o = window.__mockDB.special_orders.find((x) => x.customer_name === 'Nouveau Client');
        const num1 = o && o.num_jour;
        // déplacée au 25 → nouveau numéro (suite du 25)
        specialOrdersData = [Object.assign({ items: [] }, o)];
        specialFormMode = 'edit';
        specialFormDraft = { id: o.id, origin_shop: 'veigne', customer_name: o.customer_name, customer_phone: o.customer_phone, paiement: 'non_regle', acompte_montant: '', pickup_date: '2026-07-25', pickup_time: '10:00', status: 'confirmee', notes: '', taken_by: 'Noé', items: [{ product_id: 'vt_trad', product_name_custom: '', qty: '2', notes: '', category: '', tranche: false }] };
        await upsertSpecialOrder();
        await new Promise((res) => setTimeout(res, 200));
        const o2 = window.__mockDB.special_orders.find((x) => x.customer_name === 'Nouveau Client');
        const compteur = window.__mockDB.order_day_counters.map((x) => x.shop + '|' + x.jour + '|' + x.last);
        // fêtes : récap du jour
        await openRecapJour('fete');
        await new Promise((res) => setTimeout(res, 200));
        const fete = Array.from(document.querySelectorAll('#recap-jour-modal .rj-row')).map((x) => x.querySelector('.rj-client').textContent.trim() + ' / ' + x.querySelector('.rj-cmd').textContent + ' / ' + x.querySelector('.rj-pay').textContent);
        closeRecapJour();
        return { num1, date2: o2.pickup_date, num2: o2.num_jour, compteur, fete };
      });
      assert(r.num1 === 1, 'nouvelle commande du 24 : n° 1 : ' + r.num1);
      assert(r.date2 === '2026-07-25' && r.num2 === 1 && r.compteur.indexOf('veigne|2026-07-24|1') !== -1 && r.compteur.indexOf('veigne|2026-07-25|1') !== -1, 'déplacée au 25 : nouveau numéro dans la suite du 25 : ' + JSON.stringify(r));
      assert(r.fete.length === 1 && /M\. Lefèvre Fête/.test(r.fete[0]) && /1 Bûche 6 pers\. · 6 Croissant/.test(r.fete[0]) && /Reste au retrait : 22,00 €/.test(r.fete[0]), 'récap fêtes : ' + JSON.stringify(r.fete));
      await page.close();
    },
  },
];
