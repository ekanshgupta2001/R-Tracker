// ── Gemini AI Code Review for R-Tracker Curriculum ──────────────────────────
// Uses /api/review serverless function with server-side rate limiting and prompt construction.
// Exposes: window.reviewStudentCode(), window.reviewTheoryAnswer(), window.getGeminiRateInfo()

(function () {
  'use strict';

  var MAX_CODE_LENGTH = 50000;
  var MAX_THEORY_LENGTH = 5000;

  var _remainingReviews = 10;

  window.getGeminiRateInfo = function () {
    return { remaining: _remainingReviews, max: 10 };
  };

  // ── Call server-side review API with structured data ──────────────────
  async function callReviewAPI(body) {
    var user = firebase.auth().currentUser;
    if (!user) throw new Error('Please sign in to use AI reviews.');

    var token = await user.getIdToken();

    var response = await fetch('/api/review', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify(body)
    });

    var data = await response.json();

    if (!response.ok) {
      if (typeof data.remaining === 'number') _remainingReviews = data.remaining;
      throw new Error(data.error || 'AI review failed (' + response.status + ')');
    }

    if (data._rateLimit && typeof data._rateLimit.remaining === 'number') {
      _remainingReviews = data._rateLimit.remaining;
    }

    return data;
  }

  // ── Parse Gemini response text into JSON ──────────────────────────────
  function parseGeminiResponse(data) {
    var text = '';
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      var parts = data.candidates[0].content.parts;
      for (var p = 0; p < parts.length; p++) {
        if (parts[p].text) text += parts[p].text;
      }
    }
    if (!text) return null;

    var clean = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
    var firstBrace = clean.indexOf('{');
    var lastBrace = clean.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return null;

    return JSON.parse(clean.substring(firstBrace, lastBrace + 1));
  }

  // ── Phase requirements (sent to server for prompt construction) ───────
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

  // ── Code Review ───────────────────────────────────────────────────────
  window.reviewStudentCode = async function (phaseId, studentCode) {
    var reqs = PHASE_REQUIREMENTS[phaseId];
    if (!reqs) return null;

    if (studentCode && studentCode.length > MAX_CODE_LENGTH) {
      return { error: true, message: 'Code submission is too long. Please keep it under ' + MAX_CODE_LENGTH.toLocaleString() + ' characters.' };
    }

    var phaseNum = phaseId.replace('phase', '').replace('capstone', 'C');

    var data = await callReviewAPI({
      type: 'code_review',
      code: studentCode,
      phase: phaseNum,
      requirements: reqs
    });

    try {
      var result = parseGeminiResponse(data);
      if (!result) {
        console.error('Gemini review: no JSON in response');
        return null;
      }
      return result;
    } catch (parseError) {
      console.error('Gemini review: JSON parse failed');
      return null;
    }
  };

  // ── Theory Answer Review ──────────────────────────────────────────────
  window.reviewTheoryAnswer = async function (phaseNumber, sectionId, sectionTitle, lessonContent, question, studentAnswer) {
    if (studentAnswer && studentAnswer.length > MAX_THEORY_LENGTH) {
      return { error: true, message: 'Answer is too long. Please keep it under ' + MAX_THEORY_LENGTH.toLocaleString() + ' characters.' };
    }

    var data = await callReviewAPI({
      type: 'theory_review',
      answer: studentAnswer,
      phase: phaseNumber,
      section: sectionTitle,
      question: question,
      lessonContent: lessonContent
    });

    try {
      var result = parseGeminiResponse(data);
      if (!result) {
        console.error('[Theory Review] No JSON in response');
        return null;
      }
      return result;
    } catch (parseError) {
      console.error('[Theory Review] JSON parse failed:', parseError);
      return null;
    }
  };
})();
