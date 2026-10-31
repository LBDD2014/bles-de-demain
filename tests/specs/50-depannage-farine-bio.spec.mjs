/* ============================================================
   v20.327 — Dépannages de farine reçus + alerte farine bio sous zéro (Prod. du jour)
   Contrôle Bureau Veritas de Tours, 22/10/2026 : 3 kg de farine bio entrés sans trace
   (un dépannage venu d'un autre site, jamais saisi). Désormais :
   · bandeau rouge si une farine bio passe sous zéro de plus de 10 kg depuis le dernier comptage
   · 📥 « J'ai reçu des sacs d'un autre site » : celui qui reçoit note les sacs (menus, pas de clavier)
   · doublon (même farine, même trajet, même jour) → confirmation ; 🗑 pour annuler une saisie
   Données du stock injectées directement dans les variables du bilan, comme le test 33.
   Date figée : mercredi 22/07/2026.
   ============================================================ */
import { preparePage, assert } from '../helpers/harness.mjs';
import { makeDB, TENANT_ID } from '../helpers/fixtures.mjs';

const RECETTE = { rendement_base: 1, fab_recette_lignes: [{ ingredient_id: 'ing_engrain', quantite: 1 }] };
const RECETTE_T80 = { rendement_base: 1, fab_recette_lignes: [{ ingredient_id: 'ing_t80', quantite: 1 }] };
const RECETTE_TRADI = { rendement_base: 1, fab_recette_lignes: [{ ingredient_id: 'ing_tradi', quantite: 1 }] };

async function ouvrirToursProd(ctx) {
  const db = makeDB();
  db.boutique_codes = [{ tenant_id: TENANT_ID, boutique_id: 'master', code: '9999' }];
  const page = await preparePage(ctx, { db });
  await page.setViewportSize({ width: 820, height: 1100 });
  await page.addInitScript(() => { try { localStorage.setItem('fabUnlockCode', '9999'); } catch (e) {} });
  await page.goto('http://127.0.0.1:8787/fabrication.html');
  await page.waitForFunction(() => typeof pdRenderBio === 'function' && typeof pdBioSave === 'function');
  await page.waitForTimeout(900);   // laisse finir le premier pdLoadDay (sinon son chargement écraserait nos données)
  await page.evaluate(({ RECETTE, RECETTE_T80, RECETTE_TRADI }) => {
    ingredients = [
      { id: 'ing_engrain', nom: 'Engrain', categorie: 'farine', bio: true, unite: 'kg' },
      { id: 'ing_t80', nom: 'T80 Bio Bise', categorie: 'farine', bio: true, unite: 'kg' },
      { id: 'ing_tradi', nom: 'Tradition', categorie: 'farine', bio: false, unite: 'kg' },
    ];
    _ingById = {}; ingredients.forEach((i) => { _ingById[i.id] = i; });
    bilLivr = []; bilPertes = []; bilSorties = [];
    bilInv = [
      { ingredient_id: 'ing_engrain', site: 'tours', date_inv: '2026-07-10', qte_reelle_kg: 25 },
      { ingredient_id: 'ing_t80', site: 'tours', date_inv: '2026-07-10', qte_reelle_kg: 20 },
    ];
    bilMouv = [];
    bilProd = [
      { site: 'tours', date_prod: '2026-07-15', quantite: 60, valide: true, fab_recettes: RECETTE },        // engrain : 25 − 60 = −35 → alerte
      { site: 'tours', date_prod: '2026-07-16', quantite: 99, valide: false, fab_recettes: RECETTE },       // pas validée → ne compte pas
      { site: 'tours', date_prod: '2026-07-15', quantite: 25, valide: true, fab_recettes: RECETTE_T80 },    // T80 : 20 − 25 = −5 → sous la tolérance
      { site: 'tours', date_prod: '2026-07-15', quantite: 500, valide: true, fab_recettes: RECETTE_TRADI }, // non bio : jamais d'alerte
      { site: 'veigne', date_prod: '2026-07-15', quantite: 80, valide: true, fab_recettes: RECETTE },       // autre site : pas affiché à Tours
    ];
    _bioRawAt = Date.now(); _lockedSite = null; fabSite = 'tours'; pdBioOpen = false;
    pdRenderBio();
  }, { RECETTE, RECETTE_T80, RECETTE_TRADI });
  return page;
}

