// main.js — Core Engine, Sound FX, Missions, Radar Minimap, Physics & Loop
import { buildWorld, clamp } from './world.js';
import { createPlayer, spawnWorldEntities } from './entities.js';

const THREE = window.THREE;
const $ = id => document.getElementById(id);

/* ---------- Procedural Web Audio Engine (Zero External Files Needed) ---------- */
class SoundEngine {
  constructor() { this.ctx = null; }
  init() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }
  playTone(freq, type, duration, vol = 0.15, slideTo = null) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain); gain.connect(this.ctx.destination);
    osc.start(now); osc.stop(now + duration);
  }
  horn(isBus = false) {
    this.init();
    if (isBus) {
      this.playTone(185, 'sawtooth', 0.35, 0.18);
      this.playTone(233, 'sawtooth', 0.35, 0.18);
    } else {
      this.playTone(440, 'square', 0.14, 0.12);
      setTimeout(() => this.playTone(440, 'square', 0.18, 0.12), 160);
    }
  }
  shoot() { this.init(); this.playTone(320, 'sawtooth', 0.16, 0.25, 45); }
  hit() { this.init(); this.playTone(680, 'triangle', 0.1, 0.18, 220); }
  cash() {
    this.init();
    this.playTone(587, 'sine', 0.12, 0.18);
    setTimeout(() => this.playTone(880, 'sine', 0.25, 0.2), 110);
  }
}
const sfx = new SoundEngine();

/* ---------- Renderer & Scene ---------- */
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
let scale = Math.min(window.devicePixelRatio || 1, 1);
function applyRes() { renderer.setPixelRatio(scale); renderer.setSize(innerWidth, innerHeight, false); }
applyRes();

const FOG = 0xd4ecf2;
const scene = new THREE.Scene();
scene.background = new THREE.Color(FOG);
scene.fog = new THREE.Fog(FOG, 75, 240);

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.3, 350);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  applyRes();
});

const SUN = new THREE.Vector3(0.5, 0.62, -0.4).normalize();
scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x6b8a4a, 0.76));
const sunL = new THREE.DirectionalLight(0xfff0d0, 0.74);
sunL.position.copy(SUN).multiplyScalar(100);
scene.add(sunL);

const { cols, sky, clouds, landmarks } = buildWorld(scene);
const player = createPlayer(scene);
const { vehicles, traffic, pedestrians, targets } = spawnWorldEntities(scene);

/* ---------- Mission Checkpoint Beacon ---------- */
const beaconGeo = new THREE.CylinderGeometry(2.6, 2.6, 14, 16, 1, true);
const beaconMat = new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
const beacon = new THREE.Mesh(beaconGeo, beaconMat);
beacon.position.y = 7;
beacon.visible = false;
scene.add(beacon);

/* ---------- Game State ---------- */
const P = { x: -4, y: 0, z: 2, vx: 0, vz: 0, vy: 0, ground: true, rot: Math.PI / 2, r: 0.4, walkT: 0 };
let yaw = -Math.PI / 2, pitch = 0.28, started = false, paused = true, locked = false, dragging = false;
const keys = {};

let activeVehicle = null, aiming = false, armed = false;
let ammo = 12, reserveAmmo = 60, health = 100, stamina = 100, cash = 1500;
let shotCooldown = 0, toastTimer = 0, hudTick = 0, gameMinutes = 10 * 60 + 30;
let mission = null; // { phase: 'pickup'|'dropoff', target: {name, x, z}, reward: number }

const raycaster = new THREE.Raycaster();
const tracers = [];

function toast(msg) {
  $('toast').textContent = msg;
  $('toast').style.display = 'block';
  toastTimer = 2.2;
}

function updateHud() {
  $('hp-bar').style.width = clamp(health, 0, 100) + '%';
  $('stam-bar').style.width = clamp(stamina, 0, 100) + '%';
  $('cash').textContent = 'LKR ' + cash.toLocaleString();
  $('ammo').textContent = armed ? `PISTOL: ${ammo} / ${reserveAmmo}` : 'PISTOL: HOLSTERED';
  $('speed').textContent = activeVehicle
    ? `${activeVehicle.type.toUpperCase()} • ${Math.round(Math.abs(activeVehicle.speed) * 8)} km/h`
    : 'ON FOOT';

  const hrs = Math.floor(gameMinutes / 60) % 24;
  const mins = Math.floor(gameMinutes % 60);
  const ampm = hrs >= 12 ? 'PM' : 'AM';
  const h12 = hrs % 12 || 12;
  $('time-display').textContent = `${h12}:${mins.toString().padStart(2, '0')} ${ampm}`;
}

