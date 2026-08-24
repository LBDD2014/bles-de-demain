/* ============================================================
   v20.199 — Équipe & dotations (BackOffice)

   Suivre qui a reçu quoi, en quelle taille, à quelle date ; savoir ce qu'il
   reste en stock ; suivre arrivées, départs et restitutions.

   Règle des restitutions, calquée sur Reste / Perte côté boutique :
     « au stock » = réutilisable → remonte au stock
     « hors d'usage » = abîmé/perdu → sortie définitive
     rien = pas rendu → reste dû
   ============================================================ */
import { preparePage, gotoApp, enterBoutique, assert } from '../helpers/harness.mjs';
import { makeDB, TENANT_ID } from '../helpers/fixtures.mjs';

const T = TENANT_ID;

function dbEquipe() {
  const db = makeDB();
  db.staff = [
    { id: 'stf_a', tenant_id: T, nom: 'DOUCET Noé',   site: 'tours', date_sortie: null, sort_order: 10 },
    { id: 'stf_b', tenant_id: T, nom: 'BOBIN Fanny',  site: null,    date_sortie: null, sort_order: 20 },
    { id: 'stf_c', tenant_id: T, nom: 'PARTI Ancien', site: 'veigne', date_sortie: '2026-07-01', sort_order: 30 },
  ];
  db.staff_articles = [
    { id: 'sa_tshirt', tenant_id: T, nom: 'Tee-shirt', jeu_tailles: 'vetement',  quota_annuel: 5,    actif: true, sort_order: 10 },
    { id: 'sa_tablier', tenant_id: T, nom: 'Tablier',  jeu_tailles: 'tablier',   quota_annuel: null, actif: true, sort_order: 20 },
  ];
  db.staff_stock = [
    { tenant_id: T, article_id: 'sa_tshirt', taille: 'M', qty: 10, seuil: 8, last_reception: '2026-06-12' },
    { tenant_id: T, article_id: 'sa_tshirt', taille: 'L', qty: 2,  seuil: 8, last_reception: '2026-06-12' },
  ];
  db.staff_dotations = [
    { id: 1, tenant_id: T, staff_id: 'stf_a', article_id: 'sa_tshirt', taille: 'M', qty: 3, remis_le: '2026-07-02', rendu: null },
    { id: 2, tenant_id: T, staff_id: 'stf_c', article_id: 'sa_tshirt', taille: 'M', qty: 2, remis_le: '2026-05-04', rendu: null },
  ];
  return db;
}

async function ouvrirEquipe(ctx, db) {
  const page = await preparePage(ctx, { db: db || dbEquipe() });
  await gotoApp(page);
  await enterBoutique(page, 'backoffice');
  await page.evaluate(() => setVue('equipe'));
  await page.waitForSelector('.stf-table');
  return page;
}
const texte = (page, sel) => page.evaluate((s) => (document.querySelector(s) || {}).textContent || '', sel);

