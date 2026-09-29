/* ============================================================
   v20.263 — Délai de commande PAR FAMILLE (Phil, 29/09/2026) :
   « 24h pain et viennoiserie, 48h pâtisserie, 72h fêtes ».

   Avant : 48h pour tout → 47 % des commandes depuis juillet
   déclenchaient l'alerte (surtout du pain commandé la veille,
   l'usage normal). Commande mixte = le délai le plus long ;
   texte libre = 48h (souvent number cake / pièce montée).
   + pastille « ⚠️ prise X h avant » sur la carte et dans le bloc
   Spéciales du jour, calculée depuis l'heure de SAISIE.
   Horloge des tests : mercredi 22/07/2026 10h00.
   ============================================================ */
import { preparePage, gotoApp, enterBoutique, assert } from '../helpers/harness.mjs';
import { makeDB, TENANT_ID, TEST_TODAY } from '../helpers/fixtures.mjs';

function commande(db, id, productId, extra = {}) {
  db.special_orders.push(Object.assign({
    id, tenant_id: TENANT_ID, origin_shop: 'veigne', production_shop: 'veigne',
    customer_name: 'Client ' + id, customer_phone: '0600000000', paiement: 'non_regle',
    acompte_montant: null, pickup_date: TEST_TODAY, pickup_time: '18:00',
    delivery_type: 'pickup', status: 'nouvelle', notes: null,
  }, extra));
  db.special_order_items.push({
    id: 'it-' + id, order_id: id, product_id: productId, qty: 1,
    tranche: false, notes: null, product_name_custom: null,
  });
}

