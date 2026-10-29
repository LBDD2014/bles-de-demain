/* ============================================================
   v20.272 — « 📱 Liens pros » (Phil, 10/10/2026) : tous les liens d'accès des pros
   sur un écran, WhatsApp en un tap, date d'envoi mémorisée (pros.magic_sent_at).
   Date figée des tests : mercredi 22 juillet 2026.
   ============================================================ */
import { preparePage, gotoApp, assert } from '../helpers/harness.mjs';
import { makeDB, TENANT_ID } from '../helpers/fixtures.mjs';
const T = TENANT_ID;

async function liensPros(ctx) {
  const db = makeDB();
  db.pros = [
    { id: 'relais', tenant_id: T, nom: 'Relais d\'Amboise', actif: true, boutique_principale: 'local', contacts: [{ nom: 'Marc', tel: '0611223344' }], jours_livraison: {}, catalogue_restreint: ['vp_tra'], magic_token: 'tok_relais', magic_sent_at: '2026-07-03T10:00:00Z' },
    { id: 'coop', tenant_id: T, nom: 'Coop Nature', actif: true, boutique_principale: 'tours', contacts: [], jours_livraison: {}, catalogue_restreint: null, magic_token: null, magic_sent_at: null },
    { id: 'bar', tenant_id: T, nom: 'Bar du Marché', actif: true, boutique_principale: 'local', contacts: [{ nom: 'Léa', tel: '0600000000' }], jours_livraison: {}, catalogue_restreint: null, magic_token: null, magic_sent_at: null },
    { id: 'ferme', tenant_id: T, nom: 'Fermé Définitif', actif: false, boutique_principale: 'local', contacts: [], jours_livraison: {}, catalogue_restreint: null },
  ];
  const page = await preparePage(ctx, { db });
  await gotoApp(page);
  await page.evaluate(async () => { currentVue = 'pros'; await loadAdminPros(); await loadAdminProducts(); renderAdminPros(); });
  return page;
}

