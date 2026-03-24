// ── R-Tracker TeleOp — 3D View Layer ──────────────────────────────────────
// Read-only visualization: mirrors the 2D simulation in Three.js.
// Never writes to bot, inp, cfg, or any physics/game state.

(function () {
  'use strict';

  // ── Constants ────────────────────────────────────────────────────────────
  var SCALE = 12;        // feet → inches (3D uses inches as units)
  var FIELD = 144;       // field size in inches (12 ft)
  var HALF = 72;         // half field
  var ROBOT_W = 18;      // robot width  (inches)
  var ROBOT_D = 18;      // robot depth  (inches)
  var ROBOT_H = 12;      // robot height (inches)

  // ── State ────────────────────────────────────────────────────────────────
  var scene, camera, renderer, controls;
  var robotGroup, defaultParts = [];
  var stlMesh = null;
  var is3DInit = false;
  var viewMode = '2d';
  var perfWarned = false;

  window.view3dMode = '2d';

  // ── Lazy Init — only runs when user first clicks a 3D mode ───────────
  function init3D() {
    if (is3DInit) return;
    is3DInit = true;

    var c2d = document.getElementById('c');

    // Renderer — insert directly as sibling of 2D canvas, no wrapper div
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = 'none';
    renderer.domElement.style.border = 'none';
    renderer.domElement.style.outline = 'none';
    renderer.domElement.style.boxShadow = 'none';
    renderer.domElement.style.background = 'none';
    renderer.domElement.style.margin = '0';
    renderer.domElement.style.padding = '0';
    renderer.domElement.className = 'renderer3d';
    c2d.parentElement.insertBefore(renderer.domElement, c2d.nextSibling);

    resize3D();

    // Scene
    var isLight = document.documentElement.classList.contains('light');
    scene = new THREE.Scene();
    scene.background = new THREE.Color(isLight ? 0xf5f5f5 : 0x1a1a1a);
    scene.fog = new THREE.Fog(scene.background.getHex(), 400, 800);

    // Camera — default 90-degree side view
    camera = new THREE.PerspectiveCamera(65, 1, 0.1, 2000);
    camera.position.set(DEFAULT_CAM_POS.x, DEFAULT_CAM_POS.y, DEFAULT_CAM_POS.z);
    camera.lookAt(DEFAULT_CAM_TARGET.x, DEFAULT_CAM_TARGET.y, DEFAULT_CAM_TARGET.z);

    // Lights
    var ambient = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambient);

    var dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(40, 100, -40);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(1024, 1024);
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = 300;
    dirLight.shadow.camera.left = -80;
    dirLight.shadow.camera.right = 80;
    dirLight.shadow.camera.top = 80;
    dirLight.shadow.camera.bottom = -80;
    scene.add(dirLight);

    var hemi = new THREE.HemisphereLight(0xccccff, 0x444444, 0.3);
    scene.add(hemi);

    // Build
    createField();
    createDefaultRobot();

    // Orbit controls (free camera mode)
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 20;
    controls.maxDistance = 300;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.target.set(0, 0, 0);
    controls.enabled = false;

    // Restore saved STL
    loadSavedSTL();

  }

  function resize3D() {
    if (!renderer) return;
    // Match the 2D canvas container size exactly
    var c2d = document.getElementById('c');
    var w, h;
    if (c2d && c2d.width > 0) {
      w = c2d.width;
      h = c2d.height || c2d.width;
    } else {
      // 2D canvas may be hidden — use parent container
      var fieldWrap = document.getElementById('field-wrap');
      if (fieldWrap) {
        w = fieldWrap.clientWidth;
        h = fieldWrap.clientHeight;
      }
    }
    if (!w || !h || w < 1 || h < 1) return;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = w + 'px';
    renderer.domElement.style.height = h + 'px';
    if (camera) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
  }

  // ── Field ────────────────────────────────────────────────────────────────
  function createField() {
    // Ground plane with field texture
    var geo = new THREE.PlaneGeometry(FIELD, FIELD);

    var mat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9, metalness: 0 });

    // Reuse fieldImg loaded by field.js (global const, accessible by name)
    try {
      if (typeof fieldImg !== 'undefined') {
        if (fieldImg.complete && fieldImg.naturalWidth > 0) {
          var tex = new THREE.Texture(fieldImg);
          tex.needsUpdate = true;
          mat.map = tex;
          mat.color.set(0xffffff);
          mat.needsUpdate = true;
        } else {
          fieldImg.addEventListener('load', function () {
            var t = new THREE.Texture(fieldImg);
            t.needsUpdate = true;
            mat.map = t;
            mat.color.set(0xffffff);
            mat.needsUpdate = true;
          });
        }
      }
    } catch (e) { /* fieldImg not available, use gray fallback */ }

    var plane = new THREE.Mesh(geo, mat);
    plane.rotation.x = -Math.PI / 2; // lay flat, face up
    plane.receiveShadow = true;
    scene.add(plane);

    // Raised border walls (2-inch / 2-unit height)
    var bH = 2;
    var bMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.7 });

    // North & South walls
    var nsGeo = new THREE.BoxGeometry(FIELD + 2, bH, 1);
    [-HALF, HALF].forEach(function (z) {
      var w = new THREE.Mesh(nsGeo, bMat);
      w.position.set(0, bH / 2, z);
      w.castShadow = true;
      scene.add(w);
    });
    // East & West walls
    var ewGeo = new THREE.BoxGeometry(1, bH, FIELD + 2);
    [-HALF, HALF].forEach(function (x) {
      var w = new THREE.Mesh(ewGeo, bMat);
      w.position.set(x, bH / 2, 0);
      w.castShadow = true;
      scene.add(w);
    });

    // Collision zone boxes (semi-transparent burgundy)
    var zoneMat = new THREE.MeshStandardMaterial({
      color: 0x800020, transparent: true, opacity: 0.15, roughness: 0.5
    });

    if (typeof COLLISION_ZONES !== 'undefined') {
      COLLISION_ZONES.forEach(function (z) {
        var zH = 6;
        var g = new THREE.BoxGeometry(z.w * SCALE, zH, z.h * SCALE);
        var m = new THREE.Mesh(g, zoneMat);
        m.position.set(z.x * SCALE, zH / 2, -z.y * SCALE);
        scene.add(m);
      });
    }
  }

  // ── Default Robot Model ──────────────────────────────────────────────────
  function createDefaultRobot() {
    robotGroup = new THREE.Group();

    // Body
    var bodyGeo = new THREE.BoxGeometry(ROBOT_W, ROBOT_H, ROBOT_D);
    var bodyMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6 });
    var body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = ROBOT_H / 2;
    body.castShadow = true;
    robotGroup.add(body);
    defaultParts.push(body);

    // Wireframe overlay (burgundy accent)
    var wireGeo = new THREE.BoxGeometry(ROBOT_W + 0.3, ROBOT_H + 0.3, ROBOT_D + 0.3);
    var wireMat = new THREE.MeshBasicMaterial({ color: 0x800020, wireframe: true });
    var wire = new THREE.Mesh(wireGeo, wireMat);
    wire.position.y = ROBOT_H / 2;
    robotGroup.add(wire);
    defaultParts.push(wire);

    // Front indicator triangle on top (points toward local -Z = forward/north)
    var triShape = new THREE.Shape();
    triShape.moveTo(-3, 0);
    triShape.lineTo(3, 0);
    triShape.lineTo(0, 5);   // tip at +Y → after rotation becomes -Z (forward)
    triShape.lineTo(-3, 0);
    var triGeo = new THREE.ShapeGeometry(triShape);
    var triMat = new THREE.MeshBasicMaterial({ color: 0x800020, side: THREE.DoubleSide });
    var tri = new THREE.Mesh(triGeo, triMat);
    tri.rotation.x = -Math.PI / 2;
    tri.position.set(0, ROBOT_H + 0.2, 0);
    robotGroup.add(tri);
    defaultParts.push(tri);

    // Four mecanum wheels (cylinders at corners)
    var wheelGeo = new THREE.CylinderGeometry(2, 2, 1.5, 12);
    var wheelMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.4 });
    var off = ROBOT_W / 2 - 2;
    [[-off, 2, -off], [off, 2, -off], [-off, 2, off], [off, 2, off]].forEach(function (pos) {
      var wh = new THREE.Mesh(wheelGeo, wheelMat);
      wh.rotation.z = Math.PI / 2;
      wh.position.set(pos[0], pos[1], pos[2]);
      wh.castShadow = true;
      robotGroup.add(wh);
      defaultParts.push(wh);
    });

    scene.add(robotGroup);
  }

  // ── STL Upload ───────────────────────────────────────────────────────────
  window.uploadSTL = function () {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.stl';
    input.onchange = function (e) {
      var file = e.target.files[0];
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) {
        alert('STL file must be under 10 MB. Please simplify your model.');
        return;
      }
      var reader = new FileReader();
      reader.onload = function (evt) {
        var buf = evt.target.result;
        if (!is3DInit) init3D();
        applySTL(buf);
        // Cache in localStorage
        try {
          var bytes = new Uint8Array(buf);
          var bin = '';
          for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
          localStorage.setItem('rt_stl_model', btoa(bin));
        } catch (err) {
          console.warn('Could not cache STL:', err.message);
        }
      };
      reader.readAsArrayBuffer(file);
    };
    input.click();
  };

  function applySTL(buffer) {
    var loader = new THREE.STLLoader();
    var geometry;
    try {
      geometry = loader.parse(buffer);
    } catch (err) {
      console.error('STL parse failed:', err);
      alert('Failed to load STL file. The file may be corrupted.');
      return;
    }

    var faceCount = geometry.attributes.position.count / 3;
    if (faceCount > 100000) {
      alert('STL model has too many faces (' + faceCount + '). Maximum is 100,000. Please simplify your model.');
      return;
    }
    if (faceCount > 50000) {
      alert('Warning: This model has ' + faceCount + ' faces. Performance may be affected.');
    }

    // Auto-scale to fit within 18×18×18 bounding box
    geometry.computeBoundingBox();
    var size = new THREE.Vector3();
    geometry.boundingBox.getSize(size);
    var maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) {
      var s = ROBOT_W / maxDim;
      geometry.scale(s, s, s);
    }

    // Center horizontally, sit on ground
    geometry.computeBoundingBox();
    var center = new THREE.Vector3();
    geometry.boundingBox.getCenter(center);
    geometry.translate(-center.x, -geometry.boundingBox.min.y, -center.z);

    var mat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.5, metalness: 0.3 });

    // Remove old STL
    if (stlMesh) {
      robotGroup.remove(stlMesh);
      stlMesh.geometry.dispose();
      stlMesh.material.dispose();
    }

    stlMesh = new THREE.Mesh(geometry, mat);
    stlMesh.castShadow = true;
    robotGroup.add(stlMesh);

    // Hide default robot parts
    defaultParts.forEach(function (p) { p.visible = false; });

    var btn = document.getElementById('stl-remove-btn');
    if (btn) btn.style.display = 'inline-block';
  }

  window.removeSTL = function () {
    if (stlMesh) {
      robotGroup.remove(stlMesh);
      stlMesh.geometry.dispose();
      stlMesh.material.dispose();
      stlMesh = null;
    }
    defaultParts.forEach(function (p) { p.visible = true; });
    localStorage.removeItem('rt_stl_model');
    var btn = document.getElementById('stl-remove-btn');
    if (btn) btn.style.display = 'none';
  };

  function loadSavedSTL() {
    try {
      var b64 = localStorage.getItem('rt_stl_model');
      if (!b64) return;
      var raw = atob(b64);
      var buf = new ArrayBuffer(raw.length);
      var view = new Uint8Array(buf);
      for (var i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
      applySTL(buf);
    } catch (e) {
      console.warn('Could not restore saved STL:', e.message);
    }
  }

  // ── Default 3D camera position (90-degree, right side of field) ─────
  var DEFAULT_CAM_POS = { x: 130, y: 90, z: 0 };
  var DEFAULT_CAM_TARGET = { x: 0, y: 0, z: 0 };

  function resetCameraTo3DDefault() {
    if (!camera) return;
    camera.fov = 65;
    camera.far = 2000;
    camera.position.set(DEFAULT_CAM_POS.x, DEFAULT_CAM_POS.y, DEFAULT_CAM_POS.z);
    camera.lookAt(DEFAULT_CAM_TARGET.x, DEFAULT_CAM_TARGET.y, DEFAULT_CAM_TARGET.z);
    camera.updateProjectionMatrix();
    if (controls) {
      controls.target.set(DEFAULT_CAM_TARGET.x, DEFAULT_CAM_TARGET.y, DEFAULT_CAM_TARGET.z);
      controls.update();
    }
  }

  // ── View Mode Switching (2D / 3D only) ─────────────────────────────────
  window.setViewMode = function (mode) {
    // Normalize: anything other than '2d' is '3d'
    if (mode !== '2d') mode = '3d';
    if (mode === viewMode) return;
    if (mode === '3d' && !is3DInit) init3D();

    // Update pill buttons
    document.querySelectorAll('.view-btn').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-mode') === mode);
    });

    var c2d = document.getElementById('c');
    var fieldWrap = c2d.parentElement; // #field-wrap

    if (mode === '2d') {
      // Show 2D, hide 3D, restore parent styles
      c2d.style.display = 'block';
      if (renderer) renderer.domElement.style.display = 'none';
      fieldWrap.style.border = '';
      fieldWrap.style.outline = '';
      fieldWrap.style.boxShadow = '';

      // Restore overflow on ancestors
      var el = fieldWrap;
      while (el && el !== document.body) {
        if (el.dataset.origOverflow !== undefined) {
          el.style.overflow = el.dataset.origOverflow;
          delete el.dataset.origOverflow;
        }
        el = el.parentElement;
      }

      if (controls) controls.enabled = false;
      console.log('[3D] Switched to 2D view');
    } else {
      // Capture 2D canvas size BEFORE hiding it
      var w = c2d.width;
      var h = c2d.height || c2d.width;

      // Hide 2D canvas and parent border, show 3D canvas in its exact place
      c2d.style.display = 'none';
      fieldWrap.style.border = 'none';
      fieldWrap.style.outline = 'none';
      fieldWrap.style.boxShadow = 'none';

      // Set overflow:visible on all ancestors to prevent clipping
      var el = fieldWrap;
      while (el && el !== document.body) {
        var computed = getComputedStyle(el).overflow;
        if (computed !== 'visible') {
          el.dataset.origOverflow = el.style.overflow;
          el.style.overflow = 'visible';
        }
        el = el.parentElement;
      }

      renderer.setSize(w, h, false);
      renderer.domElement.style.width = w + 'px';
      renderer.domElement.style.height = h + 'px';
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.domElement.style.display = 'block';

      // Set camera to default 90-degree position and enable orbit controls
      resetCameraTo3DDefault();
      if (controls) controls.enabled = true;

      console.log('[3D] Switched to 3D view, size:', w, 'x', h);
    }

    viewMode = mode;
    window.view3dMode = mode;
  };

  // ── Double-click 3D button resets camera to default position ──────────
  document.addEventListener('dblclick', function (e) {
    var btn = e.target.closest('.view-btn[data-mode="3d"]');
    if (btn && viewMode === '3d') {
      resetCameraTo3DDefault();
    }
  });

  // ── Per-Frame Update (called from ui.js loop) ───────────────────────────
  window.update3DView = function () {
    if (viewMode === '2d' || !is3DInit || !renderer) return;

    var t0 = performance.now();

    // Map 2D physics → 3D world
    // 2D: bot.x, bot.y in feet, origin center, +X right, +Y up (north)
    // 3D: X right, Y up, Z = -fieldY (south positive)
    var x3D = bot.x * SCALE;
    var z3D = -bot.y * SCALE;
    var heading = -bot.hdg * Math.PI / 180;

    // Robot position & rotation
    robotGroup.position.set(x3D, 0, z3D);
    robotGroup.rotation.y = heading;

    // Camera — orbit controls handle all camera movement
    if (viewMode === '3d' && controls && controls.enabled) {
      controls.update();
    }

    renderer.render(scene, camera);

    // Performance guard: reduce shadow quality if frames are slow
    var frameTime = performance.now() - t0;
    if (frameTime > 20 && !perfWarned && renderer.shadowMap.enabled) {
      renderer.shadowMap.type = THREE.BasicShadowMap;
      renderer.shadowMap.needsUpdate = true;
      perfWarned = true;
    }
  };

  // ── Resize (called from ui.js after 2D canvas resize) ───────────────────
  window.resize3DView = function () {
    if (is3DInit) resize3D();
  };

  // ── Reset 3D camera (called from resetRobot in input.js) ────────────────
  window.reset3DCamera = function () {
    if (viewMode === '3d' && is3DInit) {
      resetCameraTo3DDefault();
    }
  };

  // ── Theme Sync ───────────────────────────────────────────────────────────
  // Patch toggleTheme to update 3D scene background when theme changes
  var _origToggle = window.toggleTheme;
  if (_origToggle) {
    window.toggleTheme = function () {
      _origToggle();
      if (scene) {
        var light = document.documentElement.classList.contains('light');
        scene.background.set(light ? 0xf5f5f5 : 0x1a1a1a);
        if (scene.fog) scene.fog.color.set(light ? 0xf5f5f5 : 0x1a1a1a);
      }
    };
  }
})();
