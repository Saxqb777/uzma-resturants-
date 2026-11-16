// The live cooking station (where guests see the chefs and waiters collect dishes)
// and the main kitchen behind it (clean, bright white, where everything is prepped on site).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { box, InstanceBatch, pointLight, spotLight, mergeStatic } from './helpers.js';
import * as T from './textures.js';
import { signMaterial } from './materials.js';
import { LAYOUT as L, FONTS as F } from './config.js';
import { makeFoodKit } from './food.js';
import { vines } from './cashier.js';

const LV = L.live, K = L.kitchen;

// Spots for people (shared with the people/story code)
export const KITCHEN_SPOTS = {
  // live station: staff stand behind the counter (its back edge is z = -19.2) facing the guests
  headChef: { x: 0.6, z: -19.42, ry: 0, pose: 'cook-flip' },      // pan over the burner at x 0.6
  sousChef: { x: -3.6, z: -19.42, ry: 0, pose: 'cook-stir' },     // wok
  assistant2: { x: -4.4, z: -19.42, ry: 0, pose: 'cook-stir' },   // wok
  assistant1: { x: 2.6, z: -19.4, ry: 0, pose: 'prep-chop' },     // cutting board
  waiter: { x: 1.3, z: -17.72, ry: Math.PI, pose: 'carry-tray' }, // collecting a tray on the dining side
  // main kitchen: prep islands (their back edge is z = -24.08), staff face the pass
  kitchen1: { x: -3.95, z: -26.01, ry: Math.PI, pose: 'prep-chop', holding: null },   // at the dish station, scrubbing in the sink
  kitchen2: { x: 1.6, z: -24.32, ry: 0, pose: 'prep-chop' },      // chicken (red board)
  kitchen3: { x: -1.05, z: -21.76, ry: 0, pose: 'cashier' },      // plating at the pass, hands on the shelf
};

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, ...o });
const rgeo = new Map();
function rb(parent, mat, w, h, d, x, y, z, r = 0.01) {
  const k = `${w}|${h}|${d}|${r}`;
  if (!rgeo.has(k)) rgeo.set(k, new RoundedBoxGeometry(w, h, d, 2, r));
  const m = new THREE.Mesh(rgeo.get(k), mat); m.position.set(x, y + h / 2, z); m.castShadow = true; m.receiveShadow = true;
  parent.add(m); return m;
}
function label(parent, lines, w, h, x, y, z, ry, { bg = '#ffffff', border = '#2f8f8a', glow = 0.12, px = 512 } = {}) {
  const tex = T.sign({ w: px, h: Math.round(px * h / w), bg, border, borderW: 10, aged: 0.03, seed: Math.round(x * 100 + z * 10), lines });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), signMaterial(tex, { glow }));
  m.position.set(x, y, z); m.rotation.y = ry; m.userData.keep = true; parent.add(m); return m;
}

export function buildKitchen(ctx) {
  const { scene, roof, animators } = ctx;
  let M = ctx.mats;
  const W = (k, fb) => M[k] || M[fb];
  const g = new THREE.Group(); g.name = 'interior'; scene.add(g);
  // Stainless steel only reads as steel when it reflects something bright: give the kitchens
  // their own clean white environment instead of the dim, warm dining-room one.
  let env = ctx.envKitchen || null;
  if (!env && ctx.renderer) {
    const pm = new THREE.PMREMGenerator(ctx.renderer);
    env = pm.fromScene(new RoomEnvironment(), 0.03).texture;
    pm.dispose();
  }
  if (env) {
    const brighten = (m, rough = 1, envI = 1.05) => { const c = m.clone(); c.envMap = env; c.envMapIntensity = envI; c.roughness *= rough; return c; };   // satin, never a mirror: no hot spots
    M = { ...M, steelBrushed: brighten(M.steelBrushed, 1.3), steel: brighten(M.steel, 1.45), whiteTile: brighten(M.whiteTile || M.kitchenTile), kitchenFloor: brighten(M.kitchenFloor || M.kitchenTile) };
  }
  const food = makeFoodKit(M);
  const rnd = T.rng(515);
  liveStation(g, roof, M, W, food, rnd, animators);
  mainKitchen(g, roof, M, W, food, rnd);
  mergeStatic(g);
  return g;
}

