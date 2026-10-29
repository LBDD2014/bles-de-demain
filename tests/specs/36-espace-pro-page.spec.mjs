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
        const cols = Array.from(document.querySelector('.prow .steps').querySelectorAll('.stp small b')).map((x) => x.textContent);
        const rows = Array.from(document.querySelectorAll('.prow')).map((p) => ({ nom: p.querySelector('.nm').firstChild.textContent, last: Array.from(p.querySelectorAll('.stp small')).map((x) => x.textContent).join(' | '), q: Array.from(p.querySelectorAll('.step')).map((s) => s.querySelector('input').value + (s.classList.contains('off') ? '(off)' : '')) }));
        return { dates, cols, rows, tot: document.getElementById('tot').textContent, hint: document.querySelector('.hint').textContent };
      });
      // jeudi 23 = trop tard (butoir mer 22 23:59 pas passé → ouvert ? non : 22/07 10h < 23:59 → OUVERT mais « déjà commandé ») ; samedi 25 : butoir jeu 23 18h → ouvert ; mardi 28 ouvert
      assert(r.dates.some((d) => /^23:.*has.*déjà commandé/.test(d)), 'jeudi 23 = déjà commandé : ' + JSON.stringify(r.dates));
      assert(r.dates.some((d) => /^25:.*open/.test(d)) && r.dates.some((d) => /^28:.*open/.test(d)), 'samedi 25 et mardi 28 ouverts : ' + JSON.stringify(r.dates));
      assert(r.dates.some((d) => /^25:.*on.*jusqu/.test(d)), 'le 1er jour ouvert est sélectionné avec son heure limite : ' + JSON.stringify(r.dates));
      assert(r.cols.join('|') === 'Tours|Chambray-les-tours', 'deux colonnes : ' + r.cols.join('|'));
      const trad = r.rows.find((x) => x.nom === 'Tradition'), cro = r.rows.find((x) => x.nom === 'Croissant');
      // v20.302 — « la dernière fois » = la commande la plus proche AVANT le jour choisi (samedi 25) : jeudi 23 pour Tours (40, pas encore livrée), le 16 pour Chambray (150)
      assert(trad && trad.q.join(',') === '40,150' && /Tours · dernière fois 40 \| Chambray-les-tours · dernière fois 150/.test(trad.last), 'Tradition pré-remplie 40 | 150 avec « la dernière fois » : ' + JSON.stringify(trad));
      assert(cro && cro.q[0] === '0' && /off/.test(cro.q[1]), 'Croissant : 0 pour Tours (pas dans la commande du 23), grisé pour Chambray (pas au catalogue) : ' + JSON.stringify(cro));
      assert(/190 pièces/.test(r.tot), 'total 190 pièces : ' + r.tot);
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
      assert(ot && ot.items === 'vt_trad:41' && ot.src === 'local' && ot.st === 'confirme' && ot.by === 'pro_self:Doline' && ot.notes === 'merci', 'Tours : 41 trad, Local, confirmée, par Doline : ' + JSON.stringify(ot));
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
      assert(/Tradition40/.test(d1.replace(/\s/g, '')) && /\|3$/.test(d1), 'détail avec Modifier + Annuler + Refaire (v20.302) : ' + d1);
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
      const s2 = await p2.evaluate(() => ({ cols: document.querySelectorAll('.stp').length, steps: document.querySelector('.prow .steps').children.length, hello: document.querySelector('#hdr .s').textContent }));
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
  {
    name: 'Page pro — v20.302 : « 📑 Refaire » (ligne + détail) reprend une commande pour le prochain jour libre ; nouveau pro sans aucune commande = « rien à pré-remplir » ; première semaine = pré-rempli avec la commande la plus proche avant le jour',
    fn: async (ctx) => {
      // 1. Dakota : refaire la commande livrée du 16 (Tours 60 trad + 10 croissants) → samedi 25 (jeudi 23 déjà commandé), Chambray garde son pré-remplissage
      let page = await ouvrir(ctx);
      const r1 = await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('.ord'));
        const nbRedo = rows.filter((x) => x.querySelector('.redo')).length;
        const row16 = rows.find((x) => x.textContent.indexOf('16') !== -1 && x.textContent.indexOf('60 Tradition') !== -1);
        row16.querySelector('.redo').click();
        const q = (e, p) => document.getElementById('q_' + e + '_' + p).value;
        return { nbRedo, nbRows: rows.length, date: draft.date, editing: draft.editing, lbl: document.querySelector('.sec .n').textContent, tours: q('dk_tours', 'vt_trad') + '/' + q('dk_tours', 'vp_croissant'), chambray: q('dk_chambray', 'vt_trad'), tot: document.getElementById('tot').textContent, toast: document.getElementById('toast').textContent, on: document.querySelector('.dt.on b').textContent };
      });
      assert(r1.nbRedo === r1.nbRows && r1.nbRows === 3, 'un bouton 📑 sur chaque ligne (à venir + livrées) : ' + r1.nbRedo + ' / ' + r1.nbRows);
      assert(r1.date === '2026-07-25' && !r1.editing && r1.on === '25', 'ouvre le prochain jour libre (samedi 25, le 23 étant déjà commandé) : ' + JSON.stringify(r1));
      assert(r1.tours === '60/10' && r1.chambray === '150' && /220 pièces/.test(r1.tot), 'Tours = la commande reprise (60 + 10), Chambray garde « la dernière fois » (150) : ' + JSON.stringify(r1));
      assert(/reprise de la commande du jeudi 16/.test(r1.lbl) && /Commande du jeudi 16 reprise pour samedi 25/.test(r1.toast), 'étiquette + toast : ' + r1.lbl + ' / ' + r1.toast);
      // bouton dans le détail aussi
      const r2 = await page.evaluate(() => { openDetail('dk_tours|2026-07-23'); const b = document.querySelector('.redo-big'); const t = b ? b.textContent : ''; b.click(); return { t, date: draft.date, tours: document.getElementById('q_dk_tours_vt_trad').value }; });
      assert(/Refaire cette commande pour samedi 25/.test(r2.t) && r2.date === '2026-07-25' && r2.tours === '40', 'détail : « 📑 Refaire cette commande pour samedi 25 » → 40 trad : ' + JSON.stringify(r2));
      await page.close();
      // 2. nouveau pro : commandes posées pour jeu 23, ven 24, sam 25, mar 28 (par l'équipe), rien de livré → mer 29 pré-rempli avec mardi 28 (le plus proche avant)
      const J = { actif: true, livraison: '09:30', butoir_decalage: -1, butoir_heure: '23:59' };
      const db = makeDB();
      db.pros = [{ id: 'bio', tenant_id: T, nom: 'Épicerie Bio', actif: true, boutique_principale: 'local', magic_token: 'tok_bio', contacts: [{ nom: 'Léa', tel: '0600000000' }], jours_livraison: { mardi: J, mercredi: J, jeudi: J, vendredi: J, samedi: J }, catalogue_restreint: null, sources_par_categorie: {}, template_items: [] }];
      db.pro_orders = [['2026-07-23', 10], ['2026-07-24', 12], ['2026-07-25', 14], ['2026-07-28', 16]].map((d, i) => ({ id: 'o' + i, tenant_id: T, pro_id: 'bio', date_livraison: d[0], boutique_source: 'local', statut: 'confirme', created_by: 'local' }));
      db.pro_order_items = db.pro_orders.map((o, i) => ({ id: 'i' + i, pro_order_id: o.id, product_id: 'vt_trad', qty: [10, 12, 14, 16][i] }));
      page = await ouvrir(ctx, db, 'tok_bio');
      await page.click('.cta');
      await page.waitForSelector('.prow');
      const r3 = await page.evaluate(() => ({ date: draft.date, lbl: document.querySelector('.sec .n').textContent, trad: document.getElementById('q_bio_vt_trad').value, small: document.getElementById('q_bio_vt_trad').closest('.prow').querySelector('.nm small').textContent }));
      assert(r3.date === '2026-07-29' && r3.trad === '16' && /la dernière fois : 16/.test(r3.small) && r3.lbl === 'pré-rempli avec la dernière fois', 'mercredi 29 pré-rempli avec mardi 28 (16), pas encore livrée : ' + JSON.stringify(r3));
      await page.close();
      // 3. pro tout neuf, aucune commande, pas de commande de base → 0 et « rien à pré-remplir », pas de bouton 📑
      db.pro_orders = []; db.pro_order_items = [];
      page = await ouvrir(ctx, db, 'tok_bio');
      await page.click('.cta');
      await page.waitForSelector('.prow');
      const r4 = await page.evaluate(() => ({ lbl: document.querySelector('.sec .n').textContent, trad: document.getElementById('q_bio_vt_trad').value, redo: document.querySelectorAll('.redo').length }));
      assert(r4.lbl === 'première commande : rien à pré-remplir' && r4.trad === '0' && r4.redo === 0, 'pro neuf : étiquette honnête, 0, pas de 📑 : ' + JSON.stringify(r4));
      await page.close();
    },
  },
];
