// ── Gemini AI Code Review for R-Tracker Curriculum ──────────────────────────
// Requires: GEMINI_API_KEY from config.js
// Exposes: window.reviewStudentCode()

(function () {
  'use strict';

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

  var SYSTEM_PROMPT = 'You are an expert FTC robotics programming mentor reviewing a student\'s Java code submission. You are strict but encouraging. Your job is to evaluate whether the code meets the specific deliverable requirements for their current curriculum phase.\n\nIMPORTANT RULES:\n- Be specific about what\'s wrong and what\'s right. Quote actual lines from their code.\n- Don\'t just say "good job" \u2014 point out exactly what they did well and why it matters.\n- Don\'t just say "this is wrong" \u2014 explain what the correct approach is with a brief example.\n- Evaluate against the SPECIFIC deliverable requirements provided, not general code quality.\n- If the code has a bug that would crash on the robot, flag it as CRITICAL.\n- If the code works but has bad practices, flag it as WARNING.\n- If the code demonstrates good understanding, flag it as STRENGTH.\n- Be aware of common FTC-specific issues: inverted Y-axis, hardware map typos, sleep() in iterative opmode, missing telemetry.update(), motor direction issues, encoder modes.\n\nSCORING GUIDELINES:\n- Score 85-100: All requirements met, good practices, minor suggestions only\n- Score 70-84: All requirements met but has warnings (bad variable names, missing motor direction, non-ideal logic). This should still PASS.\n- Score 50-69: Most requirements met but has 1-2 CRITICAL issues that would cause real problems on the robot (wrong Y-axis, missing telemetry.update, sleep in teleop loop). This should FAIL.\n- Score 30-49: Multiple requirements not met, fundamental misunderstanding of the phase concepts\n- Score 0-29: Barely any requirements met, wrong approach entirely\n\nIMPORTANT: If ALL requirements are technically met, the score MUST be at least 70 and passed MUST be true, even if there are warnings about bad practices. Warnings about style, naming, or non-critical improvements should NOT cause a failure. Only CRITICAL issues that would cause the robot to malfunction should cause a failure.\n\nA CRITICAL issue is: code that would crash, robot driving backwards when pushing forward (wrong Y-axis), telemetry not displaying (missing update()), sleep() in an iterative loop, or hardware map mismatch.\n\nA WARNING is: bad variable names, missing motor direction reversal, magic numbers, no deadband, power not clipped. These reduce the score but do NOT cause failure.\n\nRespond ONLY in this exact JSON format with no markdown or extra text:\n{\n  "passed": true/false,\n  "score": 0-100,\n  "summary": "2-3 sentence overall assessment",\n  "strengths": ["specific strength 1", "specific strength 2"],\n  "issues": [\n    {"severity": "CRITICAL/WARNING/SUGGESTION", "description": "what\'s wrong", "line": "the problematic code", "fix": "how to fix it"}\n  ],\n  "requirements_met": [\n    {"requirement": "requirement text", "met": true/false, "explanation": "why"}\n  ],\n  "next_steps": ["specific recommendation 1", "specific recommendation 2"]\n}';

  window.getPhaseRequirements = function (phaseId) {
    return PHASE_REQUIREMENTS[phaseId] || [];
  };

  window.reviewStudentCode = async function (phaseId, studentCode) {
    var reqs = PHASE_REQUIREMENTS[phaseId];
    if (!reqs) return null;

    var phaseNum = phaseId.replace('phase', '').replace('capstone', 'C');
    var reqText = reqs.map(function (r, i) { return (i + 1) + '. ' + r; }).join('\n');

    var userPrompt = 'PHASE ' + phaseNum + ' CODE REVIEW\n\nDELIVERABLE REQUIREMENTS:\n' + reqText + '\n\nSTUDENT\'S CODE:\n```java\n' + studentCode + '\n```\n\nReview this code against the deliverable requirements. Be thorough and specific.';

    var url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + GEMINI_API_KEY;

    console.log('Sending to Gemini, code length:', studentCode.length);

    var response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: SYSTEM_PROMPT + '\n\n' + userPrompt }] }
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 8192
        }
      })
    });

    if (!response.ok) {
      throw new Error('Gemini API returned ' + response.status);
    }

    var data = await response.json();
    console.log('Gemini raw response:', JSON.stringify(data).substring(0, 500));

    // Extract text from all parts (Gemini 2.5 may have thinking + response parts)
    var text = '';
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      var parts = data.candidates[0].content.parts;
      for (var p = 0; p < parts.length; p++) {
        if (parts[p].text) {
          text += parts[p].text;
        }
      }
    }

    if (!text) {
      console.error('No text in Gemini response:', data);
      return null;
    }

    console.log('Gemini text response:', text.substring(0, 500));

    // Clean the text: remove markdown fences, extra whitespace, and find the JSON object
    var clean = text;
    clean = clean.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
    var firstBrace = clean.indexOf('{');
    var lastBrace = clean.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      console.error('No JSON object found in response:', clean);
      return null;
    }
    clean = clean.substring(firstBrace, lastBrace + 1);

    try {
      return JSON.parse(clean);
    } catch (parseError) {
      console.error('JSON parse failed:', parseError, 'Clean text:', clean.substring(0, 300));
      return null;
    }
  };
})();