// ------------------------------------------------------------------ shared kitchen props
function pan(g, M, x, y, z, ry = 0, foodMat = null) {
  const body = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.11, 0], [0.13, 0.05], [0.126, 0.052], [0.105, 0.006], [0, 0.006]].map(([a, b]) => new THREE.Vector2(a, b)), 24), std('#2a2a2c', { metalness: 0.7, roughness: 0.4, side: THREE.DoubleSide }));
  body.position.set(x, y, z); body.castShadow = true; g.add(body);
  const handle = box(g, std('#1b1b1b', { roughness: 0.6 }), 0.24, 0.02, 0.03, x + Math.cos(ry) * 0.24, y + 0.035, z - Math.sin(ry) * 0.24, { cast: true });
  handle.rotation.y = ry;
  if (foodMat) { const f = new THREE.Mesh(new THREE.CircleGeometry(0.1, 20), foodMat); f.rotation.x = -Math.PI / 2; f.position.set(x, y + 0.02, z); g.add(f); }
}
function wok(g, x, y, z, foodMat) {
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.17, 24, 10, 0, Math.PI * 2, Math.PI * 0.62, Math.PI * 0.38), std('#2b2b2d', { metalness: 0.75, roughness: 0.35, side: THREE.DoubleSide }));
  body.position.set(x, y + 0.13, z); body.castShadow = true; g.add(body);
  if (foodMat) { const f = new THREE.Mesh(new THREE.CircleGeometry(0.1, 20), foodMat); f.rotation.x = -Math.PI / 2; f.position.set(x, y + 0.03, z); g.add(f); }
  const h = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 8), std('#3a2a1c', { roughness: 0.7 })); h.rotation.z = Math.PI / 2; h.position.set(x + 0.27, y + 0.1, z); g.add(h);
}
function burner(g, x, y, z, flameMat) {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.012, 6, 20), flameMat); ring.rotation.x = Math.PI / 2; ring.position.set(x, y + 0.012, z); g.add(ring);
  const grate = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.008, 4, 4), std('#1a1a1a', { metalness: 0.6 })); grate.rotation.x = Math.PI / 2; grate.position.set(x, y + 0.03, z); g.add(grate);
}
function gastro(g, M, x, y, z, foodMat, w = 0.26, d = 0.16) {
  // steel tray: thin base + four walls, food filling it almost to the rim
  box(g, M.steel, w, 0.008, d, x, y, z, { cast: false });
  for (const s of [-1, 1]) {
    box(g, M.steel, w, 0.07, 0.006, x, y, z + s * (d / 2 - 0.003), { cast: false });
    box(g, M.steel, 0.006, 0.07, d, x + s * (w / 2 - 0.003), y, z, { cast: false });
  }
  const f = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.014, d - 0.014), foodMat); f.rotation.x = -Math.PI / 2; f.position.set(x, y + 0.055, z); g.add(f);
}
function plateStack(g, x, y, z, n = 8, r = 0.12) {
  const geo = new THREE.CylinderGeometry(r, r * 0.8, 0.018, 24);
  const mat = std('#f6f4ef', { roughness: 0.25 });
  for (let i = 0; i < n; i++) { const p = new THREE.Mesh(geo, mat); p.position.set(x, y + 0.009 + i * 0.019, z); p.castShadow = i === n - 1; g.add(p); }
}
function herbPot(g, x, y, z, seed) {
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.06, 0.13, 16), std('#c96f4a', { roughness: 0.8 }));
  pot.position.set(x, y + 0.065, z); pot.castShadow = true; g.add(pot);
  const r = T.rng(seed), leaf = new THREE.SphereGeometry(0.03, 8, 6);
  const mats = ['#3f8a3a', '#57a347', '#2f6e2e'].map((c) => std(c, { roughness: 0.7 }));
  for (let i = 0; i < 22; i++) { const l = new THREE.Mesh(leaf, mats[i % 3]); const a = r() * 6.28, rr = r() * 0.07; l.position.set(x + Math.cos(a) * rr, y + 0.15 + r() * 0.12, z + Math.sin(a) * rr); l.scale.set(1, 0.45, 0.7); l.rotation.set(r() * 3, r() * 3, 0); g.add(l); }
}
function squeeze(g, x, y, z, col) {
  const b = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.03, 0.17, 12), std(col, { roughness: 0.3 })); b.position.set(x, y + 0.085, z); g.add(b);
  const t = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.05, 8), std('#ffffff')); t.position.set(x, y + 0.195, z); g.add(t);
}
function tray(g, x, y, z, food, rnd) {
  rb(g, std('#5a3a22', { roughness: 0.6 }), 0.42, 0.02, 0.3, x, y, z, 0.008);
  food.chickenPlate(g, x - 0.08, y + 0.02, z - 0.02, rnd() * 6);
  food.rice(g, x + 0.12, y + 0.02, z - 0.07, rnd() * 6);
  food.banchan(g, 'kimchi', x + 0.12, y + 0.02, z + 0.08, rnd() * 6);
  food.banchan(g, 'cucumber', x - 0.1, y + 0.02, z + 0.1, rnd() * 6);
  food.sauce(g, x + 0.17, y + 0.02, z + 0.11);
}

