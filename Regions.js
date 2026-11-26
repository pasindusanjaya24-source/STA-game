// regions.js — Colombo, Kandy, Galle Fort, Mirissa Beach, sea, extra roads, hills + minimap/area data.
// Everything static is MERGED into a few meshes (1 draw call per region) and registered in `regions`
// so main.js can hide far-away regions. No imports: helpers arrive through `api` (no circular imports).
export function buildRegions(api) {
  const { scene, THREE, merge, box, part, solidMat, rand, rr, PAL, addCol, landmarks, strip, shMat, rdMat,
    regions, exclude, areas, tickers, shapes, roads, trees, mx, signTex, makeSandTex, makeWaterTex } = api;

  const cyl = (rt, rb, h, seg, col, x, base, z, o) =>
    part(new THREE.CylinderGeometry(rt, rb, h, seg), col, x, base + h / 2, z, o);
  const addMerged = (P, cx, cz, r, cast = true) => {
    const m = new THREE.Mesh(merge(P), solidMat);
    m.castShadow = cast; m.receiveShadow = true;
    scene.add(m);
    regions.push({ obj: m, cx, cz, r });
    return m;
  };
  const rect = (arr, x0, z0, x1, z1, color) => arr.push({ x0, z0, x1, z1, color });
  const palm = (x, z, s = 1) => {
    trees.push({ x, z, m: mx(x, 0, z, rr(0, 6.28), s * rr(0.9, 1.25)) });
    addCol(x, z, 0.7, 0.7, 9, false);
  };

  /* ================= SEA + SAND ================= */
  const sandTexA = makeSandTex(); sandTexA.repeat.set(90, 6);
  const sandTexB = makeSandTex(); sandTexB.repeat.set(34, 6);
  const sandA = new THREE.MeshLambertMaterial({ map: sandTexA });
  const sandB = new THREE.MeshLambertMaterial({ map: sandTexB });
  const wetMat = new THREE.MeshLambertMaterial({ color: 0xc7b07a });
  strip(760, 45, 0, 277.5, 0.03, sandA);   // main beach z 255..300
  strip(280, 47, 200, 231.5, 0.03, sandB); // Mirissa beach park x 60..340, z 208..255
  strip(760, 6, 0, 297, 0.035, wetMat);    // wet sand at the waterline

  const waterTex = makeWaterTex();
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(2400, 700).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: waterTex }));
  sea.position.set(0, 0.06, 650);
  scene.add(sea);
  const foam = new THREE.Mesh(new THREE.PlaneGeometry(2400, 1.6).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false }));
  foam.position.set(0, 0.075, 299.6);
  scene.add(foam);
  tickers.push(dt => { waterTex.offset.x += dt * 0.004; waterTex.offset.y -= dt * 0.002; });
  exclude.push([-380, 195, 380, 335]);

  /* ================= EXTRA ROADS ================= */
  strip(13, 200, -16, 100, 0.03, shMat); strip(7, 200, -16, 100, 0.08, rdMat);   // Galle Road (connector)
  strip(760, 16, 0, 200, 0.02, shMat);   strip(760, 10, 0, 200, 0.05, rdMat);     // Coastal Road
  strip(13, 270, 270, 0, 0.03, shMat);   strip(7, 270, 270, 0, 0.08, rdMat);      // Colombo avenue
  strip(305, 16, 30, -262, 0.02, shMat); strip(305, 10, 30, -262, 0.05, rdMat);   // Kandy Road

  const M = [], W = 0xf8fafc;
  const mb = (w, d, x, z, y = 0.125) => M.push(box(w, 0.02, d, W, x, y, z));
  // coastal road
  for (let x = -376; x <= 376; x += 5) if (Math.abs(x + 16) > 8) mb(2.4, 0.2, x, 200);
  for (const z of [195.45, 204.55]) { mb(360.5, 0.18, -199.75, z, 0.115); mb(392.5, 0.18, 183.75, z, 0.115); }
  // galle road
  for (let z = 8; z <= 192; z += 5) mb(0.2, 2.4, -16, z, 0.13);
  mb(0.18, 190, -19.45, 100, 0.12); mb(0.18, 190, -12.55, 100, 0.12);
  // colombo avenue
  for (let z = -132; z <= 132; z += 5) if (Math.abs(z) > 8) mb(0.2, 2.4, 270, z, 0.13);
  for (const x of [266.55, 273.45]) { mb(0.18, 130, x, 70, 0.12); mb(0.18, 130, x, -70, 0.12); }
  // kandy road
  for (let x = -120; x <= 180; x += 5) if (Math.abs(x - 20) > 8) mb(2.4, 0.2, x, -262);
  mb(305, 0.18, 30.5, -266.55, 0.115);
  mb(138.5, 0.18, -52.75, -257.45, 0.115); mb(159.5, 0.18, 103.25, -257.45, 0.115);
  addMerged(M, 0, 0, 2000, false);

  // map (minimap) data
  rect(roads, -380, -5, 380, 5, '#475569');
  rect(roads, 16.5, -262, 23.5, 0, '#475569');
  rect(roads, -19.5, 0, -12.5, 200, '#475569');
  rect(roads, -380, 195, 380, 205, '#475569');
  rect(roads, 266.5, -135, 273.5, 135, '#475569');
  rect(roads, -122, -267, 183, -257, '#475569');
  rect(shapes, -380, 255, 380, 300, '#e9d8a6');
  rect(shapes, 60, 208, 340, 255, '#e9d8a6');
  rect(shapes, -380, 300, 380, 335, '#2a8fbd');

  /* ================= COLOMBO (east) ================= */
  {
    const pavMat = new THREE.MeshLambertMaterial({ color: 0xa7a49b });
    strip(165, 160, 282, 0, 0.025, pavMat);
    rect(shapes, 200, -80, 365, 80, '#9a9a98');
    exclude.push([195, -100, 365, 100]);
    areas.push({ name: 'Colombo City', x0: 195, z0: -100, x1: 365, z1: 100 });

    const P = [];
    const walls = [0xdfe3e6, 0xcfd8df, 0xe8e2d4, 0xc7d3dc];
    const glass = [0x3f6b8f, 0x2f5d7a, 0x4f7a99];
    let wi = 0;
    const tower = (x, z, w, d, h, wall, gl) => {
      wall = wall || walls[wi % walls.length]; gl = gl || glass[wi % glass.length]; wi++;
      P.push(box(w, h, d, wall, x, h / 2, z));
      for (let y = 4; y < h - 2; y += 3.4) P.push(box(w + 0.14, 1.7, d + 0.14, gl, x, y, z));
      P.push(box(w * 0.55, 2.2, d * 0.55, 0x7d868f, x, h + 1.1, z));
      P.push(box(0.4, 5, 0.4, 0x9aa3ac, x, h + 4.5, z));
      addCol(x, z, w, d, h, true);
    };
    // along the main road (north / south)
    [[212, -30, 16, 16, 26], [240, -32, 18, 18, 38], [298, -30, 18, 16, 32], [326, -34, 20, 20, 46], [350, -30, 16, 16, 24]]
      .forEach(a => tower(...a));
    [[212, 32, 16, 16, 30], [242, 30, 18, 16, 22], [298, 34, 18, 18, 40], [324, 32, 18, 18, 28], [352, 34, 16, 16, 34]]
      .forEach(a => tower(...a));
    // back row
    [[232, 82, 16, 16, 36], [302, 80, 20, 18, 30], [338, 74, 16, 16, 48]].forEach(a => tower(...a));

    // World Trade Center twin towers + podium
    P.push(box(48, 6, 22, 0xcfd5da, 236, 3, -72));
    addCol(236, -72, 48, 22, 6, true);
    tower(222, -72, 13, 13, 62, 0xd7dde2, 0x35607f);
    tower(250, -72, 13, 13, 62, 0xd7dde2, 0x35607f);
    P.push(box(14, 3, 3, 0x9aa3ac, 236, 50, -72)); // sky-bridge

    // Lotus Tower
    const lx = 302, lz = -82;
    P.push(box(14, 3, 14, 0xe9ecef, lx, 1.5, lz));
    addCol(lx, lz, 14, 14, 3, true);
    P.push(cyl(1.4, 2.4, 48, 12, 0xdfe3e8, lx, 3, lz));
    P.push(cyl(6.2, 6.2, 1.2, 14, 0xeaeef2, lx, 49, lz));
    P.push(part(new THREE.SphereGeometry(5.2, 12, 8), 0xe86fa0, lx, 55, lz));
    P.push(part(new THREE.SphereGeometry(3.4, 10, 8), 0xf7b6cf, lx, 59.5, lz));
    P.push(cyl(0.12, 0.5, 24, 6, 0xcfd5da, lx, 60, lz));
    addCol(lx, lz, 4, 4, 80, true);

    // Independence Memorial Hall
    const ix = 214, iz = 68;
    P.push(box(26, 1, 16, 0xe8e4d6, ix, 0.5, iz));
    P.push(box(20, 5, 10, 0xf6f2e6, ix, 3.5, iz));
    for (let i = 0; i < 10; i++) P.push(cyl(0.45, 0.45, 5, 8, 0xf8f6ee, ix - 10 + i * 2.2, 1, iz - 6));
    P.push(box(22, 0.9, 12.5, 0x9c4326, ix, 6.4, iz), box(15, 0.9, 8.5, 0xb9552e, ix, 7.3, iz), box(8, 0.9, 5, 0x9c4326, ix, 8.2, iz));
    addCol(ix, iz, 26, 16, 9, true);
    addMerged(P, 285, 0, 130);

    landmarks.push({ name: 'World Trade Center', x: 270, z: -62, color: '#94a3b8' });
    landmarks.push({ name: 'Lotus Tower', x: 270, z: -98, color: '#f472b6' });
    landmarks.push({ name: 'Independence Square', x: 214, z: 6, color: '#e2e8f0' });
  }

  /* ================= KANDY (north) ================= */
  {
    const plazaMat = new THREE.MeshLambertMaterial({ color: 0xbdb7a6 });
    const waterTex2 = makeWaterTex(); waterTex2.repeat.set(12, 8);
    tickers.push(dt => { waterTex2.offset.x += dt * 0.003; });
    const lakeMat = new THREE.MeshLambertMaterial({ map: waterTex2, color: 0xb8d8c8 });
    strip(54, 30, 80, -273, 0.035, plazaMat);
    strip(90, 40, -60, -300, 0.05, lakeMat);
    rect(shapes, 55, -288, 105, -258, '#b9b4a6');
    rect(shapes, -105, -320, -15, -280, '#4f8f8f');
    exclude.push([-130, -340, 190, -240]);
    areas.push({ name: 'Kandy Lake', x0: -105, z0: -322, x1: -15, z1: -278 });
    areas.push({ name: 'Temple of the Tooth', x0: 30, z0: -325, x1: 130, z1: -283 });
    areas.push({ name: 'Kandy City', x0: -130, z0: -340, x1: 190, z1: -240 });

    const P = [];
    // town shops
    let ci = 0;
    const shop = (x, z, face) => {
      const w = 9, d = 7, h = 4.5 + (ci % 3) * 1.2;
      const wall = PAL.walls[ci % PAL.walls.length], roof = PAL.roofs[ci % PAL.roofs.length];
      const awn = [0xd9382c, 0x2e8b57, 0x2e6fb5, 0xe6a817][ci % 4]; ci++;
      P.push(box(w, h, d, wall, x, h / 2, z), box(w + 0.6, 0.5, d + 0.6, roof, x, h + 0.25, z));
      const fz = z + face * (d / 2 + 0.05);
      P.push(box(1.3, 2.3, 0.12, 0x5b3a22, x - w * 0.2, 1.15, fz), box(1.6, 1.1, 0.12, 0x8fd6ea, x + w * 0.18, 2.0, fz));
      P.push(box(w + 0.4, 0.4, 1.2, awn, x, 3.0, z + face * (d / 2 + 0.6)));
      addCol(x, z, w, d, h, true);
    };
    [-122, 140, 156, 172].forEach(x => shop(x, -276, 1));
    for (let x = -118; x <= -13; x += 15) shop(x, -249, -1);
    for (let x = 36; x <= 171; x += 15) shop(x, -249, -1);

    // lake wall + island
    P.push(box(92, 1, 0.7, 0xf1ede0, -60, 0.5, -277.5), box(0.7, 1, 42, 0xf1ede0, -105.5, 0.5, -299), box(0.7, 1, 42, 0xf1ede0, -14.5, 0.5, -299));
    addCol(-60, -277.5, 92, 0.8, 1, false);
    P.push(cyl(6, 7, 0.9, 12, 0x6b8f4a, -60, 0.05, -300));
    palm(-62, -300, 1.1); palm(-57, -302, 0.9); palm(-60, -297, 1.0);
    [[-100, -283], [-20, -283], [-100, -317], [-20, -317]].forEach(a => palm(a[0], a[1]));

    // Temple of the Tooth (Sri Dalada Maligawa)
    const tx = 80, tz = -302;
    P.push(box(52, 1.2, 32, 0xe3dccb, tx, 0.6, tz));
    P.push(box(36, 6, 20, 0xf6f1e4, tx, 4.2, tz));
    P.push(box(38, 1.2, 22, 0xa0452a, tx, 7.8, tz), box(32, 1.0, 16, 0xb9552e, tx, 8.9, tz), box(26, 1.4, 11, 0xa0452a, tx, 10, tz));
    for (let i = 0; i < 8; i++) P.push(cyl(0.35, 0.35, 6, 6, 0xf8f4ea, 66 + i * 3.4, 1.2, tz + 11));
    const ox = 96, oz = -290; // octagonal Pattirippuwa
    P.push(cyl(5.2, 5.6, 9, 8, 0xf6f1e4, ox, 1.2, oz));
    P.push(cyl(0, 7.2, 5, 8, 0xe6b422, ox, 10.2, oz), cyl(0, 4.6, 3.5, 8, 0xf0c43a, ox, 14.4, oz), cyl(0.1, 0.25, 3, 6, 0xe6b422, ox, 17.8, oz));
    P.push(box(18, 1.8, 0.8, 0xf4efe2, 63, 0.9, -285), box(18, 1.8, 0.8, 0xf4efe2, 97, 0.9, -285));
    P.push(box(0.8, 1.8, 34, 0xf4efe2, 54, 0.9, tz), box(0.8, 1.8, 34, 0xf4efe2, 106, 0.9, tz), box(52, 1.8, 0.8, 0xf4efe2, tx, 0.9, -318.5));
    addCol(tx, tz, 52, 34, 9, true);
    addMerged(P, 30, -290, 150);

    landmarks.push({ name: 'Temple of the Tooth', x: 80, z: -264, color: '#fbbf24' });
    landmarks.push({ name: 'Kandy Lake', x: -60, z: -264, color: '#2dd4bf' });
  }

  /* ================= GALLE FORT (south-west coast) ================= */
  {
    const cobbleMat = new THREE.MeshLambertMaterial({ color: 0x9d9486 });
    strip(95, 50, -252.5, 237, 0.04, cobbleMat);
    rect(shapes, -300, 212, -205, 262, '#cbbd9e');
    exclude.push([-310, 205, -195, 270]);
    areas.push({ name: 'Galle Fort', x0: -305, z0: 205, x1: -200, z1: 268 });

    const P = [], stone = 0xcbbd9e, cap = 0xb7a888;
    P.push(box(95, 6, 4, stone, -252.5, 3, 260), box(4, 6, 50, stone, -205, 3, 237), box(4, 6, 50, stone, -300, 3, 237));
    P.push(box(44, 6, 4, stone, -278, 3, 213), box(43, 6, 4, stone, -226.5, 3, 213), box(8.8, 2, 4.4, cap, -252, 7, 213));
    P.push(box(95.4, 0.5, 4.6, cap, -252.5, 6.25, 260), box(4.6, 0.5, 50.4, cap, -205, 6.25, 237), box(4.6, 0.5, 50.4, cap, -300, 6.25, 237));
    for (const [bx, bz] of [[-205, 260], [-300, 260], [-205, 213], [-300, 213]]) P.push(cyl(4.6, 5.2, 8, 9, stone, bx, 0, bz));
    addCol(-252.5, 260, 95, 4, 6, true); addCol(-205, 237, 4, 50, 6, true); addCol(-300, 237, 4, 50, 6, true);
    addCol(-278, 213, 44, 4, 6, true); addCol(-226.5, 213, 43, 4, 6, true);

    // lighthouse
    const lx = -211, lz = 255;
    P.push(cyl(1.6, 2.7, 24, 12, 0xf4f2ec, lx, 0, lz), cyl(2.6, 2.6, 0.4, 12, 0x2b2b2b, lx, 24, lz), cyl(1.5, 1.5, 2.4, 10, 0xcfe8ef, lx, 24.4, lz));
    P.push(cyl(0, 2.0, 2.2, 10, 0x8d153a, lx, 26.8, lz), cyl(0.05, 0.12, 1.5, 5, 0x333333, lx, 29, lz));
    addCol(lx, lz, 5.4, 5.4, 30, true);

    // clock tower
    const cx = -252, cz = 228;
    P.push(box(5, 15, 5, 0xf6f2e8, cx, 7.5, cz), cyl(0, 4, 4, 4, 0xb9552e, cx, 15, cz, { ry: Math.PI / 4 }));
    for (const s of [-1, 1]) {
      P.push(box(3.1, 3.1, 0.1, 0x333333, cx, 11.5, cz + s * 2.52), box(2.8, 2.8, 0.15, 0xf6f6f2, cx, 11.5, cz + s * 2.58));
      P.push(box(0.1, 3.1, 3.1, 0x333333, cx + s * 2.52, 11.5, cz), box(0.15, 2.8, 2.8, 0xf6f6f2, cx + s * 2.58, 11.5, cz));
    }
    addCol(cx, cz, 5.4, 5.4, 16, true);

    // Dutch houses along the main street
    const walls = [0xf4ead3, 0xf2dc9b, 0xcfe0ea, 0xf0c8b0];
    let k = 0;
    const dutch = (x, z, dir) => {
      const wall = walls[k++ % walls.length];
      P.push(box(11, 5.2, 13, wall, x, 2.6, z), box(12, 0.9, 14, 0xb9552e, x, 5.65, z), box(9, 0.6, 11, 0xa04628, x, 6.4, z));
      const fx = x + dir * 5.55;
      P.push(box(0.12, 2.4, 1.5, 0x5b3a22, fx, 1.2, z), box(0.12, 1.1, 1.6, 0x8fd6ea, fx, 2.7, z - 4), box(0.12, 1.1, 1.6, 0x8fd6ea, fx, 2.7, z + 4));
      for (const dz of [-5.6, -1.9, 1.9, 5.6]) P.push(box(0.3, 3.6, 0.3, 0xf6f2e8, x + dir * 7.3, 1.8, z + dz));
      P.push(box(3.6, 0.4, 14, 0xb9552e, x + dir * 7.0, 3.7, z));
      addCol(x, z, 11, 13, 7, true);
    };
    for (const z of [228, 246]) { dutch(-275, z, 1); dutch(-229, z, -1); }
    addMerged(P, -252, 237, 90);

    // signs
    const gate = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.2), new THREE.MeshBasicMaterial({ map: signTex('GALLE FORT', '#3a2a1a', '#f6e7c0') }));
    gate.position.set(-252, 8.9, 210.7); gate.rotation.y = Math.PI; scene.add(gate);
    landmarks.push({ name: 'Galle Fort', x: -252, z: 200, color: '#e7d7a8' });
  }

  /* ================= MIRISSA BEACH ================= */
  {
    areas.push({ name: 'Mirissa Beach', x0: 60, z0: 208, x1: 345, z1: 300 });
    areas.push({ name: 'Coastal Road', x0: -380, z0: 192, x1: 380, z1: 208 });
    areas.push({ name: 'Galle Beach', x0: -380, z0: 255, x1: 380, z1: 330 });
    const P = [];
    // palms
    for (let x = 66; x < 340; x += rr(11, 18)) palm(x, 250 + rr(-4, 4));
    for (let x = -195; x < 56; x += rr(11, 18)) palm(x, 258 + rr(-3, 3));
    for (let x = -345; x < -312; x += rr(11, 18)) palm(x, 262 + rr(-3, 3));
    // beach huts
    const hut = [0xe85d4a, 0x2f9ec7, 0xf2b632, 0x5cb85c];
    for (let i = 0; i < 8; i++) {
      const x = 92 + i * 28, z = 238;
      P.push(box(4, 2.4, 4, hut[i % 4], x, 1.2, z), cyl(0, 3.4, 1.8, 6, 0xc9a24a, x, 2.4, z), box(1, 1.8, 0.1, 0x5b3a22, x, 0.9, z - 2.05));
      addCol(x, z, 4.2, 4.2, 3, true);
    }
    // umbrellas + sunbeds
    const umb = [0xe85d4a, 0xf2b632, 0x2f9ec7, 0xffffff, 0x5cb85c];
    for (let i = 0; i < 16; i++) {
      const x = 75 + i * 16.5, z = 266 + (i % 2) * 7;
      P.push(cyl(0.05, 0.05, 2.6, 5, 0xdddddd, x, 0, z), cyl(0, 1.7, 0.7, 8, umb[i % 5], x, 2.5, z), box(0.9, 0.35, 1.9, 0xffffff, x + 1.3, 0.2, z));
    }
    // traditional outrigger fishing boats (oruwa)
    const boat = (x, z, col) => {
      P.push(box(7, 0.8, 1.7, col, x, 0.55, z), box(1.4, 1.6, 1.2, col, x + 3.8, 1.0, z), box(1, 1.2, 1.5, col, x - 3.6, 0.9, z));
      P.push(box(7.1, 0.2, 1.75, 0xffffff, x, 0.85, z), cyl(0.08, 0.08, 4.2, 5, 0x6b4a2b, x, 0.9, z));
      P.push(cyl(0.18, 0.18, 6, 6, 0xf5f5f5, x, 0.2, z + 2.6, { rz: Math.PI / 2 }));
      P.push(box(0.15, 0.12, 2.6, 0x6b4a2b, x - 2, 0.5, z + 1.3), box(0.15, 0.12, 2.6, 0x6b4a2b, x + 2, 0.5, z + 1.3));
      addCol(x, z, 7.4, 2, 1.2, false);
    };
    [[100, 288, 0xe85d4a], [152, 290, 0x2f9ec7], [205, 287, 0xf2b632], [258, 290, 0x5cb85c], [310, 288, 0xe85d4a], [-180, 288, 0x2f9ec7], [-120, 290, 0xf2b632]]
      .forEach(a => boat(...a));
    // sign posts
    P.push(box(0.3, 5.6, 0.3, 0x5b3a22, 135, 2.8, 212), box(0.3, 5.6, 0.3, 0x5b3a22, 145, 2.8, 212));
    addMerged(P, 200, 260, 200);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.7), new THREE.MeshBasicMaterial({ map: signTex('MIRISSA BEACH', '#0f5f7a', '#ffffff') }));
    sign.position.set(140, 4.7, 211.8); sign.rotation.y = Math.PI; scene.add(sign);
    landmarks.push({ name: 'Mirissa Beach', x: 200, z: 198, color: '#38bdf8' });
  }

  /* ================= HILL BACKDROP (outside the playable area) ================= */
  {
    const H = [], hc = [0x3f7d3f, 0x356f38, 0x4a8a45, 0x2f6a3a];
    const hemi = new THREE.SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2);
    const hill = (x, z, r, hh) => {
      const c = hc[(rand() * 4) | 0];
      H.push(part(hemi, c, x, 0, z, { s: [r, hh, r] }), part(hemi, 0x5a9a4c, x, 0, z, { s: [r * 0.6, hh * 1.06, r * 0.6] }));
    };
    for (let x = -450; x <= 450; x += 50) hill(x + rr(-10, 10), -400 - rr(0, 40), rr(55, 85), rr(28, 60));
    for (let z = -330; z <= 230; z += 55) { hill(450 + rr(0, 30), z + rr(-10, 10), rr(55, 85), rr(25, 50)); hill(-450 - rr(0, 30), z + rr(-10, 10), rr(55, 85), rr(25, 50)); }
    addMerged(H, 0, 0, 3000, false);
  }
}
