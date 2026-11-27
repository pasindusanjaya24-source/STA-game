// entities.js — Player, optimized Sri Lankan vehicles (merged meshes), traffic & pedestrians
import { merge, box, part, solidMat, BOUNDS } from './world.js';
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

const shade = (hex, f) => new THREE.Color(hex).multiplyScalar(f).getHex();
const RAD = Math.PI / 2;

// Wheel = tyre + rim + 6 spokes (so the spin is visible). One shared geometry per size.
const wheelGeos = {};
function wheelGeo(r, w) {
  const k = r + '_' + w;
  if (!wheelGeos[k]) {
    const P = [
      part(new THREE.CylinderGeometry(r, r, w, 14), 0x1b1d20, 0, 0, 0, { rz: RAD }),
      part(new THREE.CylinderGeometry(r * 0.64, r * 0.64, w + 0.02, 10), 0xc5ccd3, 0, 0, 0, { rz: RAD }),
      part(new THREE.CylinderGeometry(r * 0.2, r * 0.2, w + 0.05, 6), 0x6b7280, 0, 0, 0, { rz: RAD })
    ];
    for (let i = 0; i < 3; i++) P.push(box(w + 0.035, r * 0.11, r * 1.15, 0x7b8490, 0, 0, 0, { rx: i * Math.PI / 3 }));
    wheelGeos[k] = merge(P);
  }
  return wheelGeos[k];
}

