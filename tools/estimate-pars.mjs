#!/usr/bin/env node
// Dev-only. Estimates the par times in js/level-table.js by driving every level with an
// idealised reflex driver through the real physics in js/teleop/drive.js (the actual
// updateBot, at the slider defaults). The driver holds a full stick straight at the
// next checkpoint with no anticipation and no braking; checkpoints register exactly
// as js/teleop/levels.js registers them (0.5 ft radius, 0.3 s cooldown, 0.4 s at start).
//
//   node tools/estimate-pars.mjs            # prints the table
//
// par = 1.2 × that time, rounded up to 100 ms; timeLimit = 2 × par rounded up to a
// whole second, so gold (≤ 50% of the limit) means par pace. Never runs in the app.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

const gp = { axes: [0, 0, 0, 0] };
const sandbox = { console, navigator: { getGamepads: () => [gp] }, __gp: gp };
vm.createContext(sandbox);
// What field.js / robot.js / input.js would declare (they bind the DOM at load).
vm.runInContext(`
  const FIELD_FT = 12;
  const COLLISION_ZONES = [];
  let inp = { lx: 0, ly: 0, rx: 0 }, keys = {}, gpIdx = 0, inputBuffer = [], inputTime = 0;
`, sandbox);
for (const f of ['js/teleop/drive.js', 'js/teleop/levels.js', 'js/level-table.js']) {
  vm.runInContext(read(f).replace(/window\.RT_LEVEL_TABLE\s*=/, 'globalThis.RT_LEVEL_TABLE ='), sandbox, { filename: f });
}
vm.runInContext(`appMode = 'levels'; drivetrain = 'mecanum'; driveMode = 'field';`, sandbox);

const simulate = vm.runInContext(`(function (def) {
  const p0 = def.path[0];
  bot.x = p0.x; bot.y = p0.y; bot.hdg = 0;
  bot.vx = bot.vy = bot.actualVx = bot.actualVy = bot.actualOmega = bot.vFwd = bot.vStr = 0;
  inputBuffer.length = 0; inputTime = 0;
  const dt = 1 / 60;
  let t = 0, nextCp = 1, cool = 0.4, maxSpeed = 0;
  while (t < 60) {
    const target = def.path[nextCp];
    const dx = target.x - bot.x, dy = target.y - bot.y, d = Math.hypot(dx, dy) || 1;
    // full stick at the target; field-centric, +y up on the field, the Y axis is inverted
    __gp.axes[0] = dx / d; __gp.axes[1] = -dy / d; __gp.axes[2] = 0;
    updateBot(dt);
    t += dt;
    maxSpeed = Math.max(maxSpeed, Math.hypot(bot.actualVx, bot.actualVy));
    cool = Math.max(0, cool - dt);
    if (cool <= 0 && Math.hypot(bot.x - target.x, bot.y - target.y) < LVL_CP_RADIUS) {
      nextCp++; cool = 0.3;
      if (nextCp >= def.path.length) break;
    }
  }
  const { total } = pathSegLengths(def.path);
  return { id: def.id, name: def.name, tier: def.tier, pathLengthFt: Math.round(total * 10) / 10, corners: def.path.length - 2, expertMs: Math.round(t * 1000), maxSpeed: Math.round(maxSpeed * 100) / 100, done: nextCp >= def.path.length };
})`, sandbox);

const cfg = vm.runInContext('cfg', sandbox);
console.log('physics:', JSON.stringify(cfg));
const rows = vm.runInContext('LEVELS', sandbox).map(def => {
  const r = simulate(def);
  r.parTimeMs = Math.ceil(r.expertMs * 1.2 / 100) * 100;
  r.timeLimit = Math.ceil(2 * r.parTimeMs / 1000);
  return r;
});
console.log('id  name                    tier          len(ft) corners expert(s) par(s) limit(s) done');
for (const r of rows) {
  console.log(String(r.id).padStart(2), ' ', r.name.padEnd(22), r.tier.padEnd(13), String(r.pathLengthFt).padStart(6), String(r.corners).padStart(7), (r.expertMs / 1000).toFixed(2).padStart(9), (r.parTimeMs / 1000).toFixed(1).padStart(6), String(r.timeLimit).padStart(8), r.done ? '  ok' : '  NOT FINISHED');
}
console.log('\nJSON:');
console.log(JSON.stringify(rows.map(r => ({ id: r.id, pathLengthFt: r.pathLengthFt, corners: r.corners, expertMs: r.expertMs, parTimeMs: r.parTimeMs, timeLimit: r.timeLimit }))));