// ------------------------------------------------------------------ live cooking station
function liveStation(g, roof, M, W, food, rnd, animators) {
  const zf = LV.counterFront, zb = LV.counterBack, x0 = LV.x0, x1 = LV.x1, len = x1 - x0, zc = (zf + zb) / 2;
  // counter: oak slat front with red tile band, stainless work top, raised terrazzo pickup ledge
  box(g, W('woodOakV', 'woodBoothV'), len, 0.86, zf - zb, 0, 0, zc, { uv: 1 });
  box(g, W('redTile', 'subway'), len, 0.18, 0.02, 0, 0.72, zf + 0.01, { uv: 1, cast: false });
  box(g, M.steelBrushed, len + 0.04, 0.04, zf - zb + 0.02, 0, 0.86, zc);
  box(g, W('terrazzo', 'ceramic'), len, 0.04, 0.24, 0, 1.12, zf - 0.08);
  for (let x = x0 + 0.3; x < x1; x += 1.2) box(g, M.steelBrushed, 0.03, 0.22, 0.03, x, 0.9, zf - 0.08, { cast: false });
  // back counter along the wall + shelves
  box(g, M.steelBrushed, len, 0.9, 0.6, 0, 0, LV.wallZ + 0.32);
  box(g, M.steel, len, 0.03, 0.62, 0, 0.9, LV.wallZ + 0.32, { cast: false });
  cabinetFront(g, M, x0, x1, LV.wallZ + 0.625, 0.9, 0.8);
  for (const sx of [-1, 1]) {
    box(g, M.steel, 3.2, 0.025, 0.28, sx * 3.6, 1.55, LV.wallZ + 0.15, { cast: false });
    box(g, M.steel, 3.2, 0.025, 0.28, sx * 3.6, 1.95, LV.wallZ + 0.15, { cast: false });
  }

  // cooking line on the work top (left → right): wok burners, two griddles with chicken, pans
  const Y = 0.9;
  const flame = new THREE.MeshStandardMaterial({ color: '#0a1530', emissive: '#4a8cff', emissiveIntensity: 2.6 });
  animators.push((t) => { flame.emissiveIntensity = 2.4 + Math.sin(t * 21) * 0.25 + Math.sin(t * 9) * 0.2; });
  const zl = zb + 0.27;                                   // the cooking line sits near the staff edge of the counter
  for (const x of [-4.4, -3.6]) { burner(g, x, Y, zl, flame); wok(g, x, Y, zl, food.mats.chicken); }
  {
    // one long griddle full of spicy chicken
    const x = -1.2, gw = 2.0;
    box(g, std('#1d1d1f', { metalness: 0.6, roughness: 0.45 }), gw, 0.05, 0.5, x, Y, zl);
    const hot = new THREE.Mesh(new THREE.PlaneGeometry(gw - 0.06, 0.45), new THREE.MeshStandardMaterial({ color: '#222', emissive: '#ff4a12', emissiveIntensity: 0.12, roughness: 0.35, metalness: 0.6 }));
    hot.rotation.x = -Math.PI / 2; hot.position.set(x, Y + 0.052, zl); g.add(hot);
    for (const dx of [-0.6, 0, 0.6]) food.grillPieces(g, x + dx, Y + 0.04, zl, rnd, 12);
  }
  burner(g, 0.6, Y, zl, flame);                           // the head chef tosses her pan over this one
  burner(g, 1.4, Y, zl, flame); pan(g, M, 1.4, Y + 0.03, zl, -0.3, food.mats.kimchi);
  // prep side: ingredient trays, squeeze bottles, rice cooker, cutting board
  gastro(g, M, 3.6, Y, zc - 0.12, food.mats.kimchi); gastro(g, M, 3.9, Y, zc + 0.08, food.mats.cucumber);
  gastro(g, M, 4.3, Y, zc - 0.12, food.mats.rice); gastro(g, M, 4.6, Y, zc + 0.08, food.mats.lettuce);
  for (const [i, c] of ['#b8241a', '#5a2b14', '#f2c14e'].entries()) squeeze(g, -2.5 + i * 0.09, Y, zc + 0.15, c);
  const rc = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.26, 24), std('#f2f2ef', { roughness: 0.3 })); rc.position.set(-2.9, Y + 0.13, LV.wallZ + 0.32); g.add(rc);
  rb(g, std('#e9e3d3', { roughness: 0.7 }), 0.45, 0.025, 0.3, 2.6, Y, zb + 0.2, 0.01);
  // ready dishes on the pickup ledge (the waiter takes these)
  for (const x of [-0.4, 0.15, 1.2]) tray(g, x, 1.16, zf - 0.08, food, rnd);
  // plate stacks + greenery on the ledge and back counter
  plateStack(g, -4.8, 1.16, zf - 0.08, 10); plateStack(g, 4.9, 1.16, zf - 0.08, 8);
  for (const [x, i] of [[-3.2, 1], [-1.9, 2], [2.4, 3], [3.6, 4]]) herbPot(g, x, 1.16, zf - 0.08, i);
  for (let i = 0; i < 8; i++) plateStack(g, -5.4 + i * 0.36, 1.58, LV.wallZ + 0.15, 6, 0.1);
  for (let i = 0; i < 6; i++) herbPot(g, 2.6 + i * 0.6, 1.98, LV.wallZ + 0.15, 10 + i);

  // hood over the line + the LIVE COOKING STATION sign (replaces the old Korean price boards)
  box(g, M.steelBrushed, 10.0, 0.5, 1.2, 0, 2.55, zc - 0.25);
  box(g, M.steelBrushed, 1.0, L.ceil - 3.05, 0.6, -2.5, 3.05, zc - 0.4, { cast: false });
  box(g, M.steelBrushed, 1.0, L.ceil - 3.05, 0.6, 2.5, 3.05, zc - 0.4, { cast: false });
  const lights = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#fff1dc', emissiveIntensity: 2.4 });
  for (let x = -4.4; x <= 4.4; x += 1.1) { const d = new THREE.Mesh(new THREE.CircleGeometry(0.06, 16), lights); d.rotation.x = Math.PI / 2; d.position.set(x, 2.548, zc - 0.25); g.add(d); }
  liveSign(g, 0, 2.8, zc + 0.36);
  // greenery hanging from the hood edge
  for (let x = -4.8; x <= 4.8; x += 1.6) vines(g, x, zc + 0.37, 0.06, 2.0, 2.55, 50, Math.round(x * 10) + 50);
  // side service stations: cutlery & napkins (left), water & glasses (right), with plants
  for (const sx of [-1, 1]) {
    const x = sx * 6.4;
    box(g, W('woodOak', 'woodBooth'), 1.6, 0.95, 0.6, x, 0, -17.5);
    rb(g, W('terrazzo', 'ceramic'), 1.64, 0.035, 0.64, x, 0.95, -17.5, 0.01);
    plateStack(g, x - 0.5, 0.985, -17.5, 9);
    herbPot(g, x + 0.55, 0.985, -17.5, 30 + sx);
    for (let i = 0; i < 6; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.028, 0.09, 12), M.steel); c.position.set(x - 0.05 + (i % 3) * 0.09, 0.985 + 0.045, -17.45 + Math.floor(i / 3) * 0.09); g.add(c); }
  }
  // bright, appetising light on the cooking line (no shadows: static shadows come from the dining spots)
  spotLight(g, '#fff0dc', 22, 8, [-2.4, 4.0, -17.2], [-2.4, 0.9, -18.8], { angle: 0.9, penumbra: 0.8 });
  spotLight(g, '#fff0dc', 22, 8, [2.4, 4.0, -17.2], [2.4, 0.9, -18.8], { angle: 0.9, penumbra: 0.8 });
}

