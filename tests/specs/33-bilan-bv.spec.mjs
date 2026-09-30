/* ============================================================
   v20.269 — Bilan matière bio, vue « Bureau Veritas » (Phil, 30/09/2026) :
   le contrôleur compte les sacs, pointe les bons, regarde l'écart.
   · un site, une période, une carte par farine bio
   · Départ + Entrées − Sorties = Devrait rester, puis Compté → écart
   · Entrées = bons + reçu d'un autre site ; Sorties = prod validée + envoyé + pertes
   · le comptage retenu = le dernier de la période, écart mesuré à SA date
   · feuille A4 : tableau + bons à pointer (n°, lot) + envois + signatures
   Données injectées directement dans les variables du bilan (la base factice
   ne sait pas imbriquer recette → lignes) ; rien ne part vers Supabase.
   ============================================================ */
import { preparePage, assert } from '../helpers/harness.mjs';
import { makeDB, TENANT_ID } from '../helpers/fixtures.mjs';

const RECETTE = { rendement_base: 1, fab_recette_lignes: [{ ingredient_id: 'ing_t80', quantite: 1 }, { ingredient_id: 'ing_levain_dur', quantite: 0.4 }] };

async function ouvrirBilan(ctx) {
  const db = makeDB();
  db.boutique_codes = [{ tenant_id: TENANT_ID, boutique_id: 'master', code: '9999' }];
  const page = await preparePage(ctx, { db });
  await page.setViewportSize({ width: 820, height: 1000 });
  await page.addInitScript(() => { try { localStorage.setItem('fabUnlockCode', '9999'); } catch (e) {} });
  await page.goto('http://127.0.0.1:8787/fabrication.html');
  await page.waitForFunction(() => typeof bilLoad === 'function' && typeof bilExportHtml === 'function');
  await page.waitForTimeout(800);
  await page.evaluate(() => { show('bil'); });
  await page.waitForFunction(() => (document.getElementById('bilMonthLbl').textContent || '') !== '');   // bilEnter a fini (sinon son chargement écraserait nos données)
  await page.waitForTimeout(200);
  await page.evaluate((RECETTE) => {
    ingredients = [
      { id: 'ing_t80', nom: 'T80 Bio Bise', categorie: 'farine', bio: true, unite: 'kg', fournisseur_id: 'four_suire' },
      { id: 'ing_bp', nom: 'Blés de pop', categorie: 'farine', bio: true, unite: 'kg' },
      { id: 'ing_huile', nom: 'Huile bio', categorie: 'autre', bio: true, unite: 'L' },
      { id: 'ing_levain_dur', nom: 'Levain dur', categorie: 'levain', bio: true, unite: 'kg', farine_levain_id: 'ing_t80', eau_ratio: 0.6 },
    ];
    fournisseurs = [{ id: 'four_suire', nom: 'Suire' }];
    _ingById = {}; ingredients.forEach((i) => { _ingById[i.id] = i; });
    bilLivr = [
      { ingredient_id: 'ing_t80', site: 'local', date_livraison: '2026-06-01', quantite_kg: 1000, numero_bon: 'VIEUX', numero_lot: 'X', fournisseur_id: 'four_suire' },   // avant le comptage du 30/06 → ignoré
      { ingredient_id: 'ing_t80', site: 'local', date_livraison: '2026-07-03', quantite_kg: 125, numero_bon: 'GIR1', numero_lot: 'L1', fournisseur_id: 'four_suire' },
      { ingredient_id: 'ing_t80', site: 'local', date_livraison: '2026-07-15', quantite_kg: 100, numero_bon: 'GIR2', numero_lot: null, fournisseur_id: 'four_suire' },
    ];
    bilInv = [
      { ingredient_id: 'ing_t80', site: 'local', date_inv: '2026-06-30', qte_reelle_kg: 50 },
      { ingredient_id: 'ing_t80', site: 'local', date_inv: '2026-07-28', qte_reelle_kg: 100 },
      { ingredient_id: 'ing_huile', site: 'local', date_inv: '2026-06-30', qte_reelle_kg: 12 },
    ];
    bilMouv = [
      { ingredient_id: 'ing_bp', site_depart: 'local', site_arrivee: 'tours', date_mouvement: '2026-07-10', quantite_kg: 50 },
      { ingredient_id: 'ing_t80', site_depart: 'veigne', site_arrivee: 'local', date_mouvement: '2026-07-12', quantite_kg: 25 },
    ];
    bilProd = [
      { site: 'local', date_prod: '2026-07-05', quantite: 100, valide: true, fab_recettes: RECETTE },
      { site: 'local', date_prod: '2026-07-06', quantite: 50, valide: true, fab_recettes: RECETTE },
      { site: 'local', date_prod: '2026-07-07', quantite: 999, valide: false, fab_recettes: RECETTE },   // pas validée → ne compte pas
      { site: 'local', date_prod: '2026-07-30', quantite: 10, valide: true, fab_recettes: RECETTE },    // APRÈS le comptage du 28/07 : compte dans « devrait rester », pas dans l'écart
    ];
    bilPertes = []; bilSorties = []; _lockedSite = null; bilSite = 'local';
    document.getElementById('bilD1').value = '2026-07-01';
    document.getElementById('bilD2').value = '2026-07-31';
    bilLoad();
  }, RECETTE);
  return page;
}

