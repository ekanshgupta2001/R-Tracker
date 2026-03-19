// ── R-Tracker Firestore Storage Utilities ─────────────────────────────────

// Helper: get the user's actual teamId (not hardcoded)
function _getTeamId() {
  return window.rtUserTeamId || null;
}

async function saveLevelResult(levelId, starCount, time, accuracy) {
  if (!rtUser) return;
  const ref = rtDb.collection('users').doc(rtUser.uid)
    .collection('levels').doc(String(levelId));
  try {
    const snap = await ref.get();
    const prevBest = snap.exists ? (snap.data().bestStars || 0) : 0;
    if (prevBest >= starCount) {
      console.log('SAVING level result: level', levelId, '— existing bestStars', prevBest, '>= new', starCount, ', skipping');
      return;
    }
    var rating = starCount === 3 ? 'gold' : starCount === 2 ? 'silver' : 'bronze';
    console.log('SAVING level result:', levelId, 'stars:', starCount, 'rating:', rating, 'time:', time, 'accuracy:', accuracy);
    console.log('Firestore WRITE path: users/' + rtUser.uid + '/levels/' + levelId);
    console.log('SAVED level', levelId, 'rating:', rating, 'to path: users/' + rtUser.uid + '/levels/' + levelId);
    await ref.set({
      bestStars: starCount,
      rating: rating,
      bestTime: parseFloat(time.toFixed(2)),
      bestAccuracy: Math.round(accuracy * 100),
      attempts: firebase.firestore.FieldValue.increment(1),
      lastPlayed: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    const teamId = _getTeamId();
    if (teamId) {
      const ts = Date.now();
      const name = rtUser.displayName || rtUser.email.split('@')[0];
      const starStr = starCount === 3 ? 'Gold' : (starCount === 2 ? 'Silver' : 'Bronze');
      console.log('Firestore WRITE path: teams/' + teamId + '/activity/' + ts);
      await rtDb.collection('teams').doc(teamId).collection('activity').doc(String(ts)).set({
        userName: name,
        action: `completed Level ${levelId} with ${starStr}`,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
  } catch (e) {
    console.warn('Failed to save level result:', e.message);
  }
}

async function saveDriverStats() {
  if (!rtUser) return;
  const scores = computeScores();
  const rating = computeOverallRating();
  const sessMs = performance.now() - driverMetrics.sessionStart;
  const teamId = _getTeamId();
  try {
    // Count levels from completedLevels
    const levelCount = window.completedLevels ? Object.keys(window.completedLevels).length : driverMetrics.levelsCompleted;
    const goldCount = window.completedLevels ? Object.values(window.completedLevels).filter(c => c.stars && c.stars.filter(Boolean).length === 3).length : 0;

    console.log('Firestore WRITE path: users/' + rtUser.uid + '/stats/driverStats');
    await rtDb.collection('users').doc(rtUser.uid).collection('stats').doc('driverStats').set({
      overallRating: rating,
      grade: gradeFromRating(rating),
      smoothness: Math.round(scores.smoothness),
      stability: Math.round(scores.stability),
      strafe: Math.round(scores.strafe),
      turn: Math.round(scores.turn),
      levelScore: Math.round(scores.levelScore),
      recovery: Math.round(scores.recovery),
      totalPracticeMs: Math.round(sessMs),
      levelsCompleted: levelCount,
      totalDistanceFt: Math.round(driverMetrics.totalDistance),
      lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    if (teamId) {
      let profileName = 'The Rookie';
      if (window.generateCoachReport) {
        const r = window.generateCoachReport();
        profileName = r.driverProfile.split(' — ')[0];
      }

      console.log('Firestore WRITE path: teams/' + teamId + '/members/' + rtUser.uid);
      await rtDb.collection('teams').doc(teamId).collection('members').doc(rtUser.uid).set({
        displayName: rtUser.displayName || rtUser.email.split('@')[0],
        email: rtUser.email,
        overallScore: rating,
        letterGrade: gradeFromRating(rating),
        driverProfile: profileName,
        metrics: {
          smoothness: Math.round(scores.smoothness),
          heading: Math.round(scores.stability),
          strafe: Math.round(scores.strafe),
          turn: Math.round(scores.turn),
          recovery: Math.round(scores.recovery),
          reaction: Math.round(scores.recovery)
        },
        levelsCompleted: levelCount,
        goldCount: goldCount,
        totalPracticeTime: Math.round(sessMs),
        lastActive: firebase.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      if (sessMs >= 300000) {
        const mins = Math.round(sessMs / 60000);
        const ts = Date.now();
        const name = rtUser.displayName || rtUser.email.split('@')[0];
        console.log('Firestore WRITE path: teams/' + teamId + '/activity/' + ts);
        await rtDb.collection('teams').doc(teamId).collection('activity').doc(String(ts)).set({
          userName: name,
          action: `practiced ${mins} minutes today`,
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
      }

      const reportTs = Date.now();
      const reportName = rtUser.displayName || rtUser.email.split('@')[0];
      console.log('Firestore WRITE path: teams/' + teamId + '/activity/' + (reportTs + 1));
      await rtDb.collection('teams').doc(teamId).collection('activity').doc(String(reportTs + 1)).set({
        userName: reportName,
        action: `generated a driver report — Overall ${rating} (${gradeFromRating(rating)})`,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
    console.log('Driver stats saved. rating:', rating, 'levels:', levelCount, 'gold:', goldCount, 'teamId:', teamId);
  } catch (e) {
    console.warn('Failed to save driver stats:', e.message);
  }
}

// ── Curriculum → driverStats sync ──────────────────────────────────────────
// Called from curriculum page when a phase is auto-verified by AI
async function saveCurriculumProgress(phasesCompleted, avgScore, highestPhase) {
  if (!rtUser) return;
  try {
    console.log('Firestore WRITE path: users/' + rtUser.uid + '/stats/driverStats (curriculum sync)');
    console.log('Curriculum sync: phases=' + phasesCompleted + ', avgScore=' + avgScore + ', highestPhase=' + highestPhase);
    await rtDb.collection('users').doc(rtUser.uid).collection('stats').doc('driverStats').set({
      curriculumScore: {
        phasesCompleted: phasesCompleted,
        averageAIScore: Math.round(avgScore),
        highestPhaseReached: highestPhase,
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
      }
    }, { merge: true });
  } catch (e) {
    console.warn('Failed to save curriculum progress to driverStats:', e.message);
  }
}
window.saveCurriculumProgress = saveCurriculumProgress;

async function saveLeaderboardEntry(levelId, starCount, time, accuracy) {
  if (!rtUser) return;
  const ref = rtDb.collection('leaderboards').doc(String(levelId))
    .collection('entries').doc(rtUser.uid);
  try {
    const snap = await ref.get();
    if (snap.exists && (snap.data().time || Infinity) <= time) return;
    await ref.set({
      displayName: rtUser.displayName || rtUser.email.split('@')[0],
      time: parseFloat(time.toFixed(3)),
      accuracy: Math.round(accuracy * 100),
      stars: starCount,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    });
  } catch (e) {
    console.warn('Failed to save leaderboard entry:', e.message);
  }
}

async function loadLevelProgress() {
  if (!rtUser) return;
  try {
    const snap = await rtDb.collection('users').doc(rtUser.uid)
      .collection('levels').get();
    snap.forEach(doc => {
      const d = doc.data();
      const id = parseInt(doc.id);
      if (!isNaN(id)) {
        const s = d.bestStars || 1;
        completedLevels[id] = {
          stars: [s >= 1, s >= 2, s >= 3],
          time: d.bestTime || 0,
          accuracy: (d.bestAccuracy || 0) / 100,
        };
      }
    });
    renderLevelsSidebar();
  } catch (e) {
    console.warn('Failed to load level progress:', e.message);
  }
}

async function openLeaderboard(levelId) {
  const def = LEVELS.find(l => l.id === levelId);
  document.getElementById('lb-title').textContent =
    `Level ${levelId} — ${def ? def.name : ''} Leaderboard`;
  document.getElementById('lb-content').innerHTML =
    '<div class="lb-empty">Loading...</div>';
  document.getElementById('lb-backdrop').classList.add('open');

  try {
    const snap = await rtDb.collection('leaderboards').doc(String(levelId))
      .collection('entries').orderBy('time', 'asc').limit(10).get();

    if (snap.empty) {
      document.getElementById('lb-content').innerHTML =
        '<div class="lb-empty">No entries yet. Be the first!</div>';
      return;
    }

    let html = '';
    let rank = 1;
    const myUid = rtUser ? rtUser.uid : null;
    snap.forEach(doc => {
      const d = doc.data();
      const isMe = doc.id === myUid;
      const rankClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
      const rankStr = rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : `#${rank}`;
      const starsHtml = [1, 2, 3].map(i =>
        `<span class="${i <= (d.stars || 1) ? 'lb-star-lit' : 'lb-star-dim'}">★</span>`
      ).join('');
      html += `<div class="lb-row${isMe ? ' mine' : ''}">
        <div class="lb-rank ${rankClass}">${rankStr}</div>
        <div class="lb-name">${d.displayName || 'Driver'}${isMe ? '<span class="lb-you">YOU</span>' : ''}</div>
        <div class="lb-time">${d.time.toFixed(2)}s</div>
        <div class="lb-stars">${starsHtml}</div>
      </div>`;
      rank++;
    });
    document.getElementById('lb-content').innerHTML = html;
  } catch (e) {
    document.getElementById('lb-content').innerHTML =
      `<div class="lb-empty" style="color:#ff5544">Error: ${e.message}</div>`;
  }
}

function closeLeaderboard() {
  document.getElementById('lb-backdrop').classList.remove('open');
}
