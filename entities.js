// entities.js — Player, gun placement, bullets, NPC damage/panic/death, hit callbacks, vehicles & traffic
import { merge, box, part, solidMat, BOUNDS } from "./world.js";
import {
  buildHuman,
  animateHuman,
  randomOutfit,
  PLAYER_OUTFIT,
} from "./Characters.js";
export { animateHuman };
const THREE = window.THREE;

export function createPlayer(scene) {
  const h = buildHuman(PLAYER_OUTFIT, true);
  const g = h.g;

  // Pistol seated inside h.handR (+Z = barrel forward, +Y = top of slide)
  const pistol = new THREE.Group();
  const slideMat = new THREE.MeshLambertMaterial({ color: 0x2f353d });
  const gripMat = new THREE.MeshLambertMaterial({ color: 0x181a1e });

  const slide = new THREE.Mesh(
    new THREE.BoxGeometry(0.064, 0.068, 0.34),
    slideMat,
  );
  slide.position.set(0, 0.04, 0.11);
  pistol.add(slide);

  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(0.058, 0.034, 0.29),
    gripMat,
  );
  frame.position.set(0, 0.002, 0.09);
  pistol.add(frame);

  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.09), gripMat);
  grip.position.set(0, -0.072, -0.01);
  grip.rotation.x = -0.22;
  pistol.add(grip);

  const muzzleTip = new THREE.Object3D();
  muzzleTip.position.set(0, 0.04, 0.3);
  pistol.add(muzzleTip);

  const flash = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.09, 0),
    new THREE.MeshBasicMaterial({
      color: 0xffd24c,
      transparent: true,
      opacity: 0.92,
    }),
  );
  flash.scale.set(0.8, 0.8, 2.2);
  flash.position.copy(muzzleTip.position);
  flash.visible = false;
  pistol.add(flash);

  pistol.position.set(0, 0.02, 0.01);
  pistol.visible = false;
  (h.handR || h.elbows[1]).add(pistol);

  g.scale.setScalar(0.92);
  scene.add(g);

  const blob = new THREE.Mesh(
    new THREE.CircleGeometry(0.55, 14).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      color: 0,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
    }),
  );
  blob.position.y = 0.14;
  scene.add(blob);

  const state = {
    lastTime: performance.now(),
    wasGrounded: true,
    airTime: 0,
    land: 0,
    punch: 0,
    recoil: 0,
  };

  return {
    g,
    legs: h.legs,
    arms: h.arms,
    handR: h.handR,
    pistol,
    muzzleTip,
    flash,
    blob,
    h,
    state,
    triggerPunch() {
      state.punch = 0.01;
    },
    triggerRecoil() {
      state.recoil = 1.0;
      flash.visible = true;
    },
    animate(t, speed, ground, armed, aiming, extra = {}) {
      const now = performance.now();
      const dt = Math.min(0.05, (now - state.lastTime) * 0.001);
      state.lastTime = now;

      if (!ground) {
        state.airTime += dt;
      } else {
        if (!state.wasGrounded && state.airTime > 0.12) state.land = 1.0;
        state.airTime = 0;
      }
      state.wasGrounded = ground;

      state.land = Math.max(0, state.land - dt * 5.5);
      state.recoil = Math.max(0, state.recoil - dt * 8.5);
      if (state.recoil < 0.65) flash.visible = false;

      if (state.punch > 0) {
        state.punch += dt * 3.6;
        if (state.punch >= 1) state.punch = 0;
      }

      animateHuman(h, t, speed, ground, {
        armed,
        aiming,
        airTime: state.airTime,
        land: extra.land ?? state.land,
        punch: extra.punch ?? state.punch,
        recoil: extra.recoil ?? state.recoil,
        ...extra,
      });
    },
  };
}

/* ---------- COMBAT SYSTEM: Bullets, Hit Particles, NPC Damage & Panic ---------- */
const _tmpPos = new THREE.Vector3();
const _tmpDir = new THREE.Vector3();

function spawnHitSparks(scene, pos, isBlood = true) {
  const mat = new THREE.MeshBasicMaterial({
    color: isBlood ? 0xd91e2a : 0xffd24c,
  });
  const geo = new THREE.BoxGeometry(0.07, 0.07, 0.07);
  const sparks = [];
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(pos);
    scene.add(m);
    sparks.push({
      m,
      vel: new THREE.Vector3(
        (Math.random() - 0.5) * 4.5,
        1.5 + Math.random() * 3,
        (Math.random() - 0.5) * 4.5,
      ),
      life: 0.35,
    });
  }
  return sparks;
}

