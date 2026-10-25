/* ============================================================
   v20.290 — Deux créneaux par jour pour un pro (matin + après-midi).

   Cas réel (Phil, 25/10/2026) : Le Strapontin et Le Châteauneuf, restos de Tours
   qui viennent chercher, commandent pour le matin ET pour l'après-midi du même
   jour. Avant : une commande = un pro + une date, la page client disait « déjà
   commandé » dès la première.
   Règle : fiche pro `creneau_aprem` { actif, butoir_decalage, butoir_heure, livraison }
   → l'après-midi reprend les jours cochés avec sa propre heure limite ;
   chaque commande porte `creneau` ('matin' par défaut / 'apres_midi').
   Date figée : mercredi 22 juillet 2026, 10h00 → le matin du 22 est clôturé
   (veille 23h59), l'après-midi du 22 est encore ouvert (jour même 11h).
   ============================================================ */
import { preparePage, gotoApp, enterBoutique, assert } from '../helpers/harness.mjs';
import { makeDB, TENANT_ID } from '../helpers/fixtures.mjs';

const T = TENANT_ID;
const JOURS = {};
['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'].forEach((j) => { JOURS[j] = { actif: true, butoir_decalage: -1, butoir_heure: '23:59', livraison: '08:00', tournee: 'retrait' }; });
const APREM = { actif: true, butoir_decalage: 0, butoir_heure: '11:00', livraison: '15:00' };
const AUJ = '2026-07-22', DEMAIN = '2026-07-23';

function dbStrapontin() {
  const db = makeDB();
  db.pros = [
    { id: 'le_strapontin', tenant_id: T, nom: 'Le Strapontin', actif: true, boutique_principale: 'tours', boutique_secours: null,
      magic_token: 'tok_strap', contacts: [], jours_livraison: JOURS, creneau_aprem: APREM,
      catalogue_restreint: ['vt_trad'], prix_speciaux: {}, template_items: [], sources_par_categorie: {} },
    // un pro classique (un seul créneau) : rien ne change pour lui
    { id: 'clapotis', tenant_id: T, nom: 'Le Clapotis', actif: true, boutique_principale: 'tours', boutique_secours: null,
      magic_token: 'tok_clap', contacts: [], jours_livraison: JOURS, creneau_aprem: null,
      catalogue_restreint: ['vt_trad'], prix_speciaux: {}, template_items: [], sources_par_categorie: {} },
  ];
  // hier (mardi 21) : 50 traditions le matin, 7 l'après-midi → « la dernière fois » par créneau
  db.pro_orders = [
    { id: 'p_m', tenant_id: T, pro_id: 'le_strapontin', date_livraison: '2026-07-21', boutique_source: 'tours', statut: 'livre', creneau: 'matin', created_by: 'tours' },
    { id: 'p_a', tenant_id: T, pro_id: 'le_strapontin', date_livraison: '2026-07-21', boutique_source: 'tours', statut: 'livre', creneau: 'apres_midi', created_by: 'tours' },
  ];
  db.pro_order_items = [{ id: 'pi_m', pro_order_id: 'p_m', product_id: 'vt_trad', qty: 50 }, { id: 'pi_a', pro_order_id: 'p_a', product_id: 'vt_trad', qty: 7 }];
  db.fab_jours_off = [];
  return db;
}
async function ouvrirPage(ctx, t) {
  const page = await preparePage(ctx, { db: dbStrapontin() });
  await page.goto('http://127.0.0.1:8787/pro.html?t=' + (t || 'tok_strap'));
  await page.waitForFunction(() => document.querySelectorAll('.ord, .err').length > 0 || document.querySelector('.hello'));
  await page.waitForTimeout(200);
  return page;
}
// commandes vivantes d'un pro : « date|créneau|source:produit=qty »
const LIRE = (proId) => window.__mockDB.pro_orders.filter((o) => o.pro_id === proId && o.statut !== 'annule')
  .map((o) => o.date_livraison + '|' + (o.creneau || 'matin') + '|' + o.boutique_source + ':' + window.__mockDB.pro_order_items.filter((i) => i.pro_order_id === o.id).map((i) => i.product_id + '=' + i.qty).sort().join('+')).sort();

