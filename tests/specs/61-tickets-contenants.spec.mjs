/* ============================================================
   v20.348 — « Combien de contenants ? » : plusieurs tickets retrait par commande, numérotés 1/3, 2/3, 3/3
   (Phil, 22/11/2026 : « par défaut 1 étiquette, mais ils peuvent choisir plus manuellement » ; l'app
   « apprend au quotidien auprès des équipes par rapport aux clics qu'ils font sur la tablette »).
   Horloge des tests : mercredi 22/07/2026 10h00. Rien vers Supabase.
   ============================================================ */
import { preparePage, gotoApp, enterBoutique, assert } from '../helpers/harness.mjs';
import { makeDB, TENANT_ID, TEST_TODAY } from '../helpers/fixtures.mjs';
const T = TENANT_ID;

function db() {
  const d = makeDB();
  d.special_orders = [
    // la commande du jour : 1 bûche (hors carte) + des pains → clé « buche1+pain »
    { id: 's1', tenant_id: T, origin_shop: 'veigne', production_shop: 'veigne', customer_name: 'Mme Barbier', customer_phone: '0612345678', paiement: 'non_regle', pickup_date: TEST_TODAY, pickup_time: '11:15', status: 'confirmee', notes: null, num_jour: 4 },
    // pains seuls → clé « pain »
    { id: 's2', tenant_id: T, origin_shop: 'veigne', production_shop: 'veigne', customer_name: 'Dupont Claire', customer_phone: null, paiement: 'regle', pickup_date: TEST_TODAY, pickup_time: '09:30', status: 'confirmee', notes: null, num_jour: 2 },
    // ce que les vendeuses de Veigné ont choisi ces dernières semaines pour « buche1+pain » : 3, 3, 2 → l'app proposera 3
    { id: 'h1', tenant_id: T, origin_shop: 'veigne', production_shop: 'veigne', customer_name: 'H1', paiement: 'regle', pickup_date: '2026-07-10', status: 'recuperee', nb_contenants: 3, contenants_cle: 'buche1+pain' },
    { id: 'h2', tenant_id: T, origin_shop: 'veigne', production_shop: 'veigne', customer_name: 'H2', paiement: 'regle', pickup_date: '2026-07-12', status: 'recuperee', nb_contenants: 3, contenants_cle: 'buche1+pain' },
    { id: 'h3', tenant_id: T, origin_shop: 'veigne', production_shop: 'veigne', customer_name: 'H3', paiement: 'regle', pickup_date: '2026-07-15', status: 'recuperee', nb_contenants: 2, contenants_cle: 'buche1+pain' },
    // une seule habitude ne suffit pas (il en faut 2) ; et Tours n'apprend rien de Veigné
    { id: 'h4', tenant_id: T, origin_shop: 'veigne', production_shop: 'veigne', customer_name: 'H4', paiement: 'regle', pickup_date: '2026-07-15', status: 'recuperee', nb_contenants: 4, contenants_cle: 'pain' },
    { id: 'h5', tenant_id: T, origin_shop: 'tours', production_shop: 'tours', customer_name: 'H5', paiement: 'regle', pickup_date: '2026-07-15', status: 'recuperee', nb_contenants: 5, contenants_cle: 'buche1+pain' },
    // trop vieux (plus de 120 jours) : ignoré
    { id: 'h6', tenant_id: T, origin_shop: 'veigne', production_shop: 'veigne', customer_name: 'H6', paiement: 'regle', pickup_date: '2026-01-05', status: 'recuperee', nb_contenants: 7, contenants_cle: 'pain' },
    { id: 'h7', tenant_id: T, origin_shop: 'veigne', production_shop: 'veigne', customer_name: 'H7', paiement: 'regle', pickup_date: '2026-01-06', status: 'recuperee', nb_contenants: 7, contenants_cle: 'pain' },
  ];
  d.special_order_items = [
    { id: 'i1', order_id: 's1', product_id: 'vt_trad', qty: 2, notes: null, tranche: false, position: 0 },
    { id: 'i2', order_id: 's1', product_id: null, product_name_custom: 'Bûche Écureuil', qty: 1, notes: null, tranche: false, position: 1 },
    { id: 'i3', order_id: 's2', product_id: 'vt_trad', qty: 3, notes: null, tranche: false, position: 0 },
  ];
  return d;
}
async function ouvrir(ctx, boutique) {
  const page = await preparePage(ctx, { db: db() });
  await gotoApp(page);
  await enterBoutique(page, boutique || 'veigne');
  await page.evaluate(() => { window.__printed = []; _printDocument = (html) => { window.__printed.push(html); }; });
  return page;
}
const nbSacs = (h) => (h.match(/class="lb lb-sac"/g) || []).length;
const parts = (h) => (h.match(/class="lb-part">([^<]+)</g) || []).map((x) => x.replace(/.*>([^<]+)</, '$1'));

