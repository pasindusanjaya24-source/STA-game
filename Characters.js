// Characters.js — High-Detail Low-Poly Rigged Humans (Sculpted Anatomy, Sarees, Bikinis & Hairstyles)
import { merge, box, part, solidMat } from "./world.js";
const THREE = window.THREE;

export const SKINS = [0xb07a52, 0x9b6847, 0x7d5336, 0xc79a73, 0x8a5a3c];
const HEMI = new THREE.SphereGeometry(
  1,
  16,
  12,
  0,
  Math.PI * 2,
  0,
  Math.PI / 2,
);
const cyl = (rt, rb, h, seg, col, x, y, z, o) =>
  part(new THREE.CylinderGeometry(rt, rb, h, seg), col, x, y, z, o);
const sph = (r, col, x, y, z, s, seg = 14) =>
  part(new THREE.SphereGeometry(r, seg, Math.max(10, seg - 2)), col, x, y, z, {
    s: s || [1, 1, 1],
  });
const shade = (hex, f) => {
  if (typeof hex === "string") hex = 0xcccccc;
  return new THREE.Color(hex).multiplyScalar(f).getHex();
};
const pick = (a) => a[(Math.random() * a.length) | 0];
const mesh = (parts, parent) => {
  const m = new THREE.Mesh(merge(parts), solidMat);
  parent.add(m);
  return m;
};

