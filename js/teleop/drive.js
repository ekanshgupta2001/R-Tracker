// ── R-Tracker TeleOp — Drive Physics & Config ─────────────────────────────
//
// Reference drivetrain (the slider defaults): a typical competitive FTC mecanum robot —
// 4 × goBILDA 5203 Yellow Jacket 435 RPM (13.7:1), 96 mm mecanum wheels, 18 in × 18 in,
// about 35 lb (16 kg), 12 V battery, drive motors in BRAKE zero-power mode.
//
//   maxSpd     6.5 ft/s   free speed = 435/60 × π × 0.096 m = 2.19 m/s = 7.2 ft/s. Under load,
//                         with roller losses and a sagging battery, a real bot cruises at ~90%.
//   STRAFE_EFF 0.80       mecanum rollers slip sideways: the same wheel speed moves the robot
//                         ~20% slower when strafing than when driving forward.
//   turnRate   380 °/s    spin = v_wheel / ((L + W) / 2). Spinning in place the wheels carry
//                         little load and run near free speed (7.2 ft/s); a compact
//                         12 in × 12 in wheelbase gives 7.2 ft/s ÷ 1.0 ft = 7.2 rad/s =
//                         412 °/s ideal, ~8% roller scrub → 380 °/s. Note that turning while
//                         driving is slower: the wheel-power normalisation below shares the
//                         motors, so full forward + full spin gives half of each (190 °/s).
//   accel      20 ft/s²   traction-limited: μ ≈ 0.65 for mecanum rollers on foam tiles →
//                         0.65 g = 21 ft/s². The motors could do twice that (4 × 2.4 N·m stall
//                         ÷ 0.048 m = 200 N on 16 kg = 41 ft/s²), so the tiles set the cap.
//   braking    20 ft/s²   BRAKE mode shorts the windings; back-EMF braking is the same order
//                         as the drive torque and is also traction-limited. FLOAT ≈ 3 ft/s².
//   MOTOR_TAU  0.20 s     a DC motor under load is a first-order system:
//                         v(t) = v_max · (1 − e^(−t/τ)). τ = 0.2 s puts 0 → 95% at 0.6 s.
//   inputDelay 80 ms      gamepad poll (20–50 ms) + Driver Station → Robot Controller Wi-Fi
//                         (10–30 ms) + loop period (~20 ms) + motor controller (~10 ms).
//
// Per frame:
//   1. stick → (fwd, str, rot) command in the robot frame (field-centric rotates by heading)
//   2. mecanum inverse kinematics → four wheel powers, normalised so none exceeds 1 — the same
//      code every FTC TeleOp runs. This is what makes the robot slow down when it turns while
//      driving, and a full-stick diagonal ~30% slower than a straight (only two wheels pull).
//   3. forward kinematics → the body velocity those wheel powers can actually produce
//   4. the body velocity, tracked in the robot frame, follows that target with a first-order
//      lag (MOTOR_TAU), capped by traction (accel) while driving and by braking once the stick
//      is released. The wheels roll without slipping, so the velocity vector turns with the
//      body (the sideways force that needs, v·ω, stays well under the traction cap); a robot
//      that spins while driving therefore curves the way a real one does. Tank drive has no
//      sideways component at all.
//   5. rotate to the field frame and integrate; the field walls and (in free drive) the field
//      elements clamp the position and kill the velocity into them.

const STRAFE_EFF = 0.80;   // strafe speed as a share of forward speed at the same wheel speed
const MOTOR_TAU  = 0.20;   // s — first-order motor/drivetrain time constant
const ZERO_CMD   = 0.02;   // below this the stick is "released" → braking instead of driving

let cfg = { maxSpd: 6.5, turnRate: 380, robotSz: 18, deadzone: 0.10, accel: 20, braking: 20, inputDelay: 80 };
// vFwd/vStr: body velocity in the robot frame (ft/s) — the state the physics integrates;
// actualVx/actualVy (= vx/vy): the same rotated into the field frame; actualOmega °/s.
let bot = { x: 0, y: 0, hdg: 0, vx: 0, vy: 0, actualVx: 0, actualVy: 0, actualOmega: 0, vFwd: 0, vStr: 0 };
let mtr = { fl: 0, fr: 0, bl: 0, br: 0 };
let drivetrain = 'mecanum';
let driveMode  = 'field';

function dz(v) {
  const d = cfg.deadzone;
  return Math.abs(v) < d ? 0 : Math.sign(v) * (Math.abs(v) - d) / (1 - d);
}

