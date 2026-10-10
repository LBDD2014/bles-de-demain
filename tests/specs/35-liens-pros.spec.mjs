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
      assert(r.rows.length === 3 && r.rows.map((x) => x.nom.split(' ')[0]).join(',') === 'Bar,Coop,Relais', 'les 3 pros actifs triés par nom, pas l\'inactif : ' + JSON.stringify(r.rows.map((x) => x.nom)));
      const bar = r.rows[0], coop = r.rows[1], relais = r.rows[2];
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
      assert(/pro_token%3D/.test(r.opened) && !/QR%20code/.test(r.opened), 'le message contient le lien et pas la phrase sur le QR code');
      assert(r.bar.tok && r.bar.sent && r.barSt === '✓ envoyé le 22/07', 'Bar : lien créé + date mémorisée + repère : ' + JSON.stringify(r.bar) + ' / ' + r.barSt);
      assert(r.coop.tok && r.coop.sent, 'Coop (copier) : lien créé + date mémorisée : ' + JSON.stringify(r.coop));
      assert(r.memeInput && r.filtre.join(',') === 'Coop', 'filtre « coop » sans re-rendu : ' + r.filtre.join(','));
      assert(r.masques.length === 0 && /3 \/ 3/.test(r.sub), 'tous ont reçu le lien → tous masqués, « 3 / 3 » : ' + r.masques.join(',') + ' / ' + r.sub);
      await page.close();
    },
  },
];