export function buildHuman(o, detail = true) {
  const skin = o.skin,
    skinD = shade(skin, 0.84),
    skinL = shade(skin, 1.06);
  const shirt = typeof o.shirt === "number" ? o.shirt : 0x1fa39e,
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
      S.push(cyl(0.21, 0.255, 0.76, 16, o.sarong, 0, 0.64, 0));
      for (const y of [0.36, 0.52, 0.68])
        S.push(cyl(0.256, 0.256, 0.028, 16, shade(o.sarong, 0.62), 0, y, 0));
    } else if (bottom === "skirt") {
      // [FIXED] Skirt starts at waist (y=1.04) and flares smoothly over hips/glutes
      S.push(
        cyl(0.185, 0.31, 0.56, 16, o.skirt, 0, 0.76, 0, {
          s: female ? [1.16, 1, 1.08] : [1, 1, 1],
        }),
      );
    } else {
      // [FIXED] Full-length Sri Lankan saree wrap from waist (y=1.04) to ankles with gold border
      S.push(
        cyl(0.188, 0.315, 0.9, 16, o.saree, 0, 0.59, 0, {
          s: [1.16, 1, 1.08],
        }),
      );
      S.push(
        cyl(0.318, 0.318, 0.055, 16, 0xe6b422, 0, 0.165, 0, {
          s: [1.16, 1, 1.08],
        }),
      );
    }
    mesh(S, g);
  }

  /* ---- legs, sculpted calves & footwear ---- */
  const legs = [],
    knees = [];
  const shoe = o.barefoot ? skin : (o.shoes ?? 0xf2f2f2),
    soleCol = o.barefoot ? skinD : shade(shoe, 0.42);
  const shoeH = o.barefoot ? 0.025 : o.sandals ? 0.03 : 0.075;
  const thighCol = bottom === "pants" || bottom === "shorts" ? pantsC : skin;
  const shinCol = bottom === "pants" ? pantsD : skin;

  const buildFoot = (yBottom) => {
    const F = [
      box(0.118, 0.02, 0.26, soleCol, 0, yBottom + 0.01, 0.045),
      box(
        0.114,
        shoeH - 0.015,
        0.24,
        shoe,
        0,
        yBottom + 0.018 + (shoeH - 0.015) / 2,
        0.04,
      ),
    ];
    if (!o.sandals && !o.barefoot) {
      F.push(
        box(
          0.108,
          shoeH * 0.65,
          0.088,
          shoe,
          0,
          yBottom + 0.018 + shoeH * 0.3,
          0.16,
        ),
      );
    } else if (o.sandals) {
      F.push(box(0.12, 0.018, 0.045, shoe, 0, yBottom + 0.038, 0.085));
    }
    return F;
  };

  for (const s of [-1, 1]) {
    const lg = new THREE.Group();
    lg.rotation.order = "YXZ";
    lg.position.set(s * (female ? 0.102 : 0.115), hipY, 0);
    g.add(lg);

    const thighTop = female ? 0.104 : 0.098;
    const thighBot = female ? 0.074 : 0.078;

    if (detail) {
      mesh(
        [
          sph(thighTop, thighCol, 0, -0.02, 0, [1, 1, 1.05], 14),
          cyl(thighTop, thighBot, 0.45, 14, thighCol, 0, -0.23, 0),
          sph(thighBot, thighCol, 0, -0.46, 0, [1, 1, 1], 12),
        ],
        lg,
      );

      const kn = new THREE.Group();
      kn.position.y = -0.46;
      lg.add(kn);

      mesh(
        [
          cyl(0.073, 0.062, 0.22, 14, shinCol, 0, -0.11, -0.006),
          cyl(0.062, 0.044, 0.23, 14, shinCol, 0, -0.33, 0),
          ...buildFoot(-0.5),
        ],
        kn,
      );
      knees.push(kn);
    } else {
      const L = [];
      if (bottom === "shorts") {
        L.push(
          cyl(thighTop, 0.082, 0.4, 12, pantsC, 0, -0.2, 0),
          cyl(0.07, 0.046, 0.53, 12, skin, 0, -0.665, 0),
        );
      } else {
        L.push(cyl(thighTop, 0.048, 0.93, 12, thighCol, 0, -0.465, 0));
      }
      L.push(...buildFoot(-0.96));
      mesh(L, lg);
    }
    legs.push(lg);
  }

  /* ---- upper body (curvy hourglass female anatomy vs. male V-taper) ---- */
  const upper = new THREE.Group();
  upper.position.y = hipY;
  g.add(upper);

  const cw = female ? 0.36 : 0.48;
  const ww = female ? 0.28 : 0.41;
  const T = [];

  if (female) {
    // [FIXED] Match hip/glute fabric color to skirt, saree, or pants so skin NEVER pokes through clothes
    const skirtCol =
      bottom === "saree"
        ? o.saree
        : bottom === "skirt"
          ? o.skirt
          : bottom === "sarong"
            ? o.sarong
            : pantsC;
    const hipCol = o.bikini ? skin : skirtCol;
    const torsoCol = o.bikini ? skin : shirt;

    // 1. Rounded Hips & Pelvis
    T.push(
      cyl(0.145, 0.186, 0.2, 16, hipCol, 0, 0.03, 0, { s: [1.14, 1, 0.92] }),
    );
    // 2. Full Rounded Glutes / Butt (clothed in skirt/saree/jeans color unless wearing bikini)
    for (const sx of [-0.078, 0.078]) {
      T.push(sph(0.106, hipCol, sx, -0.015, -0.056, [1.04, 1.04, 1.14], 14));
    }

    // 3. Sleek Bikini Bottom (Panties) when wearing bikini
    if (o.bikini) {
      T.push(
        cyl(0.152, 0.188, 0.095, 16, pantsC, 0, 0.005, 0, {
          s: [1.15, 1, 0.94],
        }),
        box(0.125, 0.11, 0.185, pantsC, 0, -0.042, 0.01),
      );
      for (const sx of [-0.078, 0.078]) {
        T.push(sph(0.109, pantsC, sx, -0.02, -0.058, [1.04, 0.94, 1.14], 14));
      }
    } else if (bottom === "pants" || bottom === "shorts") {
      T.push(
        cyl(0.148, 0.152, 0.032, 16, 0x241f1c, 0, 0.11, 0, {
          s: [1.14, 1, 0.92],
        }),
        box(0.048, 0.038, 0.02, 0xd4af37, 0, 0.11, 0.138),
      );
    }

    // 4. Sculpted Hourglass Narrow Waist (extends down to y=0.09 so zero gap above skirt/saree)
    T.push(
      cyl(0.155, 0.134, 0.24, 16, torsoCol, 0, 0.21, 0, {
        s: [1.12, 1, 0.85],
      }),
    );

    // 5. Upper Ribcage & Smooth Shoulder Slope
    T.push(
      cyl(0.168, 0.155, 0.25, 16, torsoCol, 0, 0.42, 0, {
        s: [1.14, 1, 0.86],
      }),
      cyl(0.076, 0.166, 0.09, 16, torsoCol, 0, 0.57, 0, {
        s: [1.14, 1, 0.86],
      }),
    );

    // 6. Prominent Rounded Breasts / Bust
    for (const sx of [-0.084, 0.084]) {
      T.push(sph(0.104, torsoCol, sx, 0.41, 0.092, [1.02, 1.02, 1.25], 14));
    }

    // 7. 2-Piece Bikini Top Cups & Halter Straps
    if (o.bikini) {
      for (const sx of [-0.084, 0.084]) {
        T.push(
          sph(0.107, shirt, sx, 0.405, 0.096, [1.02, 0.98, 1.25], 14),
          box(0.022, 0.18, 0.022, shirt, sx * 0.65, 0.52, 0.09, {
            rx: -0.45,
            rz: sx * 1.4,
          }),
        );
      }
      T.push(
        cyl(0.172, 0.172, 0.024, 16, shirt, 0, 0.41, 0, {
          s: [1.15, 1, 0.88],
        }),
      );
    }
  } else {
    // Male V-taper sculpted body
    T.push(box(0.39, 0.16, 0.23, skirtLike ? skin : pantsC, 0, 0.01, 0));
    if (o.shirt !== "none" && o.shirt !== skin) {
      T.push(box(ww + 0.02, 0.18, 0.24, shirtD, 0, 0.14, 0));
    }
    if (bottom === "pants" || bottom === "shorts") {
      T.push(box(ww + 0.025, 0.032, 0.248, 0x241f1c, 0, 0.04, 0));
      T.push(box(0.05, 0.04, 0.02, 0xd4af37, 0, 0.04, 0.126));
    }
    if (o.shirt !== "none") {
      T.push(
        box(cw, 0.34, 0.26, shirt, 0, 0.36, 0),
        box(cw + 0.06, 0.11, 0.265, shirt, 0, 0.56, 0),
      );
    }
  }

  // Tall continuous neck bridging deep into chest and jaw
  T.push(cyl(0.054, 0.072, 0.19, 14, skinD, 0, 0.615, 0));

  if (o.pattern === "floral") {
    const fl = [0xff7aa8, 0xffd84d, 0xffffff, 0xff9f43];
    for (let i = 0; i < 16; i++)
      T.push(
        box(
          0.046,
          0.046,
          0.012,
          pick(fl),
          (Math.random() - 0.5) * (cw - 0.04),
          0.18 + Math.random() * 0.34,
          0.136,
        ),
      );
    for (let i = 0; i < 12; i++)
      T.push(
        box(
          0.046,
          0.046,
          0.012,
          pick(fl),
          (Math.random() - 0.5) * (cw - 0.04),
          0.18 + Math.random() * 0.34,
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

  // [FIXED] Saree waistband & diagonal pallu (osariya/saree drape) visible over chest and back shoulder
  if (bottom === "saree") {
    T.push(
      // Saree waist wrap
      cyl(0.152, 0.165, 0.08, 16, o.saree, 0, 0.11, 0, { s: [1.14, 1, 0.9] }),
      // Front diagonal saree pallu across chest + gold border
      box(0.13, 0.56, 0.04, o.saree, 0.01, 0.36, 0.168, {
        rz: -0.46,
        rx: -0.14,
      }),
      box(0.032, 0.56, 0.044, 0xe6b422, -0.045, 0.36, 0.172, {
        rz: -0.46,
        rx: -0.14,
      }),
      // Shoulder cap & back hanging saree pallu
      box(0.13, 0.14, 0.26, o.saree, -0.11, 0.58, 0.01, { rz: 0.18 }),
      box(0.13, 0.58, 0.035, o.saree, -0.08, 0.32, -0.148, { rz: 0.12 }),
      box(0.032, 0.58, 0.038, 0xe6b422, -0.132, 0.32, -0.15, { rz: 0.12 }),
    );
  }
  mesh(T, upper);

  /* ---- high-detail adult-proportioned head (seated firmly on neck) ---- */
  const head = new THREE.Group();
  head.position.set(0, 0.64, 0);
  upper.add(head);

  const H = [];
  H.push(
    part(new THREE.SphereGeometry(0.138, 18, 14), skin, 0, 0.155, 0, {
      s: [0.92, 1.15, 1.02],
    }),
  );
  H.push(box(0.142, 0.085, 0.148, skin, 0, 0.075, 0.015));
  for (const s of [-1, 1]) {
    H.push(sph(0.03, skinD, s * 0.126, 0.15, -0.01, [0.45, 1, 1], 10));
    H.push(box(0.038, 0.022, 0.016, 0xffffff, s * 0.048, 0.168, 0.134));
    H.push(box(0.02, 0.02, 0.018, 0x1a1208, s * 0.048, 0.168, 0.138));
    H.push(
      box(0.048, 0.012, 0.018, hairC, s * 0.048, 0.196, 0.136, {
        rz: -s * 0.06,
      }),
    );
    if (female) {
      H.push(box(0.042, 0.008, 0.017, 0x111111, s * 0.05, 0.18, 0.136));
      H.push(sph(0.014, 0xfacc15, s * 0.132, 0.125, -0.008, [1, 1, 1], 8));
    }
  }
  H.push(box(0.025, 0.052, 0.036, skinD, 0, 0.136, 0.146, { rx: -0.15 }));
  H.push(box(0.023, 0.02, 0.032, skinL, 0, 0.118, 0.152));
  H.push(
    box(0.052, 0.013, 0.016, female ? 0xb9384c : 0x7a2e2e, 0, 0.084, 0.134),
  );

  // [FIXED] Rounded back-of-head hair hugging the skull cleanly (no square box corners sticking out)
  const hs = o.hairStyle || "short";
  if (hs === "cap") {
    const cc = o.capCol ?? 0x2f6fb5;
    H.push(
      part(HEMI, cc, 0, 0.165, -0.004, { s: [0.146, 0.148, 0.154] }),
      box(0.18, 0.014, 0.12, cc, 0, 0.195, 0.148, { rx: 0.08 }),
    );
  } else if (hs !== "none") {
    H.push(
      part(HEMI, hairC, 0, 0.166, -0.008, {
        s: [0.136, 0.164, 0.148],
        rx: -0.34,
      }),
      cyl(0.128, 0.116, 0.13, 14, hairC, 0, 0.13, -0.024, {
        s: [0.94, 1, 1.04],
      }),
    );
    if (hs === "long") {
      H.push(
        box(0.22, 0.42, 0.065, hairC, 0, -0.06, -0.105),
        box(0.035, 0.32, 0.1, hairC, 0.122, 0.02, -0.048),
        box(0.035, 0.32, 0.1, hairC, -0.122, 0.02, -0.048),
      );
    }
    if (hs === "bob") {
      H.push(
        cyl(0.134, 0.142, 0.22, 14, hairC, 0, 0.08, -0.028, {
          s: [0.96, 1, 1.04],
        }),
      );
    }
    if (hs === "ponytail") {
      H.push(
        sph(0.042, 0xfacc15, 0, 0.23, -0.142, [1, 1, 1], 10),
        cyl(0.035, 0.055, 0.34, 12, hairC, 0, 0.07, -0.175, { rx: 0.18 }),
      );
    }
    if (hs === "curls") {
      H.push(box(0.22, 0.34, 0.065, hairC, 0, -0.02, -0.105));
      for (const sx of [-0.122, 0.122]) {
        for (let cy = -0.1; cy <= 0.12; cy += 0.075) {
          H.push(sph(0.042, hairC, sx, cy, -0.052, [0.9, 1.1, 1.1], 10));
        }
      }
    }
    if (hs === "bun") {
      H.push(sph(0.066, hairC, 0, 0.315, -0.075, [1, 1, 1], 12));
    }
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
      female ? 0.046 : 0.052,
      female ? 0.036 : 0.04,
      foreLen,
      12,
      sleeve === "long" ? sleeveCol : skin,
      0,
      y0 - foreLen / 2,
      0,
    ),
    box(0.038, 0.074, 0.066, skin, 0, y0 - foreLen - 0.036, 0.008),
    box(0.036, 0.04, 0.028, skinD, 0, y0 - foreLen - 0.068, 0.024, {
      rx: 0.45,
    }),
    box(0.024, 0.036, 0.025, skinD, 0, y0 - foreLen - 0.02, 0.042, {
      rx: -0.3,
    }),
  ];

  for (const s of [-1, 1]) {
    const ag = new THREE.Group();
    ag.position.set(s * (cw / 2 + (female ? 0.038 : 0.065)), 0.52, 0);
    upper.add(ag);

    const shR = female ? 0.066 : 0.078;
    const U = [
      sph(shR, sleeve === "none" ? skin : sleeveCol, 0, 0, 0, [1, 1, 1], 12),
    ];
    if (upSleeve > 0)
      U.push(
        cyl(
          shR * 0.94,
          shR * 0.82,
          upSleeve,
          12,
          sleeveCol,
          0,
          -upSleeve / 2,
          0,
        ),
      );
    if (upLen - upSleeve > 0.001) {
      U.push(
        cyl(
          shR * 0.8,
          shR * 0.68,
          upLen - upSleeve,
          12,
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
    female,
  };
}

/* t = walk phase (rad), speed in units/s.
- opt: { armed, aiming, velY, airTime, land, turn, punch, recoil, lookYaw, lookPitch, panic, hit, dead } */
export function animateHuman(h, t, speed, ground, opt = {}) {
  const [legL, legR] = h.legs,
    [armL, armR] = h.arms;

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

  if (h.head) {
    h.head.rotation.y = Math.max(-1.1, Math.min(1.1, opt.lookYaw || 0));
    h.head.rotation.x = Math.max(-0.6, Math.min(0.6, opt.lookPitch || 0));
  }

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

    const fwd = opt.fwdSpeed ?? speed;
    const side = opt.sideSpeed ?? 0;
    const dirSign = fwd < -0.25 ? -1 : 1;
    const strafeRatio =
      speed > 0.1
        ? Math.min(1, Math.abs(side) / (Math.abs(fwd) + Math.abs(side)))
        : 0;

    const legYaw = opt.armed
      ? Math.atan2(side, Math.abs(fwd) + 0.45) * 0.72 * walk
      : 0;

    const stride = sn * amp * dirSign * (1 - strafeRatio * 0.35);
    const girlyInward = h.female ? 0.048 * walk * (1 - strafeRatio) : 0;
    const outStepL = Math.max(0, sn) * amp * 0.28 * strafeRatio - girlyInward;
    const outStepR = Math.max(0, -sn) * amp * 0.28 * strafeRatio - girlyInward;

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
      armL.rotation.set(-2.35 + sn * 0.25, 0, 0.35);
      armR.rotation.set(-2.35 - sn * 0.25, 0, -0.35);
      if (h.elbows.length) {
        h.elbows[0].rotation.x = -0.65;
        h.elbows[1].rotation.x = -0.65;
      }
    } else if (h.female) {
      armL.rotation.set(-sn * amp * 0.78, 0, 0.13 + run * 0.05);
      armR.rotation.set(sn * amp * 0.78, 0, -0.13 - run * 0.05);
      if (h.elbows.length) {
        const eb = -(0.32 + 0.75 * run) * (0.45 + 0.55 * walk);
        h.elbows[0].rotation.x = eb;
        h.elbows[1].rotation.x = eb;
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
    h.upper.rotation.y = sn * (h.female ? 0.15 : 0.12) * walk;

    const femaleSway = h.female ? sn * 0.048 * walk : 0;
    h.upper.rotation.z = -turn * 0.16 * (0.25 + 0.75 * walk) + femaleSway;

    h.upper.position.x =
      -Math.sin(legYaw) * 0.03 * walk + (h.female ? sn * 0.02 * walk : 0);
    h.upper.position.y =
      h.hipY -
      squash * 0.13 +
      Math.abs(cs) * 0.035 * walk +
      Math.sin(time * 2.0) * 0.005 * (1 - walk);
  }

  if (opt.hit) {
    h.upper.rotation.x = -0.38;
    armL.rotation.set(-0.9, 0, 0.6);
    armR.rotation.set(-0.7, 0, -0.6);
    if (h.head) h.head.rotation.x = -0.45;
    return;
  }

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

export function randomOutfit(zone = "normal") {
  if (zone === true) zone = "beach";
  if (zone === false) zone = "normal";

  const skin = pick(SKINS),
    female = Math.random() < 0.45;
  const base = {
    skin,
    female,
    hair: pick(HAIRS),
    hairStyle: female
      ? pick(["long", "bun", "ponytail", "bob", "curls"])
      : "short",
    scale: 0.92 + Math.random() * 0.1,
  };

  // 1. TEMPLE DRESS CODE: Modest all-white attire, no caps, barefoot
  if (zone === "temple") {
    const whites = [0xf8fafc, 0xf1f5f9, 0xfffdf7];
    const wShirt = pick(whites);
    if (female) {
      return Math.random() < 0.65
        ? {
            ...base,
            female: true,
            hairStyle: pick(["bun", "long"]),
            shirt: wShirt,
            saree: pick(whites),
            bottom: "saree",
            sleeve: "short",
            barefoot: true,
          }
        : {
            ...base,
            female: true,
            hairStyle: pick(["bun", "long"]),
            shirt: wShirt,
            skirt: pick(whites),
            bottom: "skirt",
            sleeve: "short",
            barefoot: true,
          };
    }
    return {
      ...base,
      female: false,
      hairStyle: "short",
      shirt: wShirt,
      sarong: pick(whites),
      bottom: "sarong",
      sleeve: "short",
      barefoot: true,
    };
  }

  // 2. BEACH DRESS CODE: Females in 2-piece bikinis (panties + bikini top), males in boardshorts
  if (zone === "beach") {
    const beachShorts = [
      0x2f9ec7, 0xe85d4a, 0xf2b632, 0x10b981, 0x0ea5e9, 0x3b82f6,
    ];
    const bikinis = [
      0xff6b8b, 0xfacc15, 0x38bdf8, 0xec4899, 0xfb923c, 0x8b5cf6,
    ];

    if (female) {
      const bikiniCol = pick(bikinis);
      return {
        ...base,
        female: true,
        bikini: true,
        shirt: bikiniCol,
        sleeve: "none",
        bottom: "bikini",
        pants: bikiniCol,
        barefoot: true,
      };
    }

    return {
      ...base,
      female: false,
      shirt: pick([0xffffff, 0xfacc15, 0x38bdf8, 0xe85d4a, 0x22c55e]),
      pattern: Math.random() < 0.5 ? "floral" : undefined,
      sleeve: "short",
      bottom: "shorts",
      pants: pick(beachShorts),
      barefoot: true,
      hairStyle: pick(["short", "cap"]),
      capCol: pick([0xe85d4a, 0xf2f2f2, 0x2f6fb5]),
    };
  }

  // 3. NORMAL CITY / STREET DRESS CODE
  const r = Math.random();
  if (r < 0.22)
    return {
      ...base,
      shirt: pick(TEES),
      pants: pick(JEANS),
      bottom: "pants",
      shoes: pick([0xf2f2f2, 0x222222]),
    };
  if (r < 0.36)
    return {
      ...base,
      shirt: pick([0x1fa39e, 0xe85d4a, 0x2f6fb5]),
      pattern: "floral",
      collar: 0xffffff,
      bottom: pick(["shorts", "pants"]),
      pants: pick([0xd8cdb4, 0x4a6fa5]),
      shoes: 0xf2f2f2,
    };
  if (r < 0.5)
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
  if (r < 0.64) {
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
  if (r < 0.74) {
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
  if (r < 0.88)
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
  return {
    ...base,
    female: true,
    hairStyle: pick(["long", "bun", "bob", "ponytail"]),
    shirt: pick([0xe85d4a, 0x2f9ec7, 0xf2b632, 0xd9649a]),
    bottom: "skirt",
    skirt: pick([0xe85d4a, 0x2f9ec7, 0xf2b632, 0x8b78d6]),
    sleeve: "short",
    sandals: true,
    shoes: 0x3a3a3a,
  };
}
