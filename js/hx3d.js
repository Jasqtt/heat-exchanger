// Interactive 3D model of the Bicol University ChE double pipe heat exchanger.
// Built procedurally with three.js: five insulated pipe runs joined in a serpentine
// by U-bends, annulus crossover tees, end fittings, hoses and the red angle-iron stand.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

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
  model.add(serp);

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
    model.add(m);
    // tapered collars where the outer pipe meets the bend
    [-1, 1].forEach(s => {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(rIn, rOut, 0.05, 28), sleeveMat);
      c.rotation.z = -s * Math.PI / 2;
      c.position.set(s * (sleeveLen / 2 + 0.025), Y0, z);
      c.castShadow = true;
      model.add(c);
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
    model.add(t);
    [z1, z2].forEach(z => {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(rOut + 0.008, rOut + 0.008, 0.07, 28), sleeveMat);
      ring.rotation.z = Math.PI / 2;
      ring.position.set(side * teeX, Y0, z);
      model.add(ring);
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
    taper.rotation.z = Math.PI / 2; taper.position.set(-R - 0.08, Y0, z); taper.castShadow = true; model.add(taper);
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

  const home = { az: 0.95, pol: 1.05 };    // default viewing angle (radians)
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
    idleTimer = setTimeout(() => { controls.autoRotate = true; }, 6000);
  });

  const resetBtn = document.getElementById('hx3d-reset');
  if (resetBtn) resetBtn.addEventListener('click', () => {
    controls.target.copy(target);
    placeCamera();
    controls.autoRotate = true;
  });

  // ---------- sizing + render loop ----------
  let lastW = 0, lastH = 0, placed = false;
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w === lastW && h === lastH) return;
    lastW = w; lastH = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(h, 1);
    camera.updateProjectionMatrix();
    if (!placed) { placeCamera(); placed = true; }
  }

  let visible = true;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(wrap);
  }

  renderer.setAnimationLoop(() => {
    if (!visible) return;
    resize();
    controls.update();
    renderer.render(scene, camera);
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
