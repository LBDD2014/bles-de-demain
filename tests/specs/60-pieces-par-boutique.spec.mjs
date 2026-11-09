/* ============================================================
   v20.344 — 📊 Pièces par boutique (BackOffice, Phil, 09/11/2026) : « les besoins des boutiques,
   ventilés par site et produits, suivant les réassorts et les ventes », réservé à lui (PIN).
   Un mois, par boutique puis par produit : Commandé (réassorts envoyés, caisses → pièces),
   Livré (coché livreur), Vendu et Perte (Ventes validées). Fiche réassort rattachée à la
   fiche vendue de même nom. Vue Par produit. CSV.
   Base factice, rien vers Supabase. Horloge : mercredi 22/07/2026 10h00.
   ============================================================ */
import { preparePage, gotoApp, enterBoutique, assert } from '../helpers/harness.mjs';
import { makeDB, TENANT_ID } from '../helpers/fixtures.mjs';
const T = TENANT_ID;

function db() {
  const d = makeDB();
  d.products.push({ id: 'cro_reap', tenant_id: T, name: 'Croissant', category: 'viennoiserie', actif: true, usage: 'reappro', conditioning_unit: 'caisse', conditioning_qty: 77, supply_by_boutique: null });
  d.reappros = [
    { id: 'r1', tenant_id: T, boutique_id: 'tours', product_id: 'cro_reap', service_date: '2026-07-17', commander: '2', sent_at: '2026-07-16T10:00:00', qty_livree: null, livre_at: '2026-07-17T06:00:00' },   // 2 caisses = 154 pièces
    { id: 'r2', tenant_id: T, boutique_id: 'saint-avertin', product_id: 'vt_trad', service_date: '2026-07-20', commander: '60', sent_at: '2026-07-19T10:00:00', qty_livree: 55, livre_at: '2026-07-20T06:00:00' },
    { id: 'r3', tenant_id: T, boutique_id: 'tours', product_id: 'vt_trad', service_date: '2026-07-20', commander: '30', sent_at: null, qty_livree: null, livre_at: null },   // jamais envoyé : ignoré
    { id: 'r4', tenant_id: T, boutique_id: 'tours', product_id: 'cro_reap', service_date: '2026-06-30', commander: '9', sent_at: '2026-06-29T10:00:00', qty_livree: null, livre_at: null },   // juin : hors mois
  ];
  d.sales = [
    { id: 's1', tenant_id: T, boutique_id: 'tours', product_id: 'vp_croissant', date: '2026-07-20', matin: 150, aprem: 0, reste_j1: 10, reste_j2: 0, perte: 4, day_closed: true },   // vendu 136
    { id: 's2', tenant_id: T, boutique_id: 'tours', product_id: 'vp_croissant', date: '2026-07-21', matin: 120, aprem: 0, reste_j1: null, reste_j2: null, perte: null, day_closed: false },   // pas validée
    { id: 's3', tenant_id: T, boutique_id: 'saint-avertin', product_id: 'vt_trad', date: '2026-07-20', matin: 50, aprem: 0, reste_j1: 0, reste_j2: 0, perte: 2, day_closed: true },   // vendu 48
    { id: 's4', tenant_id: T, boutique_id: 'veigne', product_id: 'vp_croissant', date: '2026-07-20', matin: null, aprem: 0, reste_j1: 5, reste_j2: 0, perte: 1, day_closed: true },   // Matin vide → prévis 50 → vendu 44
  ];
  d.previs.push({ tenant_id: T, boutique_id: 'veigne', product_id: 'vp_croissant', service_date: '2026-07-20', qty: 50 });
  return d;
}
const lignes = (page) => page.evaluate(() => Array.from(document.querySelectorAll('.pro-recap-table tbody tr')).map((tr) => Array.from(tr.querySelectorAll('td')).map((td) => td.textContent.replace(/[▶▼]/g, '').replace(/\s+/g, ' ').trim()).join(' ')));

