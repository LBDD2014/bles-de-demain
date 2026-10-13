/* ============================================================
   v20.273 — Espace client pro : page dédiée pro.html (Phil, 13/10/2026, maquette validée).
   · accueil : bonjour, prochaine livraison, à venir, livrées récemment
   · commande : jours (ouvert / trop tard / déjà commandé), + et −, pré-rempli « la dernière fois »,
     UNE COLONNE PAR ÉTABLISSEMENT quand le client en a plusieurs (groupe) → une commande par fiche
   · les anciens liens ?pro_token= redirigent vers pro.html?t=
   Date figée : mercredi 22 juillet 2026, 10h. Base factice, rien vers Supabase.
   ============================================================ */
import { preparePage, assert } from '../helpers/harness.mjs';
import { makeDB, TENANT_ID } from '../helpers/fixtures.mjs';
const T = TENANT_ID;
const JOURS = { mardi: { actif: true, livraison: '09:30', butoir_decalage: -1, butoir_heure: '23:59' }, jeudi: { actif: true, livraison: '09:30', butoir_decalage: -1, butoir_heure: '23:59' }, samedi: { actif: true, livraison: '09:30', butoir_decalage: -2, butoir_heure: '18:00' } };

function dbDakota() {
  const db = makeDB();
  db.pros = [
    { id: 'dk_tours', tenant_id: T, nom: 'DAKOTA CAFE Tours', actif: true, boutique_principale: 'local', groupe: 'dakota', magic_token: 'tok_doline', contacts: [{ nom: 'Doline', tel: '0685096660', role: 'Patronne' }], jours_livraison: JOURS, catalogue_restreint: ['vt_trad', 'vp_croissant'], sources_par_categorie: {}, template_items: [] },
    { id: 'dk_chambray', tenant_id: T, nom: 'DAKOTA CAFE CHAMBRAY-LES-TOURS', actif: true, boutique_principale: 'local', groupe: 'dakota', magic_token: null, contacts: [], jours_livraison: JOURS, catalogue_restreint: ['vt_trad'], sources_par_categorie: {}, template_items: [] },
    { id: 'autre', tenant_id: T, nom: 'Autre client', actif: true, boutique_principale: 'tours', groupe: null, magic_token: 'tok_autre', contacts: [], jours_livraison: JOURS, catalogue_restreint: null },
  ];
  // jeudi 16/07 livrée : Tours 60 trad + 10 croissants ; Chambray 150 trad  → « la dernière fois »
  db.pro_orders = [
    { id: 'o1', tenant_id: T, pro_id: 'dk_tours', date_livraison: '2026-07-16', boutique_source: 'local', statut: 'livre', created_by: 'pro_self:Doline' },
    { id: 'o2', tenant_id: T, pro_id: 'dk_chambray', date_livraison: '2026-07-16', boutique_source: 'local', statut: 'livre', created_by: 'pro_self:Doline' },
    { id: 'o3', tenant_id: T, pro_id: 'dk_tours', date_livraison: '2026-07-23', boutique_source: 'local', statut: 'confirme', created_by: 'pro_self:Doline' },
  ];
  db.pro_order_items = [
    { id: 'i1', pro_order_id: 'o1', product_id: 'vt_trad', qty: 60 }, { id: 'i2', pro_order_id: 'o1', product_id: 'vp_croissant', qty: 10 },
    { id: 'i3', pro_order_id: 'o2', product_id: 'vt_trad', qty: 150 },
    { id: 'i4', pro_order_id: 'o3', product_id: 'vt_trad', qty: 40 },
  ];
  return db;
}
async function ouvrir(ctx, db, t) {
  const page = await preparePage(ctx, { db: db || dbDakota() });
  await page.goto('http://127.0.0.1:8787/pro.html?t=' + (t || 'tok_doline'));
  await page.waitForFunction(() => document.querySelectorAll('.ord, .err').length > 0 || document.querySelector('.hello'));
  await page.waitForTimeout(300);
  return page;
}

