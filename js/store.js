// ── R-Tracker v2 — RTStore ────────────────────────────────────────────────────
// The only persistence layer in the app. Holds one in-memory state object (shape
// defined in js/schema.js) and mirrors it to a backend on every update().
//
//   RT_STORAGE_BACKEND  'memory'  → nothing survives a reload (Phase 1)
//                       'session' → sessionStorage key "rt-state", tab-scoped (Phase 2)
//   window.__RT_BACKEND  test hook: if set before this script runs it wins.
//
// Rules for callers:
//   • read with RTStore.get(); write with RTStore.update(function (s) { … })
//   • update functions must be trivial (assignments only) — there is no rollback
//   • timestamps are epoch milliseconds
//
// Loaded non-deferred in <head> right after js/schema.js; auto-loads state at
// the end of this file so every later script can call RTStore.get() synchronously.
// Exposes: window.RTStore, window.RT_STORAGE_BACKEND

(function () {
  'use strict';

  var STORAGE_KEY = 'rt-state';

  if (typeof window.RT_STORAGE_BACKEND !== 'string') window.RT_STORAGE_BACKEND = 'memory';

  // ── Backends ──────────────────────────────────────────────────────────────
  function MemoryBackend() {
    var text = null;
    return {
      name: 'memory',
      read: function () { return text; },
      write: function (t) { text = t; },
      clear: function () { text = null; }
    };
  }

  function pickBackend() {
    var wanted = typeof window.__RT_BACKEND === 'string' ? window.__RT_BACKEND : window.RT_STORAGE_BACKEND;
    if (wanted === 'session' && typeof window.RTSessionStorageBackend === 'function') {
      try { return window.RTSessionStorageBackend(STORAGE_KEY); } catch (e) { console.warn('[RTStore] sessionStorage unavailable, using memory:', e && e.message); }
    }
    return MemoryBackend();
  }

  // ── State ─────────────────────────────────────────────────────────────────
  var state = null;
  var backend = null;
  var listeners = [];
  var lastSaveError = null;

  function notify(source) {
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](state, { source: source }); } catch (e) { console.error('[RTStore] listener failed:', e); }
    }
  }

  function save() {
    if (!state) return false;
    try {
      backend.write(JSON.stringify(state));
      lastSaveError = null;
      return true;
    } catch (e) {
      lastSaveError = (e && (e.name === 'QuotaExceededError' || e.code === 22)) ? 'quota' : 'write';
      console.warn('[RTStore] save failed (' + lastSaveError + '):', e && e.message);
      return false;
    }
  }

  function load() {
    if (state) return state;
    backend = pickBackend();
    var raw = null;
    try { raw = backend.read(); } catch (e) { console.warn('[RTStore] read failed:', e && e.message); }
    if (raw) {
      try {
        state = window.RTSchema.migrate(JSON.parse(raw));
      } catch (e) {
        console.warn('[RTStore] stored state unreadable, starting fresh:', e && e.message);
        state = null;
      }
    }
    if (!state) state = window.RTSchema.createEmptyState();
    notify('load');
    return state;
  }

  function get() { return state || load(); }

  function update(fn, opts) {
    var s = get();
    fn(s);
    s.meta.updatedAt = Date.now();
    if (!(opts && opts.silent)) s.meta.dirtySinceExport = true;
    save();
    notify('update');
    return s;
  }

  function set(path, value, opts) {
    return update(function (s) {
      var parts = String(path).split('.');
      var cur = s;
      for (var i = 0; i < parts.length - 1; i++) {
        if (cur[parts[i]] === undefined || cur[parts[i]] === null || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
        cur = cur[parts[i]];
      }
      cur[parts[parts.length - 1]] = value;
    }, opts);
  }

  function clear() {
    get();
    try { backend.clear(); } catch (e) { /* ignore */ }
    state = window.RTSchema.createEmptyState();
    save();
    notify('clear');
  }

  function exportJSON() {
    update(function (s) {
      s.meta.lastExportedAt = Date.now();
      s.meta.dirtySinceExport = false;
      s.meta.appVersion = window.RTSchema.APP_VERSION;
    }, { silent: true });
    return JSON.stringify(state, null, 2);
  }

  function importJSON(text) {
    var parsed;
    try { parsed = JSON.parse(text); } catch (e) { return { ok: false, error: 'That file is not valid JSON.' }; }
    var v = window.RTSchema.validateImport(parsed, typeof text === 'string' ? text.length : undefined);
    if (!v.ok) return { ok: false, error: v.errors.slice(0, 3).join(' '), errors: v.errors, warnings: v.warnings };
    var migrated;
    try { migrated = window.RTSchema.migrate(parsed); } catch (e) { return { ok: false, error: e.message }; }
    get();
    state = migrated;
    state.meta.dirtySinceExport = false;
    save();
    notify('import');
    return { ok: true, state: state, warnings: v.warnings };
  }

  function onChange(cb) {
    listeners.push(cb);
    return function () {
      var i = listeners.indexOf(cb);
      if (i !== -1) listeners.splice(i, 1);
    };
  }

  function logAttempt(evt) {
    return update(function (s) {
      var e = {
        ts: evt.ts || Date.now(),
        phaseId: evt.phaseId || null,
        sectionId: evt.sectionId || null,
        kind: evt.kind,
        graded: evt.graded === true,
        correct: evt.graded === true ? evt.correct === true : null,
        score: typeof evt.score === 'number' ? evt.score : null,
        attempt: typeof evt.attempt === 'number' ? evt.attempt : null
      };
      s.curriculum.attempts.push(e);
      var cap = window.RTSchema.LIMITS.attempts;
      if (s.curriculum.attempts.length > cap) s.curriculum.attempts.splice(0, s.curriculum.attempts.length - cap);
    });
  }

  // Get-or-create a curriculum phase entry (phases are stored sparsely).
  function phase(phaseId) {
    var s = get();
    if (!s.curriculum.phases[phaseId]) s.curriculum.phases[phaseId] = window.RTSchema.createEmptyPhase(phaseId);
    return s.curriculum.phases[phaseId];
  }

  window.RTStore = {
    load: load,
    get: get,
    update: update,
    set: set,
    save: save,
    clear: clear,
    exportJSON: exportJSON,
    importJSON: importJSON,
    onChange: onChange,
    logAttempt: logAttempt,
    phase: phase,
    isDirty: function () { return !!get().meta.dirtySinceExport; },
    backendName: function () { get(); return backend.name; },
    get lastSaveError() { return lastSaveError; },
    ready: false
  };

  load();
  window.RTStore.ready = true;
})();
