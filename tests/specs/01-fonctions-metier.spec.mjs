/* ============================================================
   TESTS 01 — Fonctions métier "pures"
   Vérifie les petites fonctions de calcul de l'app :
   dates, tri prioritaire, caisses, quantités, conditionnement.
   ============================================================ */
import { preparePage, gotoApp, assert, assertEq } from '../helpers/harness.mjs';

async function freshPage(context, nowMs) {
  const page = await preparePage(context, nowMs ? { nowMs } : {});
  await gotoApp(page);
  return page;
}

export const tests = [
  {
    name: 'todayISO — renvoie la date du jour simulé (2026-07-22)',
    fn: async (ctx) => {
      const page = await freshPage(ctx);
      assertEq(await page.evaluate(() => todayISO()), '2026-07-22');
    },
  },
  {
    name: 'serviceDateISO — avant 2h du matin, on reste sur la journée de service de la veille',
    fn: async (ctx) => {
      // 01h30 du matin le 23/07 → journée de service = 22/07
      const page = await freshPage(ctx, new Date('2026-07-23T01:30:00').getTime());
      assertEq(await page.evaluate(() => serviceDateISO()), '2026-07-22');
    },
  },
  {
    name: 'serviceDateISO — après 2h du matin, journée de service = aujourd\'hui',
    fn: async (ctx) => {
      const page = await freshPage(ctx, new Date('2026-07-23T05:00:00').getTime());
      assertEq(await page.evaluate(() => serviceDateISO()), '2026-07-23');
    },
  },
  {
    name: 'mondayOfWeek — trouve le lundi de la semaine (y compris pour un dimanche)',
    fn: async (ctx) => {
      const page = await freshPage(ctx);
      assertEq(await page.evaluate(() => mondayOfWeek('2026-07-22')), '2026-07-20'); // mercredi → lundi
      assertEq(await page.evaluate(() => mondayOfWeek('2026-07-26')), '2026-07-20'); // dimanche → lundi précédent
      assertEq(await page.evaluate(() => mondayOfWeek('2026-07-20')), '2026-07-20'); // lundi → lui-même
    },
  },
  {
    name: 'addDays — arithmétique de dates fiable (fin de mois, fin d\'année)',
    fn: async (ctx) => {
      const page = await freshPage(ctx);
      assertEq(await page.evaluate(() => addDays('2026-07-31', 1)), '2026-08-01');
      assertEq(await page.evaluate(() => addDays('2026-12-31', 1)), '2027-01-01');
      assertEq(await page.evaluate(() => addDays('2026-07-22', -1)), '2026-07-21');
    },
  },
  {
    name: 'nextMarketDateFor — Amboise = prochain vendredi, Beaujardin = prochain samedi',
    fn: async (ctx) => {
      // Aujourd'hui simulé : mercredi 22/07/2026
      const page = await freshPage(ctx);
      assertEq(await page.evaluate(() => nextMarketDateFor('amboise')), '2026-07-24'); // vendredi
      assertEq(await page.evaluate(() => nextMarketDateFor('beaujardin')), '2026-07-25'); // samedi
    },
  },
  {
    name: 'sortProductsPriority — Tradition, Tradition Graines, Baguette Épeautre en tête',
    fn: async (ctx) => {
      const page = await freshPage(ctx);
      const names = await page.evaluate(() =>
        sortProductsPriority([
          { name: 'Fougasse' },
          { name: 'Baguette Épeautre' },
          { name: 'Tradition Graines' },
          { name: 'Ancienne' },
          { name: 'Tradition' },
        ]).map((p) => p.name)
      );
      assertEq(names, ['Tradition', 'Tradition Graines', 'Baguette Épeautre', 'Ancienne', 'Fougasse']);
    },
  },
  {
    name: 'caisseOptions — croissants par caisse de 70 : demi-caisse et caisses entières',
    fn: async (ctx) => {
      const page = await freshPage(ctx);
      const opts = await page.evaluate(() => caisseOptions(70));
      assert(Array.isArray(opts) && opts.length > 0, 'caisseOptions doit renvoyer une liste');
      // les valeurs sont des chaînes ('35', '70', ...), la première option est '-'
      const demi = opts.find((o) => Number(o.val) === 35);
      const une = opts.find((o) => Number(o.val) === 70);
      const deux = opts.find((o) => Number(o.val) === 140);
      assert(demi && demi.lbl.includes('1/2'), 'la demi-caisse (35 pces) doit exister');
      assert(une && une.lbl.includes('1 caisse'), 'la caisse entière (70 pces) doit exister');
      assert(deux && deux.lbl.includes('2 caisses'), '2 caisses (140 pces) doivent exister');
    },
  },
  {
    name: 'parseQty / formatQty — virgule décimale française',
    fn: async (ctx) => {
      const page = await freshPage(ctx);
      assertEq(await page.evaluate(() => parseQty('3,5')), 3.5);
      assertEq(await page.evaluate(() => parseQty('abc')), 0);
      assertEq(await page.evaluate(() => parseQty('')), 0);
      assertEq(await page.evaluate(() => formatQty(3.5)), '3,5');
      assertEq(await page.evaluate(() => formatQty(2)), '2');
    },
  },
  {
    name: 'getProductSupply — lit l\'origine produit par boutique (JSON)',
    fn: async (ctx) => {
      const page = await freshPage(ctx);
      const r = await page.evaluate(() => {
        const p = products.find((x) => x.id === 'vt_trad');
        return {
          veigne: getProductSupply(p, 'veigne'),
          stav: getProductSupply(p, 'saint-avertin'),
          nullProd: getProductSupply(null, 'veigne'),
        };
      });
      assertEq(r.veigne, 'on_site');
      assertEq(r.stav, 'local');
      assertEq(r.nullProd, null);
    },
  },
  {
    name: 'getDefaultQty — quantité par défaut du mercredi pour la Tradition à Veigné',
    fn: async (ctx) => {
      const page = await freshPage(ctx);
      // les défauts de production sont chargés à l'entrée en boutique
      await page.evaluate((b) => enterBoutique(b), 'veigne');
      await page.waitForFunction(() => currentBoutique === 'veigne');
      // production_defaults fixture : veigne / vt_trad / mercredi (3) → 55
      const v = await page.evaluate(() => getDefaultQty('veigne', 'vt_trad', '2026-07-22'));
      assertEq(v, 55);
      const none = await page.evaluate(() => getDefaultQty('veigne', 'vt_fou', '2026-07-22'));
      assert(none === null || none === undefined, 'pas de défaut → null');
    },
  },
  {
    name: 'formatConditioning — libellés de conditionnement lisibles',
    fn: async (ctx) => {
      const page = await freshPage(ctx);
      const r = await page.evaluate(() => ({
        caisse: formatConditioning({ conditioning_unit: 'caisse', conditioning_qty: 70 }),
        vide: formatConditioning({}),
      }));
      assert(String(r.caisse).toLowerCase().includes('caisse'), 'doit mentionner la caisse : ' + r.caisse);
    },
  },
];