function startTaxiMission() {
  if (!activeVehicle) {
    toast('Enter a Tuk-Tuk or Car first to start a Taxi Job!');
    return;
  }
  const pick = landmarks[Math.floor(Math.random() * landmarks.length)];
  mission = { phase: 'pickup', target: pick, reward: 450 + Math.floor(Math.random() * 400) };
  beacon.position.set(pick.x, 7, pick.z);
  beacon.material.color.setHex(0xf5c518);
  beacon.visible = true;
  $('mission-text').textContent = `Pick up passenger at ${pick.name}`;
  toast(`Taxi Job Started! Head to ${pick.name}`);
}

/* ---------- Input Handling ---------- */
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.code === 'KeyE' && !e.repeat) toggleVehicle();
  if (e.code === 'KeyH' && !e.repeat && activeVehicle) sfx.horn(activeVehicle.type === 'bus');
  if (e.code === 'KeyM' && !e.repeat) startTaxiMission();
  if (e.code === 'Digit1' && !e.repeat) {
    armed = !armed;
    player.pistol.visible = armed && !activeVehicle;
    updateHud();
    toast(armed ? 'Pistol equipped' : 'Pistol holstered');
  }
  if (e.code === 'KeyR' && !e.repeat && armed) {
    const take = Math.min(12 - ammo, reserveAmmo);
    ammo += take; reserveAmmo -= take;
    updateHud();
    toast(take ? 'Magazine Reloaded' : 'No reserve ammo');
  }
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
addEventListener('mousemove', e => {
  if (!started || paused || !(locked || dragging)) return;
  yaw -= e.movementX * 0.0028;
  pitch = clamp(pitch + e.movementY * 0.0028, -0.15, 1.25);
});
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('mousedown', e => {
  if (paused) return;
  sfx.init();
  if (e.button === 2) {
    aiming = true;
    $('crosshair').style.display = armed && !activeVehicle ? 'block' : 'none';
    return;
  }
  if (e.button === 0) {
    dragging = true;
    if (!locked) lockPointer();
    if (armed && !activeVehicle) shoot();
  }
});
addEventListener('mouseup', e => {
  if (e.button === 0) dragging = false;
  if (e.button === 2) { aiming = false; $('crosshair').style.display = 'none'; }
});

function lockPointer() {
  try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) {}
}
document.addEventListener('pointerlockchange', () => {
  const was = locked;
  locked = document.pointerLockElement === canvas;
  if (was && !locked && started) {
    $('ov').querySelector('h1').textContent = 'PAUSED';
    $('ovt').textContent = 'Game Paused. Click RESUME to jump back into Lanka Life.';
    $('go').textContent = 'RESUME';
    $('ov').style.display = 'flex';
    paused = true; dragging = false; aiming = false;
    $('crosshair').style.display = 'none';
  }
});
$('go').addEventListener('click', () => {
  sfx.init();
  started = true; paused = false;
  $('ov').style.display = 'none';
  lockPointer();
});

/* ---------- Vehicle & Shooting Logic ---------- */
function toggleVehicle() {
  if (activeVehicle) {
    const v = activeVehicle;
    activeVehicle = null;
    const side = new THREE.Vector3(Math.cos(v.yaw), 0, -Math.sin(v.yaw));
    P.x = v.root.position.x + side.x * 2.0;
    P.z = v.root.position.z + side.z * 2.0;
    P.y = 0; P.vx = P.vz = 0;
    player.g.visible = true;
    player.blob.visible = true;
    player.pistol.visible = armed;
    toast('Exited vehicle');
    return;
  }
  let best = null, dist = 4.5;
  for (const v of vehicles) {
    const d = Math.hypot(P.x - v.root.position.x, P.z - v.root.position.z);
    if (d < dist) { best = v; dist = d; }
  }
  if (best) {
    activeVehicle = best;
    best.speed = 0;
    player.g.visible = false;
    player.blob.visible = false;
    player.pistol.visible = false;
    aiming = false;
    $('crosshair').style.display = 'none';
    P.x = best.root.position.x; P.z = best.root.position.z;
    const label = best.type === 'tuk' ? 'Tuk-Tuk' : (best.type === 'bus' ? 'CTB Bus' : 'Car');
    toast(`Driving ${label} — Press [M] for Taxi Mission!`);
  }
}