function alertNearbyNPCs(pedestrians, shooterPos, radius = 32) {
  for (const p of pedestrians) {
    if (p.hp <= 0) continue;
    const dx = p.g.position.x - shooterPos.x;
    const dz = p.g.position.z - shooterPos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < radius && dist > 0.01) {
      p.panic = 6.0; // panic and sprint away for 6 seconds
      p.panicDirX = dx / dist;
      p.panicDirZ = dz / dist;
    }
  }
}

// [CHANGED] Headshot deals instant 100 damage (1-shot down); body shots & punches deal gradual damage
function damageNPC(scene, p, amount, pushX, pushZ, isHeadshot = false) {
  if (p.hp <= 0) return;
  const dmg = isHeadshot ? 100 : amount;
  p.hp = Math.max(0, p.hp - dmg);
  p.stun = 0.45;
  p.flashTimer = 0.16;
  p.vel.x += pushX;
  p.vel.z += pushZ;
  p.vel.y = isHeadshot ? 3.4 : 1.4;

  // Flash NPC meshes red on hit
  p.g.traverse((ch) => {
    if (ch.isMesh && ch.material) {
      if (!ch.userData.origMat) ch.userData.origMat = ch.material;
      ch.material = new THREE.MeshBasicMaterial({ color: 0xff3b3b });
    }
  });

  if (p.hp <= 0) {
    p.downTimer = 8.0; // stays down for 8 seconds before recovering
  }
}

// Call when player shoots (left click / fire button)
export function shootGun(scene, player, entities) {
  player.triggerRecoil();
  player.g.updateMatrixWorld(true);

  player.muzzleTip.getWorldPosition(_tmpPos);
  const yaw = player.g.rotation.y;
  _tmpDir.set(Math.sin(yaw), 0, Math.cos(yaw)).normalize();

  // Scare nearby pedestrians
  alertNearbyNPCs(entities.pedestrians, player.g.position, 35);

  // Create visible glowing bullet tracer
  const bulletMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.06, 0.55),
    new THREE.MeshBasicMaterial({ color: 0xffe46b }),
  );
  bulletMesh.position.copy(_tmpPos);
  bulletMesh.rotation.y = yaw;
  scene.add(bulletMesh);

  entities.bullets.push({
    mesh: bulletMesh,
    pos: _tmpPos.clone(),
    vel: _tmpDir.clone().multiplyScalar(65),
    life: 0.9,
  });
}

// Call when player punches without a gun
export function punchAttack(scene, player, entities, onHit = null) {
  player.triggerPunch();
  const origin = player.g.position;
  const yaw = player.g.rotation.y;
  const fwdX = Math.sin(yaw),
    fwdZ = Math.cos(yaw);

  for (const p of entities.pedestrians) {
    if (p.hp <= 0) continue;
    const dx = p.g.position.x - origin.x;
    const dz = p.g.position.z - origin.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 2.1 || dist < 0.01) continue;
    const dot = (dx * fwdX + dz * fwdZ) / dist;
    if (dot > 0.45) {
      damageNPC(scene, p, 20, fwdX * 6.0, fwdZ * 6.0, false);
      entities.sparks.push(
        ...spawnHitSparks(scene, p.g.position.clone().setY(1.2), true),
      );
      alertNearbyNPCs(entities.pedestrians, origin, 18);
      if (onHit) onHit(false);
      break;
    }
  }
}

