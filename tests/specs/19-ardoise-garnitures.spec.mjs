/* ============================================================
   v20.251 — 🍕 Ardoise des garnitures (focaccias).

   Besoin réel (Phil, 22/09) : focaccias faites à Veigné (Veigné + St-Av), Tours
   et au Local (marchés) ; les garnitures changent. Le soir, savoir QUELLES
   garnitures restent / sont jetées. Une ardoise par site, 4 cases, chaque lieu
   coche les siennes ; Reste/Perte détaillés par garniture, total inchangé.

   Date figée des tests : mercredi 22 juillet 2026.
   ============================================================ */
import { preparePage, gotoApp, enterBoutique, assert } from '../helpers/harness.mjs';
import { makeDB, TENANT_ID } from '../helpers/fixtures.mjs';

const T = TENANT_ID;

function dbFoc() {
  const db = makeDB();
  // La base factice a déjà un vt_fou (« Fougasse ») : on le remplace par la vraie fiche.
  db.products = db.products.filter((p) => p.id !== 'vt_fou');
  db.products.push({ id: 'vt_fou', tenant_id: T, name: 'Foccaccia', category: 'traiteur', unit: 'pièce',
    actif: true, usage: 'ventes', boutique_restriction: null, pros_only_id: null,
    supply_by_boutique: { veigne: 'on_site', tours: 'on_site', 'saint-avertin': 'veigne' },
    pces_per_caisse: null, seuil_stock: null });
  db.ardoise_variantes = [
    { tenant_id: T, site: 'veigne', product_id: 'vt_fou', slot: 1, nom: 'Tomate-olive', boutiques: {} },
    { tenant_id: T, site: 'veigne', product_id: 'vt_fou', slot: 2, nom: 'Chèvre-miel', boutiques: { 'saint-avertin': false } },
    { tenant_id: T, site: 'veigne', product_id: 'vt_fou', slot: 3, nom: '', boutiques: {} },
  ];
  db.variantes_detail = [];
  return db;
}

async function ventes(ctx, boutique) {
  const page = await preparePage(ctx, { db: dbFoc() });
  await gotoApp(page);
  await enterBoutique(page, boutique);
  await page.evaluate(() => setVue('ventes'));
  await page.waitForTimeout(500);
  return page;
}