export const tests = [
  {
    name: 'Clé du type de contenu — familles (bûche / gâteau / pain / viennoiserie / traiteur), le nombre compte pour ce qui va en boîte, hors carte lu d\'après le nom',
    fn: async (ctx) => {
      const page = await ouvrir(ctx);
      const r = await page.evaluate(() => {
        const o = (items) => ({ id: 'x', origin_shop: 'veigne', items });
        return {
          vide: contenantsCle(o([]), 'special'),
          pain: contenantsCle(o([{ product_id: 'vt_trad', qty: 6 }]), 'special'),
          b1p: contenantsCle(o([{ product_id: 'vt_trad', qty: 2 }, { product_name_custom: 'Bûche Écureuil', qty: 1 }]), 'special'),
          b2: contenantsCle(o([{ product_name_custom: 'Bûche Tourangelle', qty: 1 }, { product_name_custom: 'bûche écureuil', qty: 1 }]), 'special'),
          b3v: contenantsCle(o([{ product_name_custom: 'Bûche', qty: 5 }, { product_id: 'vp_croissant', qty: 12 }]), 'special'),
          gateau: contenantsCle(o([{ product_name_custom: 'Pièce montée 20 pers.', qty: 1 }]), 'special'),
          trait: contenantsCle(o([{ product_name_custom: 'Mini feuilletés x25', qty: 2 }, { product_name_custom: 'Pain aux noix', qty: 1 }]), 'special'),
          fete: contenantsCle({ items: [{ nom: 'Bûche', qty: 2 }, { nom: 'Croissant', qty: 6 }] }, 'fete'),
        };
      });
      assert(r.vide === 'vide' && r.pain === 'pain' && r.b1p === 'buche1+pain', 'pains seuls, bûche + pains : ' + JSON.stringify(r));
      assert(r.b2 === 'buche2' && r.b3v === 'buche3+vienn' && r.gateau === 'gateau1', '2 bûches, 3+ bûches + viennoiserie, gâteau hors carte : ' + JSON.stringify(r));
      assert(r.trait === 'pain+traiteur' && r.fete === 'buche2+vienn', 'traiteur + pain hors carte, ancienne commande de fête : ' + JSON.stringify(r));
      await page.close();
    },
  },
  {
    name: 'Fenêtre 🖨 — compteur à 1 par défaut, « − / + » plafonné à 9, Ticket retrait = N tickets numérotés 1/3 2/3 3/3 (rien quand il n\'y en a qu\'un), choix enregistré sur la commande avec sa clé',
    fn: async (ctx) => {
      const page = await ouvrir(ctx);
      const r = await page.evaluate(async () => {
        const s2 = window.__mockDB.special_orders.find((o) => o.id === 's2'); s2.items = window.__mockDB.special_order_items.filter((i) => i.order_id === 's2');
        specialOrdersData = [s2];
        openTicketChoice('special', 's2');
        await new Promise((res) => setTimeout(res, 150));
        const step = document.getElementById('cont-choice-s2');
        const avant = step.querySelector('b').textContent + '|' + step.querySelector('small').textContent;
        await printOrderTickets('special', 's2', 'sac');
        await new Promise((res) => setTimeout(res, 150));
        const un = { sacs: (window.__printed[0].match(/class="lb lb-sac"/g) || []).length, parts: (window.__printed[0].match(/lb-part/g) || []).length, enreg: s2.nb_contenants + '|' + s2.contenants_cle };
        // la vendeuse monte à 3 (et teste le plafond)
        openTicketChoice('special', 's2');
        contenantsStep('choice', 's2', 1); contenantsStep('choice', 's2', 1);
        const apres = document.getElementById('cont-choice-s2').querySelector('b').textContent + '|' + document.getElementById('cont-choice-s2').querySelector('small').textContent;
        for (let i = 0; i < 20; i++) contenantsStep('choice', 's2', 1);
        const plafond = document.getElementById('cont-choice-s2').querySelector('b').textContent;
        for (let i = 0; i < 20; i++) contenantsStep('choice', 's2', -1);
        const plancher = document.getElementById('cont-choice-s2').querySelector('b').textContent;
        contenantsStep('choice', 's2', 1); contenantsStep('choice', 's2', 1);
        window.__printed = [];
        await printOrderTickets('special', 's2', 'sac');
        await new Promise((res) => setTimeout(res, 150));
        const h = window.__printed[0];
        const trois = { sacs: (h.match(/class="lb lb-sac"/g) || []).length, parts: (h.match(/class="lb-part">([^<]+)</g) || []).map((x) => x.replace(/.*>([^<]+)</, '$1')).join(' '), client: (h.match(/Votre commande/g) || []).length, enreg: s2.nb_contenants + '|' + s2.contenants_cle, css: /\.lb-part \{/.test(TICKET_PRINT_CSS) };
        // Client + sac (true) : le ticket client reste unique, les sacs suivent le choix
        window.__printed = [];
        await printOrderTickets('special', 's2', true);
        await new Promise((res) => setTimeout(res, 150));
        const deux = (window.__printed[0].match(/Votre commande/g) || []).length + '/' + (window.__printed[0].match(/class="lb lb-sac"/g) || []).length;
        return { avant, un, apres, plafond, plancher, trois, deux };
      });
      assert(r.avant === '1|1 par défaut', 'compteur à 1, « 1 par défaut » : ' + r.avant);
      assert(r.un.sacs === 1 && r.un.parts === 0 && r.un.enreg === '1|pain', 'un seul ticket, sans rang, choix 1 enregistré avec la clé « pain » : ' + JSON.stringify(r.un));
      assert(/^3\|choisi à la main → 3 tickets/.test(r.apres) && r.plafond === '9' && r.plancher === '1', '− / + : 3 choisi à la main, plafond 9, plancher 1 : ' + r.apres + ' ' + r.plafond + ' ' + r.plancher);
      assert(r.trois.sacs === 3 && r.trois.parts === '1/3 2/3 3/3' && r.trois.client === 0 && r.trois.enreg === '3|pain' && r.trois.css, '3 tickets retrait numérotés, pas de client, 3 enregistré : ' + JSON.stringify(r.trois));
      assert(r.deux === '1/3', 'Client + sac : 1 client + 3 sacs : ' + r.deux);
      await page.close();
    },
  },
  {
    name: 'Apprentissage — même type de contenu dans la même boutique → le nombre le plus souvent choisi (« d\'après vos habitudes »), dès 2 fois, 120 jours, par boutique ; un choix fait aujourd\'hui compte tout de suite ; la main garde le dernier mot',
    fn: async (ctx) => {
      const page = await ouvrir(ctx);
      const r = await page.evaluate(async () => {
        const s1 = window.__mockDB.special_orders.find((o) => o.id === 's1'); s1.items = window.__mockDB.special_order_items.filter((i) => i.order_id === 's1');
        const s2 = window.__mockDB.special_orders.find((o) => o.id === 's2'); s2.items = window.__mockDB.special_order_items.filter((i) => i.order_id === 's2');
        specialOrdersData = [s1, s2];
        openTicketChoice('special', 's1');
        await new Promise((res) => setTimeout(res, 200));   // les habitudes de Veigné arrivent après coup
        const buche = document.getElementById('cont-choice-s1').querySelector('b').textContent + '|' + document.getElementById('cont-choice-s1').querySelector('small').textContent;
        openTicketChoice('special', 's2');
        await new Promise((res) => setTimeout(res, 100));
        const pain = document.getElementById('cont-choice-s2').querySelector('b').textContent + '|' + document.getElementById('cont-choice-s2').querySelector('small').textContent;
        const stats = JSON.stringify(contenantsStats.veigne);
        // la vendeuse imprime s2 (pains seuls) en 4 : avec h4 ça fait 2 fois « 4 » → proposé la fois d'après
        contenantsStep('choice', 's2', 1); contenantsStep('choice', 's2', 1); contenantsStep('choice', 's2', 1);
        await printOrderTickets('special', 's2', 'sac');
        const s3 = Object.assign({}, s2, { id: 's3', nb_contenants: null, contenants_cle: null });
        specialOrdersData.push(s3);
        const apres = contenantsPropose(s3, 'special');
        // commande déjà imprimée en 3 : on repropose 3 (« comme la dernière impression »), même si l'habitude dit autre chose
        const dejaFaite = contenantsPropose(Object.assign({}, s1, { nb_contenants: 3 }), 'special');
        // Tours : rien appris de Veigné
        contenantsStats = {}; contenantsChoix = {};
        const tours = Object.assign({}, s1, { id: 't1', origin_shop: 'tours' });
        await loadContenantsStats('tours');
        const propTours = contenantsPropose(tours, 'special');
        return { buche, pain, stats, apres, dejaFaite, propTours };
      });
      assert(/^3\|d'après vos habitudes \(3 fois\)/.test(r.buche), 'bûche + pains à Veigné : 3 proposé (3, 3, 2) : ' + r.buche);
      assert(r.pain === '1|1 par défaut', 'pains seuls : 1 seule habitude (h4) et les vieilles ignorées → 1 par défaut : ' + r.pain + ' ' + r.stats);
      assert(r.apres.n === 4 && r.apres.src === 'habitude' && r.apres.fois === 2, 'après un choix à 4 aujourd\'hui : 4 proposé (h4 + aujourd\'hui) : ' + JSON.stringify(r.apres));
      assert(r.dejaFaite.n === 3 && r.dejaFaite.src === 'enregistre', 'déjà imprimée en 3 → 3 : ' + JSON.stringify(r.dejaFaite));
      assert(r.propTours.n === 1 && r.propTours.src === 'defaut', 'Tours (une seule habitude h5) : 1 par défaut : ' + JSON.stringify(r.propTours));
      await page.close();
    },
  },
  {
    name: 'Récap du jour — compteur sur chaque ligne (habitude pré-remplie), 🏷️ Retrait sort N tickets, « Tous les tickets retrait » sort les bons lots et mémorise chaque choix',
    fn: async (ctx) => {
      const page = await ouvrir(ctx);
      const r = await page.evaluate(async () => {
        await openRecapJour('special');
        await new Promise((res) => setTimeout(res, 250));
        const rowOf = (nom) => Array.from(document.querySelectorAll('#recap-jour-modal .rj-row')).find((x) => new RegExp(nom).test(x.textContent));
        const compteurs = { barbier: rowOf('Barbier').querySelector('.cont-step b').textContent, dupont: rowOf('Dupont').querySelector('.cont-step b').textContent, mini: !!rowOf('Barbier').querySelector('.cont-step.cont-mini') };
        // Dupont : la vendeuse monte à 2 puis imprime sa ligne
        rowOf('Dupont').querySelector('.cont-step button:last-of-type').click();
        const dupontAff = rowOf('Dupont').querySelector('.cont-step b').textContent + '|' + rowOf('Dupont').querySelector('.cont-step small').textContent;
        window.__printed = [];
        rowOf('Dupont').querySelector('button[title^="Ticket retrait"]').click();
        await new Promise((res) => setTimeout(res, 200));
        const une = { sacs: (window.__printed[0].match(/class="lb lb-sac"/g) || []).length, parts: (window.__printed[0].match(/class="lb-part">([^<]+)</g) || []).map((x) => x.replace(/.*>([^<]+)</, '$1')).join(' ') };
        // tous les tickets retrait : Dupont ×2 (gardé après le re-rendu) + Barbier ×3 (habitude)
        window.__printed = [];
        await recapPrintSacs();
        await new Promise((res) => setTimeout(res, 200));
        const h = window.__printed[0];
        const tous = { sacs: (h.match(/class="lb lb-sac"/g) || []).length, parts: (h.match(/class="lb-part">([^<]+)</g) || []).map((x) => x.replace(/.*>([^<]+)</, '$1')).join(' ') };
        const base = window.__mockDB.special_orders.filter((o) => o.id === 's1' || o.id === 's2').map((o) => o.id + ':' + o.nb_contenants + ':' + o.contenants_cle).join(' ');
        return { compteurs, dupontAff, une, tous, base };
      });
      assert(r.compteurs.barbier === '3' && r.compteurs.dupont === '1' && r.compteurs.mini, 'compteurs : Barbier 3 (habitude), Dupont 1 : ' + JSON.stringify(r.compteurs));
      assert(r.dupontAff === '2|2 tickets', 'Dupont monté à 2 : ' + r.dupontAff);
      assert(r.une.sacs === 2 && r.une.parts === '1/2 2/2', '🏷️ Retrait de Dupont = 2 tickets 1/2 2/2 : ' + JSON.stringify(r.une));
      assert(r.tous.sacs === 5 && r.tous.parts === '1/2 2/2 1/3 2/3 3/3', 'tous les tickets : Dupont (09h30) ×2 puis Barbier (11h15) ×3 : ' + JSON.stringify(r.tous));
      assert(r.base === 's1:3:buche1+pain s2:2:pain', 'choix mémorisés en base avec leur clé : ' + r.base);
      await page.close();
    },
  },
];
