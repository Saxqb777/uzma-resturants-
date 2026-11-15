// The cashier corner (front right): cute pink & teal pay counter based on her inspo
// (wood slat counter, black dome pendants, a plant post wrapped in vines, signs on the
// counter), a big polaroid wall behind the cashier, and a small separated 2-seat nook.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { box, InstanceBatch, spotLight, mergeStatic } from './helpers.js';
import * as T from './textures.js';
import { signMaterial } from './materials.js';
import { LAYOUT as L, MENU, MEAL_DEAL, RESTAURANT, FONTS } from './config.js';
import { leafGeometry, leafMaterial, LEAF_COLORS } from './foliage.js';

const PINK = '#f2a7c3', PINK2 = '#e889ab', TEAL = '#5fc2b8', TEAL2 = '#2f8f8a', CREAM = '#f8f0e3';

// Where things are (shared with the people/story code)
export const CASHIER = {
  counter: { x0: 5.35, x1: 5.95, z0: -1.8, z1: -4.3, top: 1.05 },
  staff: { x: 6.42, z: -2.55, ry: -Math.PI / 2 },             // cashier 1 stands here, facing the customers (-x)
  staff2: { x: 6.42, z: -3.65, ry: -Math.PI / 2 },            // cashier 2
  registers: [-2.55, -3.65],
  board: { x: 7.49, z0: -1.9, z1: -4.45, y0: 1.05, y1: 3.05 }, // cork polaroid board on the right wall
  pinSpot: { x: 7.45, y: 1.66, z: -2.12 },                    // empty spot where the new polaroid goes
  pinStand: { x: 7.08, z: -2.12, ry: Math.PI / 2 },            // where the photographer stands to pin it
  nook: { x: 5.3, z: -0.85 },
};

let polaroidPhotos = [];   // HTMLImageElements of the AI customer photos (filled by loadPolaroidPhotos)
const menuPhotos = {};     // dish photos for the menus, by MENU key
const MENU_PHOTO_FILES = {
  deal: 'menu/meal-deal', spicy_chicken: 'food/spicy-chicken', bulgogi: 'menu/beef-bulgogi', chicken_bulgogi: 'menu/chicken-bulgogi',
  bibimbap: 'menu/bibimbap', japchae: 'menu/japchae', tteokbokki: 'menu/tteokbokki', kimchi_fried_rice: 'menu/kimchi-fried-rice',
  fried_chicken: 'menu/korean-fried-chicken', 'Peach Iced Tea': 'menu/peach-iced-tea', 'Strawberry Milk': 'menu/strawberry-milk',
};
function loadImg(src) { return new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; }); }
async function loadMenuPhotos() {
  await Promise.all(Object.entries(MENU_PHOTO_FILES).map(async ([k, f]) => { const im = await loadImg(`assets/ai/${f}.jpg`); if (im) menuPhotos[k] = im; }));
}
// round-cornered photo helper for menus
function photo(c, im, x, y, w, h, r = 14) {
  if (!im) return;
  const s = Math.max(w / im.width, h / im.height);
  c.save(); c.beginPath(); c.roundRect(x, y, w, h, r); c.clip();
  c.drawImage(im, x + (w - im.width * s) / 2, y + (h - im.height * s) / 2, im.width * s, im.height * s);
  c.restore();
}

export async function loadPolaroidPhotos() {
  let files = [];
  try {
    const m = await (await fetch('assets/ai/manifest.json')).json();
    const list = Array.isArray(m) ? m : m.files || m.items || [];
    files = list.filter((e) => /polaroid/i.test(e.category || e.file || '')).map((e) => e.file || e.path);
  } catch { /* no manifest yet */ }
  const imgs = await Promise.all(files.slice(0, 48).map((f) => new Promise((res) => {
    const im = new Image();
    im.onload = () => res(im); im.onerror = () => res(null);
    im.src = f.startsWith('assets/') ? f : `assets/ai/${f.replace(/^\.?\//, '')}`;
  })));
  polaroidPhotos = imgs.filter(Boolean);
  await loadMenuPhotos();
  return polaroidPhotos.length;
}

const CAPTIONS = ['best night!', 'Seoulicious ♥', 'family dinner', '맛있다!', 'BFFs', 'again soon!', 'first K-BBQ!',
  'Happy Birthday!', 'team dinner', '사랑해요', 'so yummy', 'date night', 'Eid dinner', 'graduation!', 'Friday feast',
  'grill masters', '최고!', 'girls night', 'with grandma', 'yum yum', 'cheese!', 'Abu Dhabi ♥ Seoul'];

