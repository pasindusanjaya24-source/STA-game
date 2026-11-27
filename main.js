// main.js — Core Engine, Shadows, Sound FX, Missions, Radar Minimap, Physics & Loop
import { buildWorld, clamp, PAL } from "./world.js";
import {
  createPlayer,
  spawnWorldEntities,
  shootGun,
  punchAttack,
  updateCombat,
  animateHuman,
} from "./entities.js";

const THREE = window.THREE;
const $ = (id) => document.getElementById(id);

/* ---------- Procedural Web Audio Engine (Zero External Files Needed) ---------- */
class SoundEngine {
  constructor() {
    this.ctx = null;
  }
  init() {
    if (!this.ctx)
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state === "suspended") this.ctx.resume();
  }
  playTone(freq, type, duration, vol = 0.15, slideTo = null) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo)
      osc.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }
  horn(isBus = false) {
    this.init();
    if (isBus) {
      this.playTone(185, "sawtooth", 0.35, 0.18);
      this.playTone(233, "sawtooth", 0.35, 0.18);
    } else {
      this.playTone(440, "square", 0.14, 0.12);
      setTimeout(() => this.playTone(440, "square", 0.18, 0.12), 160);
    }
  }
  shoot() {
    this.init();
    this.playTone(320, "sawtooth", 0.16, 0.25, 45);
  }
  punch() {
    this.init();
    this.playTone(160, "triangle", 0.12, 0.22, 55);
  }
  hit() {
    this.init();
    this.playTone(680, "triangle", 0.1, 0.18, 220);
  }
  cash() {
    this.init();
    this.playTone(587, "sine", 0.12, 0.18);
    setTimeout(() => this.playTone(880, "sine", 0.25, 0.2), 110);
  }
}
const sfx = new SoundEngine();

// Renderer & Tone Mapping — rich contrast without washing out colors
const SHADOWS = true;
const canvas = $("c");
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance",
});
renderer.shadowMap.enabled = SHADOWS;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;

const MAX_SCALE = Math.min(window.devicePixelRatio || 1, 1.25),
  MIN_SCALE = 0.75;
let scale = MAX_SCALE;
function applyRes() {
  renderer.setPixelRatio(scale);
  renderer.setSize(innerWidth, innerHeight, false);
}
applyRes();

const FOG = PAL.fog;
const scene = new THREE.Scene();
scene.background = new THREE.Color(FOG);
scene.fog = new THREE.Fog(FOG, 110, 330);

const camera = new THREE.PerspectiveCamera(
  60,
  innerWidth / innerHeight,
  0.3,
  420,
);
addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  applyRes();
});

const SUN = new THREE.Vector3(0.5, 0.62, -0.4).normalize();
scene.add(new THREE.HemisphereLight(PAL.hemiSky, PAL.hemiGround, 0.62));
const sunL = new THREE.DirectionalLight(PAL.sun, 0.95);
sunL.position.copy(SUN).multiplyScalar(110);
sunL.castShadow = SHADOWS;
sunL.shadow.mapSize.set(2048, 2048);
sunL.shadow.camera.near = 20;
sunL.shadow.camera.far = 260;
const dCam = 42;
sunL.shadow.camera.left = -dCam;
sunL.shadow.camera.right = dCam;
sunL.shadow.camera.top = dCam;
sunL.shadow.camera.bottom = -dCam;
sunL.shadow.bias = -0.0005;
scene.add(sunL, sunL.target);

const {
  cols,
  sky,
  clouds,
  landmarks,
  bounds,
  mapShapes,
  areas,
  regions,
  tick,
} = buildWorld(scene);

/* ---------- Spatial grid: collision checks only look at nearby colliders ---------- */
const CELL = 24;
const grid = new Map();
const gk = (ix, iz) => (ix + 100) * 400 + (iz + 100);
for (const c of cols) {
  const ix0 = Math.floor(c.x0 / CELL),
    ix1 = Math.floor(c.x1 / CELL),
    iz0 = Math.floor(c.z0 / CELL),
    iz1 = Math.floor(c.z1 / CELL);
  for (let ix = ix0; ix <= ix1; ix++)
    for (let iz = iz0; iz <= iz1; iz++) {
      const k = gk(ix, iz);
      let a = grid.get(k);
      if (!a) grid.set(k, (a = []));
      a.push(c);
    }
}
let gridStamp = 0;
const _near = [];
function nearCols(x, z, pad = 0) {
  gridStamp++;
  _near.length = 0;
  const ix0 = Math.floor((x - pad) / CELL),
    ix1 = Math.floor((x + pad) / CELL),
    iz0 = Math.floor((z - pad) / CELL),
    iz1 = Math.floor((z + pad) / CELL);
  for (let ix = ix0; ix <= ix1; ix++)
    for (let iz = iz0; iz <= iz1; iz++) {
      const a = grid.get(gk(ix, iz));
      if (!a) continue;
      for (const c of a)
        if (c._s !== gridStamp) {
          c._s = gridStamp;
          _near.push(c);
        }
    }
  return _near;
}

