/* ============================================================
   v20.289 — Connexion équipe (étape B de la sécurité, Phil 22/10/2026).
   Le code boutique ouvre une session Supabase (compte <boutique>@lbdd.app, mot de
   passe = le code). Deux modes :
   · « doux » (avant le verrou) : la clé publique marche encore, rien ne change pour
     un appareil qui ne tape pas de code ;
   · « verrou » (migration 289b) : la clé publique est refusée (permission denied),
     le code est toujours demandé, même aux marchés, et c'est la session qui ouvre la base.
   La page client pro.html passe par des fonctions qui ne répondent qu'au lien présenté.
   ============================================================ */
import { preparePage, gotoApp, assert } from '../helpers/harness.mjs';
import { makeDB, TENANT_ID } from '../helpers/fixtures.mjs';
const T = TENANT_ID;

function dbCodes() {
  const db = makeDB();
  db.boutique_codes = [
    { tenant_id: T, boutique_id: 'veigne', code: '1111' },
    { tenant_id: T, boutique_id: 'marche', code: '3333' },
    { tenant_id: T, boutique_id: 'master', code: '2412' },
    { tenant_id: T, boutique_id: 'backoffice', code: '2412' },
  ];
  return db;
}
const taper = async (page, code) => { for (const d of code) await page.evaluate((x) => codeKey(x), d); await page.evaluate(() => codeSubmit()); };
const session = (page) => page.evaluate(() => (window.__mockAuth.session || {}).user ? window.__mockAuth.session.user.email : null);