function liveSign(g, x, y, z) {
  const tex = T.sign({
    w: 1800, h: 300, bg: '#1d1714', border: '#f2a7c3', borderW: 14, aged: 0.05, seed: 66,
    fonts: [{ font: F.display, text: 'LIVE COOKING STATION' }, { font: F.cute, text: '라이브 쿠킹 · cooked fresh in front of you' }],
    draw: (c, w, h) => {
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.shadowColor = '#ff7aa8'; c.shadowBlur = 26; c.fillStyle = '#ffe3ee';
      c.font = `150px ${F.display}`; c.fillText('LIVE COOKING STATION', w / 2, h * 0.43);
      c.shadowColor = '#5fe0d2'; c.shadowBlur = 18; c.fillStyle = '#d9fffb';
      c.font = `54px ${F.cute}`; c.fillText('라이브 쿠킹 · cooked fresh in front of you', w / 2, h * 0.82);
      c.shadowBlur = 0;
      // little chef hats either side
      for (const sx of [110, w - 110]) {
        c.fillStyle = '#ffffff'; c.beginPath(); c.arc(sx - 26, 120, 30, 0, 7); c.arc(sx + 26, 120, 30, 0, 7); c.arc(sx, 98, 36, 0, 7); c.fill();
        c.fillRect(sx - 40, 128, 80, 46);
      }
    },
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 0.8), signMaterial(tex, { glow: 0.6 }));
  m.position.set(x, y, z); m.userData.keep = true; g.add(m);
}

