/* ============================================================
   v20.279 — Onglet Fêtes : les notes des clients visibles en production (Phil, 14/10/2026,
   « fais pareil pour l'onglet Fêtes »).
   · vue Production (Local / Veigné) : bloc « Notes des clients » par jour de retrait, filtré sur
     ce que CE site fabrique (prod_site) ; total cliquable → fenêtre client par client avec la note ;
     ✏️ sur le total s'il y a une note derrière ; compteur ✏️ sur le bouton Production
   · temps réel : un changement sur fete_orders recharge la vue, sauf pendant la saisie
   Base factice, rien vers Supabase. Date figée : mercredi 22 juillet 2026.
   ============================================================ */
import { preparePage, gotoApp, enterBoutique, assert } from '../helpers/harness.mjs';
import { makeDB, TENANT_ID, TEST_TODAY } from '../helpers/fixtures.mjs';
const T = TENANT_ID;

function dbFete() {
  const db = makeDB();
  db.fete_events = [{ id: 'noel', tenant_id: T, label: 'Noël', actif: true, date_debut: '2026-07-20', date_fin: '2026-07-31', butoir: null }];
  db.fete_products = [
    { id: 'fp_buche', event_id: 'noel', nom: 'Bûche Chocolat', taille: '6 pers.', prix: 24, prod_site: 'veigne', ordre: 1, actif: true },
    { id: 'fp_pain', event_id: 'noel', nom: 'Pain de Fête', taille: '', prix: 6, prod_site: 'local', ordre: 2, actif: true },
  ];
  db.fete_orders = [
    { id: 'f1', tenant_id: T, event_id: 'noel', origin_shop: 'saint-avertin', customer_name: 'Wibaut', pickup_date: TEST_TODAY, pickup_time: '10:00', status: 'a_faire', notes: 'Joyeux 90 ans',
      items: [{ fp_id: 'fp_buche', nom: 'Bûche Chocolat', taille: '6 pers.', prix: 24, qty: 1, prod_site: 'veigne' }, { fp_id: 'fp_pain', nom: 'Pain de Fête', taille: '', prix: 6, qty: 2, prod_site: 'local' }], total: 36 },
    { id: 'f2', tenant_id: T, event_id: 'noel', origin_shop: 'tours', customer_name: 'Saintin', pickup_date: TEST_TODAY, pickup_time: '09:00', status: 'a_faire', notes: 'Sans gluten si possible',
      items: [{ fp_id: 'fp_buche', nom: 'Bûche Chocolat', taille: '6 pers.', prix: 24, qty: 2, prod_site: 'veigne' }], total: 48 },
    { id: 'f3', tenant_id: T, event_id: 'noel', origin_shop: 'veigne', customer_name: 'Blondel', pickup_date: TEST_TODAY, pickup_time: '11:00', status: 'a_faire', notes: null,
      items: [{ fp_id: 'fp_pain', nom: 'Pain de Fête', taille: '', prix: 6, qty: 3, prod_site: 'local' }], total: 18 },
    { id: 'f4', tenant_id: T, event_id: 'noel', origin_shop: 'tours', customer_name: 'Fantôme', pickup_date: TEST_TODAY, pickup_time: '08:00', status: 'annulee', notes: 'ANNULÉE',
      items: [{ fp_id: 'fp_pain', nom: 'Pain de Fête', taille: '', prix: 6, qty: 99, prod_site: 'local' }], total: 594 },
  ];
  return db;
}
async function ouvrirProd(ctx, site) {
  const page = await preparePage(ctx, { db: dbFete() });
  await gotoApp(page); await enterBoutique(page, site);
  await page.evaluate(() => setVue('fetes')); await page.waitForTimeout(500);
  await page.evaluate(() => feteSetView('prod')); await page.waitForTimeout(300);
  return page;
}
const txt = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : null);

