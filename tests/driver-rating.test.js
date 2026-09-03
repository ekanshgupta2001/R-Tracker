// Driver rating (node --test): the outcome-based rating in js/driver-rating.js
// rewards beating par with clean lines and penalises wall hits, and it separates a
// slow careful driver from a fast skilled one. Fixtures: tests/fixtures/driver-runs.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadClassic(files) {
  const sandbox = { window: {}, console };
  sandbox.window.window = sandbox.window;
  for (const f of files) vm.runInNewContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
  return sandbox.window;
}

const win = loadClassic(['js/level-table.js', 'js/driver-rating.js']);
const TABLE = win.RT_LEVEL_TABLE;
const R = win.RTDriverRating;
const fixtures = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/fixtures/driver-runs.json'), 'utf8')).sets;

// Resolve parMultiple → timeMs against the live par table, add timestamps in order.
function runs(name, tsBase = 1_700_000_000_000) {
  let ts = tsBase;
  return fixtures[name].map(r => {
    const def = TABLE.get(r.levelId);
    const out = Object.assign({}, r, { timeMs: Math.round(def.parTimeMs * r.parMultiple), timestamp: (ts += 60_000) });
    delete out.parMultiple;
    return out;
  });
}
function score(run) { return R.runScore(run, TABLE.get(run.levelId).parTimeMs); }

test('level table: every level has an estimated par below its time limit and a weight', () => {
  assert.equal(TABLE.LEVELS.length, 12);
  for (const l of TABLE.LEVELS) {
    assert.ok(l.parTimeMs > 0 && l.parTimeMs < l.timeLimit * 1000, `level ${l.id} par ${l.parTimeMs} vs limit ${l.timeLimit}s`);
    assert.ok(['estimated', 'simulated', 'measured'].includes(l.parSource), `level ${l.id} parSource`);
    assert.ok([1.0, 1.5, 2.0].includes(l.difficultyWeight), `level ${l.id} weight`);
    assert.ok(TABLE.FOCUS_LABELS[l.focus], `level ${l.id} focus label`);
  }
  assert.equal(TABLE.get(1).difficultyWeight, 1.0);
  assert.equal(TABLE.get(4).difficultyWeight, 1.5);
  assert.equal(TABLE.get(7).difficultyWeight, 2.0);
  assert.equal(TABLE.get(12).difficultyWeight, 2.0);
});

test('time score anchors: 0.5×par → 20, par → 70, 1.5×par → 100, capped, floored', () => {
  assert.equal(R.timeScore(0.5), 20);
  assert.equal(R.timeScore(1.0), 70);
  assert.equal(R.timeScore(1.5), 100);
  assert.ok(Math.abs(R.timeScore(0.75) - 45) < 1e-9);
  assert.ok(Math.abs(R.timeScore(1.25) - 85) < 1e-9);
  assert.equal(R.parRatio(1000, 100), 1.5);       // 10× faster than par is capped at 1.5
  assert.equal(R.timeScore(0.2), 0);              // far slower than 0.5×par floors at 0
  assert.equal(R.runScore({ completed: false, timeMs: 100, pathAccuracy: 100, collisions: 0 }, 1000), 0);
});

test('(a) a slow, perfectly smooth run 2× over par scores below a fast run with moderate jerk that beats par', () => {
  const slow = runs('slowSmooth')[0], fast = runs('fastJerky')[0];
  const sSlow = score(slow), sFast = score(fast);
  assert.ok(sSlow < sFast, `slow ${sSlow} should be < fast ${sFast}`);
  assert.ok(sSlow <= 20, `slow smooth run scored ${sSlow}`);
  assert.ok(sFast >= 70, `fast jerky run scored ${sFast}`);
  // Style metrics are diagnostics only: swapping them changes nothing.
  const swapped = Object.assign({}, slow, { styleMetrics: fast.styleMetrics, atSpeedFraction: fast.atSpeedFraction });
  assert.equal(score(swapped), sSlow);
});

test('(b) three wall hits cost exactly 15 points', () => {
  const clean = score(runs('fastJerky')[0]);
  const hit = score(runs('fastJerkyThreeHits')[0]);
  assert.ok(Math.abs((clean - hit) - 15) < 1e-9, `clean ${clean} hit ${hit}`);
});

test('(c) expert set rates ≥ 90 and rookie set rates ≤ 55', () => {
  const expert = R.rate(runs('expert'), TABLE);
  assert.ok(expert.rating >= 90, `expert rated ${expert.rating}`);
  assert.equal(expert.ratedLevels, 12);
  assert.ok(['S', 'A'].includes(expert.grade));

  const rookie = R.rate(runs('rookie'), TABLE);
  assert.ok(rookie.rating <= 55, `rookie rated ${rookie.rating}`);
  assert.equal(rookie.ratedLevels, 3, 'level 4 has no completed run and must not count');
  assert.equal(rookie.levels[4].counted, false);
  assert.equal(rookie.levels[1].attempts, 2);
  assert.equal(rookie.levels[1].completions, 1);
  assert.ok(rookie.grade === 'F' || rookie.grade === 'D');
});

test('(d) the rookie improving to par on levels 1–3 gains at least 10 points', () => {
  const before = R.rate(runs('rookie'), TABLE).rating;
  const after = R.rate(runs('rookie').concat(runs('rookieImprovedToPar', 1_700_100_000_000)), TABLE).rating;
  assert.ok(after - before >= 10, `before ${before} after ${after}`);
});

