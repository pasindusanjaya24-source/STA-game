// characters.js — low-poly rigged humans (player + NPCs). Each limb is ONE merged vertex-coloured mesh.
//   detail=true  : knees + elbows (player)            -> 9 meshes
//   detail=false : straight limbs (NPC crowd)         -> 6 meshes
import { merge, box, part, solidMat } from './world.js';
const THREE = window.THREE;

export const SKINS = [0xb07a52, 0x9b6847, 0x7d5336, 0xc79a73, 0x8a5a3c];
const HEMI = new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
const cyl = (rt, rb, h, seg, col, x, y, z, o) => part(new THREE.CylinderGeometry(rt, rb, h, seg), col, x, y, z, o);
const sph = (r, col, x, y, z, s) => part(new THREE.SphereGeometry(r, 8, 6), col, x, y, z, { s: s || [1, 1, 1] });
const shade = (hex, f) => new THREE.Color(hex).multiplyScalar(f).getHex();
const pick = a => a[(Math.random() * a.length) | 0];
const mesh = (parts, parent) => { const m = new THREE.Mesh(merge(parts), solidMat); parent.add(m); return m; };

export function buildHuman(o, detail) {
  const skin = o.skin, skinD = shade(skin, 0.82);
  const shirt = o.shirt, pantsC = o.pants ?? 0x333333, hairC = o.hair ?? 0x1a1410;
  const female = !!o.female, bottom = o.bottom || 'pants';
  const skirtLike = bottom === 'sarong' || bottom === 'skirt' || bottom === 'saree';
  const g = new THREE.Group();
  const hipY = 0.95;

  /* ---- static lower garment (sarong / skirt / saree) ---- */
  if (skirtLike) {
    const S = [];
    if (bottom === 'sarong') {
      S.push(cyl(0.25, 0.29, 0.72, 10, o.sarong, 0, 0.6, 0));
      for (const y of [0.34, 0.5, 0.66]) S.push(cyl(0.285, 0.285, 0.035, 10, shade(o.sarong, 0.6), 0, y, 0));
    } else if (bottom === 'skirt') {
      S.push(cyl(0.24, 0.34, 0.5, 10, o.skirt, 0, 0.72, 0));
    } else {
      S.push(cyl(0.25, 0.34, 0.84, 10, o.saree, 0, 0.55, 0));
      S.push(cyl(0.345, 0.345, 0.05, 10, 0xe6b422, 0, 0.17, 0));
    }
    mesh(S, g);
  }

  /* ---- legs ---- */
  const legs = [], knees = [];
  const shoe = o.shoes ?? 0xf2f2f2, shoeH = o.sandals ? 0.035 : 0.09;
  const thighCol = (bottom === 'pants' || bottom === 'shorts') ? pantsC : skin;
  const shinCol = bottom === 'pants' ? pantsC : skin;
  for (const s of [-1, 1]) {
    const lg = new THREE.Group(); lg.position.set(s * 0.12, hipY, 0); g.add(lg);
    if (detail) {
      mesh([cyl(0.1, 0.085, 0.46, 7, thighCol, 0, -0.23, 0), sph(0.087, thighCol, 0, -0.46, 0)], lg);
      const kn = new THREE.Group(); kn.position.y = -0.46; lg.add(kn);
      mesh([cyl(0.078, 0.056, 0.46, 7, shinCol, 0, -0.23, 0), box(0.15, shoeH, 0.3, shoe, 0, -0.49 + shoeH / 2, 0.05)], kn);
      knees.push(kn);
    } else {
      const L = [];
      if (bottom === 'shorts') L.push(cyl(0.1, 0.09, 0.4, 6, pantsC, 0, -0.2, 0), cyl(0.075, 0.056, 0.53, 6, skin, 0, -0.665, 0));
      else L.push(cyl(0.1, 0.058, 0.93, 6, thighCol, 0, -0.465, 0));
      L.push(box(0.15, shoeH, 0.3, shoe, 0, -0.95 + shoeH / 2, 0.05));
      mesh(L, lg);
    }
    legs.push(lg);
  }

  /* ---- upper body (pivot at the hips so it can lean) ---- */
  const upper = new THREE.Group(); upper.position.y = hipY; g.add(upper);
  const cw = female ? 0.42 : 0.48;
  const T = [];
  T.push(box(0.42, 0.14, 0.25, skirtLike ? skin : pantsC, 0, -0.03, 0));            // pelvis
  T.push(box(cw + 0.01, 0.2, 0.27, shirt, 0, 0.1, 0));                                    // shirt hem
  if (bottom === 'pants' || bottom === 'shorts') T.push(box(cw, 0.035, 0.275, 0x2a2420, 0, -0.005, 0)); // belt
  T.push(box(cw, 0.44, 0.29, shirt, 0, 0.42, 0));                                    // chest
  T.push(box(cw + 0.05, 0.1, 0.29, shirt, 0, 0.65, 0));                              // shoulders
  T.push(cyl(0.065, 0.075, 0.1, 6, skin, 0, 0.76, 0));                              // neck

  if (o.pattern === 'floral') {
    const fl = [0xff7aa8, 0xffd84d, 0xffffff, 0xff9f43];
    for (let i = 0; i < 16; i++) T.push(box(0.055, 0.055, 0.012, pick(fl), (Math.random() - 0.5) * 0.46, 0.2 + Math.random() * 0.4, 0.156));
    for (let i = 0; i < 12; i++) T.push(box(0.055, 0.055, 0.012, pick(fl), (Math.random() - 0.5) * 0.46, 0.2 + Math.random() * 0.4, -0.156));
  }
  if (o.collar) {
    T.push(box(0.1, 0.13, 0.02, skin, 0, 0.6, 0.152));
    for (const s of [-1, 1]) T.push(box(0.07, 0.1, 0.03, o.collar, s * 0.075, 0.66, 0.155));
  }
  if (o.tie) T.push(box(0.05, 0.3, 0.02, o.tie, 0, 0.47, 0.158), box(0.07, 0.05, 0.03, o.tie, 0, 0.62, 0.158));
  if (bottom === 'saree') T.push(box(0.13, 0.7, 0.33, o.saree, 0.03, 0.42, 0, { rz: -0.5 }), box(0.04, 0.7, 0.335, 0xe6b422, 0.03, 0.42, 0, { rz: -0.5 }));

  /* head */
  T.push(part(new THREE.SphereGeometry(0.215, 12, 8), skin, 0, 0.945, 0, { s: [0.95, 1.1, 1.0] }));
  for (const s of [-1, 1]) {
    T.push(sph(0.045, skin, s * 0.2, 0.935, 0, [0.5, 1, 1]));                       // ears
    T.push(box(0.055, 0.035, 0.02, 0xffffff, s * 0.077, 0.96, 0.212));             // eye whites
    T.push(box(0.028, 0.03, 0.02, 0x1a1208, s * 0.077, 0.96, 0.218));              // pupils
    T.push(box(0.07, 0.015, 0.02, hairC, s * 0.077, 1.005, 0.215));                    // brows
  }
  T.push(box(0.04, 0.07, 0.05, skinD, 0, 0.915, 0.23));                              // nose
  T.push(box(0.075, 0.014, 0.02, 0x7a2e2e, 0, 0.85, 0.212));                       // mouth
  const hs = o.hairStyle || 'short';
  if (hs === 'cap') {
    T.push(part(HEMI, o.capCol ?? 0x2f6fb5, 0, 0.95, -0.005, { s: [0.24, 0.21, 0.24] }), box(0.27, 0.02, 0.17, o.capCol ?? 0x2f6fb5, 0, 1.0, 0.225));
  } else if (hs !== 'none') {
    T.push(part(HEMI, hairC, 0, 0.945, -0.012, { s: [0.23, 0.245, 0.24], rx: -0.42 }), box(0.38, 0.2, 0.1, hairC, 0, 0.885, -0.15));
    if (hs === 'long') T.push(box(0.4, 0.55, 0.1, hairC, 0, 0.64, -0.16), box(0.06, 0.4, 0.18, hairC, 0.205, 0.74, -0.05), box(0.06, 0.4, 0.18, hairC, -0.205, 0.74, -0.05));
    if (hs === 'bun') T.push(sph(0.09, hairC, 0, 1.15, -0.13));
  }
  mesh(T, upper);

  /* ---- arms ---- */
  const arms = [], elbows = [];
  const sleeve = o.sleeve || 'short', sleeveCol = o.shirt2 ?? shirt;
  const upLen = 0.3, foreLen = 0.27;
  const upSleeve = sleeve === 'none' ? 0 : (sleeve === 'short' ? 0.17 : 0.3);
  const forearm = y0 => [
    cyl(0.058, 0.048, foreLen, 7, sleeve === 'long' ? sleeveCol : skin, 0, y0 - foreLen / 2, 0),
    sph(0.062, skin, 0, y0 - foreLen - 0.02, 0)
  ];
  for (const s of [-1, 1]) {
    const ag = new THREE.Group(); ag.position.set(s * (cw / 2 + 0.07), 0.62, 0); upper.add(ag);
    const U = [sph(0.085, sleeve === 'none' ? skin : sleeveCol, 0, 0, 0)];
    if (upSleeve > 0) U.push(cyl(0.078, 0.07, upSleeve, 7, sleeveCol, 0, -upSleeve / 2, 0));
    if (upLen - upSleeve > 0.001) U.push(cyl(0.066, 0.06, upLen - upSleeve, 7, skin, 0, -upSleeve - (upLen - upSleeve) / 2, 0));
    if (detail) {
      mesh(U, ag);
      const eg = new THREE.Group(); eg.position.y = -upLen; ag.add(eg);
      mesh(forearm(0), eg);
      elbows.push(eg);
    } else {
      mesh([...U, ...forearm(-upLen)], ag);
    }
    arms.push(ag);
  }
  return { g, legs, knees, arms, elbows, upper, detail, hipY };
}