function vehicleBlocked(x, z, v) {
  for (const c of cols) {
    if (!c.b) continue;
    const pad = v.radius;
    if (x > c.x0 - pad && x < c.x1 + pad && z > c.z0 - pad && z < c.z1 + pad) return true;
  }
  for (const other of [...vehicles, ...traffic]) {
    if (other === v) continue;
    const d = Math.hypot(x - other.root.position.x, z - other.root.position.z);
    if (d < v.radius + other.radius) return true;
  }
  return false;
}

function updateVehicle(dt, v, playerControlled) {
  if (playerControlled) {
    const maxFwd = v.type === 'bus' ? 11 : (v.type === 'tuk' ? 12.5 : 15);
    const accel = keys.KeyW ? maxFwd : (keys.KeyS ? -7.5 : 0);
    v.speed += (accel - v.speed) * Math.min(1, dt * 2.2);
    if (!keys.KeyW && !keys.KeyS) v.speed *= Math.exp(-1.5 * dt);
    const steer = (keys.KeyA ? 1 : 0) - (keys.KeyD ? 1 : 0);
    v.yaw += steer * dt * (1.1 + Math.min(1, Math.abs(v.speed) / 5)) * Math.sign(v.speed || 1);

    const nx = v.root.position.x + Math.sin(v.yaw) * v.speed * dt;
    const nz = v.root.position.z + Math.cos(v.yaw) * v.speed * dt;
    if (!vehicleBlocked(nx, nz, v)) {
      v.root.position.x = clamp(nx, -155, 155);
      v.root.position.z = clamp(nz, -155, 155);
    } else {
      if (Math.abs(v.speed) > 4) sfx.hit();
      v.speed = -v.speed * 0.25;
    }
    P.x = v.root.position.x; P.z = v.root.position.z; P.y = 0; P.rot = v.yaw;
  } else {
    // AI Traffic: Only brake for obstacles IN THE SAME LANE (Z difference < 2.2) and AHEAD
    let blocked = false;
    const vx = v.root.position.x;
    const vz = v.root.position.z;
    const stopDist = v.radius + 5.5;

    // 1. Check if Player or Player's active vehicle is blocking this lane ahead
    const dxPlayer = (P.x - vx) * v.dir;
    const dzPlayer = Math.abs(P.z - vz);
    if (dxPlayer > 0 && dxPlayer < stopDist && dzPlayer < 2.3) {
      blocked = true;
    }

    // 2. Check other traffic/parked vehicles ONLY in the same lane and ahead
    if (!blocked) {
      for (const other of [...vehicles, ...traffic]) {
        if (other === v) continue;
        const dx = (other.root.position.x - vx) * v.dir;
        const dz = Math.abs(other.root.position.z - vz);
        if (dx > 0 && dx < (v.radius + other.radius + 3.2) && dz < 2.2) {
          blocked = true;
          break;
        }
      }
    }

    const targetSpd = blocked ? 0 : v.cruise * v.dir;
    v.speed += (targetSpd - v.speed) * Math.min(1, dt * 4);
    v.root.position.x += v.speed * dt;

    // Wrap around smoothly without stacking at edges
    if (v.root.position.x > 154) v.root.position.x = -154;
    if (v.root.position.x < -154) v.root.position.x = 154;
  }
  v.root.rotation.y = v.yaw;
  v.wheels.forEach(w => { w.rotation.x -= v.speed * dt * 2.2; });
}

function spawnTracer(start, end) {
  const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
  const mat = new THREE.LineBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.9 });
  const line = new THREE.Line(geo, mat);
  scene.add(line);
  tracers.push({ line, life: 0.12 });
}

