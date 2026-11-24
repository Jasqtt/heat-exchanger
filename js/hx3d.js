// Interactive 3D model of the Bicol University ChE double pipe heat exchanger.
// Built procedurally with three.js: five insulated pipe runs joined in a serpentine
// by U-bends, annulus crossover tees, end fittings, hoses and the red angle-iron stand.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

const wrap = document.getElementById('hero3d');
const canvas = document.getElementById('hx3d');

function fail() { wrap.classList.add('no3d'); }

try {
  init();
} catch (e) {
  console.error(e);
  fail();
}

function init() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 50);

  // ---------- lights ----------
  scene.add(new THREE.HemisphereLight(0xffffff, 0xf6e4e0, 1.1));
  const fill = new THREE.DirectionalLight(0xfff3f1, 0.7);
  fill.position.set(-2, -1.5, -2.5);
  scene.add(fill);
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(2.5, 5, 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -2.4, right: 2.4, top: 2.4, bottom: -2.4, near: 0.5, far: 12 });
  sun.shadow.radius = 4;
  sun.shadow.bias = -0.0005;
  scene.add(sun);

  // ---------- materials ----------
  const foil = foilTexture();
  const foilMat = new THREE.MeshStandardMaterial({
    color: 0xf3f5f7, metalness: 0.7, roughness: 0.3,
    map: foil, bumpMap: foil, bumpScale: 1.2,
  });
  const sleeveMat = foilMat.clone();
  sleeveMat.color = new THREE.Color(0xeef1f3);
  const steelRed = new THREE.MeshStandardMaterial({ color: 0x8f2b20, metalness: 0.35, roughness: 0.55 });
  const galv = new THREE.MeshStandardMaterial({ color: 0xa9adb0, metalness: 0.85, roughness: 0.35 });
  const blue = new THREE.MeshStandardMaterial({ color: 0x1f7fd9, metalness: 0.1, roughness: 0.35 });
  const black = new THREE.MeshStandardMaterial({ color: 0x1d1f22, metalness: 0.2, roughness: 0.5 });
  const red = new THREE.MeshStandardMaterial({ color: 0xb8344a, metalness: 0.1, roughness: 0.5 });
  const hoseMat = new THREE.MeshPhysicalMaterial({
    color: 0xf7f9fb, metalness: 0, roughness: 0.25, transmission: 0.25, thickness: 0.02, transparent: true, opacity: 0.95,
  });

  const model = new THREE.Group();
  scene.add(model);
  const realGroup = new THREE.Group();   // foil-wrapped look (hidden in flow mode)
  model.add(realGroup);

  // ---------- dimensions (metres) ----------
  const R = 1.25;          // half length of the straight runs
  const S = 0.17;          // spacing between runs
  const Y0 = 1.0;          // pipe centreline height
  const rIn = 0.042;       // insulated inner run / bends
  const rOut = 0.049;      // insulated outer pipe (annulus)
  const LOOP = 0.34;       // how far U-bends reach past the straights
  const rowZ = [-2, -1, 0, 1, 2].map(i => i * S);

  // ---------- serpentine (inner pipe path incl. U-bends) ----------
  const path = new THREE.CurvePath();
  const P = (x, z) => new THREE.Vector3(x, Y0, z);
  // row 0 runs right→left, 1 left→right, 2 right→left, 3 left→right, 4 right→left
  for (let i = 0; i < 5; i++) {
    const leftward = i % 2 === 0;
    const a = leftward ? P(R, rowZ[i]) : P(-R, rowZ[i]);
    const b = leftward ? P(-R, rowZ[i]) : P(R, rowZ[i]);
    path.add(new THREE.LineCurve3(a, b));
    if (i < 4) {
      const x = leftward ? -R : R;
      const dir = leftward ? -1 : 1;
      const z1 = rowZ[i], z2 = rowZ[i + 1];
      // teardrop-shaped U-bend, slightly wider than the pipe spacing (as in the photos)
      path.add(new THREE.CubicBezierCurve3(
        P(x, z1),
        P(x + dir * LOOP * 1.25, z1 - 0.05),
        P(x + dir * LOOP * 1.25, z2 + 0.05),
        P(x, z2),
      ));
    }
  }
  const pathLen = path.getLength();
  foil.repeat.set(pathLen / 0.22, 1);
  const serp = new THREE.Mesh(new THREE.TubeGeometry(path, 900, rIn, 24, false), foilMat);
  serp.castShadow = true; serp.receiveShadow = true;
  realGroup.add(serp);

  // ---------- outer pipes (thicker insulated sleeves on the straights) ----------
  const sleeveLen = 2 * R - 0.24;
  const sleeveFoil = foil.clone();
  sleeveFoil.needsUpdate = true;
  sleeveFoil.repeat.set(sleeveLen / 0.22, 1);
  sleeveMat.map = sleeveFoil; sleeveMat.bumpMap = sleeveFoil;
  rowZ.forEach(z => {
    const g = new THREE.CylinderGeometry(rOut, rOut, sleeveLen, 28, 1, false);
    rotateUV(g);
    const m = new THREE.Mesh(g, sleeveMat);
    m.rotation.z = Math.PI / 2;
    m.position.set(0, Y0, z);
    m.castShadow = true; m.receiveShadow = true;
    realGroup.add(m);
    // tapered collars where the outer pipe meets the bend
    [-1, 1].forEach(s => {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(rIn, rOut, 0.05, 28), sleeveMat);
      c.rotation.z = -s * Math.PI / 2;
      c.position.set(s * (sleeveLen / 2 + 0.025), Y0, z);
      c.castShadow = true;
      realGroup.add(c);
    });
  });

  // ---------- annulus crossover tees between joined runs ----------
  const teeX = R - 0.2;
  [[0, 1, -1], [2, 3, -1], [1, 2, 1], [3, 4, 1]].forEach(([i, j, side]) => {
    const z1 = rowZ[i], z2 = rowZ[j];
    const len = Math.abs(z2 - z1);
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, len, 20), sleeveMat);
    t.rotation.x = Math.PI / 2;
    t.position.set(side * teeX, Y0, (z1 + z2) / 2);
    t.castShadow = true;
    realGroup.add(t);
    [z1, z2].forEach(z => {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(rOut + 0.008, rOut + 0.008, 0.07, 28), sleeveMat);
      ring.rotation.z = Math.PI / 2;
      ring.position.set(side * teeX, Y0, z);
      realGroup.add(ring);
    });
  });

  // ---------- end fittings ----------
  // Row 0, right end: inner pipe outlet with black coupling + hose; side port with blue valve.
  {
    const z = rowZ[0];
    const stub = cyl(0.03, 0.03, 0.12, galv); stub.rotation.z = Math.PI / 2; stub.position.set(R + 0.06, Y0, z); model.add(stub);
    const coup = cyl(0.026, 0.026, 0.06, black); coup.rotation.z = Math.PI / 2; coup.position.set(R + 0.15, Y0, z); model.add(coup);
    hose([[R + 0.18, Y0, z], [R + 0.26, Y0 - 0.02, z], [R + 0.3, Y0 - 0.25, z + 0.02], [R + 0.27, 0.45, z + 0.05], [R + 0.33, 0.06, z + 0.02], [R + 0.6, 0.015, z - 0.1], [R + 0.85, 0.015, z - 0.05]]);
    // side port pointing out of the bundle (−z)
    const px = R - 0.1;
    const union = cyl(0.026, 0.026, 0.09, galv); union.rotation.x = Math.PI / 2; union.position.set(px, Y0, z - rOut - 0.04); model.add(union);
    const nut = cyl(0.032, 0.032, 0.035, galv, 6); nut.rotation.x = Math.PI / 2; nut.position.set(px, Y0, z - rOut - 0.07); model.add(nut);
    const bp = cyl(0.022, 0.022, 0.09, blue); bp.rotation.x = Math.PI / 2; bp.position.set(px, Y0, z - rOut - 0.13); model.add(bp);
    const elbow = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.022, 14, 20, Math.PI / 2), blue);
    elbow.rotation.y = Math.PI / 2;
    elbow.position.set(px, Y0 - 0.035, z - rOut - 0.175);
    model.add(elbow);
    const down = cyl(0.022, 0.022, 0.09, blue); down.position.set(px, Y0 - 0.08, z - rOut - 0.21); model.add(down);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.012, 0.022), blue);
    handle.position.set(px + 0.04, Y0 - 0.075, z - rOut - 0.21); model.add(handle);
  }
  // Row 4, left end: tapered inner outlet with red tip; side port with gray union + hose.
  {
    const z = rowZ[4];
    const taper = new THREE.Mesh(new THREE.CylinderGeometry(rIn, 0.024, 0.16, 24), foilMat);
    taper.rotation.z = Math.PI / 2; taper.position.set(-R - 0.08, Y0, z); taper.castShadow = true; realGroup.add(taper);
    const tip = cyl(0.019, 0.019, 0.03, red); tip.rotation.z = Math.PI / 2; tip.position.set(-R - 0.17, Y0, z); model.add(tip);
    const px = -R + 0.12;
    const union = cyl(0.026, 0.026, 0.09, galv); union.rotation.x = Math.PI / 2; union.position.set(px, Y0, z + rOut + 0.04); model.add(union);
    const nut = cyl(0.032, 0.032, 0.035, galv, 6); nut.rotation.x = Math.PI / 2; nut.position.set(px, Y0, z + rOut + 0.07); model.add(nut);
    const coup = cyl(0.024, 0.024, 0.05, black); coup.rotation.x = Math.PI / 2; coup.position.set(px, Y0, z + rOut + 0.115); model.add(coup);
    hose([[px, Y0, z + rOut + 0.14], [px, Y0 - 0.03, z + rOut + 0.22], [px - 0.03, Y0 - 0.3, z + 0.32], [px - 0.02, 0.4, z + 0.36], [px - 0.08, 0.05, z + 0.42], [px - 0.35, 0.015, z + 0.55], [px - 0.1, 0.015, z + 0.75], [px + 0.2, 0.015, z + 0.62]]);
  }

  // ---------- stand (red angle iron) ----------
  const SX = 0.78;           // support positions along the pipes
  const topY = Y0 - rOut - 0.02;
  const halfW = 0.47;
  const t = 0.04;
  [-SX, SX].forEach(x => {
    bar([x, topY, -halfW], [x, topY, halfW], t, 0.025);                    // crossbar under the pipes
    bar([x - 0.24, topY, 0], [x + 0.24, topY, 0], t, 0.025);               // short rail along the pipes
    bar([x, 0.62, 0], [x, 0.04, 0], t);                                    // leg
    bar([x, 0.62, 0], [x - 0.24, topY, 0], t);                             // Y brace
    bar([x, 0.62, 0], [x + 0.24, topY, 0], t);                             // Y brace
    bar([x, 0.62, 0], [x, topY, -halfW + 0.02], t * 0.85);                 // side brace
    bar([x, 0.62, 0], [x, topY, halfW - 0.02], t * 0.85);                  // side brace
    bar([x - 0.2, 0.02, 0], [x + 0.2, 0.02, 0], t);                        // foot
    bar([x, 0.02, -0.18], [x, 0.02, 0.18], t);                             // foot
    bar([x - 0.18, 0.03, 0], [x, 0.2, 0], t * 0.8);                        // foot gussets
    bar([x + 0.18, 0.03, 0], [x, 0.2, 0], t * 0.8);
  });
  bar([-SX, 0.26, 0], [SX, 0.26, 0], t);                                   // bottom stretcher


  // =====================================================================
  // FLOW MODE: see-through pipes with animated hot (annulus) and cold (inner) water
  // =====================================================================
  const flowGroup = new THREE.Group();
  flowGroup.visible = false;
  model.add(flowGroup);

  const chevron = chevronTexture();
  const FLOW_PERIOD = 0.12;           // metres per arrow
  const FLOW_SPEED = 0.32;            // metres per second (visual)

  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, metalness: 0.1, roughness: 0.08, transparent: true, opacity: 0.16, depthWrite: false,
  });
  const glassEdgeMat = new THREE.MeshStandardMaterial({ color: 0xdfe5ea, metalness: 0.6, roughness: 0.3 });

  // Cold water: inner pipe, through the U-bends (row 0 right end → row 4 left end)
  const coldPath = new THREE.CurvePath();
  coldPath.add(new THREE.LineCurve3(P(R + 0.14, rowZ[0]), P(R, rowZ[0])));
  path.curves.forEach(c => coldPath.add(c));
  coldPath.add(new THREE.LineCurve3(P(-R, rowZ[4]), P(-R - 0.17, rowZ[4])));

  // Hot water: annulus, through the crossover tees (row 0 blue-valve port → row 4 side port)
  const hotPts = [
    P(R - 0.1, rowZ[0] - rOut - 0.1), P(R - 0.1, rowZ[0]),
    P(-teeX, rowZ[0]), P(-teeX, rowZ[1]),
    P(teeX, rowZ[1]), P(teeX, rowZ[2]),
    P(-teeX, rowZ[2]), P(-teeX, rowZ[3]),
    P(teeX, rowZ[3]), P(teeX, rowZ[4]),
    P(-R + 0.12, rowZ[4]), P(-R + 0.12, rowZ[4] + rOut + 0.1),
  ];
  const hotFwd = roundedPath(hotPts, 0.045);
  const hotRev = roundedPath([...hotPts].reverse(), 0.045);

  // colour ramps (inlet → outlet)
  const COLD_IN = new THREE.Color(0x1d6fe0), COLD_OUT = new THREE.Color(0x8a7cf0);
  const HOT_IN = new THREE.Color(0xe0262f), HOT_OUT = new THREE.Color(0xff9a5c);

  function flowTube(curve, radius, cIn, cOut, opts = {}) {
    const len = curve.getLength();
    const geo = new THREE.TubeGeometry(curve, Math.max(200, Math.round(len * 120)), radius, 18, false);
    const uv = geo.attributes.uv, n = uv.count;
    const col = new Float32Array(n * 3), tmp = new THREE.Color();
    for (let i = 0; i < n; i++) {
      tmp.copy(cIn).lerp(cOut, uv.getX(i));
      col.set([tmp.r, tmp.g, tmp.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const tex = chevron.clone();
    tex.needsUpdate = true;
    tex.repeat.set(len / FLOW_PERIOD, 1);
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true, map: tex, roughness: 0.3, metalness: 0.05,
      transparent: !!opts.opacity, opacity: opts.opacity || 1, depthWrite: !opts.opacity,
      emissive: 0x111111,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.tex = tex;
    mesh.userData.len = len;
    return mesh;
  }

  const coldMesh = flowTube(coldPath, 0.021, COLD_IN, COLD_OUT);
  coldMesh.renderOrder = 0;
  flowGroup.add(coldMesh);

  const hotCo = flowTube(hotFwd, 0.04, HOT_IN, HOT_OUT, { opacity: 0.74 });
  const hotCounter = flowTube(hotRev, 0.04, HOT_IN, HOT_OUT, { opacity: 0.74 });
  [hotCo, hotCounter].forEach(m => { m.renderOrder = 1; flowGroup.add(m); });

  // clear outer shells so the water inside is visible
  rowZ.forEach(z => {
    const g = new THREE.Mesh(new THREE.CylinderGeometry(rOut, rOut, sleeveLen, 32, 1, true), glassMat);
    g.rotation.z = Math.PI / 2; g.position.set(0, Y0, z); g.renderOrder = 2;
    flowGroup.add(g);
    [-1, 1].forEach(sd => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(rOut, 0.004, 8, 32), glassEdgeMat);
      ring.rotation.y = Math.PI / 2; ring.position.set(sd * sleeveLen / 2, Y0, z);
      flowGroup.add(ring);
    });
  });
  // thin clear sleeve around the inner pipe where it runs through the U-bends
  const bendGlass = new THREE.Mesh(new THREE.TubeGeometry(path, 900, 0.027, 16, false), glassMat);
  bendGlass.renderOrder = 2;
  flowGroup.add(bendGlass);

  // in / out labels
  const labelRenderer = new CSS2DRenderer();
  labelRenderer.domElement.className = 'hx3d-labels';
  wrap.appendChild(labelRenderer.domElement);
  function label(cls) {
    const el = document.createElement('div');
    el.className = 'flow-label ' + cls;
    const obj = new CSS2DObject(el);
    flowGroup.add(obj);
    return { el, obj };
  }
  const L = {
    coldIn: label('cold'), coldOut: label('cold'),
    hotA: label('hot'), hotB: label('hot'),
  };
  L.coldIn.obj.position.set(R + 0.3, Y0 + 0.12, rowZ[0] + 0.05);
  L.coldOut.obj.position.set(-R - 0.3, Y0 + 0.12, rowZ[4] - 0.05);
  L.hotA.obj.position.set(R - 0.2, Y0 + 0.3, rowZ[0] - 0.3);      // blue-valve port (row 0)
  L.hotB.obj.position.set(-R + 0.2, Y0 + 0.3, rowZ[4] + 0.3);    // side port (row 4)
  L.coldIn.el.textContent = 'Cold water in';
  L.coldOut.el.textContent = 'Cold water out';

  // ---------- ground shadow ----------
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.ShadowMaterial({ opacity: 0.16 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // ---------- controls ----------
  const target = new THREE.Vector3(0, 0.62, 0);
  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(target);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 1.1;
  controls.maxDistance = 9;
  controls.maxPolarAngle = Math.PI * 0.62;  // can peek slightly underneath, like the photos from below
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.9;

  const home = { az: 0.95, pol: 1.05 };
  const FLOW_VIEW_WIDE = { az: 0.42, pol: 0.78, d: 1.1 };
  const FLOW_VIEW_TALL = { az: 1.3, pol: 0.86, d: 1.02 };   // portrait phones: pipes run toward the viewer
  const flowView = () => (canvas.clientWidth / Math.max(canvas.clientHeight, 1) < 0.95 ? FLOW_VIEW_TALL : FLOW_VIEW_WIDE);    // default viewing angle (radians)
  function fitDistance() {
    const aspect = canvas.clientWidth / Math.max(canvas.clientHeight, 1);
    const vfov = THREE.MathUtils.degToRad(camera.fov);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
    const radius = 1.75;
    return radius / Math.sin(Math.min(vfov, hfov) / 2) * 0.8;
  }
  function placeCamera() {
    const d = fitDistance();
    camera.position.set(
      target.x + d * Math.sin(home.pol) * Math.sin(home.az),
      target.y + d * Math.cos(home.pol),
      target.z + d * Math.sin(home.pol) * Math.cos(home.az),
    );
    controls.update();
  }

  let idleTimer;
  controls.addEventListener('start', () => {
    controls.autoRotate = false;
    wrap.classList.add('touched');
    clearTimeout(idleTimer);
  });
  controls.addEventListener('end', () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { if (mode === 'real') controls.autoRotate = true; }, 6000);
  });
  controls.addEventListener('start', () => { tween = null; });

  const resetBtn = document.getElementById('hx3d-reset');
  if (resetBtn) resetBtn.addEventListener('click', () => {
    const flow = mode !== 'real';
    flyTo(flow ? flowView().az : home.az, flow ? flowView().pol : home.pol, flow ? flowView().d : 1);
    controls.autoRotate = !flow;
  });


  // ---------- modes ----------
  let mode = 'real';
  let tween = null;
  function flyTo(az, pol, distScale = 1) {
    const d = fitDistance() * distScale;
    const to = new THREE.Vector3(
      target.x + d * Math.sin(pol) * Math.sin(az),
      target.y + d * Math.cos(pol),
      target.z + d * Math.sin(pol) * Math.cos(az),
    );
    tween = { from: camera.position.clone(), fromT: controls.target.clone(), to, t: 0 };
  }
  function setMode(m) {
    mode = m;
    const flow = m === 'counter' || m === 'co';
    realGroup.visible = !flow;
    flowGroup.visible = flow;
    hotCo.visible = m === 'co';
    hotCounter.visible = m === 'counter';
    if (m === 'counter') {
      L.hotA.el.textContent = 'Hot water out';
      L.hotB.el.textContent = 'Hot water in';
    } else if (m === 'co') {
      L.hotA.el.textContent = 'Hot water in';
      L.hotB.el.textContent = 'Hot water out';
    }
    wrap.classList.toggle('flow', flow);
    [steelRed, hoseMat].forEach(mt => {
      mt.transparent = flow || mt === hoseMat;
      mt.opacity = flow ? (mt === steelRed ? 0.22 : 0.3) : (mt === hoseMat ? 0.95 : 1);
      mt.depthWrite = !flow;
      mt.needsUpdate = true;
    });
    controls.autoRotate = !flow;
    flyTo(flow ? flowView().az : home.az, flow ? flowView().pol : home.pol, flow ? flowView().d : 1);
  }
  window.HX3D = { setMode, get mode() { return mode; } };

  // ---------- sizing + render loop ----------
  let lastW = 0, lastH = 0, placed = false;
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w === lastW && h === lastH) return;
    lastW = w; lastH = h;
    renderer.setSize(w, h, false);
    labelRenderer.setSize(w, h);
    camera.aspect = w / Math.max(h, 1);
    camera.updateProjectionMatrix();
    if (!placed) { placeCamera(); placed = true; }
  }

  let visible = true;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(wrap);
  }

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    if (!visible) return;
    resize();
    if (tween) {
      tween.t = Math.min(1, tween.t + dt / 0.9);
      const e = tween.t < 0.5 ? 2 * tween.t * tween.t : 1 - Math.pow(-2 * tween.t + 2, 2) / 2;
      camera.position.lerpVectors(tween.from, tween.to, e);
      controls.target.lerpVectors(tween.fromT, target, e);
      if (tween.t >= 1) tween = null;
    }
    if (flowGroup.visible) {
      const step = (FLOW_SPEED * dt) / FLOW_PERIOD;
      [coldMesh, hotCo, hotCounter].forEach(m => { if (m.visible) m.userData.tex.offset.x -= step; });
    }
    controls.update();
    renderer.render(scene, camera);
    if (flowGroup.visible) labelRenderer.render(scene, camera);
  });
  wrap.classList.add('ready');
  window.__hx3dReady = true;

  // ---------- helpers ----------
  function cyl(r1, r2, h, mat, seg = 20) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), mat);
    m.castShadow = true;
    return m;
  }
  function bar(a, b, w, d) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
    const dir = new THREE.Vector3().subVectors(B, A);
    const len = dir.length();
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, len, d || w), steelRed);
    m.position.copy(A).add(B).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    m.castShadow = true; m.receiveShadow = true;
    model.add(m);
    return m;
  }
  function hose(pts) {
    const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)), false, 'centripetal');
    const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 120, 0.013, 12, false), hoseMat);
    m.castShadow = true;
    model.add(m);
  }
  function rotateUV(g) {
    // Cylinder UVs run u around / v along; swap so the foil texture runs along the pipe like the tube.
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      const u = uv.getX(i), v = uv.getY(i);
      uv.setXY(i, v, u);
    }
  }
}