const player = createPlayer(scene);
const entities = spawnWorldEntities(scene);
entities.bullets = entities.bullets || [];
entities.sparks = entities.sparks || [];
const { vehicles, traffic, pedestrians, targets } = entities;
const allVehicles = [...vehicles, ...traffic];
const sirenCars = allVehicles.filter((v) => v.siren);

// Enable shadow casting/receiving on dynamic vehicles, pedestrians & targets
for (const v of allVehicles) {
  v.root.traverse((ch) => {
    if (ch.isMesh) {
      ch.castShadow = true;
      ch.receiveShadow = true;
    }
  });
}
for (const p of pedestrians) {
  p.g.traverse((ch) => {
    if (ch.isMesh) {
      ch.castShadow = true;
      ch.receiveShadow = true;
    }
  });
}
for (const t of targets) {
  t.g.traverse((ch) => {
    if (ch.isMesh) {
      ch.castShadow = true;
      ch.receiveShadow = true;
    }
  });
}
player.g.traverse((ch) => {
  if (ch.isMesh) ch.castShadow = true;
});

/* ---------- Mission Checkpoint Beacon ---------- */
const beaconGeo = new THREE.CylinderGeometry(2.6, 2.6, 14, 16, 1, true);
const beaconMat = new THREE.MeshBasicMaterial({
  color: 0x22c55e,
  transparent: true,
  opacity: 0.35,
  side: THREE.DoubleSide,
  depthWrite: false,
});
const beacon = new THREE.Mesh(beaconGeo, beaconMat);
beacon.position.y = 7;
beacon.visible = false;
scene.add(beacon);

/* ---------- Game State ---------- */
const P = {
  x: -4,
  y: 0,
  z: 2,
  vx: 0,
  vz: 0,
  vy: 0,
  ground: true,
  rot: Math.PI / 2,
  r: 0.4,
  walkT: 0,
  turnSmooth: 0,
};
let yaw = -Math.PI / 2,
  pitch = 0.28,
  started = false,
  paused = true,
  locked = false,
  dragging = false;
const keys = {};

let activeVehicle = null,
  aiming = false,
  armed = false;
let ammo = 12,
  reserveAmmo = 60,
  health = 100,
  stamina = 100,
  cash = 1500;
let shotCooldown = 0,
  punchCooldown = 0,
  toastTimer = 0,
  hudTick = 0,
  gameMinutes = 10 * 60 + 30;
let mission = null,
  lastLoc = "";

const raycaster = new THREE.Raycaster();
const tracers = [];

function toast(msg) {
  $("toast").textContent = msg;
  $("toast").style.display = "block";
  toastTimer = 2.2;
}

function updateHud() {
  $("hp-bar").style.width = clamp(health, 0, 100) + "%";
  $("stam-bar").style.width = clamp(stamina, 0, 100) + "%";
  $("cash").textContent = "LKR " + cash.toLocaleString();
  const ammoStr = `${ammo} / ${reserveAmmo}`;
  $("ammo").textContent = armed ? `PISTOL: ${ammoStr}` : "PISTOL: HOLSTERED";
  $("ammo-bottom").textContent = armed ? ammoStr : "HOLSTERED";
  $("speed").textContent = activeVehicle
    ? `${activeVehicle.type.toUpperCase()} • ${Math.round(Math.abs(activeVehicle.speed) * 8)} km/h`
    : "ON FOOT";

  const hrs = Math.floor(gameMinutes / 60) % 24;
  const mins = Math.floor(gameMinutes % 60);
  const ampm = hrs >= 12 ? "PM" : "AM";
  const h12 = hrs % 12 || 12;
  $("time-display").textContent =
    `${h12}:${mins.toString().padStart(2, "0")} ${ampm}`;
}

