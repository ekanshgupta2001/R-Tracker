// ── R-Tracker v2 — Theory answer grader ──────────────────────────────────────
// Phase 1 STUB. Returns { status: 'ungraded' } for every answer; nothing passes.
// Phase 4 replaces the body with the rubric grader (see PLAN.md) while keeping
// this signature and return shape.
//
// Return shape:
//   { status: 'ungraded' | 'graded' | 'reflection',
//     grader: null | 'rubric', graderVersion: null | string,
//     passed: null | boolean, score: null | 0-100,
//     feedback: string, strengths: string[], misconceptions: string[], suggestion: string }
//   or { error: true, message: string } for rejected input.
//
// Exposes: window.gradeTheoryAnswer(phaseId, sectionId, question, answer)

(function () {
  'use strict';

  var MAX_THEORY_LENGTH = 5000;

  window.gradeTheoryAnswer = function (phaseId, sectionId, question, answer) {
    if (typeof answer !== 'string') answer = '';
    if (answer.length > MAX_THEORY_LENGTH) {
      return { error: true, message: 'Answer is too long. Please keep it under ' + MAX_THEORY_LENGTH.toLocaleString() + ' characters.' };
    }
    return {
      status: 'ungraded',
      grader: null,
      graderVersion: null,
      passed: null,
      score: null,
      feedback: 'Automatic grading is not available in this version. Your answer is saved in your progress file so a mentor can read it.',
      strengths: [],
      misconceptions: [],
      suggestion: ''
    };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = { gradeTheoryAnswer: window.gradeTheoryAnswer };
})();
