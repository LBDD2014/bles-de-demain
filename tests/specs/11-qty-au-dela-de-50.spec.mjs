/* ============================================================
   v20.200 — Commandes spéciales : quantité au-delà de 50.

   La liste s'arrêtait à 50 : impossible de saisir 100 traditions pour un
   buffet. « Autre… » ouvre la saisie clavier, et « ↩ » revient à la liste.
   La liste reste le mode normal : sur tablette, choisir 12 est plus sûr
   que le taper.
   ============================================================ */
import { preparePage, gotoApp, enterBoutique, assert } from '../helpers/harness.mjs';

async function formulaireAvecUnProduit(ctx) {
  const page = await preparePage(ctx);
  await gotoApp(page);
  await enterBoutique(page, 'veigne');
  await page.evaluate(() => setVue('specials'));
  await page.waitForSelector('#main-content');
  await page.evaluate(() => { openNewSpecialOrder(); });
  await page.waitForSelector('.sp-item-row');
  return page;
}
const qtyDraft = (page) => page.evaluate(() => specialFormDraft.items[0].qty);

export const tests = [
  {
    name: 'Spéciales — la liste propose « Autre… » après 50',
    fn: async (ctx) => {
      const page = await formulaireAvecUnProduit(ctx);
      const o = await page.evaluate(() =>
        Array.from(document.querySelector('.sp-qty').options).map((x) => x.value));
      assert(o.indexOf('50') !== -1, 'la liste doit toujours aller jusqu\'à 50');
      assert(o.indexOf('__autre') !== -1, `« Autre… » attendu — obtenu : ${o.slice(-3).join(', ')}`);
      await page.close();
    },
  },
  {
    name: 'Spéciales — « Autre… » ouvre une saisie au clavier, vide',
    fn: async (ctx) => {
      const page = await formulaireAvecUnProduit(ctx);
      await page.evaluate(() => handleSpecialItemField(0, 'qty', '__autre'));
      await page.waitForSelector('input.sp-qty');
      const v = await page.evaluate(() => document.querySelector('input.sp-qty').value);
      assert(v === '', `la case doit être vide pour qu'on tape sa valeur, obtenu "${v}"`);
      const q = await qtyDraft(page);
      assert(q !== '__autre', '« __autre » ne doit jamais devenir une quantité');
      await page.close();
    },
  },
  {
    name: 'Spéciales — une quantité de 120 est bien retenue',
    fn: async (ctx) => {
      const page = await formulaireAvecUnProduit(ctx);
      await page.evaluate(() => handleSpecialItemField(0, 'qty', '__autre'));
      await page.waitForSelector('input.sp-qty');
      await page.fill('input.sp-qty', '120');
      await page.evaluate(() => handleSpecialItemField(0, 'qty', '120'));
      assert(String(await qtyDraft(page)) === '120', 'la quantité saisie doit être conservée');
      await page.close();
    },
  },
  {
    name: 'Spéciales — une quantité > 50 rouvre la saisie au réaffichage',
    fn: async (ctx) => {
      const page = await formulaireAvecUnProduit(ctx);
      await page.evaluate(() => { specialFormDraft.items[0].qty = 120; renderSpecials(); });
      await page.waitForSelector('.sp-item-row');
      const estInput = await page.evaluate(() => !!document.querySelector('input.sp-qty'));
      assert(estInput, 'une commande de 120 rouverte doit rester en saisie libre, pas retomber à 50');
      await page.close();
    },
  },
  {
    name: 'Spéciales — « ↩ » revient à la liste avec une valeur valide',
    fn: async (ctx) => {
      const page = await formulaireAvecUnProduit(ctx);
      await page.evaluate(() => { handleSpecialItemField(0, 'qty', '__autre'); });
      await page.waitForSelector('input.sp-qty');
      await page.evaluate(() => specialItemQtyListe(0));
      await page.waitForSelector('select.sp-qty');
      const q = await qtyDraft(page);
      assert(Number(q) >= 1 && Number(q) <= 50, `retour à une quantité de la liste attendu, obtenu "${q}"`);
      await page.close();
    },
  },
  {
    name: 'Spéciales — la liste normale ne contient aucun doublon',
    fn: async (ctx) => {
      const page = await formulaireAvecUnProduit(ctx);
      await page.evaluate(() => { specialFormDraft.items[0].qty = 23; renderSpecials(); });
      await page.waitForSelector('select.sp-qty');
      const o = await page.evaluate(() =>
        Array.from(document.querySelector('.sp-qty').options).map((x) => x.value));
      const doublons = o.filter((v, i) => o.indexOf(v) !== i);
      assert(!doublons.length, `options en double : ${doublons.join(', ')}`);
      await page.close();
    },
  },
];