function startTaxiMission() {
  if (!activeVehicle) {
    toast("Enter a Tuk-Tuk or Car first to start a Taxi Job!");
    return;
  }
  const pick = landmarks[Math.floor(Math.random() * landmarks.length)];
  mission = {
    phase: "pickup",
    target: pick,
    reward: 450 + Math.floor(Math.random() * 400),
  };
  beacon.position.set(pick.x, 7, pick.z);
  beacon.material.color.setHex(0xf5c518);
  beacon.visible = true;
  $("mission-text").textContent = `Pick up at ${pick.name}`;
  toast(`Taxi Job Started! Head to ${pick.name}`);
}

/* ---------- Input Handling ---------- */
addEventListener("keydown", (e) => {
  keys[e.code] = true;
  if (
    ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
      e.code,
    )
  )
    e.preventDefault();
  if (paused) return;
  if (e.code === "KeyE" && !e.repeat) toggleVehicle();
  if (e.code === "KeyH" && !e.repeat && activeVehicle)
    sfx.horn(activeVehicle.type === "bus");
  if (e.code === "KeyM" && !e.repeat) startTaxiMission();
  if (e.code === "Digit1" && !e.repeat) {
    armed = !armed;
    player.pistol.visible = armed && !activeVehicle;
    updateHud();
    toast(armed ? "Pistol equipped" : "Pistol holstered");
  }
  if (e.code === "KeyR" && !e.repeat && armed) {
    const take = Math.min(12 - ammo, reserveAmmo);
    ammo += take;
    reserveAmmo -= take;
    updateHud();
    toast(take ? "Magazine Reloaded" : "No reserve ammo");
  }
});
addEventListener("keyup", (e) => {
  keys[e.code] = false;
});
addEventListener("blur", () => {
  for (const k in keys) keys[k] = false;
});
addEventListener("mousemove", (e) => {
  if (!started || paused || !(locked || dragging)) return;
  yaw -= e.movementX * 0.0028;
  pitch = clamp(pitch + e.movementY * 0.0028, -0.15, 1.25);
});
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
canvas.addEventListener("mousedown", (e) => {
  if (paused) return;
  sfx.init();
  if (e.button === 2) {
    aiming = true;
    $("crosshair").style.display = armed && !activeVehicle ? "block" : "none";
    return;
  }
  if (e.button === 0) {
    dragging = true;
    if (!locked) lockPointer();
    if (!activeVehicle) {
      if (armed) shoot();
      else punch();
    }
  }
});
addEventListener("mouseup", (e) => {
  if (e.button === 0) dragging = false;
  if (e.button === 2) {
    aiming = false;
    $("crosshair").style.display = "none";
  }
});

function lockPointer() {
  try {
    const r = canvas.requestPointerLock();
    if (r && r.catch) r.catch(() => {});
  } catch (e) {}
}
document.addEventListener("pointerlockchange", () => {
  const was = locked;
  locked = document.pointerLockElement === canvas;
  if (was && !locked && started) {
    $("ov").querySelector("h1").textContent = "PAUSED";
    $("ovt").textContent =
      "Game Paused. Click RESUME to jump back into Lanka Life.";
    $("go").textContent = "RESUME";
    $("ov").style.display = "flex";
    paused = true;
    dragging = false;
    aiming = false;
    $("crosshair").style.display = "none";
  }
});
$("go").addEventListener("click", () => {
  sfx.init();
  started = true;
  paused = false;
  $("ov").style.display = "none";
  updateHud();
  lockPointer();
});

/* ---------- Vehicle & Combat Logic ---------- */
function toggleVehicle() {
  if (activeVehicle) {
    const v = activeVehicle;
    activeVehicle = null;
    const side = new THREE.Vector3(Math.cos(v.yaw), 0, -Math.sin(v.yaw));
    P.x = v.root.position.x + side.x * 2.0;
    P.z = v.root.position.z + side.z * 2.0;
    P.y = 0;
    P.vx = P.vz = 0;
    player.g.visible = true;
    player.blob.visible = true;
    player.pistol.visible = armed;
    toast("Exited vehicle");
    return;
  }
  let best = null,
    dist = 4.5;
  for (const v of vehicles) {
    const d = Math.hypot(P.x - v.root.position.x, P.z - v.root.position.z);
    if (d < dist) {
      best = v;
      dist = d;
    }
  }
  if (best) {
    activeVehicle = best;
    best.speed = 0;
    player.g.visible = false;
    player.blob.visible = false;
    player.pistol.visible = false;
    aiming = false;
    $("crosshair").style.display = "none";
    P.x = best.root.position.x;
    P.z = best.root.position.z;
    const label =
      best.type === "tuk"
        ? "Tuk-Tuk"
        : best.type === "bus"
          ? "CTB Bus"
          : best.type === "police"
            ? "Police Car"
            : "Car";
    toast(`Driving ${label} — Press [M] for Taxi Mission!`);
  }
}

