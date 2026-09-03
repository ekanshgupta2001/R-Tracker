// Drive physics (node --test): js/teleop/drive.js behaves like the real drivetrain it
// documents. Runs the actual updateBot() in a sandbox with a fake gamepad at 60 Hz.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const DT = 1 / 60;

// fieldFt: the real field is 12 ft; the open-field tests use a huge one so a 3 s run
// at full speed (≈ 20 ft) never reaches a wall.
function makeSim(fieldFt = 1e6) {
  const gp = { axes: [0, 0, 0, 0] };
  const sb = { console, navigator: { getGamepads: () => [gp] } };
  vm.createContext(sb);
  // what field.js / robot.js / levels.js / input.js declare (they bind the DOM at load)
  vm.runInContext(`const FIELD_FT = ${fieldFt}; const COLLISION_ZONES = []; let appMode = 'levels';
    let inp = { lx: 0, ly: 0, rx: 0 }, keys = {}, gpIdx = 0, inputBuffer = [], inputTime = 0;`, sb);
  vm.runInContext(read('js/teleop/drive.js'), sb, { filename: 'js/teleop/drive.js' });
  vm.runInContext(read('js/level-table.js').replace(/window\.RT_LEVEL_TABLE\s*=/, 'globalThis.RT_LEVEL_TABLE ='), sb, { filename: 'js/level-table.js' });
  const step = vm.runInContext(`(function (dt) { updateBot(dt); return { x: bot.x, y: bot.y, hdg: bot.hdg, vx: bot.actualVx, vy: bot.actualVy, omega: bot.actualOmega, vFwd: bot.vFwd, vStr: bot.vStr, speed: Math.hypot(bot.actualVx, bot.actualVy), mtr: Object.assign({}, mtr) }; })`, sb);
  const reset = vm.runInContext(`(function (x, y, hdg) { bot.x = x || 0; bot.y = y || 0; bot.hdg = hdg || 0; bot.vx = bot.vy = bot.actualVx = bot.actualVy = bot.actualOmega = bot.vFwd = bot.vStr = 0; inputBuffer.length = 0; inputTime = 0; })`, sb);
  const setDrive = vm.runInContext(`(function (t, m) { drivetrain = t; driveMode = m; })`, sb);
  const cfg = vm.runInContext('cfg', sb);
  const table = vm.runInContext('RT_LEVEL_TABLE', sb);
  let maxSeen = 0;
  function run(seconds, axes) {
    gp.axes = axes;
    let last = null;
    for (let i = 0; i < Math.round(seconds / DT); i++) { last = step(DT); maxSeen = Math.max(maxSeen, last.speed); }
    return last;
  }
  return { cfg, table, run, reset, setDrive, maxSeen: () => maxSeen };
}

test('the defaults are the level table\'s DEFAULT_PHYSICS and match the slider markup', () => {
  const { cfg, table } = makeSim();
  const d = { ...table.DEFAULT_PHYSICS };
  for (const k of Object.keys(d)) assert.equal(cfg[k], d[k], 'cfg.' + k);
  const html = read('pages/teleop.html');
  const slider = (id) => Number(html.match(new RegExp('id="' + id + '"[^>]*value="([0-9.]+)"'))[1]);
  assert.equal(slider('s-ms'), d.maxSpd);
  assert.equal(slider('s-tr'), d.turnRate);
  assert.equal(slider('s-ac'), d.accel);
  assert.equal(slider('s-fr'), d.braking);
  assert.equal(slider('s-rd'), d.inputDelay);
  // each default sits on its slider's step grid, so the browser will not snap it
  const grid = (id) => { const m = html.match(new RegExp('id="' + id + '"[^>]*min="([0-9.]+)"[^>]*step="([0-9.]+)"')); return { min: Number(m[1]), step: Number(m[2]) }; };
  for (const [id, v] of [['s-ms', d.maxSpd], ['s-tr', d.turnRate], ['s-ac', d.accel], ['s-fr', d.braking], ['s-rd', d.inputDelay]]) {
    const g = grid(id);
    const k = (v - g.min) / g.step;
    assert.ok(Math.abs(k - Math.round(k)) < 1e-9, id + ' default ' + v + ' is off its step grid');
  }
});

