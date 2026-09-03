// ── R-Tracker TeleOp — level table (par times, difficulty weights) ────────────
// What the driver rating needs to know about each level. Geometry (paths,
// checkpoints, drawing) stays in js/teleop/levels.js; this file carries only the
// numbers the rating reads, so js/driver-rating.js and the unit tests can load it
// without the simulator. Loaded as a classic script (no fetch: the CSP forbids
// loading a .json file at runtime).
//
// parTimeMs — the time a driver must match to score 70 on a run (see
//   js/driver-rating.js). Every entry is parSource 'simulated': referenceMs is the
//   time an idealised reflex driver (full stick straight at the next checkpoint, no
//   anticipation, no rotation, no braking) takes through the real physics in
//   js/teleop/drive.js at DEFAULT_PHYSICS — `node tools/estimate-pars.mjs` — and
//   par = 1.2 × that, rounded up to 100 ms. A human beats the reference by cutting
//   corners inside the checkpoint radius and by facing the diagonals, which is where
//   the S band (1.5 × par) lives. Re-run the tool whenever the physics change.
//   Replace with measured times and set parSource 'measured' when we have them.
// timeLimit — 2 × par, rounded up to a whole second, so gold (≤ 50% of the limit)
//   means par pace. Must equal the LEVELS entry in js/teleop/levels.js (unit-tested).
// difficultyWeight — Beginner 1.0, Intermediate 1.5, Advanced and Expert 2.0.
// focus — the driving skill the level exercises; the coach names the weakest
//   focus group when it recommends what to practise.
//
// Exposes: window.RT_LEVEL_TABLE

(function () {
  'use strict';

  // The physics a par time assumes: the slider defaults in pages/teleop.html, which
  // cfgUpdate() loads before the first frame (keep every value on its slider's step
  // grid — the browser snaps a range input to the nearest step). The derivation of
  // each number from a real 435 RPM mecanum drivetrain is in js/teleop/drive.js.
  var DEFAULT_PHYSICS = { maxSpd: 6.5, turnRate: 270, accel: 20, braking: 20, inputDelay: 80 };

  var FOCUS_LABELS = {
    straight:  'straight-line driving',
    strafe:    'strafing',
    corners:   'cornering',
    reversals: 'sharp direction changes',
    speed:     'high-speed diagonals',
    precision: 'tight precision runs'
  };

  var LEVELS = [
    { id: 1,  name: 'Straight Shot',        tier: 'Beginner',     timeLimit: 4,  checkpoints: 1,  pathLengthFt: 8.0,  corners: 0, referenceMs: 1450,  parTimeMs: 1800,  parSource: 'simulated', difficultyWeight: 1.0, focus: 'straight'  },
    { id: 2,  name: 'Side Step',            tier: 'Beginner',     timeLimit: 4,  checkpoints: 1,  pathLengthFt: 6.0,  corners: 0, referenceMs: 1333,  parTimeMs: 1600,  parSource: 'simulated', difficultyWeight: 1.0, focus: 'strafe'    },
    { id: 3,  name: 'L-Shape',              tier: 'Beginner',     timeLimit: 8,  checkpoints: 2,  pathLengthFt: 15.0, corners: 1, referenceMs: 3317,  parTimeMs: 4000,  parSource: 'simulated', difficultyWeight: 1.0, focus: 'corners'   },
    { id: 4,  name: 'The Square',           tier: 'Intermediate', timeLimit: 17, checkpoints: 4,  pathLengthFt: 32.0, corners: 3, referenceMs: 6783,  parTimeMs: 8200,  parSource: 'simulated', difficultyWeight: 1.5, focus: 'corners'   },
    { id: 5,  name: 'Zigzag',               tier: 'Intermediate', timeLimit: 14, checkpoints: 4,  pathLengthFt: 18.9, corners: 3, referenceMs: 5633,  parTimeMs: 6800,  parSource: 'simulated', difficultyWeight: 1.5, focus: 'reversals' },
    { id: 6,  name: 'Diamond',              tier: 'Intermediate', timeLimit: 17, checkpoints: 4,  pathLengthFt: 25.6, corners: 3, referenceMs: 6767,  parTimeMs: 8200,  parSource: 'simulated', difficultyWeight: 1.5, focus: 'reversals' },
    { id: 7,  name: 'Specimen Run',         tier: 'Advanced',     timeLimit: 14, checkpoints: 4,  pathLengthFt: 26.0, corners: 3, referenceMs: 5450,  parTimeMs: 6600,  parSource: 'simulated', difficultyWeight: 2.0, focus: 'corners'   },
    { id: 8,  name: 'Sample Collect',       tier: 'Advanced',     timeLimit: 14, checkpoints: 4,  pathLengthFt: 21.1, corners: 3, referenceMs: 5567,  parTimeMs: 6700,  parSource: 'simulated', difficultyWeight: 2.0, focus: 'reversals' },
    { id: 9,  name: 'Spiral In',            tier: 'Advanced',     timeLimit: 23, checkpoints: 6,  pathLengthFt: 44.0, corners: 5, referenceMs: 9283,  parTimeMs: 11200, parSource: 'simulated', difficultyWeight: 2.0, focus: 'corners'   },
    { id: 10, name: 'Speed Demon',          tier: 'Expert',       timeLimit: 29, checkpoints: 4,  pathLengthFt: 45.4, corners: 3, referenceMs: 11800, parTimeMs: 14200, parSource: 'simulated', difficultyWeight: 2.0, focus: 'speed'     },
    { id: 11, name: 'Threading the Needle', tier: 'Expert',       timeLimit: 25, checkpoints: 8,  pathLengthFt: 37.9, corners: 7, referenceMs: 10400, parTimeMs: 12500, parSource: 'simulated', difficultyWeight: 2.0, focus: 'precision' },
    { id: 12, name: 'The Gauntlet',         tier: 'Expert',       timeLimit: 32, checkpoints: 10, pathLengthFt: 51.4, corners: 9, referenceMs: 12967, parTimeMs: 15600, parSource: 'simulated', difficultyWeight: 2.0, focus: 'precision' }
  ];

  var byId = {};
  LEVELS.forEach(function (l) { byId[l.id] = l; });

  function get(id) { return byId[Number(id)] || null; }

  // True when a run was driven at the physics the par times assume. A run recorded
  // under an older physics model (different keys or values) is not comparable to
  // these pars, so it reads as non-default too.
  function isDefaultPhysics(p) {
    if (!p) return true;
    return Object.keys(DEFAULT_PHYSICS).every(function (k) { return Number(p[k]) === DEFAULT_PHYSICS[k]; });
  }

  window.RT_LEVEL_TABLE = {
    LEVELS: LEVELS,
    FOCUS_LABELS: FOCUS_LABELS,
    DEFAULT_PHYSICS: DEFAULT_PHYSICS,
    get: get,
    isDefaultPhysics: isDefaultPhysics
  };
})();
