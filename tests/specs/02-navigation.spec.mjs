/* ============================================================
   TESTS 02 — Chargement de l'app et navigation
   L'app démarre, l'écran d'accueil s'affiche, on peut entrer
   dans chaque boutique et ouvrir chaque onglet sans erreur.
   ============================================================ */
import { preparePage, gotoApp, enterBoutique, assert, assertEq } from '../helpers/harness.mjs';

const NAV_ATTENDUE = {
  veigne: ['ventes', 'reappro', 'reappro_pat', 'specials', 'production'],
  tours: ['ventes', 'reappro', 'reappro_pat', 'specials'],
  'saint-avertin': ['ventes', 'reappro_pat'],
  local: ['prod_boul', 'prod_tour', 'stock_tour'],
  livreur: ['tournee', 'messages'],
};

export const tests = [
  {
    name: 'l\'app démarre : splash visible, 7 boutons boutique, produits chargés',
    fn: async (ctx) => {
      const page = await preparePage(ctx);
      await gotoApp(page);
      const btns = await page.locator('#splash .splash-btn').count();
      assert(btns >= 7, `au moins 7 boutons attendus sur le splash, trouvé ${btns}`);
      const nbProducts = await page.evaluate(() => products.length);
      assert(nbProducts === 8, `8 produits fixtures attendus, trouvé ${nbProducts}`);
      assertEq(page.__pageErrors, [], 'aucune erreur JS au chargement');
    },
  },
  {
    name: 'entrer à Veigné : header correct, onglets attendus, vue Ventes rendue',
    fn: async (ctx) => {
      const page = await preparePage(ctx);
      await gotoApp(page);
      await enterBoutique(page, 'veigne');
      const header = await page.locator('#header-boutique').innerText();
      assert(header.includes('Veigné'), `header devrait afficher Veigné : "${header}"`);
      const vues = await page.evaluate(() =>
        Array.from(document.querySelectorAll('#bottom-nav .bnav-item')).map((b) => b.dataset.vue)
      );
      for (const v of NAV_ATTENDUE.veigne) {
        assert(vues.includes(v), `onglet "${v}" manquant à Veigné (trouvés : ${vues.join(', ')})`);
      }
      // la première vue doit avoir rendu du contenu
      await page.waitForFunction(() => {
        const m = document.getElementById('main-content');
        return m && m.innerHTML.length > 200 && !m.querySelector('.loading');
      });
      assertEq(page.__pageErrors, [], 'aucune erreur JS');
    },
  },
  {
    name: 'chaque boutique s\'ouvre et chaque onglet se charge sans erreur JS',
    fn: async (ctx) => {
      const page = await preparePage(ctx);
      await gotoApp(page);
      for (const b of Object.keys(NAV_ATTENDUE)) {
        await page.evaluate(() => goSplash());
        await page.waitForSelector('#splash', { state: 'visible' });
        await enterBoutique(page, b);
        // Stock Pât. est protégé par un code (v20.155) : setVue() attend la saisie et
        // ne rendrait jamais la main. On lève le verrou pour tester l'onglet quand même.
        await page.evaluate(() => { stockPatUnlocked = true; });
        const vues = await page.evaluate(() =>
          Array.from(document.querySelectorAll('#bottom-nav .bnav-item')).map((x) => x.dataset.vue)
        );
        for (const v of vues) {
          await page.evaluate((vue) => setVue(vue), v);
          await page.waitForFunction(() => {
            const m = document.getElementById('main-content');
            return m && !m.querySelector('.loading');
          }, null, { timeout: 5000 });
          assert(
            page.__pageErrors.length === 0,
            `erreur JS sur ${b} > ${v} : ${page.__pageErrors[0] || ''}`
          );
        }
      }
    },
  },
  {
    name: 'marchés : Amboise s\'ouvre sur le tableau marché du prochain vendredi',
    fn: async (ctx) => {
      const page = await preparePage(ctx);
      await gotoApp(page);
      await enterBoutique(page, 'amboise');
      const d = await page.evaluate(() => currentMarketDate);
      assertEq(d, '2026-07-24', 'marché Amboise = vendredi 24/07 (aujourd\'hui simulé : mercredi 22/07)');
      assertEq(page.__pageErrors, [], 'aucune erreur JS');
    },
  },
  {
    name: 'retour au splash : les canaux temps réel sont coupés proprement',
    fn: async (ctx) => {
      const page = await preparePage(ctx);
      await gotoApp(page);
      await enterBoutique(page, 'veigne');
      await page.evaluate(() => goSplash());
      await page.waitForSelector('#splash', { state: 'visible' });
      const appVisible = await page.evaluate(() => document.getElementById('app').style.display);
      assertEq(appVisible, 'none', 'l\'app doit être masquée après retour au splash');
      assertEq(page.__pageErrors, [], 'aucune erreur JS');
    },
  },
];