export const tests = [
  {
    name: 'Page client — Strapontin : aujourd\'hui le matin est clôturé mais l\'après-midi reste ouvert jusqu\'à 11h ; valider = commande apres_midi ; demain matin ET après-midi = deux commandes indépendantes, le jour passe « déjà commandé » seulement quand les deux sont pris',
    fn: async (ctx) => {
      const page = await ouvrirPage(ctx);
      await page.click('.cta');
      await page.waitForSelector('.prow');
      const r1 = await page.evaluate(() => ({
        dates: Array.from(document.querySelectorAll('.dt')).map((d) => d.querySelector('b').textContent + ':' + d.className.replace('dt', '').trim() + ':' + d.querySelector('em').textContent),
        crens: Array.from(document.querySelectorAll('.cren')).map((c) => c.className.replace('cren', '').trim() + ':' + c.querySelector('b').textContent.replace(/\s+/g, ' ').trim() + ':' + c.querySelector('em').textContent),
        hint: document.querySelector('.hint').textContent, cta: document.querySelector('.cta').textContent, draft: draft.creneau, q: document.getElementById('q_le_strapontin_vt_trad').value,
      }));
      assert(r1.dates.some((d) => /^22:.*open.*on/.test(d)), 'le 22 est ouvert (après-midi libre) et sélectionné : ' + JSON.stringify(r1.dates));
      assert(r1.crens.length === 2 && /^late:🌅 Matin.*:trop tard$/.test(r1.crens[0]), 'matin du 22 = trop tard : ' + JSON.stringify(r1.crens));
      assert(/^open on:🌇 Après-midi vers 15h:jusqu'à aujourd'hui 11h$/.test(r1.crens[1]), 'après-midi du 22 = ouvert jusqu\'à 11h, retrait vers 15h : ' + JSON.stringify(r1.crens));
      assert(r1.q === '7', 'pré-rempli avec le dernier après-midi (7), pas le dernier matin (50) : ' + r1.q);
      assert(r1.draft === 'apres_midi' && /après-midi/.test(r1.hint) && /vers 15h/.test(r1.hint) && /après-midi/.test(r1.cta), 'brouillon sur l\'après-midi, texte et bouton le disent : ' + r1.hint + ' / ' + r1.cta);

      // 1. valider 10 traditions pour cet après-midi
      await page.evaluate(async () => { setQty('le_strapontin', 'vt_trad', 10); await saveOrder(); });
      await page.waitForSelector('.okbox');
      const VIVANTES = (rows) => rows.filter((x) => !/^2026-07-21/.test(x));
      let rows = VIVANTES(await page.evaluate(LIRE, 'le_strapontin'));
      assert(JSON.stringify(rows) === '["2026-07-22|apres_midi|tours:vt_trad=10"]', 'commande de l\'après-midi enregistrée avec son créneau : ' + JSON.stringify(rows));
      const ok = await page.evaluate(() => document.querySelector('.okbox').textContent + '|' + document.querySelector('#hdr .t').textContent);
      assert(/après-midi/.test(ok) && /vers 15h/.test(ok), 'confirmation : après-midi, retrait vers 15h : ' + ok);

      // 2. demain matin : pré-rempli avec « la dernière fois » du MÊME créneau (50 le matin), puis 20 traditions
      await page.evaluate(() => openOrder('2026-07-23'));
      await page.waitForSelector('.prow');
      const r2 = await page.evaluate(() => ({ draft: draft.creneau, q: document.getElementById('q_le_strapontin_vt_trad').value,
        crens: Array.from(document.querySelectorAll('.cren')).map((c) => c.className.replace('cren', '').trim() + ':' + c.querySelector('em').textContent) }));
      assert(r2.draft === 'matin' && r2.q === '50' && /^open on:jusqu'à ce soir 23h59$/.test(r2.crens[0]) && /^open:jusqu'à demain 11h$/.test(r2.crens[1]), 'demain : matin proposé d\'office (pré-rempli 50), les deux ouverts : ' + JSON.stringify(r2));
      await page.evaluate(async () => { setQty('le_strapontin', 'vt_trad', 20); await saveOrder(); });
      await page.waitForSelector('.okbox');
      // puis demain après-midi : « la dernière fois » = le dernier après-midi passé (7), pas le matin
      await page.evaluate(() => openOrder('2026-07-23', 'apres_midi'));
      await page.waitForSelector('.prow');
      const r3 = await page.evaluate(() => ({ q: document.getElementById('q_le_strapontin_vt_trad').value, editing: draft.editing,
        crens: Array.from(document.querySelectorAll('.cren')).map((c) => c.className.replace('cren', '').trim() + ':' + c.querySelector('em').textContent) }));
      assert(r3.q === '7' && r3.editing === false && /^has:déjà commandé$/.test(r3.crens[0]) && /^open on:/.test(r3.crens[1]), 'demain après-midi : pré-rempli avec le dernier après-midi (7), matin marqué déjà commandé : ' + JSON.stringify(r3));
      await page.evaluate(async () => { setQty('le_strapontin', 'vt_trad', 15); await saveOrder(); });
      await page.waitForSelector('.okbox');
      rows = VIVANTES(await page.evaluate(LIRE, 'le_strapontin'));
      assert(JSON.stringify(rows) === '["2026-07-22|apres_midi|tours:vt_trad=10","2026-07-23|apres_midi|tours:vt_trad=15","2026-07-23|matin|tours:vt_trad=20"]', 'trois commandes, deux pour demain : ' + JSON.stringify(rows));

      // 3. accueil : 3 à venir + 2 livrées hier, chacune avec l'étiquette de son créneau ; le 22 et le 23 n'ont plus rien de libre
      await page.evaluate(() => go('home'));
      await page.waitForSelector('.ord');
      const r4 = await page.evaluate(() => ({ rows: Array.from(document.querySelectorAll('.ord')).map((x) => x.textContent.replace(/\s+/g, ' ').trim()), tags: document.querySelectorAll('.ord .cr').length, next: document.querySelector('.next').textContent.replace(/\s+/g, ' ') }));
      assert(r4.rows.length === 5 && r4.tags === 5 && r4.rows.filter((x) => /Après-midi/.test(x)).length === 3 && r4.rows.filter((x) => /Matin/.test(x)).length === 2, 'accueil : 5 commandes étiquetées : ' + JSON.stringify(r4));
      assert(/Après-midi/.test(r4.next) && /15h/.test(r4.next) && /10 Tradition/.test(r4.next), 'prochaine livraison = cet après-midi vers 15h : ' + r4.next);
      await page.evaluate(() => go('order'));
      await page.waitForSelector('.dt');
      const r5 = await page.evaluate(() => Array.from(document.querySelectorAll('.dt')).map((d) => d.querySelector('b').textContent + ':' + d.querySelector('em').textContent));
      assert(r5.some((d) => d === '23:déjà commandé') && r5.some((d) => d === '22:déjà commandé') && r5.some((d) => /^24:(ouvert|jusqu)/.test(d)), 'le 22 (matin clôturé, après-midi pris) et le 23 (les deux pris) sont complets, le 24 ouvert : ' + JSON.stringify(r5));

      // 4. modifier l'après-midi de demain ne touche pas le matin ; annuler le matin ne touche pas l'après-midi
      await page.evaluate(async () => { openOrder('2026-07-23', 'apres_midi'); setQty('le_strapontin', 'vt_trad', 12); await saveOrder(); });
      await page.evaluate(async () => { await cancelOrder('2026-07-23', 'le_strapontin', 'matin'); });
      rows = VIVANTES(await page.evaluate(LIRE, 'le_strapontin'));
      assert(JSON.stringify(rows) === '["2026-07-22|apres_midi|tours:vt_trad=10","2026-07-23|apres_midi|tours:vt_trad=12"]', 'après-midi modifié à 12, matin annulé, l\'autre créneau intact : ' + JSON.stringify(rows));
      await page.close();
    },
  },
  {
    name: 'Page client — un pro classique (sans après-midi) ne voit rien de nouveau : pas de boutons Matin / Après-midi, pas d\'étiquette, le jour passe « déjà commandé » dès la première commande',
    fn: async (ctx) => {
      const page = await ouvrirPage(ctx, 'tok_clap');
      await page.click('.cta');
      await page.waitForSelector('.prow');
      const r = await page.evaluate(() => ({ crens: document.querySelectorAll('.cren').length, draft: draft.creneau, date: draft.date, foot: butoirRuleTxt() }));
      assert(r.crens === 0 && r.draft === 'matin' && r.date === '2026-07-23' && /se ferment la veille à 23h59/.test(r.foot), 'rien de nouveau pour un pro classique : ' + JSON.stringify(r));
      await page.evaluate(async () => { setQty('clapotis', 'vt_trad', 5); await saveOrder(); });
      await page.waitForSelector('.okbox');
      const rows = await page.evaluate(LIRE, 'clapotis');
      assert(JSON.stringify(rows) === '["2026-07-23|matin|tours:vt_trad=5"]', 'commande classique = créneau matin : ' + JSON.stringify(rows));
      await page.evaluate(() => go('order'));
      await page.waitForSelector('.dt');
      const r2 = await page.evaluate(() => ({ d23: Array.from(document.querySelectorAll('.dt')).map((d) => d.querySelector('b').textContent + ':' + d.querySelector('em').textContent).find((x) => /^23:/.test(x)), tags: document.querySelectorAll('.cr').length }));
      assert(r2.d23 === '23:déjà commandé' && r2.tags === 0, 'une seule commande possible par jour, aucune étiquette : ' + JSON.stringify(r2));
      await page.close();
    },
  },
  {
    name: 'App équipe (Tours) — une commande du matin et une de l\'après-midi le même jour ; modifier l\'une ne touche pas l\'autre ; la liste les montre avec leur badge, le matin en premier',
    fn: async (ctx) => {
      const page = await preparePage(ctx, { db: dbStrapontin() });
      await gotoApp(page);
      const r = await page.evaluate(async (d) => {
        const pro = window.__mockDB.pros[0];
        const lire = () => window.__mockDB.pro_orders.filter((o) => o.pro_id === 'le_strapontin' && o.statut !== 'annule' && o.date_livraison === d)
          .map((o) => o.date_livraison + '|' + (o.creneau || 'matin') + ':' + window.__mockDB.pro_order_items.filter((i) => i.pro_order_id === o.id).map((i) => i.product_id + '=' + i.qty).join('+')).sort();
        const a = await saveProOrderSplit({ pro, date: d, editingId: null, statut: 'confirme', notes: null, created_by: 'tours', creneau: 'matin', items: [{ product_id: 'vt_trad', qty: 30, prix_applique: null }] });
        const b = await saveProOrderSplit({ pro, date: d, editingId: null, statut: 'confirme', notes: null, created_by: 'tours', creneau: 'apres_midi', items: [{ product_id: 'vt_trad', qty: 8, prix_applique: null }] });
        const apres = lire();
        // modifier l'après-midi (editingId = sa commande) : le matin doit rester
        const c = await saveProOrderSplit({ pro, date: d, editingId: b.ids[0], statut: 'confirme', notes: 'pour le service du soir', created_by: 'tours', creneau: 'apres_midi', items: [{ product_id: 'vt_trad', qty: 9, prix_applique: null }] });
        return { a: a.ids.length, b: b.ids.length, apres, fin: lire(), cId: c.ids[0] === b.ids[0] };
      }, DEMAIN);
      assert(r.a === 1 && r.b === 1 && JSON.stringify(r.apres) === '["2026-07-23|apres_midi:vt_trad=8","2026-07-23|matin:vt_trad=30"]', 'deux commandes le même jour : ' + JSON.stringify(r));
      assert(JSON.stringify(r.fin) === '["2026-07-23|apres_midi:vt_trad=9","2026-07-23|matin:vt_trad=30"]' && r.cId, 'modifier l\'après-midi réécrit la même commande, le matin reste : ' + JSON.stringify(r));
      // écran Pros de Tours : deux cartes pour demain, matin d'abord, avec leur badge
      await enterBoutique(page, 'tours');
      await page.evaluate(async () => { currentVue = 'pros'; proOrderFilterPeriod = 'tomorrow'; await loadAdminPros(); await loadProOrders('tours'); renderProOrders(); });
      await page.waitForSelector('.pro-order-card');
      const cards = await page.evaluate(() => Array.from(document.querySelectorAll('.pro-order-card .pro-order-name')).map((x) => x.textContent.replace(/\s+/g, ' ').trim()));
      assert(cards.length === 2 && /^Le Strapontin🌅 Matin/.test(cards[0]) && /^Le Strapontin🌇 Après-midi/.test(cards[1]), 'deux cartes, matin puis après-midi : ' + JSON.stringify(cards));
      // production Tours : une ligne par pro ET par créneau dans le détail d'un produit
      const agg = await page.evaluate((d) => { productionProOrdersData = window.__mockDB.pro_orders.filter((o) => o.statut !== 'annule' && o.date_livraison === d).map((o) => Object.assign({}, o, { pro_order_items: window.__mockDB.pro_order_items.filter((i) => i.pro_order_id === o.id) })); return aggregateProOrdersForProduction('production')['vt_trad']; }, DEMAIN);
      assert(agg && agg.totalQty === 39 && agg.byPro['le_strapontin'] === 30 && agg.byPro['le_strapontin|apres_midi'] === 9, 'production : 30 le matin + 9 l\'après-midi : ' + JSON.stringify(agg));
      await page.close();
    },
  },
  {
    name: 'Fiche pro / ⏰ Horaires — bloc « 🌇 Après-midi » (jour même 11h, retrait 15h par défaut), réglage lu par créneau, enregistré en null quand désactivé ; résumé des horaires le mentionne',
    fn: async (ctx) => {
      const page = await preparePage(ctx, { db: dbStrapontin() });
      await gotoApp(page);
      const r = await page.evaluate(() => {
        const strap = window.__mockDB.pros[0], clap = window.__mockDB.pros[1];
        const cfgA = proCreneauCfg(strap, 'mercredi', 'apres_midi'), cfgM = proCreneauCfg(strap, 'mercredi', 'matin');
        const offDim = proCreneauCfg(strap, 'dimanche', 'apres_midi'), clapA = proCreneauCfg(clap, 'mercredi', 'apres_midi');
        const html = proJoursBlockHtml({ jours_livraison: strap.jours_livraison, creneau_aprem: proCreneauApremDraft(strap.creneau_aprem) });
        const htmlOff = proJoursBlockHtml({ jours_livraison: clap.jours_livraison, creneau_aprem: proCreneauApremDraft(null) });
        return {
          cfgA: cfgA && cfgA.butoir_decalage + '|' + cfgA.butoir_heure + '|' + cfgA.livraison + '|' + cfgA.tournee,
          cfgM: cfgM && cfgM.butoir_decalage + '|' + cfgM.butoir_heure + '|' + cfgM.livraison,
          offDim, clapA,
          aprem: /🌇 Après-midi/.test(html) && /pro-jour-aprem actif/.test(html) && /value="11:00"/.test(html) && /value="15:00"/.test(html),
          off: /🌇 Après-midi/.test(htmlOff) && /un seul créneau par jour/.test(htmlOff),
          clean: JSON.stringify([cleanCreneauAprem(null), cleanCreneauAprem({ actif: false, butoir_heure: '10:00' }), cleanCreneauAprem({ actif: true, butoir_decalage: '-1', butoir_heure: '10:30', livraison: '16:00' })]),
          badge: proCreneauBadge({ creneau: 'matin' }, clap) + '|' + proCreneauBadge({ creneau: 'matin' }, strap).replace(/<[^>]+>/g, '') + '|' + proCreneauBadge({ creneau: 'apres_midi' }, strap).replace(/<[^>]+>/g, ''),
        };
      });
      assert(r.cfgA === '0|11:00|15:00|retrait' && r.cfgM === '-1|23:59|08:00', 'réglage par créneau (l\'après-midi garde « vient chercher » du jour) : ' + JSON.stringify(r));
      assert(r.offDim === null && r.clapA === null, 'pas d\'après-midi un jour non coché ni pour un pro classique : ' + JSON.stringify(r));
      assert(r.aprem && r.off, 'bloc Après-midi dans la fiche (actif avec ses valeurs / inactif avec son texte) : ' + JSON.stringify(r));
      assert(r.clean === '[null,null,{"actif":true,"butoir_decalage":-1,"butoir_heure":"10:30","livraison":"16:00"}]', 'nettoyage avant enregistrement : ' + r.clean);
      assert(r.badge === '|🌅 Matin|🌇 Après-midi', 'badge : rien pour un pro classique, matin/après-midi pour un pro à deux créneaux : ' + r.badge);
      // ⏰ Horaires des pros à Tours : résumé + fenêtre avec le bloc après-midi, enregistrement en base
      await enterBoutique(page, 'tours');
      await page.evaluate(async () => { currentVue = 'pros'; await loadAdminPros(); await loadProOrders('tours'); proHorairesListOpen = true; renderProOrders(); });
      await page.waitForSelector('.pro-horaires-row');
      const resume = await page.evaluate(() => Array.from(document.querySelectorAll('.pro-horaires-row')).map((x) => x.querySelector('.pl-nom').textContent + ' → ' + x.querySelector('.pl-ct').textContent));
      assert(resume.some((x) => /Le Strapontin.*🌇 après-midi jusqu'à 11h/.test(x)) && resume.some((x) => /Le Clapotis/.test(x) && !/après-midi/.test(x)), 'résumé des horaires : ' + JSON.stringify(resume));
      await page.evaluate(async () => { openProHoraires('clapotis'); handleProApremToggle(); handleProApremField('butoir_heure', '10:00'); await saveProHoraires(); });
      const saved = await page.evaluate(() => JSON.stringify(window.__mockDB.pros.find((p) => p.id === 'clapotis').creneau_aprem));
      assert(saved === '{"actif":true,"butoir_decalage":0,"butoir_heure":"10:00","livraison":"15:00"}', 'après-midi activé depuis ⏰ Horaires, enregistré en base : ' + saved);
      await page.close();
    },
  },
];