export const tests = [
  {
    name: 'Équipe — une colonne par article du catalogue',
    fn: async (ctx) => {
      const page = await ouvrirEquipe(ctx);
      const head = await page.evaluate(() =>
        Array.from(document.querySelectorAll('.stf-table thead th')).map((t) => t.textContent.trim()));
      assert(head.includes('Tee-shirt') && head.includes('Tablier'),
        `colonnes attendues Tee-shirt et Tablier — obtenu : ${head.join(' | ')}`);
      await page.close();
    },
  },
  {
    name: 'Équipe — un salarié sans site atterrit dans « À trier »',
    fn: async (ctx) => {
      const page = await ouvrirEquipe(ctx);
      const t = await texte(page, '#main-content');
      assert(t.includes('À trier'), 'le bac « À trier » doit exister');
      const trier = await page.evaluate(() =>
        Array.from(document.querySelectorAll('.stf-table tbody tr'))
          .filter((r) => r.textContent.includes('À trier')).length);
      assert(trier === 1, `1 salarié à trier attendu, obtenu ${trier}`);
      await page.close();
    },
  },
  {
    name: 'Équipe — un salarié parti sort de la liste mais n\'est pas supprimé',
    fn: async (ctx) => {
      const page = await ouvrirEquipe(ctx);
      let t = await texte(page, '.stf-table');
      assert(!t.includes('PARTI Ancien'), 'un parti ne doit pas apparaître par défaut');
      await page.evaluate(() => { staffShowAnciens = true; renderStaff(); });
      t = await texte(page, '.stf-table');
      assert(t.includes('PARTI Ancien'), '« Voir les anciens » doit le faire réapparaître');
      assert(t.includes('à rendre'), 'ce qu\'il n\'a pas rendu doit être signalé');
      await page.close();
    },
  },
  {
    name: 'Donner un article décrémente le stock',
    fn: async (ctx) => {
      const page = await ouvrirEquipe(ctx);
      await page.evaluate(() => stfOpenSheet('stf_b'));
      await page.waitForSelector('#stf-g-art');
      await page.selectOption('#stf-g-art', 'sa_tshirt');
      await page.selectOption('#stf-g-tai', 'M');
      await page.selectOption('#stf-g-qte', '4');
      await page.evaluate(() => staffDonner());
      await page.waitForFunction(() => staffDotations.length === 3, null, { timeout: 5000 });
      const q = await page.evaluate(() =>
        (staffStock.find((r) => r.article_id === 'sa_tshirt' && r.taille === 'M') || {}).qty);
      assert(Number(q) === 6, `stock M : 10 − 4 = 6 attendu, obtenu ${q}`);
      await page.close();
    },
  },
  {
    name: 'Le menu Taille suit l\'article choisi',
    fn: async (ctx) => {
      const page = await ouvrirEquipe(ctx);
      await page.evaluate(() => stfOpenSheet('stf_b'));
      await page.waitForSelector('#stf-g-art');
      await page.selectOption('#stf-g-art', 'sa_tablier');
      await page.evaluate(() => stfMajTailles('stf-g-art', 'stf-g-tai'));
      const t = await page.evaluate(() =>
        Array.from(document.getElementById('stf-g-tai').options).map((o) => o.value));
      assert(JSON.stringify(t) === JSON.stringify(['T1', 'T2', 'T3']),
        `tailles tablier attendues, obtenu ${JSON.stringify(t)}`);
      await page.close();
    },
  },
  {
    name: 'Rendu « au stock » : la pièce remonte au stock',
    fn: async (ctx) => {
      const page = await ouvrirEquipe(ctx);
      await page.evaluate(() => staffRendre('1', 'stock'));
      await page.waitForFunction(() => (staffDotations.find((d) => String(d.id) === '1') || {}).rendu === 'stock', null, { timeout: 5000 });
      const q = await page.evaluate(() =>
        (staffStock.find((r) => r.article_id === 'sa_tshirt' && r.taille === 'M') || {}).qty);
      assert(Number(q) === 13, `stock M : 10 + 3 = 13 attendu, obtenu ${q}`);
      await page.close();
    },
  },
  {
    name: 'Rendu « hors d\'usage » : soldé, mais le stock ne bouge PAS',
    fn: async (ctx) => {
      const page = await ouvrirEquipe(ctx);
      await page.evaluate(() => staffRendre('1', 'hs'));
      await page.waitForFunction(() => (staffDotations.find((d) => String(d.id) === '1') || {}).rendu === 'hs', null, { timeout: 5000 });
      const q = await page.evaluate(() =>
        (staffStock.find((r) => r.article_id === 'sa_tshirt' && r.taille === 'M') || {}).qty);
      assert(Number(q) === 10, `une pièce abîmée ne revient pas au stock : 10 attendu, obtenu ${q}`);
      const du = await page.evaluate(() => staffDu('stf_a'));
      assert(du === 0, `plus rien de dû après restitution, obtenu ${du}`);
      await page.close();
    },
  },
  {
    name: 'Le stock sous le seuil est signalé « à commander »',
    fn: async (ctx) => {
      const page = await ouvrirEquipe(ctx);
      await page.evaluate(() => stfSetView('stock'));
      await page.waitForSelector('.stf-table');
      const t = await texte(page, '#main-content');
      assert(t.includes('à commander'), 'le Tee-shirt L (2 pour un seuil de 8) doit être signalé');
      await page.close();
    },
  },
  {
    name: 'Ajouter un article ajoute une colonne à l\'Équipe',
    fn: async (ctx) => {
      const page = await ouvrirEquipe(ctx);
      await page.evaluate(() => {
        stfSetView('art'); stfToggleForm('art');
      });
      await page.waitForSelector('#stf-a-nom');
      await page.fill('#stf-a-nom', 'Chaussures');
      await page.selectOption('#stf-a-jeu', 'pointure');
      await page.evaluate(() => staffArtCreer());
      await page.waitForFunction(() => staffArticles.length === 3, null, { timeout: 5000 });
      await page.evaluate(() => stfSetView('eq'));
      const head = await page.evaluate(() =>
        Array.from(document.querySelectorAll('.stf-table thead th')).map((t) => t.textContent.trim()));
      assert(head.includes('Chaussures'), `colonne Chaussures attendue — obtenu : ${head.join(' | ')}`);
      await page.close();
    },
  },
  {
    name: 'Le quota annuel dépassé est signalé, jamais bloquant',
    fn: async (ctx) => {
      const db = dbEquipe();
      const an = new Date().getFullYear();
      db.staff_dotations.push({ id: 3, tenant_id: T, staff_id: 'stf_a', article_id: 'sa_tshirt',
        taille: 'M', qty: 4, remis_le: an + '-03-01', rendu: null });
      db.staff_dotations[0].remis_le = an + '-07-02';
      const page = await ouvrirEquipe(ctx, db);
      const t = await texte(page, '.stf-table');
      assert(t.includes('7/5'), `dépassement 7/5 attendu — obtenu : ${t.replace(/\s+/g, ' ').slice(0, 220)}`);
      await page.close();
    },
  },
];