// ------------------------------------------------------------------ main kitchen (clean, white, safe)
function mainKitchen(g, roof, M, W, food, rnd) {
  const z0 = K.z0, z1 = K.z1, steel = M.steelBrushed;
  const white = std('#f4f5f3', { roughness: 0.35 });
  // fridges on the left wall, labelled
  const fr = [['CHICKEN', '닭고기 · 0–4°C'], ['VEGETABLES', '채소 · 2–5°C'], ['SAUCES & MARINADES', '소스 · 0–4°C']];
  fr.forEach(([en, ko], i) => {
    const z = z0 - 0.9 - i * 1.0;
    box(g, steel, 0.75, 2.05, 0.92, L.x0 + 0.4, 0, z);
    box(g, M.steel, 0.02, 1.7, 0.02, L.x0 + 0.78, 0.25, z - 0.38, { cast: false });
    label(g, [{ text: en, font: F.round, size: 56, color: '#1d5f5a', y: 0.38, weight: 600 }, { text: ko, font: F.cute, size: 40, color: '#5b6b6a', y: 0.75 }], 0.5, 0.17, L.x0 + 0.785, 1.75, z, Math.PI / 2);
  });
  // freezer chest + dry store shelves further along the left wall
  box(g, steel, 0.8, 0.9, 1.4, L.x0 + 0.42, 0, z0 - 4.4);
  shelving(g, M, L.x0 + 0.25, z1 + 0.9, Math.PI / 2, [['RICE', '쌀'], ['FLOUR', '밀가루'], ['GOCHUGARU', '고춧가루'], ['SESAME', '참깨']]);

  // back wall: dish station (double sink + dishwasher) on the left, then the counter run with the
  // hand-wash basin, microwaves & rice cookers on the shelves above
  dishStation(g, M, z1, rnd);
  box(g, steel, 6.85, 0.9, 0.7, 0.875, 0, z1 + 0.38);
  box(g, M.steel, 6.85, 0.04, 0.72, 0.875, 0.9, z1 + 0.38, { cast: false });
  cabinetFront(g, M, -2.55, 4.3, z1 + 0.735, 0.9);
  // colour-coded chopping boards in a wall rack (food safety), a utensil rail and a knife strip
  const boardCols = ['#c9343a', '#3f9e52', '#2f6fb5', '#e8c33a', '#f4f4f0'];
  boardCols.forEach((c, i) => rb(g, std(c, { roughness: 0.6 }), 0.03, 0.34, 0.26, 3.75 + i * 0.07, 1.02, z1 + 0.2, 0.008));
  box(g, M.steel, 0.5, 0.03, 0.3, 3.9, 0.95, z1 + 0.2, { cast: false });
  box(g, M.steel, 1.6, 0.02, 0.02, 2.65, 1.45, z1 + 0.04, { cast: false });
  for (let i = 0; i < 7; i++) {
    const x = 1.95 + i * 0.235;
    box(g, M.steel, 0.012, 0.3, 0.012, x, 1.14, z1 + 0.05, { cast: false });
    const head = new THREE.Mesh(i % 2 ? new THREE.SphereGeometry(0.045, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2) : new THREE.BoxGeometry(0.07, 0.09, 0.008), M.steel);
    head.position.set(x, 1.12, z1 + 0.05); g.add(head);
  }
  box(g, std('#1b1b1b'), 0.7, 0.05, 0.015, 4.4, 1.5, z1 + 0.02, { cast: false });
  for (let i = 0; i < 4; i++) box(g, std('#d9dcdf', { metalness: 0.9, roughness: 0.2 }), 0.035, 0.2 + i * 0.03, 0.004, 4.15 + i * 0.16, 1.3 - i * 0.03, z1 + 0.03, { cast: false });
  // big pots on the top shelf
  for (const [x, r] of [[-3.9, 0.17], [-3.4, 0.14], [3.7, 0.16]]) {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(r, r, r * 1.3, 20), M.steelBrushed); pot.position.set(x, 2.28 + r * 0.65, z1 + 0.22); g.add(pot);
  }
  box(g, white, 0.45, 0.32, 0.35, -1.2, 0.94, z1 + 0.25);                                  // hand-wash basin
  faucet(g, M, -1.2, z1 + 0.12);
  label(g, [{ text: 'WASH YOUR HANDS', font: F.round, size: 60, color: '#ffffff', y: 0.38, weight: 600 }, { text: '손 씻기 · اغسل يديك', font: `${F.cute}, ${F.arabic}`, size: 44, color: '#e8fbf8', y: 0.74 }], 0.6, 0.24, -1.2, 1.6, z1 + 0.012, 0, { bg: '#2f8f8a', border: '#ffffff' });
  box(g, white, 0.25, 0.32, 0.12, -0.62, 1.3, z1 + 0.07);                                    // paper towels
  box(g, std('#d7f0ed', { roughness: 0.4 }), 0.1, 0.2, 0.08, -1.62, 1.3, z1 + 0.05);           // soap
  box(g, M.steel, 9.0, 0.03, 0.4, -0.2, 1.75, z1 + 0.22, { cast: false });
  box(g, M.steel, 9.0, 0.03, 0.4, -0.2, 2.25, z1 + 0.22, { cast: false });
  for (const x of [0.6, 1.4]) microwave(g, x, 1.78, z1 + 0.25);
  for (const x of [2.4, 3.1]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.3, 24), white); r.position.set(x, 1.93, z1 + 0.24); g.add(r); }
  for (let i = 0; i < 9; i++) box(g, std('#eef2f2', { transparent: true, opacity: 0.85, roughness: 0.2 }), 0.3, 0.22, 0.3, -4.3 + i * 0.5, 2.28, z1 + 0.22, { cast: false });

  // right wall: range with stock pots + hood, oven, safety corner
  box(g, steel, 0.9, 0.9, 2.4, L.x1 - 0.48, 0, z0 - 1.9);
  box(g, std('#1d1d1f', { metalness: 0.5 }), 0.86, 0.04, 2.3, L.x1 - 0.48, 0.9, z0 - 1.9);
  const flame = new THREE.MeshStandardMaterial({ color: '#0a1530', emissive: '#4a8cff', emissiveIntensity: 2.4 });
  for (const z of [z0 - 1.1, z0 - 1.65, z0 - 2.2, z0 - 2.75]) burner(g, L.x1 - 0.45, 0.94, z, flame);
  for (const z of [z0 - 1.1, z0 - 2.2]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.18, 0.34, 24, 1, true), steel); p.position.set(L.x1 - 0.45, 1.12, z); p.castShadow = true; g.add(p); const lid = new THREE.Mesh(new THREE.CircleGeometry(0.2, 24), M.steel); lid.rotation.x = -Math.PI / 2; lid.position.set(L.x1 - 0.45, 1.29, z); g.add(lid); }
  pan(g, M, L.x1 - 0.45, 0.97, z0 - 2.75, Math.PI, food.mats.chicken);
  box(g, steel, 1.1, 0.5, 2.8, L.x1 - 0.55, 2.35, z0 - 1.9);
  box(g, steel, 0.9, 1.6, 0.9, L.x1 - 0.48, 0, z0 - 3.8);                                    // oven stack
  box(g, std('#1a1a1a', { roughness: 0.2, metalness: 0.4 }), 0.02, 0.5, 0.6, L.x1 - 0.93, 0.6, z0 - 3.8, { cast: false });
  // fire extinguisher + first aid on the right wall near the door
  label(g, [{ text: '+', font: F.round, size: 140, color: '#ffffff', y: 0.42 }, { text: 'FIRST AID', font: F.round, size: 44, color: '#ffffff', y: 0.86, weight: 600 }], 0.34, 0.3, L.x1 - 0.06, 1.55, z0 - 0.35, -Math.PI / 2, { bg: '#2e9e5b', border: '#ffffff' });
  label(g, [{ text: 'CLEAN AS YOU GO', font: F.round, size: 54, color: '#1d5f5a', y: 0.3, weight: 600 }, { text: 'Gloves · Hair net · Colour-coded boards', font: F.round, size: 30, color: '#3b4b4a', y: 0.6 }, { text: '깨끗하게 · 안전하게', font: F.cute, size: 34, color: '#e889ab', y: 0.84 }], 0.8, 0.45, L.x1 - 0.012, 1.6, z0 - 4.9, -Math.PI / 2);

  // centre: two prep islands — colour-coded boards (red = raw chicken, green = vegetables)
  for (const [x, kind] of [[-1.4, 'veg'], [1.6, 'chicken']]) {
    box(g, steel, 2.2, 0.88, 0.95, x, 0, -23.6);
    box(g, M.steel, 2.24, 0.04, 0.99, x, 0.88, -23.6, { cast: false });
    box(g, M.steel, 2.1, 0.02, 0.85, x, 0.2, -23.6, { cast: false });
    cabinetFront(g, M, x - 1.1, x + 1.1, -23.12, 0.88, 0.73);
    const board = rb(g, std(kind === 'veg' ? '#3f9e52' : '#c9343a', { roughness: 0.6 }), 0.5, 0.025, 0.3, x, 0.92, -23.91, 0.01);
    board.userData.keep = true;
    if (kind === 'veg') vegetables(g, x, 0.92, -23.45, rnd);
    else { for (const dx of [-0.6, 0.55]) gastro(g, M, x + dx, 0.92, -23.45, food.mats.chicken, 0.5, 0.32); food.banchan(g, 'kimchi', x + 0.15, 0.92, -23.3, 1); }
  }
  // kitchen side of the pass: plated dishes going out, heat lamp is on the dining side
  for (const x of [-0.9, 0.0, 0.9]) tray(g, x, K.pass.y0 + 0.05, L.kitchenZ - 0.12, food, rnd);

  // a clean white ceiling for the kitchen (the dining room's is black)
  const kc = new THREE.Mesh(new THREE.PlaneGeometry(L.x1 - L.x0, z0 - z1), new THREE.MeshStandardMaterial({ color: '#eef0ee', roughness: 0.9 }));
  kc.rotation.x = Math.PI / 2; kc.position.set(0, L.ceil - 0.012, (z0 + z1) / 2); roof.add(kc);
  // bright, clean white light (ceiling panels in the roof group, real lights stay)
  const panel = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#f2f7ff', emissiveIntensity: 1.6 });
  for (const x of [-4.2, -1.4, 1.4, 4.2]) for (const z of [-22.6, -25.3]) box(roof, panel, 1.2, 0.03, 0.6, x, L.ceil - 0.04, z, { cast: false, receive: false });
  pointLight(g, '#f6f9ff', 7.5, 11, -3.2, 3.6, -24.0);
  pointLight(g, '#f6f9ff', 7.5, 11, 3.2, 3.6, -24.0);
}

