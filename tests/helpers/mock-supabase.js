/* ============================================================
   MOCK SUPABASE — Les Blés de Demain
   Remplace le vrai SDK supabase-js pendant les tests.
   Base de données EN MÉMOIRE : aucune requête ne part vers
   la vraie base Supabase de production.
   Servi à la place de https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2
   ============================================================ */
(function () {
  'use strict';

  // Base en mémoire : { nomTable: [lignes...] }
  const DB = (window.__mockDB = window.__mockDB || {});
  // Journal des écritures pour les assertions de test
  const LOG = (window.__mockLog = []);
  let idCounter = 1000;

  function tableRows(name) {
    if (!DB[name]) DB[name] = [];
    return DB[name];
  }

  function clone(x) {
    return JSON.parse(JSON.stringify(x === undefined ? null : x));
  }

  function matches(row, filters) {
    return filters.every(function (f) {
      const v = row[f.col];
      switch (f.op) {
        case 'eq':  return String(v) === String(f.val);
        case 'neq': return String(v) !== String(f.val);
        case 'is':  return f.val === null ? (v === null || v === undefined) : v === f.val;
        case 'in':  return f.val.map(String).indexOf(String(v)) !== -1;
        case 'gte': return v >= f.val;
        case 'lte': return v <= f.val;
        case 'gt':  return v > f.val;
        case 'lt':  return v < f.val;
        case 'not': // .not('col','is',null) → v n'est PAS null
          if (f.innerOp === 'is' && f.val === null) return v !== null && v !== undefined;
          return !matches(row, [{ col: f.col, op: f.innerOp, val: f.val }]);
        case 'contains':
          try {
            const arr = Array.isArray(v) ? v : JSON.parse(v || '[]');
            const want = Array.isArray(f.val) ? f.val : [f.val];
            return want.every(function (w) { return arr.indexOf(w) !== -1; });
          } catch (e) { return false; }
        case 'or':
          // 'a.eq.x,b.eq.y'
          return f.val.split(',').some(function (part) {
            const bits = part.split('.');
            const col = bits[0], op = bits[1], val = bits.slice(2).join('.');
            return matches(row, [{ col: col, op: op, val: val }]);
          });
        default: return true;
      }
    });
  }

  function applyOrder(rows, orders) {
    if (!orders.length) return rows;
    return rows.slice().sort(function (a, b) {
      for (let i = 0; i < orders.length; i++) {
        const o = orders[i];
        const av = a[o.col], bv = b[o.col];
        if (av == null && bv == null) continue;
        if (av == null) return o.asc ? -1 : 1;
        if (bv == null) return o.asc ? 1 : -1;
        if (av < bv) return o.asc ? -1 : 1;
        if (av > bv) return o.asc ? 1 : -1;
      }
      return 0;
    });
  }

  function Builder(table) {
    this.table = table;
    this.action = 'select';
    this.payload = null;
    this.filters = [];
    this.orders = [];
    this.limitN = null;
    this.singleMode = null; // 'single' | 'maybeSingle'
    this.selectAfterWrite = false;
    this.upsertConflict = null;
  }

  const proto = Builder.prototype;

  proto.select = function (cols) {
    const self = this;
    if (this.action === 'select') {
      // colonnes ignorées, on renvoie tout — sauf les jointures « table(*) » (v20.257 :
      // `pro_orders.select('*, pro_order_items(*)')`) : les lignes filles sont attachées.
      this.embeds = [];
      String(cols || '').replace(/([a-z_]+)\(\*\)/g, function (_, t) { self.embeds.push(t); return ''; });
    }
    else this.selectAfterWrite = true;
    return this;
  };
  proto.insert = function (rows) { this.action = 'insert'; this.payload = rows; return this; };
  proto.update = function (patch) { this.action = 'update'; this.payload = patch; return this; };
  proto.upsert = function (rows, opts) {
    this.action = 'upsert'; this.payload = rows;
    this.upsertConflict = (opts && opts.onConflict) || 'id';
    return this;
  };
  proto.delete = function () { this.action = 'delete'; return this; };

  ['eq', 'neq', 'gte', 'lte', 'gt', 'lt'].forEach(function (op) {
    proto[op] = function (col, val) { this.filters.push({ col: col, op: op, val: val }); return this; };
  });
  proto.is = function (col, val) { this.filters.push({ col: col, op: 'is', val: val }); return this; };
  proto.in = function (col, arr) { this.filters.push({ col: col, op: 'in', val: arr || [] }); return this; };
  proto.not = function (col, innerOp, val) {
    this.filters.push({ col: col, op: 'not', innerOp: innerOp, val: val }); return this;
  };
  proto.or = function (expr) { this.filters.push({ col: null, op: 'or', val: expr }); return this; };
  proto.contains = function (col, val) { this.filters.push({ col: col, op: 'contains', val: val }); return this; };
  proto.order = function (col, opts) {
    this.orders.push({ col: col, asc: !opts || opts.ascending !== false }); return this;
  };
  proto.limit = function (n) { this.limitN = n; return this; };
  proto.range = function (a, b) { this.rangeAB = [a, b]; return this; };   // v20.264 — pagination 1000 lignes
  proto.single = function () { this.singleMode = 'single'; return this; };
  proto.maybeSingle = function () { this.singleMode = 'maybeSingle'; return this; };

  // v20.289 — verrou simulé : sans session, la clé publique n'a plus accès aux tables (comme après migration 289b)
  proto._run = function () {
    if (window.__mockStrict && !AUTH.session) {
      return { data: null, error: { code: '42501', message: 'permission denied for table ' + this.table } };
    }
    const rows = tableRows(this.table);
    let result = [];
    const self = this;

    if (this.action === 'select') {
      result = applyOrder(rows.filter(function (r) { return matches(r, self.filters); }), this.orders);
      if (this.limitN != null) result = result.slice(0, this.limitN);
      if (this.rangeAB) result = result.slice(this.rangeAB[0], this.rangeAB[1] + 1);
      (this.embeds || []).forEach(function (t) {
        const sing = self.table.replace(/s$/, '');
        // pro_orders → pro_order_id ; fab_recettes → recette_id (v20.268 : préfixe de module ignoré)
        const cands = [sing + '_id', sing.replace(/^[a-z]+_/, '') + '_id'];
        const rows0 = tableRows(t);
        const fk = cands.find(function (k) { return rows0.some(function (c) { return k in c; }); }) || cands[0];
        result = result.map(function (r) {
          const copy = clone(r);
          copy[t] = tableRows(t).filter(function (c) { return String(c[fk]) === String(r.id); }).map(clone);
          return copy;
        });
      });
    } else if (this.action === 'insert') {
      const list = Array.isArray(this.payload) ? this.payload : [this.payload];
      list.forEach(function (r) {
        const row = clone(r);
        if (row.id === undefined) row.id = 'mock_' + (++idCounter);
        rows.push(row);
        result.push(row);
      });
      LOG.push({ table: this.table, action: 'insert', rows: clone(list) });
    } else if (this.action === 'update') {
      rows.forEach(function (r) {
        if (matches(r, self.filters)) { Object.assign(r, clone(self.payload)); result.push(r); }
      });
      LOG.push({ table: this.table, action: 'update', patch: clone(this.payload), filters: clone(this.filters) });
    } else if (this.action === 'upsert') {
      const list = Array.isArray(this.payload) ? this.payload : [this.payload];
      const keys = this.upsertConflict.split(',').map(function (s) { return s.trim(); });
      list.forEach(function (r) {
        const row = clone(r);
        const existing = rows.find(function (x) {
          return keys.every(function (k) { return String(x[k]) === String(row[k]); });
        });
        if (existing) { Object.assign(existing, row); result.push(existing); }
        else {
          if (row.id === undefined) row.id = 'mock_' + (++idCounter);
          rows.push(row); result.push(row);
        }
      });
      LOG.push({ table: this.table, action: 'upsert', rows: clone(list) });
    } else if (this.action === 'delete') {
      for (let i = rows.length - 1; i >= 0; i--) {
        if (matches(rows[i], self.filters)) result.push(rows.splice(i, 1)[0]);
      }
      LOG.push({ table: this.table, action: 'delete', filters: clone(this.filters) });
    }

    let data = clone(result);
    if (this.singleMode === 'single') {
      if (data.length !== 1) return { data: null, error: { message: 'single() : ' + data.length + ' lignes' } };
      data = data[0];
    } else if (this.singleMode === 'maybeSingle') {
      data = data.length ? data[0] : null;
    }
    return { data: data, error: null };
  };

  // Thenable : `await builder` fonctionne comme avec le vrai SDK
  proto.then = function (onOk, onErr) {
    const self = this;
    return Promise.resolve().then(function () { return self._run(); }).then(onOk, onErr);
  };

  function MockChannel(name) {
    this.name = name;
    this._handlers = [];
  }
  MockChannel.prototype.on = function (type, filter, cb) {
    this._handlers.push({ type: type, filter: filter, cb: cb });
    return this;
  };
  MockChannel.prototype.subscribe = function (cb) {
    if (cb) { try { cb('SUBSCRIBED'); } catch (e) {} }
    (window.__mockChannels = window.__mockChannels || []).push(this);
    return this;
  };
  MockChannel.prototype.unsubscribe = function () { return Promise.resolve('ok'); };
  // Pour simuler un événement realtime depuis un test :
  MockChannel.prototype._emit = function (payload) {
    this._handlers.forEach(function (h) { try { h.cb(payload); } catch (e) {} });
  };

  // ===== v20.289 — connexion équipe simulée : compte <boutique>@lbdd.app, mot de passe = le code (table boutique_codes) =====
  const AUTH = (window.__mockAuth = window.__mockAuth || { session: null });
  function authEmail(b) { return String(b || '').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '@lbdd.app'; }
  const auth = {
    getSession: function () { return Promise.resolve({ data: { session: AUTH.session }, error: null }); },
    signInWithPassword: function (c) {
      const row = tableRows('boutique_codes').find(function (r) { return authEmail(r.boutique_id) === c.email && String(r.code).trim() === String(c.password).trim(); });
      if (!row) return Promise.resolve({ data: { session: null, user: null }, error: { message: 'Invalid login credentials' } });
      AUTH.session = { user: { email: c.email }, access_token: 'mock_' + row.boutique_id };
      LOG.push({ table: 'auth', action: 'signIn', boutique: row.boutique_id });
      return Promise.resolve({ data: { session: AUTH.session, user: AUTH.session.user }, error: null });
    },
    signOut: function () { AUTH.session = null; return Promise.resolve({ error: null }); },
    onAuthStateChange: function () { return { data: { subscription: { unsubscribe: function () {} } } }; }
  };

  // ===== v20.289 — fonctions de la page client (pro_page_*), mêmes règles que le SQL : seulement le lien présenté =====
  function proEtabs(token) {
    const pros = tableRows('pros');
    const moi = pros.find(function (p) { return p.magic_token && p.magic_token === token && p.actif; });
    if (!moi) return [];
    return pros.filter(function (p) { return p.id === moi.id || (moi.groupe && p.groupe === moi.groupe && p.actif); })
      .sort(function (a, b) { return (b.magic_token === token) - (a.magic_token === token) || String(a.nom).localeCompare(String(b.nom)); });
  }
  function sansSecret(p) { const c = clone(p); delete c.magic_token; delete c.magic_sent_at; return c; }
  function ordersOf(token, from, to) {
    const ids = proEtabs(token).map(function (p) { return p.id; });
    return tableRows('pro_orders').filter(function (o) { return ids.indexOf(o.pro_id) !== -1 && o.date_livraison >= from && o.date_livraison <= to && o.statut !== 'annule'; })
      .sort(function (a, b) { return String(a.date_livraison).localeCompare(String(b.date_livraison)); })
      .map(function (o) { const c = clone(o); c.pro_order_items = tableRows('pro_order_items').filter(function (i) { return String(i.pro_order_id) === String(o.id); }).map(clone); return c; });
  }
  const RPC = {
    pro_page_bootstrap: function (a) {
      const any = tableRows('pros').find(function (p) { return p.magic_token && p.magic_token === a.p_token; });
      if (!any) return null;
      const etabs = proEtabs(a.p_token);
      if (!etabs.length) return { inactif: true };
      return { etabs: etabs.map(sansSecret), products: tableRows('products').filter(function (p) { return p.actif; }).map(clone),
        jours_off: tableRows('fab_jours_off').map(function (j) { return { site: j.site, jours: j.jours }; }) };
    },
    pro_page_orders: function (a) { return ordersOf(a.p_token, a.p_from, a.p_to); },
    pro_page_upsert_order: function (a) {
      const pro = proEtabs(a.p_token).find(function (p) { return p.id === a.p_row.pro_id; });
      if (!pro) throw new Error('lien invalide pour cet établissement');
      let id;
      if (a.p_order_id) {
        const o = tableRows('pro_orders').find(function (x) { return String(x.id) === String(a.p_order_id) && x.pro_id === pro.id; });
        if (!o) throw new Error('commande introuvable');
        Object.assign(o, { date_livraison: a.p_row.date_livraison, boutique_source: a.p_row.boutique_source, statut: a.p_row.statut || 'confirme', notes: a.p_row.notes || null, created_by: a.p_row.created_by || null });
        id = o.id;
        const items = tableRows('pro_order_items');
        for (let i = items.length - 1; i >= 0; i--) if (String(items[i].pro_order_id) === String(id)) items.splice(i, 1);
      } else {
        id = 'mock_' + (++idCounter);
        tableRows('pro_orders').push({ id: id, tenant_id: pro.tenant_id, pro_id: pro.id, date_livraison: a.p_row.date_livraison, boutique_source: a.p_row.boutique_source, statut: a.p_row.statut || 'confirme', notes: a.p_row.notes || null, created_by: a.p_row.created_by || null });
      }
      (a.p_items || []).forEach(function (it) { tableRows('pro_order_items').push({ id: 'mock_' + (++idCounter), pro_order_id: id, product_id: it.product_id, qty: Number(it.qty), prix_applique: it.prix_applique == null ? null : Number(it.prix_applique) }); });
      LOG.push({ table: 'pro_orders', action: 'rpc_upsert', id: id });
      return { id: id };
    },
    pro_page_cancel: function (a) {
      const ids = proEtabs(a.p_token).map(function (p) { return p.id; });
      let n = 0;
      tableRows('pro_orders').forEach(function (o) {
        if ((a.p_ids || []).map(String).indexOf(String(o.id)) === -1 || ids.indexOf(o.pro_id) === -1) return;
        if (a.p_delete_items) { const items = tableRows('pro_order_items'); for (let i = items.length - 1; i >= 0; i--) if (String(items[i].pro_order_id) === String(o.id)) items.splice(i, 1); }
        o.statut = 'annule'; n++;
      });
      return n;
    },
    pro_page_set_contacts: function (a) {
      const p = proEtabs(a.p_token).find(function (x) { return x.id === a.p_etab; });
      if (!p) return false;
      const row = tableRows('pros').find(function (x) { return x.id === p.id; });
      row.contacts = clone(a.p_contacts || []);
      return true;
    }
  };
  function rpc(name, args) {
    const run = function () {
      if (!RPC[name]) return { data: null, error: { message: 'function ' + name + ' does not exist' } };
      try { return { data: clone(RPC[name](args || {})), error: null }; }
      catch (e) { return { data: null, error: { message: e.message } }; }
    };
    return { then: function (ok, ko) { return Promise.resolve().then(run).then(ok, ko); } };
  }

  window.supabase = {
    createClient: function () {
      return {
        from: function (table) { return new Builder(table); },
        rpc: rpc,
        auth: auth,
        channel: function (name) { return new MockChannel(name); },
        removeChannel: function (ch) { if (ch && ch.unsubscribe) ch.unsubscribe(); return Promise.resolve('ok'); }
      };
    }
  };
})();
