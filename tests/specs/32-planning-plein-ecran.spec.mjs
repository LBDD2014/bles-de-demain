/* ============================================================
   v20.267 — Planning (Fabrication) plein écran (Phil, 29/09/2026) :
   « que la vision soit plus large et que je n'aie pas besoin de
   scroller, sur l'ordi et si possible sur la tablette ».
   · toute la largeur, UNE ligne par produit
   · ↑↓✏️🙈🗑 seulement avec « ✏️ Modifier la liste » (mémorisé)
   · grand écran : 2 moitiés côte à côte, jamais coupées entre une
     pâte et ses déclinaisons ; tablette : 1 colonne sans débord
   · ligne des jours collée en haut
   Premier test de fabrication.html : base factice, rien vers Supabase.
   ============================================================ */
import { preparePage, assert } from '../helpers/harness.mjs';
import { makeDB, TENANT_ID } from '../helpers/fixtures.mjs';

const SECTIONS = [['pains', 12], ['speciaux', 5], ['bio', 11], ['levains', 3], ['viennoiserie', 11], ['notes', 1]];

// ~43 lignes comme le Local ; dans « pains », une pâte en kg + 6 déclinaisons en bacs
function lignesPlanning() {
  const out = []; let id = 1;
  SECTIONS.forEach(([sec, n]) => {
    for (let i = 0; i < n; i++) {
      const l = { id: id++, nom: sec + ' ' + (i + 1), unite: 'bacs', ordre: id, actif: true, section: sec, pate: null, site: 'local' };
      if (sec === 'pains' && i === 0) { l.nom = 'Tradition'; l.unite = 'kg'; }
      if (sec === 'pains' && i >= 1 && i <= 6) l.pate = 'Tradition';
      if (sec === 'viennoiserie' && i === 0) l.nom = 'Baguette viennoise chocolat';   // le nom le plus long en vrai
      out.push(l);
    }
  });
  return out;
}

async function ouvrirPlanning(ctx, viewport) {
  const db = makeDB();
  db.boutique_codes = [{ tenant_id: TENANT_ID, boutique_id: 'master', code: '9999' }];
  // les lignes passent par la base factice : l'app les charge elle-même (planLoad), comme en vrai
  const lignes = lignesPlanning();
  db.fab_planning_lignes = lignes;
  db.fab_planning_valeurs = lignes.map((l) => ({ ligne_id: l.id, date_jour: '2026-07-21', valeur: l.unite === 'kg' ? '75+75+50' : '2' }));
  const page = await preparePage(ctx, { db });
  await page.setViewportSize(viewport);
  await page.addInitScript(() => { try { localStorage.setItem('fabUnlockCode', '9999'); localStorage.removeItem('planEditMode'); localStorage.removeItem('planHideEmpty'); } catch (e) {} });
  await page.goto('http://127.0.0.1:8787/fabrication.html');
  await page.waitForFunction(() => typeof planLoad === 'function' && typeof planPoserGrille === 'function');
  await page.waitForTimeout(800);   // laisser loadAll() finir son premier passage
  await page.evaluate(async () => { planSite = 'local'; planWeekStart = '2026-07-20'; show('plan'); await planLoad(); planRender(); });
  await page.waitForFunction(() => document.querySelectorAll('#planTblWrap td.pname').length > 40);
  return page;
}