// door seams and handles on the front of a steel counter running along X (front face at z)
// Dish station on the back wall, left end (x -4.7 … -1.75): a commercial two-bowl sink on legs with a
// pull-down pre-rinse spray, a hood-type dishwasher, and a landing table with racks of clean plates.
function dishStation(g, M, z1, rnd) {
  const steel = M.steelBrushed, shiny = M.steel;
  const dark = std('#2a2e31', { roughness: 0.5 });
  const zb = z1 + 0.02, zf = z1 + 0.74, zc = (zb + zf) / 2, d = zf - zb;
  const deck = 0.93;
  // ---- sink unit: x -4.7 … -3.25
  const sx0 = -4.7, sx1 = -3.25, scx = (sx0 + sx1) / 2;
  for (const [x, z] of [[sx0 + 0.05, zb + 0.06], [sx1 - 0.05, zb + 0.06], [sx0 + 0.05, zf - 0.06], [sx1 - 0.05, zf - 0.06]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.024, 0.62, 10), shiny); leg.position.set(x, 0.31, z); g.add(leg);
  }
  box(g, steel, sx1 - sx0 - 0.04, 0.025, d - 0.06, scx, 0.18, zc);                          // undershelf
  box(g, steel, sx1 - sx0, 0.3, 0.025, scx, 0.62, zf - 0.012);                               // apron front
  // two deep bowls, open at the top (bottom + four walls), set into the deck
  const bw = 0.56, bd = 0.46, by0 = 0.64, bz = zc + 0.03;
  const bowlIn = std('#a9afb4', { metalness: 0.85, roughness: 0.42 });
  for (const bx of [scx - 0.33, scx + 0.33]) {
    box(g, bowlIn, bw, 0.012, bd, bx, by0, bz, { cast: false });
    box(g, bowlIn, 0.012, deck - by0, bd, bx - bw / 2, by0, bz, { cast: false });
    box(g, bowlIn, 0.012, deck - by0, bd, bx + bw / 2, by0, bz, { cast: false });
    box(g, bowlIn, bw, deck - by0, 0.012, bx, by0, bz - bd / 2, { cast: false });
    box(g, bowlIn, bw, deck - by0, 0.012, bx, by0, bz + bd / 2, { cast: false });
    const drain = new THREE.Mesh(new THREE.CircleGeometry(0.035, 16), dark); drain.rotation.x = -Math.PI / 2; drain.position.set(bx, by0 + 0.014, bz); g.add(drain);
  }
  // deck around the bowls (front lip, back ledge, ends, middle divider) + backsplash
  box(g, shiny, sx1 - sx0, 0.03, zf - (bz + bd / 2), scx, deck - 0.03, (zf + bz + bd / 2) / 2, { cast: false });
  box(g, shiny, sx1 - sx0, 0.03, (bz - bd / 2) - zb, scx, deck - 0.03, (zb + bz - bd / 2) / 2, { cast: false });
  for (const x of [sx0 + 0.03, scx, sx1 - 0.03]) box(g, shiny, x === scx ? 0.1 : 0.06, 0.03, bd, x, deck - 0.03, bz, { cast: false });
  box(g, shiny, sx1 - sx0, 0.06, 0.04, scx, deck, zf - 0.02, { cast: false });               // rolled front edge
  box(g, steel, sx1 - sx0, 0.26, 0.025, scx, deck, zb + 0.012);                              // backsplash
  // a gooseneck tap for the left bowl, and the pre-rinse spray (riser, arm, spring, spray head) for the right one
  const tapX = scx - 0.33, sprX = scx + 0.33;
  box(g, shiny, 0.03, 0.22, 0.03, tapX, deck, zb + 0.08, { cast: false });
  const neck = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.013, 8, 18, Math.PI), shiny); neck.position.set(tapX, deck + 0.22, zb + 0.19); neck.rotation.y = Math.PI / 2; g.add(neck);
  const riser = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.66, 10), shiny); riser.position.set(sprX - 0.12, deck + 0.33, zb + 0.07); g.add(riser);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.22, 10), shiny); arm.rotation.z = Math.PI / 2; arm.position.set(sprX - 0.01, deck + 0.64, zb + 0.07); g.add(arm);
  const coil = [];
  for (let i = 0; i <= 120; i++) { const t = i / 120, a = t * Math.PI * 2 * 14; coil.push(new THREE.Vector3(sprX + 0.1 + Math.cos(a) * 0.022, deck + 0.62 - t * 0.34, zb + 0.07 + Math.sin(a) * 0.022)); }
  const spring = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(coil), 240, 0.0035, 5, false), shiny); g.add(spring);
  const hose = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.34, 8), dark); hose.position.set(sprX + 0.1, deck + 0.45, zb + 0.07); g.add(hose);
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.022, 0.1, 14), shiny); head.position.set(sprX + 0.1, deck + 0.24, zb + 0.07); g.add(head);
  box(g, std('#1f6fb5', { roughness: 0.5 }), 0.012, 0.035, 0.02, sprX + 0.1 + 0.03, deck + 0.26, zb + 0.07, { cast: false });   // blue squeeze handle
  // a few plates and a bowl soaking in the left bowl, a stack of dirty bowls on the deck
  const plateGeo = new THREE.CylinderGeometry(0.12, 0.1, 0.014, 24);
  const plateMat = std('#f3f1ec', { roughness: 0.3 });
  for (let i = 0; i < 4; i++) { const pl = new THREE.Mesh(plateGeo, plateMat); pl.position.set(tapX - 0.12 + i * 0.07, by0 + 0.12, bz); pl.rotation.set(0.15, 0, Math.PI / 2 - 0.3); g.add(pl); }
  const bowlGeo = new THREE.CylinderGeometry(0.075, 0.05, 0.06, 18, 1, true);
  for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(bowlGeo, std('#ece8e0', { roughness: 0.3, side: THREE.DoubleSide })); b.position.set(sx0 + 0.12, deck + 0.03 + i * 0.03, zb + 0.16); g.add(b); }

  // ---- hood-type dishwasher: x -3.25 … -2.55
  const dx = -2.9, dw = 0.7;
  for (const [x, z] of [[dx - 0.3, zb + 0.08], [dx + 0.3, zb + 0.08], [dx - 0.3, zf - 0.08], [dx + 0.3, zf - 0.08]]) box(g, shiny, 0.04, 0.08, 0.04, x, 0, z, { cast: false });
  box(g, steel, dw, 0.82, d, dx, 0.08, zc);                                                   // wash tank
  box(g, shiny, dw - 0.04, 0.6, 0.012, dx, 0.12, zf + 0.004, { cast: false });                // front panel
  box(g, dark, dw - 0.1, 0.11, 0.014, dx, 0.74, zf + 0.008, { cast: false });                 // control strip
  box(g, std('#0d1612', { roughness: 0.2 }), 0.12, 0.05, 0.016, dx - 0.14, 0.77, zf + 0.009, { cast: false });
  box(g, std('#7cf0a8', { emissive: '#4fe08a', emissiveIntensity: 0.9 }), 0.08, 0.025, 0.018, dx - 0.14, 0.783, zf + 0.009, { cast: false });   // green display
  for (const [bx, col] of [[dx + 0.06, '#3cc46a'], [dx + 0.14, '#d64545'], [dx + 0.22, '#e8e8e8']]) {
    const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.012, 14), std(col, { roughness: 0.35 })); btn.rotation.x = Math.PI / 2; btn.position.set(bx, 0.795, zf + 0.018); g.add(btn);
  }
  // the hood (closed) with its lifting handle, sitting on the tank
  rb(g, steel, dw + 0.02, 0.6, d - 0.02, dx, 0.9, zc, 0.02);
  box(g, shiny, dw - 0.16, 0.025, 0.03, dx, 1.02, zf + 0.01, { cast: false });
  for (const s of [-1, 1]) box(g, shiny, 0.025, 0.07, 0.03, dx + s * (dw / 2 - 0.08), 0.98, zf - 0.005, { cast: false });
  box(g, shiny, dw - 0.06, 0.03, d - 0.08, dx, 1.5, zc, { cast: false });                      // top cap
  label(g, [{ text: 'DISHWASHER', font: F.round, size: 54, color: '#1d5f5a', y: 0.42, weight: 600 }, { text: '식기세척기 · 85°C rinse', font: F.cute, size: 34, color: '#5b6b6a', y: 0.78 }], 0.44, 0.12, dx, 1.3, zf + 0.002, 0, { px: 512 });

  // ---- landing table on the clean side (on the counter run, x -2.55 … -1.75): racks of clean plates and cups
  const rackMat = std('#5b7894', { roughness: 0.6 });
  const rack = (x, y, z) => {
    box(g, rackMat, 0.46, 0.012, 0.46, x, y, z, { cast: false });
    for (const s of [-1, 1]) { box(g, rackMat, 0.46, 0.08, 0.012, x, y, z + s * 0.224, { cast: false }); box(g, rackMat, 0.012, 0.08, 0.46, x + s * 0.224, y, z, { cast: false }); }
  };
  rack(-2.2, deck + 0.012, zc);
  const plate = new THREE.CylinderGeometry(0.115, 0.095, 0.012, 24);
  for (let i = 0; i < 9; i++) { const pl = new THREE.Mesh(plate, plateMat); pl.position.set(-2.38 + i * 0.045, deck + 0.13, zc); pl.rotation.z = Math.PI / 2; g.add(pl); }
  rack(-2.2, deck + 0.105, zc + 0.02);
  const cup = new THREE.CylinderGeometry(0.035, 0.03, 0.08, 14);
  const cupMat = std('#f6f4ef', { roughness: 0.25 });
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { const c = new THREE.Mesh(cup, cupMat); c.position.set(-2.35 + i * 0.1, deck + 0.157, zc - 0.12 + j * 0.12); c.rotation.x = Math.PI; g.add(c); }
  // clean plates stacked on the shelf above, ready for the pass
  for (const x of [-4.3, -3.95, -2.3]) for (let i = 0; i < 9; i++) { const pl = new THREE.Mesh(plate, plateMat); pl.position.set(x, 1.79 + i * 0.014, z1 + 0.24); g.add(pl); }
  // sign over the station
  label(g, [{ text: 'DISH WASH', font: F.round, size: 64, color: '#ffffff', y: 0.4, weight: 600 }, { text: '설거지 · غسيل الصحون', font: `${F.cute}, ${F.arabic}`, size: 44, color: '#e8fbf8', y: 0.76 }], 0.62, 0.23, -4.2, 1.45, z1 + 0.012, 0, { bg: '#2f8f8a', border: '#ffffff' });
}