/* t = walk phase (rad), speed in units/s. opt: { armed, aiming } */
export function animateHuman(h, t, speed, ground, opt = {}) {
  const walk = Math.min(1, speed / 2.2);
  const run = Math.max(0, Math.min(1, (speed - 4.5) / 4));
  const amp = (0.45 + 0.4 * run) * walk;
  const sn = Math.sin(t), cs = Math.cos(t);
  const time = performance.now() * 0.001;
  const [legL, legR] = h.legs, [armL, armR] = h.arms;

  if (!ground) {                                   // jumping / falling
    legL.rotation.x = 0.5; legR.rotation.x = -0.35;
    if (h.knees.length) { h.knees[0].rotation.x = 0.9; h.knees[1].rotation.x = 0.3; }
    armL.rotation.x = armR.rotation.x = -2.2;
    armL.rotation.z = 0.5; armR.rotation.z = -0.5;
    if (h.elbows.length) h.elbows[0].rotation.x = h.elbows[1].rotation.x = -0.3;
    h.upper.rotation.set(0.05, 0, 0);
  } else {
    legL.rotation.x = sn * amp; legR.rotation.x = -sn * amp;
    if (h.knees.length) {
      const kb = (0.7 + 0.5 * run) * walk;
      h.knees[0].rotation.x = Math.max(0, -cs) * kb;
      h.knees[1].rotation.x = Math.max(0, cs) * kb;
    }
    armL.rotation.x = -sn * amp * 0.85; armR.rotation.x = sn * amp * 0.85;
    armL.rotation.z = 0.07; armR.rotation.z = -0.07;
    if (h.elbows.length) {
      const eb = -(0.18 + 0.85 * run) * (0.4 + 0.6 * walk);
      h.elbows[0].rotation.x = eb; h.elbows[1].rotation.x = eb;
    }
    h.upper.rotation.x = 0.03 + 0.2 * run * walk;
    h.upper.rotation.y = sn * 0.1 * walk;
    h.upper.position.y = h.hipY + Math.abs(cs) * 0.03 * walk + Math.sin(time * 1.8) * 0.004 * (1 - walk);
  }

  if (opt.armed && ground) {                       // gun arm = armR (the +x arm)
    h.upper.rotation.y = 0;
    if (opt.aiming) {
      armR.rotation.x = -1.5; armR.rotation.z = -0.02;
      armL.rotation.x = -1.25; armL.rotation.z = 0.32;
      if (h.elbows.length) { h.elbows[1].rotation.x = -0.05; h.elbows[0].rotation.x = -0.85; }
      h.upper.rotation.x = 0.02;
    } else {
      armR.rotation.x = -0.55; armR.rotation.z = -0.1;
      if (h.elbows.length) h.elbows[1].rotation.x = -1.1;
    }
  }
}

