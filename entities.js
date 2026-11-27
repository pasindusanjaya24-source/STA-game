// entities.js — Player, optimized Sri Lankan vehicles (merged meshes), traffic & pedestrians
import { merge, box, solidMat, BOUNDS } from './world.js';
import { buildHuman, animateHuman, randomOutfit, PLAYER_OUTFIT } from './Characters.js';
export { animateHuman };
const THREE = window.THREE;

export function createPlayer(scene) {
  const h = buildHuman(PLAYER_OUTFIT, true);
  const g = h.g;

  // pistol lives in the gun hand (forearm of the +x arm) so it follows the arm pose
  const pistol = new THREE.Group();
  const gunMat = new THREE.MeshLambertMaterial({ color: 0x272a30 });
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.1, 0.4), gunMat);
  barrel.position.set(0, 0.02, 0.1);
  pistol.add(barrel);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.22, 0.12), gunMat);
  grip.position.set(0, -0.1, -0.02);
  pistol.add(grip);
  pistol.position.set(0, -0.3, 0.02);
  pistol.rotation.x = Math.PI / 2;
  pistol.visible = false;
  h.elbows[1].add(pistol);

  g.scale.setScalar(0.9);
  scene.add(g);

  const blob = new THREE.Mesh(
    new THREE.CircleGeometry(0.55, 12).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.22, depthWrite: false })
  );
  blob.position.y = 0.14;
  scene.add(blob);

  return {
    g, legs: h.legs, arms: h.arms, pistol, blob, h,
    animate: (t, speed, ground, armed, aiming) => animateHuman(h, t, speed, ground, { armed, aiming })
  };
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

  // Pedestrians: rigged low-poly humans with Sri Lankan outfits (sarong, saree, school uniform, office, tuk driver...)
  const addPed = (x, z, minX, maxX, beach) => {
    const o = randomOutfit(beach);
    const h = buildHuman(o, false);
    h.g.scale.setScalar(0.9 * (o.scale || 1));
    h.g.position.set(x, 0, z);
    scene.add(h.g);
    const dir = Math.random() < 0.5 ? 1 : -1;
    pedestrians.push({
      g: h.g, h, legs: h.legs, dir, phase: Math.random() * 6.28, minX, maxX,
      speed: 0.9 + Math.random() * 0.7, wait: Math.random() * 6, yaw: dir > 0 ? Math.PI / 2 : -Math.PI / 2
    });
  };
  for (let i = 0; i < 20; i++) addPed(-340 + i * 34, i % 2 ? 7.6 : -7.6, BOUNDS.x0 + 14, BOUNDS.x1 - 14);   // main road
  for (let i = 0; i < 6; i++) addPed(190 + i * 28, i % 2 ? 7.6 : -7.6, 190, BOUNDS.x1 - 14);              // Colombo
  for (let i = 0; i < 7; i++) addPed(-110 + i * 40, i % 2 ? -254.4 : -269.6, -125, 185);                 // Kandy road
  for (let i = 0; i < 6; i++) addPed(-320 + i * 120, i % 2 ? 207.6 : 192.4, BOUNDS.x0 + 14, BOUNDS.x1 - 14); // coastal road
  for (let i = 0; i < 8; i++) addPed(80 + i * 30, 268 + (i % 3) * 8, 66, 336, true);                        // Mirissa beach

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