function vehicleBlocked(x, z, v) {
  const pad = v.radius;
  for (const c of nearCols(x, z, pad + 1)) {
    if (!c.b) continue;
    if (x > c.x0 - pad && x < c.x1 + pad && z > c.z0 - pad && z < c.z1 + pad)
      return true;
  }
  for (const other of allVehicles) {
    if (other === v) continue;
    const d = Math.hypot(x - other.root.position.x, z - other.root.position.z);
    if (d < v.radius + other.radius) return true;
  }
  return false;
}

function updateVehicle(dt, v, playerControlled) {
  if (playerControlled) {
    const maxFwd =
      v.type === "bus"
        ? 11
        : v.type === "tuk"
          ? 12.5
          : v.type === "police"
            ? 17
            : 15;
    const accel = keys.KeyW ? maxFwd : keys.KeyS ? -7.5 : 0;
    v.speed += (accel - v.speed) * Math.min(1, dt * 2.2);
    if (!keys.KeyW && !keys.KeyS) v.speed *= Math.exp(-1.5 * dt);
    const steer = (keys.KeyA ? 1 : 0) - (keys.KeyD ? 1 : 0);
    v.steer = steer;
    v.yaw +=
      steer *
      dt *
      (1.1 + Math.min(1, Math.abs(v.speed) / 5)) *
      Math.sign(v.speed || 1);

    const nx = v.root.position.x + Math.sin(v.yaw) * v.speed * dt;
    const nz = v.root.position.z + Math.cos(v.yaw) * v.speed * dt;
    const px = v.root.position.x,
      pz = v.root.position.z;
    if (vehicleBlocked(px, pz, v) || !vehicleBlocked(nx, nz, v)) {
      v.root.position.x = clamp(nx, bounds.x0, bounds.x1);
      v.root.position.z = clamp(nz, bounds.z0, bounds.vz1);
    } else if (!vehicleBlocked(nx, pz, v)) {
      v.root.position.x = clamp(nx, bounds.x0, bounds.x1);
      v.speed *= 0.7;
    } else if (!vehicleBlocked(px, nz, v)) {
      v.root.position.z = clamp(nz, bounds.z0, bounds.vz1);
      v.speed *= 0.7;
    } else {
      if (Math.abs(v.speed) > 4) sfx.hit();
      v.speed = -v.speed * 0.25;
    }
    P.x = v.root.position.x;
    P.z = v.root.position.z;
    P.y = 0;
    P.rot = v.yaw;
  } else {
    let blocked = false;
    const vx = v.root.position.x;
    const vz = v.root.position.z;
    const stopDist = v.radius + 5.5;

    const dxPlayer = (P.x - vx) * v.dir;
    const dzPlayer = Math.abs(P.z - vz);
    if (dxPlayer > 0 && dxPlayer < stopDist && dzPlayer < 2.3) {
      blocked = true;
    }

    if (!blocked) {
      for (const other of allVehicles) {
        if (other === v) continue;
        const dx = (other.root.position.x - vx) * v.dir;
        const dz = Math.abs(other.root.position.z - vz);
        if (dx > 0 && dx < v.radius + other.radius + 3.2 && dz < 2.2) {
          blocked = true;
          break;
        }
      }
    }

    const targetSpd = blocked ? 0 : v.cruise * v.dir;
    v.speed += (targetSpd - v.speed) * Math.min(1, dt * 4);
    v.root.position.x += v.speed * dt;

    if (v.root.position.x > bounds.x1 - 26) v.root.position.x = bounds.x0 + 26;
    if (v.root.position.x < bounds.x0 + 26) v.root.position.x = bounds.x1 - 26;
  }
  v.root.rotation.y = v.yaw;
  v.wheels.forEach((w) => {
    w.rotation.x -= (v.speed * dt * 2.2) / (v.type === "bus" ? 1.2 : 1);
  });
  if (!playerControlled) v.steer = 0;
  const st = v.steer * 0.42;
  for (const w of v.frontWheels)
    w.rotation.y += (st - w.rotation.y) * Math.min(1, dt * 10);
  const acc = (v.speed - v._ps) / Math.max(dt, 1e-3);
  v._ps = v.speed;
  const k = Math.min(1, dt * 6);
  const wantRoll =
    -v.steer *
    Math.min(1, Math.abs(v.speed) / 10) *
    (v.type === "bus" ? 0.05 : 0.04);
  const wantPitch = clamp(-acc * 0.0035, -0.045, 0.045);
  v.body.rotation.z += (wantRoll - v.body.rotation.z) * k;
  v.body.rotation.x += (wantPitch - v.body.rotation.x) * k;
}

