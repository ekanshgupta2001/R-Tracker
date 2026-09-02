// Phase 4 gate (node --test): the rubric grader agrees with the hand-labeled fixture set
// (tests/fixtures/theory-samples.json) on at least 90% of answers, and every theory
// question in the curriculum carries a rubric or is explicitly graded: false.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadClassic(files) {
  const sandbox = { window: {}, console };
  sandbox.window.window = sandbox.window;
  for (const f of files) vm.runInNewContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
  return sandbox.window;
}

const win = loadClassic(['js/curriculum/lessons.js', 'js/grader.js']);
const fixtures = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/fixtures/theory-samples.json'), 'utf8')).samples;

function phaseOf(sectionId) {
  for (const pid of Object.keys(win.PHASE_LESSONS)) {
    if (win.PHASE_LESSONS[pid].some(s => s.id === sectionId)) return pid;
  }
  return null;
}

test('every written-answer check has a rubric or is graded: false', () => {
  const problems = [];
  for (const pid of Object.keys(win.PHASE_LESSONS)) {
    for (const sec of win.PHASE_LESSONS[pid]) {
      if (!sec.check || sec.check.type !== 'written_answer') continue;
      const c = sec.check;
      if (c.graded === false) continue;
      if (!c.rubric || !Array.isArray(c.rubric.concepts) || c.rubric.concepts.length < 2) problems.push(pid + '/' + sec.id + ': missing rubric');
      else {
        c.rubric.concepts.forEach(k => { if (!k.id || !Array.isArray(k.phrases) || !k.phrases.length || !k.hint) problems.push(pid + '/' + sec.id + '/' + (k.id || '?') + ': concept needs id, phrases, hint'); });
      }
    }
  }
  assert.deepEqual(problems, []);
});

test('grader agrees with the hand-labeled fixture set on ≥ 90% of answers', () => {
  let agree = 0;
  const disagreements = [];
  const graded = [];
  for (const s of fixtures) {
    const pid = phaseOf(s.sectionId);
    assert.ok(pid, 'unknown section ' + s.sectionId);
    const r = win.gradeTheoryAnswer(pid, s.sectionId, '', s.answer);
    if (r.status === 'reflection') continue;               // reflections are not graded by design
    graded.push(s);
    assert.equal(r.status, 'graded', s.sectionId + ' returned ' + r.status);
    const expected = s.label === 'correct';
    if (r.passed === expected) agree++;
    else disagreements.push(`${s.sectionId} [${s.label}] → passed=${r.passed} score=${r.score} missed=${(r.missed || []).join(',')}${r.misconceptions.length ? ' dq=' + r.misconceptions[0].slice(0, 40) : ''}`);
  }
  const rate = agree / graded.length;
  console.log(`grader agreement: ${agree}/${graded.length} = ${(rate * 100).toFixed(1)}%`);
  if (disagreements.length) console.log('disagreements:\n  ' + disagreements.join('\n  '));
  assert.ok(rate >= 0.9, 'agreement below 90%');
});

test('score bands: correct answers score high, incorrect answers score low', () => {
  const bad = [];
  for (const s of fixtures) {
    const pid = phaseOf(s.sectionId);
    const r = win.gradeTheoryAnswer(pid, s.sectionId, '', s.answer);
    if (r.status !== 'graded') continue;
    if (s.label === 'correct' && r.score < 70) bad.push(`${s.sectionId} correct scored ${r.score}`);
    if (s.label === 'incorrect' && r.score > 50) bad.push(`${s.sectionId} incorrect scored ${r.score}`);
  }
  if (bad.length) console.log('band outliers:\n  ' + bad.join('\n  '));
  assert.ok(bad.length <= Math.ceil(fixtures.length * 0.1), 'too many score-band outliers');
});

test('grader primitives: normalization and fuzzy matching', () => {
  const G = win.RTGrader;
  assert.equal(G.normalize("The Robot's  heading—drifts (a lot)!"), "the robot's heading-drifts a lot");
  assert.equal(G.levenshtein('lighting', 'lightning'), 1);
  assert.ok(G.wordMatch('lighting', 'lightning'));     // 1 edit at ≥ 5 chars is a match
  assert.ok(G.wordMatch('lights', 'light'));            // plural/singular
  assert.ok(!G.wordMatch('lighting', 'light'));         // 3 edits is not
  assert.ok(!G.wordMatch('gym', 'gum'));                // short words must be exact
  const src = 'Ambient light differs between rooms. Set up the sensor.';
  const t = G.tokens(src);
  assert.ok(G.phraseMatches('ambient lights', G.normalize(src), t));
  assert.ok(!G.phraseMatches('battery voltage', G.normalize(src), t));
  assert.ok(G.phraseMatches('up', G.normalize(src), t));                 // whole-token match
  assert.ok(!G.phraseMatches('up', G.normalize('Please update it.'), G.tokens('Please update it.')));  // not inside "update"
});
