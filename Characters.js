// Characters.js — realistic low-poly rigged humans (player + interactive NPCs)
import { merge, box, part, solidMat } from "./world.js";
const THREE = window.THREE;

export const SKINS = [0xb07a52, 0x9b6847, 0x7d5336, 0xc79a73, 0x8a5a3c];
const HEMI = new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
const cyl = (rt, rb, h, seg, col, x, y, z, o) =>
  part(new THREE.CylinderGeometry(rt, rb, h, seg), col, x, y, z, o);
const sph = (r, col, x, y, z, s) =>
  part(new THREE.SphereGeometry(r, 10, 8), col, x, y, z, { s: s || [1, 1, 1] });
const shade = (hex, f) => new THREE.Color(hex).multiplyScalar(f).getHex();
const pick = (a) => a[(Math.random() * a.length) | 0];
const mesh = (parts, parent) => {
  const m = new THREE.Mesh(merge(parts), solidMat);
  parent.add(m);
  return m;
};

export function buildHuman(o, detail = true) {
  const skin = o.skin,
    skinD = shade(skin, 0.82),
    skinL = shade(skin, 1.06);
  const shirt = o.shirt,
    shirtD = shade(shirt, 0.85);
  const pantsC = o.pants ?? 0x333333,
    pantsD = shade(pantsC, 0.82);
  const hairC = o.hair ?? 0x1a1410;
  const female = !!o.female,
    bottom = o.bottom || "pants";
  const skirtLike =
    bottom === "sarong" || bottom === "skirt" || bottom === "saree";
  const g = new THREE.Group();
  const hipY = 0.96;

  /* ---- static lower garment (sarong / skirt / saree) ---- */
  if (skirtLike) {
    const S = [];
    if (bottom === "sarong") {
      S.push(cyl(0.22, 0.26, 0.72, 12, o.sarong, 0, 0.6, 0));
      for (const y of [0.34, 0.5, 0.66])
        S.push(cyl(0.258, 0.258, 0.03, 12, shade(o.sarong, 0.62), 0, y, 0));
    } else if (bottom === "skirt") {
      S.push(cyl(0.21, 0.31, 0.5, 12, o.skirt, 0, 0.72, 0));
    } else {
      S.push(cyl(0.215, 0.31, 0.84, 12, o.saree, 0, 0.55, 0));
      S.push(cyl(0.315, 0.315, 0.05, 12, 0xe6b422, 0, 0.17, 0));
    }
    mesh(S, g);
  }

  /* ---- legs & shaped footwear ---- */
  const legs = [],
    knees = [];
  const shoe = o.shoes ?? 0xf2f2f2,
    soleCol = shade(shoe, 0.42);
  const shoeH = o.sandals ? 0.03 : 0.075;
  const thighCol = bottom === "pants" || bottom === "shorts" ? pantsC : skin;
  const shinCol = bottom === "pants" ? pantsD : skin;

  const buildFoot = (yBottom) => {
    const F = [
      box(0.125, 0.02, 0.27, soleCol, 0, yBottom + 0.01, 0.045),
      box(
        0.12,
        shoeH - 0.015,
        0.25,
        shoe,
        0,
        yBottom + 0.018 + (shoeH - 0.015) / 2,
        0.04,
      ),
    ];
    if (!o.sandals) {
      F.push(
        box(
          0.112,
          shoeH * 0.65,
          0.09,
          shoe,
          0,
          yBottom + 0.018 + shoeH * 0.3,
          0.165,
        ),
      );
    } else {
      F.push(box(0.126, 0.018, 0.045, shoe, 0, yBottom + 0.038, 0.085));
    }
    return F;
  };

  for (const s of [-1, 1]) {
    const lg = new THREE.Group();
    lg.rotation.order = "YXZ"; // [ADDED] Apply Y-turn before X-swing so knees always bend forward cleanly
    lg.position.set(s * (female ? 0.105 : 0.115), hipY, 0);
    g.add(lg);

    if (detail) {
      mesh(
        [
          sph(0.092, thighCol, 0, -0.02, 0),
          cyl(0.096, 0.076, 0.45, 8, thighCol, 0, -0.23, 0),
          sph(0.078, thighCol, 0, -0.46, 0),
        ],
        lg,
      );

      const kn = new THREE.Group();
      kn.position.y = -0.46;
      lg.add(kn);

      mesh(
        [cyl(0.074, 0.048, 0.44, 8, shinCol, 0, -0.22, 0), ...buildFoot(-0.5)],
        kn,
      );
      knees.push(kn);
    } else {
      const L = [];
      if (bottom === "shorts") {
        L.push(
          cyl(0.095, 0.082, 0.4, 7, pantsC, 0, -0.2, 0),
          cyl(0.07, 0.048, 0.53, 7, skin, 0, -0.665, 0),
        );
      } else {
        L.push(cyl(0.095, 0.05, 0.93, 7, thighCol, 0, -0.465, 0));
      }
      L.push(...buildFoot(-0.96));
      mesh(L, lg);
    }
    legs.push(lg);
  }

  /* ---- upper body (realistic V-taper torso, shoulders, neck) ---- */
  const upper = new THREE.Group();
  upper.position.y = hipY;
  g.add(upper);

  const cw = female ? 0.41 : 0.48;
  const ww = female ? 0.34 : 0.41;
  const T = [];
  T.push(box(0.39, 0.14, 0.23, skirtLike ? skin : pantsC, 0, -0.01, 0)); // pelvis
  T.push(box(ww + 0.02, 0.18, 0.24, shirtD, 0, 0.12, 0)); // waist
  if (bottom === "pants" || bottom === "shorts") {
    T.push(box(ww + 0.025, 0.032, 0.248, 0x241f1c, 0, 0.02, 0)); // belt
    T.push(box(0.05, 0.04, 0.02, 0xd4af37, 0, 0.02, 0.126)); // buckle
  }
  T.push(box(cw, 0.34, 0.26, shirt, 0, 0.36, 0)); // chest
  T.push(box(cw + 0.06, 0.11, 0.265, shirt, 0, 0.56, 0)); // shoulders
  T.push(cyl(0.054, 0.068, 0.11, 8, skinD, 0, 0.65, 0)); // neck

  if (o.pattern === "floral") {
    const fl = [0xff7aa8, 0xffd84d, 0xffffff, 0xff9f43];
    for (let i = 0; i < 16; i++)
      T.push(
        box(
          0.048,
          0.048,
          0.012,
          pick(fl),
          (Math.random() - 0.5) * (cw - 0.04),
          0.18 + Math.random() * 0.36,
          0.136,
        ),
      );
    for (let i = 0; i < 12; i++)
      T.push(
        box(
          0.048,
          0.048,
          0.012,
          pick(fl),
          (Math.random() - 0.5) * (cw - 0.04),
          0.18 + Math.random() * 0.36,
          -0.136,
        ),
      );
  }
  if (o.collar) {
    T.push(box(0.09, 0.12, 0.02, skin, 0, 0.55, 0.135));
    for (const s of [-1, 1])
      T.push(box(0.065, 0.09, 0.028, o.collar, s * 0.07, 0.59, 0.138));
  }
  if (o.tie) {
    T.push(
      box(0.044, 0.28, 0.02, o.tie, 0, 0.42, 0.14),
      box(0.062, 0.045, 0.028, o.tie, 0, 0.56, 0.14),
    );
  }
  if (bottom === "saree") {
    T.push(
      box(0.12, 0.66, 0.3, o.saree, 0.03, 0.38, 0, { rz: -0.5 }),
      box(0.038, 0.66, 0.305, 0xe6b422, 0.03, 0.38, 0, { rz: -0.5 }),
    );
  }
  mesh(T, upper);

  /* ---- realistic adult-proportioned head (pivots at neck) ---- */
  const head = new THREE.Group();
  head.position.set(0, 0.69, 0);
  upper.add(head);

  const H = [];
  H.push(
    part(new THREE.SphereGeometry(0.138, 14, 10), skin, 0, 0.155, 0, {
      s: [0.92, 1.15, 1.02],
    }),
  ); // cranium
  H.push(box(0.145, 0.085, 0.15, skin, 0, 0.075, 0.015)); // jawline
  for (const s of [-1, 1]) {
    H.push(sph(0.03, skinD, s * 0.128, 0.15, -0.01, [0.45, 1, 1])); // ears
    H.push(box(0.038, 0.022, 0.016, 0xffffff, s * 0.048, 0.168, 0.134)); // sclera
    H.push(box(0.02, 0.02, 0.018, 0x1a1208, s * 0.048, 0.168, 0.138)); // pupil
    H.push(
      box(0.048, 0.012, 0.018, hairC, s * 0.048, 0.196, 0.136, {
        rz: -s * 0.06,
      }),
    ); // brow
  }
  H.push(box(0.026, 0.052, 0.036, skinD, 0, 0.136, 0.146, { rx: -0.15 })); // nose bridge
  H.push(box(0.024, 0.02, 0.032, skinL, 0, 0.118, 0.152)); // nose tip
  H.push(box(0.052, 0.012, 0.016, 0x7a2e2e, 0, 0.084, 0.134)); // mouth

  const hs = o.hairStyle || "short";
  if (hs === "cap") {
    const cc = o.capCol ?? 0x2f6fb5;
    H.push(
      part(HEMI, cc, 0, 0.16, -0.004, { s: [0.152, 0.145, 0.158] }),
      box(0.18, 0.014, 0.12, cc, 0, 0.195, 0.15, { rx: 0.08 }),
    );
  } else if (hs !== "none") {
    H.push(
      part(HEMI, hairC, 0, 0.158, -0.008, {
        s: [0.148, 0.168, 0.16],
        rx: -0.4,
      }),
      box(0.24, 0.14, 0.075, hairC, 0, 0.11, -0.095),
    );
    if (hs === "long") {
      H.push(
        box(0.26, 0.44, 0.075, hairC, 0, -0.08, -0.105),
        box(0.042, 0.32, 0.13, hairC, 0.132, 0.01, -0.035),
        box(0.042, 0.32, 0.13, hairC, -0.132, 0.01, -0.035),
      );
    }
    if (hs === "bun") H.push(sph(0.062, hairC, 0, 0.29, -0.085));
  }
  mesh(H, head);

  /* ---- arms, elbows & shaped hands with gun socket ---- */
  const arms = [],
    elbows = [];
  let handR = null,
    handL = null;
  const sleeve = o.sleeve || "short",
    sleeveCol = o.shirt2 ?? shirt;
  const upLen = 0.29,
    foreLen = 0.27;
  const upSleeve = sleeve === "none" ? 0 : sleeve === "short" ? 0.16 : 0.29;

  const forearmParts = (y0) => [
    cyl(
      0.052,
      0.04,
      foreLen,
      8,
      sleeve === "long" ? sleeveCol : skin,
      0,
      y0 - foreLen / 2,
      0,
    ),
    box(0.04, 0.076, 0.068, skin, 0, y0 - foreLen - 0.036, 0.008),
    box(0.038, 0.042, 0.03, skinD, 0, y0 - foreLen - 0.068, 0.024, {
      rx: 0.45,
    }),
    box(0.025, 0.038, 0.026, skinD, 0, y0 - foreLen - 0.02, 0.044, {
      rx: -0.3,
    }),
  ];

  for (const s of [-1, 1]) {
    const ag = new THREE.Group();
    ag.position.set(s * (cw / 2 + 0.065), 0.54, 0);
    upper.add(ag);

    const U = [sph(0.078, sleeve === "none" ? skin : sleeveCol, 0, 0, 0)];
    if (upSleeve > 0)
      U.push(cyl(0.072, 0.062, upSleeve, 8, sleeveCol, 0, -upSleeve / 2, 0));
    if (upLen - upSleeve > 0.001) {
      U.push(
        cyl(
          0.06,
          0.052,
          upLen - upSleeve,
          8,
          skin,
          0,
          -upSleeve - (upLen - upSleeve) / 2,
          0,
        ),
      );
    }

    if (detail) {
      mesh(U, ag);
      const eg = new THREE.Group();
      eg.position.y = -upLen;
      ag.add(eg);
      mesh(forearmParts(0), eg);
      elbows.push(eg);

      // Socket inside palm: +Z = barrel forward, +Y = gun top when aiming
      const sock = new THREE.Group();
      sock.position.set(0, -foreLen - 0.036, 0.02);
      sock.rotation.x = Math.PI / 2;
      eg.add(sock);
      if (s === 1) handR = sock;
      else handL = sock;
    } else {
      mesh([...U, ...forearmParts(-upLen)], ag);
    }
    arms.push(ag);
  }

  return {
    g,
    legs,
    knees,
    arms,
    elbows,
    handR,
    handL,
    head,
    upper,
    detail,
    hipY,
  };
}

