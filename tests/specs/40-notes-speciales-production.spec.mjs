/* ============================================================
   v20.277 — Notes des commandes spéciales visibles en production (Phil, 14/10/2026, approche 2).
   Cas réels : « Essentiel 2kgrs », « Joyeux 90 ans », « JA » écrits par la vendeuse de
   St-Avertin, invisibles au fournil du Local.
   · Prod. St-Av : les notes (par produit + commande) s'affichent, les annulées disparaissent
   · Prod. Boulangers : le bloc « Spéciales du jour » s'ouvre tout seul s'il y a une note,
     reste fermé sinon, et respecte le choix de l'équipe
   · colonne ⭐ Spé cliquable → fenêtre client par client avec les notes
   Base factice, rien vers Supabase.
   ============================================================ */
import { preparePage, gotoApp, enterBoutique, assert } from '../helpers/harness.mjs';
import { makeDB, TENANT_ID, TEST_TODAY } from '../helpers/fixtures.mjs';
const T = TENANT_ID;

function dbAvecSpeciales(avecNotes) {
  const db = makeDB();
  db.special_orders = [
    { id: 'so1', tenant_id: T, origin_shop: 'saint-avertin', production_shop: 'local', pickup_date: TEST_TODAY, pickup_time: '09:00:00', customer_name: 'Cathelin', status: 'confirmee', notes: avecNotes ? 'Joyeux 90 ans' : null },
    { id: 'so2', tenant_id: T, origin_shop: 'saint-avertin', production_shop: 'local', pickup_date: TEST_TODAY, pickup_time: '10:00:00', customer_name: 'Blondel', status: 'confirmee', notes: null },
    { id: 'so3', tenant_id: T, origin_shop: 'saint-avertin', production_shop: 'local', pickup_date: TEST_TODAY, pickup_time: '11:00:00', customer_name: 'Fantôme', status: 'annulee', notes: 'ANNULÉE' },
  ];
  db.special_order_items = [
    { id: 'si1', order_id: 'so1', product_id: 'vt_trad', qty: 2, position: 0, notes: avecNotes ? 'Tradition 2kgrs' : null },
    { id: 'si2', order_id: 'so2', product_id: 'vt_trad', qty: 1, position: 0, notes: null },
    { id: 'si3', order_id: 'so2', product_id: 'vt_trad_gr', qty: 3, position: 1, notes: null },
    { id: 'si4', order_id: 'so3', product_id: 'vt_trad', qty: 99, position: 0, notes: null },
  ];
  return db;
}

async function ouvrir(ctx, avecNotes, vue) {
  const page = await preparePage(ctx, { db: dbAvecSpeciales(avecNotes) });
  await gotoApp(page);
  await enterBoutique(page, 'local');
  await page.evaluate((v) => setVue(v), vue);
  await page.waitForTimeout(600);
  return page;
}
const txt = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : null);

