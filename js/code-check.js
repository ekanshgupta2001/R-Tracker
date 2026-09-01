// ── R-Tracker v2 — Structural code checker ───────────────────────────────────
// Phase 1 STUB. Returns { status: 'ungraded' } for every submission; nothing
// auto-verifies. Phase 5 replaces the body with regex/string pattern checks
// (js/curriculum/code-rules.js) while keeping this signature and return shape.
//
// HARD RULE: student code is never executed, evaluated, or uploaded. String
// inspection only.
//
// Return shape:
//   { status: 'ungraded' | 'graded' | 'reflection',
//     grader: null | 'structural', graderVersion: null | string,
//     passed: null | boolean, score: null | 0-100,
//     summary: string, strengths: string[],
//     issues: [{ severity: 'CRITICAL'|'WARNING'|'SUGGESTION', description, line, fix }],
//     requirements_met: [{ requirement, met, explanation }],
//     next_steps: string[] }
//   or { error: true, message: string } for rejected input.
//
// Exposes: window.checkCode(phaseId, code), window.getPhaseRequirements(phaseId)

(function () {
  'use strict';

  var MAX_CODE_LENGTH = 50000;

  // Human-readable requirement lists per phase. Phase 5 derives its pattern rules
  // from these; until then they are shown to the student as the target.
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

  window.getPhaseRequirements = function (phaseId) {
    return PHASE_REQUIREMENTS[phaseId] || [];
  };

  window.checkCode = function (phaseId, code) {
    if (typeof code !== 'string') code = '';
    if (code.length > MAX_CODE_LENGTH) {
      return { error: true, message: 'Code submission is too long. Please keep it under ' + MAX_CODE_LENGTH.toLocaleString() + ' characters.' };
    }
    return {
      status: 'ungraded',
      grader: null,
      graderVersion: null,
      passed: null,
      score: null,
      summary: 'Automatic checking is not available in this version. Your submission is saved in your progress file so a mentor can review it.',
      strengths: [],
      issues: [],
      requirements_met: [],
      next_steps: []
    };
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { checkCode: window.checkCode, getPhaseRequirements: window.getPhaseRequirements, PHASE_REQUIREMENTS: PHASE_REQUIREMENTS };
  }
})();