/* t = walk phase (rad), speed in units/s.
 * opt: { armed, aiming, velY, airTime, land, turn, punch, recoil, lookYaw, lookPitch, panic, hit, dead } */
export function animateHuman(h, t, speed, ground, opt = {}) {
  const [legL, legR] = h.legs,
    [armL, armR] = h.arms;

  // --- DEAD / KNOCKED OUT RAGDOLL POSE ---
  if (opt.dead) {
    h.upper.rotation.set(-0.15, 0.12, 0.18);
    h.upper.position.y = h.hipY;
    legL.rotation.set(0.25, 0, -0.22);
    legR.rotation.set(-0.35, 0, 0.28);
    if (h.knees.length) {
      h.knees[0].rotation.x = 0.55;
      h.knees[1].rotation.x = 0.85;
    }
    armL.rotation.set(-0.4, 0, 1.15);
    armR.rotation.set(0.5, 0, -1.25);
    if (h.elbows.length) {
      h.elbows[0].rotation.x = -0.6;
      h.elbows[1].rotation.x = -0.45;
    }
    if (h.head) h.head.rotation.set(0.35, 0.4, 0.25);
    return;
  }

  const walk = Math.min(1, speed / 2.2);
  const run = Math.max(0, Math.min(1, (speed - 4.2) / 3.8));
  const amp = (0.48 + 0.45 * run) * walk;
  const sn = Math.sin(t),
    cs = Math.cos(t);
  const time = performance.now() * 0.001;

  // Head look direction
  if (h.head) {
    h.head.rotation.y = Math.max(-1.1, Math.min(1.1, opt.lookYaw || 0));
    h.head.rotation.x = Math.max(-0.6, Math.min(0.6, opt.lookPitch || 0));
  }

  // Locomotion: 3-phase jump physics vs. ground stride
  if (!ground) {
    const vy =
      opt.velY !== undefined
        ? opt.velY
        : Math.max(-6, 5.5 - (opt.airTime || 0) * 14);
    const rise = Math.max(-1, Math.min(1, vy / 5.5));

    legL.rotation.set(0.34 + rise * 0.48, 0, 0);
    legR.rotation.set(-0.28 + rise * 0.34, 0, 0);
    if (h.knees.length) {
      h.knees[0].rotation.x = 0.65 + rise * 0.58;
      h.knees[1].rotation.x = 0.35 + rise * 0.42;
    }

    armL.rotation.set(-1.35 - rise * 0.65, 0, 0.32);
    armR.rotation.set(-1.35 - rise * 0.65, 0, -0.32);
    if (h.elbows.length)
      h.elbows[0].rotation.x = h.elbows[1].rotation.x = -0.45;

    h.upper.rotation.set(0.14 - rise * 0.1, 0, 0);
    h.upper.position.y = h.hipY;
  } else {
    const squash = opt.land || 0;
    const turn = Math.max(-1.5, Math.min(1.5, opt.turn || 0));

    // [CHANGED] Symmetrical left/right tactical strafe + backward walk without legs crossing
    const fwd = opt.fwdSpeed ?? speed;
    const side = opt.sideSpeed ?? 0;
    const dirSign = fwd < -0.25 ? -1 : 1;
    const strafeRatio =
      speed > 0.1
        ? Math.min(1, Math.abs(side) / (Math.abs(fwd) + Math.abs(side)))
        : 0;

    // Turn lower body smoothly toward left/right strafe direction (up to ~38 deg)
    const legYaw = opt.armed
      ? Math.atan2(side, Math.abs(fwd) + 0.45) * 0.72 * walk
      : 0;

    const stride = sn * amp * dirSign * (1 - strafeRatio * 0.35);
    // Outward-only lateral step (Math.max(0, ...)) so legs never swing inward through each other
    const outStepL = Math.max(0, sn) * amp * 0.28 * strafeRatio;
    const outStepR = Math.max(0, -sn) * amp * 0.28 * strafeRatio;

    legL.rotation.set(stride - squash * 0.36, legYaw, outStepL);
    legR.rotation.set(-stride - squash * 0.36, legYaw, -outStepR);

    if (h.knees.length) {
      const kb = (0.76 + 0.56 * run) * walk;
      const kneePhaseL = dirSign > 0 ? -cs : cs;
      const kneePhaseR = dirSign > 0 ? cs : -cs;
      h.knees[0].rotation.x = Math.max(0, kneePhaseL) * kb + squash * 0.72;
      h.knees[1].rotation.x = Math.max(0, kneePhaseR) * kb + squash * 0.72;
    }

    if (opt.panic) {
      // NPC running away in panic with hands raised
      armL.rotation.set(-2.35 + sn * 0.25, 0, 0.35);
      armR.rotation.set(-2.35 - sn * 0.25, 0, -0.35);
      if (h.elbows.length) {
        h.elbows[0].rotation.x = -0.65;
        h.elbows[1].rotation.x = -0.65;
      }
    } else {
      armL.rotation.set(-sn * amp * 0.92, 0, 0.08 + run * 0.06);
      armR.rotation.set(sn * amp * 0.92, 0, -0.08 - run * 0.06);
      if (h.elbows.length) {
        const eb = -(0.2 + 0.95 * run) * (0.35 + 0.65 * walk);
        h.elbows[0].rotation.x = eb;
        h.elbows[1].rotation.x = eb;
      }
    }

    h.upper.rotation.x = 0.03 + 0.24 * run * walk + squash * 0.24;
    h.upper.rotation.y = sn * 0.12 * walk;
    h.upper.rotation.z = -turn * 0.16 * (0.25 + 0.75 * walk);
    h.upper.position.x = -Math.sin(legYaw) * 0.03 * walk;
    h.upper.position.y =
      h.hipY -
      squash * 0.13 +
      Math.abs(cs) * 0.035 * walk +
      Math.sin(time * 2.0) * 0.005 * (1 - walk);
  }

  // Hit stagger reaction when shot or punched
  if (opt.hit) {
    h.upper.rotation.x = -0.38;
    armL.rotation.set(-0.9, 0, 0.6);
    armR.rotation.set(-0.7, 0, -0.6);
    if (h.head) h.head.rotation.x = -0.45;
    return;
  }

  // Melee Punch
  if (opt.punch > 0) {
    const p = Math.sin(Math.min(1, opt.punch) * Math.PI);
    h.upper.rotation.y = -p * 0.58;
    h.upper.rotation.x += p * 0.16;
    armR.rotation.set(-1.56 * p, 0, -0.04);
    armL.rotation.set(0.42 * p, 0, 0.18);
    if (h.elbows.length) {
      h.elbows[1].rotation.x = -0.08;
      h.elbows[0].rotation.x = -1.25 * p;
    }
    return;
  }

  // Armed Gun Aiming & Recoil
  if (opt.armed) {
    const kick = opt.recoil || 0;
    const aimPitch = opt.lookPitch || 0;
    h.upper.rotation.y = 0;

    if (opt.aiming) {
      armR.rotation.set(-1.52 + aimPitch - kick * 0.3, 0, -0.03);
      armL.rotation.set(-1.28 + aimPitch - kick * 0.16, 0, 0.34);
      if (h.elbows.length) {
        h.elbows[1].rotation.x = -0.06 - kick * 0.22;
        h.elbows[0].rotation.x = -0.84;
      }
      h.upper.rotation.x = 0.03 - aimPitch * 0.25 - kick * 0.05;
    } else {
      // Points gun toward crosshair whenever gun is active
      armR.rotation.set(-1.42 + aimPitch - kick * 0.26, 0, -0.04);
      armL.rotation.set(-1.05 + aimPitch * 0.6 - kick * 0.12, 0, 0.3);
      if (h.elbows.length) {
        h.elbows[1].rotation.x = -0.16 - kick * 0.2;
        h.elbows[0].rotation.x = -0.92;
      }
      h.upper.rotation.x = 0.04 - aimPitch * 0.2;
    }
  }
}