export const tests = [
  {
    name: 'Ardoise — St-Avertin ne voit que les garnitures cochées chez elle',
    fn: async (ctx) => {
      const page = await ventes(ctx, 'saint-avertin');
      const r = await page.evaluate(() => ({
        sa: ardoiseActiveSlots('saint-avertin', 'vt_fou').map((s) => s.nom),
        ve: ardoiseActiveSlots('veigne', 'vt_fou').map((s) => s.nom),
        site: ardoiseSiteFor('saint-avertin'),
      }));
      assert(r.site === 'veigne', 'St-Av utilise l\'ardoise de Veigné');
      assert(JSON.stringify(r.sa) === '["Tomate-olive"]', 'St-Av : ' + r.sa.join(', '));
      assert(JSON.stringify(r.ve) === '["Tomate-olive","Chèvre-miel"]', 'Veigné : ' + r.ve.join(', '));
      await page.close();
    },
  },
  {
    name: 'Ventes — Reste J-1 détaillé : le total remplit la case, le détail garde les noms',
    fn: async (ctx) => {
      const page = await ventes(ctx, 'veigne');
      await page.evaluate(async () => {
        const inp = document.querySelector('input[data-pid="vt_fou"][data-field="reste_j1"]');
        openArdoiseSaisie(inp);
        ardoiseStep(1, 1); ardoiseStep(1, 1); ardoiseStep(2, 1);
        await confirmArdoiseSaisie();
      });
      await page.waitForTimeout(700);   // upsertSale part après 400 ms
      const r = await page.evaluate(() => {
        const db = window.__mockDB;
        const sale = db.sales.find((x) => x.boutique_id === 'veigne' && x.product_id === 'vt_fou' && x.date === '2026-07-22');
        return {
          cell: document.querySelector('input[data-pid="vt_fou"][data-field="reste_j1"]').value,
          sale: sale && sale.reste_j1,
          det: db.variantes_detail.filter((d) => d.champ === 'reste_j1').map((d) => d.nom + '=' + d.qty).sort(),
          txt: document.getElementById('ard-sum-vt_fou').innerText,
        };
      });
      assert(r.cell === '3', 'case Reste J-1 = 3, trouvé ' + r.cell);
      assert(Number(r.sale) === 3, 'ventes en base : reste_j1 = 3, trouvé ' + r.sale);
      assert(JSON.stringify(r.det) === '["Chèvre-miel=1","Tomate-olive=2"]', 'détail : ' + r.det.join(', '));
      assert(r.txt.indexOf('Tomate-olive 2') !== -1, 'résumé sous le nom : ' + r.txt);
      await page.close();
    },
  },
  {
    name: 'Ventes — sans garniture sur l\'ardoise, la case s\'ouvre au pavé comme avant',
    fn: async (ctx) => {
      const page = await ventes(ctx, 'tours');
      const r = await page.evaluate(() => {
        const inp = document.querySelector('input[data-pid="vt_fou"][data-field="perte"]');
        openArdoiseSaisie(inp);
        const ov = document.getElementById('np-overlay');
        const saisie = document.getElementById('ardoise-saisie-modal');
        return { pave: !!(ov && ov.classList.contains('show')), detail: !!(saisie && saisie.classList.contains('show')) };
      });
      assert(r.pave && !r.detail, 'pavé attendu, pas la fenêtre de détail : ' + JSON.stringify(r));
      await page.close();
    },
  },
  {
    name: 'Ardoise — Veigné réécrit une garniture ; St-Avertin ne peut que cocher',
    fn: async (ctx) => {
      const page = await ventes(ctx, 'veigne');
      const r = await page.evaluate(async () => {
        openArdoiseEdit('vt_fou');
        const nbInputs = document.querySelectorAll('#ardoise-edit-modal .ard-edit-nom').length;
        await saveArdoiseNom(3, 'Pesto');
        const row = window.__mockDB.ardoise_variantes.find((x) => x.slot === 3 && x.site === 'veigne');
        closeArdoiseEdit();
        return { nbInputs, nom: row && row.nom };
      });
      assert(r.nbInputs === 4, 'Veigné : 4 cases modifiables, trouvé ' + r.nbInputs);
      assert(r.nom === 'Pesto', 'nom enregistré : ' + r.nom);
      await page.close();
      const p2 = await ventes(ctx, 'saint-avertin');
      const r2 = await p2.evaluate(async () => {
        openArdoiseEdit('vt_fou');
        const nbInputs = document.querySelectorAll('#ardoise-edit-modal .ard-edit-nom').length;
        await toggleArdoiseLieu(2, 'saint-avertin');
        return { nbInputs, actifs: ardoiseActiveSlots('saint-avertin', 'vt_fou').map((s) => s.nom) };
      });
      assert(r2.nbInputs === 0, 'St-Av ne réécrit pas les noms');
      assert(r2.actifs.indexOf('Chèvre-miel') !== -1, 'St-Av a coché Chèvre-miel : ' + r2.actifs.join(', '));
      await p2.close();
    },
  },
  {
    name: 'Boulangers Veigné — l\'encadré montre l\'ardoise et les restes de la veille (Veigné + St-Av)',
    fn: async (ctx) => {
      const db = dbFoc();
      db.variantes_detail.push(
        { tenant_id: T, lieu: 'saint-avertin', date: '2026-07-21', product_id: 'vt_fou', champ: 'perte', slot: 1, nom: 'Tomate-olive', qty: 2 },
        { tenant_id: T, lieu: 'veigne', date: '2026-07-21', product_id: 'vt_fou', champ: 'reste_j1', slot: 2, nom: 'Chèvre-miel', qty: 1 },
      );
      const page = await preparePage(ctx, { db });
      await gotoApp(page);
      await enterBoutique(page, 'veigne');
      await page.evaluate(() => setVue('production'));
      await page.waitForTimeout(700);
      const txt = await page.evaluate(() => {
        const el = document.querySelector('.ard-panel');
        return el ? el.innerText : '';
      });
      assert(txt.indexOf('Tomate-olive') !== -1 && txt.indexOf('Chèvre-miel') !== -1, 'ardoise affichée : ' + txt);
      assert(/St-Avertin[\s\S]*Perte : Tomate-olive 2/.test(txt), 'perte St-Av de la veille : ' + txt);
      assert(/Veigné[\s\S]*Reste J-1 : Chèvre-miel 1/.test(txt), 'reste Veigné de la veille : ' + txt);
      await page.close();
    },
  },
  {
    name: 'Marché — Pertes détaillées par garniture (ardoise du Local)',
    fn: async (ctx) => {
      const db = dbFoc();
      db.ardoise_variantes.push({ tenant_id: T, site: 'local', product_id: 'vt_fou', slot: 1, nom: 'Poivrons', boutiques: {} });
      const page = await preparePage(ctx, { db });
      await gotoApp(page);
      await enterBoutique(page, 'amboise');
      await page.evaluate(() => setVue('marche'));
      await page.waitForTimeout(500);
      await page.evaluate(() => { marketFilterEmpty = false; renderMarket(); });
      await page.evaluate(async () => {
        openArdoiseSaisie(document.querySelector('input[data-pid="vt_fou"][data-field="pertes"]'));
        ardoiseStep(1, 1); ardoiseStep(1, 1);
        await confirmArdoiseSaisie();
      });
      await page.waitForTimeout(700);
      const r = await page.evaluate(() => ({
        cell: document.querySelector('input[data-pid="vt_fou"][data-field="pertes"]').value,
        det: window.__mockDB.variantes_detail.map((d) => d.lieu + ':' + d.nom + '=' + d.qty),
      }));
      assert(r.cell === '2', 'case Pertes = 2, trouvé ' + r.cell);
      assert(r.det.indexOf('amboise:Poivrons=2') !== -1, 'détail marché : ' + r.det.join(', '));
      await page.close();
    },
  },
];
