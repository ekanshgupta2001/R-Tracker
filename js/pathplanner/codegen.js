// ── R-Tracker Path Planner — Code Generation ─────────────────────────────

function updateCode() {
  const block = document.getElementById('codeBlock');
  if (waypoints.length < 2) {
    block.textContent = '// Add at least 2 waypoints to generate code';
    return;
  }
  const L = [];
  L.push('package org.firstinspires.ftc.teamcode.paths;');
  L.push('');
  L.push('import com.pedropathing.follower.Follower;');
  L.push('import com.pedropathing.geometry.BezierCurve;');
  L.push('import com.pedropathing.geometry.BezierLine;');
  L.push('import com.pedropathing.geometry.Pose;');
  L.push('import com.pedropathing.paths.PathChain;');
  L.push('');
  L.push('public class AutoPath {');
  L.push('');
  L.push('    public Follower follower;');
  L.push('');
  waypoints.forEach((wp, i) => {
    L.push(`    public Pose point${i+1} = new Pose(${wp.x.toFixed(2)}, ${wp.y.toFixed(2)}, Math.toRadians(${wp.heading.toFixed(1)}));`);
  });
  L.push('');
  L.push('    public AutoPath(Follower follower) {');
  L.push('        this.follower = follower;');
  L.push('    }');
  L.push('');
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const b   = waypoints[i + 1];
    if (b.waitMs > 0) {
      L.push(`    // Wait ${b.waitMs}ms at point${i+2}${b.action !== 'None' ? ` (${b.action})` : ''}`);
    }
    L.push(`    public PathChain path${i+1}() {`);
    L.push(`        return follower.pathBuilder()`);
    if (seg.cps.length === 0) {
      L.push(`                .addPath(new BezierLine(point${i+1}, point${i+2}))`);
    } else if (seg.cps.length === 1) {
      const cp = seg.cps[0];
      L.push(`                .addPath(new BezierCurve(`);
      L.push(`                        point${i+1},`);
      L.push(`                        new Pose(${cp.x.toFixed(2)}, ${cp.y.toFixed(2)}, 0),`);
      L.push(`                        point${i+2}))`);
    } else {
      const cp1 = seg.cps[0], cp2 = seg.cps[1];
      L.push(`                .addPath(new BezierCurve(`);
      L.push(`                        point${i+1},`);
      L.push(`                        new Pose(${cp1.x.toFixed(2)}, ${cp1.y.toFixed(2)}, 0),`);
      L.push(`                        new Pose(${cp2.x.toFixed(2)}, ${cp2.y.toFixed(2)}, 0),`);
      L.push(`                        point${i+2}))`);
    }
    L.push(`                .setLinearHeadingInterpolation(point${i+1}.getHeading(), point${i+2}.getHeading())`);
    L.push(`                .build();`);
    L.push(`    }`);
    L.push('');
  }
  L.push('}');
  block.textContent = L.join('\n');
}

function copyCode() {
  const text = document.getElementById('codeBlock').textContent;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('copyBtn');
    btn.textContent = 'Copied!'; btn.classList.add('copied');
    setTimeout(() => { btn.textContent = 'Copy Code'; btn.classList.remove('copied'); }, 1800);
  });
}

function exportPath() {
  const data = JSON.stringify({ waypoints, segments, pathSettings }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'path.json'; a.click();
  URL.revokeObjectURL(url);
}