/* ---------- outfits ---------- */
const TEES = [
  0xe3b23c, 0x3f83c7, 0xc9553f, 0x4f9d69, 0xd9649a, 0x8b78d6, 0xf2f2f2,
  0x2d3748,
];
const JEANS = [0x3b5b8c, 0x2d3748, 0x6b7280, 0x1f2937];
const HAIRS = [0x1a1410, 0x241a14, 0x3a2a1e, 0x111111];
const SAREES = [0xc0262d, 0x1f7a8c, 0xe6a817, 0x7a3b9e, 0x2e8b57, 0xd9649a];
const SARONGS = [0x3b5b8c, 0x7a3b3b, 0x2f6f4f, 0x5b4a8a];

export const PLAYER_OUTFIT = {
  skin: 0xb07a52,
  hair: 0x15110d,
  hairStyle: "short",
  shirt: 0x1fa39e,
  sleeve: "short",
  pattern: "floral",
  collar: 0xffffff,
  pants: 0x4a6fa5,
  bottom: "pants",
  shoes: 0xf4f4f4,
};

export function randomOutfit(beach = false) {
  const skin = pick(SKINS),
    female = Math.random() < 0.45;
  const base = {
    skin,
    female,
    hair: pick(HAIRS),
    hairStyle: female ? pick(["long", "long", "bun"]) : "short",
    scale: 0.92 + Math.random() * 0.1,
  };
  if (beach) {
    return {
      ...base,
      shirt: pick(TEES),
      sleeve: "short",
      bottom: "shorts",
      pants: pick([0x2f9ec7, 0xe85d4a, 0xf2b632, 0x1f2937]),
      sandals: true,
      shoes: 0x3a3a3a,
      hairStyle: female ? base.hairStyle : pick(["short", "cap"]),
      capCol: pick([0xe85d4a, 0xf2f2f2, 0x2f6fb5]),
    };
  }
  const r = Math.random();
  if (r < 0.18)
    return {
      ...base,
      shirt: pick(TEES),
      pants: pick(JEANS),
      bottom: "pants",
      shoes: pick([0xf2f2f2, 0x222222]),
    };
  if (r < 0.3)
    return {
      ...base,
      shirt: pick([0x1fa39e, 0xe85d4a, 0x2f6fb5]),
      pattern: "floral",
      collar: 0xffffff,
      bottom: pick(["shorts", "pants"]),
      pants: pick([0xd8cdb4, 0x4a6fa5]),
      shoes: 0xf2f2f2,
    };
  if (r < 0.46)
    return {
      ...base,
      female: false,
      hairStyle: "short",
      shirt: pick([0xf2f2f2, 0xcfe0ea]),
      sleeve: "short",
      bottom: "sarong",
      sarong: pick(SARONGS),
      sandals: true,
      shoes: 0x2a2420,
    };
  if (r < 0.62) {
    const c = pick(SAREES);
    return {
      ...base,
      female: true,
      hairStyle: pick(["bun", "long"]),
      shirt: shade(c, 0.8),
      saree: c,
      bottom: "saree",
      sleeve: "short",
      sandals: true,
      shoes: 0x2a2420,
    };
  }
  if (r < 0.72) {
    const boy = Math.random() < 0.5;
    return {
      ...base,
      female: !boy,
      hairStyle: boy ? "short" : "long",
      shirt: 0xf6f6f6,
      tie: 0x1f3a8a,
      sleeve: "short",
      bottom: boy ? "shorts" : "skirt",
      pants: 0x1f2f5f,
      skirt: 0x1f2f5f,
      shoes: 0x222222,
      scale: 0.8 + Math.random() * 0.06,
    };
  }
  if (r < 0.84)
    return {
      ...base,
      female: false,
      hairStyle: "short",
      shirt: pick([0xf6f6f6, 0xbcd4ea]),
      sleeve: "long",
      collar: 0xffffff,
      tie: pick([0x9b1c31, 0x1f3a8a, 0x2d3748]),
      pants: 0x1f2227,
      bottom: "pants",
      shoes: 0x1a1a1a,
    };
  if (r < 0.92)
    return {
      ...base,
      female: false,
      hairStyle: "cap",
      capCol: 0xd8cdb4,
      shirt: 0xc9b98a,
      sleeve: "short",
      collar: 0xc9b98a,
      pants: 0xb9a878,
      bottom: "pants",
      shoes: 0x2a2420,
    };
  return {
    ...base,
    female: true,
    hairStyle: pick(["long", "bun"]),
    shirt: pick([0xe85d4a, 0x2f9ec7, 0xf2b632, 0xd9649a]),
    bottom: "skirt",
    skirt: pick([0xe85d4a, 0x2f9ec7, 0xf2b632, 0x8b78d6]),
    sleeve: "short",
    sandals: true,
    shoes: 0x3a3a3a,
  };
}