/* ---------- outfits ---------- */
const TEES = [0xe3b23c, 0x3f83c7, 0xc9553f, 0x4f9d69, 0xd9649a, 0x8b78d6, 0xf2f2f2, 0x2d3748];
const JEANS = [0x3b5b8c, 0x2d3748, 0x6b7280, 0x1f2937];
const HAIRS = [0x1a1410, 0x241a14, 0x3a2a1e, 0x111111];
const SAREES = [0xc0262d, 0x1f7a8c, 0xe6a817, 0x7a3b9e, 0x2e8b57, 0xd9649a];
const SARONGS = [0x3b5b8c, 0x7a3b3b, 0x2f6f4f, 0x5b4a8a];

export const PLAYER_OUTFIT = {
  skin: 0xb07a52, hair: 0x15110d, hairStyle: 'short',
  shirt: 0x1fa39e, sleeve: 'short', pattern: 'floral', collar: 0xffffff,
  pants: 0x4a6fa5, bottom: 'pants', shoes: 0xf4f4f4
};

export function randomOutfit(beach = false) {
  const skin = pick(SKINS), female = Math.random() < 0.45;
  const base = { skin, female, hair: pick(HAIRS), hairStyle: female ? pick(['long', 'long', 'bun']) : 'short', scale: 0.92 + Math.random() * 0.1 };
  if (beach) {
    return { ...base, shirt: pick(TEES), sleeve: 'short', bottom: 'shorts', pants: pick([0x2f9ec7, 0xe85d4a, 0xf2b632, 0x1f2937]), sandals: true, shoes: 0x3a3a3a,
      hairStyle: female ? base.hairStyle : pick(['short', 'cap']), capCol: pick([0xe85d4a, 0xf2f2f2, 0x2f6fb5]) };
  }
  const r = Math.random();
  if (r < 0.18) return { ...base, shirt: pick(TEES), pants: pick(JEANS), bottom: 'pants', shoes: pick([0xf2f2f2, 0x222222]) };
  if (r < 0.30) return { ...base, shirt: pick([0x1fa39e, 0xe85d4a, 0x2f6fb5]), pattern: 'floral', collar: 0xffffff, bottom: pick(['shorts', 'pants']), pants: pick([0xd8cdb4, 0x4a6fa5]), shoes: 0xf2f2f2 };
  if (r < 0.46) return { ...base, female: false, hairStyle: 'short', shirt: pick([0xf2f2f2, 0xcfe0ea]), sleeve: 'short', bottom: 'sarong', sarong: pick(SARONGS), sandals: true, shoes: 0x2a2420 };
  if (r < 0.62) { const c = pick(SAREES); return { ...base, female: true, hairStyle: pick(['bun', 'long']), shirt: shade(c, 0.8), saree: c, bottom: 'saree', sleeve: 'short', sandals: true, shoes: 0x2a2420 }; }
  if (r < 0.72) {
    const boy = Math.random() < 0.5;
    return { ...base, female: !boy, hairStyle: boy ? 'short' : 'long', shirt: 0xf6f6f6, tie: 0x1f3a8a, sleeve: 'short', bottom: boy ? 'shorts' : 'skirt', pants: 0x1f2f5f, skirt: 0x1f2f5f, shoes: 0x222222, scale: 0.8 + Math.random() * 0.06 };
  }
  if (r < 0.84) return { ...base, female: false, hairStyle: 'short', shirt: pick([0xf6f6f6, 0xbcd4ea]), sleeve: 'long', collar: 0xffffff, tie: pick([0x9b1c31, 0x1f3a8a, 0x2d3748]), pants: 0x1f2227, bottom: 'pants', shoes: 0x1a1a1a };
  if (r < 0.92) return { ...base, female: false, hairStyle: 'cap', capCol: 0xd8cdb4, shirt: 0xc9b98a, sleeve: 'short', collar: 0xc9b98a, pants: 0xb9a878, bottom: 'pants', shoes: 0x2a2420 };
  return { ...base, female: true, hairStyle: pick(['long', 'bun']), shirt: pick([0xe85d4a, 0x2f9ec7, 0xf2b632, 0xd9649a]), bottom: 'skirt', skirt: pick([0xe85d4a, 0x2f9ec7, 0xf2b632, 0x8b78d6]), sleeve: 'short', sandals: true, shoes: 0x3a3a3a };
}