export const tests = [
  {
    name: 'Prod. St-Av — les notes de la vendeuse (✏️ par produit, ⭐ commande) sont affichées au Local ; la commande annulée n\'apparaît plus',
    fn: async (ctx) => {
      const page = await ouvrir(ctx, true, 'production_sa');
      const r = await page.evaluate((txtSrc) => {
        const txt = eval(txtSrc);
        const cards = Array.from(document.querySelectorAll('.sp-card'));
        return {
          clients: cards.map((c) => txt(c.querySelector('.sp-card-hdr strong'))),
          notes: cards.map((c) => Array.from(c.querySelectorAll('.sp-note')).map(txt)),
          corps: cards.map((c) => txt(c.querySelector('.sp-card-body'))),
        };
      }, txt.toString());
      assert(r.clients.join('|') === 'Cathelin|Blondel', 'deux commandes vivantes, pas l\'annulée : ' + r.clients.join('|'));
      assert(r.notes[0].join('|') === '✏️ Tradition — Tradition 2kgrs|⭐ Joyeux 90 ans', 'note produit + note commande sur Cathelin : ' + r.notes[0].join('|'));
      assert(r.notes[1].length === 0, 'pas de note inventée sur Blondel');
      assert(r.corps[1] === '1x Tradition + 3x Tradition Graines', 'résumé des lignes : ' + r.corps[1]);
      await page.close();
    },
  },
  {
    name: 'Prod. Boulangers — bloc « Spéciales du jour » ouvert tout seul s\'il y a une note (compteur ✏️), fermé sinon ; replié à la main → reste replié',
    fn: async (ctx) => {
      const page = await ouvrir(ctx, true, 'prod_boul');
      const r = await page.evaluate((txtSrc) => {
        const txt = eval(txtSrc);
        const avant = { ouvert: !!document.querySelector('.prod-specials-body'), tete: txt(document.querySelector('.prod-specials-header')),
          notes: Array.from(document.querySelectorAll('.prod-specials-body .sp-note')).map(txt) };
        toggleProductionSpecials();
        const replie = !!document.querySelector('.prod-specials-body');
        return { avant, replie };
      }, txt.toString());
      assert(r.avant.ouvert === true, 'bloc ouvert tout seul avec une note');
      assert(/2 commandes · 6 produits · ✏️ 1 note/.test(r.avant.tete), 'en-tête avec compteur de notes : ' + r.avant.tete);
      assert(r.avant.notes.join('|') === '✏️ Tradition — Tradition 2kgrs|⭐ Joyeux 90 ans', 'les notes sont dans le bloc : ' + r.avant.notes.join('|'));
      assert(r.replie === false, 'replié à la main : fermé');
      // changement de jour puis retour : le choix de l'équipe est respecté
      await page.evaluate(() => changeReapproDate(1));
      await page.waitForTimeout(400);
      await page.evaluate(() => changeReapproDate(-1));
      await page.waitForTimeout(400);
      const encore = await page.evaluate(() => !!document.querySelector('.prod-specials-body'));
      assert(encore === false, 'après un aller-retour de date, toujours replié (choix de l\'équipe)');
      await page.close();

      const page2 = await ouvrir(ctx, false, 'prod_boul');
      const r2 = await page2.evaluate(() => ({ ouvert: !!document.querySelector('.prod-specials-body'), tete: (document.querySelector('.prod-specials-header') || {}).textContent || '' }));
      assert(r2.ouvert === false, 'sans note : bloc fermé comme avant');
      assert(r2.tete.indexOf('✏️') === -1, 'sans note : pas de compteur');
      await page2.close();
    },
  },
  {
    name: 'Prod. Boulangers — « ⭐3 ✏️ » sur Tradition est cliquable : fenêtre heure · client · boutique · quantité avec les notes ; Tradition Graines sans note = pas de ✏️',
    fn: async (ctx) => {
      const page = await ouvrir(ctx, true, 'prod_boul');
      const r = await page.evaluate((txtSrc) => {
        const txt = eval(txtSrc);
        const row = (pid) => Array.from(document.querySelectorAll('.prod-row')).find((x) => x.querySelector('[data-pid="' + pid + '"]') || (x.getAttribute('data-pid') === pid) || x.innerHTML.indexOf("'" + pid + "'") !== -1);
        const cTrad = row('vt_trad').querySelector('.cell-spe');
        const cGr = row('vt_trad_gr').querySelector('.cell-spe');
        cTrad.click();
        const modal = document.querySelector('#spe-detail-host .pros-detail-modal');
        const out = {
          cellTrad: txt(cTrad), cellGr: txt(cGr),
          titre: modal ? txt(modal.querySelector('.pros-detail-title')) : null,
          lignes: modal ? Array.from(modal.querySelectorAll('.spe-detail-row')).map((l) => Array.from(l.querySelectorAll('.pros-detail-row, .sp-note')).map(txt).join(' | ')) : null,
        };
        closeSpeDetailModal();
        out.ferme = !document.querySelector('#spe-detail-host');
        return out;
      }, txt.toString());
      assert(r.cellTrad === '⭐3 ✏️', 'Tradition : 2 + 1 (annulée exclue) avec marqueur note : ' + r.cellTrad);
      assert(r.cellGr === '⭐3', 'Tradition Graines : 3 sans marqueur : ' + r.cellGr);
      assert(r.titre === '⭐ Tradition 3 au total', 'titre de la fenêtre : ' + r.titre);
      assert(r.lignes && r.lignes.length === 2, 'deux lignes (Cathelin, Blondel) : ' + JSON.stringify(r.lignes));
      assert(r.lignes[0] === '09:00 · Cathelin 🏪 St-Avertin2 | ✏️ Tradition — Tradition 2kgrs | ⭐ Joyeux 90 ans', 'ligne Cathelin avec ses notes : ' + r.lignes[0]);
      assert(r.lignes[1] === '10:00 · Blondel 🏪 St-Avertin1', 'ligne Blondel sans note : ' + r.lignes[1]);
      assert(r.ferme === true, 'Fermer referme la fenêtre');
      await page.close();
    },
  },
];