export const tests = [
  {
    name: 'Délai — 24h pain/viennoiserie, 48h pâtisserie et texte libre, mixte = le plus long, 72h les 24/25/31 déc',
    fn: async (ctx) => {
      const page = await preparePage(ctx, { db: makeDB() });
      await gotoApp(page);
      const r = await page.evaluate(() => {
        const depuis = '2026-07-22T10:00';
        const pain = [{ product_id: 'vt_trad' }];
        const vien = [{ product_id: 'vp_croissant' }];
        const pat = [{ product_id: 'pat_eclair' }];
        const libre = [{ product_id: null, product_name_custom: 'Number cake 18' }];
        const etat = (d, t, it, dep) => cmdDelaiEtat(d, t, it, dep || depuis);
        return {
          painDemain11h: etat('2026-07-23', '11:00', pain),        // 25 h → OK
          painDemain9h: etat('2026-07-23', '09:00', pain),         // 23 h → hors délai (24)
          vienDemain9h: etat('2026-07-23', '09:00', vien),
          patDemain11h: etat('2026-07-23', '11:00', pat),          // 25 h → hors délai (48)
          patJ2: etat('2026-07-24', '11:00', pat),                 // 49 h → OK
          libreDemain11h: etat('2026-07-23', '11:00', libre),
          mixte: etat('2026-07-23', '11:00', pain.concat(pat)),
          noelPain: etat('2026-12-24', '10:00', pain, '2026-12-21T22:00'), // 60 h < 72
          veilleNoelPain: etat('2026-12-23', '10:00', pain, '2026-12-21T22:00'), // 36 h, jour normal → OK
          feteSansLigne: etat('2026-07-23', '11:00', undefined),   // onglet Fêtes → 48
          rattrapage: etat('2026-07-21', '11:00', pat),            // date passée → rien
        };
      });
      assert(r.painDemain11h === null, 'pain commandé 25 h avant : dans les temps');
      assert(r.painDemain9h && r.painDemain9h.requis === 24, 'pain commandé 23 h avant : hors délai (24 h)');
      assert(r.vienDemain9h && r.vienDemain9h.requis === 24, 'viennoiserie = 24 h comme le pain');
      assert(r.patDemain11h && r.patDemain11h.requis === 48, 'pâtisserie commandée la veille : hors délai (48 h)');
      assert(r.patDemain11h.nom.startsWith('Éclair Chocolat'), `l'alerte doit nommer le produit, reçu « ${r.patDemain11h.nom} »`);
      assert(r.patJ2 === null, 'pâtisserie commandée 49 h avant : dans les temps');
      assert(r.libreDemain11h && r.libreDemain11h.requis === 48, 'texte libre = 48 h');
      assert(r.mixte && r.mixte.requis === 48, 'commande mixte pain + pâtisserie = le plus long (48 h)');
      assert(r.noelPain && r.noelPain.requis === 72, 'le 24 décembre, même le pain demande 72 h');
      assert(r.veilleNoelPain === null, 'le 23 décembre reste un jour normal');
      assert(r.feteSansLigne && r.feteSansLigne.requis === 48, 'sans ligne produit (Fêtes) → 48 h');
      assert(r.rattrapage === null, 'une date déjà passée (rattrapage) ne déclenche rien');
      await page.close();
    },
  },
  {
    name: 'Délai — la pastille « prise X h avant » marque seulement les commandes tardives (carte + Spéciales du jour)',
    fn: async (ctx) => {
      const db = makeDB();
      // Éclair saisi à 9h pour 18h le jour même → 9 h < 48 h : TARDIVE
      commande(db, 'tard', 'pat_eclair', { created_at: TEST_TODAY + 'T09:00:00' });
      // Tradition saisie la veille à 9h pour 18h → 33 h ≥ 24 h : dans les temps
      commande(db, 'ok', 'vt_trad', { created_at: '2026-07-21T09:00:00' });
      // Commande régulière générée d'office → jamais de pastille
      commande(db, 'serie', 'pat_eclair', { created_at: TEST_TODAY + 'T09:00:00', serie_id: 'serie-1' });
      const page = await preparePage(ctx, { db });
      await gotoApp(page);
      await enterBoutique(page, 'veigne');

      await page.evaluate(() => setVue('specials'));
      await page.waitForSelector('.sp-card');
      const cartes = await page.evaluate(() => Array.from(document.querySelectorAll('.sp-card')).map((c) => ({
        nom: c.querySelector('.sp-card-hdr strong').textContent,
        badge: !!c.querySelector('.cmd-delai-badge'),
        txt: (c.querySelector('.cmd-delai-badge') || {}).textContent || '',
      })));
      const carte = (n) => cartes.find((c) => c.nom === 'Client ' + n);
      assert(carte('tard') && carte('tard').badge, 'la commande tardive doit porter la pastille');
      assert(carte('tard').txt.includes('9 h'), `la pastille dit l'avance réelle, reçu « ${carte('tard').txt} »`);
      assert(carte('ok') && !carte('ok').badge, 'le pain commandé la veille ne doit PAS être marqué');
      assert(carte('serie') && !carte('serie').badge, 'une commande régulière ne doit pas être marquée');

      await page.evaluate(() => setVue('production'));
      await page.waitForSelector('.prod-specials-box');
      await page.evaluate(() => { if (!document.querySelector('.prod-specials-body')) toggleProductionSpecials(); });
      await page.waitForSelector('.prod-specials-body');
      const nb = await page.evaluate(() => document.querySelectorAll('.prod-specials-body .cmd-delai-badge').length);
      assert(nb === 1, `le fournil doit voir 1 commande tardive dans Spéciales du jour, ${nb} trouvée(s)`);
      assert(page.__pageErrors.length === 0, 'erreurs JS : ' + page.__pageErrors.join(' | '));
      await page.close();
    },
  },
  {
    name: 'Délai — dans le formulaire, l\'alerte suit le produit choisi (pain OK la veille, pâtisserie non)',
    fn: async (ctx) => {
      const page = await preparePage(ctx, { db: makeDB() });
      await gotoApp(page);
      await enterBoutique(page, 'veigne');
      await page.evaluate(() => setVue('specials'));
      await page.evaluate(() => {
        openNewSpecialOrder();
        handleSpecialFormField('pickup_date', '2026-07-23');
        handleSpecialFormField('pickup_time', '11:00');
        renderSpecials();
      });
      await page.waitForSelector('#spDelaiWarn');
      const lire = () => page.evaluate(() => document.getElementById('spDelaiWarn').textContent);

      await page.evaluate(() => handleSpecialItemField(0, 'product_id', 'vt_trad'));
      assert((await lire()) === '', 'Tradition pour demain 11h (25 h) : pas d\'alerte');

      await page.evaluate(() => handleSpecialItemField(0, 'product_id', 'pat_eclair'));
      const w = await lire();
      assert(w.includes('Hors délai') && w.includes('48 h') && w.includes('Éclair Chocolat'),
        `Éclair pour demain : alerte 48 h qui nomme le produit, reçu « ${w} »`);
      assert(page.__pageErrors.length === 0, 'erreurs JS : ' + page.__pageErrors.join(' | '));
      await page.close();
    },
  },
];