test('window: only the last N sessions count; failed runs count as zero among the best 3', () => {
  const old = runs('expert', 1_600_000_000_000).map(r => Object.assign({}, r, { sessionId: 'old-' + r.sessionId }));
  const recent = [];
  for (let s = 0; s < 5; s++) recent.push({ levelId: 1, sessionId: 'n' + s, completed: false, timeMs: 5000, pathAccuracy: 50, collisions: 0, timestamp: 1_700_000_000_000 + s * 1000 });
  recent.push({ levelId: 1, sessionId: 'n4', completed: true, timeMs: TABLE.get(1).parTimeMs, pathAccuracy: 100, collisions: 0, timestamp: 1_700_000_100_000 });
  const r = R.rate(old.concat(recent), TABLE, { sessionsWindow: 5 });
  assert.equal(r.sessionsInWindow, 5);
  assert.equal(r.ratedLevels, 1, 'the expert runs are older than the 5-session window');
  // best 3 of [70, 0, 0, 0, 0, 0] = 70/3
  assert.equal(r.rating, Math.round(70 / 3));
  const wide = R.rate(old.concat(recent), TABLE, { sessionsWindow: 50 });
  assert.equal(wide.ratedLevels, 12);
});

test('runs at custom physics are stored but not rated', () => {
  const DEF = { ...TABLE.DEFAULT_PHYSICS };   // spread: the table lives in the vm sandbox (other Object prototype)
  assert.deepEqual(DEF, { maxSpd: 6.5, turnRate: 380, accel: 20, braking: 20, inputDelay: 80 });
  const flagged = runs('expert').map(r => Object.assign({}, r, { rated: false, physics: { ...DEF, maxSpd: 10 } }));
  const r = R.rate(flagged, TABLE);
  assert.equal(r.rating, 0);
  assert.equal(r.ratedLevels, 0);
  assert.equal(r.unratedRuns, flagged.length);
  // Flagged rated at record time, but the physics no longer match the pars: still excluded.
  const stale = runs('expert').map(r => Object.assign({}, r, { rated: true, physics: { maxSpd: 8, turnRate: 230, accel: 15, friction: 13 } }));
  assert.equal(R.rate(stale, TABLE).ratedLevels, 0);
  const current = runs('expert').map(r => Object.assign({}, r, { rated: true, physics: { ...DEF } }));
  assert.equal(R.rate(current, TABLE).ratedLevels, 12);
  assert.equal(TABLE.isDefaultPhysics({ ...DEF }), true);
  assert.equal(TABLE.isDefaultPhysics({ ...DEF, maxSpd: 10 }), false);
  assert.equal(TABLE.isDefaultPhysics({ ...DEF, turnRate: 400 }), false);
  assert.equal(TABLE.isDefaultPhysics({ ...DEF, inputDelay: 0 }), false);
  assert.equal(TABLE.isDefaultPhysics(null), true);        // fixtures without physics are rated
});

// The level table and the simulator's level list must agree: same limits, and the
// table's path lengths (the par estimate input) match the real geometry.
test('level table matches js/teleop/levels.js (time limits, path lengths, names)', () => {
  const sb = { window: {}, console };
  sb.window.window = sb.window;
  vm.createContext(sb);
  vm.runInContext('const FIELD_FT = 12; let inp = {}, keys = {}, gpIdx = null, inputBuffer = [], inputTime = 0;', sb);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/teleop/levels.js'), 'utf8'), sb, { filename: 'js/teleop/levels.js' });
  const LEVELS = vm.runInContext('LEVELS', sb);
  const segLen = vm.runInContext('pathSegLengths', sb);
  assert.equal(LEVELS.length, TABLE.LEVELS.length);
  for (const def of LEVELS) {
    const t = TABLE.get(def.id);
    assert.ok(t, 'table entry for level ' + def.id);
    assert.equal(t.name, def.name, 'level ' + def.id + ' name');
    assert.equal(t.tier, def.tier, 'level ' + def.id + ' tier');
    assert.equal(t.timeLimit, def.timeLimit, 'level ' + def.id + ' timeLimit');
    assert.equal(t.checkpoints, def.path.length - 1, 'level ' + def.id + ' checkpoints');
    assert.equal(t.corners, def.path.length - 2, 'level ' + def.id + ' corners');
    assert.ok(Math.abs(segLen(def.path).total - t.pathLengthFt) < 0.1, 'level ' + def.id + ' path length');
    assert.ok(t.timeLimit * 1000 >= 2 * t.parTimeMs - 1, 'level ' + def.id + ' limit is at least 2× par');
  }
});

test('grades: S 95, A 85, B 75, C 65, D 50, else F', () => {
  assert.equal(R.gradeFromRating(95), 'S');
  assert.equal(R.gradeFromRating(94), 'A');
  assert.equal(R.gradeFromRating(85), 'A');
  assert.equal(R.gradeFromRating(75), 'B');
  assert.equal(R.gradeFromRating(65), 'C');
  assert.equal(R.gradeFromRating(50), 'D');
  assert.equal(R.gradeFromRating(49), 'F');
});

test('focus groups rank the weakest level group first', () => {
  const r = R.rate(runs('rookie'), TABLE);
  const groups = R.groupsByFocus(r, TABLE);
  assert.equal(groups.length, 3);
  for (let i = 1; i < groups.length; i++) assert.ok(groups[i - 1].meanScore <= groups[i].meanScore);
  assert.ok(groups.every(g => g.label && g.levelIds.length));
});
