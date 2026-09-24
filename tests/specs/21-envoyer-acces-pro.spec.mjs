/* ============================================================
   v20.254 — 📱 Envoyer l'accès à un pro (lien + QR + message WhatsApp).

   Besoin réel (Phil, 24/09) : envoyer une fois par WhatsApp le lien de commande
   + un QR code + un mode d'emploi, en prévenant des heures limites (par jour
   de livraison), jours et heure limite écrits sur l'image. Vouvoiement.
   La bibliothèque QR (CDN) est remplacée par un faux ici : pas de réseau en test.
   ============================================================ */
import { preparePage, gotoApp, assert } from '../helpers/harness.mjs';
import { makeDB, TENANT_ID } from '../helpers/fixtures.mjs';

const T = TENANT_ID;
const JOURS = {
  mardi:    { actif: true,  butoir_heure: '14:00', butoir_decalage: -1 },
  vendredi: { actif: true,  butoir_heure: null,    butoir_decalage: -1 },
  lundi:    { actif: false, butoir_heure: null,    butoir_decalage: -1 },
};

async function ouvrir(ctx, pro) {
  const db = makeDB();
  db.pros = [Object.assign({ id: 'resto_test', tenant_id: T, nom: 'Resto Test', boutique_principale: 'tours',
    contacts: [{ nom: 'Julie', tel: '06 11 22 33 44', role: 'gérante' }], jours_livraison: JOURS, magic_token: null }, pro || {})];
  const page = await preparePage(ctx, { db });
  await gotoApp(page);
  await page.evaluate(async () => {
    window.qrcode = function() { return { addData() {}, make() {}, getModuleCount: () => 21, isDark: (r, c) => (r + c) % 2 === 0 }; };
    adminPros = window.__mockDB.pros.map((p) => Object.assign({}, p));
    await openProAccessModal('resto_test');
  });
  return page;
}

export const tests = [
  {
    name: 'Accès pro — jours et heure limite lisibles, par jour de livraison',
    fn: async (ctx) => {
      const page = await ouvrir(ctx);
      const l = await page.evaluate(() => proDeliveryLines(adminPros[0]).map((x) => x.jour + ' : ' + x.limite));
      assert(JSON.stringify(l) === JSON.stringify(['mardi : avant lundi 14h', 'vendredi : avant jeudi minuit']), l.join(' | '));
      await page.close();
    },
  },
  {
    name: 'Accès pro — le lien est créé s\'il n\'existait pas, et le message le contient (vouvoiement)',
    fn: async (ctx) => {
      const page = await ouvrir(ctx);
      const r = await page.evaluate(() => ({
        tok: window.__mockDB.pros[0].magic_token,
        msg: document.getElementById('pa-msg').value,
        img: !!document.querySelector('#pro-access-modal .pa-img'),
      }));
      assert(r.tok && r.tok.length > 10, 'lien créé en base');
      assert(r.msg.indexOf('?pro_token=' + r.tok) !== -1, 'le message contient le bon lien');
      assert(r.msg.indexOf('Bonjour Julie') === 0, 'salutation au contact : ' + r.msg.slice(0, 30));
      assert(r.msg.indexOf('vous') !== -1 && r.msg.indexOf(' tu ') === -1, 'vouvoiement');
      assert(r.msg.indexOf('07 57 77 05 87') !== -1, 'téléphone de Tours (boutique du pro)');
      assert(r.msg.indexOf('Livraison mardi : commande avant lundi 14h') !== -1, 'jours + limite dans le message');
      assert(r.img, 'image QR affichée');
      await page.close();
    },
  },
  {
    name: 'Accès pro — un lien existant n\'est PAS renouvelé (déjà envoyé = doit continuer à marcher)',
    fn: async (ctx) => {
      const page = await ouvrir(ctx, { magic_token: 'ancien_lien_123' });
      const tok = await page.evaluate(() => window.__mockDB.pros[0].magic_token);
      assert(tok === 'ancien_lien_123', 'lien inchangé : ' + tok);
      await page.close();
    },
  },
  {
    name: 'Accès pro — alerte si une heure limite n\'est pas vraiment réglée',
    fn: async (ctx) => {
      const page = await ouvrir(ctx);
      const w = await page.evaluate(() => (document.querySelector('#pro-access-modal .pa-warn') || {}).textContent || '');
      assert(w.indexOf('vendredi') !== -1 && w.indexOf('mardi') === -1, 'alerte sur vendredi seulement : ' + w);
      await page.close();
    },
  },
];
