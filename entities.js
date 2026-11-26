// entities.js — Player, optimized Sri Lankan vehicles (merged meshes), traffic & pedestrians
import { merge, box, part, solidMat, BOUNDS } from './world.js';
const THREE = window.THREE;

export function createPlayer(scene) {
  const g = new THREE.Group(), skin = 0xb07a52;
  const add = (par, geo, c, x, y, z) => {
    const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: c }));
    m.position.set(x, y, z);
    par.add(m);
    return m;
  };
  const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);

  const legs = [-1, 1].map(s => {
    const p = new THREE.Group();
    p.position.set(s * 0.16, 0.9, 0);
    g.add(p);
    add(p, B(0.28, 0.5, 0.3), 0x2b3a67, 0, -0.25, 0);
    add(p, B(0.22, 0.3, 0.26), skin, 0, -0.65, 0);
    add(p, B(0.26, 0.1, 0.38), 0x222222, 0, -0.85, 0.05);
    return p;
  });

  const arms = [-1, 1].map(s => {
    const p = new THREE.Group();
    p.position.set(s * 0.41, 1.55, 0);
    g.add(p);
    add(p, B(0.2, 0.32, 0.24), 0xf2f2f2, 0, -0.16, 0);
    add(p, B(0.17, 0.4, 0.2), skin, 0, -0.52, 0);
    return p;
  });

  add(g, B(0.62, 0.72, 0.34), 0xf2f2f2, 0, 1.26, 0);
  add(g, new THREE.SphereGeometry(0.23, 8, 6), skin, 0, 1.86, 0);
  add(g, new THREE.SphereGeometry(0.25, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), 0x1a1a1a, 0, 1.9, -0.02);
  add(g, B(0.05, 0.05, 0.04), 0x111111, -0.08, 1.88, 0.22);
  add(g, B(0.05, 0.05, 0.04), 0x111111, 0.08, 1.88, 0.22);

  const pistol = new THREE.Group();
  const gunMat = new THREE.MeshLambertMaterial({ color: 0x272a30 });
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.11, 0.48), gunMat);
  barrel.position.set(0, 0, 0.12);
  pistol.add(barrel);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.26, 0.14), gunMat);
  grip.position.set(0, -0.15, -0.02);
  pistol.add(grip);
  pistol.position.set(0.42, 1.38, 0.24);
  pistol.visible = false;
  g.add(pistol);

  g.scale.setScalar(0.9);
  scene.add(g);

  const blob = new THREE.Mesh(
    new THREE.CircleGeometry(0.55, 12).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.22, depthWrite: false })
  );
  blob.position.y = 0.14;
  scene.add(blob);

  return { g, legs, arms, pistol, blob };
}

const WHEEL_MAT = new THREE.MeshLambertMaterial({ color: 0x202428 });
const wheelGeos = {};
const wheelGeo = r => wheelGeos[r] || (wheelGeos[r] = new THREE.CylinderGeometry(r, r, 0.2, 10).rotateZ(Math.PI / 2));

// Vehicle body = ONE merged mesh (vertex colours) + shared-geometry wheels => ~5 draw calls per vehicle
export function makeVehicle(scene, type, color) {
  const root = new THREE.Group();
  const P = [];
  const ab = (w, h, d, col, x, y, z) => P.push(box(w, h, d, col, x, y, z));
  const DARK = 0x202428, GLASS = 0x90d0e0, LIGHT = 0xfff3b0;

  if (type === 'tuk') {
    // Classic Sri Lankan Three-Wheeler (Bajaj RE style)
    ab(1.38, 0.72, 1.65, color, 0, 0.72, -0.15);
    ab(1.02, 0.62, 0.85, color, 0, 0.68, 0.62);
    ab(1.16, 0.65, 0.06, GLASS, 0, 1.32, 0.56);
    ab(1.42, 0.12, 1.85, DARK, 0, 1.8, -0.15); // canopy hood
    for (const sx of [-0.65, 0.65]) {
      ab(0.07, 0.85, 0.07, color, sx, 1.38, 0.52);
      ab(0.07, 0.85, 0.07, color, sx, 1.38, -0.92);
    }
    ab(0.28, 0.2, 0.1, LIGHT, 0, 0.85, 1.06);
  } else if (type === 'bus') {
    // Iconic Sri Lankan CTB / private route bus
    ab(2.3, 2.05, 5.8, color, 0, 1.25, 0);
    ab(2.34, 0.28, 5.84, 0xf5c518, 0, 1.05, 0);
    ab(2.15, 0.85, 0.08, GLASS, 0, 1.75, 2.88);
    ab(2.35, 0.18, 5.9, 0xeeeee8, 0, 2.34, 0); // cream roof
    for (const sx of [-0.8, 0.8]) ab(0.32, 0.2, 0.1, LIGHT, sx, 0.65, 2.92);
    for (const side of [-1, 1]) for (let j = 0; j < 4; j++) ab(0.04, 0.65, 0.78, GLASS, side * 1.16, 1.75, -1.85 + j * 1.18);
  } else {
    ab(1.88, 0.58, 3.6, color, 0, 0.62, 0);
    ab(1.58, 0.62, 1.7, GLASS, 0, 1.18, -0.22);
    ab(1.62, 0.12, 1.45, color, 0, 1.5, -0.25);
    for (const sx of [-0.65, 0.65]) ab(0.3, 0.16, 0.1, LIGHT, sx, 0.68, 1.81);
  }
  root.add(new THREE.Mesh(merge(P), solidMat));

  const wheelRadius = type === 'tuk' ? 0.28 : (type === 'bus' ? 0.44 : 0.35);
  const geo = wheelGeo(wheelRadius);
  const wheels = [];
  const addWheel = (x, y, z) => { const w = new THREE.Mesh(geo, WHEEL_MAT); w.position.set(x, y, z); root.add(w); wheels.push(w); };
  if (type === 'tuk') {
    addWheel(0, 0.3, 0.92);
    for (const x of [-0.74, 0.74]) addWheel(x, 0.3, -0.68);
  } else {
    const wx = type === 'bus' ? 1.14 : 0.92, wz = type === 'bus' ? 2.05 : 1.18;
    for (const x of [-wx, wx]) for (const z of [-wz, wz]) addWheel(x, wheelRadius, z);
  }

  scene.add(root);
  return {
    root, type, speed: 0, yaw: Math.PI / 2, wheels, color,
    radius: type === 'bus' ? 2.6 : (type === 'car' ? 1.7 : 1.15)
  };
}

