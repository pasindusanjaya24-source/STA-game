// world.js — Sri Lankan Environment, Buildings, Roads, Vegetation & Colliders
const THREE = window.THREE;

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Seeded PRNG for consistent town generation
let seed = 20260;
export function rand() {
  seed |= 0;
  seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const rr = (a, b) => a + (b - a) * rand();

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
  const landmarks = []; // Used for radar minimap & missions

  const addCol = (cx, cz, w, d, h, b = false) =>
    cols.push({ x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2, h, b });

  function placeObj(obj, x, z, ry, w, d, h, b = true) {
    obj.position.set(x, 0, z);
    obj.rotation.y = ry;
    scene.add(obj);
    const sw = Math.abs(Math.sin(ry)) > 0.5;
    addCol(x, z, sw ? d : w, sw ? w : d, h, b);
  }

  function inst(geo, mats, tint = false) {
    const m = new THREE.InstancedMesh(geo, worldMat, mats.length);
    mats.forEach((mat, i) => m.setMatrixAt(i, mat));
    if (tint) mats.forEach((_, i) => m.setColorAt(i, new THREE.Color().setScalar(rr(0.8, 1))));
    m.frustumCulled = false;
    scene.add(m);
    return m;
  }

  const mx = (x, y, z, ry, s) =>
    new THREE.Matrix4().compose(_v.set(x, y, z), _q.setFromEuler(_e.set(0, ry, 0, 'YXZ')), _s.set(s, s, s));

  // Sky dome, Sun & Clouds
  const FOG = 0xd4ecf2;
  const SUN = new THREE.Vector3(0.5, 0.62, -0.4).normalize();
  const sg = new THREE.SphereGeometry(320, 16, 10), sp = sg.attributes.position, sc = [];
  const cH = new THREE.Color(FOG), cT = new THREE.Color(0x287ed6), cc = new THREE.Color();
  for (let i = 0; i < sp.count; i++) {
    cc.copy(cH).lerp(cT, Math.pow(clamp(sp.getY(i) / 320, 0, 1), 0.55));
    sc.push(cc.r, cc.g, cc.b);
  }
  sg.setAttribute('color', new THREE.Float32BufferAttribute(sc, 3));
  const sky = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.renderOrder = -2;
  sky.frustumCulled = false;
  scene.add(sky);

  [[16, 1, 295, -1], [42, 0.22, 296, -1.5]].forEach(([r, o, d, ro]) => {
    const s = new THREE.Mesh(new THREE.CircleGeometry(r, 20), new THREE.MeshBasicMaterial({ color: 0xfff6cf, fog: false, depthWrite: false, transparent: o < 1, opacity: o }));
    s.position.copy(SUN).multiplyScalar(d);
    s.lookAt(0, 0, 0);
    s.renderOrder = ro;
    sky.add(s);
  });

  const cloudGeo = (() => {
    const P = [], g = new THREE.IcosahedronGeometry(1, 0);
    [[0, 0, 0, 9], [8, -1, 2, 7], [-8, -1, -1, 7], [3, 2, -3, 6]].forEach(a =>
      P.push(part(g, 0xffffff, a[0], a[1], a[2], { s: [a[3] * 1.5, a[3] * 0.55, a[3]] }))
    );
    return merge(P);
  })();
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x777777, vertexColors: true });
  const clouds = [];
  for (let i = 0; i < 12; i++) {
    const c = new THREE.Mesh(cloudGeo, cloudMat);
    c.position.set(rr(-230, 230), rr(72, 98), rr(-230, 230));
    c.scale.setScalar(rr(0.8, 1.6));
    scene.add(c);
    clouds.push(c);
  }

  // Lush Tropical Ground
  {
    const g = new THREE.PlaneGeometry(900, 900, 80, 80);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, col = [], a = new THREE.Color(0x58ad47), b = new THREE.Color(0x3f8f3d), c = new THREE.Color(0x7bbf55), t = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      const n = Math.sin(x * 0.045) * Math.cos(z * 0.05) + Math.sin(x * 0.13 + z * 0.09) * 0.5 + (rand() - 0.5) * 0.5;
      t.copy(a).lerp(n > 0 ? c : b, Math.min(1, Math.abs(n) * 0.6));
      col.push(t.r, t.g, t.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    scene.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true })));
  }

  // Roads & Markings
  const strip = (w, l, x, z, y, color) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color }));
    m.position.set(x, y, z);
    scene.add(m);
  };
  strip(320, 16, 0, 0, 0.02, 0xb89d6b);     // Main road dirt shoulder
  strip(13, 150, 20, -75, 0.03, 0xb89d6b);  // Village lane dirt shoulder
  strip(320, 10, 0, 0, 0.05, 0x3a3d40);     // Main road asphalt
  strip(7, 150, 20, -75, 0.08, 0x3d4043);   // Village lane asphalt

  {
    const P = [], W = 0xffffff;
    P.push(box(320, 0.02, 0.16, W, 0, 0.115, 4.55));
    P.push(box(176, 0.02, 0.16, W, -72, 0.115, -4.55), box(136, 0.02, 0.16, W, 92, 0.115, -4.55));
    P.push(box(0.16, 0.02, 145, W, 16.8, 0.12, -77.5), box(0.16, 0.02, 145, W, 23.2, 0.12, -77.5));
    for (let x = -156; x <= 156; x += 5) if (Math.abs(x - 20) > 8) P.push(box(2.4, 0.02, 0.2, W, x, 0.125, 0));
    for (let z = -12; z >= -148; z -= 5) P.push(box(0.2, 0.02, 2.4, W, 20, 0.13, z));
    for (let i = 0; i < 9; i++) P.push(box(3.2, 0.02, 0.5, W, 10, 0.13, -3.6 + i * 0.9));
    scene.add(new THREE.Mesh(merge(P), worldMat));
  }

  // Sri Lankan Architecture Generators
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

  function shopGeo(wall, aw) {
    const P = [], gc = [0xf2c94c, 0xe67e22, 0x7bc043, 0xe84a5f, 0x5dade2];
    P.push(box(7, 3.6, 6, wall, 0, 1.8, 0), box(7.4, 0.25, 6.4, 0x77797a, 0, 3.7, 0), box(7.4, 1.1, 0.2, wall, 0, 4.3, 3.1));
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

  // Place Houses
  const wallC = [0xf2e6c9, 0xf4c27a, 0x9fd3c7, 0xf2a7b5, 0xbfd8f2, 0xe8d9a8];
  const roofC = [0xb5532f, 0xa04628, 0x8a8f94, 0xc0602f];
  const hGeos = wallC.map((w, i) => houseGeo(w, roofC[i % roofC.length]));
  const house = (x, z, ry) => placeObj(new THREE.Mesh(hGeos[(rand() * hGeos.length) | 0], worldMat), x + rr(-1.5, 1.5), z + rr(-1, 1), ry, 8.2, 6.2, 3.2, true);

  for (let x = -135; x <= -15; x += 24) house(x, -15, 0);
  for (let x = 50; x <= 140; x += 26) house(x, -15, 0);
  for (let x = -129; x <= -21; x += 24) house(x, 15, Math.PI);
  for (let x = 64; x <= 140; x += 25) house(x, 15, Math.PI);
  for (let z = -30; z >= -130; z -= 24) { house(30, z, -Math.PI / 2); house(10, z, Math.PI / 2); }

  // Town Bazaar Shops
  [
    [2, 'PERERA STORES', '#7a1f2b', '#ffe9a8', 0xf3e3b8, 0xd9382c],
    [12, 'LANKA TEA KADE', '#1d5c3a', '#fff3c4', 0xcfe8d5, 0x2e8b57],
    [30, 'RANI PHARMACY', '#1f4e79', '#ffffff', 0xdbe8f5, 0x2e6fb5],
    [40, 'SAMAN TEXTILES', '#8a4b08', '#ffe0a0', 0xf6d3a3, 0xe6a817]
  ].forEach(s => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(shopGeo(s[4], s[5]), worldMat));
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

  // Sacred Dagoba / Stupa
  const stupaGeo = merge([
    part(new THREE.CylinderGeometry(8, 8.4, 0.3, 16), 0xe9e3d3, 0, 0.15, 0),
    part(new THREE.CylinderGeometry(6, 6.3, 0.3, 16), 0xf4efe2, 0, 0.45, 0),
    part(new THREE.SphereGeometry(4.6, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0xfbfaf5, 0, 0.6, 0),
    box(1.8, 1.2, 1.8, 0xe6b422, 0, 5.8, 0),
    part(new THREE.ConeGeometry(0.95, 3.4, 8), 0xe6b422, 0, 8.1, 0),
    part(new THREE.IcosahedronGeometry(0.2, 0), 0xf5c518, 0, 10, 0)
  ]);
  placeObj(new THREE.Mesh(stupaGeo, worldMat), -55, -45, 0, 8.4, 8.4, 6, true);
  landmarks.push({ name: 'Sacred Stupa', x: -55, z: -34, color: '#ffffff' });

  // Bus Halt
  const busGeo = merge([
    box(4, 2.2, 0.15, 0xe8e2d0, 0, 1.2, -0.9), box(4.4, 0.15, 2.2, 0x2e5eaa, 0, 2.4, 0),
    box(0.15, 2.2, 1.6, 0xe8e2d0, -2, 1.2, 0), box(0.15, 2.2, 1.6, 0xe8e2d0, 2, 1.2, 0),
    box(3, 0.1, 0.5, 0x7a4d2c, 0, 0.5, -0.55), box(0.1, 0.5, 0.4, 0x444444, -1.2, 0.25, -0.55), box(0.1, 0.5, 0.4, 0x444444, 1.2, 0.25, -0.55)
  ]);
  placeObj(new THREE.Mesh(busGeo, worldMat), -34, -8.3, 0, 4.4, 2.2, 2.4, true);
  landmarks.push({ name: 'Town Bus Stand', x: -34, z: -5.5, color: '#38bdf8' });
  landmarks.push({ name: 'North Village Junction', x: 20, z: -115, color: '#a855f7' });
  landmarks.push({ name: 'East Highway', x: 115, z: 0, color: '#fb923c' });

  // Street Lamps
  const lampGeo = merge([box(0.12, 5, 0.12, 0x555555, 0, 2.5, 0), box(1.2, 0.08, 0.08, 0x555555, 0.55, 5, 0), box(0.4, 0.15, 0.28, 0xffe9a0, 1.1, 4.9, 0)]);
  const L = [];
  for (let x = -140; x <= 140; x += 28) {
    if (Math.abs(x - 20) < 9) continue;
    L.push(mx(x, 0, -5.9, -Math.PI / 2, 1)); addCol(x, -5.9, 0.3, 0.3, 5, false);
    L.push(mx(x + 14, 0, 5.9, Math.PI / 2, 1)); addCol(x + 14, 5.9, 0.3, 0.3, 5, false);
  }
  inst(lampGeo, L);

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
  const B = []; scatter(150, 1.6, (x, z) => B.push(mx(x, 0, z, rr(0, 6.28), rr(0.8, 1.7)))); inst(bushGeo, B, true);
  const BN = []; scatter(40, 2, (x, z) => BN.push(mx(x, 0, z, rr(0, 6.28), rr(0.9, 1.3)))); inst(bananaGeo, BN, true);

  return { cols, sky, clouds, landmarks };
}