test('latency: nothing moves until the input delay has elapsed', () => {
  const sim = makeSim();
  sim.reset();
  const early = sim.run(0.05, [0, -1, 0]);          // 50 ms < 80 ms delay
  assert.equal(early.speed, 0);
  const later = sim.run(0.1, [0, -1, 0]);           // 150 ms
  assert.ok(later.speed > 0.5, 'moving after the delay: ' + later.speed);
});

test('forward: first-order spin-up, never above max speed, ~95% within 0.8 s', () => {
  const sim = makeSim();
  sim.reset();
  const s08 = sim.run(0.8, [0, -1, 0]);
  assert.ok(s08.speed >= 0.9 * sim.cfg.maxSpd, '0.8 s: ' + s08.speed);
  const s3 = sim.run(2.2, [0, -1, 0]);
  assert.ok(Math.abs(s3.speed - sim.cfg.maxSpd) < 0.02, 'steady: ' + s3.speed);
  assert.ok(s3.vy > 0 && Math.abs(s3.vx) < 1e-9, 'W drives +y');
  assert.ok(sim.maxSeen() <= sim.cfg.maxSpd + 1e-9);
});

test('release: BRAKE-mode stop from full speed in under a second and under 2.5 ft', () => {
  const sim = makeSim();
  sim.reset(0, -4);
  const start = sim.run(3, [0, -1, 0]).y;          // at full speed, 3 s in
  let t = 0, s = null;
  while (t < 1.0) { s = sim.run(DT, [0, 0, 0]); t += DT; if (s.speed < 0.3) break; }
  assert.ok(s.speed < 0.3, 'still moving after 1 s: ' + s.speed);
  assert.ok(t < 1.0, 'stopped in ' + t.toFixed(2) + ' s');
  const slide = s.y - start;
  assert.ok(slide < 2.5, 'stopping distance ' + slide.toFixed(2) + ' ft');
  assert.ok(slide > 1.0, 'a real robot slides more than a foot: ' + slide.toFixed(2) + ' ft');
});

test('strafe runs at 80% of forward speed; a full-stick diagonal is much slower than a straight', () => {
  const sim = makeSim();
  sim.reset();
  const strafe = sim.run(3, [1, 0, 0]);
  assert.ok(Math.abs(strafe.vx - 0.8 * sim.cfg.maxSpd) < 0.05, 'strafe ' + strafe.vx);
  assert.ok(Math.abs(strafe.vy) < 1e-9);
  sim.reset();
  const diag = sim.run(3, [Math.SQRT1_2, -Math.SQRT1_2, 0]);
  const ratio = diag.speed / sim.cfg.maxSpd;
  assert.ok(ratio > 0.55 && ratio < 0.75, 'diagonal at ' + ratio.toFixed(2) + ' of max (two wheels pull)');
});