// Call every frame in your game loop: updateCombat(scene, entities, dt, onHit)
export function updateCombat(scene, entities, dt, onHit = null) {
  // 1. Update bullets & check hits on NPCs and targets
  for (let i = entities.bullets.length - 1; i >= 0; i--) {
    const b = entities.bullets[i];
    const step = b.vel.clone().multiplyScalar(dt);
    b.pos.add(step);
    b.mesh.position.copy(b.pos);
    b.life -= dt;

    let hit = false;

    // Check NPC hits
    for (const p of entities.pedestrians) {
      if (p.hp <= 0) continue;
      const dx = b.pos.x - p.g.position.x;
      const dz = b.pos.z - p.g.position.z;
      if (dx * dx + dz * dz < 0.34 && b.pos.y >= 0.1 && b.pos.y <= 1.85) {
        const isHeadshot = b.pos.y >= 1.5;
        const dir = b.vel.clone().normalize();
        damageNPC(scene, p, 50, dir.x * 7.5, dir.z * 7.5, isHeadshot);
        entities.sparks.push(...spawnHitSparks(scene, b.pos, true));
        if (onHit) onHit(isHeadshot);
        hit = true;
        break;
      }
    }

    // Check shooting range targets
    if (!hit) {
      for (const tgt of entities.targets) {
        if (!tgt.active) continue;
        const dx = b.pos.x - tgt.g.position.x;
        const dz = b.pos.z - tgt.g.position.z;
        if (dx * dx + dz * dz < 0.45 && b.pos.y >= 0.8 && b.pos.y <= 2.0) {
          tgt.hp -= 1;
          entities.sparks.push(...spawnHitSparks(scene, b.pos, false));
          if (tgt.hp <= 0) {
            tgt.active = false;
            tgt.g.visible = false;
            tgt.respawnTimer = 5;
          }
          hit = true;
          break;
        }
      }
    }

    if (hit || b.life <= 0) {
      scene.remove(b.mesh);
      entities.bullets.splice(i, 1);
    }
  }

  // 2. Update hit sparks
  for (let i = entities.sparks.length - 1; i >= 0; i--) {
    const s = entities.sparks[i];
    s.m.position.addScaledVector(s.vel, dt);
    s.vel.y -= 12 * dt;
    s.life -= dt;
    if (s.life <= 0) {
      scene.remove(s.m);
      entities.sparks.splice(i, 1);
    }
  }

  // 3. Update NPC damage, hit-flash recovery, panic fleeing, and knockdown physics
  for (const p of entities.pedestrians) {
    // Restore original material after red hit flash
    if (p.flashTimer > 0) {
      p.flashTimer -= dt;
      if (p.flashTimer <= 0) {
        p.g.traverse((ch) => {
          if (ch.isMesh && ch.userData.origMat)
            ch.material = ch.userData.origMat;
        });
      }
    }

    // Knockback & gravity
    if (p.vel.lengthSq() > 0.001 || p.g.position.y > 0) {
      p.g.position.addScaledVector(p.vel, dt);
      p.vel.x *= Math.max(0, 1 - dt * 6);
      p.vel.z *= Math.max(0, 1 - dt * 6);
      if (p.g.position.y > 0 || p.vel.y > 0) {
        p.vel.y -= 18 * dt;
        if (p.g.position.y <= 0) {
          p.g.position.y = 0;
          p.vel.y = 0;
        }
      }
    }
    if (p.g.position.y < 0) {
      p.g.position.y = 0;
      p.vel.y = 0;
    }

    // Dead / Knocked out state
    if (p.hp <= 0) {
      p.downTimer -= dt;
      p.g.position.y = THREE.MathUtils.lerp(
        p.g.position.y,
        0.24,
        Math.min(1, dt * 10),
      );
      p.g.rotation.x = THREE.MathUtils.lerp(
        p.g.rotation.x,
        -Math.PI / 2,
        Math.min(1, dt * 10),
      );
      animateHuman(p.h, 0, 0, true, { dead: true });
      if (p.downTimer <= 0) {
        p.hp = 100;
        p.panic = 0;
        p.g.position.y = 0;
        p.g.rotation.x = 0;
      }
      continue;
    }

    p.g.rotation.x = THREE.MathUtils.lerp(
      p.g.rotation.x,
      0,
      Math.min(1, dt * 10),
    );
    if (p.vel.y === 0) p.g.position.y = 0;

    // Stunned flinch
    if (p.stun > 0) {
      p.stun -= dt;
      animateHuman(p.h, p.phase, 0, p.g.position.y <= 0.01, { hit: true });
      continue;
    }

    // Panic flee behavior when shots are fired nearby
    if (p.panic > 0) {
      p.panic -= dt;
      // [ADDED] Keep panicking NPC upright and planted at ground level (y = 0)
      p.g.position.y = 0;
      p.g.rotation.x = 0;
      const runSpeed = 4.6;
      p.g.position.x = Math.max(
        BOUNDS.x0 + 10,
        Math.min(BOUNDS.x1 - 10, p.g.position.x + p.panicDirX * runSpeed * dt),
      );
      p.g.position.z = Math.max(
        BOUNDS.z0 + 10,
        Math.min(BOUNDS.z1 - 10, p.g.position.z + p.panicDirZ * runSpeed * dt),
      );
      p.yaw = Math.atan2(p.panicDirX, p.panicDirZ);
      p.g.rotation.y = p.yaw;
      p.phase += runSpeed * dt * 2.4;
      animateHuman(p.h, p.phase, runSpeed, true, { panic: true });
    }
  }
}