export const tests = [
  {
    name: 'Dépannage bio — bandeau rouge : seule la farine bio à plus de 10 kg sous zéro, en sacs, depuis le comptage',
    fn: async (ctx) => {
      const page = await ouvrirToursProd(ctx);
      const r = await page.evaluate(() => ({
        alerte: (document.querySelector('#pdBio .bio-alerte') || {}).innerText || '',
        items: [...document.querySelectorAll('#pdBio .bio-alerte li')].map((li) => li.innerText),
        bouton: (document.querySelector('#pdBio .bio-recu button') || {}).innerText || '',
      }));
      assert(/il manque sans doute une entrée à Tours/.test(r.alerte), `bandeau rouge attendu pour Tours, reçu « ${r.alerte} »`);
      assert(r.items.length === 1, `une seule farine en alerte (Engrain), reçu ${JSON.stringify(r.items)}`);
      assert(r.items[0] === 'Engrain : il manque 1 sac + 10 kg (35 kg) depuis le comptage du 10/07', `ligne Engrain, reçu « ${r.items[0]} »`);
      assert(/J'ai reçu des sacs d'un autre site/.test(r.bouton), `bouton 📥 attendu, reçu « ${r.bouton} »`);
      // Veigné : 80 kg d'engrain consommés sans rien en stock → alerte chez Veigné, pas chez Tours
      const v = await page.evaluate(() => { fabSite = 'veigne'; pdRenderBio(); return [...document.querySelectorAll('#pdBio .bio-alerte li')].map((li) => li.innerText); });
      assert(v.length === 1 && /^Engrain : il manque 3 sacs \+ 5 kg \(80 kg\)$/.test(v[0]), `Veigné : engrain 80 kg sans comptage, reçu ${JSON.stringify(v)}`);
    },
  },
  {
    name: 'Dépannage bio — 📥 noter 1 sac + 10 kg venus du Local : ligne en base, bandeau éteint, liste des reçus',
    fn: async (ctx) => {
      const page = await ouvrirToursProd(ctx);
      await page.click('#pdBio .bio-recu button');
      const form = await page.evaluate(() => ({
        sacs: [...document.getElementById('pdbSacs').options].map((o) => o.text).slice(0, 3),
        sacDefaut: document.getElementById('pdbSacs').value,
        plus: document.getElementById('pdbPlus').options.length,
        from: [...document.getElementById('pdbFrom').options].map((o) => o.value + (o.selected ? '*' : '')),
        date: document.getElementById('pdbDate').value,
        ing: [...document.getElementById('pdbIng').options].map((o) => o.text),
      }));
      assert(form.sacs.join('|') === '0 sac|1 sac (25 kg)|2 sacs (50 kg)' && form.sacDefaut === '1', `menu des sacs, reçu ${JSON.stringify(form)}`);
      assert(form.plus === 25, `sac entamé : « — » + 1 à 24 kg, reçu ${form.plus} options`);
      assert(form.from.join(',') === 'local*,veigne', `venu de : Le Local par défaut, pas Tours, reçu ${form.from.join(',')}`);
      assert(form.date === '2026-07-22', `reçu le : aujourd'hui, reçu ${form.date}`);
      assert(form.ing[0] === 'Engrain (bio)' && form.ing.includes('Tradition (non bio)'), `farines bio d'abord, non bio aussi, reçu ${form.ing.join(',')}`);
      await page.selectOption('#pdbIng', 'ing_engrain');
      await page.selectOption('#pdbSacs', '1');
      await page.selectOption('#pdbPlus', '10');
      await page.click('text=✓ Noter les sacs reçus');
      await page.waitForTimeout(300);
      const r = await page.evaluate(() => ({
        log: (window.__mockLog || []).filter((l) => l.table === 'fab_mouvements'),
        alerte: !!document.querySelector('#pdBio .bio-alerte'),
        liste: (document.querySelector('#pdBio .liste') || {}).innerText || '',
        ouvert: !!document.getElementById('pdbIng'),
      }));
      assert(r.log.length === 1 && r.log[0].action === 'insert', `une insertion dans fab_mouvements, reçu ${JSON.stringify(r.log)}`);
      const row = r.log[0].rows[0];
      assert(row.ingredient_id === 'ing_engrain' && row.site_depart === 'local' && row.site_arrivee === 'tours' && row.date_mouvement === '2026-07-22' && row.quantite_kg === 35, `ligne enregistrée, reçu ${JSON.stringify(row)}`);
      assert(!r.alerte, 'le bandeau rouge disparaît : 25 + 35 − 60 = 0');
      assert(!r.ouvert, 'le formulaire se referme après l\'enregistrement');
      assert(/22\/07 — Engrain : 1 sac \+ 10 kg \(35 kg\), venu de Le Local/.test(r.liste), `liste des reçus, reçu « ${r.liste} »`);
      assert(page.__pageErrors.length === 0, `aucune erreur JS, reçu ${page.__pageErrors.join(' | ')}`);
    },
  },
  {
    name: 'Dépannage bio — doublon (même farine, même trajet, même jour) : confirmation ; 🗑 annule la saisie',
    fn: async (ctx) => {
      const page = await ouvrirToursProd(ctx);
      const r = await page.evaluate(async () => {
        bilMouv = [{ id: 'm1', ingredient_id: 'ing_engrain', site_depart: 'local', site_arrivee: 'tours', date_mouvement: '2026-07-22', quantite_kg: 25 }];
        const msgs = []; let rep = false;
        window.confirm = (m) => { msgs.push(m); return rep; };
        pdBioToggle(true);
        document.getElementById('pdbIng').value = 'ing_engrain'; pdBioQtyOpts();
        await pdBioSave();                                   // « Annuler » → rien n'est ajouté
        const apresRefus = (window.__mockLog || []).filter((l) => l.table === 'fab_mouvements').length;
        rep = true; await pdBioSave();                       // « OK » → un autre envoi, ajouté
        const apresOk = (window.__mockLog || []).filter((l) => l.table === 'fab_mouvements').length;
        await pdBioDel('m1');                                // 🗑 sur la première saisie
        const del = (window.__mockLog || []).filter((l) => l.table === 'fab_mouvements' && l.action === 'delete');
        return { msgs, apresRefus, apresOk, del, reste: bilMouv.map((m) => m.quantite_kg) };
      });
      assert(/Déjà noté : 25 kg de Engrain venus de Le Local le 22\/07/.test(r.msgs[0] || ''), `message de doublon, reçu « ${r.msgs[0]} »`);
      assert(r.apresRefus === 0, `refus du doublon : aucune insertion, reçu ${r.apresRefus}`);
      assert(r.apresOk === 1, `doublon confirmé : une insertion, reçu ${r.apresOk}`);
      assert(/Annuler cette saisie \?/.test(r.msgs[2] || ''), `confirmation avant 🗑, reçu ${JSON.stringify(r.msgs)}`);
      assert(r.del.length === 1 && JSON.stringify(r.del[0].filters).includes('m1'), `suppression de m1, reçu ${JSON.stringify(r.del)}`);
      assert(r.reste.join(',') === '25', `il reste la 2e saisie (1 sac), reçu ${r.reste.join(',')}`);
    },
  },
];