// Polyline with rounded corners (for the annulus route through the tees).
function roundedPath(pts, r) {
  const cp = new THREE.CurvePath();
  let start = pts[0].clone();
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1], b = pts[i], c = pts[i + 1];
    const d1 = new THREE.Vector3().subVectors(b, a), d2 = new THREE.Vector3().subVectors(c, b);
    const rr = Math.min(r, d1.length() / 2, d2.length() / 2);
    const p1 = b.clone().addScaledVector(d1.normalize(), -rr);
    const p2 = b.clone().addScaledVector(d2.normalize(), rr);
    if (start.distanceTo(p1) > 1e-6) cp.add(new THREE.LineCurve3(start, p1));
    cp.add(new THREE.QuadraticBezierCurve3(p1, b.clone(), p2));
    start = p2;
  }
  cp.add(new THREE.LineCurve3(start, pts[pts.length - 1].clone()));
  return cp;
}

// Light arrow (chevron) stripes; multiplied with the water colour and scrolled to show flow.
function chevronTexture() {
  const W = 128, H = 64;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#9c9c9c';
  g.fillRect(0, 0, W, H);
  g.strokeStyle = '#ffffff';
  g.lineWidth = 14;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  // arrow pointing in +u (to the right in texture space)
  g.beginPath();
  g.moveTo(44, 6); g.lineTo(82, H / 2); g.lineTo(44, H - 6);
  g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// Crinkled foil-tape texture, drawn on a canvas: wrinkles plus tape seams.
function foilTexture() {
  const W = 256, H = 256;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#c9cdd1';
  g.fillRect(0, 0, W, H);
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  // soft blotches
  for (let i = 0; i < 70; i++) {
    const x = rnd() * W, y = rnd() * H, r = 10 + rnd() * 40;
    const l = 175 + rnd() * 70;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, `rgba(${l},${l + 3},${l + 6},0.55)`);
    grd.addColorStop(1, 'rgba(200,204,208,0)');
    g.fillStyle = grd;
    g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  // wrinkles
  for (let i = 0; i < 520; i++) {
    const x = rnd() * W, y = rnd() * H;
    const len = 4 + rnd() * 16, ang = rnd() * Math.PI;
    const l = rnd() < 0.5 ? 120 + rnd() * 40 : 225 + rnd() * 30;
    g.strokeStyle = `rgba(${l},${l},${l + 4},${0.35 + rnd() * 0.4})`;
    g.lineWidth = 0.6 + rnd() * 1.2;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    g.stroke();
  }
  // tape seams running around the pipe (vertical lines in texture space = across the length)
  for (const sx of [40, 140, 210]) {
    g.fillStyle = 'rgba(120,124,130,0.55)';
    g.fillRect(sx, 0, 2, H);
    g.fillStyle = 'rgba(245,247,250,0.6)';
    g.fillRect(sx + 2, 0, 2, H);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