const shade = (hex, f) => new THREE.Color(hex).multiplyScalar(f).getHex();
const RAD = Math.PI / 2;

const wheelGeos = {};
function wheelGeo(r, w) {
  const k = r + "_" + w;
  if (!wheelGeos[k]) {
    const P = [
      part(new THREE.CylinderGeometry(r, r, w, 14), 0x1b1d20, 0, 0, 0, {
        rz: RAD,
      }),
      part(
        new THREE.CylinderGeometry(r * 0.64, r * 0.64, w + 0.02, 10),
        0xc5ccd3,
        0,
        0,
        0,
        { rz: RAD },
      ),
      part(
        new THREE.CylinderGeometry(r * 0.2, r * 0.2, w + 0.05, 6),
        0x6b7280,
        0,
        0,
        0,
        { rz: RAD },
      ),
    ];
    for (let i = 0; i < 3; i++)
      P.push(
        box(w + 0.035, r * 0.11, r * 1.15, 0x7b8490, 0, 0, 0, {
          rx: (i * Math.PI) / 3,
        }),
      );
    wheelGeos[k] = merge(P);
  }
  return wheelGeos[k];
}

export function makeVehicle(scene, type, color) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const P = [];
  const ab = (w, h, d, col, x, y, z, o) =>
    P.push(box(w, h, d, col, x, y, z, o || {}));
  const cy = (rt, rb, h, seg, col, x, y, z, o) =>
    P.push(
      part(new THREE.CylinderGeometry(rt, rb, h, seg), col, x, y, z, o || {}),
    );
  const DARK = 0x202428,
    GLASS = 0x8ccbe0,
    LIGHT = 0xfff3b0,
    TAIL = 0xd7263d,
    CHROME = 0xbfc5cb,
    BLACK = 0x15171a;
  const trim = shade(color, 0.7);
  let wheelDefs = [],
    siren = null;

  const sedan = () => {
    ab(1.86, 0.46, 3.9, color, 0, 0.56, 0);
    ab(1.88, 0.05, 3.9, trim, 0, 0.8, 0);
    ab(1.8, 0.1, 1.15, color, 0, 0.85, 1.3, { rx: 0.09 });
    ab(1.8, 0.1, 0.9, color, 0, 0.85, -1.45, { rx: -0.05 });
    ab(1.62, 0.44, 1.6, GLASS, 0, 1.1, -0.3);
    ab(1.56, 0.5, 0.06, GLASS, 0, 1.12, 0.62, { rx: -0.55 });
    ab(1.56, 0.46, 0.06, GLASS, 0, 1.1, -1.2, { rx: 0.6 });
    ab(1.58, 0.07, 1.75, color, 0, 1.36, -0.25);
    for (const sx of [-0.8, 0.8]) {
      ab(0.07, 0.5, 0.07, color, sx, 1.12, 0.62, { rx: -0.55 });
      ab(0.08, 0.44, 0.09, color, sx * 1.01, 1.1, -0.3);
      ab(0.1, 0.46, 0.12, color, sx, 1.1, -1.2, { rx: 0.6 });
    }
    ab(1.9, 0.2, 0.2, 0x2b2f33, 0, 0.36, 1.97);
    ab(1.9, 0.2, 0.2, 0x2b2f33, 0, 0.36, -1.97);
    ab(0.9, 0.14, 0.05, CHROME, 0, 0.62, 1.96);
    for (const sx of [-1, 1]) {
      ab(0.34, 0.15, 0.1, LIGHT, sx * 0.66, 0.68, 1.95);
      ab(0.38, 0.14, 0.08, TAIL, sx * 0.64, 0.7, -1.95);
      ab(0.2, 0.1, 0.12, color, sx * 1.0, 0.98, 0.45);
      ab(0.02, 0.44, 0.025, BLACK, sx * 0.935, 0.56, 0.45);
      ab(0.02, 0.44, 0.025, BLACK, sx * 0.935, 0.56, -0.5);
      ab(0.03, 0.03, 0.14, CHROME, sx * 0.94, 0.72, 0.1);
      ab(0.03, 0.03, 0.14, CHROME, sx * 0.94, 0.72, -0.8);
      for (const wz of [1.28, -1.28])
        cy(0.43, 0.43, 0.05, 12, BLACK, sx * 0.935, 0.36, wz, { rz: RAD });
    }
    ab(0.5, 0.13, 0.03, 0xf2f2f2, 0, 0.44, 2.0);
    ab(0.5, 0.13, 0.03, 0xf2f2f2, 0, 0.44, -2.0);
    wheelDefs = [
      [-0.93, 0.36, 1.28, 0.36, 0.24, 1],
      [0.93, 0.36, 1.28, 0.36, 0.24, 1],
      [-0.93, 0.36, -1.28, 0.36, 0.24, 0],
      [0.93, 0.36, -1.28, 0.36, 0.24, 0],
    ];
  };

  if (type === "car" || type === "police") {
    sedan();
    if (type === "police") {
      ab(1.88, 0.12, 3.92, 0x1d4ed8, 0, 0.6, 0);
      ab(0.96, 0.08, 0.32, 0x1a1a1a, 0, 1.43, -0.3);
      ab(0.4, 0.14, 0.05, 0x1d4ed8, 0, 0.86, 1.62, { rx: 0.09 });
    }
  } else if (type === "tuk") {
    ab(1.2, 0.12, 2.1, 0x2a2a2a, 0, 0.3, 0);
    ab(1.38, 0.62, 1.5, color, 0, 0.7, -0.3);
    ab(1.39, 0.08, 1.51, trim, 0, 0.99, -0.3);
    ab(0.96, 0.6, 0.8, color, 0, 0.72, 0.62);
    cy(0.48, 0.48, 0.62, 10, color, 0, 0.74, 0.98);
    ab(0.26, 0.06, 0.55, color, 0, 0.6, 1.2);
    cy(0.13, 0.13, 0.1, 10, LIGHT, 0, 0.95, 1.25, { rx: RAD });
    ab(0.98, 0.55, 0.05, GLASS, 0, 1.3, 0.45, { rx: -0.25 });
    ab(0.7, 0.04, 0.04, 0x2a2a2a, 0, 1.03, 0.8);
    for (const sx of [-1, 1]) {
      cy(0.03, 0.03, 0.12, 6, 0x111111, sx * 0.38, 1.03, 0.8, { rz: RAD });
      ab(0.1, 0.07, 0.02, CHROME, sx * 0.42, 1.14, 0.8);
      ab(0.04, 0.2, 1.5, trim, sx * 0.68, 1.1, -0.3);
      ab(0.06, 0.9, 0.06, color, sx * 0.66, 1.35, 0.5);
      ab(0.06, 0.9, 0.06, color, sx * 0.66, 1.35, -1.0);
      ab(0.12, 0.1, 0.04, TAIL, sx * 0.5, 0.82, -1.07);
    }
    ab(0.8, 0.1, 0.5, 0x3a2a1e, 0, 0.88, 0.2);
    ab(0.8, 0.4, 0.08, 0x3a2a1e, 0, 1.08, -0.05);
    ab(1.2, 0.1, 0.55, 0x3a2a1e, 0, 0.9, -0.7);
    ab(1.2, 0.45, 0.08, 0x3a2a1e, 0, 1.12, -1.0);
    ab(1.44, 0.1, 1.9, DARK, 0, 1.82, -0.25);
    ab(1.2, 0.08, 0.32, DARK, 0, 1.8, 0.82, { rx: 0.2 });
    ab(0.32, 0.12, 0.02, 0xf2f2f2, 0, 0.62, -1.08);
    wheelDefs = [
      [0, 0.28, 1.05, 0.28, 0.16, 1],
      [-0.74, 0.28, -0.68, 0.28, 0.18, 0],
      [0.74, 0.28, -0.68, 0.28, 0.18, 0],
    ];
  } else {
    const cream = 0xeeeee8;
    ab(2.3, 1.0, 5.8, color, 0, 0.72, 0);
    ab(2.3, 0.95, 5.8, color, 0, 1.7, 0);
    ab(2.34, 0.2, 5.84, 0xf5c518, 0, 1.2, 0);
    ab(2.34, 0.1, 5.84, 0xffffff, 0, 0.96, 0);
    ab(2.32, 0.14, 5.9, cream, 0, 2.25, 0);
    ab(0.6, 0.1, 0.9, 0xd6d6d0, 0, 2.37, 1.0);
    ab(0.6, 0.1, 0.9, 0xd6d6d0, 0, 2.37, -1.2);
    for (const sx of [-0.52, 0.52]) ab(1.0, 0.8, 0.06, GLASS, sx, 1.72, 2.9);
    ab(0.06, 0.8, 0.08, color, 0, 1.72, 2.91);
    ab(1.4, 0.22, 0.06, 0xffd54a, 0, 2.1, 2.92);
    ab(0.9, 0.06, 0.07, 0x222222, 0, 2.1, 2.93);
    ab(1.3, 0.4, 0.06, 0x2a2a2a, 0, 0.6, 2.92);
    ab(1.3, 0.04, 0.07, CHROME, 0, 0.8, 2.93);
    ab(2.36, 0.2, 0.22, 0x3a3a3a, 0, 0.3, 2.95);
    ab(2.36, 0.2, 0.22, 0x3a3a3a, 0, 0.3, -2.95);
    ab(0.5, 0.14, 0.03, 0xf2f2f2, 0, 0.3, 3.07);
    ab(1.6, 0.6, 0.06, GLASS, 0, 1.8, -2.92);
    for (const sx of [-1, 1]) {
      cy(0.16, 0.16, 0.1, 10, LIGHT, sx * 0.8, 0.62, 2.92, { rx: RAD });
      ab(0.14, 0.1, 0.06, 0xffa000, sx * 1.0, 0.9, 2.92);
      ab(0.2, 0.16, 0.06, TAIL, sx * 0.9, 0.8, -2.93);
      ab(0.5, 0.04, 0.04, 0x222222, sx * 1.4, 1.7, 2.7);
      ab(0.08, 0.4, 0.2, CHROME, sx * 1.65, 1.7, 2.7);
      for (let j = 0; j < 4; j++)
        ab(0.04, 0.62, 0.9, GLASS, sx * 1.16, 1.78, -1.8 + j * 1.2);
      for (const wz of [2.05, -2.05])
        cy(0.55, 0.55, 0.05, 12, BLACK, sx * 1.15, 0.44, wz, { rz: RAD });
    }
    ab(0.05, 1.6, 0.9, 0x2b4a5c, 1.17, 1.0, 1.9);
    ab(0.05, 0.8, 0.04, 0xf5c518, 1.2, 1.0, 1.5);
    wheelDefs = [
      [-1.14, 0.44, 2.05, 0.44, 0.3, 1],
      [1.14, 0.44, 2.05, 0.44, 0.3, 1],
      [-1.14, 0.44, -2.05, 0.44, 0.3, 0],
      [1.14, 0.44, -2.05, 0.44, 0.3, 0],
    ];
  }
  body.add(new THREE.Mesh(merge(P), solidMat));

  if (type === "police") {
    const mk = (c, x) => {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(0.34, 0.12, 0.26),
        new THREE.MeshBasicMaterial({ color: c }),
      );
      m.position.set(x, 1.5, -0.3);
      body.add(m);
      return m;
    };
    siren = [mk(0xff2a2a, -0.22), mk(0x2a6bff, 0.22)];
  }

  const wheels = [],
    frontWheels = [];
  for (const [x, y, z, r, w, front] of wheelDefs) {
    const m = new THREE.Mesh(wheelGeo(r, w), solidMat);
    m.position.set(x, y, z);
    m.rotation.order = "YXZ";
    root.add(m);
    wheels.push(m);
    if (front) frontWheels.push(m);
  }

  scene.add(root);
  return {
    root,
    body,
    type,
    speed: 0,
    yaw: Math.PI / 2,
    wheels,
    frontWheels,
    siren,
    color,
    steer: 0,
    _ps: 0,
    radius: type === "bus" ? 2.6 : type === "tuk" ? 1.15 : 1.7,
  };
}

