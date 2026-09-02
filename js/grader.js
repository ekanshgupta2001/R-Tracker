// ── R-Tracker v2 — Theory answer grader (rubric-based, deterministic) ────────
// Grades a written answer against the rubric attached to the lesson check in
// js/curriculum/lessons.js. No network, no model: normalize → fuzzy-match each
// required concept's accepted phrasings → score = concepts hit / concepts required
// → pass at the rubric threshold unless a disqualifying misconception is present.
//
// Rubric shape (on check):
//   rubric: {
//     threshold: 0.7,                          // fraction of concepts needed to pass
//     concepts: [ { id, label, phrases: ['…', …], hint } ],
//     disqualifiers: [ { phrases: ['…'], feedback } ]   // optional; a hit fails the answer
//   }
//   graded: false  → reflection: stored for a mentor, never scored
//
// Return shape (same as the Phase 1 stub):
//   { status: 'graded' | 'reflection' | 'ungraded', grader, graderVersion, passed, score,
//     feedback, strengths[], misconceptions[], suggestion, hits[], missed[] }
//   or { error: true, message } for rejected input.
//
// Exposes: window.gradeTheoryAnswer(phaseId, sectionId, question, answer), window.RTGrader

(function () {
  'use strict';

  var VERSION = 'rubric-1';
  var MAX_THEORY_LENGTH = 5000;

  // ── Text normalization ────────────────────────────────────────────────────
  function normalize(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/[‘’ʼ]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[–—]/g, '-')
      .replace(/×/g, 'x')
      .replace(/[^a-z0-9%.\/\-\s']/g, ' ')
      .replace(/(\d),(\d{3})(?!\d)/g, '$1$2')     // 1,000 → 1000 (but "24, 24" stays two numbers)
      .replace(/\s+/g, ' ')
      .trim();
  }

  function tokens(s) {
    return normalize(s).split(' ').filter(Boolean).map(function (t) { return t.replace(/^[.'-]+|[.'-]+$/g, ''); }).filter(Boolean);
  }

  function levenshtein(a, b) {
    if (a === b) return 0;
    var m = a.length, n = b.length;
    if (!m) return n;
    if (!n) return m;
    var prev = new Array(n + 1), cur = new Array(n + 1), i, j;
    for (j = 0; j <= n; j++) prev[j] = j;
    for (i = 1; i <= m; i++) {
      cur[0] = i;
      for (j = 1; j <= n; j++) {
        var cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      }
      var tmp = prev; prev = cur; cur = tmp;
    }
    return prev[n];
  }

  // Word-level fuzzy equality: exact, or 1 edit for words ≥ 5 chars, 2 edits for words ≥ 9 chars.
  function wordMatch(a, b) {
    if (a === b) return true;
    var len = Math.min(a.length, b.length);
    if (len < 5) return false;
    var d = levenshtein(a, b);
    return d <= (len >= 9 ? 2 : 1);
  }

  // Does the phrase occur in the answer? Exact normalized substring first, then a fuzzy
  // word-sequence match (each phrase word must fuzzy-match consecutive answer words).
  function phraseMatches(phrase, normAnswer, answerTokens) {
    var np = normalize(phrase);
    if (!np) return false;
    var pw = tokens(np);
    if (!pw.length) return false;
    // Short single words must match a whole token ("up" must not match "update").
    if (pw.length === 1 && pw[0].length < 5) return answerTokens.indexOf(pw[0]) !== -1;
    if (normAnswer.indexOf(np) !== -1) return true;
    for (var i = 0; i + pw.length <= answerTokens.length; i++) {
      var ok = true;
      for (var j = 0; j < pw.length; j++) {
        if (!wordMatch(pw[j], answerTokens[i + j])) { ok = false; break; }
      }
      if (ok) return true;
    }
    return false;
  }

  // ── Rubric lookup ─────────────────────────────────────────────────────────
  function findSection(phaseId, sectionId) {
    var lessons = window.PHASE_LESSONS && window.PHASE_LESSONS[phaseId];
    if (!lessons) return null;
    for (var i = 0; i < lessons.length; i++) if (lessons[i].id === sectionId) return lessons[i];
    return null;
  }

  // ── Grading ───────────────────────────────────────────────────────────────
  function gradeWithRubric(answer, rubric) {
    var normAnswer = normalize(answer);
    var answerTokens = tokens(answer);
    var concepts = rubric.concepts || [];
    var hits = [], missed = [];
    concepts.forEach(function (c) {
      var matched = (c.phrases || []).some(function (p) { return phraseMatches(p, normAnswer, answerTokens); });
      (matched ? hits : missed).push(c);
    });
    var misconceptions = [];
    (rubric.disqualifiers || []).forEach(function (d) {
      if ((d.phrases || []).some(function (p) { return phraseMatches(p, normAnswer, answerTokens); })) misconceptions.push(d.feedback || 'This contains a common misconception.');
    });

    var total = concepts.length || 1;
    var ratio = hits.length / total;
    var score = Math.round(ratio * 100);
    var threshold = typeof rubric.threshold === 'number' ? rubric.threshold : 0.7;
    var disqualified = misconceptions.length > 0;
    if (disqualified) score = Math.min(score, 40);
    var passed = !disqualified && ratio >= threshold - 1e-9;

    var labelOf = function (c) { return c.label || c.id; };
    var feedback;
    if (passed) {
      feedback = 'Good — you covered ' + hits.length + ' of ' + total + ' key ideas: ' + hits.map(labelOf).join(', ') + '.';
      if (missed.length) feedback += ' You could also mention: ' + missed.map(labelOf).join(', ') + '.';
    } else if (disqualified) {
      feedback = 'Not quite. ' + misconceptions[0] + (hits.length ? ' You did cover: ' + hits.map(labelOf).join(', ') + '.' : '');
    } else {
      feedback = (hits.length ? 'You covered: ' + hits.map(labelOf).join(', ') + '. ' : 'None of the key ideas came through yet. ') +
        'Still missing: ' + missed.map(function (c) { return labelOf(c) + (c.hint ? ' — ' + c.hint : ''); }).join('; ') + '.';
    }

    return {
      status: 'graded',
      grader: 'rubric',
      graderVersion: VERSION,
      passed: passed,
      score: score,
      feedback: feedback,
      strengths: hits.map(labelOf),
      misconceptions: misconceptions,
      suggestion: missed.length && missed[0].hint ? missed[0].hint : '',
      hits: hits.map(function (c) { return c.id; }),
      missed: missed.map(function (c) { return c.id; })
    };
  }

  function grade(phaseId, sectionId, question, answer) {
    if (typeof answer !== 'string') answer = '';
    if (answer.length > MAX_THEORY_LENGTH) {
      return { error: true, message: 'Answer is too long. Please keep it under ' + MAX_THEORY_LENGTH.toLocaleString() + ' characters.' };
    }
    var sec = findSection(phaseId, sectionId);
    var check = sec && sec.check;
    if (check && check.graded === false) {
      return {
        status: 'reflection', grader: null, graderVersion: null, passed: null, score: null,
        feedback: 'This is a reflection question — there is no single right answer. Your answer is kept in your progress file for your mentor to read.',
        strengths: [], misconceptions: [], suggestion: '', hits: [], missed: []
      };
    }
    if (!check || !check.rubric) {
      return {
        status: 'ungraded', grader: null, graderVersion: null, passed: null, score: null,
        feedback: 'This question has no rubric yet. Your answer is saved in your progress file so a mentor can read it.',
        strengths: [], misconceptions: [], suggestion: '', hits: [], missed: []
      };
    }
    return gradeWithRubric(answer, check.rubric);
  }

  window.gradeTheoryAnswer = grade;
  window.RTGrader = { VERSION: VERSION, normalize: normalize, tokens: tokens, levenshtein: levenshtein, wordMatch: wordMatch, phraseMatches: phraseMatches, gradeWithRubric: gradeWithRubric, grade: grade };

  if (typeof module !== 'undefined' && module.exports) module.exports = window.RTGrader;
})();
