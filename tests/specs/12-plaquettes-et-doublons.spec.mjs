/* ============================================================
   v20.201 — Deux problèmes constatés sur les commandes du 25/08.

   1) Le sélecteur produit d'une commande spéciale proposait les DEUX
      catalogues (vente et réassort), avec parfois le même nom. Les 18
      croissants d'une cliente sont tombés sur la référence réassort : ligne
      séparée au lieu de s'ajouter aux 48 de la production.

   2) Une commande de Tartes Vigneronnes (produites au Local) portait la note
      « Joyeux anniversaire ». La plaquette se fabrique à Veigné — qui ne
      voyait jamais cette commande, une commande n'ayant qu'un seul site de
      production.
   ============================================================ */
import { preparePage, gotoApp, enterBoutique, assert } from '../helpers/harness.mjs';
import { makeDB, TENANT_ID, TEST_TODAY } from '../helpers/fixtures.mjs';

const T = TENANT_ID;

/** Deux « Croissant » (vente + réassort) et un produit qui n'existe qu'en réassort. */
function dbCatalogueDouble() {
  const db = makeDB();
  db.products.push(
    { id: 'cro_reappro', tenant_id: T, name: 'Croissant', category: 'viennoiserie',
      actif: true, usage: 'reappro', supply_by_boutique: null, pros_only_id: null,
      pces_per_caisse: null, seuil_stock: null },
    { id: 'chausson_raye', tenant_id: T, name: 'Chausson aux Pommes Rayées', category: 'viennoiserie',
      actif: true, usage: 'reappro', supply_by_boutique: null, pros_only_id: null,
      pces_per_caisse: null, seuil_stock: null }
  );
  return db;
}

async function selecteurProduits(ctx, db, categorie) {
  const page = await preparePage(ctx, { db });
  await gotoApp(page);
  await enterBoutique(page, 'veigne');
  await page.evaluate(() => setVue('specials'));
  await page.waitForSelector('#main-content');
  await page.evaluate(() => openNewSpecialOrder());
  await page.waitForSelector('.sp-item-row');
  await page.evaluate((c) => handleSpecialItemField(0, 'category', c), categorie);
  await page.waitForSelector('.sp-item-row select');
  const noms = await page.evaluate(() => {
    const sels = Array.from(document.querySelectorAll('.sp-item-row select'));
    const s = sels[sels.length - 1];
    return Array.from(s.options).map((o) => o.textContent.trim());
  });
  return { page, noms };
}

/** Commande produite au Local, avec une note : la plaquette est pour Veigné. */
function dbPlaquette(extra) {
  const db = makeDB();
  db.special_orders = [Object.assign({
    id: 'cmd-vig', tenant_id: T, origin_shop: 'saint-avertin', production_shop: 'local',
    customer_name: 'Me caplan', pickup_date: TEST_TODAY, pickup_time: '10:00',
    delivery_type: 'pickup', status: 'nouvelle', notes: 'Joyeux anniversaire',
  }, extra || {})];
  db.special_order_items = [
    { id: 'it-vig', order_id: 'cmd-vig', product_id: 'vt_trad', qty: 2, tranche: false,
      notes: null, product_name_custom: null },
  ];
  return db;
}

async function prodVeigne(ctx, db) {
  const page = await preparePage(ctx, { db });
  await gotoApp(page);
  await enterBoutique(page, 'veigne');
  await page.evaluate(() => setVue('production'));
  await page.waitForSelector('.prod-filter-bar');
  return page;
}
const texte = (page) => page.evaluate(() => document.getElementById('main-content').textContent || '');

export const tests = [
  {
    name: 'Spéciales — le « Croissant » réassort ne double plus celui de la vente',
    fn: async (ctx) => {
      const { page, noms } = await selecteurProduits(ctx, dbCatalogueDouble(), 'viennoiserie');
      const n = noms.filter((x) => x === 'Croissant').length;
      assert(n === 1, `un seul « Croissant » attendu, ${n} trouvé(s) — liste : ${noms.join(' | ')}`);
      await page.close();
    },
  },
  {
    name: 'Spéciales — un produit qui n\'existe qu\'en réassort reste commandable',
    fn: async (ctx) => {
      const { page, noms } = await selecteurProduits(ctx, dbCatalogueDouble(), 'viennoiserie');
      assert(noms.indexOf('Chausson aux Pommes Rayées') !== -1,
        `le chausson rayé doit rester proposé — liste : ${noms.join(' | ')}`);
      await page.close();
    },
  },
  {
    name: 'Spéciales — un produit déjà choisi ne disparaît jamais du menu',
    fn: async (ctx) => {
      const page = await preparePage(ctx, { db: dbCatalogueDouble() });
      await gotoApp(page);
      await enterBoutique(page, 'veigne');
      await page.evaluate(() => setVue('specials'));
      await page.evaluate(() => openNewSpecialOrder());
      await page.waitForSelector('.sp-item-row');
      // une vieille commande pointe encore sur la référence réassort
      await page.evaluate(() => {
        specialFormDraft.items[0].category = 'viennoiserie';
        specialFormDraft.items[0].product_id = 'cro_reappro';
        renderSpecials();
      });
      await page.waitForSelector('.sp-item-row select');
      const ids = await page.evaluate(() => {
        const sels = Array.from(document.querySelectorAll('.sp-item-row select'));
        return Array.from(sels[sels.length - 1].options).map((o) => o.value);
      });
      assert(ids.indexOf('cro_reappro') !== -1,
        'une référence déjà enregistrée doit rester visible, sinon la commande se vide toute seule');
      await page.close();
    },
  },
  {
    name: 'Veigné — voit la plaquette d\'une commande produite au Local',
    fn: async (ctx) => {
      const page = await prodVeigne(ctx, dbPlaquette());
      const t = await texte(page);
      assert(t.includes('Plaquettes'), 'le bloc « Plaquettes & messages » doit apparaître');
      assert(t.includes('Joyeux anniversaire'), 'le message à écrire doit être lisible');
      assert(t.includes('Me caplan'), 'le nom du client doit être affiché');
      await page.close();
    },
  },
  {
    name: 'Veigné — pas de bloc quand aucune commande ne porte de note',
    fn: async (ctx) => {
      const page = await prodVeigne(ctx, dbPlaquette({ notes: null }));
      const t = await texte(page);
      assert(!t.includes('Plaquettes'), 'aucun bloc vide ne doit s\'afficher');
      await page.close();
    },
  },
  {
    name: 'Veigné — une commande annulée ne fait pas travailler pour rien',
    fn: async (ctx) => {
      const page = await prodVeigne(ctx, dbPlaquette({ status: 'annulee' }));
      const t = await texte(page);
      assert(!t.includes('Plaquettes'), 'une commande annulée ne doit pas demander de plaquette');
      await page.close();
    },
  },
  {
    name: 'Veigné — une commande qu\'elle produit déjà n\'est pas listée deux fois',
    fn: async (ctx) => {
      const page = await prodVeigne(ctx, dbPlaquette({ production_shop: 'veigne' }));
      const t = await texte(page);
      assert(!t.includes('Plaquettes & messages'),
        'elle est déjà dans le bloc « Spéciales du jour », inutile de la répéter');
      await page.close();
    },
  },
];