// One canvas atlas holds every polaroid (frame + photo + handwritten caption) → one material for the whole wall
function polaroidAtlas() {
  const cols = 8, rows = 6, cw = 256, ch = 320;
  const [c, ctx] = T.makeCanvas(cols * cw, rows * ch);
  const r = T.rng(77);
  for (let i = 0; i < cols * rows; i++) {
    const x = (i % cols) * cw, y = Math.floor(i / cols) * ch;
    ctx.fillStyle = '#fbfaf5'; ctx.fillRect(x, y, cw, ch);
    const g = ctx.createLinearGradient(x, y, x + cw, y + ch);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.07)');
    ctx.fillStyle = g; ctx.fillRect(x, y, cw, ch);
    const px = x + 16, py = y + 16, pw = cw - 32, ph = cw - 32;
    const img = polaroidPhotos.length ? polaroidPhotos[i % polaroidPhotos.length] : null;
    if (img) {
      const s = Math.min(img.width, img.height);
      const flip = i >= polaroidPhotos.length && i % 2;      // reused photos are mirrored so repeats don't read
      ctx.save();
      if (flip) { ctx.translate(px + pw, py); ctx.scale(-1, 1); ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, pw, ph); }
      else ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, px, py, pw, ph);
      ctx.restore();
    } else {
      const gg = ctx.createLinearGradient(px, py, px, py + ph);
      gg.addColorStop(0, `hsl(${20 + r() * 30},55%,${45 + r() * 15}%)`); gg.addColorStop(1, '#2a1a12');
      ctx.fillStyle = gg; ctx.fillRect(px, py, pw, ph);
    }
    // instant-film look: slight warm wash + soft vignette
    ctx.fillStyle = 'rgba(255,200,150,0.06)'; ctx.fillRect(px, py, pw, ph);
    const v = ctx.createRadialGradient(px + pw / 2, py + ph / 2, pw * 0.3, px + pw / 2, py + ph / 2, pw * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.28)');
    ctx.fillStyle = v; ctx.fillRect(px, py, pw, ph);
    // handwritten caption
    ctx.fillStyle = ['#2a2a2a', '#c23b6a', '#1f6d66'][i % 3];
    ctx.font = `34px ${FONTS.pen}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(CAPTIONS[i % CAPTIONS.length], x + cw / 2, y + cw + 28);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return { tex: t, cols, rows };
}

// Many polaroid quads in one geometry. items: [{x,y,z, ry, rz, cell, s}]
function polaroidMesh(items, atlas, mat) {
  const w = 0.088, h = 0.11;
  const pos = [], uv = [], idx = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3();
  items.forEach((it, k) => {
    q.setFromEuler(new THREE.Euler(it.rx || 0, it.ry || 0, it.rz || 0, 'YXZ'));
    m.compose(new THREE.Vector3(it.x, it.y, it.z), q, new THREE.Vector3(it.s || 1, it.s || 1, 1));
    const c = it.cell % (atlas.cols * atlas.rows);
    const u0 = (c % atlas.cols) / atlas.cols, u1 = u0 + 1 / atlas.cols;
    const v1 = 1 - Math.floor(c / atlas.cols) / atlas.rows, v0 = v1 - 1 / atlas.rows;
    for (const [px, py, uu, vv] of [[-w / 2, -h / 2, u0, v0], [w / 2, -h / 2, u1, v0], [w / 2, h / 2, u1, v1], [-w / 2, h / 2, u0, v1]]) {
      v.set(px, py, 0).applyMatrix4(m); pos.push(v.x, v.y, v.z); uv.push(uu, vv);
    }
    const b = k * 4; idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, mat);
  mesh.receiveShadow = true;
  return mesh;
}

// ------------------------------------------------------------------ helpers for cute props
const rgeo = new Map();
function rb(parent, mat, w, h, d, x, y, z, r = 0.01) {
  const k = `${w}|${h}|${d}|${r}`;
  if (!rgeo.has(k)) rgeo.set(k, new RoundedBoxGeometry(w, h, d, 2, r));
  const m = new THREE.Mesh(rgeo.get(k), mat); m.position.set(x, y + h / 2, z); m.castShadow = true; m.receiveShadow = true;
  parent.add(m); return m;
}
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o });
function sphere(parent, mat, r, x, y, z, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; parent.add(m); return m;
}
function card(parent, tex, w, h, x, y, z, ry = 0, glow = 0.15) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), signMaterial(tex, { glow }));
  m.position.set(x, y, z); m.rotation.y = ry; m.userData.keep = true; parent.add(m); return m;
}

// ------------------------------------------------------------------ build
export function buildCashier(ctx) {
  const { scene, mats: M } = ctx;
  const W = (k, fb) => M[k] || M[fb];
  const g = new THREE.Group(); g.name = 'interior'; scene.add(g);
  const C = CASHIER.counter, F = FONTS;
  const pink = std(PINK), teal = std(TEAL2), cream = std(CREAM), white = std('#fbfbf8', { roughness: 0.35 });
  const blackMetal = W('metalBlack', 'blackSteel');

  // ---- counter: oak slats front, terrazzo top, rounded end
  const zc = (C.z0 + C.z1) / 2, len = C.z0 - C.z1;
  box(g, W('woodOakV', 'woodBoothV'), C.x1 - C.x0, C.top - 0.04, len, (C.x0 + C.x1) / 2, 0, zc, { uv: 1 });
  for (let z = C.z1 + 0.06; z < C.z0; z += 0.09) box(g, M.woodDark, 0.012, C.top - 0.12, 0.012, C.x0 - 0.006, 0.06, z, { cast: false });
  rb(g, W('terrazzo', 'ceramic'), C.x1 - C.x0 + 0.12, 0.04, len + 0.1, (C.x0 + C.x1) / 2 - 0.04, C.top - 0.04, zc, 0.012);
  box(g, teal, 0.02, 0.06, len, C.x0 - 0.01, 0, zc, { cast: false });                      // teal kick strip
  // back counter + shelf under the polaroid board (only the back half, so staff can reach the board)
  box(g, W('woodOak', 'woodBooth'), 0.5, 0.9, 1.0, 7.25, 0, -3.78);
  rb(g, W('terrazzo', 'ceramic'), 0.54, 0.035, 1.04, 7.24, 0.9, -3.78, 0.01);
  // soft-drink & juice fridge (no alcohol)
  fridge(g, M, 7.2, -4.65);

  // ---- canopy over the counter with a scalloped pink/teal valance (her inspo) + bunting
  box(g, M.woodDark, 0.14, 0.14, 2.9, 5.2, 2.62, -3.05);
  box(g, M.woodDark, 2.3, 0.14, 0.14, 6.35, 2.62, -1.65);
  box(g, M.woodDark, 2.3, 0.14, 0.14, 6.35, 2.62, -4.45);
  const scallop = scallopTexture();
  const val = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 0.32), new THREE.MeshStandardMaterial({ map: scallop, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.7 }));
  val.position.set(5.12, 2.5, -3.05); val.rotation.y = -Math.PI / 2; g.add(val);
  bunting(g, [5.1, 2.58, -1.6], [5.1, 2.58, -4.5], 15);
  // pendant dome lamps (black, warm glow)
  for (const z of [-2.25, -3.05, -3.85]) pendant(g, M, 5.7, 2.1, z, 2.62);
  // hanging paper lanterns, pink & teal
  [[4.75, 2.55, -2.0, PINK], [4.8, 2.35, -2.9, TEAL], [4.7, 2.6, -3.7, PINK], [4.95, 2.45, -4.4, TEAL]].forEach(([x, y, z, col]) => lantern(g, M, x, y, z, col));

  // ---- plant post wrapped in vines at the counter's front corner
  box(g, M.woodDarkV, 0.16, L.ceil, 0.16, 5.2, 0, -4.55);
  box(g, M.woodDarkV, 0.14, 2.62, 0.14, 5.2, 0, -1.62);   // front corner post (rises out of the planter)
  vines(g, 5.2, -4.55, 0.12, 0.2, L.ceil - 0.2, 260, 11);

  // ---- things on the counter: two registers, each with a card machine, and cute bits in between
  const top = C.top;
  for (const rz of CASHIER.registers) {
    pos(g, M, 5.62, top, rz, F);
    rb(g, std('#2b2d33', { roughness: 0.4 }), 0.09, 0.03, 0.16, 5.47, top, rz - 0.3, 0.01);        // card machine
  }
  menuStack(g, 5.5, top, -1.98, F);
  plush(g, 'bunny', 5.82, top, -1.98, -Math.PI / 2 - 0.4);
  sphere(g, std('#d8b45a', { metalness: 0.9, roughness: 0.3 }), 0.035, 5.45, top + 0.03, -2.2, 1, 0.8, 1);  // service bell
  card(g, qrTexture(F), 0.12, 0.17, 5.42, top + 0.1, -3.02, -Math.PI / 2 + 0.2);                  // QR pay stand
  box(g, std('#d9eef0', { transparent: true, opacity: 0.4 }), 0.02, 0.18, 0.13, 5.44, top, -3.02, { cast: false, receive: false });
  card(g, wifiTexture(F), 0.14, 0.1, 5.42, top + 0.06, -3.22, -Math.PI / 2 - 0.15);               // Free WiFi
  instax(g, 5.64, top, -3.1);
  candyJar(g, 5.84, top, -3.12);
  card(g, polaroidPriceTexture(F), 0.16, 0.2, 5.43, top + 0.11, -4.05, -Math.PI / 2 - 0.2, 0.2);  // Polaroid AED 5
  donationBox(g, 5.58, top, -4.2, F);
  plush(g, 'bear', 5.84, top, -4.15, -Math.PI / 2 + 0.3);
  for (const [x, z, col] of [[5.84, -2.22, '#f6c9d8'], [5.84, -2.86, '#bfe7e2'], [5.84, -3.4, '#f8e3b5']]) succulent(g, x, top, z, col);
  card(g, thanksTexture(F), 0.2, 0.08, 5.33, top + 0.045, -3.1, -Math.PI / 2, 0.15);              // "thank you" strip on the counter edge

  // ---- cute menu easel where the queue forms
  menuEasel(g, M, 4.5, -4.72, -0.55, F);
  // pink/teal round rug in front of the counter
  const rug = new THREE.Mesh(new THREE.CircleGeometry(1.0, 40), new THREE.MeshStandardMaterial({ map: rugTexture(), roughness: 0.95 }));
  rug.rotation.x = -Math.PI / 2; rug.position.set(4.5, 0.004, -3.05); rug.receiveShadow = true; g.add(rug);

  // ---- the polaroid wall
  polaroidWall(g, M);

  // ---- separated 2-seat nook by the front window
  nook(g, M, W);

  // light the board so the photos read
  spotLight(g, '#ffe2c8', 14, 6, [5.3, 3.6, -3.1], [7.5, 2.0, -3.1], { angle: 0.75, penumbra: 0.9 });

  mergeStatic(g);
  return g;
}

// ------------------------------------------------------------------ pieces
function fridge(g, M, x, z) {
  box(g, M.steelBrushed, 0.55, 0.12, 0.6, x, 0, z);
  box(g, M.steelBrushed, 0.55, 0.12, 0.6, x, 1.78, z);
  box(g, M.steelBrushed, 0.55, 1.66, 0.04, x, 0.12, z + 0.28);
  box(g, M.steelBrushed, 0.55, 1.66, 0.04, x, 0.12, z - 0.28);
  const back = new THREE.MeshStandardMaterial({ color: '#a8c6dc', emissive: '#9cc4e8', emissiveIntensity: 0.35 });
  box(g, back, 0.03, 1.66, 0.52, x + 0.26, 0.12, z, { cast: false });
  const glass = box(g, M.glass, 0.02, 1.66, 0.52, x - 0.27, 0.12, z, { cast: false, receive: false });
  glass.userData.keep = true;
  // shelves of colourful soft drinks and juices
  const can = new THREE.CylinderGeometry(0.033, 0.033, 0.12, 12);
  const bottle = new THREE.CylinderGeometry(0.028, 0.032, 0.2, 12);
  const cols = ['#d6283a', '#f2b632', '#3ba55c', '#ff8c42', '#e05a9a', '#4fb3d9', '#f4e04d'];
  const batches = cols.map((c) => new InstanceBatch(can, new THREE.MeshStandardMaterial({ color: c, roughness: 0.3, metalness: 0.6 }), { cast: false }));
  const jb = cols.map((c) => new InstanceBatch(bottle, new THREE.MeshStandardMaterial({ color: c, roughness: 0.15, transparent: true, opacity: 0.85 }), { cast: false }));
  let k = 0;
  for (const y of [0.3, 0.72, 1.14, 1.5]) {
    box(g, M.steel, 0.45, 0.012, 0.5, x, y - 0.012, z, { cast: false });
    for (let zz = z - 0.2; zz <= z + 0.21; zz += 0.075) {
      const useBottle = y > 1.0;
      (useBottle ? jb : batches)[k++ % cols.length].add(x - 0.12, y + (useBottle ? 0.1 : 0.06), zz);
    }
  }
  [...batches, ...jb].forEach((b) => b.build(g));
}

function pendant(g, M, x, y, z, topY) {
  const shade = new THREE.Mesh(new THREE.LatheGeometry([[0.01, 0.17], [0.05, 0.16], [0.13, 0.08], [0.17, 0.0], [0.165, -0.005], [0.125, 0.075], [0.045, 0.15], [0.01, 0.16]].map(([a, b]) => new THREE.Vector2(a, b)), 28), new THREE.MeshStandardMaterial({ color: '#16171a', roughness: 0.45, metalness: 0.5, side: THREE.DoubleSide }));
  shade.position.set(x, y, z); shade.castShadow = true; g.add(shade);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), M.bulb); bulb.position.set(x, y + 0.04, z); g.add(bulb);
  box(g, M.cord, 0.008, topY - y - 0.17, 0.008, x, y + 0.17, z, { cast: false });
}

function lantern(g, M, x, y, z, col) {
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 14), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.35, roughness: 0.85 }));
  body.scale.set(1, 1.15, 1); body.position.set(x, y, z); g.add(body);
  const ribs = new THREE.Mesh(new THREE.SphereGeometry(0.162, 16, 6), new THREE.MeshBasicMaterial({ color: '#ffffff', wireframe: true, transparent: true, opacity: 0.25 }));
  ribs.scale.set(1, 1.15, 1); ribs.position.copy(body.position); g.add(ribs);
  for (const dy of [0.18, -0.18]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 12), M.blackSteel); r.position.set(x, y + dy, z); g.add(r); }
  box(g, M.cord, 0.006, 2.62 - y - 0.19, 0.006, x, y + 0.19, z, { cast: false });
  const tassel = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.12, 8), std(col === PINK ? PINK2 : TEAL2)); tassel.position.set(x, y - 0.27, z); g.add(tassel);
}

function bunting(g, a, b, n) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const tri = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.06, 0, 0), new THREE.Vector3(0.06, 0, 0), new THREE.Vector3(0, -0.13, 0)]);
  tri.computeVertexNormals();
  const cols = [PINK, TEAL, CREAM, '#f6d06b'];
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, p = A.clone().lerp(B, t); p.y -= Math.sin(t * Math.PI) * 0.12;
    pts.push(p);
    if (i < n) {
      const m = new THREE.Mesh(tri, new THREE.MeshStandardMaterial({ color: cols[i % 4], side: THREE.DoubleSide, roughness: 0.9 }));
      m.position.copy(p); m.lookAt(p.clone().add(new THREE.Vector3(-1, 0, 0))); g.add(m);
    }
  }
  g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#f4efe6' })));
}

// trailing vines spiralling around a post (leaf quads), green with lighter tips
function vines(g, x, z, r0, y0, y1, n, seed) {
  const r = T.rng(seed);
  const batches = LEAF_COLORS.map((c) => new InstanceBatch(leafGeometry(), leafMaterial(c), { cast: true }));
  for (let i = 0; i < n; i++) {
    const t = i / n, a = t * Math.PI * 9 + r() * 0.8, y = y0 + t * (y1 - y0) + (r() - 0.5) * 0.1;
    const rr = r0 + r() * 0.07;
    batches[i % batches.length].add(x + Math.cos(a) * rr, y, z + Math.sin(a) * rr, { rx: (r() - 0.5) * 1.2, ry: -a + (r() - 0.5), rz: (r() - 0.5) * 1.2, s: 0.7 + r() * 0.7 });
  }
  batches.forEach((b) => b.build(g));
}
export { vines };

let posScreen = null;
function pos(g, M, x, y, z, F) {
  rb(g, std('#fdf7f9', { roughness: 0.35 }), 0.24, 0.07, 0.3, x, y, z, 0.02);          // base, cream-white
  rb(g, std(PINK, { roughness: 0.4 }), 0.05, 0.12, 0.06, x + 0.02, y + 0.07, z, 0.01);  // neck
  const screen = new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.22, 0.3, 2, 0.012), [std(PINK), std(PINK), std(PINK), std(PINK), std(PINK), std(PINK)]);
  screen.position.set(x - 0.01, y + 0.27, z); screen.rotation.z = -0.32; g.add(screen);
  const ui = posScreen || (posScreen = T.sign({ w: 384, h: 288, bg: '#fff7fb', border: null, aged: 0, fonts: [{ font: F.round, text: 'Seoulicious POS Meal Deal Bulgogi Bibimbap Iced Tea Polaroid Rice Total AED 64.00' }], draw: (c, w, h) => {
    c.fillStyle = '#f6c3d6'; c.fillRect(0, 0, w, 40);
    c.fillStyle = '#ffffff'; c.font = `26px ${F.round}`; c.fillText('Seoulicious  POS', 14, 28);
    const tiles = [['Meal Deal', '#f2a7c3'], ['Bulgogi', '#9fd9d2'], ['Bibimbap', '#f8d98a'], ['Iced Tea', '#c9b6ef'], ['Polaroid', '#ffc4a8'], ['Rice', '#d6eec7']];
    tiles.forEach(([t, col], i) => { const tx = 12 + (i % 3) * 120, ty = 54 + Math.floor(i / 3) * 86; c.fillStyle = col; c.beginPath(); c.roundRect(tx, ty, 110, 76, 12); c.fill(); c.fillStyle = '#3b2a33'; c.font = `20px ${F.round}`; c.fillText(t, tx + 10, ty + 44); });
    c.fillStyle = '#2f8f8a'; c.beginPath(); c.roundRect(12, 230, 360, 46, 12); c.fill(); c.fillStyle = '#fff'; c.font = `24px ${F.round}`; c.fillText('Total  AED 64.00', 24, 262);
  } }));
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.27, 0.2), new THREE.MeshStandardMaterial({ map: ui, emissive: '#ffffff', emissiveMap: ui, emissiveIntensity: 0.55, roughness: 0.25 }));
  scr.position.set(x - 0.027, y + 0.27, z); scr.rotation.set(0, -Math.PI / 2, 0); scr.rotateX(-0.32); g.add(scr);
}

function qrTexture(F) {
  return T.sign({ w: 240, h: 340, bg: '#ffffff', border: '#2f8f8a', borderW: 10, aged: 0, seed: 3, fonts: [{ font: F.round, text: 'Scan to pay' }],
    draw: (c, w) => {
      const r = T.rng(9), n = 21, s = 8, ox = (w - n * s) / 2, oy = 60;
      c.fillStyle = '#111';
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (r() < 0.48) c.fillRect(ox + i * s, oy + j * s, s, s);
      for (const [a, b] of [[0, 0], [n - 7, 0], [0, n - 7]]) { c.fillRect(ox + a * s, oy + b * s, 7 * s, 7 * s); c.fillStyle = '#fff'; c.fillRect(ox + (a + 1) * s, oy + (b + 1) * s, 5 * s, 5 * s); c.fillStyle = '#111'; c.fillRect(ox + (a + 2) * s, oy + (b + 2) * s, 3 * s, 3 * s); }
      c.fillStyle = '#2f8f8a'; c.font = `30px ${F.round}`; c.textAlign = 'center'; c.fillText('Scan to pay', w / 2, 40);
      c.fillStyle = '#e889ab'; c.font = `22px ${F.round}`; c.fillText('Apple Pay · Card · Cash', w / 2, 300);
    } });
}
function wifiTexture(F) {
  return T.sign({ w: 320, h: 230, bg: '#2f8f8a', border: '#f8f0e3', borderW: 10, aged: 0, seed: 4,
    lines: [
      { text: 'Free WiFi', font: F.round, size: 52, color: '#ffffff', y: 0.32, weight: 600 },
      { text: 'Seoulicious_Guest', font: F.round, size: 28, color: '#f8f0e3', y: 0.62 },
      { text: 'pw: kimchi2026', font: F.round, size: 26, color: '#f2a7c3', y: 0.82 },
    ] });
}
function polaroidPriceTexture(F) {
  return T.sign({ w: 320, h: 400, bg: '#fff3f7', border: '#e889ab', borderW: 12, aged: 0, seed: 5,
    fonts: [{ font: F.cute, text: '폴라로이드' }],
    draw: (c, w) => {
      c.save(); c.translate(w / 2, 150); c.rotate(-0.08);
      c.fillStyle = '#ffffff'; c.shadowColor = 'rgba(0,0,0,0.25)'; c.shadowBlur = 8; c.fillRect(-70, -90, 140, 170); c.shadowBlur = 0;
      const gr = c.createLinearGradient(0, -78, 0, 50); gr.addColorStop(0, '#f6b5c9'); gr.addColorStop(1, '#5fc2b8');
      c.fillStyle = gr; c.fillRect(-58, -78, 116, 116);
      c.fillStyle = '#fff'; c.beginPath(); c.arc(-14, -20, 12, 0, 7); c.arc(14, -20, 12, 0, 7); c.fill();
      c.restore();
    },
    lines: [
      { text: 'Polaroid Picture', font: F.round, size: 36, color: '#c23b6a', y: 0.67, weight: 600 },
      { text: 'AED 5', font: F.round, size: 64, color: '#2f8f8a', y: 0.8, weight: 600 },
      { text: '폴라로이드 · keep the memory!', font: F.cute, size: 22, color: '#7a5864', y: 0.93 },
    ] });
}
function thanksTexture(F) {
  return T.sign({ w: 600, h: 240, bg: '#f2a7c3', border: null, aged: 0, seed: 6,
    lines: [{ text: 'Thank you · 감사합니다 · شكراً', font: `${F.cute}, ${F.arabic}`, size: 52, color: '#ffffff', y: 0.52 }],
    fonts: [{ font: F.arabic, text: 'شكراً' }] });
}
function donationBox(g, x, y, z, F) {
  const acrylic = new THREE.MeshStandardMaterial({ color: '#e8f6f6', roughness: 0.05, transparent: true, opacity: 0.32 });
  const bx = box(g, acrylic, 0.16, 0.18, 0.16, x, y, z, { cast: false, receive: false }); bx.userData.keep = true;
  const coin = new THREE.CylinderGeometry(0.012, 0.012, 0.003, 14);
  const gold = new THREE.MeshStandardMaterial({ color: '#d8b45a', metalness: 0.9, roughness: 0.35 });
  const notes = new THREE.MeshStandardMaterial({ color: '#8fc0a8', roughness: 0.8 });
  const r = T.rng(12);
  for (let i = 0; i < 26; i++) { const m = new THREE.Mesh(coin, gold); m.position.set(x + (r() - 0.5) * 0.12, y + 0.004 + r() * 0.05, z + (r() - 0.5) * 0.12); m.rotation.set(r(), r(), r()); g.add(m); }
  for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.002, 0.05), notes); m.position.set(x + (r() - 0.5) * 0.06, y + 0.05 + r() * 0.04, z + (r() - 0.5) * 0.06); m.rotation.set(r() * 0.6, r() * 3, r() * 0.6); g.add(m); }
  const lab = T.sign({ w: 360, h: 300, bg: '#ffffff', border: '#2f8f8a', borderW: 10, aged: 0, seed: 7,
    fonts: [{ font: F.arabic, text: 'تبرعات' }, { font: F.cute, text: '감사합니다' }],
    lines: [
      { text: 'DONATIONS', font: F.round, size: 54, color: '#2f8f8a', y: 0.28, weight: 600 },
      { text: 'تبرعات', font: F.arabic, size: 50, color: '#e889ab', y: 0.55 },
      { text: 'thank you ♥ 감사합니다', font: F.cute, size: 32, color: '#7a5864', y: 0.82 },
    ] });
  card(g, lab, 0.14, 0.117, x - 0.081, y + 0.09, z, -Math.PI / 2, 0.15);
}
function plush(g, kind, x, y, z, ry) {
  const grp = new THREE.Group(); grp.position.set(x, y, z); grp.rotation.y = ry; g.add(grp);
  const body = std(kind === 'bunny' ? '#f7c6d6' : '#c8a27c', { roughness: 1 });
  const light = std(kind === 'bunny' ? '#fff4f7' : '#ead7bf', { roughness: 1 });
  sphere(grp, body, 0.055, 0, 0.05, 0, 1, 0.95, 0.85);
  sphere(grp, body, 0.045, 0, 0.135, 0.005);
  sphere(grp, light, 0.022, 0, 0.125, 0.04, 1, 0.8, 0.6);
  for (const s of [-1, 1]) {
    if (kind === 'bunny') { const e = sphere(grp, body, 0.016, s * 0.02, 0.2, 0, 1, 2.6, 0.7); e.rotation.z = -s * 0.2; }
    else sphere(grp, body, 0.017, s * 0.035, 0.172, 0, 1, 1, 0.6);
    sphere(grp, std('#1a1a1a', { roughness: 0.3 }), 0.006, s * 0.016, 0.145, 0.04);
    sphere(grp, std('#f39ab3', { roughness: 1 }), 0.008, s * 0.028, 0.125, 0.036, 1, 0.6, 0.4);
    sphere(grp, body, 0.018, s * 0.05, 0.065, 0.025);
  }
}
function succulent(g, x, y, z, potCol) {
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.032, 0.06, 16), std(potCol, { roughness: 0.5 }));
  pot.position.set(x, y + 0.03, z); pot.castShadow = true; g.add(pot);
  const leaf = new THREE.ConeGeometry(0.012, 0.045, 6);
  const m = std('#7fae7a', { roughness: 0.6 });
  for (let i = 0; i < 12; i++) {
    const a = i * 2.4, r = 0.012 + (i % 3) * 0.008;
    const l = new THREE.Mesh(leaf, m); l.position.set(x + Math.cos(a) * r, y + 0.07, z + Math.sin(a) * r);
    l.rotation.set(Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7); g.add(l);
  }
}
function candyJar(g, x, y, z) {
  const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.14, 20, 1, true), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.05, transparent: true, opacity: 0.25, side: THREE.DoubleSide }));
  jar.position.set(x, y + 0.07, z); jar.userData.keep = true; g.add(jar);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.02, 20), std(PINK)); lid.position.set(x, y + 0.15, z); g.add(lid);
  const cols = ['#ff6fa3', '#5fd1c2', '#ffd35c', '#9b7bf2', '#ff9a52'];
  const r = T.rng(31), geo = new THREE.SphereGeometry(0.012, 8, 6);
  const bs = cols.map((c) => new InstanceBatch(geo, std(c, { roughness: 0.25 }), { cast: false }));
  for (let i = 0; i < 70; i++) { const a = r() * 6.28, rr = Math.sqrt(r()) * 0.042; bs[i % 5].add(x + Math.cos(a) * rr, y + 0.012 + r() * 0.1, z + Math.sin(a) * rr); }
  bs.forEach((b) => b.build(g));
}
function instax(g, x, y, z) {
  rb(g, std('#f7bfd3', { roughness: 0.45 }), 0.1, 0.12, 0.065, x, y, z, 0.015);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.03, 0.03, 20), std('#e9e9ea', { roughness: 0.3 }));
  lens.rotation.z = Math.PI / 2; lens.position.set(x - 0.06, y + 0.055, z); g.add(lens);
  const glass = new THREE.Mesh(new THREE.CircleGeometry(0.018, 20), std('#101418', { roughness: 0.05, metalness: 0.5 }));
  glass.rotation.y = -Math.PI / 2; glass.position.set(x - 0.076, y + 0.055, z); g.add(glass);
  box(g, std('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.2 }), 0.004, 0.02, 0.03, x - 0.052, y + 0.09, z + 0.018, { cast: false });
}
function menuStack(g, x, y, z, F) {
  const tex = menuCardTexture(F, true);
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.004, 0.31), [std(CREAM), std(CREAM), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }), std(CREAM), std(CREAM), std(CREAM)]);
    m.position.set(x, y + 0.004 + i * 0.005, z); m.rotation.y = -Math.PI / 2 + (i - 2) * 0.04; g.add(m);
  }
}

// A cute, fully readable menu card (also used on tables and the easel)
export function menuCardTexture(F, compact = false) {
  const h = compact ? 1400 : 1800;
  const words = [MENU.mains, MENU.drinks, MENU.extras].flat().map((m) => `${m[0]} ${m[1]}`).join(' ') + MEAL_DEAL.items.join(' ');
  return T.sign({
    w: 1000, h, bg: '#fff6ef', border: '#2f8f8a', borderW: 18, aged: 0.08, seed: 21,
    fonts: [{ font: F.round, text: words + ' MENU AED Seoulicious Korean BBQ' }, { font: F.cute, text: words + '메뉴' }, { font: F.neon, text: 'Seoulicious' }],
    draw: (c, w) => {
      c.textBaseline = 'alphabetic';
      c.fillStyle = '#f2a7c3'; c.fillRect(18, 18, w - 36, 190);
      c.fillStyle = '#ffffff'; c.textAlign = 'center';
      c.font = `92px ${F.neon}`; c.fillText('Seoulicious', w / 2, 125);
      c.font = `36px ${F.cute}`; c.fillText('MENU · 메뉴 · Korean BBQ', w / 2, 180);
      // meal deal box
      c.fillStyle = '#2f8f8a'; c.beginPath(); c.roundRect(50, 240, w - 100, 300, 26); c.fill();
      c.fillStyle = '#ffd35c'; c.font = `40px ${F.round}`; c.textAlign = 'left'; c.fillText('★ SPECIAL MEAL DEAL', 85, 300);
      c.fillStyle = '#ffffff'; c.font = `bold 78px ${F.round}`; c.textAlign = 'right'; c.fillText(MEAL_DEAL.price, w - 85, 310);
      c.textAlign = 'left'; c.font = `32px ${F.round}`;
      MEAL_DEAL.items.forEach((it, i) => c.fillText(`• ${it}`, 85 + (i % 2) * 420, 370 + Math.floor(i / 2) * 50));
      c.fillStyle = '#ffe3ee'; c.fillText('+ Polaroid picture AED 5', 85, 520);
      photo(c, menuPhotos.deal, w - 300, 330, 200, 150, 18);
      // mains
      let y = 620;
      c.fillStyle = '#c23b6a'; c.font = `46px ${F.round}`; c.fillText('MAINS · 메인', 60, y); y += 20;
      for (const [en, ko, price, key] of MENU.mains.slice(1)) {
        y += 66;
        const tx = menuPhotos[key] ? 128 : 60;
        photo(c, menuPhotos[key], 60, y - 44, 56, 56, 28);
        c.fillStyle = '#3b2a33'; c.font = `38px ${F.round}`; c.textAlign = 'left'; c.fillText(en, tx, y);
        const tw = c.measureText(en).width;
        c.fillStyle = '#9a7d88'; c.font = `30px ${F.cute}`; c.fillText(ko, tx + 12 + tw, y);
        c.fillStyle = '#2f8f8a'; c.font = `38px ${F.round}`; c.textAlign = 'right'; c.fillText(`AED ${price}`, w - 60, y);
        c.strokeStyle = 'rgba(47,143,138,0.25)'; c.setLineDash([4, 8]); c.beginPath(); c.moveTo(60, y + 16); c.lineTo(w - 60, y + 16); c.stroke(); c.setLineDash([]);
      }
      y += 90;
      c.textAlign = 'left'; c.fillStyle = '#c23b6a'; c.font = `46px ${F.round}`; c.fillText('DRINKS · 음료', 60, y); y += 10;
      for (const [en, ko, price] of MENU.drinks) {
        y += 58;
        c.fillStyle = '#3b2a33'; c.font = `36px ${F.round}`; c.textAlign = 'left'; c.fillText(en, 60, y);
        const tw = c.measureText(en).width;
        c.fillStyle = '#9a7d88'; c.font = `28px ${F.cute}`; c.fillText(ko, 72 + tw, y);
        c.fillStyle = '#2f8f8a'; c.font = `36px ${F.round}`; c.textAlign = 'right'; c.fillText(`AED ${price}`, w - 60, y);
      }
      if (!compact) {
        c.textAlign = 'center'; c.fillStyle = '#9a7d88'; c.font = `30px ${F.round}`;
        c.fillText('All chicken & beef · No pork · No alcohol', w / 2, h - 60);
      }
    },
  });
}

// Small table-tent menu for every table: the meal deal up front
export function tableMenuTexture(F) {
  return T.sign({
    w: 512, h: 740, bg: '#fff6ef', border: '#2f8f8a', borderW: 12, aged: 0.05, seed: 23,
    fonts: [{ font: F.neon, text: 'Seoulicious' }, { font: F.round, text: MEAL_DEAL.items.join(' ') + ' MEAL DEAL AED 59 Polaroid picture 5 Scan for the full menu' }, { font: F.cute, text: '메뉴' }],
    draw: (c, w) => {
      c.fillStyle = '#f2a7c3'; c.fillRect(12, 12, w - 24, 120);
      c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = `64px ${F.neon}`; c.fillText('Seoulicious', w / 2, 92);
      photo(c, menuPhotos.deal, 40, 150, w - 80, 250, 20);
      c.fillStyle = '#c23b6a'; c.font = `38px ${F.round}`; c.fillText('MEAL DEAL', w / 2, 452);
      c.fillStyle = '#2f8f8a'; c.font = `bold 72px ${F.round}`; c.fillText(MEAL_DEAL.price, w / 2, 528);
      c.fillStyle = '#3b2a33'; c.font = `24px ${F.round}`;
      MEAL_DEAL.items.forEach((it, i) => c.fillText(it, w / 2, 572 + i * 30));
      c.fillStyle = '#e889ab'; c.font = `22px ${F.round}`; c.fillText('+ Polaroid picture AED 5 · scan for the full menu', w / 2, 724);
    },
  });
}

function menuEasel(g, M, x, z, ry, F) {
  const grp = new THREE.Group(); grp.position.set(x, 0, z); grp.rotation.y = ry; g.add(grp);
  for (const s of [-1, 1]) { const leg = box(grp, M.woodDarkV, 0.04, 1.6, 0.04, s * 0.3, 0, 0.05); leg.rotation.x = -0.08; }
  const back = box(grp, M.woodDarkV, 0.04, 1.5, 0.04, 0, 0, -0.25); back.rotation.x = 0.25;
  box(grp, M.woodDark, 0.66, 0.03, 0.06, 0, 0.62, 0.08);
  const tex = menuCardTexture(F);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 1.08), signMaterial(tex, { glow: 0.12 }));
  board.position.set(0, 1.18, 0.11); board.rotation.x = -0.08; board.userData.keep = true; grp.add(board);
  box(grp, M.woodDark, 0.64, 1.12, 0.02, 0, 0.62, 0.095).rotation.x = -0.08;
}

function scallopTexture() {
  const [c, ctx] = T.makeCanvas(1024, 128);
  ctx.clearRect(0, 0, 1024, 128);
  const n = 16, w = 1024 / n;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = i % 2 ? PINK : TEAL;
    ctx.beginPath(); ctx.moveTo(i * w, 0); ctx.lineTo(i * w + w, 0); ctx.lineTo(i * w + w, 60);
    ctx.arc(i * w + w / 2, 60, w / 2, 0, Math.PI); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(i * w + w / 2, 62, 6, 0, 7); ctx.fill();
  }
  ctx.fillStyle = CREAM; ctx.fillRect(0, 0, 1024, 14);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function rugTexture() {
  const [c, ctx] = T.makeCanvas(512, 512);
  ctx.fillStyle = CREAM; ctx.fillRect(0, 0, 512, 512);
  for (let r = 250, i = 0; r > 20; r -= 34, i++) { ctx.strokeStyle = [PINK, TEAL, '#f6d06b'][i % 3]; ctx.lineWidth = 16; ctx.beginPath(); ctx.arc(256, 256, r, 0, 7); ctx.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ------------------------------------------------------------------ the polaroid wall (her inspo: dense collage + strings with clips)
function polaroidWall(g, M) {
  const B = CASHIER.board, x = B.x;
  // cork board with a thin oak frame
  const zc = (B.z0 + B.z1) / 2, w = B.z0 - B.z1, h = B.y1 - B.y0;
  box(g, M.cork || M.woodOak || M.woodBooth, 0.03, h, w, x - 0.015, B.y0, zc, { uv: 1, cast: false });
  for (const [dz, dy, ww, hh] of [[0, -0.02, w + 0.08, 0.05], [0, h - 0.03, w + 0.08, 0.05]]) box(g, M.woodOak || M.woodBooth, 0.05, hh, ww, x - 0.03, B.y0 + dy, zc + dz, { cast: false });
  for (const zz of [B.z0 + 0.02, B.z1 - 0.02]) box(g, M.woodOakV || M.woodBoothV, 0.05, h + 0.04, 0.05, x - 0.03, B.y0 - 0.02, zz, { cast: false });

  const atlas = polaroidAtlas();
  const mat = new THREE.MeshStandardMaterial({ map: atlas.tex, roughness: 0.42, side: THREE.DoubleSide });
  const r = T.rng(2026), items = [], pins = [];
  // dense collage on the cork (leave a gap for the new photo at pinSpot)
  let cell = 0;
  for (let yy = B.y0 + 0.12; yy < B.y1 - 0.07; yy += 0.122) {
    for (let zz = B.z0 - 0.08; zz > B.z1 + 0.05; zz -= 0.1) {
      const P = CASHIER.pinSpot;
      if (Math.abs(yy - P.y) < 0.11 && Math.abs(zz - P.z) < 0.09) continue;
      if (r() < 0.12) continue;
      const it = { x: x - 0.032 - r() * 0.004, y: yy + (r() - 0.5) * 0.03, z: zz + (r() - 0.5) * 0.03, ry: -Math.PI / 2, rz: (r() - 0.5) * 0.35, cell: cell++ };
      items.push(it); pins.push([it.x - 0.004, it.y + 0.045, it.z]);
    }
  }
  // spill-over onto the wall above the board (like her inspo collage)
  for (let i = 0; i < 26; i++) {
    const yy = B.y1 + 0.1 + r() * 0.5, zz = B.z0 - r() * (w - 0.1);
    items.push({ x: x - 0.012, y: yy, z: zz, ry: -Math.PI / 2, rz: (r() - 0.5) * 0.5, cell: cell++ });
  }
  g.add(polaroidMesh(items, atlas, mat));
  // push pins
  const pinGeo = new THREE.SphereGeometry(0.008, 8, 6);
  const pinB = [PINK2, TEAL2, '#f6c445', '#ffffff'].map((c) => new InstanceBatch(pinGeo, std(c, { roughness: 0.3 }), { cast: false }));
  pins.forEach((p, i) => pinB[i % 4].add(...p));
  pinB.forEach((b) => b.build(g));

  // fairy-light strings across the front of the board with clipped, hanging polaroids
  const bulbGeo = new THREE.SphereGeometry(0.011, 8, 6);
  const fairy = new InstanceBatch(bulbGeo, new THREE.MeshStandardMaterial({ color: '#fff4d6', emissive: '#ffd89a', emissiveIntensity: 3.5 }), { cast: false, receive: false });
  const clip = new InstanceBatch(new THREE.BoxGeometry(0.006, 0.03, 0.012), new THREE.MeshStandardMaterial({ color: '#c8a46e', roughness: 0.7 }), { cast: false });
  const hung = [];
  for (const [y0, sag] of [[B.y1 + 0.62, 0.14], [B.y1 + 0.3, 0.1]]) {
    const pts = [];
    for (let i = 0; i <= 30; i++) {
      const t = i / 30, zz = B.z0 + 0.05 - t * (w + 0.1), yy = y0 - Math.sin(t * Math.PI) * sag;
      pts.push(new THREE.Vector3(x - 0.06, yy, zz));
      if (i % 2) fairy.add(x - 0.06, yy - 0.012, zz);
      if (i % 4 === 2) { clip.add(x - 0.06, yy - 0.02, zz); hung.push({ x: x - 0.062, y: yy - 0.09, z: zz, ry: -Math.PI / 2, rz: (r() - 0.5) * 0.18, cell: cell++ }); }
    }
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#3a2a20' })));
  }
  g.add(polaroidMesh(hung, atlas, mat));
  fairy.build(g); clip.build(g);

  // a hand-lettered header above it all
  const head = T.sign({ w: 1200, h: 220, bg: '#2f8f8a', border: '#f8f0e3', borderW: 12, aged: 0.05, seed: 33,
    fonts: [{ font: FONTS.neon, text: 'Our Seoulicious Family' }, { font: FONTS.cute, text: '우리 가족 · thank you for the memories' }],
    draw: (c, w2, h2) => {
      c.textAlign = 'center'; c.fillStyle = '#ffffff'; c.font = `86px ${FONTS.neon}`; c.fillText('Our Seoulicious Family', w2 / 2, 112);
      c.fillStyle = '#f2a7c3'; c.font = `40px ${FONTS.cute}`; c.fillText('우리 가족 · thank you for the memories ♥', w2 / 2, 182);
    } });
  card(g, head, 1.65, 0.3, x - 0.02, 4.02, zc, -Math.PI / 2, 0.25);
}

// ------------------------------------------------------------------ 2-seat nook by the window, separated by a planter
function nook(g, M, W) {
  const N = CASHIER.nook;
  // round table
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.035, 32), W('woodOak', 'woodBooth'));
  top.position.set(N.x, 0.74, N.z); top.castShadow = true; top.receiveShadow = true; g.add(top);
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.72, 12), M.blackSteel); ped.position.set(N.x, 0.36, N.z); g.add(ped);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.025, 24), M.blackSteel); foot.position.set(N.x, 0.012, N.z); g.add(foot);
  // two cushioned chairs facing each other
  for (const s of [-1, 1]) chair(g, M, W, N.x + s * 0.62, N.z, s > 0 ? -Math.PI / 2 : Math.PI / 2);
  // small vase with a flower on the table
  const vase = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.12, 16), std(TEAL, { roughness: 0.3 }));
  vase.position.set(N.x, 0.82, N.z); g.add(vase);
  sphere(g, std('#f28fb0'), 0.035, N.x, 0.93, N.z);
  // planter divider between the nook and the cashier queue, overflowing with greenery
  box(g, W('woodOak', 'woodBooth'), 2.5, 0.7, 0.32, N.x + 0.25, 0, -1.55);
  box(g, std('#3a2a1c', { roughness: 1 }), 2.42, 0.02, 0.26, N.x + 0.25, 0.69, -1.55, { cast: false });
  vinesBed(g, N.x + 0.25, 0.7, -1.55, 2.4);
}
function chair(g, M, W, x, z, ry) {
  const grp = new THREE.Group(); grp.position.set(x, 0, z); grp.rotation.y = ry; g.add(grp);
  for (const [a, b] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) box(grp, M.woodDarkV, 0.035, 0.45, 0.035, a, 0, b, { cast: false });
  rb(grp, W('cushionTeal', 'fabricDark'), 0.44, 0.07, 0.44, 0, 0.45, 0, 0.025);
  box(grp, M.woodDark, 0.44, 0.42, 0.035, 0, 0.5, -0.2);
  rb(grp, W('cushionTerracotta', 'fabricDark'), 0.4, 0.3, 0.05, 0, 0.56, -0.17, 0.02);
}
function vinesBed(g, x, y, z, len) {
  const r = T.rng(91);
  const bs = LEAF_COLORS.map((c) => new InstanceBatch(leafGeometry(0.1), leafMaterial(c), { cast: true }));
  for (let i = 0; i < 520; i++) {
    const t = r(), lx = x - len / 2 + t * len, up = r() < 0.6;
    const yy = up ? y + r() * 0.35 : y - r() * 0.45, zz = z + (r() - 0.5) * (up ? 0.26 : 0.4) + (up ? 0 : (r() < 0.5 ? -0.17 : 0.17));
    bs[i % bs.length].add(lx, yy, zz, { rx: (r() - 0.5) * 2, ry: r() * 6.28, rz: (r() - 0.5) * 2, s: 0.6 + r() * 0.8 });
  }
  bs.forEach((b) => b.build(g));
}
