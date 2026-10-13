/* ============================================================
   v20.274 — « 📊 Pièces par client » dans l'onglet Pros de chaque site (Phil, 13/10/2026) :
   consultation, pièces par client POUR CHAQUE SEMAINE DU MOIS (lundi → dimanche) + total du
   mois, livraisons du mois en dépliant, total de groupe (Dakota), CSV du mois. Brouillons et
   annulées exclus, filtré sur la boutique source de l'onglet. Date figée : mercredi 22 juillet 2026.
   Juillet 2026 = 5 semaines : 29/06, 6/07, 13/07, 20/07, 27/07.
   ============================================================ */
import { preparePage, gotoApp, enterBoutique, assert } from '../helpers/harness.mjs';
import { makeDB, TENANT_ID } from '../helpers/fixtures.mjs';
const T = TENANT_ID;

async function ongletPros(ctx, site) {
  const db = makeDB();
  db.pros = [
    { id: 'dk_t', tenant_id: T, nom: 'DAKOTA CAFE Tours', actif: true, boutique_principale: 'local', groupe: 'dakota', contacts: [], jours_livraison: {} },
    { id: 'dk_c', tenant_id: T, nom: 'DAKOTA CAFE Chambray', actif: true, boutique_principale: 'local', groupe: 'dakota', contacts: [], jours_livraison: {} },
    { id: 'artigny', tenant_id: T, nom: 'Artigny', actif: true, boutique_principale: 'local', groupe: null, contacts: [], jours_livraison: {} },
  ];
  db.pro_orders = [
    { id: 'o1', tenant_id: T, pro_id: 'dk_t', date_livraison: '2026-07-21', boutique_source: 'local', statut: 'livre' },        // semaine du 20/07
    { id: 'o2', tenant_id: T, pro_id: 'dk_t', date_livraison: '2026-07-02', boutique_source: 'local', statut: 'livre' },        // semaine du 29/06
    { id: 'o3', tenant_id: T, pro_id: 'dk_c', date_livraison: '2026-07-23', boutique_source: 'local', statut: 'confirme' },     // semaine du 20/07
    { id: 'o4', tenant_id: T, pro_id: 'artigny', date_livraison: '2026-07-10', boutique_source: 'veigne', statut: 'livre' },    // autre site
    { id: 'o5', tenant_id: T, pro_id: 'artigny', date_livraison: '2026-07-15', boutique_source: 'local', statut: 'annule' },    // annulée
    { id: 'o6', tenant_id: T, pro_id: 'artigny', date_livraison: '2026-06-30', boutique_source: 'local', statut: 'livre' },     // juin
  ];
  db.pro_order_items = [
    { id: 'i1', pro_order_id: 'o1', product_id: 'vt_trad', qty: 60 }, { id: 'i2', pro_order_id: 'o1', product_id: 'vp_croissant', qty: 10 },
    { id: 'i3', pro_order_id: 'o2', product_id: 'vt_trad', qty: 75 },
    { id: 'i4', pro_order_id: 'o3', product_id: 'vt_trad', qty: 150 },
    { id: 'i5', pro_order_id: 'o4', product_id: 'vt_trad', qty: 20 },
    { id: 'i6', pro_order_id: 'o5', product_id: 'vt_trad', qty: 999 },
    { id: 'i7', pro_order_id: 'o6', product_id: 'vt_trad', qty: 40 },
  ];
  const page = await preparePage(ctx, { db });
  await page.addInitScript(() => { try { localStorage.removeItem('proRecapOpen'); } catch (e) {} });
  await gotoApp(page);
  await enterBoutique(page, site);
  await page.evaluate(() => setVue('pros_orders'));
  await page.waitForTimeout(500);
  return page;
}
const cells = (tr) => Array.from(tr.querySelectorAll('td')).map((td) => td.textContent.replace(/\s+/g, ' ').trim());

