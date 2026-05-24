/**
 * 3D Visualization — Three.js scene. Z-axis vertical.
 * E-field lines rendered as spaced arrows (shaft+cone) along traced paths.
 * Bending at z=0 interface is clearly visible.
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const ThreeView = (function () {
  let renderer, scene, camera, controls;
  let container, canvas;
  let chargeSphere, probeSphere, lineSource, currentSphere, dielectricSphere;
  let eShafts, eHeads;
  let animFrameId, resizeObserver;
  let _initialized = false;

  const HALF_X = 3.2;
  const HALF_Y = 3.0;
  const Z_MIN = -2.8;
  const Z_MAX = 3.2;

  // Box bounds (matching half-space box geometry)
  const BX = HALF_X + 0.5; // 3.7
  const BY = HALF_Y + 0.5; // 3.5
  const BZ_LO = Z_MIN - 0.2; // -3.0
  const BZ_HI = Z_MAX + 0.2; // 3.4

  const STEP = 0.04;
  const MAX_STEPS = 300;
  const ARROW_STRIDE = 9; // center-to-center ≈ 0.36, gap ≈ 0.6 arrow length

  const SHAFT_R = 0.018;
  const SHAFT_L = 0.14;
  const HEAD_R  = 0.038;
  const HEAD_L  = 0.08;
  const MAX_ARROWS = 6000;

  function getParamsObj(p) { return p; }

  // ====== Trace + collect arrow positions/directions ======
  function collectArrows(params, y0Only, modelId) {
    const P = window.Physics;
    if (!P) return [];
    const p = getParamsObj(params);
    const cp = new THREE.Vector3(p.chargePos.x, p.chargePos.y, p.chargePos.z);

    // Build seeds
    const seeds = [];
    const nAng = 18;
    const radii = [0.25, 0.5, 0.8];
    for (const r of radii) {
      for (let a = 0; a < nAng; a++) {
        const angle = (a / nAng) * Math.PI * 2 + (r === radii[1] ? Math.PI / nAng : 0);
        seeds.push(new THREE.Vector3(cp.x + r * Math.cos(angle), cp.y + r * Math.sin(angle), cp.z));
      }
    }
    for (let a = 0; a < nAng; a++) {
      const angle = (a / nAng) * Math.PI * 2;
      seeds.push(new THREE.Vector3(cp.x + 0.3 * Math.cos(angle), cp.y, cp.z + 0.3 * Math.sin(angle)));
    }

    // Filter to y=0 plane only if requested
    const filtered = y0Only ? seeds.filter(s => Math.abs(s.y) < 0.01) : seeds;

	    // Sphere model: 3D seeds on sphere surface (Fibonacci sphere)
	    if (modelId === "sphere") {
	      const sphereSeeds = [];
	      const a = 1.0;
	      const nS3D = 180;
	      const golden = Math.PI * (3 - Math.sqrt(5));
	      // Outside seeds: uniform on sphere r = a + δ
	      for (let i = 0; i < nS3D; i++) {
	        const theta = golden * i;
	        const phi = Math.acos(1 - 2 * (i + 0.5) / nS3D);
	        const r = a + 0.06;
	        sphereSeeds.push(new THREE.Vector3(r * Math.sin(phi) * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta), r * Math.cos(phi)));
	      }
	      // Inside seeds: uniform on sphere r = a - δ
	      for (let i = 0; i < nS3D; i++) {
	        const theta = golden * (i + 0.5);
	        const phi = Math.acos(1 - 2 * (i + 0.5) / nS3D);
	        const r = a - 0.06;
	        sphereSeeds.push(new THREE.Vector3(r * Math.sin(phi) * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta), r * Math.cos(phi)));
	      }
	      // Bonus x-z plane seeds for y0Only cross-section view
	      const nXZ = 48;
	      for (let i = 0; i < nXZ; i++) {
	        const ang = (i / nXZ) * Math.PI * 2;
	        sphereSeeds.push(new THREE.Vector3((a + 0.04) * Math.cos(ang), 0, (a + 0.04) * Math.sin(ang)));
	        sphereSeeds.push(new THREE.Vector3((a - 0.04) * Math.cos(ang), 0, (a - 0.04) * Math.sin(ang)));
	      }
	      seeds.length = 0;
	      seeds.push.apply(seeds, sphereSeeds);
	    }


    const arrows = [];
    for (const seed of filtered) {
      // Trace forward and backward
      for (const forward of [true, false]) {
        const pts = [];
        let cur = seed.clone();
        pts.push(cur.clone());
        const sign = forward ? 1 : -1;

        for (let i = 0; i < MAX_STEPS; i++) {
          const f = P.computeField(cur.x, cur.y, cur.z, p);
          const d = new THREE.Vector3(f.Ex, f.Ey, f.Ez);
          const len = d.length();
          if (len < 1e-8) break;
          d.normalize().multiplyScalar(sign * STEP);
          cur = cur.clone().add(d);
          pts.push(cur.clone());
          // Bounds check
          if (Math.abs(cur.x) > BX || Math.abs(cur.y) > BY || cur.z > BZ_HI || cur.z < BZ_LO) break;
          const dq = new THREE.Vector3().subVectors(cur, cp);
          if (dq.length() < 0.03) break;
        }

        // Place arrows along traced path (skip every ARROW_STRIDE points)
        for (let i = 0; i < pts.length - 1; i += ARROW_STRIDE) {
          const a = pts[i], b = pts[Math.min(i + 1, pts.length - 1)];
          const dir = new THREE.Vector3().subVectors(b, a);
          const dl = dir.length();
          if (dl < 1e-6) continue;
          dir.normalize();
          // Don't place arrow if it would cross outside bounds
          if (Math.abs(a.x) > BX || Math.abs(a.y) > BY || a.z > BZ_HI || a.z < BZ_LO) continue;
          arrows.push({ pos: a.clone(), dir: dir.clone() });
        }
      }
    }
    return arrows;
  }

  // ====== Build InstancedMesh arrows ======
  function buildFieldArrows(params, showE, y0Only, modelId) {
    [eShafts, eHeads].forEach((m) => {
      if (m) { m.geometry.dispose(); m.material.dispose(); scene.remove(m); }
    });

    if (!showE) { eShafts = null; eHeads = null; return; }

    const arrows = collectArrows(params, y0Only, modelId);
    const count = Math.min(arrows.length, MAX_ARROWS);
    if (count === 0) return;

    const shaftGeo = new THREE.CylinderGeometry(SHAFT_R, SHAFT_R, 1, 6);
    const headGeo  = new THREE.ConeGeometry(HEAD_R, HEAD_L, 6);
    const mat = new THREE.MeshBasicMaterial({ color: 0xf0883e });

    eShafts = new THREE.InstancedMesh(shaftGeo, mat, count);
    eHeads  = new THREE.InstancedMesh(headGeo, mat, count);

    const up = new THREE.Vector3(0, 1, 0);
    const dummy = new THREE.Object3D();
    const quat = new THREE.Quaternion();

    for (let i = 0; i < count; i++) {
      const { pos, dir } = arrows[i];
      quat.setFromUnitVectors(up, dir);
      // Shaft: center at pos, length=SHAFT_L
      dummy.position.copy(pos);
      dummy.quaternion.copy(quat);
      dummy.scale.set(1, SHAFT_L, 1);
      dummy.updateMatrix();
      eShafts.setMatrixAt(i, dummy.matrix);
      // Head: at pos + dir*(SHAFT_L/2 + HEAD_L/2)
      dummy.position.copy(pos).addScaledVector(dir, SHAFT_L / 2 + HEAD_L / 2 - 0.01);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      eHeads.setMatrixAt(i, dummy.matrix);
    }

    eShafts.count = count;
    eHeads.count = count;
    eShafts.instanceMatrix.needsUpdate = true;
    eHeads.instanceMatrix.needsUpdate = true;

    scene.add(eShafts);
    scene.add(eHeads);
  }

  // ====== Axes ======
  function createAxes() {
    const group = new THREE.Group();
    function arrowLine(from, to, color) {
      const dir = new THREE.Vector3().subVectors(to, from).normalize();
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([from, to]), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.75 })));
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.18, 8), new THREE.MeshBasicMaterial({ color }));
      cone.position.copy(to);
      cone.setRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
      group.add(cone);
    }
    function label(text, pos, color) {
      const c = document.createElement("canvas"); c.width = 64; c.height = 64;
      const ctx = c.getContext("2d"); ctx.fillStyle = color; ctx.font = "bold 48px monospace";
      ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(text, 32, 32);
      const t = new THREE.CanvasTexture(c); t.minFilter = THREE.LinearFilter;
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, depthWrite: false }));
      s.position.copy(pos); s.scale.set(0.4, 0.4, 1); return s;
    }
    arrowLine(new THREE.Vector3(-3.5, 0, 0), new THREE.Vector3(3.5, 0, 0), "#ff4444");
    arrowLine(new THREE.Vector3(0, -3.5, 0), new THREE.Vector3(0, 3.5, 0), "#44ff44");
    arrowLine(new THREE.Vector3(0, 0, -3.0), new THREE.Vector3(0, 0, 3.8), "#4488ff");
    group.add(label("X", new THREE.Vector3(3.7, 0, 0), "#ff6666"));
    group.add(label("Y", new THREE.Vector3(0, 3.7, 0), "#66ff66"));
    group.add(label("Z", new THREE.Vector3(0, 0, 4.0), "#6688ff"));
    return group;
  }

  function createHalfSpaceBoxes() {
    const group = new THREE.Group();
    const uGeo = new THREE.BoxGeometry(HALF_X * 2 + 1, HALF_Y * 2 + 1, Z_MAX + 0.2);
    const uBox = new THREE.Mesh(uGeo, new THREE.MeshBasicMaterial({ color: 0x3366aa, side: THREE.DoubleSide, transparent: true, opacity: 0.10, depthWrite: false }));
    uBox.position.set(0, 0, Z_MAX / 2 + 0.1); group.add(uBox);
    const lGeo = new THREE.BoxGeometry(HALF_X * 2 + 1, HALF_Y * 2 + 1, Math.abs(Z_MIN) + 0.2);
    const lBox = new THREE.Mesh(lGeo, new THREE.MeshBasicMaterial({ color: 0x886644, side: THREE.DoubleSide, transparent: true, opacity: 0.10, depthWrite: false }));
    lBox.position.set(0, 0, Z_MIN / 2 - 0.1); group.add(lBox);
    return group;
  }

  function createSliceMarker() {
    const group = new THREE.Group();
    const hz2 = (Z_MAX - Z_MIN) / 2, cz = (Z_MAX + Z_MIN) / 2;
    const pGeo = new THREE.PlaneGeometry(HALF_X * 2, Z_MAX - Z_MIN);
    const plane = new THREE.Mesh(pGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.06, depthWrite: false }));
    plane.rotation.x = -Math.PI / 2; plane.position.set(0, 0, cz); group.add(plane);
    const fps = [new THREE.Vector3(-HALF_X, 0, cz - hz2), new THREE.Vector3(HALF_X, 0, cz - hz2), new THREE.Vector3(HALF_X, 0, cz + hz2), new THREE.Vector3(-HALF_X, 0, cz + hz2), new THREE.Vector3(-HALF_X, 0, cz - hz2)];
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(fps), new THREE.LineBasicMaterial({ color: 0xffffff44, transparent: true, opacity: 0.35 })));
    const c = document.createElement("canvas"); c.width = 256; c.height = 32;
    const ctx = c.getContext("2d"); ctx.fillStyle = "#ffffff99"; ctx.font = "14px system-ui";
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("截面 y=0（三剖面图来源）", 128, 16);
    const t = new THREE.CanvasTexture(c); t.minFilter = THREE.LinearFilter;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, depthWrite: false }));
    sp.position.set(0, 0.15, cz + hz2 - 0.3); sp.scale.set(4.0, 0.55, 1); group.add(sp);
    return group;
  }

  // ====== PUBLIC API ======
  function init(containerEl, canvasEl) {
    if (_initialized) return;
    container = containerEl; canvas = canvasEl;
    const w = container.clientWidth || 800, h = container.clientHeight || 500;
    canvas.width = w; canvas.height = h;
    canvas.style.width = "100%"; canvas.style.height = "100%"; canvas.style.display = "block";

    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(w, h, false);
      renderer.setClearColor(0x0d1117);
    } catch (e) { return; }

    scene = new THREE.Scene();

    const dist = 9, azim = Math.PI / 4, elev = Math.PI / 5;
    camera = new THREE.PerspectiveCamera(50, w / Math.max(h, 1), 0.1, 100);
    camera.up.set(0, 0, 1);
    camera.position.set(dist * Math.cos(elev) * Math.cos(azim), dist * Math.cos(elev) * Math.sin(azim), dist * Math.sin(elev) + 0.5);
    camera.lookAt(0, 0, 0.5);

    scene.add(new THREE.AmbientLight(0x606080, 2.5));
    const dl = new THREE.DirectionalLight(0xffffff, 1.5); dl.position.set(5, 10, 5); scene.add(dl);

    try {
      controls = new OrbitControls(camera, renderer.domElement);
      controls.target.set(0, 0, 0.5); controls.up = new THREE.Vector3(0, 0, 1);
      controls.enableDamping = true; controls.dampingFactor = 0.08; controls.update();
    } catch (e) { controls = null; }

    scene.add(createAxes());
    scene.add(createHalfSpaceBoxes());

    const ifGeo = new THREE.PlaneGeometry(HALF_X * 2 + 1, HALF_Y * 2 + 1);
    const ifPlane = new THREE.Mesh(ifGeo, new THREE.MeshPhongMaterial({ color: 0x4488aa, side: THREE.DoubleSide, transparent: true, opacity: 0.15, depthWrite: false }));
    scene.add(ifPlane);

    scene.add(createSliceMarker());

    const cGeo = new THREE.SphereGeometry(0.14, 20, 20);
    chargeSphere = new THREE.Mesh(cGeo, new THREE.MeshPhongMaterial({ color: 0xf85149, emissive: 0x801010 }));
    scene.add(chargeSphere);
    // Line charge cylinder (orange, Model 4) -- hidden by default
    const lineGeo = new THREE.CylinderGeometry(0.06, 0.06, 6.0, 16, 1);
    lineSource = new THREE.Mesh(lineGeo, new THREE.MeshPhongMaterial({ color: 0xf0883e, emissive: 0x802010 }));
    lineSource.visible = false; scene.add(lineSource);

    // Current source sphere (gold, Model 5) -- hidden by default
    const curGeo = new THREE.SphereGeometry(0.14, 20, 20);
    currentSphere = new THREE.Mesh(curGeo, new THREE.MeshPhongMaterial({ color: 0xf0c030, emissive: 0x804000 }));
    currentSphere.visible = false; scene.add(currentSphere);

	    // Dielectric sphere mesh (Model 6) -- hidden by default
	    const dsGeo = new THREE.SphereGeometry(1.0, 48, 48);
	    dielectricSphere = new THREE.Mesh(dsGeo, new THREE.MeshPhongMaterial({ color: 0x4488aa, emissive: 0x001020, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }));
	    dielectricSphere.visible = false; scene.add(dielectricSphere);

    const pGeo = new THREE.SphereGeometry(0.06, 12, 12);
    probeSphere = new THREE.Mesh(pGeo, new THREE.MeshPhongMaterial({ color: 0xffff00, emissive: 0x404000 }));
    probeSphere.visible = false; scene.add(probeSphere);

    const dGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.01, 3);
    eShafts = new THREE.InstancedMesh(dGeo, new THREE.MeshBasicMaterial(), 0);
    eHeads  = new THREE.InstancedMesh(dGeo, new THREE.MeshBasicMaterial(), 0);

    resizeObserver = new ResizeObserver((entries) => {
      for (const e of entries) {
        const cw = e.contentRect.width, ch = e.contentRect.height;
        if (cw > 0 && ch > 0) { renderer.setSize(cw, ch, false); camera.aspect = cw / Math.max(ch, 1); camera.updateProjectionMatrix(); }
      }
    });
    resizeObserver.observe(container);
    _initialized = true;

    function animate() {
      animFrameId = requestAnimationFrame(animate);
      if (controls && controls.update) controls.update();
      if (renderer && scene && camera) renderer.render(scene, camera);
    }
    animate();
  }

  function update(params, opts) {
    if (!_initialized) return;
    chargeSphere.position.set(params.chargePos.x, params.chargePos.y, params.chargePos.z);
    if (lineSource) lineSource.position.set(params.chargePos.x, params.chargePos.y, params.chargePos.z);
    if (currentSphere) currentSphere.position.set(params.chargePos.x, params.chargePos.y, params.chargePos.z);
    buildFieldArrows(params, true, opts.y0Only, opts.modelId);
  }

  function intersectY0(mouseNDC) {
    if (!camera) return null;
    const r = new THREE.Raycaster(); r.setFromCamera(mouseNDC, camera);
    const t = new THREE.Vector3();
    const hit = r.ray.intersectPlane(new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0)), t);
    return hit ? { x: hit.x, z: hit.z } : null;
  }

  function setProbePosition(pos) {
    if (!probeSphere) return;
    if (pos) { probeSphere.position.set(pos.x, 0.01, pos.z); probeSphere.visible = true; }
    else { probeSphere.visible = false; }
  }

  function setDielectricSphere(visible) {
	    if (!_initialized || !dielectricSphere) return;
	    dielectricSphere.visible = visible;
	  }

	  function setSourceStyle(modelId) {
    if (!_initialized) return;
    chargeSphere.visible = false;
    if (lineSource) lineSource.visible = false;
    if (currentSphere) currentSphere.visible = false;
    if (modelId === "linecharge") {
      if (lineSource) lineSource.visible = true;
    } else if (modelId === "current") {
      if (currentSphere) currentSphere.visible = true;
    } else if (modelId === "sphere") {
      // No point source — uniform applied field
    } else {
      chargeSphere.visible = true;
    }
  }

  return { init, update, intersectY0, setProbePosition, setSourceStyle, setDielectricSphere };
})();

window.ThreeView = ThreeView;