export const tests = [
  {
    name: 'Page pro — accueil : bonjour Doline, prochaine livraison jeudi 23, étiquette d\'établissement, livrées récemment, icône (manifest avec le lien)',
    fn: async (ctx) => {
      const page = await ouvrir(ctx);
      const r = await page.evaluate(() => ({
        hello: document.querySelector('.hello').textContent, next: document.querySelector('.next') ? document.querySelector('.next').textContent : '',
        rows: Array.from(document.querySelectorAll('.ord')).map((x) => x.textContent.replace(/\s+/g, ' ').trim()),
        etabs: Array.from(document.querySelectorAll('.ord .etab')).map((x) => x.textContent),
        manifest: (document.querySelector('link[rel=manifest]') || {}).href || '', title: document.querySelector('meta[name=apple-mobile-web-app-title]').content,
        tabs: document.querySelectorAll('#tabs button').length, url: location.search,
      }));
      assert(/Bonjour Doline/.test(r.hello), 'bonjour avec le prénom : ' + r.hello);
      assert(/jeudi 23 juillet · 9h30/.test(r.next) && /40 Tradition/.test(r.next) && /confirmée/.test(r.next) && /modifiable jusqu/.test(r.next), 'prochaine livraison : ' + r.next);
      assert(r.rows.length === 3 && /150 Tradition/.test(r.rows[1] + r.rows[2]), '1 à venir + 2 livrées (Tours et Chambray le 16) : ' + JSON.stringify(r.rows));
      assert(r.etabs.join(',') === 'Tours,Tours,Chambray-les-tours' || r.etabs.join(',') === 'Tours,Chambray-les-tours,Tours', 'étiquettes d\'établissement courtes : ' + r.etabs.join(','));
      assert(/^blob:/.test(r.manifest) && r.title === 'Les Blés' && r.tabs === 4, 'manifest dynamique + titre « Les Blés » + 4 onglets');
      assert(r.url === '?t=tok_doline', 'URL propre : ' + r.url);
      await page.close();
    },
  },
  {
    name: 'Page pro — commander : jours ouvert / trop tard / déjà commandé, deux colonnes Tours | Chambray pré-remplies, croissant grisé pour Chambray, valider = une commande par établissement',
    fn: async (ctx) => {
      const page = await ouvrir(ctx);
      await page.click('.cta');
      await page.waitForSelector('.prow');
      const r = await page.evaluate(() => {
        const dates = Array.from(document.querySelectorAll('.dt')).map((d) => d.querySelector('b').textContent + ':' + d.className.replace('dt', '').trim() + ':' + d.querySelector('em').textContent);
        const cols = Array.from(document.querySelectorAll('.cols .c span')).map((x) => x.textContent);
        const rows = Array.from(document.querySelectorAll('.prow')).map((p) => ({ nom: p.querySelector('.nm').firstChild.textContent, last: p.querySelector('.nm small').textContent, q: Array.from(p.querySelectorAll('.step')).map((s) => s.querySelector('input').value + (s.classList.contains('off') ? '(off)' : '')) }));
        return { dates, cols, rows, tot: document.getElementById('tot').textContent, hint: document.querySelector('.hint').textContent };
      });
      // jeudi 23 = trop tard (butoir mer 22 23:59 pas passé → ouvert ? non : 22/07 10h < 23:59 → OUVERT mais « déjà commandé ») ; samedi 25 : butoir jeu 23 18h → ouvert ; mardi 28 ouvert
      assert(r.dates.some((d) => /^23:.*has.*déjà commandé/.test(d)), 'jeudi 23 = déjà commandé : ' + JSON.stringify(r.dates));
      assert(r.dates.some((d) => /^25:.*open/.test(d)) && r.dates.some((d) => /^28:.*open/.test(d)), 'samedi 25 et mardi 28 ouverts : ' + JSON.stringify(r.dates));
      assert(r.dates.some((d) => /^25:.*on.*jusqu/.test(d)), 'le 1er jour ouvert est sélectionné avec son heure limite : ' + JSON.stringify(r.dates));
      assert(r.cols.join('|') === 'Tours|Chambray-les-tours', 'deux colonnes : ' + r.cols.join('|'));
      const trad = r.rows.find((x) => x.nom === 'Tradition'), cro = r.rows.find((x) => x.nom === 'Croissant');
      assert(trad && trad.q.join(',') === '60,150' && /Tours 60 · Chambray-les-tours 150/.test(trad.last), 'Tradition pré-remplie 60 | 150 avec « la dernière fois » : ' + JSON.stringify(trad));
      assert(cro && cro.q[0] === '10' && /off/.test(cro.q[1]), 'Croissant : 10 pour Tours, grisé pour Chambray (pas au catalogue) : ' + JSON.stringify(cro));
      assert(/220 pièces/.test(r.tot), 'total 220 pièces : ' + r.tot);
      assert(/samedi 25 juillet/.test(r.hint) && /9h30/.test(r.hint) && /demain 18h\./.test(r.hint), 'rappel livraison + heure limite : ' + r.hint);
      // + sur Tradition Tours, − sur Chambray, puis valider
      await page.evaluate(() => { bump('dk_tours', 'vt_trad', 1); bump('dk_chambray', 'vt_trad', -1); bump('dk_chambray', 'vt_trad', -1); document.querySelector('.note').value = 'merci'; draft.notes = 'merci'; });
      await page.click('.cta');
      await page.waitForSelector('.okbox');
      const s = await page.evaluate(() => {
        const o = window.__mockDB.pro_orders.filter((x) => x.date_livraison === '2026-07-25');
        const items = (id) => window.__mockDB.pro_order_items.filter((i) => i.pro_order_id === id).map((i) => i.product_id + ':' + i.qty).join(',');
        return { ok: document.querySelector('.okbox').textContent, orders: o.map((x) => ({ pro: x.pro_id, src: x.boutique_source, st: x.statut, by: x.created_by, notes: x.notes, items: items(x.id) })), cards: document.querySelectorAll('.okbox ~ .card').length };
      });
      assert(/C'est noté, merci Doline/.test(s.ok) && /samedi 25 juillet vers 9h30 par Le Local/.test(s.ok), 'écran de confirmation : ' + s.ok);
      assert(s.orders.length === 2, 'une commande par établissement : ' + JSON.stringify(s.orders));
      const ot = s.orders.find((x) => x.pro === 'dk_tours'), oc = s.orders.find((x) => x.pro === 'dk_chambray');
      assert(ot && ot.items === 'vt_trad:61,vp_croissant:10' && ot.src === 'local' && ot.st === 'confirme' && ot.by === 'pro_self:Doline' && ot.notes === 'merci', 'Tours : 61 trad + 10 croissants, Local, confirmée, par Doline : ' + JSON.stringify(ot));
      assert(oc && oc.items === 'vt_trad:148', 'Chambray : 148 trad : ' + JSON.stringify(oc));
      assert(s.cards === 2, 'récap en 2 cartes (une par établissement)');
      await page.close();
    },
  },
  {
    name: 'Page pro — modifier une commande existante (cumul remplacé, pas doublé), annuler ; client à un seul établissement = pas de colonnes ; lien invalide ; ancien lien redirigé',
    fn: async (ctx) => {
      const page = await ouvrir(ctx);
      // ouvrir le détail de jeudi 23 (Tours, 40 trad) → modifier → 45 → valider
      await page.evaluate(() => openDetail('dk_tours|2026-07-23'));
      await page.waitForSelector('.dtl');
      const d1 = await page.evaluate(() => document.querySelector('.dtl').textContent + '|' + document.querySelectorAll('.btn2').length);
      assert(/Tradition40/.test(d1.replace(/\s/g, '')) && /\|2$/.test(d1), 'détail avec Modifier + Annuler : ' + d1);
      await page.evaluate(() => openOrder('2026-07-23'));
      await page.waitForSelector('.prow');
      const pre = await page.evaluate(() => ({ t: document.getElementById('q_dk_tours_vt_trad').value, c: document.getElementById('q_dk_chambray_vt_trad').value, lbl: document.querySelector('#hdr .t').textContent }));
      assert(pre.t === '40' && pre.c === '0' && pre.lbl === 'Modifier ma commande', 'édition pré-remplie avec la commande actuelle (40), Chambray vide : ' + JSON.stringify(pre));
      await page.evaluate(async () => { setQty('dk_tours', 'vt_trad', 45); await saveOrder(); });
      await page.waitForSelector('.okbox');
      const m = await page.evaluate(() => window.__mockDB.pro_orders.filter((x) => x.date_livraison === '2026-07-23' && x.statut !== 'annule').map((x) => x.pro_id + ':' + window.__mockDB.pro_order_items.filter((i) => i.pro_order_id === x.id).map((i) => i.qty).join('+')));
      assert(m.join(',') === 'dk_tours:45', 'commande modifiée, pas doublée : ' + m.join(','));
      await page.evaluate(() => cancelOrder('2026-07-23', 'dk_tours'));
      await page.waitForTimeout(300);
      const c = await page.evaluate(() => window.__mockDB.pro_orders.find((x) => x.id === 'o3').statut + '|' + document.querySelectorAll('.ord').length);
      assert(c === 'annule|2', 'annulée, plus que les 2 livrées à l\'accueil : ' + c);
      await page.close();
      // client simple : pas de colonnes, pas d'étiquette
      const p2 = await ouvrir(ctx, null, 'tok_autre');
      await p2.click('.cta'); await p2.waitForSelector('.prow');
      const s2 = await p2.evaluate(() => ({ cols: document.querySelectorAll('.cols').length, steps: document.querySelector('.prow .steps').children.length, hello: document.querySelector('#hdr .s').textContent }));
      assert(s2.cols === 0 && s2.steps === 1 && /Autre client/.test(s2.hello), 'un établissement = une seule colonne : ' + JSON.stringify(s2));
      await p2.close();
      // lien invalide
      const p3 = await ouvrir(ctx, null, 'nimporte');
      const e3 = await p3.evaluate(() => (document.querySelector('.err') || {}).textContent || '');
      assert(/Lien invalide/.test(e3), 'lien invalide : ' + e3);
      await p3.close();
      // ancien lien → redirection
      const p4 = await preparePage(ctx, { db: dbDakota() });
      await p4.goto('http://127.0.0.1:8787/index-cloud-test.html?pro_token=tok_doline');
      await p4.waitForFunction(() => location.pathname.endsWith('/pro.html'));
      const u4 = await p4.evaluate(() => location.pathname + location.search);
      assert(u4 === '/pro.html?t=tok_doline', 'redirigé vers la page dédiée : ' + u4);
      await p4.close();
    },
  },
];