export const tests = [
  {
    name: 'Fêtes Production au Local — bloc « Notes des clients » (seulement les commandes avec un pain de fête), ✏️ sur le total, compteur sur le bouton, annulée exclue',
    fn: async (ctx) => {
      const page = await ouvrirProd(ctx, 'local');
      const r = await page.evaluate((txtSrc) => {
        const txt = eval(txtSrc);
        return {
          bouton: txt(Array.from(document.querySelectorAll('.recap-toggle-btn')).find((b) => b.textContent.indexOf('Production') !== -1)),
          rows: Array.from(document.querySelectorAll('.fete-prod-row')).map(txt),
          titreNotes: txt(document.querySelector('.fete-prod-notes-title')),
          notes: Array.from(document.querySelectorAll('.fete-prod-note-row')).map(txt),
        };
      }, txt.toString());
      assert(r.bouton === '🍰 Production ✏️ 1', 'compteur de notes sur le bouton : ' + r.bouton);
      assert(r.rows.join('|') === 'Pain de Fête5 ✏️', 'un seul total au Local (2 + 3, annulée exclue) avec ✏️ : ' + r.rows.join('|'));
      assert(r.titreNotes === '✏️ Notes des clients — 1 commande', 'titre du bloc : ' + r.titreNotes);
      assert(r.notes.join('|') === '10:00 · Wibaut 🏪 St-Avertin · 2× Pain de Fête⭐ Joyeux 90 ans', 'note de Wibaut avec ses pains seulement (pas Saintin : bûche = Veigné) : ' + r.notes.join('|'));
      await page.close();
    },
  },
  {
    name: 'Fêtes Production à Veigné — un appui sur le total Bûche ouvre la fenêtre client par client avec les notes, triée par heure',
    fn: async (ctx) => {
      const page = await ouvrirProd(ctx, 'veigne');
      const r = await page.evaluate((txtSrc) => {
        const txt = eval(txtSrc);
        const row = Array.from(document.querySelectorAll('.fete-prod-row')).find((x) => x.textContent.indexOf('Bûche') !== -1);
        row.click();
        const modal = document.querySelector('#fete-detail-host .pros-detail-modal');
        const out = {
          rows: Array.from(document.querySelectorAll('.fete-prod-row')).map(txt),
          titre: modal ? txt(modal.querySelector('.pros-detail-title')) : null,
          lignes: modal ? Array.from(modal.querySelectorAll('.spe-detail-row')).map((l) => Array.from(l.querySelectorAll('.pros-detail-row, .sp-note')).map(txt).join(' | ')) : null,
          notes: Array.from(document.querySelectorAll('.fete-prod-note-row')).map(txt),
        };
        closeFeteDetailModal(); out.ferme = !document.querySelector('#fete-detail-host');
        return out;
      }, txt.toString());
      assert(r.rows.join('|') === 'Bûche Chocolat — 6 pers.3 ✏️', 'Veigné ne voit que la bûche : ' + r.rows.join('|'));
      assert(r.titre === '🍰 Bûche Chocolat — 6 pers. 3 au total', 'titre : ' + r.titre);
      assert(r.lignes && r.lignes.join(' || ') === '09:00 · Saintin 🏪 Tours2 | ⭐ Sans gluten si possible || 10:00 · Wibaut 🏪 St-Avertin1 | ⭐ Joyeux 90 ans', 'détail client par client : ' + JSON.stringify(r.lignes));
      assert(r.notes.length === 2 && r.notes[0].indexOf('Saintin') !== -1, 'bloc notes à Veigné : Saintin puis Wibaut : ' + r.notes.join('|'));
      assert(r.ferme === true, 'Fermer referme');
      await page.close();
    },
  },
  {
    name: 'Fêtes — temps réel : une note ajoutée ailleurs apparaît toute seule sur la vue Production ; pendant la saisie d\'une commande, rien ne bouge puis rattrapage',
    fn: async (ctx) => {
      const page = await ouvrirProd(ctx, 'local');
      await page.evaluate(() => {
        window.__mockDB.fete_orders.find((o) => o.id === 'f3').notes = 'Bien cuit';
        window.__mockChannels.filter((c) => c.name === 'fetes_local').forEach((c) => c._emit({ new: {} }));
      });
      await page.waitForTimeout(400);
      const r1 = await page.evaluate(() => Array.from(document.querySelectorAll('.fete-prod-note-row')).map((x) => x.textContent.replace(/\s+/g, ' ').trim()));
      assert(r1.length === 2 && r1[1].indexOf('Blondel') !== -1 && r1[1].indexOf('Bien cuit') !== -1, 'la note de Blondel arrive en direct : ' + r1.join('|'));
      // formulaire ouvert : pas de re-rendu sous les doigts
      await page.evaluate(() => feteSetView('new')); await page.waitForTimeout(200);
      await page.evaluate(() => {
        document.getElementById('feteCust').value = 'En cours de saisie';
        window.__mockDB.fete_orders.find((o) => o.id === 'f1').notes = 'Joyeux 90 ans Mamie';
        window.__mockChannels.filter((c) => c.name === 'fetes_local').forEach((c) => c._emit({ new: {} }));
      });
      await page.waitForTimeout(400);
      const r2 = await page.evaluate(() => ({ saisie: document.getElementById('feteCust').value, dirty: feteOrdersDirty }));
      assert(r2.saisie === 'En cours de saisie' && r2.dirty === true, 'la saisie n\'a pas été écrasée, le changement est mémorisé : ' + JSON.stringify(r2));
      await page.evaluate(() => feteSetView('prod')); await page.waitForTimeout(400);
      const r3 = await page.evaluate(() => ({ dirty: feteOrdersDirty, notes: Array.from(document.querySelectorAll('.fete-prod-note-row')).map((x) => x.textContent.replace(/\s+/g, ' ').trim()) }));
      assert(r3.dirty === false && r3.notes[0].indexOf('Joyeux 90 ans Mamie') !== -1, 'retour sur Production : rattrapé : ' + JSON.stringify(r3));
      await page.close();
    },
  },
];