export const tests = [
  {
    name: 'BackOffice → Pièces — par boutique : Tours 154 commandés / 154 livrés / 136 vendus / 4 pertes ; St-Av 60 / 55 / 48 / 2 ; journée non validée signalée ; Croissant réassort rattaché au Croissant vendu',
    fn: async (ctx) => {
      const page = await preparePage(ctx, { db: db() });
      await gotoApp(page); await enterBoutique(page, 'backoffice');
      await page.evaluate(() => setVue('pieces_boutiques'));
      await page.waitForSelector('.pro-recap-table');
      const nav = await page.evaluate(() => Array.from(document.querySelectorAll('#bottom-nav .bnav-item')).map((b) => b.textContent.trim()).join('|'));
      assert(/Pièces/.test(nav), 'onglet Pièces dans le BackOffice : ' + nav);
      const l0 = await lignes(page);
      assert(l0.length === 3 && /Veigné 1 produits – – 44 1 2 %/.test(l0[0]) && /Tours 1 produits 154 154 136 4 3 %/.test(l0[1]) && /St-Avertin 1 produits 60 55 48 2 4 %/.test(l0[2]), 'lignes boutiques : ' + JSON.stringify(l0));
      const warn = await page.evaluate(() => document.getElementById('main-content').textContent);
      assert(/non validées.*Tours 1 j/.test(warn), 'journée non validée signalée');
      await page.evaluate(() => pbToggle('tours'));
      const l1 = await lignes(page);
      assert(l1.some((x) => /^Viennoiserie$/.test(x)) && l1.some((x) => /↳ Croissant 154 154 136 4 3 %/.test(x)), 'Tours déplié : ' + JSON.stringify(l1));
      const foot = await page.evaluate(() => Array.from(document.querySelectorAll('.pro-recap-table tfoot td')).map((td) => td.textContent.trim()).join(' '));
      assert(/Total 214 209 228 7/.test(foot), 'total : ' + foot);
      await page.close();
    },
  },
  {
    name: 'BackOffice → Pièces — vue Par produit : Croissant 154 / 154 / 136 / 4 puis Tradition ; déplié = par boutique ; CSV 2 lignes',
    fn: async (ctx) => {
      const page = await preparePage(ctx, { db: db() });
      await gotoApp(page); await enterBoutique(page, 'backoffice');
      await page.evaluate(() => setVue('pieces_boutiques'));
      await page.waitForSelector('.pro-recap-table');
      await page.evaluate(() => pbSetVue('produits'));
      const l0 = await lignes(page);
      assert(l0.length === 2 && /Croissant.*154 154 180 5 3 %/.test(l0[0]) && /Tradition.*60 55 48 2 4 %/.test(l0[1]), 'par produit : ' + JSON.stringify(l0));
      await page.evaluate(() => pbToggle('vp_croissant'));
      const l1 = await lignes(page);
      assert(l1.length === 4 && /↳ Veigné – – 44 1/.test(l1[1]) && /↳ Tours 154 154 136 4/.test(l1[2]), 'Croissant déplié : ' + JSON.stringify(l1));
      const csv = await page.evaluate(() => { let out = null; const orig = URL.createObjectURL; URL.createObjectURL = (b) => { out = b; return 'blob:x'; }; exportPiecesBoutiquesCSV(); URL.createObjectURL = orig; return out ? out.text() : null; });
      const lines = csv.split('\n').filter(Boolean);
      assert(lines.length === 4 && /"Veigné";"Viennoiserie";"Croissant";0;0;44;1/.test(lines[1]) && /"Tours";"Viennoiserie";"Croissant";154;154;136;4/.test(lines[2]) && /"St-Avertin";"Pains";"Tradition";60;55;48;2/.test(lines[3]), 'CSV : ' + JSON.stringify(lines));
      await page.close();
    },
  },
];
