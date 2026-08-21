/* ============================================================
   TESTS 04 — Règles métier clés
   Le pré-remplissage des ventes du matin, l'enregistrement
   d'une vente, et la garantie qu'AUCUNE requête ne part vers
   la vraie base de production pendant les tests.
   ============================================================ */
import { preparePage, gotoApp, enterBoutique, assert, assertEq } from '../helpers/harness.mjs';

async function openVentes(page) {
  await enterBoutique(page, 'veigne');
  await page.evaluate(() => setVue('ventes'));
  // attendre que le pré-remplissage soit calculé et rendu
  await page.waitForFunction(() => {
    const m = document.getElementById('main-content');
    return m && !m.querySelector('.loading') && salesData && Object.keys(salesData).length > 0;
  });
}

export const tests = [
  {
    name: 'Ventes — Matin(J) = Prévis(J-1) − Reste J1 : Tradition 60 − 10 = 50',
    fn: async (ctx) => {
      const page = await preparePage(ctx);
      await gotoApp(page);
      await openVentes(page);
      const trad = await page.evaluate(() => salesData['vt_trad']);
      assert(trad, 'salesData doit contenir la Tradition');
      assertEq(String(trad.matin), '50', 'Tradition : 60 prévus hier − 10 restes = 50');
      assertEq(trad.matin_auto, 50, 'matin_auto doit garder la trace du calcul');
    },
  },
  {
    name: 'Ventes — jamais de stock négatif : Fougasse 12 prévus − 15 restes = 0 (pas −3)',
    fn: async (ctx) => {
      const page = await preparePage(ctx);
      await gotoApp(page);
      await openVentes(page);
      const fou = await page.evaluate(() => salesData['vt_fou']);
      assert(fou, 'salesData doit contenir la Fougasse');
      assertEq(String(fou.matin), '0', 'le pré-remplissage ne doit jamais être négatif');
    },
  },
  {
    name: 'Ventes — produit livré par Le Local : Matin = réappro envoyée hier (140 croissants)',
    fn: async (ctx) => {
      const page = await preparePage(ctx);
      await gotoApp(page);
      await openVentes(page);
      const cr = await page.evaluate(() => salesData['vp_croissant']);
      assert(cr, 'salesData doit contenir le Croissant');
      assertEq(String(cr.matin), '140', 'Croissant : réappro de 140 envoyée hier');
    },
  },
  {
    name: 'Ventes — pas de prévis ni de réappro hier → pas de pré-remplissage',
    fn: async (ctx) => {
      const page = await preparePage(ctx);
      await gotoApp(page);
      await openVentes(page);
      const pc = await page.evaluate(() => salesData['vp_painchoc'] || null);
      assert(!pc || pc.matin === '' || pc.matin == null, 'Pain Chocolat : rien hier → matin vide');
    },
  },
  {
    name: 'Ventes — le pré-remplissage est bien enregistré en base (upsert sales)',
    fn: async (ctx) => {
      const page = await preparePage(ctx);
      await gotoApp(page);
      await openVentes(page);
      const rows = await page.evaluate(() =>
        (window.__mockDB.sales || []).filter((r) => r.date === '2026-07-22')
      );
      const trad = rows.find((r) => r.product_id === 'vt_trad');
      assert(trad, 'une ligne sales du 22/07 doit exister pour la Tradition');
      assertEq(trad.matin, 50);
      assertEq(trad.day_closed, false, 'journée non validée par défaut');
    },
  },
  {
    name: 'Ventes — la saisie manuelle d\'une vente écrit dans la base (upsertSale)',
    fn: async (ctx) => {
      const page = await preparePage(ctx);
      await gotoApp(page);
      await openVentes(page);
      await page.evaluate(async () => {
        salesData['vt_trad'].aprem = '8';
        salesData['vt_trad'].perte = '2';
        await upsertSale('vt_trad');
      });
      const row = await page.evaluate(() =>
        (window.__mockDB.sales || []).find((r) => r.product_id === 'vt_trad' && r.date === '2026-07-22')
      );
      assertEq(row.aprem, 8, 'vente après-midi enregistrée');
      assertEq(row.perte, 2, 'perte enregistrée');
    },
  },
  {
    name: 'SÉCURITÉ — aucune requête réseau ne part vers la vraie base Supabase',
    fn: async (ctx) => {
      const page = await preparePage(ctx);
      await gotoApp(page);
      await openVentes(page);
      await page.evaluate(() => setVue('reappro'));
      await page.waitForTimeout(300);
      const leaks = page.__externalRequests.filter((u) => u.includes('supabase.co'));
      assertEq(leaks, [], 'requêtes interceptées vers supabase.co (elles doivent passer par le mock)');
    },
  },
  {
    name: 'Priorité d\'affichage — Tradition en tête de la vue Prévis Pain',
    fn: async (ctx) => {
      const page = await preparePage(ctx);
      await gotoApp(page);
      await enterBoutique(page, 'veigne');
      await page.evaluate(() => setVue('previs_pain'));
      await page.waitForFunction(() => {
        const m = document.getElementById('main-content');
        return m && !m.querySelector('.loading') && m.innerText.includes('Tradition');
      });
      const txt = await page.evaluate(() => document.getElementById('main-content').innerText);
      const iTrad = txt.indexOf('Tradition');
      const iFou = txt.indexOf('Fougasse');
      assert(iTrad !== -1, 'la Tradition doit être affichée dans la vue Production');
      assert(iFou !== -1, 'la Fougasse doit être affichée dans la vue Production');
      assert(iTrad < iFou, 'la Tradition (prioritaire) doit apparaître avant la Fougasse');
    },
  },
];