function cabinetFront(g, M, x0, x1, z, h = 0.86, doorW = 0.75) {
  const dark = std('#3a3f42', { roughness: 0.6 });
  for (let x = x0 + doorW; x < x1 - 0.1; x += doorW) box(g, dark, 0.008, h - 0.14, 0.004, x, 0.1, z, { cast: false });
  for (let x = x0 + doorW / 2; x < x1; x += doorW) box(g, M.steel, 0.16, 0.018, 0.03, x, h - 0.16, z + 0.012, { cast: false });
  box(g, dark, x1 - x0, 0.09, 0.004, (x0 + x1) / 2, 0, z, { cast: false });   // kick plate
}

function faucet(g, M, x, z) {
  const pipe = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 8, 16, Math.PI), M.steel); pipe.position.set(x, 1.1, z + 0.05); pipe.rotation.y = Math.PI / 2; g.add(pipe);
  box(g, M.steel, 0.03, 0.2, 0.03, x, 0.92, z - 0.05, { cast: false });
}
function microwave(g, x, y, z) {
  rb(g, std('#e9eaea', { roughness: 0.35 }), 0.5, 0.3, 0.38, x, y, z, 0.01);
  box(g, std('#151a1d', { roughness: 0.1, metalness: 0.3 }), 0.32, 0.2, 0.01, x - 0.06, y + 0.05, z + 0.19, { cast: false });
  box(g, std('#78e0a0', { emissive: '#78e0a0', emissiveIntensity: 0.8 }), 0.06, 0.025, 0.012, x + 0.17, y + 0.22, z + 0.19, { cast: false });
}
function vegetables(g, x, y, z, rnd) {
  // cucumbers, cabbage, carrots, onions, peppers — simple, believable shapes
  const cuc = new THREE.CapsuleGeometry(0.022, 0.18, 4, 10).rotateZ(Math.PI / 2);
  const cm = std('#3e6b2a', { roughness: 0.5 });
  for (let i = 0; i < 4; i++) { const c = new THREE.Mesh(cuc, cm); c.position.set(x - 0.6 + i * 0.05, y + 0.022, z - 0.05 + i * 0.03); c.rotation.y = 0.2 * i; g.add(c); }
  const cab = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), std('#c9dfa3', { roughness: 0.65 })); cab.scale.set(1, 0.85, 1); cab.position.set(x + 0.55, y + 0.09, z); g.add(cab);
  const carrot = new THREE.ConeGeometry(0.018, 0.17, 8).rotateZ(Math.PI / 2);
  for (let i = 0; i < 5; i++) { const c = new THREE.Mesh(carrot, std('#e8762c')); c.position.set(x + 0.25, y + 0.02, z - 0.12 + i * 0.035); c.rotation.y = rnd() * 0.4; g.add(c); }
  for (let i = 0; i < 3; i++) { const o = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 10), std(i ? '#e8d8b8' : '#7a3b6b', { roughness: 0.5 })); o.position.set(x - 0.25 + i * 0.08, y + 0.035, z + 0.12); g.add(o); }
  // a bowl of sliced cucumber ready for the salad
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.12, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), std('#c7cacc', { metalness: 0.9, roughness: 0.25, side: THREE.DoubleSide }));
  bowl.position.set(x - 0.1, y + 0.12, z + 0.0); g.add(bowl);
}
function shelving(g, M, x, z, ry, bins) {
  const grp = new THREE.Group(); grp.position.set(x, 0, z); grp.rotation.y = ry; g.add(grp);
  for (const y of [0.3, 0.8, 1.3, 1.8]) box(grp, M.steel, 1.6, 0.03, 0.45, 0, y, 0, { cast: false });
  for (const sx of [-0.78, 0.78]) box(grp, M.steel, 0.03, 2.0, 0.45, sx, 0, 0, { cast: false });
  bins.forEach(([en, ko], i) => {
    const bx = -0.55 + (i % 4) * 0.37;
    box(grp, std('#f4f6f5', { transparent: true, opacity: 0.9, roughness: 0.2 }), 0.32, 0.3, 0.38, bx, 1.33, 0, { cast: false });
    const tex = T.sign({ w: 256, h: 128, bg: '#ffffff', border: '#2f8f8a', borderW: 6, aged: 0, seed: 70 + i, lines: [{ text: en, font: F.round, size: 40, color: '#1d5f5a', y: 0.38, weight: 600 }, { text: ko, font: F.cute, size: 34, color: '#5b6b6a', y: 0.75 }] });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.1), signMaterial(tex, { glow: 0.1 }));
    m.position.set(bx, 1.48, 0.195); m.userData.keep = true; grp.add(m);
  });
  for (let i = 0; i < 6; i++) box(grp, std('#f1e9d8', { roughness: 0.8 }), 0.22, 0.32, 0.3, -0.6 + i * 0.24, 0.33, 0, { cast: false });
}