export const tests = [
  {
    name: 'Bilan BV — une carte par farine : Départ compté + Entrées (bons + reçu) − Sorties (prod + levain) = Devrait rester, Compté → écart',
    fn: async (ctx) => {
      const page = await ouvrirBilan(ctx);
      const r = await page.evaluate(() => {
        const card = (ing) => document.querySelector('.bcard[data-ing="' + ing + '"]');
        const cells = (ing) => [...card(ing).querySelectorAll('.bcell')].map((c) => ({ lbl: c.querySelector('.lbl').textContent, val: c.querySelector('.val').textContent, sub: c.querySelector('.sacs').textContent }));
        const t80 = card('ing_t80');
        return {
          nb: document.querySelectorAll('.bcard').length,
          seg: [...document.querySelectorAll('#bilSiteSeg button')].map((b) => b.textContent + (b.classList.contains('on') ? '*' : '')),
          t80: { cls: t80.className, pill: t80.querySelector('.bpill').textContent, cells: cells('ing_t80'), detail: t80.querySelector('.bdetail').innerHTML },
          bp: { cls: card('ing_bp').className, pill: card('ing_bp').querySelector('.bpill').textContent, cells: cells('ing_bp') },
          huile: { cls: card('ing_huile').className, pill: card('ing_huile').querySelector('.bpill').textContent, cells: cells('ing_huile') },
          total: document.querySelector('.btotal').textContent,
        };
      });
      assert(r.nb === 3, `3 cartes attendues (T80, Blés de pop, Huile), reçu ${r.nb}`);
      assert(r.seg.join(',') === 'Le Local*,Veigné,Tours', `chips de site avec Le Local actif, reçu ${r.seg.join(',')}`);
      // T80 : départ 50 (compté 30/06) ; entrées 125 + 100 + 25 reçu de Veigné = 250 ;
      // sorties = prod 100 + 50 + 10 = 160 kg de T80 direct + levain dur 64 kg → 64/1,6 = 40 kg de T80 → 200 ; devrait rester 100
      const c = r.t80.cells;
      assert(c[0].val === '50' && /compté le 30\/06/.test(c[0].sub), `Départ = 50 compté le 30/06, reçu ${c[0].val} / ${c[0].sub}`);
      assert(c[1].val === '250' && /2 bons \+ reçu de Veigné/.test(c[1].sub), `Entrées = 250 (2 bons + reçu de Veigné), reçu ${c[1].val} / ${c[1].sub}`);
      assert(c[2].val === '200' && /3 journées/.test(c[2].sub), `Sorties = 200 sur 3 journées, reçu ${c[2].val} / ${c[2].sub}`);
      assert(c[3].val === '100' && c[3].sub === '4 sacs', `Devrait rester = 100 = 4 sacs, reçu ${c[3].val} / ${c[3].sub}`);
      // comptage du 28/07 = 100 ; à cette date le théorique vaut 50 + 250 − (prod 05 + 06 = 150 + 37,5 de levain = 187,5) = 112,5 → écart −12,5 ≤ 1 sac → cohérent
      assert(c[4].lbl === 'Compté 28/07' && c[4].val === '100', `Compté 28/07 = 100, reçu ${c[4].lbl} / ${c[4].val}`);
      assert(/^\.?bcard ok/.test(r.t80.cls) || r.t80.cls === 'bcard ok', `T80 cohérente (vert), classe reçue « ${r.t80.cls} »`);
      assert(r.t80.pill === '-12,5 kg · cohérent', `pastille « -12,5 kg · cohérent », reçu « ${r.t80.pill} »`);
      assert(/GIR1/.test(r.t80.detail) && /lot L1/.test(r.t80.detail) && /GIR2/.test(r.t80.detail) && /lot non lu/.test(r.t80.detail), 'le détail liste les 2 bons avec lot (ou « lot non lu »)');
      assert(!/VIEUX/.test(r.t80.detail), 'le bon d\'avant le comptage de départ n\'apparaît pas');
      assert(/reçu de Veigné/.test(r.t80.detail) && /dont via le levain : 40 kg/.test(r.t80.detail), 'le détail montre le reçu de Veigné et la part du levain (40 kg)');
      // Blés de pop : rien reçu, 50 envoyés à Tours, pas de comptage → négatif = saisie manquante (rouge)
      assert(r.bp.cls === 'bcard bad' && r.bp.pill === 'négatif · saisie manquante', `Blés de pop en rouge « saisie manquante », reçu ${r.bp.cls} / ${r.bp.pill}`);
      assert(r.bp.cells[2].val === '50' && /50 envoyés/.test(r.bp.cells[2].sub) && r.bp.cells[3].val === '-50', `Sorties 50 envoyés, devrait rester −50, reçu ${JSON.stringify(r.bp.cells)}`);
      // Huile : rien ne bouge, pas de comptage sur la période → gris « pas compté », en litres
      assert(r.huile.cls === 'bcard none' && r.huile.pill === 'pas compté' && r.huile.cells[3].sub === 'L', `Huile « pas compté » en L, reçu ${r.huile.cls} / ${r.huile.pill} / ${r.huile.cells[3].sub}`);
      assert(/1 🟢/.test(r.total) && /1 🔴/.test(r.total) && /1 ⚪/.test(r.total), `bandeau total 1 🟢 1 🔴 1 ⚪, reçu « ${r.total} »`);
    },
  },
  {
    name: 'Bilan BV — touche = détail ouvert ; changer de site ; feuille A4 = tableau + bons à pointer + envois + signatures',
    fn: async (ctx) => {
      const page = await ouvrirBilan(ctx);
      await page.click('.bcard[data-ing="ing_t80"] .bhead');
      const r = await page.evaluate(() => {
        const t80 = document.querySelector('.bcard[data-ing="ing_t80"]');
        const ouvert = t80.classList.contains('open') && getComputedStyle(t80.querySelector('.bdetail')).display === 'grid';
        bilSetSite('tours');
        const tours = [...document.querySelectorAll('.bcard')].map((c) => c.dataset.ing + ':' + c.querySelector('.bpill').textContent);
        const html = bilExportHtml('local', '2026-07-01', '2026-07-31');
        return { ouvert, tours, html, sacs: [bilSacsTxt(100, 'ing_t80'), bilSacsTxt(117, 'ing_t80'), bilSacsTxt(17, 'ing_t80'), bilSacsTxt(0, 'ing_t80'), bilSacsTxt(10, 'ing_huile')] };
      });
      assert(r.ouvert, 'un toucher sur l\'en-tête ouvre le détail');
      assert(r.tours.join(',') === 'ing_bp:pas compté', `Tours : seuls les Blés de pop reçus (50), pas comptés — reçu ${r.tours.join(',')}`);
      assert(r.sacs.join('|') === '4 sacs|4 sacs + 17 kg|0 sac + 17 kg|0 sac|', `conversion en sacs, reçu ${r.sacs.join('|')}`);
      const h = r.html;
      assert(/LE LOCAL/.test(h) && /comptage physique du 28\/07\/2026/.test(h), 'en-tête A4 : site + date du comptage');
      assert(/<th>Compté<\/th><th>Écart<\/th>/.test(h) && /-12,5/.test(h), 'tableau A4 avec colonnes Compté et Écart');
      assert(/Bons de livraison de la période/.test(h) && /GIR1/.test(h) && /GIR2/.test(h) && !/VIEUX/.test(h), 'liste des bons de la période à pointer');
      assert(/Envois entre sites/.test(h) && /Veigné<\/td><td>Le Local/.test(h), 'liste des envois entre sites');
      assert(/Compté par/.test(h) && /Contrôleur/.test(h), 'cases de signature');
    },
  },
];
