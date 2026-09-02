// ── R-Tracker v2 — Structural code checker ───────────────────────────────────
// Checks a student's Java submission against the per-phase pattern rules in
// js/curriculum/code-rules.js. It is a STRUCTURAL check: it looks for required
// patterns (hardwareMap.get, setPower, enums, PID constants, …) and known bad
// patterns. It does not compile, run, or upload anything, and the UI says so.
//
// HARD RULE: student code is never executed or evaluated. String inspection only.
//
// Return shape:
//   { status: 'graded' | 'reflection' | 'ungraded', grader: 'structural' | null, graderVersion,
//     passed, score (0-100), summary, strengths[], issues[{severity, description, line, fix}],
//     requirements_met[{requirement, met, explanation}], next_steps[], structural: true }
//   or { error: true, message } for rejected input.
//
// Exposes: window.checkCode(phaseId, code), window.getPhaseRequirements(phaseId), window.RTCodeCheck

(function () {
  'use strict';

  var VERSION = 'structural-1';
  var MAX_CODE_LENGTH = 50000;
  var DISCLAIMER = 'Structural check only — this looks for required patterns in your code; it does not compile, run, or verify that it works.';

  // Human-readable requirement lists per phase (shown to the student as the target).
  var PHASE_REQUIREMENTS = {
    phase1: [
      'Initializes at least 2 motors and 1 servo via hardwareMap.get()',
      'Drives using gamepad joystick input with Y-axis properly inverted (negative sign)',
      'Controls at least one mechanism using gamepad buttons or triggers',
      'Displays at least 2 telemetry values with telemetry.update()',
      'Uses comments explaining why, not just what',
      'Code compiles (no obvious syntax errors)'
    ],
    phase2: [
      'Drivetrain is a separate subsystem class with no direct hardware calls in the main OpMode',
      'At least one mechanism is a separate subsystem class',
      'Subsystems use encapsulation (private fields, public methods)',
      'Uses enums for state management (no magic numbers or strings)',
      'Has a Robot class that initializes all subsystems',
      'Main TeleOp contains zero direct hardware calls'
    ],
    phase3: [
      'Reads at least one sensor (color, distance, or touch)',
      'Makes decisions based on sensor values (if/else with thresholds)',
      'Autonomous structure with sequential actions',
      'Uses subsystem architecture from Phase 2',
      'Has proper timing or state-based transitions'
    ],
    phase4: [
      'Uses encoder-based movement (not time-based)',
      'Implements PID or PIDF control for at least one mechanism',
      'Uses Pedro Pathing or equivalent path following with BezierLine/BezierCurve',
      'Has at least 3 waypoints in the autonomous path',
      'Uses pose-based navigation (x, y, heading)'
    ],
    phase5: [
      'Identifies and fixes at least 3 bugs in the provided code',
      'Explains each bug clearly (what was wrong and why)',
      'Fixes don\'t introduce new bugs',
      'Uses telemetry for debugging',
      'Demonstrates systematic debugging approach'
    ],
    advanced_command: [
      'Drivetrain subsystem extends SubsystemBase',
      'A FollowPath command wraps Pedro Pathing followPath() and isBusy()',
      'A RunIntake command runs for a specified duration',
      'A SequentialCommandGroup replicates the original autonomous',
      'Includes a short comparison of both versions (readability, modifiability)'
    ],
    advanced_strategy: [
      'Expected value calculation for the current autonomous (success rate × points)',
      'A 3-tier autonomous design with clear tier selection criteria',
      'Timer-based fallbacks and end-of-auto protection added to existing code',
      'A match log template the team can use at competition',
      'A 1-page strategy document for the next competition'
    ],
    capstone: [
      'Works from either alliance starting position',
      'Scores at least 2 game elements autonomously',
      'Uses odometry for navigation (no time-based driving)',
      'At least one sensor-based decision',
      'Ends parked in the correct zone',
      'Completes reliably in under 30 seconds'
    ]
  };

  // ── Text preparation ──────────────────────────────────────────────────────
  // Replace comments and string/char literals with spaces so patterns only see code.
  // Newlines are preserved so line numbers stay meaningful.
  function stripCommentsAndStrings(src) {
    var out = '';
    var i = 0, n = src.length;
    while (i < n) {
      var c = src[i], d = src[i + 1];
      if (c === '/' && d === '/') {                       // line comment
        while (i < n && src[i] !== '\n') { out += ' '; i++; }
      } else if (c === '/' && d === '*') {                // block comment
        out += '  '; i += 2;
        while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { out += src[i] === '\n' ? '\n' : ' '; i++; }
        if (i < n) { out += '  '; i += 2; }
      } else if (c === '"' || c === "'") {                // string / char literal
        var q = c; out += ' '; i++;
        while (i < n && src[i] !== q) { if (src[i] === '\\') { out += ' '; i++; } out += src[i] === '\n' ? '\n' : ' '; i++; }
        if (i < n) { out += ' '; i++; }
      } else {
        out += c; i++;
      }
    }
    return out;
  }

  function countMatches(pattern, text) {
    var flags = pattern.flags.indexOf('g') === -1 ? pattern.flags + 'g' : pattern.flags;
    var m = text.match(new RegExp(pattern.source, flags));
    return m ? m.length : 0;
  }

  function firstMatchLine(pattern, text) {
    var re = new RegExp(pattern.source, pattern.flags.replace('g', ''));
    var m = re.exec(text);
    if (!m) return null;
    var line = text.slice(0, m.index).split('\n').length;
    var snippet = (text.split('\n')[line - 1] || '').trim().slice(0, 80);
    return 'line ' + line + (snippet ? ': ' + snippet : '');
  }

  // ── Checking ──────────────────────────────────────────────────────────────
  function runRules(rules, raw) {
    var stripped = stripCommentsAndStrings(raw);
    var totalWeight = 0, earned = 0;
    var requirements = [], strengths = [], issues = [], nextSteps = [];

    (rules.required || []).forEach(function (r) {
      var text = r.raw ? raw : stripped;
      var count = countMatches(r.pattern, text);
      var min = r.min || 1;
      var met = count >= min && (!r.also || r.also.test(text));
      var weight = r.weight || 10;
      totalWeight += weight;
      if (met) earned += weight;
      var why = met
        ? (min > 1 ? 'Found ' + count + ' (needs ' + min + ').' : 'Found.')
        : (count > 0 && count < min ? 'Found ' + count + ' — needs at least ' + min + '.' : (count >= min && r.also ? 'Pattern found but a required companion is missing.' : 'Not found.'));
      requirements.push({ id: r.id, requirement: r.label, met: met, explanation: why });
      if (met) strengths.push(r.label);
      else {
        issues.push({ severity: 'WARNING', description: 'Missing: ' + r.label, line: '', fix: r.hint });
        nextSteps.push(r.hint);
      }
    });

    var penalty = 0, critical = false;
    (rules.forbidden || []).forEach(function (f) {
      var text = f.raw ? raw : stripped;
      var hit = f.test ? !!f.test(stripped, raw) : (f.pattern ? new RegExp(f.pattern.source, f.pattern.flags.replace('g', '')).test(text) : false);
      if (!hit) return;
      penalty += f.penalty || 10;
      if (f.severity === 'CRITICAL') critical = true;
      issues.push({ severity: f.severity || 'WARNING', description: f.label + ' — ' + f.hint, line: f.pattern ? (firstMatchLine(f.pattern, text) || '') : '', fix: f.hint });
    });

    var score = totalWeight ? Math.round((earned / totalWeight) * 100) - penalty : 0;
    score = Math.max(0, Math.min(100, score));
    var threshold = typeof rules.passThreshold === 'number' ? rules.passThreshold : 75;
    var passed = !critical && score >= threshold;
    var metCount = requirements.filter(function (q) { return q.met; }).length;

    var summary = DISCLAIMER + ' Found ' + metCount + ' of ' + requirements.length + ' required patterns' +
      (penalty ? ', with ' + issues.filter(function (i) { return i.description.indexOf('Missing:') !== 0; }).length + ' problem pattern(s)' : '') +
      ' — score ' + score + '/100' + (passed ? ' (passes the structural check).' : ' (needs ' + threshold + ' to auto-verify).');

    // Order issues: CRITICAL first, then WARNING, then SUGGESTION
    var order = { CRITICAL: 0, WARNING: 1, SUGGESTION: 2 };
    issues.sort(function (a, b) { return (order[a.severity] || 1) - (order[b.severity] || 1); });

    return {
      status: 'graded',
      grader: 'structural',
      graderVersion: VERSION + '/' + (window.CODE_RULES_VERSION || 'rules-?'),
      passed: passed,
      score: score,
      summary: summary,
      strengths: strengths.slice(0, 6),
      issues: issues,
      requirements_met: requirements.map(function (q) { return { requirement: q.requirement, met: q.met, explanation: q.explanation }; }),
      next_steps: nextSteps.slice(0, 4),
      structural: true
    };
  }

  function checkCode(phaseId, code) {
    if (typeof code !== 'string') code = '';
    if (code.length > MAX_CODE_LENGTH) {
      return { error: true, message: 'Code submission is too long. Please keep it under ' + MAX_CODE_LENGTH.toLocaleString() + ' characters.' };
    }
    var rules = window.CODE_RULES && window.CODE_RULES[phaseId];
    if (rules && rules.reflection) {
      return {
        status: 'reflection', grader: null, graderVersion: null, passed: null, score: null,
        summary: rules.note || 'This deliverable is kept for your mentor to review; there is no automatic check.',
        strengths: [], issues: [], requirements_met: [], next_steps: [], structural: true
      };
    }
    if (!rules) {
      return {
        status: 'ungraded', grader: null, graderVersion: null, passed: null, score: null,
        summary: 'There is no structural check for this phase yet. Your submission is saved in your progress file so a mentor can review it.',
        strengths: [], issues: [], requirements_met: [], next_steps: [], structural: true
      };
    }
    return runRules(rules, code);
  }

  window.getPhaseRequirements = function (phaseId) { return PHASE_REQUIREMENTS[phaseId] || []; };
  window.checkCode = checkCode;
  window.RTCodeCheck = { VERSION: VERSION, DISCLAIMER: DISCLAIMER, stripCommentsAndStrings: stripCommentsAndStrings, countMatches: countMatches, runRules: runRules, checkCode: checkCode, PHASE_REQUIREMENTS: PHASE_REQUIREMENTS };

  if (typeof module !== 'undefined' && module.exports) module.exports = window.RTCodeCheck;
})();