test('motor saturation: turning while driving halves the forward speed and the spin rate', () => {
  const sim = makeSim();
  // Robot-centric so the command stays "full forward + full spin" whatever the heading:
  // two wheels want 2.0, normalisation halves everything.
  sim.setDrive('mecanum', 'robot');
  sim.reset();
  const s = sim.run(3, [0, -1, 1]);
  assert.ok(Math.abs(s.vFwd - 0.5 * sim.cfg.maxSpd) < 0.1, 'forward ' + s.vFwd);
  assert.ok(Math.abs(Math.abs(s.omega) - 0.5 * sim.cfg.turnRate) < 3, 'omega ' + s.omega);
  assert.ok(Math.abs(s.mtr.fl) === 1 || Math.abs(s.mtr.bl) === 1, 'a wheel is pinned at full power');
  assert.ok(sim.maxSeen() <= 0.55 * sim.cfg.maxSpd + 1e-6, 'never faster than half speed while spinning');
  // spin only: reaches the turn rate, never above it
  sim.reset();
  const spin = sim.run(2, [0, 0, 1]);
  assert.ok(Math.abs(Math.abs(spin.omega) - sim.cfg.turnRate) < 1, 'spin ' + spin.omega);
  // Field-centric while spinning: the robot-frame command rotates, so the robot has to
  // strafe part of the time and the speed lurches between ~0.3 and 0.5 of max — the
  // familiar mecanum "spin while driving" wobble.
  const fc = makeSim();
  fc.reset();
  let lo = Infinity, hi = 0;
  fc.run(1, [0, -1, 1]);
  for (let i = 0; i < 120; i++) { const st = fc.run(DT, [0, -1, 1]); lo = Math.min(lo, st.speed); hi = Math.max(hi, st.speed); }
  assert.ok(hi <= 0.55 * fc.cfg.maxSpd + 1e-6 && hi > 0.35 * fc.cfg.maxSpd, 'peak ' + hi);
  assert.ok(lo < hi && lo > 0.2 * fc.cfg.maxSpd, 'trough ' + lo);
  assert.ok(hi - lo > 0.03 * fc.cfg.maxSpd, 'the speed wobbles as the heading sweeps: ' + lo.toFixed(2) + '–' + hi.toFixed(2));
});

test('field-centric: the stick direction is a field direction whatever the heading', () => {
  const sim = makeSim();
  sim.reset(0, 0, 90);                       // facing +x
  const s = sim.run(3, [0, -1, 0]);          // stick "up" → field +y, which is a STRAFE for this heading
  assert.ok(Math.abs(s.vy - 0.8 * sim.cfg.maxSpd) < 0.05 && Math.abs(s.vx) < 0.05, 'field +y at strafe speed: ' + s.vx + ',' + s.vy);
  assert.ok(Math.abs(s.vStr) > 0.95 * Math.abs(s.vy) && Math.abs(s.vFwd) < 0.05, 'the robot is strafing');
  sim.reset(0, 0, 90);
  const side = sim.run(3, [1, 0, 0]);        // stick "right" → field +x, the robot's nose → full speed
  assert.ok(side.vx > 0.99 * sim.cfg.maxSpd && Math.abs(side.vy) < 0.05, 'field +x at full speed: ' + side.vx + ',' + side.vy);
  sim.setDrive('mecanum', 'robot');
  sim.reset(0, 0, 90);
  const r = sim.run(3, [0, -1, 0]);          // robot-centric: "up" is the robot's nose → +x
  assert.ok(r.vx > 0.99 * sim.cfg.maxSpd && Math.abs(r.vy) < 0.05, 'robot +x: ' + r.vx + ',' + r.vy);
});

test('tank drive cannot strafe and has no sideways slip while turning', () => {
  const sim = makeSim();
  sim.setDrive('tank', 'field');
  sim.reset();
  const strafe = sim.run(1, [1, 0, 0]);
  assert.ok(strafe.speed < 1e-9, 'tank strafing moved: ' + strafe.speed);
  const arc = sim.run(2, [0, -1, 1]);
  assert.equal(arc.vStr, 0);
  assert.ok(arc.vFwd > 0 && Math.abs(arc.omega) > 0);
});

test('the field wall stops the robot dead with the parallel velocity kept', () => {
  const sim = makeSim(12);
  sim.reset(0, 4);
  const s = sim.run(2, [0.3, -1, 0]);
  const hf = 6 - sim.cfg.robotSz / 24;
  assert.ok(Math.abs(s.y - hf) < 1e-9, 'pinned at the top wall: ' + s.y);
  assert.equal(s.vy, 0);
  assert.ok(s.vx > 0, 'still sliding along the wall');
});