export const tests = [
  {
    name: 'Pièces par client — bouton 📊 : une colonne par semaine du mois + total, par client, total groupe Dakota, total général ; pas l\'autre site ni les annulées',
    fn: async (ctx) => {
      const page = await ongletPros(ctx, 'local');
      const r = await page.evaluate((cellsSrc) => {
        const cells = eval(cellsSrc);
        const avant = document.querySelectorAll('.pro-recap-block').length;
        toggleProOrdersRecap();
        return { avant, mois: document.querySelector('.pro-recap-block b').textContent, ouvert: localStorage.getItem('proRecapOpen'),
          head: Array.from(document.querySelectorAll('.pro-recap-table thead th')).map((th) => th.textContent.replace(/\s+/g, ' ').trim()),
          rows: Array.from(document.querySelectorAll('.pro-recap-table tbody tr.pro-recap-row')).map(cells),
          groupe: cells(document.querySelector('.pro-recap-group')), tot: cells(document.querySelector('.pro-recap-table tfoot tr')) };
      }, cells.toString());
      assert(r.avant === 0 && r.mois === 'juillet 2026' && r.ouvert === '1', 'fermé au départ, ouvert sur le mois en cours, mémorisé : ' + JSON.stringify(r));
      assert(r.head.join('|') === 'Client|sem. du 29/06|sem. du 6/07|sem. du 13/07|sem. du 20/07|sem. du 27/07|Mois', '5 semaines de juillet + Mois : ' + r.head.join('|'));
      assert(r.rows.length === 2, '2 clients du Local (Artigny : Veigné / annulée / juin → absent) : ' + JSON.stringify(r.rows));
      assert(/DAKOTA CAFE Chambray/.test(r.rows[0][0]) && r.rows[0].slice(1).join('|') === '–|–|–|150|–|150', 'Chambray : 150 la semaine du 20, 150 au mois : ' + JSON.stringify(r.rows[0]));
      assert(/DAKOTA CAFE Tours · 2 livr/.test(r.rows[1][0]) && r.rows[1].slice(1).join('|') === '75|–|–|70|–|145', 'Tours : 75 (sem. 29/06) + 70 (sem. 20/07) = 145 : ' + JSON.stringify(r.rows[1]));
      assert(/Total Dakota \(2 établissements\)/.test(r.groupe[0]) && r.groupe.slice(1).join('|') === '75|–|–|220|–|295', 'total groupe Dakota : ' + JSON.stringify(r.groupe));
      assert(r.tot.join('|') === 'Total|75|–|–|220|–|295', 'total général : ' + JSON.stringify(r.tot));
      await page.close();
    },
  },
  {
    name: 'Pièces par client — déplier un client = ses livraisons du mois ; ◀ mois précédent (juin, 5 semaines) ; CSV du mois',
    fn: async (ctx) => {
      const page = await ongletPros(ctx, 'local');
      const r = await page.evaluate(() => {
        toggleProOrdersRecap();
        proRecapToggleClient('dk_t');
        const det = Array.from(document.querySelectorAll('.pro-recap-detail')).map((x) => x.textContent.replace(/\s+/g, ' ').trim());
        const csv = proRecapCSV();
        proRecapMonth(-1);
        const juin = { mois: document.querySelector('.pro-recap-block b').textContent, nbSem: document.querySelectorAll('.pro-recap-table thead th').length - 2, rows: Array.from(document.querySelectorAll('.pro-recap-row')).map((x) => x.textContent.replace(/\s+/g, ' ').trim()) };
        return { det, csv, juin };
      });
      assert(r.det.length === 2 && /jeudi 2 juillet.*livrée.*75 pièces.*75 Tradition/.test(r.det[0]) && /mardi 21 juillet.*70 pièces.*60 Tradition · 10 Croissant/.test(r.det[1]), 'livraisons dépliées : ' + JSON.stringify(r.det));
      assert(r.csv.fname === 'pieces-par-client-local-2026-07.csv' && r.csv.csv.split('\n').length === 6 && /"DAKOTA CAFE Tours";"2026-07-21";"Le Local";"livre";"Tradition";"60"/.test(r.csv.csv), 'CSV du mois (4 lignes produit) : ' + r.csv.fname + ' / ' + r.csv.csv.split('\n').length);
      assert(r.juin.mois === 'juin 2026' && r.juin.nbSem === 5 && r.juin.rows.length === 1 && /Artigny/.test(r.juin.rows[0]) && /40/.test(r.juin.rows[0]), 'juin : 5 semaines, Artigny 40 : ' + JSON.stringify(r.juin));
      await page.close();
    },
  },
];