function spawnTracer(start, end) {
  const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
  const mat = new THREE.LineBasicMaterial({
    color: 0xfef08a,
    transparent: true,
    opacity: 0.9,
  });
  const line = new THREE.Line(geo, mat);
  scene.add(line);
  tracers.push({ line, life: 0.12 });
}

function punch() {
  if (armed || activeVehicle || punchCooldown > 0) return;
  punchCooldown = 0.38;
  sfx.punch();
  punchAttack(scene, player, entities);
}

function shoot() {
  if (!armed || activeVehicle || shotCooldown > 0) return;
  if (ammo <= 0) {
    toast("Empty magazine — Press [R] to reload");
    return;
  }
  ammo--;
  shotCooldown = 0.22;
  sfx.shoot();
  updateHud();

  // Trigger gun recoil, muzzle flash, NPC panic alert, and physical bullet in entities.js
  shootGun(scene, player, entities);

  // Align the bullet trajectory with the crosshair when aiming
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const start = new THREE.Vector3();
  (player.muzzleTip || player.pistol).getWorldPosition(start);
  const end = raycaster.ray.origin
    .clone()
    .addScaledVector(raycaster.ray.direction, 65);

  if (aiming && entities.bullets.length) {
    const latestBullet = entities.bullets[entities.bullets.length - 1];
    const dir = end.clone().sub(latestBullet.pos).normalize();
    latestBullet.vel.copy(dir).multiplyScalar(65);
    latestBullet.mesh.rotation.y = Math.atan2(dir.x, dir.z);
  }

  // Practice range target reward check
  const hits = raycaster.intersectObjects(
    targets.filter((t) => t.active).map((t) => t.board),
    false,
  );
  if (hits.length) {
    end.copy(hits[0].point);
    const obj = targets.find((t) => t.board === hits[0].object);
    if (obj) {
      sfx.hit();
      obj.hp--;
      obj.board.material.color.setHex(
        obj.hp === 2 ? 0xf59e0b : obj.hp === 1 ? 0xef4444 : 0x555555,
      );
      if (obj.hp <= 0) {
        obj.active = false;
        obj.g.visible = false;
        obj.respawnTimer = 8;
        cash += 150;
        sfx.cash();
        toast("Target Destroyed! +LKR 150");
      } else {
        toast(`Target Hit! (${obj.hp} HP left)`);
      }
    }
  }
  spawnTracer(start, end);
}

/* ---------- Player Physics ---------- */
function collide() {
  for (const c of nearCols(P.x, P.z, 2)) {
    if (P.y >= c.h - 0.1) continue;
    if (
      P.x < c.x0 - P.r ||
      P.x > c.x1 + P.r ||
      P.z < c.z0 - P.r ||
      P.z > c.z1 + P.r
    )
      continue;
    const cx = clamp(P.x, c.x0, c.x1),
      cz = clamp(P.z, c.z0, c.z1);
    const dx = P.x - cx,
      dz = P.z - cz,
      d2 = dx * dx + dz * dz;
    if (d2 >= P.r * P.r) continue;
    if (d2 > 1e-6) {
      const d = Math.sqrt(d2),
        k = (P.r - d) / d;
      P.x += dx * k;
      P.z += dz * k;
    } else {
      const l = P.x - c.x0,
        r = c.x1 - P.x,
        t = P.z - c.z0,
        b = c.z1 - P.z,
        m = Math.min(l, r, t, b);
      if (m === l) P.x = c.x0 - P.r;
      else if (m === r) P.x = c.x1 + P.r;
      else if (m === t) P.z = c.z0 - P.r;
      else P.z = c.z1 + P.r;
    }
  }
}

function floorAt() {
  let f = 0;
  for (const c of nearCols(P.x, P.z, 1)) {
    if (
      c.h <= 1.8 &&
      P.y >= c.h - 0.35 &&
      P.x > c.x0 - 0.2 &&
      P.x < c.x1 + 0.2 &&
      P.z > c.z0 - 0.2 &&
      P.z < c.z1 + 0.2
    ) {
      f = Math.max(f, c.h);
    }
  }
  return f;
}

