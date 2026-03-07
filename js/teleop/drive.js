// ── R-Tracker TeleOp — Drive Physics & Config ─────────────────────────────

let cfg = { maxSpd: 8, turnRate: 234, robotSz: 18, deadzone: 0.10, accel: 15, friction: 13, inputDelay: 50 };
let bot = { x: 0, y: 0, hdg: 0, vx: 0, vy: 0, actualVx: 0, actualVy: 0, actualOmega: 0 };
let mtr = { fl: 0, fr: 0, bl: 0, br: 0 };
let drivetrain = 'mecanum';
let driveMode  = 'field';

function dz(v) {
  const d = cfg.deadzone;
  return Math.abs(v) < d ? 0 : Math.sign(v) * (Math.abs(v) - d) / (1 - d);
}

function updateBot(dt) {
  inputTime += dt * 1000;

  let lx = 0, ly = 0, rx = 0;
  if (gpIdx !== null) {
    const gp = navigator.getGamepads()[gpIdx];
    if (gp) { lx = dz(gp.axes[0]); ly = dz(gp.axes[1]); rx = dz(gp.axes[2]); }
  }
  let kx = 0, ky = 0, krx = 0;
  if (keys['KeyA']) kx -= 1;
  if (keys['KeyD']) kx += 1;
  if (keys['KeyW']) ky -= 1;
  if (keys['KeyS']) ky += 1;
  if (keys['ArrowLeft'])  krx -= 1;
  if (keys['ArrowRight']) krx += 1;
  const km = Math.hypot(kx, ky);
  if (km > 1) { kx /= km; ky /= km; }
  if (kx !== 0 || ky !== 0) { lx = kx; ly = ky; }
  if (krx !== 0) rx = krx;

  inputBuffer.push({ time: inputTime, lx, ly, rx });

  const delayThreshold = inputTime - cfg.inputDelay;
  let dlx = 0, dly = 0, drx = 0;
  while (inputBuffer.length > 1 && inputBuffer[1].time <= delayThreshold) {
    inputBuffer.shift();
  }
  if (inputBuffer.length > 0 && inputBuffer[0].time <= delayThreshold) {
    dlx = inputBuffer[0].lx;
    dly = inputBuffer[0].ly;
    drx = inputBuffer[0].rx;
  }

  inp.lx = dlx; inp.ly = dly; inp.rx = drx;

  const h = bot.hdg * Math.PI / 180;
  const fwd = -dly, str = dlx;

  let targetVx, targetVy;
  if (drivetrain === 'tank') {
    targetVx = fwd * Math.sin(h);
    targetVy = fwd * Math.cos(h);
  } else if (driveMode === 'field') {
    targetVx = str;
    targetVy = fwd;
  } else {
    targetVx = fwd * Math.sin(h) + str * Math.cos(h);
    targetVy = fwd * Math.cos(h) - str * Math.sin(h);
  }
  targetVx *= cfg.maxSpd;
  targetVy *= cfg.maxSpd;
  const targetOmega = drx * cfg.turnRate;

  const accelRate   = cfg.accel   * dt;
  const frictionRate = cfg.friction * dt;

  function approach(current, target, accelAmt, frictionAmt) {
    const diff = target - current;
    if (Math.abs(diff) < 0.01) return target;
    if (Math.abs(target) > 0.01) {
      if (Math.abs(diff) <= accelAmt) return target;
      return current + Math.sign(diff) * accelAmt;
    } else {
      if (Math.abs(current) <= frictionAmt) return 0;
      return current - Math.sign(current) * frictionAmt;
    }
  }

  bot.actualVx = approach(bot.actualVx, targetVx, accelRate, frictionRate);
  bot.actualVy = approach(bot.actualVy, targetVy, accelRate, frictionRate);

  const rotAccel   = cfg.accel   * (cfg.turnRate / cfg.maxSpd) * dt;
  const rotFriction = cfg.friction * (cfg.turnRate / cfg.maxSpd) * dt;
  bot.actualOmega = approach(bot.actualOmega, targetOmega, rotAccel, rotFriction);

  bot.x   += bot.actualVx    * dt;
  bot.y   += bot.actualVy    * dt;
  bot.hdg += bot.actualOmega * dt;
  bot.hdg = ((bot.hdg + 180) % 360 + 360) % 360 - 180;

  bot.vx = bot.actualVx;
  bot.vy = bot.actualVy;

  const halfRobot = cfg.robotSz / 24;
  const hf = FIELD_FT / 2 - halfRobot;
  if (bot.x < -hf) { bot.x = -hf; bot.actualVx = Math.max(0, bot.actualVx); }
  if (bot.x >  hf) { bot.x =  hf; bot.actualVx = Math.min(0, bot.actualVx); }
  if (bot.y < -hf) { bot.y = -hf; bot.actualVy = Math.max(0, bot.actualVy); }
  if (bot.y >  hf) { bot.y =  hf; bot.actualVy = Math.min(0, bot.actualVy); }

  for (const z of appMode === 'levels' ? [] : COLLISION_ZONES) {
    const zL = z.x - z.w / 2, zR = z.x + z.w / 2;
    const zB = z.y - z.h / 2, zT = z.y + z.h / 2;
    const rL = bot.x - halfRobot, rR = bot.x + halfRobot;
    const rB = bot.y - halfRobot, rT = bot.y + halfRobot;
    if (rR > zL && rL < zR && rT > zB && rB < zT) {
      const overlapLeft  = rR - zL, overlapRight = zR - rL;
      const overlapDown  = rT - zB, overlapUp    = zT - rB;
      const minX = Math.min(overlapLeft, overlapRight);
      const minY = Math.min(overlapDown, overlapUp);
      if (minX < minY) {
        if (overlapLeft < overlapRight) { bot.x = zL - halfRobot; bot.actualVx = Math.min(0, bot.actualVx); }
        else                            { bot.x = zR + halfRobot; bot.actualVx = Math.max(0, bot.actualVx); }
      } else {
        if (overlapDown < overlapUp) { bot.y = zB - halfRobot; bot.actualVy = Math.min(0, bot.actualVy); }
        else                         { bot.y = zT + halfRobot; bot.actualVy = Math.max(0, bot.actualVy); }
      }
    }
  }

  let mFwd = fwd, mStr = str;
  if (driveMode === 'field' && drivetrain === 'mecanum') {
    mFwd = fwd * Math.cos(h) + str * Math.sin(h);
    mStr = -fwd * Math.sin(h) + str * Math.cos(h);
  }
  const rot = drx;
  if (drivetrain === 'mecanum') {
    let fl = mFwd + mStr + rot, fr = mFwd - mStr - rot;
    let bl = mFwd - mStr + rot, br = mFwd + mStr - rot;
    const mx = Math.max(1, Math.abs(fl), Math.abs(fr), Math.abs(bl), Math.abs(br));
    mtr.fl = fl / mx; mtr.fr = fr / mx; mtr.bl = bl / mx; mtr.br = br / mx;
  } else {
    let L = fwd + rot, R = fwd - rot;
    const mx = Math.max(1, Math.abs(L), Math.abs(R));
    mtr.fl = mtr.bl = L / mx;
    mtr.fr = mtr.br = R / mx;
  }
}

function cfgUpdate() {
  cfg.maxSpd    = parseFloat(document.getElementById('s-ms').value);
  cfg.turnRate  = parseFloat(document.getElementById('s-tr').value);
  cfg.robotSz   = parseFloat(document.getElementById('s-rs').value);
  cfg.deadzone  = parseFloat(document.getElementById('s-dz').value);
  cfg.accel     = parseFloat(document.getElementById('s-ac').value);
  cfg.friction  = parseFloat(document.getElementById('s-fr').value);
  cfg.inputDelay = parseFloat(document.getElementById('s-rd').value);
  document.getElementById('s-ms-v').textContent = cfg.maxSpd.toFixed(1) + ' ft/s';
  document.getElementById('s-tr-v').textContent = cfg.turnRate + ' °/s';
  document.getElementById('s-rs-v').textContent = cfg.robotSz + ' in';
  document.getElementById('s-dz-v').textContent = cfg.deadzone.toFixed(2);
  document.getElementById('s-ac-v').textContent = cfg.accel + ' ft/s²';
  document.getElementById('s-fr-v').textContent = cfg.friction + ' ft/s²';
  document.getElementById('s-rd-v').textContent = cfg.inputDelay + ' ms';
}
