/* ============================================================
   FIXTURES — jeu de données de test Les Blés de Demain
   Données factices mais réalistes, injectées dans la base
   en mémoire du mock Supabase avant chaque test.
   ============================================================ */

export const TENANT_ID = '00000000-0000-0000-0000-000000000001';

// La date "aujourd'hui" simulée pendant les tests (un mercredi, 10h00)
export const TEST_TODAY = '2026-07-22';
export const TEST_YESTERDAY = '2026-07-21';
export const TEST_NOW_MS = new Date('2026-07-22T10:00:00').getTime();

function prod(id, name, category, extra = {}) {
  return {
    id,
    tenant_id: TENANT_ID,
    name,
    category,
    actif: true,
    pros_only_id: null,
    supply_by_boutique: null,
    pces_per_caisse: null,
    seuil_stock: null,
    usage: 'both',
    ...extra,
  };
}

export const PRODUCTS = [
  // Pains — sur place à Veigné et Tours, livrés par Le Local à St-Avertin
  prod('vt_trad', 'Tradition', 'pains', {
    supply_by_boutique: JSON.stringify({ veigne: 'on_site', tours: 'on_site', 'saint-avertin': 'local' }),
  }),
  prod('vt_trad_gr', 'Tradition Graines', 'pains', {
    supply_by_boutique: JSON.stringify({ veigne: 'on_site', tours: 'on_site', 'saint-avertin': 'local' }),
  }),
  prod('vt_epeautre', 'Baguette Épeautre', 'pains', {
    supply_by_boutique: JSON.stringify({ veigne: 'on_site', tours: 'on_site', 'saint-avertin': 'local' }),
  }),
  prod('vt_fou', 'Fougasse', 'pains', {
    supply_by_boutique: JSON.stringify({ veigne: 'on_site', tours: 'none', 'saint-avertin': 'none' }),
  }),
  // Viennoiserie — livrée partout par Le Local, avec quantités par caisse
  prod('vp_croissant', 'Croissant', 'viennoiserie', {
    supply_by_boutique: JSON.stringify({ veigne: 'local', tours: 'local', 'saint-avertin': 'local' }),
    pces_per_caisse: 70,
    seuil_stock: 140,
  }),
  prod('vp_painchoc', 'Pain Chocolat', 'viennoiserie', {
    supply_by_boutique: JSON.stringify({ veigne: 'local', tours: 'local', 'saint-avertin': 'local' }),
    pces_per_caisse: 130,
    seuil_stock: 260,
  }),
  // Brioches
  prod('br_nanterre', 'Brioche Nanterre', 'brioches_special', {
    supply_by_boutique: JSON.stringify({ veigne: 'local', tours: 'local', 'saint-avertin': 'local' }),
    pces_per_caisse: 20,
    seuil_stock: 10,
  }),
  // Pâtisserie faite à Veigné, livrée à Tours
  prod('pat_eclair', 'Éclair Chocolat', 'patisserie_petits', {
    supply_by_boutique: JSON.stringify({ veigne: 'on_site', tours: 'veigne', 'saint-avertin': 'veigne' }),
  }),
];

export const CATEGORY_SETTINGS = [
  { tenant_id: TENANT_ID, category: 'pains', a_previs: true },
  { tenant_id: TENANT_ID, category: 'viennoiserie', a_previs: false },
  { tenant_id: TENANT_ID, category: 'brioches_special', a_previs: false },
  { tenant_id: TENANT_ID, category: 'patisserie_petits', a_previs: true },
];

// Prévisions d'HIER (J-1) pour Veigné — servent au pré-remplissage des ventes
export const PREVIS = [
  { tenant_id: TENANT_ID, boutique_id: 'veigne', product_id: 'vt_trad', service_date: TEST_YESTERDAY, qty: 60 },
  { tenant_id: TENANT_ID, boutique_id: 'veigne', product_id: 'vt_fou', service_date: TEST_YESTERDAY, qty: 12 },
];

// Ventes d'HIER avec des restes J1
export const SALES_YESTERDAY = [
  {
    tenant_id: TENANT_ID, boutique_id: 'veigne', product_id: 'vt_trad',
    date: TEST_YESTERDAY, matin: 60, aprem: null, reste_j1: 10, reste_j2: null, perte: null,
  },
  {
    tenant_id: TENANT_ID, boutique_id: 'veigne', product_id: 'vt_fou',
    date: TEST_YESTERDAY, matin: 12, aprem: null, reste_j1: 15, reste_j2: null, perte: null,
  },
];

// Réappro d'hier envoyée (pour le pré-remplissage des produits livrés)
export const REAPPROS = [
  {
    id: 'rp_1', tenant_id: TENANT_ID, boutique_id: 'veigne', product_id: 'vp_croissant',
    service_date: TEST_YESTERDAY, commander: 140, sent_at: TEST_YESTERDAY + 'T06:00:00',
    qty_livree: null, livre_at: null,
  },
];

// Codes d'accès boutiques : AUCUN code configuré (pas de barrière à l'entrée),
// le PIN BackOffice reste le PIN codé en dur de l'app.
export const BOUTIQUE_CODES = [];

export const PRODUCTION_DEFAULTS = [
  // Mercredi = day_of_week 3
  { tenant_id: TENANT_ID, boutique_id: 'veigne', product_id: 'vt_trad', day_of_week: 3, default_qty: 55 },
];

/** Base complète prête à injecter dans window.__mockDB */
export function makeDB() {
  return {
    products: structuredClone(PRODUCTS),
    category_settings: structuredClone(CATEGORY_SETTINGS),
    previs: structuredClone(PREVIS),
    sales: structuredClone(SALES_YESTERDAY),
    reappros: structuredClone(REAPPROS),
    boutique_codes: structuredClone(BOUTIQUE_CODES),
    production_defaults: structuredClone(PRODUCTION_DEFAULTS),
    special_orders: [],
    special_order_items: [],
    deliveries: [],
    veigne_pat_stock: [],
    production_local: [],
    market_entries: [],
    market_day_notes: [],
    pros: [],
    pro_orders: [],
    pro_order_items: [],
    pro_stock: [],
    pro_stock_movements: [],
    stock_inventory: [],
    stock_receipts: [],
    stock_entries: [],
    tourier_stock: [],
    livreur_messages: [],
  };
}
