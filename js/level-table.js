// ── R-Tracker TeleOp — level table (par times, difficulty weights) ────────────
// What the driver rating needs to know about each level. Geometry (paths,
// checkpoints, drawing) stays in js/teleop/levels.js; this file carries only the
// numbers the rating reads, so js/driver-rating.js and the unit tests can load it
// without the simulator. Loaded as a classic script (no fetch: the CSP forbids
// loading a .json file at runtime).
//
// parTimeMs — the time a driver must match to score 70 on a run (see
//   js/driver-rating.js). Every entry is parSource 'estimated':
//     expert = pathLengthFt / 8 ft/s + 0.35 s launch + 0.30 s per corner
//     par    = 1.2 × expert, rounded to 100 ms
//   Replace with measured times and set parSource 'measured' when we have them.
// difficultyWeight — Beginner 1.0, Intermediate 1.5, Advanced and Expert 2.0.
// focus — the driving skill the level exercises; the coach names the weakest
//   focus group when it recommends what to practise.
//
// Exposes: window.RT_LEVEL_TABLE

(function () {
  'use strict';

  // The physics a par time assumes: the values cfgUpdate() produces from the sliders
  // at page load. drive.js seeds turnRate with 234, but the slider (min 30, step 10)
  // snaps it to 230 before the first frame, so 230 is what every run is driven at.
  var DEFAULT_PHYSICS = { maxSpd: 8, turnRate: 230, accel: 15, friction: 13 };

  var FOCUS_LABELS = {
    straight:  'straight-line driving',
    strafe:    'strafing',
    corners:   'cornering',
    reversals: 'sharp direction changes',
    speed:     'high-speed diagonals',
    precision: 'tight precision runs'
  };

  var LEVELS = [
    { id: 1,  name: 'Straight Shot',        tier: 'Beginner',     timeLimit: 5,  checkpoints: 1,  pathLengthFt: 8.0,  corners: 0, parTimeMs: 1600,  parSource: 'estimated', difficultyWeight: 1.0, focus: 'straight'  },
    { id: 2,  name: 'Side Step',            tier: 'Beginner',     timeLimit: 5,  checkpoints: 1,  pathLengthFt: 6.0,  corners: 0, parTimeMs: 1300,  parSource: 'estimated', difficultyWeight: 1.0, focus: 'strafe'    },
    { id: 3,  name: 'L-Shape',              tier: 'Beginner',     timeLimit: 7,  checkpoints: 2,  pathLengthFt: 15.0, corners: 1, parTimeMs: 3000,  parSource: 'estimated', difficultyWeight: 1.0, focus: 'corners'   },
    { id: 4,  name: 'The Square',           tier: 'Intermediate', timeLimit: 10, checkpoints: 4,  pathLengthFt: 32.0, corners: 3, parTimeMs: 6300,  parSource: 'estimated', difficultyWeight: 1.5, focus: 'corners'   },
    { id: 5,  name: 'Zigzag',               tier: 'Intermediate', timeLimit: 10, checkpoints: 4,  pathLengthFt: 18.9, corners: 3, parTimeMs: 4300,  parSource: 'estimated', difficultyWeight: 1.5, focus: 'reversals' },
    { id: 6,  name: 'Diamond',              tier: 'Intermediate', timeLimit: 12, checkpoints: 4,  pathLengthFt: 25.6, corners: 3, parTimeMs: 5300,  parSource: 'estimated', difficultyWeight: 1.5, focus: 'reversals' },
    { id: 7,  name: 'Specimen Run',         tier: 'Advanced',     timeLimit: 10, checkpoints: 4,  pathLengthFt: 26.0, corners: 3, parTimeMs: 5400,  parSource: 'estimated', difficultyWeight: 2.0, focus: 'corners'   },
    { id: 8,  name: 'Sample Collect',       tier: 'Advanced',     timeLimit: 10, checkpoints: 4,  pathLengthFt: 21.1, corners: 3, parTimeMs: 4700,  parSource: 'estimated', difficultyWeight: 2.0, focus: 'reversals' },
    { id: 9,  name: 'Spiral In',            tier: 'Advanced',     timeLimit: 14, checkpoints: 6,  pathLengthFt: 44.0, corners: 5, parTimeMs: 8800,  parSource: 'estimated', difficultyWeight: 2.0, focus: 'corners'   },
    { id: 10, name: 'Speed Demon',          tier: 'Expert',       timeLimit: 10, checkpoints: 4,  pathLengthFt: 45.4, corners: 3, parTimeMs: 8300,  parSource: 'estimated', difficultyWeight: 2.0, focus: 'speed'     },
    { id: 11, name: 'Threading the Needle', tier: 'Expert',       timeLimit: 14, checkpoints: 8,  pathLengthFt: 37.9, corners: 7, parTimeMs: 8600,  parSource: 'estimated', difficultyWeight: 2.0, focus: 'precision' },
    { id: 12, name: 'The Gauntlet',         tier: 'Expert',       timeLimit: 16, checkpoints: 10, pathLengthFt: 51.4, corners: 9, parTimeMs: 11400, parSource: 'estimated', difficultyWeight: 2.0, focus: 'precision' }
  ];

  var byId = {};
  LEVELS.forEach(function (l) { byId[l.id] = l; });

  function get(id) { return byId[Number(id)] || null; }

  // True when a run was driven at the physics the par times assume.
  function isDefaultPhysics(p) {
    if (!p) return true;
    return Number(p.maxSpd) === DEFAULT_PHYSICS.maxSpd &&
      Number(p.turnRate) === DEFAULT_PHYSICS.turnRate &&
      Number(p.accel) === DEFAULT_PHYSICS.accel &&
      Number(p.friction) === DEFAULT_PHYSICS.friction;
  }

  window.RT_LEVEL_TABLE = {
    LEVELS: LEVELS,
    FOCUS_LABELS: FOCUS_LABELS,
    DEFAULT_PHYSICS: DEFAULT_PHYSICS,
    get: get,
    isDefaultPhysics: isDefaultPhysics
  };
})();