// Vehicle body = ONE merged mesh (vertex colours) + 4 shared-geometry wheels  => 5 draw calls per vehicle.
// types: 'car' | 'police' | 'tuk' | 'bus'
export function makeVehicle(scene, type, color) {
  const root = new THREE.Group();
  const body = new THREE.Group();            // leans/pitches while driving
  root.add(body);
  const P = [];
  const ab = (w, h, d, col, x, y, z, o) => P.push(box(w, h, d, col, x, y, z, o || {}));
  const cy = (rt, rb, h, seg, col, x, y, z, o) => P.push(part(new THREE.CylinderGeometry(rt, rb, h, seg), col, x, y, z, o || {}));
  const DARK = 0x202428, GLASS = 0x8ccbe0, LIGHT = 0xfff3b0, TAIL = 0xd7263d, CHROME = 0xbfc5cb, BLACK = 0x15171a;
  const trim = shade(color, 0.7);
  let wheelDefs = [], siren = null;

  const sedan = () => {
    ab(1.86, 0.46, 3.9, color, 0, 0.56, 0);                         // lower body
    ab(1.88, 0.05, 3.9, trim, 0, 0.8, 0);                            // beltline
    ab(1.8, 0.1, 1.15, color, 0, 0.85, 1.3, { rx: 0.09 });           // hood
    ab(1.8, 0.1, 0.9, color, 0, 0.85, -1.45, { rx: -0.05 });         // boot lid
    ab(1.62, 0.44, 1.6, GLASS, 0, 1.1, -0.3);                        // side glass band
    ab(1.56, 0.5, 0.06, GLASS, 0, 1.12, 0.62, { rx: -0.55 });        // windscreen
    ab(1.56, 0.46, 0.06, GLASS, 0, 1.1, -1.2, { rx: 0.6 });          // rear screen
    ab(1.58, 0.07, 1.75, color, 0, 1.36, -0.25);                     // roof
    for (const sx of [-0.8, 0.8]) {                                  // pillars
      ab(0.07, 0.5, 0.07, color, sx, 1.12, 0.62, { rx: -0.55 });
      ab(0.08, 0.44, 0.09, color, sx * 1.01, 1.1, -0.3);
      ab(0.1, 0.46, 0.12, color, sx, 1.1, -1.2, { rx: 0.6 });
    }
    ab(1.9, 0.2, 0.2, 0x2b2f33, 0, 0.36, 1.97); ab(1.9, 0.2, 0.2, 0x2b2f33, 0, 0.36, -1.97);   // bumpers
    ab(0.9, 0.14, 0.05, CHROME, 0, 0.62, 1.96);                                               // grille
    for (const sx of [-1, 1]) {
      ab(0.34, 0.15, 0.1, LIGHT, sx * 0.66, 0.68, 1.95);                                     // headlights
      ab(0.38, 0.14, 0.08, TAIL, sx * 0.64, 0.7, -1.95);                                     // tail lights
      ab(0.2, 0.1, 0.12, color, sx * 1.0, 0.98, 0.45);                                       // mirrors
      ab(0.02, 0.44, 0.025, BLACK, sx * 0.935, 0.56, 0.45); ab(0.02, 0.44, 0.025, BLACK, sx * 0.935, 0.56, -0.5);
      ab(0.03, 0.03, 0.14, CHROME, sx * 0.94, 0.72, 0.1); ab(0.03, 0.03, 0.14, CHROME, sx * 0.94, 0.72, -0.8);
      for (const wz of [1.28, -1.28]) cy(0.43, 0.43, 0.05, 12, BLACK, sx * 0.935, 0.36, wz, { rz: RAD }); // wheel arches
    }
    ab(0.5, 0.13, 0.03, 0xf2f2f2, 0, 0.44, 2.0); ab(0.5, 0.13, 0.03, 0xf2f2f2, 0, 0.44, -2.0);  // plates
    wheelDefs = [[-0.93, 0.36, 1.28, 0.36, 0.24, 1], [0.93, 0.36, 1.28, 0.36, 0.24, 1], [-0.93, 0.36, -1.28, 0.36, 0.24, 0], [0.93, 0.36, -1.28, 0.36, 0.24, 0]];
  };

  if (type === 'car' || type === 'police') {
    sedan();
    if (type === 'police') {
      ab(1.88, 0.12, 3.92, 0x1d4ed8, 0, 0.6, 0);                         // blue stripe
      ab(0.96, 0.08, 0.32, 0x1a1a1a, 0, 1.43, -0.3);                      // light-bar base
      ab(0.4, 0.14, 0.05, 0x1d4ed8, 0, 0.86, 1.62, { rx: 0.09 });         // hood badge
    }
  } else if (type === 'tuk') {
    // Bajaj-style three-wheeler
    ab(1.2, 0.12, 2.1, 0x2a2a2a, 0, 0.3, 0);                                // chassis
    ab(1.38, 0.62, 1.5, color, 0, 0.7, -0.3);                               // rear body
    ab(1.39, 0.08, 1.51, trim, 0, 0.99, -0.3);                              // trim stripe
    ab(0.96, 0.6, 0.8, color, 0, 0.72, 0.62);                               // front cowl
    cy(0.48, 0.48, 0.62, 10, color, 0, 0.74, 0.98);                         // rounded nose
    ab(0.26, 0.06, 0.55, color, 0, 0.6, 1.2);                               // front mudguard
    cy(0.13, 0.13, 0.1, 10, LIGHT, 0, 0.95, 1.25, { rx: RAD });             // round headlight
    ab(0.98, 0.55, 0.05, GLASS, 0, 1.3, 0.45, { rx: -0.25 });               // windscreen
    ab(0.7, 0.04, 0.04, 0x2a2a2a, 0, 1.03, 0.8);                            // handlebar
    for (const sx of [-1, 1]) {
      cy(0.03, 0.03, 0.12, 6, 0x111111, sx * 0.38, 1.03, 0.8, { rz: RAD });
      ab(0.1, 0.07, 0.02, CHROME, sx * 0.42, 1.14, 0.8);                    // mirrors
      ab(0.04, 0.2, 1.5, trim, sx * 0.68, 1.1, -0.3);                       // side rails
      ab(0.06, 0.9, 0.06, color, sx * 0.66, 1.35, 0.5); ab(0.06, 0.9, 0.06, color, sx * 0.66, 1.35, -1.0);
      ab(0.12, 0.1, 0.04, TAIL, sx * 0.5, 0.82, -1.07);                     // tail lights
    }
    ab(0.8, 0.1, 0.5, 0x3a2a1e, 0, 0.88, 0.2); ab(0.8, 0.4, 0.08, 0x3a2a1e, 0, 1.08, -0.05);        // driver seat
    ab(1.2, 0.1, 0.55, 0x3a2a1e, 0, 0.9, -0.7); ab(1.2, 0.45, 0.08, 0x3a2a1e, 0, 1.12, -1.0);       // passenger bench
    ab(1.44, 0.1, 1.9, DARK, 0, 1.82, -0.25);                               // canopy
    ab(1.2, 0.08, 0.32, DARK, 0, 1.8, 0.82, { rx: 0.2 });                   // visor
    ab(0.32, 0.12, 0.02, 0xf2f2f2, 0, 0.62, -1.08);                         // plate
    wheelDefs = [[0, 0.28, 1.05, 0.28, 0.16, 1], [-0.74, 0.28, -0.68, 0.28, 0.18, 0], [0.74, 0.28, -0.68, 0.28, 0.18, 0]];
  } else {
    // CTB bus
    const cream = 0xeeeee8;
    ab(2.3, 1.0, 5.8, color, 0, 0.72, 0);                                   // lower body
    ab(2.3, 0.95, 5.8, color, 0, 1.7, 0);                                   // upper body
    ab(2.34, 0.2, 5.84, 0xf5c518, 0, 1.2, 0);                               // yellow stripe
    ab(2.34, 0.1, 5.84, 0xffffff, 0, 0.96, 0);                              // white stripe
    ab(2.32, 0.14, 5.9, cream, 0, 2.25, 0);                                 // roof
    ab(0.6, 0.1, 0.9, 0xd6d6d0, 0, 2.37, 1.0); ab(0.6, 0.1, 0.9, 0xd6d6d0, 0, 2.37, -1.2);       // roof vents
    for (const sx of [-0.52, 0.52]) ab(1.0, 0.8, 0.06, GLASS, sx, 1.72, 2.9);                    // split windscreen
    ab(0.06, 0.8, 0.08, color, 0, 1.72, 2.91);
    ab(1.4, 0.22, 0.06, 0xffd54a, 0, 2.1, 2.92); ab(0.9, 0.06, 0.07, 0x222222, 0, 2.1, 2.93);    // route board
    ab(1.3, 0.4, 0.06, 0x2a2a2a, 0, 0.6, 2.92); ab(1.3, 0.04, 0.07, CHROME, 0, 0.8, 2.93);       // grille
    ab(2.36, 0.2, 0.22, 0x3a3a3a, 0, 0.3, 2.95); ab(2.36, 0.2, 0.22, 0x3a3a3a, 0, 0.3, -2.95);  // bumpers
    ab(0.5, 0.14, 0.03, 0xf2f2f2, 0, 0.3, 3.07);
    ab(1.6, 0.6, 0.06, GLASS, 0, 1.8, -2.92);                               // rear window
    for (const sx of [-1, 1]) {
      cy(0.16, 0.16, 0.1, 10, LIGHT, sx * 0.8, 0.62, 2.92, { rx: RAD });    // headlights
      ab(0.14, 0.1, 0.06, 0xffa000, sx * 1.0, 0.9, 2.92);                   // indicators
      ab(0.2, 0.16, 0.06, TAIL, sx * 0.9, 0.8, -2.93);                      // tail lights
      ab(0.5, 0.04, 0.04, 0x222222, sx * 1.4, 1.7, 2.7); ab(0.08, 0.4, 0.2, CHROME, sx * 1.65, 1.7, 2.7); // mirrors
      for (let j = 0; j < 4; j++) ab(0.04, 0.62, 0.9, GLASS, sx * 1.16, 1.78, -1.8 + j * 1.2 - (sx > 0 ? 0 : 0));
      for (const wz of [2.05, -2.05]) cy(0.55, 0.55, 0.05, 12, BLACK, sx * 1.15, 0.44, wz, { rz: RAD });
    }
    ab(0.05, 1.6, 0.9, 0x2b4a5c, 1.17, 1.0, 1.9);                            // front door (left side)
    ab(0.05, 0.8, 0.04, 0xf5c518, 1.2, 1.0, 1.5);                            // door rail
    wheelDefs = [[-1.14, 0.44, 2.05, 0.44, 0.3, 1], [1.14, 0.44, 2.05, 0.44, 0.3, 1], [-1.14, 0.44, -2.05, 0.44, 0.3, 0], [1.14, 0.44, -2.05, 0.44, 0.3, 0]];
  }
  body.add(new THREE.Mesh(merge(P), solidMat));

  if (type === 'police') {
    const mk = (c, x) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.26), new THREE.MeshBasicMaterial({ color: c }));
      m.position.set(x, 1.5, -0.3);
      body.add(m);
      return m;
    };
    siren = [mk(0xff2a2a, -0.22), mk(0x2a6bff, 0.22)];
  }

  const wheels = [], frontWheels = [];
  for (const [x, y, z, r, w, front] of wheelDefs) {
    const m = new THREE.Mesh(wheelGeo(r, w), solidMat);
    m.position.set(x, y, z);
    m.rotation.order = 'YXZ';                // steer (Y) after spin (X)
    root.add(m);
    wheels.push(m);
    if (front) frontWheels.push(m);
  }

  scene.add(root);
  return {
    root, body, type, speed: 0, yaw: Math.PI / 2, wheels, frontWheels, siren, color, steer: 0, _ps: 0,
    radius: type === 'bus' ? 2.6 : (type === 'tuk' ? 1.15 : 1.7)
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
  addDriveable('police', -70, -6.1, 0xf2f4f6);  // Police car
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
    makeTraffic(i === 5 ? 'police' : (i % 3 === 0 ? 'tuk' : 'car'), -330 + i * 72, -2.35, 1, i === 5 ? 0xf2f4f6 : [0xd0342c, 0x2a6fb5, 0xe6e6e6, 0x3c9a55][i % 4]);
    makeTraffic(i === 2 ? 'police' : (i % 3 === 1 ? 'bus' : 'car'), 330 - i * 72, 2.35, -1, i === 2 ? 0xf2f4f6 : [0xb91c1c, 0xd9d9d9, 0xe0b52b][i % 3]);
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