// v20.277 (suite) — garantie demandée par Phil : « si la vendeuse tape quelque chose à la main,
// on le voit en prod ». Deux trous bouchés : le texte libre (produit sans fiche) ouvre aussi le
// bloc, et l'écran de production se recharge en direct quand une note arrive.
tests.push(
  {
    name: 'Prod. Boulangers — un produit tapé en texte libre (sans note) ouvre aussi le bloc Spéciales, avec compteur 📝 texte libre, et la ligne est lisible',
    fn: async (ctx) => {
      const db = makeDB();
      db.special_orders = [{ id: 'so9', tenant_id: T, origin_shop: 'saint-avertin', production_shop: 'local', pickup_date: TEST_TODAY, pickup_time: '09:00:00', customer_name: 'Saintin', status: 'confirmee', notes: null }];
      db.special_order_items = [{ id: 'si9', order_id: 'so9', product_id: null, product_name_custom: 'Number cake 2 chiffres', qty: 1, position: 0, notes: null }];
      const page = await preparePage(ctx, { db });
      await gotoApp(page); await enterBoutique(page, 'local');
      await page.evaluate(() => setVue('prod_boul')); await page.waitForTimeout(600);
      const r = await page.evaluate(() => ({ ouvert: !!document.querySelector('.prod-specials-body'), tete: document.querySelector('.prod-specials-header').textContent,
        items: Array.from(document.querySelectorAll('.prod-special-item')).map((x) => x.textContent.trim()) }));
      assert(r.ouvert === true, 'bloc ouvert pour un texte libre');
      assert(r.tete.indexOf('📝 1 texte libre') !== -1, 'compteur texte libre : ' + r.tete);
      assert(r.items.join('|') === 'Number cake 2 chiffres ×1', 'la ligne libre est lisible : ' + r.items.join('|'));
      await page.close();
    },
  },
  {
    name: 'Prod. Boulangers — la vendeuse ajoute une note pendant que l\'écran est ouvert : l\'écran se recharge tout seul (pas pendant une saisie)',
    fn: async (ctx) => {
      const page = await ouvrir(ctx, false, 'prod_boul');
      const avant = await page.evaluate(() => ({ ouvert: !!document.querySelector('.prod-specials-body'), notes: document.querySelectorAll('.sp-note').length }));
      assert(avant.ouvert === false && avant.notes === 0, 'au départ : pas de note, bloc fermé');
      // la vendeuse écrit une note sur la ligne de Cathelin, le signal temps réel arrive
      await page.evaluate(() => {
        window.__mockDB.special_order_items.find((i) => i.id === 'si1').notes = 'Tradition 2kgrs';
        scheduleProductionSpecialsRefresh();
      });
      await page.waitForTimeout(1800);
      const apres = await page.evaluate(() => ({ ouvert: !!document.querySelector('.prod-specials-body'),
        notes: Array.from(document.querySelectorAll('.prod-specials-body .sp-note')).map((x) => x.textContent.replace(/\s+/g, ' ').trim()),
        cell: Array.from(document.querySelectorAll('.cell-spe')).map((x) => x.textContent.trim()) }));
      assert(apres.ouvert === true, 'bloc ouvert tout seul après l\'arrivée de la note');
      assert(apres.notes.join('|') === '✏️ Tradition — Tradition 2kgrs', 'la note est là sans rien toucher : ' + apres.notes.join('|'));
      assert(apres.cell[0] === '⭐3 ✏️', 'la cellule ⭐ Spé signale la note : ' + apres.cell[0]);
      // saisie en cours : on ne rerend pas sous les doigts du boulanger
      await page.evaluate(() => {
        window.__mockDB.special_orders.find((o) => o.id === 'so2').notes = 'Joyeux 90 ans';
        const inp = document.querySelector('.prod-row input'); inp.focus();
        scheduleProductionSpecialsRefresh();
      });
      await page.waitForTimeout(1800);
      const pendant = await page.evaluate(() => document.querySelectorAll('.prod-specials-body .sp-note').length);
      assert(pendant === 1, 'champ en cours de saisie : pas de rechargement (toujours 1 note affichée)');
      await page.evaluate(() => document.activeElement.blur());
      await page.waitForTimeout(1800);
      const fin = await page.evaluate(() => document.querySelectorAll('.prod-specials-body .sp-note').length);
      assert(fin === 2, 'saisie finie : rechargé, 2 notes affichées');
      await page.close();
    },
  },
);

