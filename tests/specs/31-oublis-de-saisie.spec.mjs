/* ============================================================
   v20.264 — Oublis de saisie (Phil, 29/09/2026) : chaque site voit
   sous l'en-tête ce qu'il a oublié ces 7 derniers jours ; Phil a le
   récap tous sites en BackOffice → Oublis.
   Fermetures : St-Avertin et Le Local le lundi, Tours le dimanche
   + fériés, Veigné 7/7 → un jour fermé n'est JAMAIS un oubli.
   Horloge des tests : mercredi 22/07/2026 10h00 → fenêtre du
   mer. 15/07 au mar. 21/07.
   ============================================================ */
import { preparePage, gotoApp, enterBoutique, assert } from '../helpers/harness.mjs';
import { makeDB, TENANT_ID } from '../helpers/fixtures.mjs';

const JOURS = ['2026-07-15', '2026-07-16', '2026-07-17', '2026-07-18', '2026-07-19', '2026-07-20', '2026-07-21'];

function venteValidee(db, b, date) {
  db.sales.push({ tenant_id: TENANT_ID, boutique_id: b, product_id: 'vt_trad', date, matin: 10, day_closed: true });
}
function prodFab(db, site, date, valide) {
  db.fab_production = db.fab_production || [];
  db.fab_production.push({ id: 'fp_' + site + date, site, date_prod: date, produit_id: 'pr_trad', quantite: 5, valide });
}
function bon(db, site, date) {
  db.fab_livraisons = db.fab_livraisons || [];
  db.fab_livraisons.push({ id: 'fl_' + site + date, site, date_livraison: date, ingredient_id: 'ing_t80', quantite_kg: 25 });
}
const texteBarre = (page) => page.evaluate(() => {
  const b = document.getElementById('oublis-bar');
  return b && b.style.display !== 'none' ? b.textContent : '';
});

function bonF(db, site, date, fournisseur) {
  db.fab_livraisons = db.fab_livraisons || [];
  db.fab_livraisons.push({ id: 'fl_' + site + date + fournisseur, site, date_livraison: date, fournisseur_id: fournisseur, ingredient_id: 'ing_t80', quantite_kg: 25 });
}
const heure = (iso) => new Date(iso).getTime();
async function barreDe(ctx, db, nowIso, site) {
  const page = await preparePage(ctx, nowIso ? { db, nowMs: heure(nowIso) } : { db });
  await gotoApp(page);
  await enterBoutique(page, site);
  await page.evaluate(() => refreshOublis(true));
  return { page, t: await texteBarre(page) };
}