/* ---------- 2D Radar Minimap Renderer ---------- */
const mapCtx = $("minimap").getContext("2d");
const northEl = $("radar-north");
function drawMinimap() {
  const ctx = mapCtx,
    R = 82,
    zoom = 0.72;
  ctx.clearRect(0, 0, 164, 164);
  ctx.save();
  ctx.translate(R, R);
  ctx.rotate(yaw);
  northEl.style.left = 50 + Math.sin(yaw) * 43 + "%";
  northEl.style.top = 50 - Math.cos(yaw) * 43 + "%";

  const toMap = (wx, wz) => [(wx - P.x) * zoom, (wz - P.z) * zoom];

  for (const s of mapShapes) {
    if (
      s.x1 < P.x - 140 ||
      s.x0 > P.x + 140 ||
      s.z1 < P.z - 140 ||
      s.z0 > P.z + 140
    )
      continue;
    ctx.fillStyle = s.color;
    const [sx, sz] = toMap(s.x0, s.z0);
    ctx.fillRect(sx, sz, (s.x1 - s.x0) * zoom, (s.z1 - s.z0) * zoom);
  }

  for (const lm of landmarks) {
    const [lx, lz] = toMap(lm.x, lm.z);
    ctx.fillStyle = lm.color;
    ctx.beginPath();
    ctx.arc(lx, lz, 3.4, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const v of vehicles) {
    const [vx, vz] = toMap(v.root.position.x, v.root.position.z);
    ctx.fillStyle = v === activeVehicle ? "#38bdf8" : "#facc15";
    ctx.fillRect(vx - 2.5, vz - 2.5, 5, 5);
  }

  if (mission) {
    const [mx, mz] = toMap(mission.target.x, mission.target.z);
    ctx.strokeStyle = mission.phase === "pickup" ? "#f5c518" : "#22c55e";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(mx, mz, 6.5, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(R, R - 6);
  ctx.lineTo(R + 4.5, R + 5);
  ctx.lineTo(R, R + 2.5);
  ctx.lineTo(R - 4.5, R + 5);
  ctx.closePath();
  ctx.fill();
}

/* ---------- Main Update Step ---------- */
function update(dt) {
  gameMinutes += dt * 1.5;
  tick(dt);
  const sirenPhase = Math.floor(performance.now() / 160) % 2 === 0;
  for (const v of sirenCars) {
    v.siren[0].visible = sirenPhase;
    v.siren[1].visible = !sirenPhase;
  }
  if (shotCooldown > 0) shotCooldown -= dt;
  if (punchCooldown > 0) punchCooldown -= dt;
  if (toastTimer > 0 && (toastTimer -= dt) <= 0)
    $("toast").style.display = "none";

  // Update bullets, sparks, NPC damage, panic fleeing & knockdown physics
  updateCombat(scene, entities, dt);

  for (let i = tracers.length - 1; i >= 0; i--) {
    tracers[i].life -= dt;
    if (tracers[i].life <= 0) {
      scene.remove(tracers[i].line);
      tracers[i].line.geometry.dispose();
      tracers[i].line.material.dispose();
      tracers.splice(i, 1);
    }
  }
  for (const t of targets) {
    if (!t.active && (t.respawnTimer -= dt) <= 0) {
      t.active = true;
      t.hp = 3;
      t.g.visible = true;
      t.board.material.color.setHex(0xd74a3a);
    }
  }

  if (keys.KeyQ || keys.ArrowLeft) yaw += 1.9 * dt;
  if (keys.ArrowRight) yaw -= 1.9 * dt;
  if (keys.ArrowUp) pitch = clamp(pitch - 1.2 * dt, -0.15, 1.25);
  if (keys.ArrowDown) pitch = clamp(pitch + 1.2 * dt, -0.15, 1.25);

  if (
    activeVehicle &&
    activeVehicle.speed > 1.5 &&
    !keys.ArrowLeft &&
    !keys.ArrowRight &&
    !keys.KeyQ
  ) {
    const want = activeVehicle.yaw + Math.PI;
    yaw +=
      Math.atan2(Math.sin(want - yaw), Math.cos(want - yaw)) *
      (1 - Math.exp(-1.6 * dt));
  }

  if (activeVehicle) {
    updateVehicle(dt, activeVehicle, true);
  } else {
    const ix = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
    const iz = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
    const fx = -Math.sin(yaw),
      fz = -Math.cos(yaw),
      rx = -fz,
      rz = fx;
    let mxv = fx * iz + rx * ix,
      mzv = fz * iz + rz * ix;
    const len = Math.hypot(mxv, mzv);

    const wantsRun = (keys.ShiftLeft || keys.ShiftRight) && len > 0;
    if (wantsRun && stamina > 0) stamina = Math.max(0, stamina - 22 * dt);
    else stamina = Math.min(100, stamina + 14 * dt);

    const spd = wantsRun && stamina > 2 ? 8.8 : 4.7;
    if (len > 0) {
      mxv /= len;
      mzv /= len;
    }
    const k = 1 - Math.exp(-(P.ground ? 12 : 3) * dt);
    P.vx += (mxv * spd * (len > 0 ? 1 : 0) - P.vx) * k;
    P.vz += (mzv * spd * (len > 0 ? 1 : 0) - P.vz) * k;
    P.x = clamp(P.x + P.vx * dt, bounds.x0, bounds.x1);
    P.z = clamp(P.z + P.vz * dt, bounds.z0, bounds.z1);
    collide();

    if (keys.Space && P.ground) {
      P.vy = 9.2;
      P.ground = false;
    }
    P.vy -= 26 * dt;
    P.y += P.vy * dt;
    const fl = floorAt();
    if (P.y <= fl) {
      P.y = fl;
      P.vy = 0;
      P.ground = true;
    } else P.ground = false;

    const sp = Math.hypot(P.vx, P.vz);
    const aimFace = aiming && armed;
    let turnRate = 0;
    if (sp > 0.3 || aimFace) {
      const tr = aimFace ? yaw + Math.PI : Math.atan2(P.vx, P.vz);
      const d = Math.atan2(Math.sin(tr - P.rot), Math.cos(tr - P.rot));
      const step = d * (1 - Math.exp(-14 * dt));
      P.rot += step;
      turnRate = clamp((step / Math.max(dt, 1e-3)) * 0.25, -1.5, 1.5);
    }
    P.turnSmooth += (turnRate - P.turnSmooth) * Math.min(1, dt * 10);

    if (P.ground) P.walkT += dt * sp * 2.2;
    player.animate(P.walkT, sp, P.ground, armed, aiming, {
      velY: P.vy,
      turn: P.turnSmooth,
      lookPitch: aiming ? -pitch * 0.5 : 0,
    });
    player.g.position.set(P.x, P.y, P.z);
    player.g.rotation.y = P.rot;
    player.blob.position.set(P.x, 0.14, P.z);
    player.blob.scale.setScalar(clamp(1 - P.y * 0.12, 0.4, 1));
  }

  for (const v of traffic) updateVehicle(dt, v, false);
  for (const n of pedestrians) {
    // Skip normal sidewalk walk when NPC is knocked out, stunned by a hit, or fleeing gunfire
    if (n.hp <= 0 || n.stun > 0 || n.panic > 0) continue;

    const dx = n.g.position.x - P.x,
      dz = n.g.position.z - P.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 220) continue;
    const scared = keys.KeyH && dist < 12;
    n.wait -= dt;
    if (n.wait <= 0 && !scared && Math.random() < dt * 0.05)
      n.wait = 2 + Math.random() * 3;
    const idle = n.wait > 0 && !scared;
    const sp = idle ? 0 : n.speed * (scared ? 2.8 : 1);

    n.g.position.x += n.dir * sp * dt;
    if (n.g.position.x > n.maxX) {
      n.g.position.x = n.maxX;
      n.dir = -1;
    }
    if (n.g.position.x < n.minX) {
      n.g.position.x = n.minX;
      n.dir = 1;
    }

    const want = idle
      ? dist < 9
        ? Math.atan2(-dx, -dz)
        : 0
      : n.dir > 0
        ? Math.PI / 2
        : -Math.PI / 2;
    n.yaw +=
      Math.atan2(Math.sin(want - n.yaw), Math.cos(want - n.yaw)) *
      (1 - Math.exp(-8 * dt));
    n.g.rotation.y = n.yaw;
    n.phase += dt * (3 + sp * 2.2);
    animateHuman(n.h, n.phase, sp, true);
  }

  if (mission) {
    beacon.rotation.y += dt * 2;
    const dist = Math.hypot(P.x - mission.target.x, P.z - mission.target.z);
    if (dist < 4.5) {
      if (mission.phase === "pickup") {
        let dest = landmarks[Math.floor(Math.random() * landmarks.length)];
        while (dest === mission.target)
          dest = landmarks[Math.floor(Math.random() * landmarks.length)];
        const prev = mission.target;
        mission.phase = "dropoff";
        mission.target = dest;
        mission.reward =
          Math.round(
            (250 + Math.hypot(dest.x - prev.x, dest.z - prev.z) * 1.1) / 10,
          ) * 10;
        beacon.position.set(dest.x, 7, dest.z);
        beacon.material.color.setHex(0x22c55e);
        $("mission-text").textContent = `Drop at ${dest.name}`;
        sfx.cash();
        toast(`Passenger onboard! Drive to ${dest.name}`);
      } else {
        cash += mission.reward;
        sfx.cash();
        toast(`Drop-off Complete! Earned +LKR ${mission.reward}`);
        $("mission-text").textContent = "Press [M] for next Taxi Job";
        beacon.visible = false;
        mission = null;
      }
    }
  }

  let loc = "Lanka Main Road";
  for (const a of areas)
    if (P.x > a.x0 && P.x < a.x1 && P.z > a.z0 && P.z < a.z1) {
      loc = a.name;
      break;
    }
  if (loc !== lastLoc) {
    $("loc").textContent = loc;
    lastLoc = loc;
  }

  if (!activeVehicle) {
    const near = vehicles.some(
      (v) => Math.hypot(P.x - v.root.position.x, P.z - v.root.position.z) < 4.5,
    );
    $("interact").style.display = near ? "block" : "none";
  } else {
    $("interact").style.display = "none";
  }

  const camDist = aiming
    ? 2.3
    : activeVehicle
      ? activeVehicle.type === "bus"
        ? 9.5
        : 6.6
      : 4.8;
  const targetY = P.y + (activeVehicle ? 1.6 : 1.65);
  const sideOffset = aiming ? 0.65 : 0;

  const tx = P.x + Math.cos(yaw) * sideOffset;
  const tz = P.z - Math.sin(yaw) * sideOffset;
  const cx = tx + Math.sin(yaw) * Math.cos(pitch) * camDist;
  let cy = targetY + Math.sin(pitch) * camDist;
  const cz = tz + Math.cos(yaw) * Math.cos(pitch) * camDist;

  for (const c of nearCols(cx, cz, 1)) {
    if (!c.b || cy > c.h) continue;
    if (
      cx > c.x0 - 0.3 &&
      cx < c.x1 + 0.3 &&
      cz > c.z0 - 0.3 &&
      cz < c.z1 + 0.3
    ) {
      cy = Math.max(cy, c.h + 0.4);
    }
  }

  camera.position.set(cx, Math.max(0.45, cy), cz);
  camera.lookAt(tx, targetY, tz);
  sky.position.copy(camera.position);

  if (SHADOWS) {
    const sx = Math.round(P.x / 8) * 8,
      sz = Math.round(P.z / 8) * 8;
    sunL.target.position.set(sx, 0, sz);
    sunL.position.set(sx + SUN.x * 110, SUN.y * 110, sz + SUN.z * 110);
    sunL.target.updateMatrixWorld();
  }

  for (const c of clouds) {
    c.position.x += 1.4 * dt;
    if (c.position.x > 440) c.position.x = -440;
  }

  if ((hudTick += dt) > 0.12) {
    updateHud();
    drawMinimap();
    for (const r of regions)
      r.obj.visible = Math.hypot(r.cx - P.x, r.cz - P.z) < r.r + 340;
    for (const v of traffic)
      v.root.visible =
        Math.hypot(v.root.position.x - P.x, v.root.position.z - P.z) < 340;
    for (const n of pedestrians)
      n.g.visible =
        Math.hypot(n.g.position.x - P.x, n.g.position.z - P.z) < 200;
    hudTick = 0;
  }
}

/* ---------- Render Loop ---------- */
let last = performance.now(),
  frames = 0,
  fpsTimer = 0,
  warm = 0,
  lowCount = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  frames++;
  fpsTimer += dt;
  warm += dt;
  if (fpsTimer >= 0.5) {
    const fps = Math.round(frames / fpsTimer);
    $("fps").textContent = fps + " FPS";
    if (warm > 4) {
      if (fps < 26) {
        if (++lowCount >= 4 && scale > MIN_SCALE) {
          scale = Math.max(MIN_SCALE, scale - 0.1);
          applyRes();
          lowCount = 0;
        }
      } else {
        lowCount = 0;
        if (fps > 52 && scale < MAX_SCALE) {
          scale = Math.min(MAX_SCALE, scale + 0.05);
          applyRes();
        }
      }
    }
    frames = 0;
    fpsTimer = 0;
  }

  if (!paused) update(dt);
  renderer.render(scene, camera);
}
requestAnimationFrame(loop);