// v20.280 — Veigné écrit les plaquettes des gâteaux faits ailleurs. Les notes PAR PRODUIT
// (« JA », « 100 ans ») n'arrivaient jamais : le bloc ne prenait que la note de commande.
tests.push({
  name: 'Veigné À produire — bloc « Plaquettes à écrire » : une plaquette par note, notes par produit (JA, 100 ans) ET note de commande, pour des gâteaux faits au Local',
  fn: async (ctx) => {
    const db = makeDB();
    // pat_eclair : supply St-Av = veigne → ligne produite à Veigné (déjà dans son bloc Spéciales, pas ici)
    // vt_trad : supply St-Av = local → produit au Local → plaquette à Veigné
    db.special_orders = [
      { id: 'p1', tenant_id: T, origin_shop: 'saint-avertin', production_shop: 'local', pickup_date: TEST_TODAY, pickup_time: '10:00:00', customer_name: 'Saintin', status: 'confirmee', notes: null },
      { id: 'p2', tenant_id: T, origin_shop: 'saint-avertin', production_shop: 'local', pickup_date: TEST_TODAY, pickup_time: '10:00:00', customer_name: 'Wibaut', status: 'confirmee', notes: 'Joyeux 90 ans' },
      { id: 'p3', tenant_id: T, origin_shop: 'saint-avertin', production_shop: 'local', pickup_date: TEST_TODAY, pickup_time: '11:00:00', customer_name: 'SansNote', status: 'confirmee', notes: null },
    ];
    db.special_order_items = [
      { id: 'pi1', order_id: 'p1', product_id: 'vt_trad', qty: 1, position: 0, notes: 'JA' },
      { id: 'pi2', order_id: 'p1', product_id: 'vt_trad_gr', qty: 1, position: 1, notes: '100 ans' },
      { id: 'pi3', order_id: 'p2', product_id: 'vt_trad', qty: 1, position: 0, notes: 'Sans glucose sur le dessus' },
      { id: 'pi4', order_id: 'p3', product_id: 'vt_trad', qty: 2, position: 0, notes: null },
    ];
    const page = await preparePage(ctx, { db });
    await gotoApp(page); await enterBoutique(page, 'veigne');
    await page.evaluate(() => setVue('production')); await page.waitForTimeout(800);
    const r = await page.evaluate(() => {
      const t = (el) => el.textContent.replace(/\s+/g, ' ').trim();
      const box = Array.from(document.querySelectorAll('.prod-specials-box')).find((b) => b.textContent.indexOf('Plaquettes') !== -1);
      return { tete: box ? t(box.querySelector('.prod-specials-header')) : null,
        plaquettes: box ? Array.from(box.querySelectorAll('.plaquette')).map(t) : null,
        clients: box ? Array.from(box.querySelectorAll('.prod-special-meta')).map(t) : null };
    });
    assert(r.tete === '✏️ Plaquettes & messages à écrire — 4 plaquettes · 2 commandes', 'en-tête avec compteur : ' + r.tete);
    assert(r.clients.join('|') === '10:00 · Saintin · 🏪 retrait St-Avertin|10:00 · Wibaut · 🏪 retrait St-Avertin', 'Saintin (notes produit seulement) est là, SansNote non : ' + r.clients.join('|'));
    assert(r.plaquettes.join('|') === '« JA »✏️ sur Tradition ×1 (gâteau fait par Le Local)|« 100 ans »✏️ sur Tradition Graines ×1 (gâteau fait par Le Local)|« Sans glucose sur le dessus »✏️ sur Tradition ×1 (gâteau fait par Le Local)|« Joyeux 90 ans »⭐ pour la commande : Tradition ×1 (gâteau fait par Le Local)', 'une plaquette par note, texte en clair : ' + JSON.stringify(r.plaquettes));
    await page.close();
  },
});