export function spawnWorldEntities(scene) {
  const vehicles = [];
  const traffic = [];
  const pedestrians = [];
  const targets = [];

  const addDriveable = (type, x, z, color, yaw = Math.PI / 2) => {
    const v = makeVehicle(scene, type, color);
    v.root.position.set(x, 0, z);
    v.yaw = yaw;
    v.root.rotation.y = yaw;
    vehicles.push(v);
    return v;
  };

  // Driveable fleet parked around the island
  addDriveable('tuk', -4, 5.8, 0xf6b800);       // Classic yellow tuk (start)
  addDriveable('tuk', 26, -6.4, 0xd0342c);      // Red tuk
  addDriveable('tuk', 20, -24, 0x139a5b, 0);  // Green tuk on Village Lane
  addDriveable('car', -92, 5.9, 0x2a6fb5);      // Blue sedan
  addDriveable('bus', -34, 5.8, 0xb91c1c);      // Red CTB bus
  addDriveable('tuk', 235, 5.8, 0xf6b800);      // Colombo
  addDriveable('bus', 238, -6.2, 0xb91c1c);     // Colombo bus
  addDriveable('tuk', -60, -267.5, 0xd0342c);   // Kandy
  addDriveable('tuk', -230, 205.5, 0x139a5b);   // Galle
  addDriveable('car', 160, 205.5, 0x2a6fb5);    // Mirissa

  // Pedestrians (body = 1 merged mesh, legs share geometry)
  const shirtColors = [0xe3b23c, 0x3f83c7, 0xc9553f, 0x4f9d69, 0xd9649a, 0x8b78d6];
  const skinGeo = new THREE.SphereGeometry(0.19, 7, 6);
  const legGeo = new THREE.BoxGeometry(0.17, 0.58, 0.18);
  const pantsMat = new THREE.MeshLambertMaterial({ color: 0x303d55 });
  for (let i = 0; i < 20; i++) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(merge([
      box(0.48, 0.72, 0.28, shirtColors[i % shirtColors.length], 0, 1.18, 0),
      part(skinGeo, 0x9b6847, 0, 1.72, 0)
    ]), solidMat));
    const legs = [];
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(legGeo, pantsMat);
      leg.position.set(side * 0.13, 0.48, 0);
      g.add(leg);
      legs.push(leg);
    }
    const x = -340 + i * 34;
    const z = i % 2 ? 7.6 : -7.6;
    g.position.set(x, 0, z);
    scene.add(g);
    pedestrians.push({ g, dir: i % 2 ? 1 : -1, phase: Math.random() * 6.28, legs, minX: BOUNDS.x0 + 14, maxX: BOUNDS.x1 - 14 });
  }

  // AI traffic (main road + coastal road)
  const makeTraffic = (type, x, z, dir, color) => {
    const v = makeVehicle(scene, type, color);
    v.root.position.set(x, 0, z);
    v.yaw = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    v.root.rotation.y = v.yaw;
    v.dir = dir;
    v.cruise = type === 'bus' ? 4.2 : (type === 'tuk' ? 5.2 : 6.4);
    traffic.push(v);
  };
  for (let i = 0; i < 9; i++) {
    makeTraffic(i % 3 === 0 ? 'tuk' : 'car', -330 + i * 72, -2.35, 1, [0xd0342c, 0x2a6fb5, 0xe6e6e6, 0x3c9a55][i % 4]);
    makeTraffic(i % 3 === 1 ? 'bus' : 'car', 330 - i * 72, 2.35, -1, [0xb91c1c, 0xd9d9d9, 0xe0b52b][i % 3]);
  }
  for (let i = 0; i < 3; i++) {
    makeTraffic(i === 1 ? 'bus' : 'tuk', -250 + i * 180, 197.65, 1, [0xf6b800, 0xb91c1c, 0x139a5b][i]);
    makeTraffic(i === 0 ? 'bus' : 'car', 250 - i * 180, 202.35, -1, [0xb91c1c, 0xe6e6e6, 0x2a6fb5][i]);
  }

  // Practice Range Targets (respawnable)
  const targetMat = new THREE.MeshLambertMaterial({ color: 0xd74a3a });
  for (let i = 0; i < 5; i++) {
    const g = new THREE.Group();
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.4, 0.12), new THREE.MeshLambertMaterial({ color: 0x65452c }));
    post.position.y = 0.7; g.add(post);
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.95, 0.14), targetMat.clone());
    board.position.y = 1.4; g.add(board);
    g.position.set(82 + i * 4.5, 0, -45);
    scene.add(g);
    targets.push({ g, board, hp: 3, active: true, respawnTimer: 0 });
  }

  return { vehicles, traffic, pedestrians, targets };
}