// Move `current` toward `target` by `delta` without crossing it.
function stepTo(current, target, delta) {
  const next = current + delta;
  return (target - current) * (target - next) < 0 ? target : next;
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
  const sinH = Math.sin(h), cosH = Math.cos(h);
  const fwd = -dly, str = dlx, rot = drx;

  // 1. Command in the robot frame
  let cFwd = fwd, cStr = str;
  if (drivetrain === 'tank') {
    cStr = 0;
  } else if (driveMode === 'field') {
    cFwd =  fwd * cosH + str * sinH;
    cStr = -fwd * sinH + str * cosH;
  }

  // 2./3. Wheel powers (normalised) and the body command they can deliver
  let aFwd, aStr, aRot;
  if (drivetrain === 'mecanum') {
    let fl = cFwd + cStr + rot, fr = cFwd - cStr - rot;
    let bl = cFwd - cStr + rot, br = cFwd + cStr - rot;
    const mx = Math.max(1, Math.abs(fl), Math.abs(fr), Math.abs(bl), Math.abs(br));
    fl /= mx; fr /= mx; bl /= mx; br /= mx;
    mtr.fl = fl; mtr.fr = fr; mtr.bl = bl; mtr.br = br;
    aFwd = (fl + fr + bl + br) / 4;
    aStr = (fl - fr - bl + br) / 4;
    aRot = (fl - fr + bl - br) / 4;
  } else {
    let L = cFwd + rot, R = cFwd - rot;
    const mx = Math.max(1, Math.abs(L), Math.abs(R));
    L /= mx; R /= mx;
    mtr.fl = mtr.bl = L;
    mtr.fr = mtr.br = R;
    aFwd = (L + R) / 2; aStr = 0; aRot = (L - R) / 2;
  }
  const tFwd = aFwd * cfg.maxSpd;
  const tStr = aStr * cfg.maxSpd * STRAFE_EFF;
  const tRot = aRot * cfg.turnRate;

  // 4. First-order response in the robot frame, capped by traction or braking.
  // The robot-frame velocity co-rotates with the body (rolling wheels do not slip sideways).
  let vFwd = bot.vFwd, vStr = bot.vStr;
  const released = Math.abs(aFwd) < ZERO_CMD && Math.abs(aStr) < ZERO_CMD;
  const linCap = released ? cfg.braking : cfg.accel;
  let dF = (tFwd - vFwd) / MOTOR_TAU, dS = (tStr - vStr) / MOTOR_TAU;
  const mag = Math.hypot(dF, dS);
  if (mag > linCap) { dF *= linCap / mag; dS *= linCap / mag; }
  vFwd = stepTo(vFwd, tFwd, dF * dt);
  vStr = stepTo(vStr, tStr, dS * dt);
  if (drivetrain === 'tank') vStr = 0;

  const rotCap = (Math.abs(aRot) < ZERO_CMD ? cfg.braking : cfg.accel) * (cfg.turnRate / Math.max(0.1, cfg.maxSpd));
  const dR = Math.max(-rotCap, Math.min(rotCap, (tRot - bot.actualOmega) / MOTOR_TAU));
  bot.actualOmega = stepTo(bot.actualOmega, tRot, dR * dt);

  // 5. Rotate to the field frame; integrate
  bot.actualVx = vFwd * sinH + vStr * cosH;
  bot.actualVy = vFwd * cosH - vStr * sinH;

  bot.x   += bot.actualVx    * dt;
  bot.y   += bot.actualVy    * dt;
  bot.hdg += bot.actualOmega * dt;
  bot.hdg = ((bot.hdg + 180) % 360 + 360) % 360 - 180;

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

  // A wall or field element may have killed a field-frame component: bring the
  // robot-frame state back in line with what is left.
  bot.vFwd = bot.actualVx * sinH + bot.actualVy * cosH;
  bot.vStr = bot.actualVx * cosH - bot.actualVy * sinH;
  if (drivetrain === 'tank') bot.vStr = 0;
  bot.vx = bot.actualVx;
  bot.vy = bot.actualVy;
}

function cfgUpdate() {
  cfg.maxSpd    = parseFloat(document.getElementById('s-ms').value);
  cfg.turnRate  = parseFloat(document.getElementById('s-tr').value);
  cfg.robotSz   = parseFloat(document.getElementById('s-rs').value);
  cfg.deadzone  = parseFloat(document.getElementById('s-dz').value);
  cfg.accel     = parseFloat(document.getElementById('s-ac').value);
  cfg.braking   = parseFloat(document.getElementById('s-fr').value);
  cfg.inputDelay = parseFloat(document.getElementById('s-rd').value);
  document.getElementById('s-ms-v').textContent = cfg.maxSpd.toFixed(1) + ' ft/s';
  document.getElementById('s-tr-v').textContent = cfg.turnRate + ' °/s';
  document.getElementById('s-rs-v').textContent = cfg.robotSz + ' in';
  document.getElementById('s-dz-v').textContent = cfg.deadzone.toFixed(2);
  document.getElementById('s-ac-v').textContent = cfg.accel + ' ft/s²';
  document.getElementById('s-fr-v').textContent = cfg.braking + ' ft/s²';
  document.getElementById('s-rd-v').textContent = cfg.inputDelay + ' ms';
}
