/* ============================================================
   v20.329 — Prise de commande plus fluide (Phil, 31/10/2026 : « est-ce que la prise de commande est fluide ? »,
   maquette prise-commande-mockup.html, « Oui, les 5 »).
   1 barre fixe en bas : total + « ✓ Créer » (gris tant qu'il n'y a aucun produit)
   2 paiement sous le total, acompte 30 % / 50 %, reste affiché
   3 carte de la fête repliée par groupe ; un groupe avec un produit reste ouvert ; la loupe ouvre ce qui correspond
   4 produits : une recherche ou une catégorie, un appui ajoute, + / − ; « ✏️ Autre » = texte libre
   5 « € prix » : prix tapé à la main sur un produit hors carte → total, acompte, ticket
   Base factice, rien vers Supabase. Horloge : mercredi 22/07/2026 10h00.
   ============================================================ */
import { preparePage, gotoApp, enterBoutique, assert } from '../helpers/harness.mjs';
import { makeDB, TENANT_ID } from '../helpers/fixtures.mjs';
const T = TENANT_ID;

function dbFete() {
  const d = makeDB();
  d.fete_events = [{ id: 'noel', tenant_id: T, label: '🎄 Noël', actif: true, date_debut: '2026-07-20', date_fin: '2026-07-31', butoir: null }];
  d.fete_products = [
    { id: 101, event_id: 'noel', groupe: 'BÛCHES PÂTISSIÈRES', nom: 'Bûche Tourangelle', taille: 'Grande', prix: 35, prod_site: 'veigne', product_id: null, ordre: 10, actif: true },
    { id: 102, event_id: 'noel', groupe: 'PAINS DE NOËL', nom: 'Grande tourte de meule', taille: '', prix: 6.8, prod_site: 'local', product_id: null, ordre: 20, actif: true },
    { id: 103, event_id: 'noel', groupe: 'PAINS DE NOËL', nom: 'Pain aux noix', taille: '', prix: 3.8, prod_site: 'local', product_id: null, ordre: 30, actif: true },
  ];
  d.fete_orders = [];
  return d;
}
async function formulaire(ctx, site, d, vue) {
  const page = await preparePage(ctx, { db: d || makeDB() });
  await gotoApp(page); await enterBoutique(page, site);
  await page.evaluate(async (v) => { await setVue(v); openNewSpecialOrder(); }, vue || 'specials');
  return page;
}
const barre = (page) => page.evaluate(() => {
  const b = document.querySelector('.sp-bar');
  return b ? { t: b.querySelector('.sp-bar-t b').textContent.trim(), sub: b.querySelector('.sp-bar-t small').textContent.trim(), off: b.querySelector('.btn-gold').disabled, sticky: getComputedStyle(b).position } : null;
});