function shoot() {
  if (!armed || activeVehicle || shotCooldown > 0) return;
  if (ammo <= 0) { toast('Empty magazine — Press [R] to reload'); return; }
  ammo--; shotCooldown = 0.22;
  sfx.shoot();
  updateHud();

  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const start = new THREE.Vector3(P.x, P.y + 1.4, P.z);
  const end = raycaster.ray.origin.clone().addScaledVector(raycaster.ray.direction, 65);

  const hits = raycaster.intersectObjects(targets.filter(t => t.active).map(t => t.board), false);
  if (hits.length) {
    end.copy(hits[0].point);
    const obj = targets.find(t => t.board === hits[0].object);
    if (obj) {
      sfx.hit();
      obj.hp--;
      obj.board.material.color.setHex(obj.hp === 2 ? 0xf59e0b : (obj.hp === 1 ? 0xef4444 : 0x555555));
      if (obj.hp <= 0) {
        obj.active = false;
        obj.g.visible = false;
        obj.respawnTimer = 8;
        cash += 150;
        sfx.cash();
        toast('Target Destroyed! +LKR 150');
      } else {
        toast(`Target Hit! (${obj.hp} HP left)`);
      }
    }
  }
  spawnTracer(start, end);
}

/* ---------- Player Physics ---------- */
function collide() {
  for (const c of cols) {
    if (P.y >= c.h - 0.1) continue;
    if (P.x < c.x0 - P.r || P.x > c.x1 + P.r || P.z < c.z0 - P.r || P.z > c.z1 + P.r) continue;
    const cx = clamp(P.x, c.x0, c.x1), cz = clamp(P.z, c.z0, c.z1);
    const dx = P.x - cx, dz = P.z - cz, d2 = dx * dx + dz * dz;
    if (d2 >= P.r * P.r) continue;
    if (d2 > 1e-6) {
      const d = Math.sqrt(d2), k = (P.r - d) / d;
      P.x += dx * k; P.z += dz * k;
    } else {
      const l = P.x - c.x0, r = c.x1 - P.x, t = P.z - c.z0, b = c.z1 - P.z, m = Math.min(l, r, t, b);
      if (m === l) P.x = c.x0 - P.r; else if (m === r) P.x = c.x1 + P.r; else if (m === t) P.z = c.z0 - P.r; else P.z = c.z1 + P.r;
    }
  }
}

function floorAt() {
  let f = 0;
  for (const c of cols) {
    if (c.h <= 1.8 && P.y >= c.h - 0.35 && P.x > c.x0 - 0.2 && P.x < c.x1 + 0.2 && P.z > c.z0 - 0.2 && P.z < c.z1 + 0.2) {
      f = Math.max(f, c.h);
    }
  }
  return f;
}

/* ---------- 2D Radar Minimap Renderer ---------- */
const mapCtx = $('minimap').getContext('2d');
function drawMinimap() {
  const ctx = mapCtx, R = 80, zoom = 0.72;
  ctx.clearRect(0, 0, 160, 160);
  ctx.save();
  ctx.translate(R, R);
  ctx.rotate(yaw + Math.PI); // Rotate radar with camera heading

  const toMap = (wx, wz) => [(wx - P.x) * zoom, (wz - P.z) * zoom];

  // Roads
  ctx.fillStyle = '#475569';
  let [rx1, rz1] = toMap(-160, -5);
  ctx.fillRect(rx1, rz1, 320 * zoom, 10 * zoom);
  let [rx2, rz2] = toMap(16.5, -150);
  ctx.fillRect(rx2, rz2, 7 * zoom, 150 * zoom);

  // Landmarks
  for (const lm of landmarks) {
    const [lx, lz] = toMap(lm.x, lm.z);
    ctx.fillStyle = lm.color;
    ctx.beginPath(); ctx.arc(lx, lz, 3.2, 0, Math.PI * 2); ctx.fill();
  }

  // Vehicles
  for (const v of vehicles) {
    const [vx, vz] = toMap(v.root.position.x, v.root.position.z);
    ctx.fillStyle = v === activeVehicle ? '#38bdf8' : '#facc15';
    ctx.fillRect(vx - 2.5, vz - 2.5, 5, 5);
  }

  // Active Mission Beacon
  if (mission) {
    const [mx, mz] = toMap(mission.target.x, mission.target.z);
    ctx.strokeStyle = mission.phase === 'pickup' ? '#f5c518' : '#22c55e';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(mx, mz, 6, 0, Math.PI * 2); ctx.stroke();
  }

  ctx.restore();

  // Center Player Arrow
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(R, R - 6); ctx.lineTo(R + 4.5, R + 5); ctx.lineTo(R, R + 2.5); ctx.lineTo(R - 4.5, R + 5);
  ctx.closePath(); ctx.fill();
}

