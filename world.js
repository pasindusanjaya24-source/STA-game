// world.js — Procedural Textures, Sri Lankan Buildings, Roads, Power Lines & Colliders
const THREE = window.THREE;

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------- Shared colour palette (single source of truth) ---------- */
export const PAL = {
  fog: 0xcde6ee,          // horizon haze: used by BOTH sky dome + scene fog (no seam)
  skyTop: 0x2f7fd1,
  sun: 0xfff0cf,
  hemiSky: 0xbfdcf5,
  hemiGround: 0x4f7a3a,
  ground: [0x4c9f3e, 0x37833a, 0x6db34a],
  walls: [0xf4ead3, 0xf0b04c, 0x7cc4b3, 0xe58fa0, 0x8fb9e3, 0xe6d291],
  roofs: [0xb9552e, 0x9c4326, 0x7f858b, 0xc96a34]
};

let seed = 20260;
export function rand() {
  seed |= 0;
  seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const rr = (a, b) => a + (b - a) * rand();

/* ---------- Procedural Canvas Texture Generators ---------- */
function makeRoadTex() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#3d4146';
  ctx.fillRect(0, 0, 512, 512);

  // Tarmac grain & subtle cracks
  for (let i = 0; i < 4500; i++) {
    const v = 52 + ((Math.random() * 34) | 0);
    ctx.fillStyle = `rgb(${v},${v},${v + 2})`;
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }
  ctx.strokeStyle = 'rgba(20,22,24,0.28)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 18; i++) {
    ctx.beginPath();
    let x = Math.random() * 512, y = Math.random() * 512;
    ctx.moveTo(x, y);
    for (let s = 0; s < 5; s++) { x += (Math.random() - 0.5) * 35; y += (Math.random() - 0.5) * 35; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = 8;
  tex.repeat.set(40, 2);
  return tex;
}

function makeShoulderTex() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#b99c6b';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2400; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(92,68,38,0.25)' : 'rgba(235,214,170,0.25)';
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 2.5, 2.5);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = 8;
  tex.repeat.set(50, 3);
  return tex;
}

function makeBrickTex() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#c9b89e'; // mortar
  ctx.fillRect(0, 0, 256, 256);
  const rows = 8, cols = 4, bh = 256 / rows, bw = 256 / cols;
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * (bw * 0.5);
    for (let col = -1; col <= cols; col++) {
      const shade = 165 + ((Math.random() * 35) | 0);
      ctx.fillStyle = `rgb(${shade},${Math.round(shade * 0.48)},${Math.round(shade * 0.32)})`;
      ctx.fillRect(col * bw + off + 2, r * bh + 2, bw - 4, bh - 4);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = 8;
  tex.repeat.set(2, 1.5);
  return tex;
}

const unitBox = new THREE.BoxGeometry(1, 1, 1);
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
const _v = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _c = new THREE.Color();

const part = (g, col, x = 0, y = 0, z = 0, o = {}) => ({
  g, col, x, y, z, rx: o.rx || 0, ry: o.ry || 0, rz: o.rz || 0, s: o.s || [1, 1, 1]
});
const box = (w, h, d, col, x, y, z, o = {}) => { o.s = [w, h, d]; return part(unitBox, col, x, y, z, o); };

function merge(parts) {
  const pos = [], col = [];
  for (const p of parts) {
    const g = p.g.index ? p.g.toNonIndexed() : p.g.clone();
    _e.set(p.rx, p.ry, p.rz, 'YXZ');
    _q.setFromEuler(_e);
    _v.set(p.x, p.y, p.z);
    _s.set(p.s[0], p.s[1], p.s[2]);
    g.applyMatrix4(_m.compose(_v, _q, _s));
    const a = g.attributes.position.array;
    _c.set(p.col);
    for (let i = 0; i < a.length; i += 3) {
      pos.push(a[i], a[i + 1], a[i + 2]);
      col.push(_c.r, _c.g, _c.b);
    }
    g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return geo;
}

const polyGeo = arr => {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
  return g;
};

const worldMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });

export function buildWorld(scene) {
  const cols = [];
  const landmarks = [];

  const addCol = (cx, cz, w, d, h, b = false) =>
    cols.push({ x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2, h, b });

  function placeObj(obj, x, z, ry, w, d, h, b = true) {
    obj.position.set(x, 0, z);
    obj.rotation.y = ry;
    obj.traverse(ch => {
      if (ch.isMesh) { ch.castShadow = b; ch.receiveShadow = true; }
    });
    scene.add(obj);
    const sw = Math.abs(Math.sin(ry)) > 0.5;
    addCol(x, z, sw ? d : w, sw ? w : d, h, b);
  }

  function inst(geo, mats, tint = false, cast = true, recv = true) {
    const m = new THREE.InstancedMesh(geo, worldMat, mats.length);
    mats.forEach((mat, i) => m.setMatrixAt(i, mat));
    if (tint) mats.forEach((_, i) => m.setColorAt(i, new THREE.Color().setScalar(rr(0.82, 1))));
    m.castShadow = cast;
    m.receiveShadow = recv;
    m.frustumCulled = false;
    scene.add(m);
    return m;
  }

  const mx = (x, y, z, ry, s) =>
    new THREE.Matrix4().compose(_v.set(x, y, z), _q.setFromEuler(_e.set(0, ry, 0, 'YXZ')), _s.set(s, s, s));

  // Sky dome, Sun & Clouds
  const FOG = PAL.fog;
  const SUN = new THREE.Vector3(0.5, 0.62, -0.4).normalize();
  const sg = new THREE.SphereGeometry(320, 16, 10), sp = sg.attributes.position, sc = [];
  const cH = new THREE.Color(FOG), cT = new THREE.Color(PAL.skyTop), cc = new THREE.Color();
  for (let i = 0; i < sp.count; i++) {
    cc.copy(cH).lerp(cT, Math.pow(clamp(sp.getY(i) / 320, 0, 1), 0.55));
    sc.push(cc.r, cc.g, cc.b);
  }
  sg.setAttribute('color', new THREE.Float32BufferAttribute(sc, 3));
  const sky = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.renderOrder = -2; sky.frustumCulled = false;
  scene.add(sky);

  [[16, 1, 295, -1], [42, 0.22, 296, -1.5]].forEach(([r, o, d, ro]) => {
    const s = new THREE.Mesh(new THREE.CircleGeometry(r, 20), new THREE.MeshBasicMaterial({ color: 0xfff6cf, fog: false, depthWrite: false, transparent: o < 1, opacity: o }));
    s.position.copy(SUN).multiplyScalar(d);
    s.lookAt(0, 0, 0); s.renderOrder = ro;
    sky.add(s);
  });

  const cloudGeo = (() => {
    const P = [], g = new THREE.IcosahedronGeometry(1, 0);
    [[0, 0, 0, 9], [8, -1, 2, 7], [-8, -1, -1, 7], [3, 2, -3, 6]].forEach(a =>
      P.push(part(g, 0xffffff, a[0], a[1], a[2], { s: [a[3] * 1.5, a[3] * 0.55, a[3]] }))
    );
    return merge(P);
  })();
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x777777, vertexColors: true, fog: false });
  const clouds = [];
  for (let i = 0; i < 12; i++) {
    const c = new THREE.Mesh(cloudGeo, cloudMat);
    c.position.set(rr(-230, 230), rr(72, 98), rr(-230, 230));
    c.scale.setScalar(rr(0.8, 1.6));
    scene.add(c);
    clouds.push(c);
  }

  // Ground Plane
  {
    const g = new THREE.PlaneGeometry(900, 900, 80, 80);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, col = [], a = new THREE.Color(PAL.ground[0]), b = new THREE.Color(PAL.ground[1]), c = new THREE.Color(PAL.ground[2]), t = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      const n = Math.sin(x * 0.045) * Math.cos(z * 0.05) + Math.sin(x * 0.13 + z * 0.09) * 0.5 + (rand() - 0.5) * 0.5;
      t.copy(a).lerp(n > 0 ? c : b, Math.min(1, Math.abs(n) * 0.6));
      col.push(t.r, t.g, t.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const gm = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true }));
    gm.receiveShadow = true;
    scene.add(gm);
  }

  // Procedural Textured Roads & Shoulders
  const roadTex = makeRoadTex();
  const shoulderTex = makeShoulderTex();
  const strip = (w, l, x, z, y, mat) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l).rotateX(-Math.PI / 2), mat);
    m.position.set(x, y, z);
    m.receiveShadow = true;
    scene.add(m);
  };
  const shMat = new THREE.MeshLambertMaterial({ map: shoulderTex });
  const rdMat = new THREE.MeshLambertMaterial({ map: roadTex });

  strip(320, 16, 0, 0, 0.02, shMat);
  strip(13, 150, 20, -75, 0.03, shMat);
  strip(320, 10, 0, 0, 0.05, rdMat);
  strip(7, 150, 20, -75, 0.08, rdMat);

  {
    const P = [], W = 0xf8fafc;
    P.push(box(320, 0.02, 0.18, W, 0, 0.115, 4.55));
    P.push(box(176, 0.02, 0.18, W, -72, 0.115, -4.55), box(136, 0.02, 0.18, W, 92, 0.115, -4.55));
    P.push(box(0.18, 0.02, 145, W, 16.8, 0.12, -77.5), box(0.18, 0.02, 145, W, 23.2, 0.12, -77.5));
    for (let x = -156; x <= 156; x += 5) if (Math.abs(x - 20) > 8) P.push(box(2.4, 0.02, 0.2, W, x, 0.125, 0));
    for (let z = -12; z >= -148; z -= 5) P.push(box(0.2, 0.02, 2.4, W, 20, 0.13, z));
    for (let i = 0; i < 9; i++) P.push(box(3.2, 0.02, 0.5, W, 10, 0.13, -3.6 + i * 0.9));
    const mk = new THREE.Mesh(merge(P), worldMat);
    mk.receiveShadow = true;
    scene.add(mk);
  }

  // Sri Lankan Houses & Brick Shops
  const roofGeo = (w, d, h) => {
    const x = w / 2, z = d / 2, A = [-x, 0, z], B = [x, 0, z], C = [x, h, 0], D = [-x, h, 0], E = [-x, 0, -z], F = [x, 0, -z];
    return polyGeo([...A, ...B, ...C, ...A, ...C, ...D, ...F, ...E, ...D, ...F, ...D, ...C]);
  };
  const gableEnds = (w, d, h) => {
    const x = w / 2, z = d / 2;
    return polyGeo([-x, 0, z, -x, 0, -z, -x, h, 0, x, 0, z, x, 0, -z, x, h, 0]);
  };

  function houseGeo(wall, roof) {
    const P = [];
    P.push(box(8.6, 0.2, 6.6, 0x9a9a8f, 0, 0.1, 0), box(8, 3, 6, wall, 0, 1.7, 0));
    P.push(part(gableEnds(8, 6, 1.6), wall, 0, 3.2, 0), part(roofGeo(9.2, 7.6, 1.9), roof, 0, 3.1, 0));
    P.push(box(8.6, 0.1, 2.4, 0xb8b3a5, 0, 0.05, 4.5), box(9, 0.18, 2.6, roof, 0, 3.0, 4.3));
    for (const px of [-4, -1.3, 1.3, 4]) P.push(box(0.26, 2.8, 0.26, 0xf4efe2, px, 1.5, 5.3));
    P.push(box(1.2, 2.2, 0.12, 0x5b3a22, 0, 1.3, 3.02));
    for (const wx of [-2.5, 2.5]) P.push(box(1.4, 1.1, 0.1, 0x2f7d6b, wx, 1.95, 3.02), box(1.1, 0.8, 0.12, 0x8fd6ea, wx, 1.95, 3.04));
    return merge(P);
  }

  const brickTex = makeBrickTex();
  const brickMat = new THREE.MeshLambertMaterial({ map: brickTex });

  function shopGeo(aw) {
    const P = [], gc = [0xf2c94c, 0xe67e22, 0x7bc043, 0xe84a5f, 0x5dade2];
    P.push(box(7.4, 0.25, 6.4, 0x77797a, 0, 3.7, 0), box(7.4, 1.1, 0.2, 0xe8dfd1, 0, 4.3, 3.1));
    P.push(box(5.4, 2.4, 0.1, 0x2b2b2b, 0, 1.4, 3.02), box(5.4, 0.9, 0.7, 0x8b5e3c, 0, 0.45, 3.4));
    gc.forEach((c, i) => P.push(box(0.7, 0.5, 0.45, c, -2 + i, 1.15, 3.4)));
    for (let i = 0; i < 6; i++) P.push(box(0.9, 0.12, 1.9, i % 2 ? 0xffffff : aw, -2.25 + i * 0.9, 3.0, 4.0, { rx: 0.25 }));
    return merge(P);
  }

  function signTex(txt, bg, fg) {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 96;
    const x = c.getContext('2d');
    x.fillStyle = bg; x.fillRect(0, 0, 512, 96);
    x.strokeStyle = fg; x.lineWidth = 6; x.strokeRect(6, 6, 500, 84);
    x.fillStyle = fg; x.font = 'bold 44px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(txt, 256, 50);
    return new THREE.CanvasTexture(c);
  }

  const wallC = PAL.walls;
  const roofC = PAL.roofs;
  const hGeos = wallC.map((w, i) => houseGeo(w, roofC[i % roofC.length]));
  const house = (x, z, ry) => placeObj(new THREE.Mesh(hGeos[(rand() * hGeos.length) | 0], worldMat), x + rr(-1.5, 1.5), z + rr(-1, 1), ry, 8.2, 6.2, 3.2, true);

  for (let x = -135; x <= -15; x += 24) house(x, -15, 0);
  for (let x = 50; x <= 140; x += 26) house(x, -15, 0);
  for (let x = -129; x <= -21; x += 24) house(x, 15, Math.PI);
  for (let x = 64; x <= 140; x += 25) house(x, 15, Math.PI);
  for (let z = -30; z >= -130; z -= 24) { house(30, z, -Math.PI / 2); house(10, z, Math.PI / 2); }

  [
    [2, 'PERERA STORES', '#7a1f2b', '#ffe9a8', 0xd9382c],
    [12, 'LANKA TEA KADE', '#1d5c3a', '#fff3c4', 0x2e8b57],
    [30, 'RANI PHARMACY', '#1f4e79', '#ffffff', 0x2e6fb5],
    [40, 'SAMAN TEXTILES', '#8a4b08', '#ffe0a0', 0xe6a817]
  ].forEach(s => {
    const g = new THREE.Group();
    const brickWall = new THREE.Mesh(new THREE.BoxGeometry(7, 3.6, 6), brickMat);
    brickWall.position.y = 1.8;
    g.add(brickWall);
    g.add(new THREE.Mesh(shopGeo(s[4]), worldMat));
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 0.975), new THREE.MeshBasicMaterial({ map: signTex(s[1], s[2], s[3]) }));
    sign.position.set(0, 4.3, 3.22);
    g.add(sign);
    placeObj(g, s[0], 10.5, Math.PI, 7.2, 6.2, 4, true);
    landmarks.push({ name: s[1], x: s[0], z: 6.2, color: '#f5c518' });
  });

  // Fruit Stall
  const stallGeo = (() => {
    const P = [], fc = [0xf2c94c, 0xe67e22, 0x7bc043, 0xe84a5f, 0xf2c94c, 0x7bc043];
    P.push(box(3, 0.8, 1.2, 0x8b5e3c, 0, 0.4, 0));
    fc.forEach((c, i) => P.push(box(0.5, 0.3, 0.5, c, -1.2 + i * 0.48, 0.95, i % 2 ? 0.2 : -0.2)));
    for (const sx of [-1.5, 1.5]) for (const sz of [-0.6, 0.6]) P.push(box(0.08, 2.4, 0.08, 0x6b4a2b, sx, 1.2, sz));
    for (let i = 0; i < 6; i++) P.push(box(0.5, 0.06, 1.8, i % 2 ? 0xffffff : 0xd9382c, -1.25 + i * 0.5, 2.45, 0, { rx: 0.12 }));
    return merge(P);
  })();
  placeObj(new THREE.Mesh(stallGeo, worldMat), 21, 8.6, 0, 3.2, 1.4, 0.9, false);

  // Sacred Stupa
  const stupaGeo = merge([
    part(new THREE.CylinderGeometry(8, 8.4, 0.3, 16), 0xe9e3d3, 0, 0.15, 0),
    part(new THREE.CylinderGeometry(6, 6.3, 0.3, 16), 0xf4efe2, 0, 0.45, 0),
    part(new THREE.SphereGeometry(4.6, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0xfbfaf5, 0, 0.6, 0),
    box(1.8, 1.2, 1.8, 0xe6b422, 0, 5.8, 0),
    part(new THREE.ConeGeometry(0.95, 3.4, 8), 0xe6b422, 0, 8.1, 0),
    part(new THREE.IcosahedronGeometry(0.2, 0), 0xf5c518, 0, 10, 0)
  ]);
  placeObj(new THREE.Mesh(stupaGeo, worldMat), -55, -45, 0, 9.4, 9.4, 6, true);
  landmarks.push({ name: 'Sacred Stupa', x: -55, z: -34, color: '#ffffff' });

  // Bus Halt & Landmarks
  const busGeo = merge([
    box(4, 2.2, 0.15, 0xe8e2d0, 0, 1.2, -0.9), box(4.4, 0.15, 2.2, 0x2e5eaa, 0, 2.4, 0),
    box(0.15, 2.2, 1.6, 0xe8e2d0, -2, 1.2, 0), box(0.15, 2.2, 1.6, 0xe8e2d0, 2, 1.2, 0),
    box(3, 0.1, 0.5, 0x7a4d2c, 0, 0.5, -0.55), box(0.1, 0.5, 0.4, 0x444444, -1.2, 0.25, -0.55), box(0.1, 0.5, 0.4, 0x444444, 1.2, 0.25, -0.55)
  ]);
  placeObj(new THREE.Mesh(busGeo, worldMat), -34, -8.3, 0, 4.4, 2.2, 2.4, true);
  landmarks.push({ name: 'Town Bus Stand', x: -34, z: -5.5, color: '#38bdf8' });
  landmarks.push({ name: 'North Village Junction', x: 20, z: -115, color: '#a855f7' });
  landmarks.push({ name: 'East Highway', x: 115, z: 0, color: '#fb923c' });

  // Utility Poles + Overhead Wires + Lamps
  const lampGeo = merge([
    box(0.14, 6.2, 0.14, 0x4b5563, 0, 3.1, 0),
    box(1.2, 0.08, 0.08, 0x4b5563, 0.55, 5.2, 0),
    box(0.4, 0.15, 0.28, 0xffe9a0, 1.1, 5.1, 0),
    box(0.9, 0.08, 0.08, 0x374151, 0, 5.9, 0) // Cross-arm for power cables
  ]);
  const L = [], polePositions = [];
  for (let x = -140; x <= 140; x += 28) {
    if (Math.abs(x - 20) < 9) continue;
    L.push(mx(x, 0, -5.9, -Math.PI / 2, 1)); addCol(x, -5.9, 0.3, 0.3, 6, false);
    polePositions.push([x, 5.9, -5.9]);
    L.push(mx(x + 14, 0, 5.9, Math.PI / 2, 1)); addCol(x + 14, 5.9, 0.3, 0.3, 6, false);
  }
  inst(lampGeo, L, false, true, false);

  // Overhead cables between north poles
  const wirePts = [];
  for (let i = 0; i < polePositions.length - 1; i++) {
    const [x1, y1, z1] = polePositions[i], [x2, y2, z2] = polePositions[i + 1];
    if (Math.abs(x2 - x1) > 45) continue;
    for (const off of [-0.35, 0.35]) {
      const steps = 8;
      for (let s = 0; s < steps; s++) {
        const t0 = s / steps, t1 = (s + 1) / steps;
        const sag0 = Math.sin(t0 * Math.PI) * 0.45, sag1 = Math.sin(t1 * Math.PI) * 0.45;
        wirePts.push(
          x1 + (x2 - x1) * t0, y1 - sag0, z1 + off,
          x1 + (x2 - x1) * t1, y2 - sag1, z2 + off
        );
      }
    }
  }
  const wireGeo = new THREE.BufferGeometry();
  wireGeo.setAttribute('position', new THREE.Float32BufferAttribute(wirePts, 3));
  scene.add(new THREE.LineSegments(wireGeo, new THREE.LineBasicMaterial({ color: 0x1e293b })));

  // Coconut Palms, Bushes & Banana Trees
  const treeGeo = (() => {
    const P = [], tc = [0x7b5a3a, 0x8d6b47, 0x7b5a3a]; let cx = 0, cy = 0;
    for (let i = 0; i < 3; i++) {
      const a = 0.06 + 0.05 * i, rb = 0.32 - 0.06 * i;
      P.push(part(new THREE.CylinderGeometry(rb - 0.05, rb, 2.4, 6).translate(0, 1.2, 0), tc[i], cx, cy, 0, { rz: -a }));
      cx += Math.sin(a) * 2.4; cy += Math.cos(a) * 2.4;
    }
    const f1 = new THREE.BoxGeometry(0.5, 0.06, 1.4).translate(0, 0, 0.7), f2 = new THREE.BoxGeometry(0.4, 0.05, 1.3).translate(0, 0, 0.65);
    for (let i = 0; i < 8; i++) {
      const ry = i / 8 * Math.PI * 2 + 0.2;
      P.push(part(f1, 0x3f9a3a, cx, cy, 0, { rx: -0.3, ry }), part(f2, 0x2f8530, cx + Math.sin(ry) * 1.338, cy + 0.414, Math.cos(ry) * 1.338, { rx: 0.8, ry }));
    }
    const nut = new THREE.IcosahedronGeometry(0.2, 0);
    for (let i = 0; i < 3; i++) P.push(part(nut, 0x5a3b1a, cx + Math.cos(i * 2.1) * 0.25, cy - 0.25, Math.sin(i * 2.1) * 0.25));
    return merge(P);
  })();

  const bushGeo = (() => {
    const P = [], g = new THREE.IcosahedronGeometry(1, 0), fl = new THREE.IcosahedronGeometry(0.12, 0);
    [[0, 0.6, 0, 1, 0x3f8f3a], [0.8, 0.45, 0.2, 0.75, 0x4aa044], [-0.7, 0.4, -0.2, 0.7, 0x377f35]].forEach(a => P.push(part(g, a[4], a[0], a[1], a[2], { s: [a[3], a[3] * 0.8, a[3]] })));
    [[0.3, 1, 0.5, 0xff7aa8], [-0.4, 0.9, 0.4, 0xfff1a8], [0.9, 0.85, 0.6, 0xff5c5c]].forEach(a => P.push(part(fl, a[3], a[0], a[1], a[2])));
    return merge(P);
  })();

  const bananaGeo = (() => {
    const P = [];
    P.push(part(new THREE.CylinderGeometry(0.12, 0.18, 1.9, 5).translate(0, 0.95, 0), 0x9bb04e));
    const lf = new THREE.BoxGeometry(0.75, 0.05, 2.4).translate(0, 0, 1.2);
    for (let i = 0; i < 6; i++) P.push(part(lf, 0x58b04a, 0, 1.9, 0, { rx: 0.45 - (i % 2) * 0.5, ry: i / 6 * 6.283 }));
    return merge(P);
  })();

  function free(x, z, m) {
    if (Math.abs(z) < 9.5 || (Math.abs(x - 20) < 9 && z < 9.5)) return false;
    if (x > 74 && x < 112 && z > -62 && z < -28) return false; // keep practice range clear
    for (const c of cols) if (x > c.x0 - m && x < c.x1 + m && z > c.z0 - m && z < c.z1 + m) return false;
    return true;
  }
  function scatter(n, m, fn) {
    let k = 0, t = 0;
    while (k < n && t++ < n * 40) {
      const x = rr(-150, 150), z = rr(-150, 150);
      if (free(x, z, m)) { fn(x, z); k++; }
    }
  }

  const T = []; scatter(170, 3, (x, z) => { T.push(mx(x, 0, z, rr(0, 6.28), rr(0.8, 1.4))); addCol(x, z, 0.7, 0.7, 9, false); }); inst(treeGeo, T);
  const B = []; scatter(150, 1.6, (x, z) => B.push(mx(x, 0, z, rr(0, 6.28), rr(0.8, 1.7)))); inst(bushGeo, B, true, false, true);
  const BN = []; scatter(40, 2, (x, z) => BN.push(mx(x, 0, z, rr(0, 6.28), rr(0.9, 1.3)))); inst(bananaGeo, BN, true, false, true);

  return { cols, sky, clouds, landmarks };
}