export function spawnWorldEntities(scene) {
  const vehicles = [];
  const traffic = [];
  const pedestrians = [];
  const targets = [];
  const bullets = [];
  const sparks = [];

  const addDriveable = (type, x, z, color, yaw = Math.PI / 2) => {
    const v = makeVehicle(scene, type, color);
    v.root.position.set(x, 0, z);
    v.yaw = yaw;
    v.root.rotation.y = yaw;
    vehicles.push(v);
    return v;
  };

  addDriveable("tuk", -4, 5.8, 0xf6b800);
  addDriveable("tuk", 26, -6.4, 0xd0342c);
  addDriveable("tuk", 20, -24, 0x139a5b, 0);
  addDriveable("car", -92, 5.9, 0x2a6fb5);
  addDriveable("police", -70, -6.1, 0xf2f4f6);
  addDriveable("bus", -34, 5.8, 0xb91c1c);
  addDriveable("tuk", 235, 5.8, 0xf6b800);
  addDriveable("bus", 238, -6.2, 0xb91c1c);
  addDriveable("tuk", -60, -267.5, 0xd0342c);
  addDriveable("tuk", -230, 205.5, 0x139a5b);
  addDriveable("car", 160, 205.5, 0x2a6fb5);

  // NPCs built with detail=true so their knees, elbows, and heads react to gunfire & hits
  // [CHANGED] Spawn NPCs with zone-specific dress codes ("normal", "beach", "temple")
  const addPed = (x, z, minX, maxX, zone = "normal") => {
    const o = randomOutfit(zone);
    const h = buildHuman(o, true);
    h.g.scale.setScalar(0.92 * (o.scale || 1));
    h.g.position.set(x, 0, z);
    scene.add(h.g);
    const dir = Math.random() < 0.5 ? 1 : -1;
    pedestrians.push({
      g: h.g,
      h,
      legs: h.legs,
      dir,
      phase: Math.random() * 6.28,
      minX,
      maxX,
      speed: 0.9 + Math.random() * 0.7,
      wait: Math.random() * 6,
      yaw: dir > 0 ? Math.PI / 2 : -Math.PI / 2,
      hp: 100,
      vel: new THREE.Vector3(),
      stun: 0,
      panic: 0,
      panicDirX: 1,
      panicDirZ: 0,
      downTimer: 0,
      flashTimer: 0,
    });
  };

  // [ADDED] Helper to create a floating 3D speech bubble above an NPC's head
  const createSpeechSprite = (text) => {
    const cv = document.createElement("canvas");
    cv.width = 512;
    cv.height = 128;
    const ctx = cv.getContext("2d");

    // Rounded dark pill background with gold border
    ctx.fillStyle = "rgba(15, 23, 42, 0.88)";
    ctx.beginPath();
    ctx.roundRect(12, 16, 488, 76, 24);
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#facc15";
    ctx.stroke();

    // Speech bubble pointer triangle
    ctx.fillStyle = "rgba(15, 23, 42, 0.88)";
    ctx.beginPath();
    ctx.moveTo(240, 92);
    ctx.lineTo(272, 92);
    ctx.lineTo(256, 116);
    ctx.closePath();
    ctx.fill();

    // Yell text
    ctx.fillStyle = "#fef08a";
    ctx.font = "bold 28px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 256, 54);

    const tex = new THREE.CanvasTexture(cv);
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthTest: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(2.8, 0.7, 1);
    sprite.position.set(0, 2.15, 0);
    sprite.visible = false;
    return sprite;
  };

  // [ADDED] Wade Cart Vendor at Mirissa Beach (standing behind cart at x: 145, z: 246.7)
  const vendorOutfit = {
    skin: 0x8a5a3c,
    female: false,
    hair: 0x15110d,
    hairStyle: "short",
    shirt: 0xf8fafc,
    sleeve: "short",
    bottom: "sarong",
    sarong: 0x2f6f4f,
    barefoot: true,
    scale: 1.0,
  };
  const vh = buildHuman(vendorOutfit, true);
  vh.g.scale.setScalar(0.94);
  vh.g.position.set(145, 0, 246.7);
  const speech = createSpeechSprite("Wade wade wade isso wadeee!");
  vh.g.add(speech);
  scene.add(vh.g);

  pedestrians.push({
    g: vh.g,
    h: vh,
    legs: vh.legs,
    dir: 1,
    phase: 0,
    minX: 144,
    maxX: 146,
    speed: 0,
    wait: 999,
    yaw: 0,
    hp: 100,
    vel: new THREE.Vector3(),
    stun: 0,
    panic: 0,
    panicDirX: 1,
    panicDirZ: 0,
    downTimer: 0,
    flashTimer: 0,
    isVendor: true,
    homeX: 145,
    homeZ: 246.7,
    yellTimer: 1.5,
    yellAnim: 0,
    speech,
  });

  for (let i = 0; i < 20; i++)
    addPed(
      -340 + i * 34,
      i % 2 ? 7.6 : -7.6,
      BOUNDS.x0 + 14,
      BOUNDS.x1 - 14,
      "normal",
    );
  for (let i = 0; i < 6; i++)
    addPed(190 + i * 28, i % 2 ? 7.6 : -7.6, 190, BOUNDS.x1 - 14, "normal");
  for (let i = 0; i < 7; i++)
    addPed(-110 + i * 40, i % 2 ? -254.4 : -269.6, -125, 185, "normal");
  for (let i = 0; i < 6; i++)
    addPed(
      -320 + i * 120,
      i % 2 ? 207.6 : 192.4,
      BOUNDS.x0 + 14,
      BOUNDS.x1 - 14,
      "normal",
    );
  for (let i = 0; i < 10; i++)
    addPed(75 + i * 26, 266 + (i % 3) * 8, 66, 336, "beach");
  // [ADDED] White-dressed temple visitors at Sacred Stupa (-55, -34) and Temple of the Tooth (80, -280)
  for (let i = 0; i < 5; i++)
    addPed(-64 + i * 4.5, -33 + (i % 2) * 2, -68, -42, "temple");
  for (let i = 0; i < 6; i++)
    addPed(62 + i * 7, -280 + (i % 2) * 3, 56, 104, "temple");

  const makeTraffic = (type, x, z, dir, color) => {
    const v = makeVehicle(scene, type, color);
    v.root.position.set(x, 0, z);
    v.yaw = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    v.root.rotation.y = v.yaw;
    v.dir = dir;
    v.cruise = type === "bus" ? 4.2 : type === "tuk" ? 5.2 : 6.4;
    traffic.push(v);
  };
  for (let i = 0; i < 9; i++) {
    makeTraffic(
      i === 5 ? "police" : i % 3 === 0 ? "tuk" : "car",
      -330 + i * 72,
      -2.35,
      1,
      i === 5 ? 0xf2f4f6 : [0xd0342c, 0x2a6fb5, 0xe6e6e6, 0x3c9a55][i % 4],
    );
    makeTraffic(
      i === 2 ? "police" : i % 3 === 1 ? "bus" : "car",
      330 - i * 72,
      2.35,
      -1,
      i === 2 ? 0xf2f4f6 : [0xb91c1c, 0xd9d9d9, 0xe0b52b][i % 3],
    );
  }
  for (let i = 0; i < 3; i++) {
    makeTraffic(
      i === 1 ? "bus" : "tuk",
      -250 + i * 180,
      197.65,
      1,
      [0xf6b800, 0xb91c1c, 0x139a5b][i],
    );
    makeTraffic(
      i === 0 ? "bus" : "car",
      250 - i * 180,
      202.35,
      -1,
      [0xb91c1c, 0xe6e6e6, 0x2a6fb5][i],
    );
  }

  const targetMat = new THREE.MeshLambertMaterial({ color: 0xd74a3a });
  for (let i = 0; i < 5; i++) {
    const g = new THREE.Group();
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 1.4, 0.12),
      new THREE.MeshLambertMaterial({ color: 0x65452c }),
    );
    post.position.y = 0.7;
    g.add(post);
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(0.95, 0.95, 0.14),
      targetMat.clone(),
    );
    board.position.y = 1.4;
    g.add(board);
    g.position.set(82 + i * 4.5, 0, -45);
    scene.add(g);
    targets.push({ g, board, hp: 3, active: true, respawnTimer: 0 });
  }

  return { vehicles, traffic, pedestrians, targets, bullets, sparks };
}
