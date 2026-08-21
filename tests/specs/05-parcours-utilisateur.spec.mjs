/* ============================================================
   TESTS 05 — Parcours utilisateur en conditions réelles
   On manipule l'app comme un vrai vendeur : vrais clics sur
   les boutons, saisie au pavé numérique, navigation aux onglets.
   Des captures d'écran sont enregistrées dans tests/screenshots/.
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { preparePage, gotoApp, assert, assertEq } from '../helpers/harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(__dirname, '..', 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });

async function shot(page, name) {
  await page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: false });
}

export const tests = [
  {
    name: 'Parcours vendeur Veigné : clic accueil → Ventes → saisie au pavé numérique',
    fn: async (ctx) => {
      const page = await preparePage(ctx);
      await gotoApp(page);
      await shot(page, '01-accueil');

      // 1. Le vendeur touche le bouton Veigné sur l'écran d'accueil
      await page.click('.splash-btn:has-text("Veigné")');
      await page.waitForSelector('#app', { state: 'visible' });
      await page.waitForFunction(() => document.querySelectorAll('#bottom-nav .bnav-item').length > 0);

      // 2. Il ouvre l'onglet Ventes
      await page.click('#bottom-nav .bnav-item[data-vue="ventes"]');
      await page.waitForFunction(() => {
        const m = document.getElementById('main-content');
        return m && !m.querySelector('.loading') && m.innerText.includes('Tradition');
      });
      await shot(page, '02-ventes-veigne');

      // 3. Le pré-remplissage du matin est visible : Tradition = 50
      const trad = await page.evaluate(() => salesData['vt_trad']);
      assertEq(String(trad.matin), '50', 'pré-remplissage Tradition affiché');

      // 4. Il saisit une perte de 3 sur la Tradition au pavé numérique
      //    (on cible l'input Perte via son data-np-label)
      const inp = page.locator('input[data-np-label*="Perte"][data-pid="vt_trad"]').first();
      const hasPerteInput = await inp.count();
      if (hasPerteInput) {
        await inp.click();
        await page.waitForSelector('#np-overlay.show');
        await shot(page, '03-pave-numerique');
        await page.click('#np-overlay .np-key:has-text("3")');
        await page.click('#np-overlay .np-ok');
        await page.waitForSelector('#np-overlay.show', { state: 'hidden' });
        // la perte doit être enregistrée dans la base mock
        await page.waitForFunction(() => {
          const r = (window.__mockDB.sales || []).find(
            (x) => x.product_id === 'vt_trad' && x.date === '2026-07-22'
          );
          return r && Number(r.perte) === 3;
        });
      }
      await shot(page, '04-ventes-apres-saisie');
      assertEq(page.__pageErrors, [], 'aucune erreur JS pendant le parcours');
    },
  },
  {
    name: 'Parcours réappro : Veigné commande des croissants au Local et envoie',
    fn: async (ctx) => {
      const page = await preparePage(ctx);
      await gotoApp(page);
      await page.click('.splash-btn:has-text("Veigné")');
      await page.waitForFunction(() => document.querySelectorAll('#bottom-nav .bnav-item').length > 0);

      await page.click('#bottom-nav .bnav-item[data-vue="reappro"]');
      await page.waitForFunction(() => {
        const m = document.getElementById('main-content');
        return m && !m.querySelector('.loading') && m.innerText.includes('Croissant');
      });
      await shot(page, '05-reappro-veigne');

      // Saisir 2 caisses de croissants (select caisse ou input selon le produit)
      const select = page.locator('select[data-pid="vp_croissant"]').first();
      if (await select.count()) {
        await select.selectOption({ index: 3 }); // '-', 1/2, 1, 2 caisses
      } else {
        const inp = page.locator('input[data-pid="vp_croissant"]').first();
        await inp.click();
        await page.waitForSelector('#np-overlay.show');
        for (const k of ['1', '4', '0']) await page.click(`#np-overlay .np-key:has-text("${k}")`);
        await page.click('#np-overlay .np-ok');
      }
      // Une écriture reappros doit avoir eu lieu pour aujourd'hui
      await page.waitForFunction(() => {
        return (window.__mockDB.reappros || []).some(
          (r) => r.product_id === 'vp_croissant' && r.service_date === '2026-07-22' && r.commander
        );
      });
      await shot(page, '06-reappro-saisie');
      assertEq(page.__pageErrors, [], 'aucune erreur JS pendant le réappro');
    },
  },
  {
    name: 'Parcours BackOffice : déverrouillage au PIN sur le pavé, liste produits',
    fn: async (ctx) => {
      const page = await preparePage(ctx);
      await gotoApp(page);
      // Bouton cadenas en bas de l'accueil
      await page.click('button[onclick*="openBackOfficePin"]');
      await page.waitForSelector('#pin-modal', { state: 'visible' });
      await shot(page, '07-pin-backoffice');
      for (const d of '2412') {
        await page.click(`#pin-modal button:has-text("${d}")`);
      }
      await page.waitForFunction(() => currentBoutique === 'backoffice', null, { timeout: 6000 });
      await page.waitForFunction(() => {
        const m = document.getElementById('main-content');
        return m && !m.querySelector('.loading') && m.innerText.length > 100;
      });
      await shot(page, '08-backoffice-produits');
      const txt = await page.evaluate(() => document.getElementById('main-content').innerText);
      assert(txt.includes('Tradition') || txt.includes('Croissant'), 'la liste produits doit s\'afficher');
      assertEq(page.__pageErrors, [], 'aucune erreur JS dans le BackOffice');
    },
  },
  {
    name: 'Parcours livreur : la tournée du jour s\'affiche sans erreur',
    fn: async (ctx) => {
      const page = await preparePage(ctx);
      await gotoApp(page);
      await page.click('.splash-btn:has-text("Livreur")');
      await page.waitForFunction(() => document.querySelectorAll('#bottom-nav .bnav-item').length > 0);
      await page.waitForFunction(() => {
        const m = document.getElementById('main-content');
        return m && !m.querySelector('.loading');
      });
      await shot(page, '09-livreur-tournee');
      assertEq(page.__pageErrors, [], 'aucune erreur JS côté livreur');
    },
  },
];
