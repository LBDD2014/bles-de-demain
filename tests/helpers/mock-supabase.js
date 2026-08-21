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

  proto.select = function () {
    if (this.action === 'select') { /* colonnes ignorées, on renvoie tout */ }
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
  proto.single = function () { this.singleMode = 'single'; return this; };
  proto.maybeSingle = function () { this.singleMode = 'maybeSingle'; return this; };

  proto._run = function () {
    const rows = tableRows(this.table);
    let result = [];
    const self = this;

    if (this.action === 'select') {
      result = applyOrder(rows.filter(function (r) { return matches(r, self.filters); }), this.orders);
      if (this.limitN != null) result = result.slice(0, this.limitN);
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

  window.supabase = {
    createClient: function () {
      return {
        from: function (table) { return new Builder(table); },
        channel: function (name) { return new MockChannel(name); },
        removeChannel: function (ch) { if (ch && ch.unsubscribe) ch.unsubscribe(); return Promise.resolve('ok'); }
      };
    }
  };
})();
