// ── R-Tracker Firestore Storage Utilities ─────────────────────────────────

async function saveLevelResult(levelId, starCount, time, accuracy) {
  if (!rtUser) return;
  const ref = rtDb.collection('users').doc(rtUser.uid)
    .collection('levels').doc(String(levelId));
  try {
    const snap = await ref.get();
    if (snap.exists && (snap.data().bestStars || 0) >= starCount) return;
    await ref.set({
      bestStars: starCount,
      bestTime: parseFloat(time.toFixed(2)),
      bestAccuracy: Math.round(accuracy * 100),
      attempts: firebase.firestore.FieldValue.increment(1),
      lastPlayed: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  } catch (e) {
    console.warn('Failed to save level result:', e.message);
  }
}

async function saveDriverStats() {
  if (!rtUser) return;
  const scores = computeScores();
  const rating = computeOverallRating();
  const sessMs = performance.now() - driverMetrics.sessionStart;
  try {
    await rtDb.collection('users').doc(rtUser.uid).collection('stats').doc('driverStats').set({
      overallRating: rating,
      grade: gradeFromRating(rating),
      smoothness: Math.round(scores.smoothness),
      stability:  Math.round(scores.stability),
      strafe:     Math.round(scores.strafe),
      turn:       Math.round(scores.turn),
      levelScore: Math.round(scores.levelScore),
      recovery:   Math.round(scores.recovery),
      totalPracticeMs: Math.round(sessMs),
      levelsCompleted: driverMetrics.levelsCompleted,
      totalDistanceFt: Math.round(driverMetrics.totalDistance),
      lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  } catch (e) {
    console.warn('Failed to save driver stats:', e.message);
  }
}

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
      const rankStr = rank <= 3 ? ['🥇','🥈','🥉'][rank-1] : `#${rank}`;
      const starsHtml = [1,2,3].map(i =>
        `<span class="${i <= (d.stars||1) ? 'lb-star-lit' : 'lb-star-dim'}">★</span>`
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
