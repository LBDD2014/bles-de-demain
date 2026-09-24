/* ============================================================
   v20.256 — Fiche pro : le réglage « Livreur » (tournée / vient chercher /
   livré par la boutique) était oublié à l'ouverture de la fiche → affichait
   « Auto » et un nouvel enregistrement l'effaçait (signalé par Phil le 24/09).
   ============================================================ */
import { preparePage, gotoApp, assert } from '../helpers/harness.mjs';
import { makeDB, TENANT_ID } from '../helpers/fixtures.mjs';

const T = TENANT_ID;

export const tests = [
  {
    name: 'Fiche pro — le réglage tournée est relu à l\'ouverture et survit à un nouvel enregistrement',
    fn: async (ctx) => {
      const db = makeDB();
      db.pros = [{ id: 'tortiniere', tenant_id: T, nom: 'LA TORTINIERE', boutique_principale: 'local', contacts: [],
        jours_livraison: {
          mardi:  { actif: true, butoir_decalage: -1, butoir_heure: '14:00', livraison: '11:00', tournee: 'livreur' },
          samedi: { actif: true, butoir_decalage: -1, butoir_heure: '12:00', livraison: null, tournee: 'retrait' },
        } }];
      const page = await preparePage(ctx, { db });
      await gotoApp(page);
      const r = await page.evaluate(async () => {
        currentVue = 'pros';
        adminPros = window.__mockDB.pros.map((p) => JSON.parse(JSON.stringify(p)));
        openProForm('tortiniere');
        const draft = { mardi: adminProsDraft.jours_livraison.mardi.tournee, samedi: adminProsDraft.jours_livraison.samedi.tournee };
        const sel = Array.from(document.querySelectorAll('select[onchange*="\'tournee\'"]')).map((s) => s.value);
        await saveProForm();
        const saved = window.__mockDB.pros[0].jours_livraison;
        return { draft, sel, saved: { mardi: saved.mardi && saved.mardi.tournee, samedi: saved.samedi && saved.samedi.tournee } };
      });
      assert(r.draft.mardi === 'livreur' && r.draft.samedi === 'retrait', 'relu à l\'ouverture : ' + JSON.stringify(r.draft));
      assert(r.sel.indexOf('livreur') !== -1 && r.sel.indexOf('retrait') !== -1, 'listes affichées : ' + r.sel.join(', '));
      assert(r.saved.mardi === 'livreur' && r.saved.samedi === 'retrait', 'conservé après enregistrement : ' + JSON.stringify(r.saved));
      await page.close();
    },
  },
];
