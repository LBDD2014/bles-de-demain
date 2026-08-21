/* ============================================================
   TESTS 03 — Contrôles d'accès
   PIN BackOffice et codes boutique.
   ============================================================ */
import { preparePage, gotoApp, assert, assertEq } from '../helpers/harness.mjs';
import { makeDB, TENANT_ID } from '../helpers/fixtures.mjs';

async function tapPin(page, code) {
  for (const digit of code) {
    await page.evaluate((d) => pinKey(d), digit);
  }
  // la vérification du PIN se fait dans un setTimeout(150ms)
  await page.waitForTimeout(400);
}

export const tests = [
  {
    name: 'BackOffice : le bon PIN (2412) ouvre le back office',
    fn: async (ctx) => {
      const page = await preparePage(ctx);
      await gotoApp(page);
      await page.evaluate(() => openBackOfficePin());
      await page.waitForSelector('#pin-modal', { state: 'visible' });
      await tapPin(page, '2412');
      await page.waitForFunction(() => currentBoutique === 'backoffice', null, { timeout: 5000 });
      const header = await page.locator('#header-boutique').innerText();
      assert(header.toLowerCase().includes('back'), `header BackOffice attendu : "${header}"`);
    },
  },
  {
    name: 'BackOffice : un mauvais PIN est refusé',
    fn: async (ctx) => {
      const page = await preparePage(ctx);
      await gotoApp(page);
      await page.evaluate(() => openBackOfficePin());
      await page.waitForSelector('#pin-modal', { state: 'visible' });
      await tapPin(page, '9999');
      const entered = await page.evaluate(() => currentBoutique);
      assert(entered !== 'backoffice', 'un mauvais PIN ne doit PAS ouvrir le back office');
      const errVisible = await page.locator('#pin-error').isVisible();
      assert(errVisible, 'le message d\'erreur PIN doit s\'afficher');
    },
  },
  {
    name: 'Code boutique : si un code est configuré pour Veigné, l\'entrée directe est bloquée',
    fn: async (ctx) => {
      const db = makeDB();
      db.boutique_codes = [{ tenant_id: TENANT_ID, boutique_id: 'veigne', code: '1111' }];
      const page = await preparePage(ctx, { db });
      await gotoApp(page);
      await page.evaluate(() => { enterBoutique('veigne'); });
      await page.waitForSelector('#code-overlay', { state: 'visible', timeout: 5000 });
      const entered = await page.evaluate(() => currentBoutique);
      assert(entered !== 'veigne', 'sans code saisi, on ne doit pas être entré dans Veigné');
    },
  },
  {
    name: 'Code boutique : le code maître (2412) débloque aussi la boutique',
    fn: async (ctx) => {
      const db = makeDB();
      db.boutique_codes = [{ tenant_id: TENANT_ID, boutique_id: 'veigne', code: '1111' }];
      const page = await preparePage(ctx, { db });
      await gotoApp(page);
      await page.evaluate(() => { enterBoutique('veigne'); });
      await page.waitForSelector('#code-overlay', { state: 'visible' });
      for (const d of '2412') await page.evaluate((x) => codeKey(x), d);
      await page.evaluate(() => codeSubmit());
      await page.waitForFunction(() => currentBoutique === 'veigne', null, { timeout: 5000 });
      assert(true);
    },
  },
  {
    name: 'Sans aucun code configuré, les boutiques restent en accès libre',
    fn: async (ctx) => {
      const page = await preparePage(ctx); // fixtures : boutique_codes vide
      await gotoApp(page);
      await page.evaluate(() => enterBoutique('tours'));
      await page.waitForFunction(() => currentBoutique === 'tours', null, { timeout: 5000 });
      assert(true);
    },
  },
];