export const tests = [
  {
    name: 'Liens pros — v20.286 : une colonne par boutique (Le Local / Veigné / Tours), en-tête avec la règle de secours, secours à droite du nom, un tap ouvre la fiche',
    fn: async (ctx) => {
      const page = await liensPros(ctx);
      const r = await page.evaluate(async () => {
        window.__mockDB.fab_jours_off = [{ site: 'local', jours: '0' }, { site: 'tours', jours: '6' }];
        window.__mockDB.pros.find((p) => p.id === 'bar').boutique_secours = 'tours';
        adminPros.find((p) => p.id === 'bar').boutique_secours = 'tours';
        joursOffBySite = null;   // forcer la relecture des jours de fermeture
        await openProLinksModal();
        const cols = Array.from(document.querySelectorAll('#pro-links-modal .pl-col')).map((c) => ({
          site: c.getAttribute('data-site'), h: c.querySelector('.pl-col-h').textContent.replace(/\s+/g, ' ').trim(),
          pros: Array.from(c.querySelectorAll('.pl-row')).map((x) => x.querySelector('.pl-nom').firstChild.textContent.trim() + ' [' + x.querySelector('.pl-sec').textContent + ']'),
          vide: !!c.querySelector('.pl-empty'),
        }));
        document.querySelector('#pro-links-modal .pl-col[data-site="local"] .pl-sec').click();
        return { cols, ficheOuverte: adminProsEditingId, modaleFermee: !document.getElementById('pro-links-modal').classList.contains('show') };
      });
      assert(r.cols.map((c) => c.site).join(',') === 'local,veigne,tours', '3 colonnes dans l\'ordre : ' + r.cols.map((c) => c.site).join(','));
      const compact = (t) => t.replace(/\s+/g, '');
      assert(compact(r.cols[0].h) === compact('Le Local 2 pros · 1 a le lien Fermé le lundi → secours Veigné'), 'en-tête Local : ' + r.cols[0].h);
      assert(compact(r.cols[1].h) === compact('Veigné 0 pro · 0 a le lien Ouvert 7/7 → pas de secours') && r.cols[1].vide, 'en-tête Veigné + « Aucun pro » : ' + r.cols[1].h);
      assert(compact(r.cols[2].h) === compact('Tours 1 pro · 0 a le lien Fermé le dimanche → pas de boutique de secours'), 'en-tête Tours : ' + r.cols[2].h);
      assert(JSON.stringify(r.cols[0].pros) === '["Bar du Marché [secours : Tours]","Relais d\'Amboise [secours : Veigné (par défaut)]"]', 'Local : secours réglé / par défaut : ' + JSON.stringify(r.cols[0].pros));
      assert(JSON.stringify(r.cols[2].pros) === '["Coop Nature [secours : —]"]', 'Tours : pas de secours : ' + JSON.stringify(r.cols[2].pros));
      assert(r.ficheOuverte === 'bar' && r.modaleFermee, 'un tap sur le secours ouvre la fiche du pro : ' + JSON.stringify({ f: r.ficheOuverte, m: r.modaleFermee }));
      await page.close();
    },
  },
  {
    name: 'Liens pros — un écran, une ligne par pro actif, WhatsApp seulement avec un téléphone, repère envoyé / jamais / pas de téléphone',
    fn: async (ctx) => {
      const page = await liensPros(ctx);
      const r = await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.indexOf('Liens pros') !== -1);
        btn.click();
        const rows = Array.from(document.querySelectorAll('#pro-links-modal .pl-row'));
        return {
          ouvert: document.getElementById('pro-links-modal').classList.contains('show'),
          sub: document.querySelector('#pro-links-modal .modal-sub').textContent,
          rows: rows.map((r) => ({ nom: r.querySelector('.pl-nom').textContent.trim(), st: r.querySelector('.pl-st').textContent, wa: !!r.querySelector('.pl-wa'), copy: !!r.querySelector('.pl-copy'), lien: !!r.querySelector('.pl-ct a') })),
        };
      });
      assert(r.ouvert && /1 \/ 3/.test(r.sub), 'modale ouverte, « 1 / 3 ont reçu leur lien » : ' + r.sub);
      // v20.286 — colonnes par boutique : Le Local (Bar, Relais, par nom) puis Veigné (vide) puis Tours (Coop)
      assert(r.rows.length === 3 && r.rows.map((x) => x.nom.split(' ')[0]).join(',') === 'Bar,Relais,Coop', 'les 3 pros actifs par colonne puis par nom, pas l\'inactif : ' + JSON.stringify(r.rows.map((x) => x.nom)));
      const bar = r.rows[0], relais = r.rows[1], coop = r.rows[2];
      assert(relais.st === '✓ envoyé le 03/07' && relais.wa && relais.copy, 'Relais : envoyé le 03/07, WhatsApp + Copier : ' + JSON.stringify(relais));
      assert(bar.st === 'jamais envoyé' && bar.wa, 'Bar : jamais envoyé, WhatsApp dispo : ' + JSON.stringify(bar));
      assert(coop.st === '📞 pas de téléphone' && !coop.wa && coop.copy && coop.lien, 'Coop : pas de téléphone, Copier seulement + lien vers la fiche : ' + JSON.stringify(coop));
      await page.close();
    },
  },
  {
    name: 'Liens pros — WhatsApp crée le lien s\'il manque, ouvre wa.me avec le message, mémorise la date ; Copier aussi ; filtre et « masquer ceux qui l\'ont reçu » sans re-rendu',
    fn: async (ctx) => {
      const page = await liensPros(ctx);
      const r = await page.evaluate(async () => {
        openProLinksModal();
        let opened = null; window.open = (u) => { opened = u; return null; };
        await proLinksWhatsApp('bar');
        await new Promise((res) => setTimeout(res, 100));
        const bar = window.__mockDB.pros.find((p) => p.id === 'bar');
        const barRow = Array.from(document.querySelectorAll('#pro-links-modal .pl-row')).find((x) => x.textContent.indexOf('Bar du') !== -1);
        await proLinksCopy('coop');
        await new Promise((res) => setTimeout(res, 100));
        const coop = window.__mockDB.pros.find((p) => p.id === 'coop');
        // filtre à la frappe : pas de re-rendu (l'input garde son nœud)
        const inp = document.querySelector('#pro-links-modal input[type=search]');
        inp.value = 'coop'; inp.dispatchEvent(new Event('input'));
        const memeInput = document.querySelector('#pro-links-modal input[type=search]') === inp;
        const visibles = () => Array.from(document.querySelectorAll('#pro-links-modal .pl-row')).filter((x) => x.style.display !== 'none').map((x) => x.querySelector('.pl-nom').textContent.trim().split(' ')[0]);
        const filtre = visibles();
        inp.value = ''; inp.dispatchEvent(new Event('input'));
        const cb = document.querySelector('#pro-links-modal input[type=checkbox]'); cb.checked = true; cb.dispatchEvent(new Event('change'));
        const masques = visibles();
        return { opened, bar: { tok: bar.magic_token, sent: bar.magic_sent_at }, barSt: barRow.querySelector('.pl-st').textContent, coop: { tok: coop.magic_token, sent: coop.magic_sent_at }, memeInput, filtre, masques,
          sub: document.querySelector('#pro-links-modal .modal-sub').textContent };
      });
      assert(r.opened && r.opened.indexOf('https://wa.me/33600000000?text=') === 0, 'wa.me avec le numéro en 33… : ' + r.opened);
      assert(/pro.html%3Ft%3D/.test(r.opened) && !/QR%20code/.test(r.opened), 'le message contient le lien et pas la phrase sur le QR code');
      assert(r.bar.tok && r.bar.sent && r.barSt === '✓ envoyé le 22/07', 'Bar : lien créé + date mémorisée + repère : ' + JSON.stringify(r.bar) + ' / ' + r.barSt);
      assert(r.coop.tok && r.coop.sent, 'Coop (copier) : lien créé + date mémorisée : ' + JSON.stringify(r.coop));
      assert(r.memeInput && r.filtre.join(',') === 'Coop', 'filtre « coop » sans re-rendu : ' + r.filtre.join(','));
      assert(r.masques.length === 0 && /3 \/ 3/.test(r.sub), 'tous ont reçu le lien → tous masqués, « 3 / 3 » : ' + r.masques.join(',') + ' / ' + r.sub);
      await page.close();
    },
  },
  {
    name: 'Liens pros — v20.283 : Copier copie le lien mais ne marque « envoyé » que si on confirme ; Annuler = repère inchangé, lien gardé',
    fn: async (ctx) => {
      const db = makeDB();
      db.pros = [{ id: 'coop', tenant_id: T, nom: 'Coop Nature', actif: true, boutique_principale: 'tours', contacts: [{ nom: 'Jo', tel: '0612345678' }], jours_livraison: {}, catalogue_restreint: null, magic_token: null, magic_sent_at: null }];
      const page = await preparePage(ctx, { db, acceptDialogs: false });   // confirm() → Annuler
      await gotoApp(page);
      const r = await page.evaluate(async () => {
        currentVue = 'pros'; await loadAdminPros(); await loadAdminProducts(); renderAdminPros();
        openProLinksModal();
        let copie = ''; navigator.clipboard.writeText = (u) => { copie = u; return Promise.resolve(); };
        await proLinksCopy('coop');
        await new Promise((res) => setTimeout(res, 100));
        const coop = window.__mockDB.pros.find((p) => p.id === 'coop');
        const row = document.querySelector('#pro-links-modal .pl-row');
        return { copie, tok: coop.magic_token, sent: coop.magic_sent_at, st: row.querySelector('.pl-st').textContent };
      });
      assert(r.copie && r.copie.indexOf('pro.html?t=' + r.tok) !== -1, 'le lien est copié : ' + r.copie);
      assert(r.tok && !r.sent && r.st === 'jamais envoyé', 'Annuler : lien créé mais pas marqué envoyé : ' + JSON.stringify(r));
      await page.close();
    },
  },
  {
    name: 'Liens pros — v20.284 : « 📤 Image + message » partage l\'image QR ET le message en un geste ; partage abouti = envoyé, partage annulé = rien',
    fn: async (ctx) => {
      const page = await liensPros(ctx);
      const r = await page.evaluate(async () => {
        window.qrcode = function() { return { addData() {}, make() {}, getModuleCount: () => 21, isDark: (r, c) => (r + c) % 2 === 0 }; };
        openProLinksModal();
        const recu = [];
        navigator.canShare = (d) => !!(d && d.files && d.files.length);
        navigator.share = async (d) => { recu.push({ files: d.files.map((f) => f.name + '|' + f.type + '|' + f.size), text: d.text }); };
        const rows = () => Array.from(document.querySelectorAll('#pro-links-modal .pl-row'));
        const nbBoutons = rows().filter((x) => x.querySelector('.pl-share')).length;
        await proLinksShare('coop');          // sans téléphone en fiche : le partage marche quand même
        await new Promise((res) => setTimeout(res, 100));
        const coop = window.__mockDB.pros.find((p) => p.id === 'coop');
        navigator.share = async () => { throw new DOMException('annulé', 'AbortError'); };
        await proLinksShare('bar');
        await new Promise((res) => setTimeout(res, 100));
        const bar = window.__mockDB.pros.find((p) => p.id === 'bar');
        return { nbBoutons, nbRows: rows().length, recu, coop: { tok: coop.magic_token, sent: coop.magic_sent_at }, bar: { tok: bar.magic_token, sent: bar.magic_sent_at } };
      });
      assert(r.nbBoutons === r.nbRows && r.nbRows === 3, 'un bouton 📤 sur chaque ligne : ' + r.nbBoutons + ' / ' + r.nbRows);
      assert(r.recu.length === 1 && /^LBDD-commande-Coop-Nature\.png\|image\/png\|[1-9]/.test(r.recu[0].files[0]), 'image PNG nommée au client : ' + JSON.stringify(r.recu));
      assert(/Bonjour/.test(r.recu[0].text) && r.recu[0].text.indexOf('pro.html?t=' + r.coop.tok) !== -1 && /QR code en photo/.test(r.recu[0].text), 'le message avec le lien part avec l\'image : ' + r.recu[0].text.slice(0, 80));
      assert(r.coop.sent, 'partage abouti → envoyé : ' + JSON.stringify(r.coop));
      assert(r.bar.tok && !r.bar.sent, 'partage annulé → lien gardé, pas marqué envoyé : ' + JSON.stringify(r.bar));
      await page.close();
    },
  },
  {
    name: 'Liens pros — v20.300 : la case « envoyé » se coche à la main (date du jour) et se décoche (repère retiré) ; compteurs et filtre suivent',
    fn: async (ctx) => {
      const page = await liensPros(ctx);
      const r = await page.evaluate(async () => {
        openProLinksModal();
        const row = (nom) => Array.from(document.querySelectorAll('#pro-links-modal .pl-row')).find((x) => x.textContent.indexOf(nom) !== -1);
        const etat = (nom) => { const x = row(nom); return { coche: x.querySelector('.pl-chk-in').checked, st: x.querySelector('.pl-st').textContent, sent: x.getAttribute('data-sent') }; };
        const avant = { bar: etat('Bar du'), relais: etat('Relais'), sub: document.querySelector('#pro-links-modal .modal-sub').textContent };
        // Bar : jamais envoyé → on coche à la main (lien envoyé par SMS depuis le téléphone perso)
        const cbBar = row('Bar du').querySelector('.pl-chk-in'); cbBar.checked = true; cbBar.dispatchEvent(new Event('change'));
        await new Promise((res) => setTimeout(res, 100));
        const bar = window.__mockDB.pros.find((p) => p.id === 'bar');
        const apresCoche = { bar: etat('Bar du'), sub: document.querySelector('#pro-links-modal .modal-sub').textContent, tok: bar.magic_token, sent: bar.magic_sent_at };
        // Relais : envoyé le 03/07 → on décoche (c'était une erreur)
        const cbRel = row('Relais').querySelector('.pl-chk-in'); cbRel.checked = false; cbRel.dispatchEvent(new Event('change'));
        await new Promise((res) => setTimeout(res, 100));
        const relais = window.__mockDB.pros.find((p) => p.id === 'relais');
        const apresDecoche = { relais: etat('Relais'), sub: document.querySelector('#pro-links-modal .modal-sub').textContent, sent: relais.magic_sent_at, tok: relais.magic_token };
        // « Masquer ceux qui l'ont reçu » : Bar (coché) disparaît, Relais (décoché) reste
        const hide = document.querySelector('#pro-links-modal input[type=checkbox]'); hide.checked = true; hide.dispatchEvent(new Event('change'));
        const visibles = Array.from(document.querySelectorAll('#pro-links-modal .pl-row')).filter((x) => x.style.display !== 'none').map((x) => x.querySelector('.pl-nom').textContent.trim().split(' ')[0]);
        return { avant, apresCoche, apresDecoche, visibles };
      });
      assert(!r.avant.bar.coche && r.avant.relais.coche && /1 \/ 3/.test(r.avant.sub), 'au départ : Bar décoché, Relais coché, 1 / 3 : ' + JSON.stringify(r.avant));
      assert(r.apresCoche.bar.coche && r.apresCoche.bar.st === '✓ envoyé le 22/07' && r.apresCoche.bar.sent && /2 \/ 3/.test(r.apresCoche.sub), 'coche à la main : date du jour mémorisée, 2 / 3 : ' + JSON.stringify(r.apresCoche));
      assert(r.apresCoche.tok === null, 'cocher à la main ne crée pas de lien (le lien a été envoyé autrement, ou sera créé au premier envoi) : ' + r.apresCoche.tok);
      assert(!r.apresDecoche.relais.coche && r.apresDecoche.relais.st === 'jamais envoyé' && r.apresDecoche.sent === null && /1 \/ 3/.test(r.apresDecoche.sub), 'décoche : repère retiré, 1 / 3 : ' + JSON.stringify(r.apresDecoche));
      assert(r.apresDecoche.tok === 'tok_relais', 'décocher ne touche pas au lien lui-même : ' + r.apresDecoche.tok);
      assert(r.visibles.join(',') === 'Relais,Coop', 'masquer ceux qui l\'ont reçu : Bar caché, Relais et Coop visibles : ' + r.visibles.join(','));
      await page.close();
    },
  },
];