/* ---------- Main Update Step ---------- */
function update(dt) {
  gameMinutes += dt * 1.5;
  if (shotCooldown > 0) shotCooldown -= dt;
  if (toastTimer > 0 && (toastTimer -= dt) <= 0) $('toast').style.display = 'none';

  // Tracers & Target Respawn
  for (let i = tracers.length - 1; i >= 0; i--) {
    tracers[i].life -= dt;
    if (tracers[i].life <= 0) { scene.remove(tracers[i].line); tracers.splice(i, 1); }
  }
  for (const t of targets) {
    if (!t.active && (t.respawnTimer -= dt) <= 0) {
      t.active = true; t.hp = 3; t.g.visible = true; t.board.material.color.setHex(0xd74a3a);
    }
  }

  // Camera Keyboard Controls
  if (keys.KeyQ || keys.ArrowLeft) yaw += 1.9 * dt;
  if (keys.ArrowRight) yaw -= 1.9 * dt;
  if (keys.ArrowUp) pitch = clamp(pitch - 1.2 * dt, -0.15, 1.25);
  if (keys.ArrowDown) pitch = clamp(pitch + 1.2 * dt, -0.15, 1.25);

  // Player / Active Vehicle Movement
  if (activeVehicle) {
    updateVehicle(dt, activeVehicle, true);
  } else {
    const ix = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
    const iz = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = -fz, rz = fx;
    let mxv = fx * iz + rx * ix, mzv = fz * iz + rz * ix;
    const len = Math.hypot(mxv, mzv);

    const wantsRun = (keys.ShiftLeft || keys.ShiftRight) && len > 0;
    if (wantsRun && stamina > 0) stamina = Math.max(0, stamina - 22 * dt);
    else stamina = Math.min(100, stamina + 14 * dt);

    const spd = wantsRun && stamina > 2 ? 8.8 : 4.7;
    if (len > 0) { mxv /= len; mzv /= len; }
    const k = 1 - Math.exp(-(P.ground ? 12 : 3) * dt);
    P.vx += (mxv * spd * (len > 0 ? 1 : 0) - P.vx) * k;
    P.vz += (mzv * spd * (len > 0 ? 1 : 0) - P.vz) * k;
    P.x = clamp(P.x + P.vx * dt, -155, 155);
    P.z = clamp(P.z + P.vz * dt, -155, 155);
    collide();

    if (keys.Space && P.ground) { P.vy = 9.2; P.ground = false; }
    P.vy -= 26 * dt;
    P.y += P.vy * dt;
    const fl = floorAt();
    if (P.y <= fl) { P.y = fl; P.vy = 0; P.ground = true; } else P.ground = false;

    const sp = Math.hypot(P.vx, P.vz);
    if (sp > 0.3) {
      const tr = Math.atan2(P.vx, P.vz);
      const d = Math.atan2(Math.sin(tr - P.rot), Math.cos(tr - P.rot));
      P.rot += d * (1 - Math.exp(-14 * dt));
    }

    if (P.ground) {
      P.walkT += dt * sp * 1.7;
      const sw = Math.sin(P.walkT) * Math.min(1, sp / 4) * 0.9;
      player.legs[0].rotation.x = sw; player.legs[1].rotation.x = -sw;
      player.arms[0].rotation.x = -sw; player.arms[1].rotation.x = sw;
    } else {
      player.legs[0].rotation.x = 0.5; player.legs[1].rotation.x = -0.3;
      player.arms[0].rotation.x = player.arms[1].rotation.x = -2.4;
    }
    player.g.position.set(P.x, P.y, P.z);
    player.g.rotation.y = P.rot;
    player.blob.position.set(P.x, 0.14, P.z);
    player.blob.scale.setScalar(clamp(1 - P.y * 0.12, 0.4, 1));
  }

  // Update Traffic & Pedestrians
  for (const v of traffic) updateVehicle(dt, v, false);
  for (const n of pedestrians) {
    // Scatter away if player honks nearby
    const distToPlayer = Math.hypot(n.g.position.x - P.x, n.g.position.z - P.z);
    const speedMult = (keys.KeyH && distToPlayer < 12) ? 2.8 : 1.0;

    n.g.position.x += n.dir * 1.15 * speedMult * dt;
    if (n.g.position.x > n.maxX) { n.g.position.x = n.maxX; n.dir = -1; }
    if (n.g.position.x < n.minX) { n.g.position.x = n.minX; n.dir = 1; }
    n.g.rotation.y = n.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    n.phase += dt * 5.5 * speedMult;
    const sw = Math.sin(n.phase) * 0.6;
    n.legs[0].rotation.x = sw; n.legs[1].rotation.x = -sw;
  }

  // Active Taxi Mission Check
  if (mission) {
    beacon.rotation.y += dt * 2;
    const dist = Math.hypot(P.x - mission.target.x, P.z - mission.target.z);
    if (dist < 4.5) {
      if (mission.phase === 'pickup') {
        let dest = landmarks[Math.floor(Math.random() * landmarks.length)];
        while (dest === mission.target) dest = landmarks[Math.floor(Math.random() * landmarks.length)];
        mission.phase = 'dropoff';
        mission.target = dest;
        beacon.position.set(dest.x, 7, dest.z);
        beacon.material.color.setHex(0x22c55e);
        $('mission-text').textContent = `Drop passenger at ${dest.name}`;
        sfx.cash();
        toast(`Passenger onboard! Drive to ${dest.name}`);
      } else {
        cash += mission.reward;
        sfx.cash();
        toast(`Drop-off Complete! Earned +LKR ${mission.reward}`);
        $('mission-text').textContent = 'Job Complete! Press [M] for next Taxi Job';
        beacon.visible = false;
        mission = null;
      }
    }
  }

  // Dynamic Location Name
  let loc = 'Lanka Main Road';
  if (P.z < -20 && Math.abs(P.x - 20) < 22) loc = 'Village Lane';
  else if (Math.hypot(P.x + 55, P.z + 45) < 25) loc = 'Sacred Temple Grounds';
  else if (P.x > -5 && P.x < 48 && P.z > 0 && P.z < 20) loc = 'Town Bazaar';
  else if (P.x > 70 && P.z < -30) loc = 'Practice Firing Range';
  $('loc').textContent = loc;

  // Vehicle Enter Prompt
  if (!activeVehicle) {
    const near = vehicles.some(v => Math.hypot(P.x - v.root.position.x, P.z - v.root.position.z) < 4.5);
    $('interact').style.display = near ? 'block' : 'none';
  } else {
    $('interact').style.display = 'none';
  }

  // Camera Follow + Wall Collision
  const camDist = aiming ? 2.3 : (activeVehicle ? (activeVehicle.type === 'bus' ? 9.5 : 6.6) : 4.8);
  const targetY = P.y + (activeVehicle ? 1.6 : 1.65);
  const sideOffset = aiming ? 0.65 : 0;

  const tx = P.x + Math.cos(yaw) * sideOffset;
  const tz = P.z - Math.sin(yaw) * sideOffset;
  const cx = tx + Math.sin(yaw) * Math.cos(pitch) * camDist;
  let cy = targetY + Math.sin(pitch) * camDist;
  const cz = tz + Math.cos(yaw) * Math.cos(pitch) * camDist;

  for (const c of cols) {
    if (!c.b || cy > c.h) continue;
    if (cx > c.x0 - 0.3 && cx < c.x1 + 0.3 && cz > c.z0 - 0.3 && cz < c.z1 + 0.3) {
      cy = Math.max(cy, c.h + 0.4);
    }
  }

  camera.position.set(cx, Math.max(0.45, cy), cz);
  camera.lookAt(tx, targetY, tz);
  sky.position.copy(camera.position);

  for (const c of clouds) {
    c.position.x += 1.4 * dt;
    if (c.position.x > 240) c.position.x = -240;
  }

  if ((hudTick += dt) > 0.12) {
    updateHud();
    drawMinimap();
    hudTick = 0;
  }
}

/* ---------- Render Loop ---------- */
let last = performance.now(), frames = 0, fpsTimer = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  frames++; fpsTimer += dt;
  if (fpsTimer >= 0.5) {
    const fps = Math.round(frames / fpsTimer);
    $('fps').textContent = fps + ' FPS';
    if (fps < 30 && scale > 0.65) { scale = Math.max(0.65, scale - 0.15); applyRes(); }
    frames = 0; fpsTimer = 0;
  }

  if (!paused) update(dt);
  renderer.render(scene, camera);
}
requestAnimationFrame(loop);