// ── R-Tracker v2 — Bayesian Knowledge Tracing (client-side) ──────────────────
// Turns the correct/incorrect stream in curriculum.attempts into a mastery
// estimate per module (a lesson section with a check, the Phase 0 quiz, or a
// phase's code deliverable). Phase mastery = mean over the phase's modules,
// with unobserved modules counted at the prior (honest: untouched = unknown).
//
// Parameters live in js/curriculum/lessons.js (window.BKT_PARAMS) so they can be
// tuned without touching this file. Only attempts with graded === true count.
//
// Exposes: window.RTBkt = { DEFAULTS, update, run, params, modules, compute, recompute }

(function () {
  'use strict';

  var DEFAULTS = { prior: 0.30, learn: 0.20, guess: 0.25, slip: 0.10 };
  var VERSION = 'bkt-1';

  // One BKT step: posterior given the observation, then the learning transition.
  function update(pL, correct, p) {
    var post;
    if (correct) {
      post = (pL * (1 - p.slip)) / (pL * (1 - p.slip) + (1 - pL) * p.guess);
    } else {
      post = (pL * p.slip) / (pL * p.slip + (1 - pL) * (1 - p.guess));
    }
    if (!isFinite(post)) post = pL;
    return post + (1 - post) * p.learn;
  }

  function run(observations, p) {
    var pL = p.prior;
    for (var i = 0; i < observations.length; i++) pL = update(pL, !!observations[i], p);
    return pL;
  }

  function params(phaseId) {
    var cfg = window.BKT_PARAMS || {};
    var base = Object.assign({}, DEFAULTS, cfg.defaults || {});
    var over = (cfg.phases && cfg.phases[phaseId]) || {};
    return Object.assign(base, over);
  }

  function version() {
    var cfg = window.BKT_PARAMS || {};
    return cfg.version || VERSION;
  }

  // Module list derived from the curriculum content. Order = curriculum order.
  function modules() {
    var out = [];
    var meta = window.PHASE_META || [];
    var lessons = window.PHASE_LESSONS || {};
    var withDeliverable = { phase1: 1, phase2: 1, phase3: 1, phase4: 1, phase5: 1, capstone: 1 };
    meta.forEach(function (ph) {
      if (ph.id === 'phase0') {
        out.push({ id: 'quiz', phaseId: 'phase0', title: 'Java readiness quiz', kind: 'mc' });
        return;
      }
      var secs = lessons[ph.id] || [];
      secs.forEach(function (sec) {
        if (!sec.check) return;
        out.push({
          id: sec.id, phaseId: ph.id, title: sec.title,
          kind: sec.check.type === 'written_answer' ? 'theory' : 'mc',
          graded: sec.check.type === 'written_answer' ? sec.check.graded !== false : true
        });
      });
      if (withDeliverable[ph.id]) out.push({ id: 'deliverable', phaseId: ph.id, title: 'Code deliverable', kind: 'code' });
    });
    return out;
  }

  // Group graded attempts by module (phase0's q0..q9 collapse into 'quiz').
  function observationsByModule(attempts) {
    var map = {};
    var sorted = (attempts || []).slice().sort(function (a, b) { return (a.ts || 0) - (b.ts || 0); });
    sorted.forEach(function (a) {
      if (!a || a.graded !== true || typeof a.correct !== 'boolean') return;
      var pid = a.phaseId || 'unknown';
      var mid = pid === 'phase0' ? 'quiz' : (a.sectionId || 'unknown');
      var key = pid + '/' + mid;
      if (!map[key]) map[key] = [];
      map[key].push(a.correct);
    });
    return map;
  }

  function compute(state) {
    var obs = observationsByModule(state && state.curriculum ? state.curriculum.attempts : []);
    var mods = modules();
    var phases = {};
    mods.forEach(function (m) {
      if (m.graded === false) return;                     // reflections never feed mastery
      var p = params(m.phaseId);
      var o = obs[m.phaseId + '/' + m.id] || [];
      var pL = o.length ? run(o, p) : p.prior;
      if (!phases[m.phaseId]) phases[m.phaseId] = { modules: {}, order: [] };
      phases[m.phaseId].modules[m.id] = { pL: pL, n: o.length, title: m.title, kind: m.kind, observed: o.length > 0 };
      phases[m.phaseId].order.push(m.id);
    });
    Object.keys(phases).forEach(function (pid) {
      var ph = phases[pid];
      var sum = 0, observed = 0;
      ph.order.forEach(function (mid) { sum += ph.modules[mid].pL; if (ph.modules[mid].observed) observed++; });
      ph.mastery = ph.order.length ? sum / ph.order.length : 0;
      ph.observedModules = observed;
      ph.totalModules = ph.order.length;
    });
    return { version: version(), computedAt: Date.now(), phases: phases };
  }

  // Recompute and store a compact copy in state.bkt (derived data → silent update).
  function recompute(store) {
    store = store || window.RTStore;
    var result = compute(store.get());
    store.update(function (s) {
      var compact = {};
      Object.keys(result.phases).forEach(function (pid) {
        var ph = result.phases[pid];
        compact[pid] = { phase: round3(ph.mastery), observed: ph.observedModules, total: ph.totalModules, modules: {} };
        ph.order.forEach(function (mid) { compact[pid].modules[mid] = round3(ph.modules[mid].pL); });
      });
      s.bkt.paramsVersion = result.version;
      s.bkt.mastery = compact;
      s.bkt.updatedAt = result.computedAt;
    }, { silent: true });
    return result;
  }

  function round3(x) { return Math.round(x * 1000) / 1000; }

  window.RTBkt = { DEFAULTS: DEFAULTS, update: update, run: run, params: params, modules: modules, compute: compute, recompute: recompute, observationsByModule: observationsByModule };
  if (typeof module !== 'undefined' && module.exports) module.exports = window.RTBkt;
})();