export const tests = [
  {
    name: 'Connexion — mode doux : le code Veigné ouvre la session veigne@lbdd.app ; l\'appareil s\'en souvient, pas de code la fois d\'après',
    fn: async (ctx) => {
      const page = await preparePage(ctx, { db: dbCodes() });
      await gotoApp(page);
      await page.evaluate(() => { enterBoutique('veigne'); });
      await page.waitForSelector('#code-overlay', { state: 'visible' });
      await taper(page, '9999');
      await page.waitForFunction(() => (document.getElementById('code-error') || {}).style && document.getElementById('code-error').style.display === 'block');
      const err = await page.evaluate(() => document.getElementById('code-error').textContent);
      assert(err === 'Code incorrect' && (await session(page)) === null, 'mauvais code : refusé, pas de session : ' + err);
      await taper(page, '1111');
      await page.waitForFunction(() => currentBoutique === 'veigne', null, { timeout: 5000 });
      assert((await session(page)) === 'veigne@lbdd.app', 'session ouverte avec le compte de la boutique');
      // retour accueil puis re-entrée : pas de code (souvenu + session)
      await page.evaluate(() => { goSplash(); });
      await page.evaluate(() => { enterBoutique('veigne'); });
      await page.waitForFunction(() => currentBoutique === 'veigne', null, { timeout: 5000 });
      const overlay = await page.evaluate(() => document.getElementById('code-overlay').classList.contains('show'));
      assert(!overlay, 'pas de code redemandé');
      // le code est mémorisé sur l'appareil ; session perdue → rouverte sans rien demander
      const stored = await page.evaluate(() => localStorage.getItem('boutiqueCode'));
      assert(stored === '1111', 'code mémorisé sur l\'appareil : ' + stored);
      await page.evaluate(() => { goSplash(); window.__mockAuth.session = null; enterBoutique('veigne'); });
      await page.waitForFunction(() => currentBoutique === 'veigne', null, { timeout: 5000 });
      assert((await session(page)) === 'veigne@lbdd.app', 'session rouverte en silence avec le code mémorisé');
      await page.close();
    },
  },
  {
    name: 'Connexion — verrou posé : la clé publique est refusée, le code est demandé même au marché (code « marche »), la bonne saisie ouvre la session et les données arrivent',
    fn: async (ctx) => {
      const page = await preparePage(ctx, { db: dbCodes(), strict: true });
      await page.goto('http://127.0.0.1:8787/index-cloud-test.html');
      await page.waitForSelector('#splash', { state: 'visible' });
      await page.waitForTimeout(300);
      const avant = await page.evaluate(() => ({ produits: products.length }));
      assert(avant.produits === 0, 'sans session, rien ne se charge (verrou) : ' + JSON.stringify(avant));
      await page.evaluate(() => { enterBoutique('amboise'); });
      await page.waitForSelector('#code-overlay', { state: 'visible' });
      const strict = await page.evaluate(() => authStrict);
      assert(strict, 'le verrou est détecté (authStrict)');
      await taper(page, '3333');
      await page.waitForFunction(() => currentBoutique === 'amboise', null, { timeout: 5000 });
      const apres = await page.evaluate(() => ({ produits: products.length, s: window.__mockAuth.session.user.email }));
      assert(apres.produits > 0 && apres.s === 'marche@lbdd.app', 'session marché ouverte, produits chargés : ' + JSON.stringify(apres));
      await page.close();
    },
  },
  {
    name: 'Connexion — verrou posé : le code maître ouvre une boutique sans code réglé ; le PIN BackOffice ouvre la session backoffice',
    fn: async (ctx) => {
      const page = await preparePage(ctx, { db: dbCodes(), strict: true });
      await page.goto('http://127.0.0.1:8787/index-cloud-test.html');
      await page.waitForSelector('#splash', { state: 'visible' });
      await page.evaluate(() => { enterBoutique('tours'); });   // pas de code « tours » réglé
      await page.waitForSelector('#code-overlay', { state: 'visible' });
      await taper(page, '2412');
      await page.waitForFunction(() => currentBoutique === 'tours', null, { timeout: 5000 });
      assert((await session(page)) === 'master@lbdd.app', 'code maître → session master');
      await page.evaluate(() => { goSplash(); window.__mockAuth.session = null; openBackOfficePin(); });
      for (const d of '2412') await page.evaluate((x) => pinKey(x), d);
      await page.waitForFunction(() => currentBoutique === 'backoffice', null, { timeout: 5000 });
      assert((await session(page)) === 'backoffice@lbdd.app', 'PIN → session backoffice');
      await page.close();
    },
  },
  {
    name: 'Connexion — verrou posé, appareil déjà connu (boutique + code mémorisés) : aucune question, la session s\'ouvre toute seule ; code changé en base → le code est redemandé',
    fn: async (ctx) => {
      const page = await preparePage(ctx, { db: dbCodes(), strict: true });
      await page.addInitScript(() => { try { localStorage.setItem('boutiqueUnlocked', 'veigne'); localStorage.setItem('boutiqueCode', '1111'); } catch (e) {} });
      await page.goto('http://127.0.0.1:8787/index-cloud-test.html');
      await page.waitForSelector('#splash', { state: 'visible' });
      await page.evaluate(() => { enterBoutique('veigne'); });
      await page.waitForFunction(() => currentBoutique === 'veigne', null, { timeout: 5000 });
      const r1 = await page.evaluate(() => ({ overlay: document.getElementById('code-overlay').classList.contains('show'), s: window.__mockAuth.session.user.email, produits: products.length }));
      assert(!r1.overlay && r1.s === 'veigne@lbdd.app' && r1.produits > 0, 'entrée directe, session ouverte : ' + JSON.stringify(r1));
      // Phil change le code de Veigné : l'ancien code mémorisé ne marche plus → la fenêtre de code revient
      await page.evaluate(() => { window.__mockDB.boutique_codes.find((c) => c.boutique_id === 'veigne').code = '5555'; window.__mockAuth.session = null; goSplash(); enterBoutique('veigne'); });
      await page.waitForSelector('#code-overlay', { state: 'visible' });
      await taper(page, '5555');
      await page.waitForFunction(() => currentBoutique === 'veigne', null, { timeout: 5000 });
      const stored = await page.evaluate(() => localStorage.getItem('boutiqueCode'));
      assert(stored === '5555' && (await session(page)) === 'veigne@lbdd.app', 'nouveau code mémorisé, session rouverte : ' + stored);
      await page.close();
    },
  },
  {
    name: 'Page client — verrou posé : pro.html marche sans session grâce aux fonctions ; un lien ne voit que ses commandes ; commande enregistrée ; lien inconnu refusé',
    fn: async (ctx) => {
      const db = dbCodes();
      const JOURS = {}; ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'].forEach((j) => { JOURS[j] = { actif: true, butoir_decalage: -1, butoir_heure: '23:59', livraison: '09:00' }; });
      db.pros = [
        { id: 'relais', tenant_id: T, nom: 'Relais', actif: true, boutique_principale: 'local', magic_token: 'tok_relais', contacts: [], jours_livraison: JOURS, catalogue_restreint: null },
        { id: 'autre', tenant_id: T, nom: 'Autre', actif: true, boutique_principale: 'local', magic_token: 'tok_autre', contacts: [], jours_livraison: JOURS, catalogue_restreint: null },
      ];
      db.pro_orders = [{ id: 'oa', tenant_id: T, pro_id: 'autre', date_livraison: '2026-07-23', boutique_source: 'local', statut: 'confirme', created_by: 'pro_self' }];
      db.pro_order_items = [{ id: 'ia', pro_order_id: 'oa', product_id: 'vt_trad', qty: 99 }];
      const page = await preparePage(ctx, { db, strict: true });
      await page.goto('http://127.0.0.1:8787/pro.html?t=tok_relais');
      await page.waitForFunction(() => document.querySelector('.hello'));
      const r = await page.evaluate(async () => {
        const secret = etabs.some((e) => 'magic_token' in e);
        const vus = orders.map((o) => o.pro_id);
        openOrder('2026-07-24'); setQty('relais', 'vt_trad', 12); await saveOrder();
        const mine = window.__mockDB.pro_orders.filter((o) => o.pro_id === 'relais').map((o) => o.date_livraison + ':' + o.boutique_source + ':' + window.__mockDB.pro_order_items.filter((i) => i.pro_order_id === o.id).map((i) => i.qty).join('+'));
        const autreIntact = window.__mockDB.pro_orders.find((o) => o.id === 'oa').statut;
        const n = await supa.rpc('pro_page_cancel', { p_token: 'tok_relais', p_ids: ['oa'], p_delete_items: false });
        return { secret, vus, mine, autreIntact, annuleAutre: n.data, statutAutre: window.__mockDB.pro_orders.find((o) => o.id === 'oa').statut, session: window.__mockAuth.session };
      });
      assert(!r.secret, 'le lien secret ne sort jamais de la base');
      assert(JSON.stringify(r.vus) === '[]', 'un lien ne voit pas les commandes des autres : ' + JSON.stringify(r.vus));
      assert(JSON.stringify(r.mine) === '["2026-07-24:local:12"]', 'commande enregistrée par la fonction : ' + JSON.stringify(r.mine));
      assert(r.annuleAutre === 0 && r.statutAutre === 'confirme', 'impossible d\'annuler la commande d\'un autre : ' + JSON.stringify({ n: r.annuleAutre, s: r.statutAutre }));
      assert(r.session === null, 'tout ça sans session (clé publique + fonctions)');
      await page.close();
      const p2 = await preparePage(ctx, { db, strict: true });
      await p2.goto('http://127.0.0.1:8787/pro.html?t=tok_inconnu');
      await p2.waitForSelector('.err');
      const txt = await p2.evaluate(() => document.querySelector('.err').textContent);
      assert(/Lien invalide/.test(txt), 'lien inconnu : ' + txt);
      await p2.close();
    },
  },
];