export const tests = [
  {
    name: 'Planning — grand écran : 2 moitiés côte à côte, une ligne par produit, pas de boutons en consultation',
    fn: async (ctx) => {
      const page = await ouvrirPlanning(ctx, { width: 1400, height: 900 });
      const r = await page.evaluate(() => {
        const wrap = document.getElementById('planTblWrap');
        const lignes = [...wrap.querySelectorAll('td.pname')].filter((td) => !td.closest('tr.plan-valid'));
        const cols = [...wrap.querySelectorAll('.plan-col')];
        const premiere = cols[1] && cols[1].querySelector('tbody tr:not(.plan-sec) td.pname');
        return {
          cols: cols.length,
          ctrls: wrap.querySelectorAll('.plan-ctrls').length,
          hauts: lignes.map((td) => td.closest('tr').getBoundingClientRect().height).sort((a, b) => a - b),
          deborde: wrap.scrollWidth > wrap.clientWidth + 6,
          droiteCommenceParDeclinaison: !!(premiere && premiere.classList.contains('pdecl')),
          rangees: cols.map((c) => c.querySelectorAll('tbody tr').length),
          zoneModif: getComputedStyle(document.getElementById('planEditZone')).display,
          collant: getComputedStyle(wrap.querySelector('thead th')).position,
          pageLarge: document.getElementById('plan').getBoundingClientRect().width,
        };
      });
      assert(r.cols === 2, `2 moitiés attendues sur 1400 px, reçu ${r.cols}`);
      assert(!r.deborde, 'les 2 moitiés ne doivent pas déborder en largeur');
      assert(r.ctrls === 0, `aucun bouton ↑↓✏️🙈🗑 en consultation, reçu ${r.ctrls}`);
      // une ligne par produit ; seuls les noms les plus longs (« Baguette viennoise chocolat ») peuvent passer sur 2 lignes
      const median = r.hauts[Math.floor(r.hauts.length / 2)], max = r.hauts[r.hauts.length - 1];
      assert(median <= 32, `une ligne par produit (≤ 32 px), la moitié des lignes fait plus de ${Math.round(median)} px`);
      assert(max <= 46, `au pire 2 lignes pour un nom très long, la plus haute fait ${Math.round(max)} px`);
      assert(r.hauts.filter((h) => h > 32).length <= 3, 'au plus 3 noms sur 2 lignes');
      assert(!r.droiteCommenceParDeclinaison, 'la coupure ne tombe jamais entre une pâte et ses déclinaisons');
      assert(Math.abs(r.rangees[0] - r.rangees[1]) <= 8, `moitiés équilibrées, reçu ${r.rangees.join(' / ')}`);
      assert(r.zoneModif === 'none', 'ajout / produits masqués / jours fermés cachés en consultation');
      assert(r.collant === 'sticky', 'la ligne des jours reste collée en haut');
      assert(r.pageLarge > 1300, `la page prend toute la largeur (plus bridée à 780 px), reçu ${Math.round(r.pageLarge)}`);
      assert(page.__pageErrors.length === 0, 'erreurs JS : ' + page.__pageErrors.join(' | '));
      await page.close();
    },
  },
  {
    name: 'Planning — « ✏️ Modifier la liste » montre les boutons sur la MÊME ligne et s\'en souvient',
    fn: async (ctx) => {
      const page = await ouvrirPlanning(ctx, { width: 1400, height: 900 });
      await page.evaluate(() => planSetEditMode(true));
      const r = await page.evaluate(() => {
        const wrap = document.getElementById('planTblWrap');
        const lignes = [...wrap.querySelectorAll('tbody tr')].filter((tr) => tr.querySelector('.plan-ctrls'));
        const td = lignes[3].querySelector('td.pname');
        const nom = td.querySelector('.pname-row > span').getBoundingClientRect();
        const btn = td.querySelector('.plan-ctrls').getBoundingClientRect();
        return {
          nb: lignes.length,
          memeLigne: Math.abs((nom.top + nom.bottom) / 2 - (btn.top + btn.bottom) / 2) < 8,
          memo: localStorage.getItem('planEditMode'),
          zoneModif: getComputedStyle(document.getElementById('planEditZone')).display,
          coche: document.getElementById('planEditChk').checked,
        };
      });
      assert(r.nb >= 40, `boutons sur chaque produit en mode modification, reçu ${r.nb}`);
      assert(r.memeLigne, 'les boutons sont à côté du nom, pas sur un 2e étage');
      assert(r.memo === '1' && r.coche, 'le choix est mémorisé sur l\'appareil');
      assert(r.zoneModif !== 'none', 'la zone « + Ajouter une ligne » réapparaît');
      await page.evaluate(() => planSetEditMode(false));
      const n = await page.evaluate(() => document.querySelectorAll('#planTblWrap .plan-ctrls').length);
      assert(n === 0, 'décoché : les boutons disparaissent');
      await page.close();
    },
  },
  {
    name: 'Planning — tablette : une colonne, sans débord, 7 jours et « 75+75+50 » lisible',
    fn: async (ctx) => {
      const page = await ouvrirPlanning(ctx, { width: 820, height: 1180 });
      const r = await page.evaluate(() => {
        const wrap = document.getElementById('planTblWrap');
        const cell = [...wrap.querySelectorAll('input.pcell')].find((i) => i.value === '75+75+50');
        return {
          tables: wrap.querySelectorAll('table.plan-tbl').length,
          deborde: wrap.scrollWidth > wrap.clientWidth + 6,
          jours: wrap.querySelectorAll('thead th').length - 1,
          lisible: cell ? cell.scrollWidth <= cell.clientWidth + 1 : false,
        };
      });
      assert(r.tables === 1, `une seule colonne sur tablette, reçu ${r.tables} tableaux`);
      assert(!r.deborde, 'rien ne dépasse sur les côtés');
      assert(r.jours === 7, `7 jours affichés, reçu ${r.jours}`);
      assert(r.lisible, '« 75+75+50 » (3 pétrins) tient dans sa case');
      assert(page.__pageErrors.length === 0, 'erreurs JS : ' + page.__pageErrors.join(' | '));
      await page.close();
    },
  },
  {
    name: 'Planning — impression A4 : toujours UNE page, même avec des polices plus hautes (Windows) et 70 lignes',
    fn: async (ctx) => {
      for (const cas of ['normal', 'polices-hautes', '70-lignes']) {
        const db = makeDB();
        db.boutique_codes = [{ tenant_id: TENANT_ID, boutique_id: 'master', code: '9999' }];
        let lignes = lignesPlanning();
        if (cas === '70-lignes') lignes = lignes.concat(lignesPlanning().slice(0, 27).map((l, i) => Object.assign({}, l, { id: 500 + i, nom: l.nom + ' bis', pate: null })));
        db.fab_planning_lignes = lignes;
        db.fab_planning_valeurs = lignes.map((l) => ({ ligne_id: l.id, date_jour: '2026-07-21', valeur: l.unite === 'kg' ? '75+75+50' : '2' }));
        const page = await preparePage(ctx, { db });
        await page.addInitScript((haut) => {
          try { localStorage.setItem('fabUnlockCode', '9999'); } catch (e) {}
          // simule des polices plus hautes que prévu (écart entre machines), à l'écran ET à l'impression
          if (haut) document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = '#printwrap td,#printwrap th,#planPrintMesure td,#planPrintMesure th{line-height:1.75!important}'; document.head.appendChild(st); });
        }, cas === 'polices-hautes');
        await page.goto('http://127.0.0.1:8787/fabrication.html');
        await page.waitForFunction(() => typeof planPrintWeek === 'function');
        await page.waitForTimeout(800);
        await page.evaluate(async () => { window.print = () => {}; planSite = 'local'; planHideEmpty = false; planWeekStart = '2026-07-20'; show('plan'); await planLoad(); planRender(); planPrintWeek(); });
        await page.waitForSelector('#printwrap', { state: 'attached' });
        await page.waitForTimeout(500);
        await page.emulateMedia({ media: 'print' });
        const pdf = await page.pdf({ format: 'A4', preferCSSPageSize: true });
        const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
        assert(pages === 1, `impression A4 (${cas}) : 1 page attendue, reçu ${pages}`);
        assert(page.__pageErrors.length === 0, 'erreurs JS : ' + page.__pageErrors.join(' | '));
        await page.close();
      }
    },
  },
  {
    name: 'Planning — pièces par bac PAR SITE : 40 × 90 g = 3,6 kg de pâte à Veigné, la recette (2,7 kg) sinon ; « bacs de 40 » affiché',
    fn: async (ctx) => {
      const db = makeDB();
      db.boutique_codes = [{ tenant_id: TENANT_ID, boutique_id: 'master', code: '9999' }];
      db.fab_ingredients = [{ id: 'ing_pate_viennoise', nom: 'Pâte à viennoise', categorie: 'autre', unite: 'kg' }];
      db.fab_produits = [
        { id: 'pr_viennoise', nom: 'La Viennoise', categorie: 'viennoiserie', actif: true },
        { id: 'pr_mel_pain_burger_v', nom: 'Pain burger', categorie: 'melange', actif: true, poids_piece_g: 90 },
      ];
      db.fab_recettes = [{ id: 52, produit_id: 'pr_mel_pain_burger_v', rendement_base: 1, actif: true }];
      db.fab_recette_lignes = [{ id: 361, recette_id: 52, ingredient_id: 'ing_pate_viennoise', quantite: 2.7, unite: 'kg' }];
      db.fab_planning_lignes = [
        { id: 1, nom: 'La Viennoise', unite: 'kg', pate: 'Viennoise', kg_farine_unite: 1, section: 'viennoiserie', ordre: 1, actif: true, site: 'veigne', pieces_par_bac: null },
        { id: 2, nom: 'Pain burger', unite: 'bacs', pate: 'Viennoise', section: 'viennoiserie', ordre: 2, actif: true, site: 'veigne', pieces_par_bac: 40 },
      ];
      db.fab_planning_valeurs = [{ ligne_id: 2, date_jour: '2026-07-21', valeur: '2' }];
      const page = await preparePage(ctx, { db });
      await page.addInitScript(() => { try { localStorage.setItem('fabUnlockCode', '9999'); localStorage.removeItem('planHideEmpty'); } catch (e) {} });
      await page.goto('http://127.0.0.1:8787/fabrication.html');
      await page.waitForFunction(() => typeof planLoad === 'function' && typeof planUniteLbl === 'function');
      await page.waitForTimeout(800);
      const r = await page.evaluate(async () => {
        planSite = 'veigne'; planWeekStart = '2026-07-20'; show('plan'); await planLoad(); planRender();
        const lg = planLignes.find((l) => l.nom === 'Pain burger');
        const avec = melangePateParBac('pr_mel_pain_burger_v', lg);                       // 40 × 90 g
        const sans = melangePateParBac('pr_mel_pain_burger_v', Object.assign({}, lg, { pieces_par_bac: null }));   // recette
        window.print = () => {}; planPrintWeek(); await new Promise((ok) => setTimeout(ok, 400));
        return { avec, sans, ecran: document.querySelector('#planTblWrap').textContent.includes('bacs de 40'),
          feuille: document.querySelector('#printwrap').textContent.includes('bacs de 40'), colOK: planColPiecesOK };
      });
      assert(Math.abs(r.avec - 3.6) < 0.001, `Veigné, un bac de 40 pièces de 90 g = 3,6 kg de pâte, reçu ${r.avec}`);
      assert(Math.abs(r.sans - 2.7) < 0.001, `sans réglage : la recette (2,7 kg), reçu ${r.sans}`);
      assert(r.ecran, 'l\'écran affiche « bacs de 40 »');
      assert(r.feuille, 'la feuille A4 affiche « bacs de 40 »');
      assert(r.colOK, 'la colonne pieces_par_bac est reconnue');
      assert(page.__pageErrors.length === 0, 'erreurs JS : ' + page.__pageErrors.join(' | '));
      await page.close();
    },
  },
];
