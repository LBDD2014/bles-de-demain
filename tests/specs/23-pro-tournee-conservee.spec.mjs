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
    name: 'Fiche pro — v20.287 « Tous les jours cochés » : un seul réglage posé sur les jours cochés, cases vides seulement ; « remplacer » écrase ; les jours décochés ne bougent pas',
    fn: async (ctx) => {
      const db = makeDB();
      db.pros = [{ id: 'bondici', tenant_id: T, nom: 'BON D\'ICI', boutique_principale: 'local', contacts: [],
        jours_livraison: {
          mardi:    { actif: true, butoir_decalage: -1, butoir_heure: '23:00', livraison: '07:00', tournee: 'retrait' },
          mercredi: { actif: true, butoir_decalage: -1, butoir_heure: null, livraison: null, tournee: null },
          jeudi:    { actif: true, butoir_decalage: -1, butoir_heure: '', livraison: '', tournee: '' },
        } }];
      const page = await preparePage(ctx, { db });
      await gotoApp(page);
      const r = await page.evaluate(async () => {
        currentVue = 'pros';
        adminPros = window.__mockDB.pros.map((p) => JSON.parse(JSON.stringify(p)));
        openProForm('bondici');
        const ligne = !!document.querySelector('.pro-jour-tous');
        // 1. remplit les vides seulement
        proToutDraft.butoir_heure = '20:00'; proToutDraft.livraison = '09:00'; proToutDraft.tournee = 'livreur';
        proToutAppliquer();
        const j = adminProsDraft.jours_livraison;
        const apres1 = { mardi: [j.mardi.butoir_heure, j.mardi.livraison, j.mardi.tournee], mercredi: [j.mercredi.butoir_heure, j.mercredi.livraison, j.mercredi.tournee], jeudi: [j.jeudi.butoir_heure, j.jeudi.livraison, j.jeudi.tournee], lundi: j.lundi };
        // 2. remplacer : le mardi prend aussi le réglage
        proToutDraft.ecraser = true; proToutAppliquer();
        const apres2 = [j.mardi.butoir_heure, j.mardi.livraison, j.mardi.tournee];
        await saveProForm();
        const saved = window.__mockDB.pros[0].jours_livraison;
        return { ligne, apres1, apres2, savedMardi: saved.mardi, savedLundi: saved.lundi };
      });
      assert(r.ligne, 'la ligne « Tous les jours cochés » est là');
      assert(JSON.stringify(r.apres1.mardi) === '["23:00","07:00","retrait"]', 'mardi déjà réglé : inchangé : ' + JSON.stringify(r.apres1.mardi));
      assert(JSON.stringify(r.apres1.mercredi) === '["20:00","09:00","livreur"]' && JSON.stringify(r.apres1.jeudi) === '["20:00","09:00","livreur"]', 'mercredi/jeudi vides : remplis : ' + JSON.stringify(r.apres1));
      assert(r.apres1.lundi === undefined, 'lundi décoché : pas créé');
      assert(JSON.stringify(r.apres2) === '["20:00","09:00","livreur"]', 'avec « remplacer » le mardi est écrasé : ' + JSON.stringify(r.apres2));
      assert(r.savedMardi && r.savedMardi.butoir_heure === '20:00' && r.savedMardi.tournee === 'livreur' && r.savedLundi === undefined, 'enregistré en base : ' + JSON.stringify(r.savedMardi));
      await page.close();
    },
  },
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