export const tests = [
  {
    name: 'Oublis — Veigné voit la VEILLE seulement : ventes et Fabrication non validées + bon Suire de la semaine manquant',
    fn: async (ctx) => {
      const db = makeDB();
      db.sales = [];
      JOURS.filter((d) => d !== '2026-07-18' && d !== '2026-07-21').forEach((d) => venteValidee(db, 'veigne', d));
      JOURS.forEach((d) => prodFab(db, 'veigne', d, d !== '2026-07-21'));
      bonF(db, 'veigne', '2026-07-10', 'four_suire');     // mercredi 22 avant jeudi midi → semaine contrôlée = 13→19/07 : rien
      const { page, t } = await barreDe(ctx, db, null, 'veigne');
      assert(t.includes('3 oublis'), `3 oublis attendus (ventes, fab, Suire), barre : « ${t} »`);
      assert(t.includes('Ventes pas validées') && t.includes('mar. 21/07'), 'la veille (mar. 21/07) doit être signalée côté ventes');
      assert(!t.includes('18/07'), 'Phil : « la veille » — le samedi 18 plus ancien ne doit PAS apparaître');
      assert(t.includes('pas validé') && t.includes('Fabrication'), 'Fabrication de la veille saisie non validée');
      assert(t.includes('Girardeau-Suire') && t.includes('lun. 13/07'), 'bon Suire de la semaine du 13/07 manquant');

      await page.evaluate(() => oublisOuvrirVentes('2026-07-21'));
      await page.waitForFunction(() => currentVue === 'ventes' && currentDate === '2026-07-21');
      assert(page.__pageErrors.length === 0, 'erreurs JS : ' + page.__pageErrors.join(' | '));
      await page.close();
    },
  },
  {
    name: 'Oublis — la veille d\'un jour fermé, on regarde la dernière journée d\'ouverture (St-Avertin le mardi, Tours le lundi)',
    fn: async (ctx) => {
      const db = makeDB();
      db.sales = [];
      venteValidee(db, 'saint-avertin', '2026-07-19');    // mardi 21 → lundi 20 fermé → on regarde dimanche 19 : validé
      venteValidee(db, 'tours', '2026-07-18');            // lundi 20 → dimanche 19 fermé → on regarde samedi 18 : validé
      prodFab(db, 'tours', '2026-07-18', true);
      bonF(db, 'tours', '2026-07-14', 'four_suire');      // lundi 20 → semaine contrôlée 13→19/07 : OK
      let r = await barreDe(ctx, db, '2026-07-21T10:00:00', 'saint-avertin');
      assert(r.t === '', `St-Avertin à jour : aucune barre attendue, reçu « ${r.t} »`);
      await r.page.close();
      r = await barreDe(ctx, db, '2026-07-20T10:00:00', 'tours');
      assert(r.t === '', `Tours à jour (dimanche fermé) : aucune barre attendue, reçu « ${r.t} »`);
      assert(r.page.__pageErrors.length === 0, 'erreurs JS : ' + r.page.__pageErrors.join(' | '));
      await r.page.close();
    },
  },
  {
    name: 'Oublis — Suire : le bon de la semaine devient un oubli le jeudi à midi, pas avant',
    fn: async (ctx) => {
      const db = makeDB();
      db.sales = [];
      ['2026-07-22'].forEach((d) => { venteValidee(db, 'tours', d); prodFab(db, 'tours', d, true); });
      bonF(db, 'tours', '2026-07-14', 'four_suire');      // semaine du 13/07 : OK ; semaine du 20/07 : rien
      let r = await barreDe(ctx, db, '2026-07-23T11:00:00', 'tours');
      assert(!r.t.includes('Suire'), `jeudi 11h : encore dans les temps, reçu « ${r.t} »`);
      await r.page.close();
      r = await barreDe(ctx, db, '2026-07-23T13:00:00', 'tours');
      assert(r.t.includes('Girardeau-Suire') && r.t.includes('lun. 20/07'), `jeudi 13h : bon de la semaine du 20/07 manquant, reçu « ${r.t} »`);
      await r.page.close();
    },
  },
  {
    name: 'Oublis — Le Local : Revault à saisir avant la fin du mois (rappel dès le 25) ; Mimosas = Phil, pas dans la barre',
    fn: async (ctx) => {
      const db = makeDB();
      db.sales = [];
      prodFab(db, 'local', '2026-07-26', true);           // lundi 27 (fermé) → veille = dimanche 26 : validé
      bonF(db, 'local', '2026-07-22', 'four_suire');      // semaine du 20/07 : OK
      // ni Revault ni Mimosas en juillet
      const { page, t } = await barreDe(ctx, db, '2026-07-27T10:00:00', 'local');
      assert(t.includes('Rappel du jour'), `seulement un rappel (pas un oubli) avant la fin du mois, reçu « ${t} »`);
      assert(t.includes('Michel Revault') && t.includes('juillet'), 'rappel Revault pour juillet');
      assert(!t.includes('Mimosas'), 'Mimosas : c\'est Phil qui saisit (factures par mail) → pas dans la barre du Local');
      await page.evaluate(async () => { await loadOublisAdmin(); renderOublisAdmin(); });
      const bo = await page.evaluate(() => document.getElementById('main-content').textContent);
      // Mimosas = facture mensuelle, sans bon : le 27/07 on contrôle JUIN (facture du mois précédent)
      assert(bo.includes('GAEC des Mimosas : facture de juin pas saisie (à toi)'), `Mimosas (facture de juin) doit apparaître dans le récap de Phil, reçu « ${bo.slice(0, 400)} »`);
      await page.close();
    },
  },
  {
    name: 'Oublis — BackOffice : le récap 14 jours compte les oublis par site',
    fn: async (ctx) => {
      const db = makeDB();
      db.sales = [];
      JOURS.forEach((d) => venteValidee(db, 'veigne', d));
      JOURS.filter((d) => d !== '2026-07-17').forEach((d) => prodFab(db, 'local', d, true));      // ven. 17 oublié au Local
      const page = await preparePage(ctx, { db });
      await gotoApp(page);
      await page.evaluate(async () => { await loadOublisAdmin(); renderOublisAdmin(); });
      await page.waitForSelector('.oa-table', { state: 'attached' });
      const lignes = await page.evaluate(() => Array.from(document.querySelectorAll('.oa-table tbody tr'))
        .filter((tr) => tr.querySelector('.oa-lbl'))
        .map((tr) => tr.querySelector('.oa-lbl').textContent + '=' + tr.querySelector('.oa-n').textContent));
      const veigneVentes = lignes[0], localFab = lignes[3];
      // 14 jours = du 08/07 au 21/07 ; Veigné n'a validé que les 7 derniers → 7 oublis
      assert(veigneVentes === 'Veigné=7', `ventes Veigné : 7 oublis attendus (08→14/07), reçu ${veigneVentes}`);
      // Le Local : 14 jours − 2 lundis fermés (13 et 20/07) = 12 jours dus (le 14/07 férié : ouvert le matin) ;
      // validés parmi eux : 15, 16, 18, 19, 21 → 7 oublis (le lundi 20 saisi ne compte pas)
      assert(localFab === 'Le Local=7', `fab Local : 7 oublis attendus, reçu ${localFab}`);
      assert(page.__pageErrors.length === 0, 'erreurs JS : ' + page.__pageErrors.join(' | '));
      await page.close();
    },
  },
];