export const tests = [
  {
    name: 'Barre fixe — « Créer » grisé sans produit, puis total et nombre d\'articles ; téléphone et « prise par » côte à côte',
    fn: async (ctx) => {
      const page = await formulaire(ctx, 'veigne');
      const vide = await barre(page);
      assert(vide && vide.off === true && vide.sticky === 'sticky' && vide.sub === 'aucun produit', 'barre vide : ' + JSON.stringify(vide));
      await page.evaluate(() => { specialSearchPick('vt_trad'); specialSearchPick('vt_trad'); specialSearchPick('pat_eclair'); });
      const b = await barre(page);
      assert(b.off === false && b.t === '3 articles', 'barre avec 3 articles sans prix : ' + JSON.stringify(b));
      const ordre = await page.evaluate(() => !!document.querySelector('#sp-client-tel').closest('.sp-form-row-double'));
      assert(ordre, 'téléphone dans une ligne double avec « prise par »');
      await page.close();
    },
  },
  {
    name: '€ prix à la main — 2 × 25 € = 50 € dans le total et la barre ; acompte 30 % ; enregistré sur la ligne et la commande ; ticket client',
    fn: async (ctx) => {
      const page = await formulaire(ctx, 'veigne');
      const r = await page.evaluate(async () => {
        specialSearchPick('pat_eclair'); specialItemQtyStep(0, 1);
        specialFormDraft.recherche = 'Pièce montée 30 pers.'; specialAddLibre();
        specialItemPrixOuvrir(1); document.getElementById('sp-px-in').value = '120'; specialItemSetPrix(1);
        specialItemPrixOuvrir(0); document.getElementById('sp-px-in').value = '25'; specialItemSetPrix(0);
        const calc = document.querySelector('.sp-line-calc').textContent;
        const total = document.querySelector('.sp-total-l').textContent.replace(/\s+/g, ' ').trim();
        setSpecialPaiement('acompte'); setSpecialAcompte(0.3);
        const reste = document.getElementById('sp-reste').textContent;
        Object.assign(specialFormDraft, { customer_name: 'M. Prix', customer_phone: '0600000000', pickup_date: '2026-07-25', pickup_time: '10:00' });
        renderSpecials();
        const bar = { t: document.querySelector('.sp-bar-t b').textContent, sub: document.querySelector('.sp-bar-t small').textContent };
        await upsertSpecialOrder();
        const o = window.__mockDB.special_orders.find((x) => x.customer_name === 'M. Prix');
        const its = window.__mockDB.special_order_items.filter((i) => i.order_id === o.id).sort((a, b) => a.position - b.position);
        const tk = document.createElement('div'); tk.innerHTML = ticketLabelHtml(Object.assign({}, o, { items: its }), 'special', 'client');
        return { calc, total, reste, bar, o: { total: o.total, acompte: o.acompte_montant, event_id: o.event_id }, prix: its.map((i) => i.unit_price), ticket: tk.textContent.replace(/\s+/g, ' ') };
      });
      assert(r.calc === '2 × 25,00 € = 50,00 €', 'calcul sur la ligne : ' + r.calc);
      assert(r.total === 'Total 170,00 €' || r.total === 'Total170,00 €', 'total : ' + r.total);
      assert(r.reste === 'reste 119,00 €', 'acompte 30 % = 51 €, reste 119 € : ' + r.reste);
      assert(/170,00/.test(r.bar.t) && /acompte 51,00 €/.test(r.bar.sub), 'barre : ' + JSON.stringify(r.bar));
      assert(r.o.total === 170 && r.o.acompte === 51 && r.o.event_id === null, 'commande : ' + JSON.stringify(r.o));
      assert(r.prix.join(',') === '25,120', 'prix sur les lignes : ' + r.prix.join(','));
      assert(/50,00 €/.test(r.ticket) && /120,00 €/.test(r.ticket) && /Total : 170,00 €/.test(r.ticket) && /Reste au retrait : 119,00 €/.test(r.ticket), 'ticket client : ' + r.ticket);
      await page.close();
    },
  },
  {
    name: 'Carte repliée — groupes fermés au départ, un appui ouvre, un groupe avec un produit reste ouvert, la loupe ouvre ce qui correspond',
    fn: async (ctx) => {
      const page = await formulaire(ctx, 'saint-avertin', dbFete(), 'fetes');
      const r = await page.evaluate(() => {
        const ouverts = () => Array.from(document.querySelectorAll('#sp-carte .sp-carte-grp')).map((g) => g.classList.contains('open') ? 'O' : 'f').join('');
        const visibles = () => Array.from(document.querySelectorAll('#sp-carte .sp-carte-row')).filter((x) => x.offsetParent !== null).map((x) => x.querySelector('.nom').textContent.trim());
        const depart = ouverts();
        speCarteGroupe(1); const apresAppui = ouverts();
        speCarteGroupe(1); const referme = ouverts();
        speCarteChg('101', 1); const avecBuche = ouverts();
        speCarteGroupe(0); const resteOuvert = ouverts();
        speCarteFiltre('noix'); const loupe = visibles();
        return { depart, apresAppui, referme, avecBuche, resteOuvert, loupe, pris: document.querySelector('.sp-carte-gh .pris').textContent };
      });
      assert(r.depart === 'ff', 'tout fermé au départ : ' + r.depart);
      assert(r.apresAppui === 'fO' && r.referme === 'ff', 'un appui ouvre / referme : ' + r.apresAppui + ' ' + r.referme);
      assert(r.avecBuche === 'Of' && r.resteOuvert === 'Of' && r.pris === '1 pris', 'groupe avec un produit ouvert, « 1 pris » : ' + JSON.stringify(r));
      assert(r.loupe.join('|') === 'Pain aux noix🔪', 'la loupe ouvre le bon groupe : ' + r.loupe.join('|'));
      await page.close();
    },
  },
  {
    name: 'Catégorie — un appui liste ses produits, plusieurs ajouts d\'affilée ; « ✏️ Autre » ajoute un texte libre avec l\'avertissement',
    fn: async (ctx) => {
      const page = await formulaire(ctx, 'veigne');
      const r = await page.evaluate(() => {
        specialPickCat('pains');
        const hits = Array.from(document.querySelectorAll('#sp-psearch-res .sp-psearch-hit')).map((b) => b.textContent.replace(/^\+\s*/, '').trim());
        specialSearchPick('vt_trad'); specialSearchPick('vt_fou');
        const encore = document.querySelectorAll('#sp-psearch-res .sp-psearch-hit').length;
        handleSpecialItemSearch('number cake'); specialFormDraft.recherche = 'Number cake 12 pers.'; specialAddLibre();
        return { hits, encore, lignes: specialFormDraft.items.map((i) => i.product_id || i.product_name_custom), warn: !!document.querySelector('.sp-libre-warn'),
          couteau: Array.from(document.querySelectorAll('.sp-item-row')).map((x) => !!x.querySelector('.sp-carte-tr')).join(',') };
      });
      assert(r.hits.indexOf('Tradition') !== -1 && r.hits.indexOf('Croissant') === -1, 'catégorie Pains : ' + r.hits.join('|'));
      assert(r.encore > 0, 'la catégorie reste ouverte pour enchaîner');
      assert(r.lignes.join('|') === 'vt_trad|vt_fou|Number cake 12 pers.' && r.warn, 'lignes + avertissement texte libre : ' + JSON.stringify(r));
      assert(r.couteau === 'true,true,false', '🔪 sur les pains seulement : ' + r.couteau);
      await page.close();
    },
  },
  {
    name: 'v20.330 — texte libre : le message nomme le vrai atelier (St-Avertin + bûche → Veigné ; sinon reste à la boutique)',
    fn: async (ctx) => {
      const page = await formulaire(ctx, 'saint-avertin', dbFete(), 'fetes');
      const r = await page.evaluate(() => {
        const warn = () => document.querySelector('.sp-item-row .sp-libre-warn').textContent.replace(/\s+/g, ' ').trim();
        specialFormDraft.recherche = 'Pièce montée 30 pers.'; specialAddLibre();
        const seul = warn();
        speCarteChg('101', 1);
        return { seul, avecBuche: warn() };
      });
      assert(/restera sur cette commande, à St-Avertin/.test(r.seul), 'seul : ' + r.seul);
      assert(/partira à Veigné, l'atelier principal/.test(r.avecBuche), 'avec une bûche : ' + r.avecBuche);
      await page.close();
    },
  },
  {
    name: 'v20.331 — le surgelé (pros) sort des catégories et de la recherche, rangé dans « 🧊 Pros » en dernier ; une catégorie 100 % surgelée disparaît',
    fn: async (ctx) => {
      const d = makeDB();
      const base = d.products.find((p) => p.id === 'vt_trad');
      d.products.push(Object.assign({}, base, { id: 'trad_surg', name: 'Tradition précuite surgelée', usage: 'reappro' }));
      d.products.push(Object.assign({}, base, { id: 'tarte_surg', name: 'Tarte aux pommes 6 pers. crue surgelée', category: 'traiteur', usage: 'reappro' }));
      const page = await formulaire(ctx, 'veigne', d);
      const r = await page.evaluate(() => {
        const hits = () => Array.from(document.querySelectorAll('#sp-psearch-res .sp-psearch-hit:not(.sp-psearch-libre)')).map((b) => b.childNodes[0].textContent.replace(/^\+\s*/, '').trim());
        const chips = Array.from(document.querySelectorAll('.sp-pcat')).map((b) => b.textContent.trim());
        specialPickCat('pains'); const pains = hits();
        handleSpecialItemSearch('tradition'); const recherche = hits();
        specialPickCat('__pros'); const pros = hits();
        specialSearchPick('trad_surg');
        return { chips, pains, recherche, pros, ligne: specialFormDraft.items.map((i) => i.product_id).join(',') };
      });
      assert(r.chips[r.chips.length - 1] === '🧊 Pros (surgelé)' && r.chips.indexOf('Traiteur') === -1, 'puces : « Pros » en dernier, Traiteur (100 % surgelé ici) caché : ' + r.chips.join('|'));
      assert(r.pains.indexOf('Tradition') !== -1 && !r.pains.some((x) => /surgel/i.test(x)), 'Pains sans surgelé : ' + r.pains.join('|'));
      assert(!r.recherche.some((x) => /surgel/i.test(x)), 'recherche sans surgelé : ' + r.recherche.join('|'));
      assert(r.pros.join('|') === 'Tarte aux pommes 6 pers. crue surgelée|Tradition précuite surgelée', '« Pros » = tout le surgelé : ' + r.pros.join('|'));
      assert(r.ligne === 'trad_surg', 'toujours commandable depuis « Pros » : ' + r.ligne);
      await page.close();
    },
  },
];
