// OUTSIDE of Seoulicious, a Korean BBQ in Abu Dhabi: the 15.6 m wide shop front and a bit of street.
//
//   brick piers · weathered wood · two big grid windows framed by a few vines · a pair of glass doors
//   up three wooden deck steps · rusty corrugated tin awning · bilingual painted billboard
//   (English + Arabic) · black hanok-style tiled eave with warm downlights · vertical lightbox ·
//   paper lantern · barn lamps · two A-frame boards with the meal deal · Abu Dhabi number plate.
//
// Everything is built under the group named 'exterior' (the zone lighting relies on that name);
// the upper floors go in ctx.roof so the floor-plan view can lift them off.
// Real lights outside (6): eave wash, two barn-lamp pools (the left one casts shadows), lightbox
// glow, lantern glow, street lamp. Everything else glows with emissive materials + bloom.
// Every texture with text goes through T.sign so the Korean/Arabic web fonts are redrawn once loaded.
import * as THREE from 'three';
import { box, plane, corrugatedGeometry, InstanceBatch, pointLight, spotLight, mergeStatic } from './helpers.js';
import * as T from './textures.js';
import { signMaterial } from './materials.js';
import { MEAL_DEAL } from './config.js';

// awning over both windows and the door (leaves the outer piers free for the lightbox)
const AWNING = { top: 3.02, len: 1.3, drop: 0.26 };

export function buildExterior(ctx) {
  const { scene, camera, mats, roof, animators, layout: L, R, F } = ctx;
  const g = new THREE.Group();
  g.name = 'exterior';
  scene.add(g);

  const designs = signDesigns(R, F);
  requestFonts(designs);

  const S = {
    g, mats, lm: localMaterials(mats), L, R, F, animators, roof, camera, designs,
    X0: L.x0 - L.wallT, X1: L.x1 + L.wallT,          // outer faces of the side walls (±7.8)
    zOut: L.zFrontOut, yS: L.sidewalkY,
    aw: { ...AWNING, x0: L.frontWindow.x0 - 0.12, x1: L.sideWindow.x1 + 0.12 },
    leafGeo: leafGeometry(),
    barnXs: [-5.0, -2.6, 2.6, 5.0],                    // barn pendant lamps under the awning
    floodXs: [-5.0, -1.75, 1.75, 5.0],                 // flood lamps on the awning edge (light the billboard)
    downXs: Array.from({ length: 11 }, (_, i) => -7.0 + i * 1.4),   // downlights in the eave soffit
  };
  S.leaves = new InstanceBatch(S.leafGeo, S.lm.leaf, { cast: true });

  buildFacade(S);
  buildDoor(S);
  buildSteps(S);
  buildAwning(S);
  buildBillboard(S);
  buildEave(S);
  buildLightbox(S);
  buildLampsAndLantern(S);
  buildGreenery(S);
  buildBoards(S);
  buildDressing(S);
  buildUpperFloors(S);
  buildStreet(S);
  buildNeighbors(S);
  S.leaves.build(g);

  // fewer draw calls: merge everything that never moves (door leaves + lantern are kept separate)
  mergeStatic(g);
}

// ------------------------------------------------------------------
// materials only used outside
// ------------------------------------------------------------------
function localMaterials(mats) {
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const glass = mats.glass.clone();
  glass.side = THREE.DoubleSide;
  const tint = (m, color) => {
    const c = m.clone();
    c.color = new THREE.Color(color);
    c.emissive = new THREE.Color('#2a2c34'); c.emissiveMap = m.map; c.emissiveIntensity = 1.0;
    return c;
  };
  return {
    glass,
    doorGlass: (() => { const m = mats.glass.clone(); m.side = THREE.DoubleSide; m.opacity = Math.min(0.22, (mats.glass.opacity ?? 0.18) + 0.03); return m; })(),
    doorMetal: std({ color: '#24211e', roughness: 0.4, metalness: 0.75 }),
    alu: std({ color: '#2a2a2c', roughness: 0.35, metalness: 0.8 }),
    brass: std({ color: '#b98d4e', roughness: 0.3, metalness: 1.0 }),
    blackPaint: std({ color: '#1a1a1c', roughness: 0.6 }),
    shadeOuter: std({ color: '#203a2d', roughness: 0.45, metalness: 0.5 }),
    shadeInner: std({ color: '#f1ece2', emissive: '#ffcf9a', emissiveIntensity: 0.7, roughness: 0.6, side: THREE.BackSide }),
    leaf: std({ color: '#ffffff', roughness: 0.62, side: THREE.DoubleSide }),
    stem: std({ color: '#4b3d27', roughness: 0.9 }),
    flower: std({ color: '#efc23a', roughness: 0.7 }),
    soil: std({ color: '#2a1e16', roughness: 1 }),
    coir: std({ color: '#76593a', roughness: 1 }),
    curb: std({ color: '#7d7a73', roughness: 0.85 }),
    lanePaint: std({ color: '#b5b2aa', roughness: 0.85 }),
    pole: std({ color: '#2b2d30', roughness: 0.55, metalness: 0.6 }),
    acWhite: std({ color: '#d9d8d2', roughness: 0.6 }),
    roofBase: std({ color: '#1c1d20', roughness: 0.7 }),
    soffit: std({ map: mats.woodDark.map, emissive: '#ff9a50', emissiveMap: mats.woodDark.map, emissiveIntensity: 2.0, roughness: 0.8 }),
    winDark: std({ color: '#0c0f13', roughness: 0.12, metalness: 0.8, envMapIntensity: 0.7 }),
    winWarm: std({ color: '#2a1a0d', emissive: '#ffd2a0', emissiveMap: T.windowGlowTexture(61), emissiveIntensity: 0.5 }),
    winCool: std({ color: '#141a24', emissive: '#a9c4ff', emissiveMap: T.windowGlowTexture(62), emissiveIntensity: 0.28 }),
    winFrame: std({ color: '#202124', roughness: 0.6, metalness: 0.3 }),
    shopGlow: std({ color: '#0e1418', emissive: '#d6ecff', emissiveIntensity: 0.5 }),
    bldgA: tint(mats.concrete, '#a8a49e'),
    bldgB: tint(mats.concrete, '#8c7d70'),
    bldgC: tint(mats.concrete, '#7a808a'),
    upper: tint(mats.concrete, '#77716b'),
    shutter: std({ map: shutterTexture(), roughness: 0.55, metalness: 0.5 }),
  };
}

function shutterTexture() {
  const [c, ctx] = T.makeCanvas(256, 256);
  for (let y = 0; y < 256; y += 8) {
    const gr = ctx.createLinearGradient(0, y, 0, y + 8);
    gr.addColorStop(0, '#8d8f92'); gr.addColorStop(0.5, '#6c6e71'); gr.addColorStop(1, '#3e4043');
    ctx.fillStyle = gr; ctx.fillRect(0, y, 256, 8);
  }
  T.ageCanvas(ctx, 256, 256, 0.7, 77);
  return T.toTexture(c);
}

// ------------------------------------------------------------------
// small local helpers
// ------------------------------------------------------------------

// Cylinder stretched between two points (cords, rails, poles, hoses)
function rod(parent, mat, a, b, r = 0.01, seg = 6) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, A.distanceTo(B), seg), mat);
  m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
  m.castShadow = true;
  parent.add(m);
  return m;
}

// Box whose +Z face shows a sign texture (plain 0..1 UVs), other faces are frame
function signBox(parent, faceMat, frameMat, w, h, d, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [frameMat, frameMat, frameMat, frameMat, faceMat, frameMat]);
  m.position.set(x, y + h / 2, z);
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

// Plane with plain 0..1 UVs (for signs)
function signPlane(parent, mat, w, h) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  parent.add(m);
  return m;
}

// Ivy / pothos leaf: heart-ish outline folded along the midrib. Base at the origin, tip at +Y (1 unit long).
function leafGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0.3, -0.04, 0.56, 0.26, 0.44, 0.56);
  s.bezierCurveTo(0.34, 0.8, 0.14, 0.93, 0, 1);
  s.bezierCurveTo(-0.14, 0.93, -0.34, 0.8, -0.44, 0.56);
  s.bezierCurveTo(-0.56, 0.26, -0.3, -0.04, 0, 0);
  const geo = new THREE.ShapeGeometry(s, 5);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    p.setZ(i, -0.32 * x * x + 0.07 * Math.sin(y * Math.PI));
  }
  geo.computeVertexNormals();
  return geo;
}

const GREENS = ['#2c5524', '#3a6a2b', '#477a33', '#27481f', '#557f36', '#33602a'];
const leafEuler = new THREE.Euler();
const leafQ = new THREE.Quaternion();
// add one leaf whose tip points along `dir` (world), with a random roll around it
function addLeaf(batch, r, x, y, z, dir, size, roll = Math.PI) {
  leafQ.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  const twist = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (r() - 0.5) * roll);
  leafQ.multiply(twist);
  leafEuler.setFromQuaternion(leafQ);
  batch.add(x, y, z, { rx: leafEuler.x, ry: leafEuler.y, rz: leafEuler.z, s: size, color: GREENS[Math.floor(r() * GREENS.length)] });
}

// Leafy mound (planters, pots): leaves radiate out and up from a centre
function bush(batch, cx, cy, cz, { n = 60, rx = 0.25, ry = 0.3, rz = 0.25, size = 0.07, seed = 1, up = 0.8 } = {}) {
  const r = T.rng(seed);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, h = Math.pow(r(), 0.8), rad = Math.sqrt(r()) * (1 - h * 0.45);
    const x = cx + Math.cos(a) * rx * rad, z = cz + Math.sin(a) * rz * rad, y = cy + h * ry;
    const dir = new THREE.Vector3(Math.cos(a) * (0.4 + rad), up * (0.4 + h) + 0.3, Math.sin(a) * (0.4 + rad));
    addLeaf(batch, r, x, y, z, dir, size * (0.75 + r() * 0.5));
  }
}

// A vine: stem tube along a smooth path + leaves along it facing the street.
// `hang` makes the leaves point down (trailing strands).
function vine(S, pts, { seed = 1, size = 0.045, every = 0.04, hang = false, r0 = 0.006, wobble = 0.02 } = {}) {
  const r = T.rng(seed);
  const p = pts.map(([x, y, z], i) => new THREE.Vector3(
    x + (i && i < pts.length - 1 ? (r() - 0.5) * wobble : 0),
    y + (i && i < pts.length - 1 ? (r() - 0.5) * wobble : 0),
    z));
  const curve = new THREE.CatmullRomCurve3(p, false, 'centripetal');
  const len = curve.getLength();
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(8, Math.round(len * 24)), r0, 4, false), S.lm.stem);
  tube.castShadow = true;
  S.g.add(tube);
  const n = Math.floor(len / every);
  for (let i = 1; i <= n; i++) {
    const u = i / (n + 1);
    const at = curve.getPointAt(u), tan = curve.getTangentAt(u);
    const side = i % 2 ? 1 : -1;
    // perpendicular to the stem, in the wall plane
    const perp = new THREE.Vector3(-tan.y, tan.x, 0).normalize().multiplyScalar(side);
    const dir = hang
      ? new THREE.Vector3(perp.x * 0.7, -1, 0.35 + r() * 0.4)
      : new THREE.Vector3(perp.x + tan.x * 0.3, perp.y + tan.y * 0.3 - 0.25, 0.45 + r() * 0.5);
    const s = size * (0.7 + r() * 0.55) * (hang ? 1 - u * 0.35 : 1 - Math.abs(u - 0.4) * 0.5);
    const off = s * 0.15;
    addLeaf(S.leaves, r, at.x + perp.x * off, at.y + perp.y * off, at.z + 0.006 + r() * 0.012, dir, s, 1.2);
  }
  return curve;
}

// ------------------------------------------------------------------
// lettering (drawn inside T.sign draw callbacks so fonts get redrawn)
// ------------------------------------------------------------------
const fontSpec = (size, family, weight) => `${weight ? `${weight} ` : ''}${Math.max(1, Math.round(size))}px ${family}`;

// Set the font so `text` fits in maxW x maxH (by its real ink box). Returns { m, size, spacing }.
function fitFont(c, text, { family, weight, size, maxW = Infinity, maxH = Infinity, spacing = 0 }) {
  c.letterSpacing = `${spacing}px`;
  c.font = fontSpec(size, family, weight);
  let m = c.measureText(text);
  const inkH = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
  const k = Math.min(1, maxW / Math.max(1, m.width - spacing), maxH / Math.max(1, inkH));
  if (k < 1) {
    size *= k; spacing *= k;
    c.letterSpacing = `${spacing}px`;
    c.font = fontSpec(size, family, weight);
    m = c.measureText(text);
  }
  return { m, size, spacing };
}

// Text centred (or aligned) on x and vertically centred on its ink box at y — works for Latin,
// Hangul and Arabic alike. Options: color, align, rtl, spacing, maxW, maxH, outline/outlineColor,
// depth/step/side (painted 3D drop shade), shadow (soft).
function label(c, text, x, y, o) {
  c.save();
  c.direction = o.rtl ? 'rtl' : 'ltr';
  const align = o.align || 'center';
  c.textAlign = align;
  c.textBaseline = 'alphabetic';
  const { m, spacing } = fitFont(c, text, o);
  const by = y + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
  const bx = x + (align === 'center' ? spacing / 2 : 0);
  if (o.shadow) {
    c.shadowColor = o.shadow; c.shadowBlur = o.shadowBlur ?? 10; c.shadowOffsetX = c.shadowOffsetY = o.shadowOff ?? 3;
  }
  if (o.depth) {
    c.fillStyle = o.side;
    for (let i = o.depth; i >= 1; i--) c.fillText(text, bx + i * o.step, by + i * o.step);
    c.shadowColor = 'transparent';
  }
  if (o.outline) {
    c.lineJoin = 'round'; c.miterLimit = 2;
    c.strokeStyle = o.outlineColor; c.lineWidth = o.outline * 2;
    c.strokeText(text, bx, by);
    c.shadowColor = 'transparent';
  }
  c.fillStyle = o.color;
  c.fillText(text, bx, by);
  c.restore();
  return m;
}

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
  c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
  c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y);
  c.closePath();
}

function star(c, x, y, r, color) {
  c.save(); c.fillStyle = color; c.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = (k * Math.PI) / 5 - Math.PI / 2, rr = k % 2 ? r * 0.45 : r;
    c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  c.closePath(); c.fill(); c.restore();
}

// Ask the browser for the exact weights each sign uses (T.sign's own refresh loads only the
// default weight). main.js awaits document.fonts.ready + refreshSignFonts after building,
// so these finish before the signs are redrawn.
function requestFonts(designs) {
  if (!document.fonts || !document.fonts.load) return;
  for (const d of Object.values(designs)) {
    for (const f of d.fonts || []) document.fonts.load(fontSpec(48, f.font, f.weight), f.text).catch(() => {});
  }
}

// ------------------------------------------------------------------
// sign designs (one T.sign options object each). Exported so they can be previewed flat.
// ------------------------------------------------------------------
export function signDesigns(R, F) {
  const deal = MEAL_DEAL;
  return {
    billboard: billboardDesign(R, F),
    billboardGlow: billboardDesign(R, F, true),
    lightbox: lightboxDesign(R, F),
    offer: offerDesign(R, F, deal),
    chalk: chalkDesign(R, F, deal),
    welcome: welcomeDesign(F),
    pull: decalDesign('PULL', F, 203),
    push: decalDesign('PUSH', F, 204),
    lantern: lanternDesign(R, F),
    plate: plateDesign(F),
    laundry: laundryDesign(F),
  };
}

// split the deal into the pieces a poster needs (all words come from config.js)
function dealParts(R, deal) {
  let rest = deal.title;
  let kicker = '';
  if (rest.toLowerCase().startsWith(R.kind.toLowerCase())) { kicker = R.kind; rest = rest.slice(R.kind.length).trim(); }
  const words = rest.split(/\s+/);
  const line1 = words.length > 2 ? words[0] : rest, line2 = words.length > 2 ? words.slice(1).join(' ') : '';
  const pm = /^([A-Za-z]+)\s*(.+)$/.exec(deal.price) || [null, '', deal.price];
  const [extraRaw, extraPrice = ''] = deal.extra.split(':').map((s) => s.trim());
  let extra = extraRaw.replace(/^add an?\s+/i, '');
  extra = extra.charAt(0).toUpperCase() + extra.slice(1);
  return { kicker: kicker.toUpperCase(), line1: line1.toUpperCase(), line2: line2.toUpperCase(), cur: pm[1], amount: pm[2], extra, extraPrice };
}

// ---------- the Seoulicious wordmark: illuminated channel letters ----------
// Brand palette (matches the pink / teal / yellow inside the restaurant)
const BRAND = {
  teal: '#17595a', tealDeep: '#0d3a3c', tealNeon: '#5fc2b8', pink: '#ff4f8b', pinkSoft: '#f2a7c3', yellow: '#ffd35c',
  en: [[0, '#ffc54d'], [0.42, '#ff7d3a'], [1, '#ff2f50']],          // hot orange -> coral red
  ar: [[0, '#ff7fae'], [0.45, '#ff4f8b'], [1, '#ff7a52']],          // hot pink -> coral
  gold: [[0, '#fff3b8'], [0.55, '#ffd35c'], [1, '#ffb23a']],
};
const brandFont = (F) => F.brand || F.display;
const brandFontAr = (F) => F.brandAr || F.arabic;

// One word as a lit channel letter: warm halo, dark returns (depth), gradient face with a white rim
// highlight along the top-left edges, crisp trim. `lit` = draw only what emits light (for the emissive map).
function glowWord(c, text, x, y, o) {
  const W = c.canvas.width, H = c.canvas.height;
  c.save();
  c.direction = o.rtl ? 'rtl' : 'ltr';
  c.textAlign = 'center';
  c.textBaseline = 'alphabetic';
  const { m, size, spacing } = fitFont(c, text, o);
  const by = y + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
  const bx = x + spacing / 2;
  const top = by - m.actualBoundingBoxAscent, bot = by + m.actualBoundingBoxDescent;
  const k = size / 100;
  // halo
  c.fillStyle = o.glow; c.shadowColor = o.glow;
  c.shadowBlur = (o.halo ?? 0.34) * size; c.globalAlpha = o.lit ? 0.95 : 0.8; c.fillText(text, bx, by);
  c.shadowBlur = (o.halo ?? 0.34) * size * 0.35; c.globalAlpha = 1; c.fillText(text, bx, by);
  c.shadowColor = 'transparent'; c.shadowBlur = 0;
  // returns (the letter sides): never lit
  const depth = o.depth ?? 8;
  c.fillStyle = o.lit ? '#000000' : (o.edge || '#4a0d14');
  for (let i = depth; i >= 1; i--) c.fillText(text, bx + i * 0.45 * k, by + i * 0.8 * k);
  // face on its own layer (same transform), rim first, gradient offset down-right on top of it
  const [lc, l] = T.makeCanvas(W, H);
  l.setTransform(c.getTransform());
  l.font = c.font; l.letterSpacing = c.letterSpacing; l.direction = c.direction; l.textAlign = 'center'; l.textBaseline = 'alphabetic';
  l.fillStyle = o.rim || '#fff6ea'; l.fillText(text, bx, by);
  l.globalCompositeOperation = 'source-atop';
  const gr = l.createLinearGradient(0, top, 0, bot);
  for (const [t, col] of o.stops) gr.addColorStop(t, col);
  l.fillStyle = gr; l.fillText(text, bx + 2.0 * k, by + 3.0 * k);
  // soft sheen over the upper half of the face
  const sh = l.createLinearGradient(0, top, 0, top + (bot - top) * 0.55);
  sh.addColorStop(0, 'rgba(255,255,255,0.28)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
  l.fillStyle = sh; l.fillRect(-W, top, W * 3, (bot - top) * 0.55);
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(lc, 0, 0); c.restore();
  // trim cap
  if (!o.lit) { c.lineJoin = 'round'; c.lineWidth = 1.4 * k; c.strokeStyle = o.trim || 'rgba(90,10,20,0.55)'; c.strokeText(text, bx, by); }
  c.restore();
  return { m, size };
}

// Neon tube along a path (glow, coloured tube, hot core). `clips` adds the little stand-off clips.
function neonPath(c, path, color, core, width, { lit = false, clips = 0 } = {}) {
  c.save();
  c.lineJoin = 'round'; c.lineCap = 'round';
  c.strokeStyle = color; c.shadowColor = color;
  c.shadowBlur = width * 3.2; c.lineWidth = width; path(); c.stroke();
  c.shadowBlur = width * 1.2; path(); c.stroke();
  c.shadowColor = 'transparent'; c.shadowBlur = 0;
  c.strokeStyle = core; c.lineWidth = width * 0.38; path(); c.stroke();
  c.restore();
  if (clips && !lit) {
    c.save(); c.fillStyle = 'rgba(20,20,20,0.85)';
    for (const [x, y] of clips) { c.fillRect(x - width * 0.55, y - width * 0.9, width * 1.1, width * 1.8); }
    c.restore();
  }
}

// --- billboard: deep teal panel board with illuminated channel letters. English left, Arabic right
//     (as Abu Dhabi signs do), glowing yellow KOREAN BBQ roundel in the middle, pink + teal neon border.
//     `lit` = the emissive layer (only what glows), used as the material's emissiveMap.
function billboardDesign(R, F, lit = false) {
  const w = 4096, h = 400;
  const kind = R.kind.toUpperCase().split(' ');
  return {
    w, h, bg: lit ? '#000000' : BRAND.tealDeep, border: null, aged: lit ? 0 : 0.18, seed: lit ? 64 : 61, lines: [],
    fonts: [
      { font: brandFont(F), text: `${R.name}${R.kind.toUpperCase()}` },
      { font: brandFontAr(F), text: R.nameAr },
    ],
    draw: (c) => {
      if (!lit) {
        // aluminium composite panels painted deep teal: gradient, faint brushed streaks, panel seams
        const gr = c.createLinearGradient(0, 0, 0, h);
        gr.addColorStop(0, '#1e6b69'); gr.addColorStop(0.55, BRAND.teal); gr.addColorStop(1, '#0d3d3f');
        c.fillStyle = gr; c.fillRect(0, 0, w, h);
        const r = T.rng(66);
        for (let i = 0; i < 900; i++) { c.fillStyle = `rgba(255,255,255,${r() * 0.025})`; c.fillRect(r() * w, r() * h, 40 + r() * 160, 1); }
        c.fillStyle = 'rgba(0,0,0,0.28)';
        for (let x = w / 10; x < w; x += w / 10) c.fillRect(Math.round(x), 0, 3, h);
        c.fillStyle = 'rgba(255,255,255,0.05)';
        for (let x = w / 10; x < w; x += w / 10) c.fillRect(Math.round(x) + 3, 0, 1, h);
        const v = c.createLinearGradient(0, 0, 0, h);
        v.addColorStop(0, 'rgba(0,0,0,0.25)'); v.addColorStop(0.15, 'rgba(0,0,0,0)'); v.addColorStop(0.85, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.3)');
        c.fillStyle = v; c.fillRect(0, 0, w, h);
        c.strokeStyle = '#0a2324'; c.lineWidth = 10; c.strokeRect(5, 5, w - 10, h - 10);
      }
      // neon border: pink tube, thin teal tube inside it
      const clipsAt = (inset) => {
        const pts = [];
        for (let x = 220; x < w - 100; x += 410) { pts.push([x, inset]); pts.push([x, h - inset]); }
        return pts;
      };
      neonPath(c, () => { roundRect(c, 24, 24, w - 48, h - 48, 26); }, BRAND.pink, '#ffe1ec', 9, { lit, clips: clipsAt(24) });
      neonPath(c, () => { roundRect(c, 44, 44, w - 88, h - 88, 16); }, BRAND.tealNeon, '#dcfff9', 4, { lit });

      // the two names
      glowWord(c, R.name, w * 0.262, h * 0.5, {
        family: brandFont(F), size: 300, maxW: w * 0.36, maxH: h * 0.6, stops: BRAND.en,
        glow: 'rgba(255,120,60,0.9)', edge: '#4c0c10', depth: 9, lit,
      });
      glowWord(c, R.nameAr, w * 0.738, h * 0.47, {
        family: brandFontAr(F), size: 300, rtl: true, maxW: w * 0.3, maxH: h * 0.7, stops: BRAND.ar,
        glow: 'rgba(255,79,139,0.9)', edge: '#4a0a26', depth: 9, lit,
      });

      // KOREAN BBQ roundel: yellow neon ring around a dark disc
      const bx = w / 2, by = h / 2, br = 150;
      if (!lit) {
        c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.arc(bx + 6, by + 8, br + 6, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#0a2b2c'; c.beginPath(); c.arc(bx, by, br, 0, Math.PI * 2); c.fill();
      }
      neonPath(c, () => { c.beginPath(); c.arc(bx, by, br - 8, 0, Math.PI * 2); }, BRAND.yellow, '#fffbe6', 9, { lit });
      neonPath(c, () => { c.beginPath(); c.arc(bx, by, br - 26, 0, Math.PI * 2); }, BRAND.pink, '#ffe1ec', 3, { lit });
      glowWord(c, kind[0] || '', bx, by - 52, { family: brandFont(F), size: 52, spacing: 8, maxW: 190, stops: BRAND.gold, glow: 'rgba(255,211,92,0.8)', depth: 2, halo: 0.25, lit });
      glowWord(c, kind.slice(1).join(' '), bx, by + 34, { family: brandFont(F), size: 118, spacing: 3, maxW: 210, stops: BRAND.gold, glow: 'rgba(255,200,80,0.9)', edge: '#5a3a06', depth: 4, lit });
      for (const sx of [-1, 1]) star(c, bx + sx * 108, by - 52, 8, BRAND.pink);
    },
  };
}

// --- vertical lightbox (backlit acrylic face): Arabic name on top, SEOULICIOUS stacked in tall
//     letters, KOREAN BBQ at the foot — same lit wordmark as the billboard
function lightboxDesign(R, F) {
  const w = 384, h = 1980;
  const word = R.name.toUpperCase();
  const kind = R.kind.toUpperCase().split(' ');
  return {
    w, h, bg: BRAND.tealDeep, border: '#0a2324', borderW: 14, aged: 0.08, seed: 81, lines: [],
    fonts: [
      { font: brandFont(F), text: word + R.kind.toUpperCase() },
      { font: brandFontAr(F), text: R.nameAr },
    ],
    draw: (c) => {
      const gr = c.createLinearGradient(0, 0, w, 0);
      gr.addColorStop(0, '#0f4446'); gr.addColorStop(0.5, '#17595a'); gr.addColorStop(1, '#0f4446');
      c.fillStyle = gr; c.fillRect(14, 14, w - 28, h - 28);
      neonPath(c, () => { roundRect(c, 30, 30, w - 60, h - 60, 14); }, BRAND.pink, '#ffe1ec', 5);
      glowWord(c, R.nameAr, w / 2, h * 0.082, { family: brandFontAr(F), size: 170, rtl: true, maxW: w - 90, maxH: 190, stops: BRAND.ar, glow: 'rgba(255,79,139,0.85)', depth: 4 });
      c.fillStyle = BRAND.yellow; c.fillRect(64, h * 0.152, w - 128, 4);
      // stacked tall letters
      const y0 = h * 0.18, y1 = h * 0.835, cell = (y1 - y0) / word.length;
      c.save();
      c.font = fontSpec(100, brandFont(F));
      const om = c.measureText('O');
      const capH = om.actualBoundingBoxAscent + om.actualBoundingBoxDescent;
      c.restore();
      const size = (100 * cell * 0.82) / Math.max(1, capH);
      [...word].forEach((ch, i) => {
        c.save();
        c.translate(w / 2, y0 + cell * (i + 0.5));
        c.scale(0.9, 1);
        glowWord(c, ch, 0, 0, { family: brandFont(F), size, stops: BRAND.en, glow: 'rgba(255,120,60,0.85)', depth: 4, halo: 0.22 });
        c.restore();
      });
      c.fillStyle = BRAND.yellow; c.fillRect(64, h * 0.855, w - 128, 4);
      glowWord(c, kind[0] || '', w / 2, h * 0.893, { family: brandFont(F), size: 66, spacing: 8, maxW: w - 110, stops: BRAND.gold, glow: 'rgba(255,211,92,0.8)', depth: 2, halo: 0.25 });
      glowWord(c, kind.slice(1).join(' '), w / 2, h * 0.947, { family: brandFont(F), size: 120, spacing: 8, maxW: w - 110, stops: BRAND.gold, glow: 'rgba(255,200,80,0.85)', depth: 3, halo: 0.25 });
    },
  };
}

// --- the hero A-board: a printed poster in an LED snap frame (backlit, so it reads at night).
//     Uses the meal-deal photo when it is there (drawn in once it loads), a plain panel otherwise.
const DEAL_PHOTO = 'assets/ai/menu/meal-deal.jpg';
let dealPhoto = null;
function getDealPhoto() {
  if (!dealPhoto && typeof Image !== 'undefined') {
    dealPhoto = new Image();
    dealPhoto.ready = new Promise((res) => { dealPhoto.onload = res; dealPhoto.onerror = res; });
    dealPhoto.src = DEAL_PHOTO;
  }
  return dealPhoto;
}

function offerDesign(R, F, deal) {
  const w = 1024, h = 1604;
  const P = dealParts(R, deal);
  const red = '#b3261e', deep = '#7a1610', ink = '#231a14', cream = '#f7efdf', mustard = '#f2b23a';
  const photo = getDealPhoto();
  return {
    w, h, bg: cream, border: null, aged: 0.1, seed: 131, lines: [], image: photo,
    fonts: [
      { font: F.display, text: `${P.kicker}${P.line1}${P.line2}${P.cur}${P.amount}${P.extraPrice}+` },
      { font: F.sans, weight: 600, text: `WHAT'S INCLUDED OPTIONAL EXTRA ${deal.items.join('')}${P.extra}` },
      { font: brandFont(F), text: R.name },
      { font: brandFontAr(F), text: R.nameAr },
    ],
    draw: (c) => {
      const r = T.rng(132);
      for (let i = 0; i < 2500; i++) { c.fillStyle = `rgba(120,90,60,${r() * 0.05})`; c.fillRect(r() * w, r() * h, 2, 2); }
      // header with soft rays
      const H = 330;
      c.fillStyle = red; c.fillRect(0, 0, w, H);
      c.save();
      c.beginPath(); c.rect(0, 0, w, H); c.clip();
      c.translate(w / 2, H + 40);
      c.fillStyle = 'rgba(120,20,14,0.35)';
      for (let i = 0; i < 24; i += 2) {
        const a0 = Math.PI + (i / 24) * Math.PI, a1 = Math.PI + ((i + 1) / 24) * Math.PI;
        c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 900, a0, a1); c.closePath(); c.fill();
      }
      c.restore();
      const km = label(c, P.kicker, w / 2, 60, { family: F.display, size: 50, spacing: 13, color: '#f8dcae', maxW: 560 });
      const kw = km.width / 2 + 26;
      c.fillStyle = 'rgba(248,220,174,0.75)';
      c.fillRect(120, 58, w / 2 - kw - 120, 3); c.fillRect(w / 2 + kw, 58, w / 2 - kw - 120, 3);
      const head = { family: F.display, size: 132, maxW: 800, depth: 6, step: 1.4, side: deep };
      label(c, P.line1, w / 2, 160, { ...head, color: '#ffffff' });
      label(c, P.line2, w / 2, 275, { ...head, color: '#ffd27a' });

      // photo band
      const py0 = H, ph = 500;
      if (photo && photo.complete && photo.naturalWidth) {
        const sw = photo.naturalWidth, sh = sw * (ph / w);
        const sy = Math.min(photo.naturalHeight - sh, photo.naturalHeight * 0.07);
        c.drawImage(photo, 0, sy, sw, sh, 0, py0, w, ph);
        const sh2 = c.createLinearGradient(0, py0, 0, py0 + 40);
        sh2.addColorStop(0, 'rgba(40,10,5,0.35)'); sh2.addColorStop(1, 'rgba(40,10,5,0)');
        c.fillStyle = sh2; c.fillRect(0, py0, w, 40);
      } else {
        const pg = c.createRadialGradient(w / 2, py0 + ph / 2, 40, w / 2, py0 + ph / 2, w * 0.7);
        pg.addColorStop(0, '#6b2a18'); pg.addColorStop(1, '#2a120b');
        c.fillStyle = pg; c.fillRect(0, py0, w, ph);
      }
      c.fillStyle = mustard; c.fillRect(0, py0 - 2, w, 12);
      c.fillStyle = mustard; c.fillRect(0, py0 + ph - 6, w, 12);

      // price roundel overlapping the photo's lower right corner
      const bx = 820, by = py0 + ph - 26, br = 132;
      c.save();
      c.translate(bx, by); c.rotate(-0.12);
      c.fillStyle = 'rgba(30,10,5,0.35)'; c.beginPath(); c.arc(7, 9, br, 0, Math.PI * 2); c.fill();
      c.fillStyle = mustard; c.beginPath(); c.arc(0, 0, br, 0, Math.PI * 2); c.fill();
      c.strokeStyle = deep; c.lineWidth = 5; c.beginPath(); c.arc(0, 0, br - 14, 0, Math.PI * 2); c.stroke();
      label(c, P.cur, 0, -60, { family: F.display, size: 48, spacing: 6, color: ink });
      label(c, P.amount, 0, 22, { family: F.display, size: 150, color: deep, maxW: 190 });
      c.restore();

      // what's included
      const ly = py0 + ph + 62;
      const lm = label(c, "WHAT'S INCLUDED", 84, ly, { family: F.sans, weight: 600, size: 30, spacing: 7, color: red, align: 'left' });
      c.fillStyle = 'rgba(35,26,20,0.22)'; c.fillRect(84 + lm.width + 14, ly - 1, 640 - (84 + lm.width + 14), 2);
      deal.items.forEach((item, i) => {
        const y = ly + 78 + i * 80;
        c.fillStyle = red; c.beginPath(); c.arc(104, y, 16, 0, Math.PI * 2); c.fill();
        c.strokeStyle = '#ffffff'; c.lineWidth = 4.5; c.lineCap = 'round'; c.lineJoin = 'round';
        c.beginPath(); c.moveTo(96, y + 1); c.lineTo(102, y + 7); c.lineTo(113, y - 6); c.stroke();
        label(c, item, 140, y, { family: F.sans, weight: 600, size: 49, color: ink, align: 'left', maxW: 800 });
        if (i < deal.items.length - 1) {
          c.fillStyle = 'rgba(35,26,20,0.13)';
          for (let x = 88; x < 940; x += 14) c.fillRect(x, y + 40, 7, 2);
        }
      });

      // optional extra: polaroid
      const ey = ly + 78 + 4 * 80 + 56, eh = 122;
      c.setLineDash([14, 10]); c.strokeStyle = red; c.lineWidth = 3.5;
      roundRect(c, 70, ey, w - 140, eh, 18); c.stroke(); c.setLineDash([]);
      c.save();
      c.translate(158, ey + eh / 2); c.rotate(-0.09);
      c.fillStyle = 'rgba(40,20,10,0.25)'; c.fillRect(-42, -46, 92, 104);
      c.fillStyle = '#ffffff'; c.fillRect(-48, -52, 92, 104);
      c.strokeStyle = 'rgba(0,0,0,0.15)'; c.lineWidth = 2; c.strokeRect(-48, -52, 92, 104);
      const pg = c.createLinearGradient(0, -44, 0, 30);
      pg.addColorStop(0, '#f2b23a'); pg.addColorStop(1, '#b3261e');
      c.fillStyle = pg; c.fillRect(-40, -44, 76, 74);
      c.fillStyle = '#fff1c9'; c.beginPath(); c.arc(-12, -17, 11, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#5a1510'; c.beginPath(); c.moveTo(-40, 30); c.lineTo(-10, 4); c.lineTo(8, 19); c.lineTo(24, 7); c.lineTo(36, 19); c.lineTo(36, 30); c.closePath(); c.fill();
      c.restore();
      label(c, 'OPTIONAL EXTRA', 236, ey + 40, { family: F.sans, weight: 600, size: 25, spacing: 6, color: red, align: 'left' });
      label(c, P.extra, 236, ey + 85, { family: F.sans, weight: 600, size: 44, color: ink, align: 'left', maxW: 430 });
      label(c, `+ ${P.extraPrice}`, w - 104, ey + eh / 2 + 2, { family: F.display, size: 64, color: deep, align: 'right', maxW: 230 });

      // footer
      c.fillStyle = ink; c.fillRect(0, h - 88, w, 88);
      c.fillStyle = mustard; c.fillRect(0, h - 88, w, 5);
      label(c, R.name, w / 2 - 34, h - 42, { family: brandFont(F), size: 50, spacing: 1, color: cream, align: 'right' });
      c.fillStyle = mustard; c.beginPath(); c.arc(w / 2, h - 42, 6, 0, Math.PI * 2); c.fill();
      label(c, R.nameAr, w / 2 + 34, h - 46, { family: brandFontAr(F), size: 50, color: cream, align: 'left', rtl: true, maxH: 52 });
    },
  };
}

// --- the second A-board: the same deal hand-lettered on a chalkboard
function chalkDesign(R, F, deal) {
  const w = 1024, h = 1604;
  const P = dealParts(R, deal);
  const kind = (P.kicker || R.kind).toLowerCase().replace(/(^|\s)\S/g, (s) => s.toUpperCase()).replace(/bbq/i, 'BBQ');
  return {
    w, h, bg: '#1d2420', border: null, aged: 0.22, seed: 141, lines: [],
    fonts: [
      { font: F.neon, text: `${kind}includes${R.name}` },
      { font: F.display, text: `${P.line1}${P.line2}${P.cur}${P.amount}` },
      { font: F.cute, text: `${deal.items.join('')}+ ${P.extra}${P.extraPrice}–` },
    ],
    draw: (c) => {
      const r = T.rng(142);
      for (let i = 0; i < 60; i++) {
        c.fillStyle = `rgba(255,255,255,${0.015 + r() * 0.03})`;
        c.beginPath(); c.ellipse(r() * w, r() * h, 40 + r() * 120, 10 + r() * 26, r() * 3, 0, Math.PI * 2); c.fill();
      }
      // letter everything on its own layer, then rub it like chalk
      const [lc, l] = T.makeCanvas(w, h);
      label(l, kind, w / 2, 118, { family: F.neon, size: 96, color: '#f3dc8a', maxW: 760 });
      label(l, P.line1, w / 2, 262, { family: F.display, size: 132, spacing: 4, color: '#f4f1ea', maxW: 820 });
      label(l, P.line2, w / 2, 394, { family: F.display, size: 132, spacing: 4, color: '#f4f1ea', maxW: 860 });
      l.strokeStyle = '#f2a7b5'; l.lineWidth = 6; l.lineCap = 'round';
      l.beginPath(); l.moveTo(250, 470); l.bezierCurveTo(420, 455, 620, 482, 774, 462); l.stroke();
      const pm = label(l, `${P.cur} ${P.amount}`, w / 2, 590, { family: F.display, size: 150, spacing: 2, color: '#f2a7b5', maxW: 640 });
      l.strokeStyle = 'rgba(244,241,234,0.85)'; l.lineWidth = 5;
      for (let k = 0; k < 2; k++) {
        l.beginPath(); l.ellipse(w / 2 + k * 6, 590 + k * 4, pm.width / 2 + 70 - k * 8, 118 - k * 6, -0.03 + k * 0.05, 0.1, Math.PI * 2 - 0.05); l.stroke();
      }
      label(l, 'includes', w / 2, 790, { family: F.neon, size: 64, color: '#bfe3d0' });
      deal.items.forEach((item, i) => label(l, item, w / 2, 886 + i * 88, { family: F.cute, size: 56, color: '#f4f1ea', maxW: 840 }));
      label(l, `+ ${P.extra}  ${P.extraPrice}`, w / 2, 1366, { family: F.cute, size: 54, color: '#f3dc8a', maxW: 840 });
      [[120, 160, 18], [905, 110, 14], [120, 1250, 14], [900, 1440, 18], [880, 740, 12]].forEach(([x, y, s]) => {
        l.strokeStyle = 'rgba(243,220,138,0.9)'; l.lineWidth = 3; l.beginPath();
        for (let k = 0; k < 5; k++) { const a = (k * 4 * Math.PI) / 5 - Math.PI / 2; l.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s); }
        l.closePath(); l.stroke();
      });
      label(l, R.name, w / 2, 1500, { family: F.neon, size: 64, color: '#f4f1ea' });
      // chalk: punch tiny holes, soften slightly
      l.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 15000; i++) { l.fillStyle = `rgba(0,0,0,${0.2 + r() * 0.45})`; l.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 1.5); }
      l.globalCompositeOperation = 'source-over';
      c.save(); c.globalAlpha = 0.93; c.filter = 'blur(0.6px)'; c.drawImage(lc, 0, 0); c.restore();
    },
  };
}

// --- hanging plaque on the door: WELCOME + 어서오세요
function welcomeDesign(F) {
  const w = 768, h = 352;
  return {
    w, h, bg: '#efe3c9', border: '#4a2418', borderW: 16, inner: { color: '#b3261e', width: 4, pad: 30 }, aged: 0.3, seed: 151, lines: [],
    fonts: [{ font: F.display, text: 'WELCOME어서오세요' }],
    draw: (c) => {
      label(c, 'WELCOME', w / 2, h * 0.39, { family: F.display, size: 132, spacing: 12, color: '#2a1d16', maxW: w - 130 });
      c.fillStyle = 'rgba(179,38,30,0.8)'; c.fillRect(w / 2 - 150, h * 0.585, 300, 3);
      label(c, '어서오세요', w / 2, h * 0.76, { family: F.display, size: 84, spacing: 4, color: '#b3261e', maxW: w - 200 });
    },
  };
}

// --- white vinyl door decal (transparent background)
function decalDesign(word, F, seed) {
  const w = 512, h = 160;
  return {
    w, h, bg: 'rgba(0,0,0,0)', border: null, aged: 0, seed, lines: [],
    fonts: [{ font: F.sans, weight: 600, text: word }],
    draw: (c) => {
      label(c, word, w / 2, h / 2, { family: F.sans, weight: 600, size: 104, spacing: 26, color: '#ffffff', maxW: w - 40 });
    },
  };
}

// --- red/white/blue paper lantern
function lanternDesign(R, F) {
  const w = 1024, h = 256;
  return {
    w, h, bg: '#f4efe4', border: null, aged: 0.15, seed: 51, lines: [],
    fonts: [{ font: brandFont(F), text: R.name }],
    draw: (c) => {
      c.fillStyle = '#c8322b'; c.fillRect(0, 0, w, h * 0.2); c.fillRect(0, h * 0.8, w, h * 0.2);
      c.fillStyle = '#2f5f9a'; c.fillRect(0, h * 0.2, w, h * 0.05); c.fillRect(0, h * 0.75, w, h * 0.05);
      for (const u of [0.25, 0.75]) {
        label(c, R.name, w * u, h * 0.5, { family: brandFont(F), size: 84, color: '#e2372c', maxW: w * 0.3, depth: 3, step: 1.2, side: '#7a1418' });
      }
    },
  };
}

// --- Abu Dhabi style building number plate: blue, white border, English + Arabic numerals/text
function plateDesign(F) {
  const w = 512, h = 320;
  return {
    w, h, bg: '#1d4f9a', border: '#ffffff', borderW: 12, inner: { color: 'rgba(255,255,255,0.9)', width: 3, pad: 24 }, aged: 0.15, seed: 91, lines: [],
    fonts: [{ font: F.sans, weight: 600, text: '18 Building No.' }, { font: F.arabic, weight: 800, text: '١٨' }, { font: F.arabic, weight: 500, text: 'رقم المبنى' }],
    draw: (c) => {
      label(c, '18', w * 0.28, h * 0.42, { family: F.sans, weight: 600, size: 150, color: '#ffffff', maxW: w * 0.36, maxH: 120 });
      label(c, '١٨', w * 0.72, h * 0.42, { family: F.arabic, weight: 800, size: 150, color: '#ffffff', rtl: true, maxW: w * 0.36, maxH: 120 });
      c.fillStyle = 'rgba(255,255,255,0.9)'; c.fillRect(w / 2 - 1.5, h * 0.17, 3, h * 0.5);
      c.fillRect(46, h * 0.73, w - 92, 3);
      label(c, 'Building No.', w * 0.28, h * 0.85, { family: F.sans, weight: 600, size: 30, color: '#ffffff', maxW: w * 0.38 });
      label(c, 'رقم المبنى', w * 0.72, h * 0.845, { family: F.arabic, weight: 500, size: 32, color: '#ffffff', rtl: true, maxW: w * 0.38 });
    },
  };
}

// --- neighbour's laundry sign: LAUNDRY / مغسلة
function laundryDesign(F) {
  const w = 1024, h = 200;
  return {
    w, h, bg: '#eef3f6', border: '#2d5d8f', borderW: 10, aged: 0.45, seed: 121, lines: [],
    fonts: [{ font: F.sans, weight: 600, text: 'LAUNDRY' }, { font: F.arabic, weight: 800, text: 'مغسلة' }],
    draw: (c) => {
      const blue = '#2d5d8f';
      label(c, 'LAUNDRY', w * 0.26, h * 0.5, { family: F.sans, weight: 600, size: 88, spacing: 9, color: blue, maxW: w * 0.38 });
      label(c, 'مغسلة', w * 0.76, h * 0.47, { family: F.arabic, weight: 800, size: 110, color: blue, rtl: true, maxW: w * 0.3, maxH: h * 0.66 });
      // coat hanger
      c.save(); c.translate(w * 0.545, h * 0.52); c.strokeStyle = blue; c.lineWidth = 7; c.lineJoin = 'round'; c.lineCap = 'round';
      c.beginPath(); c.arc(0, -38, 11, Math.PI * 1.05, Math.PI * 2.35); c.lineTo(0, -16); c.lineTo(-52, 22); c.lineTo(52, 22); c.closePath(); c.stroke();
      c.restore();
    },
  };
}

// What you see through the laundry's window: cool light, a row of washers under a row of dryers (no text)
function laundryInterior() {
  const [c, x] = T.makeCanvas(512, 272);
  const gr = x.createLinearGradient(0, 0, 0, 272);
  gr.addColorStop(0, '#b4c9d8'); gr.addColorStop(0.6, '#7891a4'); gr.addColorStop(1, '#3a4651');
  x.fillStyle = gr; x.fillRect(0, 0, 512, 272);
  x.fillStyle = 'rgba(255,255,255,0.8)';
  for (const lx of [90, 256, 422]) x.fillRect(lx - 50, 6, 100, 6);              // ceiling tubes
  const unit = (ux, uy, w, h) => {
    x.fillStyle = '#d5dade'; x.fillRect(ux, uy, w, h);
    x.fillStyle = '#b9c2c8'; x.fillRect(ux, uy, w, 8);
    x.fillStyle = '#2b3a46'; x.beginPath(); x.arc(ux + w / 2, uy + h * 0.58, w * 0.3, 0, Math.PI * 2); x.fill();
    x.strokeStyle = '#8f9aa2'; x.lineWidth = 4; x.stroke();
    x.fillStyle = 'rgba(160,200,230,0.5)'; x.beginPath(); x.arc(ux + w / 2 - 6, uy + h * 0.52, w * 0.12, 0, Math.PI * 2); x.fill();
  };
  for (let i = 0; i < 7; i++) { unit(20 + i * 70, 150, 62, 84); unit(20 + i * 70, 66, 62, 76); }
  x.fillStyle = '#3a3f44'; x.fillRect(0, 236, 512, 36);                          // counter / floor
  return c;
}

// Light pools painted onto the billboard (a light map): flood lamps below, eave downlight scallops above
function billboardLightMap(bw, lampXs, downXs) {
  const W = 1024, H = 128;
  const [c, x] = T.makeCanvas(W, H);
  x.fillStyle = 'rgb(84,80,74)'; x.fillRect(0, 0, W, H);
  x.globalCompositeOperation = 'lighter';
  const u = (wx) => ((wx + bw / 2) / bw) * W;
  for (const lx of lampXs) {
    const gr = x.createRadialGradient(u(lx), H * 1.25, 6, u(lx), H * 1.25, 230);
    gr.addColorStop(0, 'rgba(255,214,160,0.95)'); gr.addColorStop(0.5, 'rgba(255,200,140,0.35)'); gr.addColorStop(1, 'rgba(255,200,140,0)');
    x.fillStyle = gr; x.fillRect(0, 0, W, H);
  }
  for (const dx of downXs) {
    x.save(); x.translate(u(dx), -6); x.scale(1, 1.9);
    const gr = x.createRadialGradient(0, 0, 2, 0, 0, 42);
    gr.addColorStop(0, 'rgba(255,205,150,0.75)'); gr.addColorStop(1, 'rgba(255,205,150,0)');
    x.fillStyle = gr; x.fillRect(-60, 0, 120, 60);
    x.restore();
  }
  return T.toTexture(c, { wrap: false, color: false });
}

// ------------------------------------------------------------------
// 1. shop-front wall with real openings
// ------------------------------------------------------------------
function buildFacade(S) {
  const { g, mats, L } = S;
  const zIn = L.zFront, zOut = L.zFrontOut, d = zOut - zIn, zc = (zIn + zOut) / 2;
  const yB = L.sidewalkY, yT = L.slabTop;
  const W = L.frontWindow, D = L.door, SW = L.sideWindow;
  const xl = S.X0, xr = S.X1;
  const rv = mats.woodExt, inner = mats.plaster;

  // material order: +x, -x, +y, -y, +z (street), -z (inside)
  const piece = (x0, x1, y0, y1, outer, sides = rv) =>
    box(g, [sides, sides, rv, rv, outer, inner], x1 - x0, y1 - y0, d, (x0 + x1) / 2, y0, zc);

  piece(xl, W.x0, yB, yT, mats.brick, mats.brick);   // left pier (lightbox sign)
  piece(W.x0, W.x1, yB, W.y0, mats.woodExt);          // stall riser under the left window
  piece(W.x0, W.x1, W.y1, yT, mats.woodExt);          // header above it
  piece(W.x1, D.x0, yB, yT, mats.brick);              // pier left of the door
  piece(D.x0, D.x1, D.h, yT, mats.woodExt);           // above the door
  piece(D.x0, D.x1, yB, -0.003, mats.woodDeck);       // below the threshold (the shop floor runs over it)
  piece(D.x1, SW.x0, yB, yT, mats.brick);             // pier right of the door
  piece(SW.x0, SW.x1, yB, SW.y0, mats.woodExt);       // stall riser under the right window
  piece(SW.x0, SW.x1, SW.y1, yT, mats.woodExt);       // header above it
  piece(SW.x1, xr, yB, yT, mats.brick, mats.brick);   // right pier

  // concrete plinth along the foot of the front
  box(g, mats.concrete, xr - xl + 0.04, 0.22, 0.04, 0, yB, zOut + 0.02, { cast: false });
  // timber cap on the stall risers
  for (const Wd of [W, SW]) box(g, mats.woodDark, Wd.x1 - Wd.x0, 0.05, 0.05, (Wd.x0 + Wd.x1) / 2, yB + 0.22, zOut + 0.025, { cast: false });

  // dark wood casings around the openings (outer face)
  const casing = (x0, x1, y0, y1) => {
    const w = x1 - x0, cx = (x0 + x1) / 2, t = 0.08, zz = zOut + 0.025;
    box(g, mats.woodDark, w + t * 2, t, 0.05, cx, y1, zz);
    box(g, mats.woodDarkV, t, y1 - y0, 0.05, x0 - t / 2, y0, zz);
    box(g, mats.woodDarkV, t, y1 - y0, 0.05, x1 + t / 2, y0, zz);
  };
  casing(W.x0, W.x1, W.y0, W.y1);
  casing(SW.x0, SW.x1, SW.y0, SW.y1);
  casing(D.x0, D.x1, 0, D.h);

  // window grids: three sections, two lights each, transom bar, glass
  const grid = (Wd) => {
    const { x0, x1, y0, y1 } = Wd, w = x1 - x0, h = y1 - y0, zm = zc + 0.03, sections = 3;
    const sw = w / sections;
    for (let s = 1; s < sections; s++) box(g, mats.woodDarkV, 0.09, h, 0.08, x0 + sw * s, y0, zm);
    for (let s = 0; s < sections; s++) box(g, mats.woodDarkV, 0.045, h, 0.06, x0 + s * sw + sw / 2, y0, zm, { cast: false });
    box(g, mats.woodDark, w, 0.05, 0.06, (x0 + x1) / 2, y0 + h * 0.66, zm, { cast: false });
    box(g, mats.woodDark, w, 0.06, 0.1, (x0 + x1) / 2, y0, zm, { cast: false });       // bottom rail
    const gl = plane(g, S.lm.glass, w, h, { receive: false });
    gl.position.set((x0 + x1) / 2, (y0 + y1) / 2, zc);
  };
  grid(W);
  grid(SW);

  // deep wooden ledges under both windows, on brackets (the planters sit on these)
  for (const Wd of [W, SW]) {
    const cx = (Wd.x0 + Wd.x1) / 2, w = Wd.x1 - Wd.x0 + 0.3;
    box(g, mats.woodExt, w, 0.06, 0.36, cx, Wd.y0 - 0.06, zOut + 0.18);
    box(g, mats.woodDark, w + 0.02, 0.05, 0.025, cx, Wd.y0 - 0.075, zOut + 0.3725, { cast: false });   // front lip
    for (const x of [Wd.x0 + 0.35, cx, Wd.x1 - 0.35]) {
      box(g, mats.woodDark, 0.05, 0.3, 0.04, x, Wd.y0 - 0.38, zOut + 0.02, { cast: false });
      rod(g, mats.woodDark, [x, Wd.y0 - 0.36, zOut + 0.04], [x, Wd.y0 - 0.075, zOut + 0.32], 0.018);
    }
  }

  // rain-water downpipe at the right corner
  rod(g, S.lm.pole, [xr - 0.16, yB, zOut + 0.08], [xr - 0.16, 4.75, zOut + 0.08], 0.042, 10);
  rod(g, S.lm.pole, [xr - 0.16, yB + 0.12, zOut + 0.08], [xr - 0.16, yB + 0.02, zOut + 0.24], 0.042, 10);
  for (const y of [0.4, 1.8, 3.3]) box(g, mats.blackSteel, 0.11, 0.03, 0.09, xr - 0.16, y, zOut + 0.045, { cast: false });
}

// ------------------------------------------------------------------
// 2. a pair of glass doors (open outward), PULL outside / PUSH inside, welcome plaque
// ------------------------------------------------------------------
function buildDoor(S) {
  const { g: root, mats, lm, L, camera, animators, designs } = S;
  const D = L.door, zOut = L.zFrontOut;
  const zD = zOut - 0.075;                 // the leaves sit near the outside face so they swing out cleanly
  const jamb = 0.04, gap = 0.006, t = 0.045;
  const xi = (D.x1 - D.x0) / 2 - jamb;      // inner face of the side jambs
  const leafW = xi - gap * 1.5;
  const y0 = 0.012, H = D.h - jamb - gap - y0;

  // steel door frame + threshold
  for (const s of [-1, 1]) box(root, lm.doorMetal, jamb, D.h, 0.11, s * (xi + jamb / 2), 0, zD);
  box(root, lm.doorMetal, xi * 2, jamb, 0.11, 0, D.h - jamb, zD);
  box(root, lm.brass, xi * 2, 0.012, 0.16, 0, 0, zD + 0.01, { cast: false });

  const pullMat = (tex) => new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.04, depthWrite: false, roughness: 0.5, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.45 });
  const pullM = pullMat(T.sign(designs.pull));
  const pushM = pullMat(T.sign(designs.push));
  const welcomeM = signMaterial(T.sign(designs.welcome), { glow: 0.22 });

  const leaves = [];
  for (const s of [-1, 1]) {
    // hinge on the outer edge; u = distance from the hinge toward the centre, local x = -s * u
    const hinge = new THREE.Group();
    hinge.position.set(s * (xi - gap), 0, zD);
    hinge.userData.keep = true;
    root.add(hinge);
    const X = (u) => -s * u;
    const st = 0.055;
    box(hinge, lm.doorMetal, st, H, t, X(st / 2), y0, 0);
    box(hinge, lm.doorMetal, st, H, t, X(leafW - st / 2), y0, 0);
    box(hinge, lm.doorMetal, leafW - st * 2, 0.08, t, X(leafW / 2), y0 + H - 0.08, 0);
    box(hinge, lm.doorMetal, leafW - st * 2, 0.2, t, X(leafW / 2), y0, 0);
    const gl = plane(hinge, lm.doorGlass, leafW - st * 2 + 0.01, H - 0.27, { receive: false });
    gl.position.set(X(leafW / 2), y0 + 0.2 + (H - 0.28) / 2, 0);
    // back-to-back pull bars on the meeting stiles (brass)
    const hu = X(leafW - 0.028);
    for (const side of [1, -1]) {
      const zf = side * (t / 2), zb = side * (t / 2 + 0.06);
      const [ya, yb] = side > 0 ? [0.78, 1.58] : [0.86, 1.46];
      rod(hinge, lm.brass, [hu, ya, zb], [hu, yb, zb], 0.0125, 12);
      rod(hinge, lm.brass, [hu, ya + 0.08, zf], [hu, ya + 0.08, zb], 0.008, 8);
      rod(hinge, lm.brass, [hu, yb - 0.08, zf], [hu, yb - 0.08, zb], 0.008, 8);
    }
    // PULL on the street side, PUSH on the inside face
    const decalU = X(leafW * 0.44), decalY = 1.3;
    const pull = signPlane(hinge, pullM, 0.26, 0.08125);
    pull.position.set(decalU, decalY, 0.0035);
    const push = signPlane(hinge, pushM, 0.26, 0.08125);
    push.position.set(decalU, decalY, -0.0035);
    push.rotation.y = Math.PI;
    pull.renderOrder = push.renderOrder = 2;   // always after the glass they sit on
    leaves.push({ hinge, s });
  }

  // WELCOME / 어서오세요 plaque hanging on the left leaf, from a little suction hook
  const left = leaves[0].hinge;
  const pw = 0.4, ph = pw * (352 / 768), pu = leafW * 0.5, py = 1.66;   // left leaf: local x = +u
  const plq = signBox(left, welcomeM, mats.woodDark, pw, ph, 0.012, pu, py, t / 2 + 0.01);
  plq.castShadow = true;
  const hookY = py + ph + 0.14;
  const hook = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.008, 14), mats.ceramic);
  hook.rotation.x = Math.PI / 2; hook.position.set(pu, hookY, 0.006); left.add(hook);
  rod(left, mats.cord, [pu, hookY, t / 2 + 0.006], [pu - pw * 0.38, py + ph, t / 2 + 0.012], 0.0025, 4);
  rod(left, mats.cord, [pu, hookY, t / 2 + 0.006], [pu + pw * 0.38, py + ph, t / 2 + 0.012], 0.0025, 4);

  // auto-open: the leaves swing out when the camera comes within ~5.5 m from the street side, or
  // while it is moving toward/through the door from inside. Standing still inside, the doors stay
  // shut (so PUSH reads from inside). Teleports (fade cuts) are ignored.
  if (camera && animators) {
    const doorC = new THREE.Vector3(0, 1.2, zD);
    const prev = camera.position.clone();
    let speed = 0, open = 0;
    const OPEN = 1.56;  // ~89°: open leaves (incl. the inside pull bars) stay at |x| > 0.56, clear of the glide path
    animators.push((time, dt) => {
      const p = camera.position;
      const moved = p.distanceTo(prev);
      prev.copy(p);
      if (dt > 0) {
        if (moved > 3) speed = 0;
        else speed += (Math.min(moved / dt, 15) - speed) * Math.min(1, dt * 6);
      }
      const dist = p.distanceTo(doorC);
      const outside = p.z > zOut - 0.05;
      const want = dist < 5.5 && (outside || speed > 0.6 || dist < 1.8);
      open += ((want ? 1 : 0) - open) * Math.min(1, dt * 4);
      for (const { hinge, s } of leaves) hinge.rotation.y = s * OPEN * open;
    });
  }
}

// ------------------------------------------------------------------
// 3. wooden deck: a landing deep enough for the doors to swing over, then two steps down
// ------------------------------------------------------------------
function buildSteps(S) {
  const { g, mats, lm, L } = S;
  const zo = L.zFrontOut, yS = L.sidewalkY, rise = -yS / 3;
  const hw = 1.3, w = hw * 2, land = 1.0, tread = 0.3;
  box(g, mats.woodDeck, w, -yS, land, 0, yS, zo + land / 2);                      // landing, top y = 0
  box(g, mats.woodDeck, w, rise * 2, tread, 0, yS, zo + land + tread / 2);        // top -0.15
  box(g, mats.woodDeck, w, rise, tread, 0, yS, zo + land + tread * 1.5);          // top -0.30
  [[0, zo + land], [-rise, zo + land + tread], [-rise * 2, zo + land + tread * 2]].forEach(([top, z]) =>
    box(g, mats.woodDark, w + 0.02, 0.035, 0.045, 0, top - 0.034, z - 0.022, { cast: false }));
  // coir mat on the landing, clear of the door swing
  box(g, lm.coir, 1.0, 0.014, 0.55, 0, 0, zo + 0.48, { cast: false });
  box(g, mats.fabricDark, 1.04, 0.01, 0.59, 0, 0, zo + 0.48, { cast: false });
  // slim black steel handrails on both sides
  for (const s of [-1, 1]) {
    const x = s * (hw - 0.06);
    const zA = zo + 0.12, zB = zo + land - 0.05, zC = zo + land + tread * 2 - 0.1;
    rod(g, mats.blackSteel, [x, 0, zB], [x, 0.9, zB], 0.018, 8);
    rod(g, mats.blackSteel, [x, -rise * 2, zC], [x, -rise * 2 + 0.9, zC], 0.018, 8);
    rod(g, mats.blackSteel, [x, 0.9, zA], [x, 0.9, zB], 0.02, 8);
    rod(g, mats.blackSteel, [x, 0.9, zB], [x, -rise * 2 + 0.9, zC], 0.02, 8);
    rod(g, mats.blackSteel, [x, 0.9, zA], [x, 0.75, zo + 0.03], 0.016, 8);   // return to the wall
  }
}

// ------------------------------------------------------------------
// 4. rusty corrugated tin awning
// ------------------------------------------------------------------
function awningUnderY(S, z) {
  const { top, len, drop } = S.aw;
  return top - (z - S.zOut) * (drop / Math.sqrt(len * len - drop * drop)) - 0.03;
}
function awningEdge(S) {
  const { top, len, drop } = S.aw;
  const th = Math.asin(drop / len);
  return { z: S.zOut + len * Math.cos(th), y: top - drop, th };
}

function buildAwning(S) {
  const { g, mats } = S;
  const { x0, x1, top, len } = S.aw;
  const W = x1 - x0, cx = (x0 + x1) / 2, zOut = S.zOut;
  const { z: edgeZ, y: edgeY, th } = awningEdge(S);

  const geo = corrugatedGeometry(W, len, { wave: 0.09, amp: 0.02, uv: 1.2 });
  geo.rotateY(Math.PI);
  const tin = new THREE.Mesh(geo, mats.tin);
  tin.position.set(cx, top, zOut);
  tin.rotation.x = th;
  tin.castShadow = true; tin.receiveShadow = true;
  g.add(tin);

  box(g, mats.woodDark, W + 0.04, 0.16, 0.05, cx, edgeY - 0.13, edgeZ + 0.02);   // fascia
  box(g, mats.woodDark, W, 0.12, 0.08, cx, top - 0.17, zOut + 0.04);             // ledger on the wall
  // gutter along the front edge
  rod(g, mats.blackSteel, [x0 - 0.02, edgeY - 0.03, edgeZ + 0.08], [x1 + 0.02, edgeY - 0.03, edgeZ + 0.08], 0.04, 8);

  const rafterGeo = new THREE.BoxGeometry(0.06, 0.08, len);
  for (let x = x0 + 0.15; x <= x1 - 0.1; x += (W - 0.3) / 8) {
    const m = new THREE.Mesh(rafterGeo, mats.woodDark);
    m.position.set(x, top - (len / 2) * Math.sin(th) - 0.06, zOut + (len / 2) * Math.cos(th));
    m.rotation.x = th;
    m.castShadow = true;
    g.add(m);
  }

  // flood lamps on the awning edge, aimed back up at the billboard
  for (const x of S.floodXs) {
    const lamp = new THREE.Group();
    lamp.position.set(x, edgeY + 0.08, edgeZ - 0.18);
    lamp.rotation.x = 0.7;
    box(lamp, mats.blackSteel, 0.26, 0.16, 0.1, 0, -0.08, 0, { cast: false });
    const lens = signPlane(lamp, mats.bulbSoft, 0.2, 0.11);
    lens.rotation.y = Math.PI;
    lens.position.set(0, 0, -0.051);
    rod(lamp, mats.blackSteel, [0, -0.08, 0], [0, -0.16, 0.03], 0.012);
    g.add(lamp);
  }
}

// ------------------------------------------------------------------
// 5. illuminated billboard above the awning (English + Arabic + KOREAN BBQ)
// ------------------------------------------------------------------
function buildBillboard(S) {
  const { g, mats, designs } = S;
  const d = designs.billboard;
  const bw = 13.0, bh = bw * (d.h / d.w);
  const tex = T.sign(d);
  const glow = T.sign(designs.billboardGlow);     // only the lit letters + neon: drives the glow
  const mat = new THREE.MeshStandardMaterial({
    map: tex, emissive: '#ffffff', emissiveMap: glow, emissiveIntensity: 1.25, roughness: 0.5, metalness: 0.1,
    lightMap: billboardLightMap(bw, S.floodXs, S.downXs), lightMapIntensity: 1.2,
  });
  signBox(g, mat, mats.woodDark, bw, bh, 0.08, 0, 3.12, S.zOut + 0.04);
  // painted steel cap over the top edge
  box(g, S.lm.blackPaint, bw + 0.08, 0.04, 0.12, 0, 3.12 + bh, S.zOut + 0.06, { cast: false });
}

// ------------------------------------------------------------------
// 6. black hanok-style tiled eave across the top of the front
// ------------------------------------------------------------------
function buildEave(S) {
  const { g, mats, lm, zOut } = S;
  // dark frieze band between billboard and eave
  box(g, lm.blackPaint, S.X1 - S.X0 + 0.1, 0.95, 0.06, 0, 4.45, zOut + 0.03, { cast: false });

  const e = { x0: S.X0 - 0.15, x1: S.X1 + 0.15, zw: zOut + 0.06, yw: 5.38, zo: zOut + 1.2, yo: 4.86 };
  const dz = e.zo - e.zw, dy = e.yw - e.yo;
  const a = Math.atan2(dy, dz), len = Math.hypot(dz, dy), W = e.x1 - e.x0;
  const mid = new THREE.Vector3(0, (e.yw + e.yo) / 2, (e.zw + e.zo) / 2);
  const n = new THREE.Vector3(0, Math.cos(a), Math.sin(a));
  const dir = new THREE.Vector3(0, -Math.sin(a), Math.cos(a));
  const at = (along, off) => mid.clone().addScaledVector(dir, along).addScaledVector(n, off);

  const tilted = (geo, mat, p) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(p); m.rotation.x = a; m.castShadow = true; m.receiveShadow = true;
    g.add(m); return m;
  };
  tilted(new THREE.BoxGeometry(W, 0.05, len), lm.roofBase, mid);
  tilted(new THREE.BoxGeometry(W, 0.1, 0.06), lm.roofBase, at(len / 2, -0.04));

  const r = 0.065;
  const half = new THREE.CylinderGeometry(r, r, len + 0.04, 10, 1, true, 0, Math.PI);
  half.rotateX(Math.PI / 2); half.rotateZ(Math.PI / 2);
  const cap = new THREE.CylinderGeometry(r * 1.25, r * 1.25, 0.035, 16);
  cap.rotateX(Math.PI / 2);
  const tiles = new InstanceBatch(half, mats.roofTile);
  const caps = new InstanceBatch(cap, mats.roofTile);
  const p0 = at(0, 0.025), pc = at(len / 2 + 0.03, 0.02);
  for (let x = e.x0 + 0.12; x < e.x1; x += 0.24) {
    tiles.add(x, p0.y, p0.z, { rx: a });
    caps.add(x, pc.y, pc.z, { rx: a });
  }
  tiles.build(g); caps.build(g);

  box(g, mats.roofTile, W + 0.2, 0.2, 0.3, 0, e.yw - 0.06, e.zw + 0.1);
  [-1, 1].forEach((s) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.09, 0.32), mats.roofTile);
    m.position.set(s * (W / 2 - 0.1), e.yo + 0.1, e.zo - 0.05);
    m.rotation.set(a * 0.6, 0, s * 0.32);
    m.castShadow = true;
    g.add(m);
  });

  // warm glowing soffit underneath + rafters + downlights
  const soffit = new THREE.Mesh(new THREE.PlaneGeometry(W, len), lm.soffit);
  soffit.position.copy(at(0, -0.027));
  soffit.rotation.x = Math.PI / 2 + a;
  g.add(soffit);
  const rafters = new InstanceBatch(new THREE.BoxGeometry(0.07, 0.08, len), mats.woodDark, { cast: false });
  const pr = at(0, -0.07);
  for (let x = e.x0 + 0.2; x < e.x1; x += 0.55) rafters.add(x, pr.y, pr.z, { rx: a });
  rafters.build(g);
  const dl = new InstanceBatch(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 14), mats.bulb, { cast: false, receive: false });
  const pd = at(len / 2 - 0.14, -0.12);
  for (const x of S.downXs) dl.add(x, pd.y, pd.z, { rx: a });
  dl.build(g);

  // the sign's coloured spill: coral-pink glow falling on the awning, the eave soffit edge and the sidewalk
  spotLight(g, '#ff7f6a', 9, 11, [0, 3.75, 0.75], [0, -0.45, 4.2], { angle: 1.4, penumbra: 1.0 });
}

// ------------------------------------------------------------------
// 7. tall vertical lightbox sign on the left pier
// ------------------------------------------------------------------
function buildLightbox(S) {
  const { g, mats, animators, designs } = S;
  const tex = T.sign(designs.lightbox);
  const mat = signMaterial(tex, { glow: 1.2, rough: 0.5 });
  const x = S.X0 + 0.5, zf = S.zOut + 0.08, y0 = 1.05, h = 3.2;
  signBox(g, mat, mats.blackSteel, 0.62, h, 0.16, x, y0, zf);
  // two little spot lamps on arms at the top
  [-0.16, 0.16].forEach((dx) => {
    rod(g, mats.blackSteel, [x + dx, y0 + h - 0.05, zf + 0.08], [x + dx, y0 + h + 0.07, zf + 0.3], 0.012);
    const head = box(g, mats.blackSteel, 0.08, 0.1, 0.08, x + dx, y0 + h - 0.01, zf + 0.32, { cast: false });
    head.rotation.x = 0.5;
  });
  const glow = pointLight(g, '#fff0d4', 5, 5, x + 0.2, 2.6, zf + 0.75);
  animators.push((t) => {
    const f = Math.sin(t * 0.7) > 0.995 ? 0.6 + 0.4 * Math.abs(Math.sin(t * 40)) : 1;
    mat.emissiveIntensity = 1.2 * f;
    glow.userData.level = f;
  });
}

// ------------------------------------------------------------------
// 8. barn pendant lamps, caged wall lamps and the paper lantern by the door
// ------------------------------------------------------------------
function buildLampsAndLantern(S) {
  const { g, mats, lm, L, animators, designs, zOut } = S;
  const shadeGeo = new THREE.LatheGeometry(
    [[0.025, 0], [0.035, -0.02], [0.05, -0.06], [0.09, -0.11], [0.17, -0.17], [0.2, -0.2]].map(([r, y]) => new THREE.Vector2(r, y)), 24);

  const lampZ = zOut + 0.62, shadeY = 2.4;
  for (const x of S.barnXs) {
    const yTop = awningUnderY(S, lampZ);
    rod(g, mats.cord, [x, yTop, lampZ], [x, shadeY, lampZ], 0.006);
    const lamp = new THREE.Group();
    lamp.position.set(x, shadeY, lampZ);
    lamp.add(new THREE.Mesh(shadeGeo, lm.shadeOuter));
    lamp.add(new THREE.Mesh(shadeGeo, lm.shadeInner));
    const sock = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.06, 10), mats.blackSteel);
    sock.position.y = -0.06; lamp.add(sock);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10), mats.bulb);
    bulb.position.y = -0.13; bulb.scale.y = 1.25; lamp.add(bulb);
    g.add(lamp);
  }
  // the barn lamps' warm pools on the ledges, steps and sidewalk (left one casts the shadows)
  const xa = S.barnXs[1], xb = (S.barnXs[2] + S.barnXs[3]) / 2;
  spotLight(g, '#ffc382', 30, 10, [xa, shadeY - 0.12, lampZ], [xa - 0.4, L.sidewalkY, lampZ + 1.7], { angle: 1.05, penumbra: 0.8, shadow: true, mapSize: 1024 });
  spotLight(g, '#ffc382', 36, 10, [xb, shadeY - 0.1, lampZ], [xb - 0.2, L.sidewalkY, lampZ + 1.5], { angle: 1.2, penumbra: 0.85 });

  // caged wall lamps on both piers beside the door
  const pierX = (L.door.x1 + L.sideWindow.x0) / 2;
  for (const s of [-1, 1]) {
    const wx = s * pierX, wy = 2.3, wz = zOut + 0.16;
    rod(g, mats.blackSteel, [wx, wy + 0.08, zOut], [wx, wy + 0.08, wz], 0.012);
    box(g, mats.blackSteel, 0.1, 0.16, 0.02, wx, wy - 0.02, zOut + 0.01, { cast: false });
    const gl = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.17, 14), mats.bulbSoft);
    gl.position.set(wx, wy, wz); g.add(gl);
    [0.1, -0.1].forEach((dy) => {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.03, 14), mats.blackSteel);
      c.position.set(wx, wy + dy, wz); g.add(c);
    });
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      rod(g, mats.blackSteel, [wx + Math.cos(a) * 0.068, wy - 0.09, wz + Math.sin(a) * 0.068], [wx + Math.cos(a) * 0.068, wy + 0.09, wz + Math.sin(a) * 0.068], 0.004, 4);
    }
  }

  // red/white/blue paper lantern on a bracket on the right pier, swaying gently
  const lanTex = T.sign(designs.lantern);
  const lanMat = new THREE.MeshStandardMaterial({ map: lanTex, emissive: '#ffffff', emissiveMap: lanTex, emissiveIntensity: 0.7, roughness: 0.9, side: THREE.DoubleSide });
  const bx = pierX + 0.02, by = 2.0;
  const bracketEnd = [bx, by, zOut + 0.44];
  rod(g, mats.blackSteel, [bx, by, zOut], bracketEnd, 0.012);
  rod(g, mats.blackSteel, [bx, by - 0.18, zOut], [bx, by, zOut + 0.3], 0.008);
  const pivot = new THREE.Group();
  pivot.userData.keep = true;
  pivot.position.set(...bracketEnd);
  g.add(pivot);
  rod(pivot, mats.cord, [0, 0, 0], [0, -0.12, 0], 0.005);
  const body = new THREE.Mesh(new THREE.LatheGeometry(
    [[0.06, -0.21], [0.13, -0.17], [0.175, -0.1], [0.19, 0], [0.175, 0.1], [0.13, 0.17], [0.06, 0.21]].map(([r, y]) => new THREE.Vector2(r, y)), 24), lanMat);
  body.position.y = -0.34;
  body.rotation.y = Math.PI / 2 + 0.15;   // one "Seoulicious" faces the street, turned a touch toward the entrance view
  pivot.add(body);
  [0.215, -0.215].forEach((dy) => {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.035, 14), mats.blackSteel);
    ring.position.y = -0.34 + dy; pivot.add(ring);
  });
  const tassel = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.02, 0.14, 8), mats.redPaint);
  tassel.position.y = -0.64; pivot.add(tassel);
  const lanLight = pointLight(pivot, '#ffb07a', 4, 5, 0, -0.34, 0.05);
  animators.push((t) => {
    pivot.rotation.z = Math.sin(t * 1.3) * 0.05;
    pivot.rotation.x = Math.sin(t * 0.9 + 1) * 0.035;
    lanLight.userData.level = 0.94 + 0.06 * Math.sin(t * 7.3) * Math.sin(t * 3.1);
  });
}

// ------------------------------------------------------------------
// 9. greenery: planters on the window ledges, vines framing the windows, potted plants by the steps
// ------------------------------------------------------------------
function buildGreenery(S) {
  const { g, mats, lm, L, zOut } = S;
  const flowers = new InstanceBatch(new THREE.IcosahedronGeometry(0.022, 0), lm.flower, { cast: false });
  const z = zOut + 0.075;   // just proud of the casings

  [L.frontWindow, L.sideWindow].forEach((Wd, wi) => {
    // "out" = the end of the window toward the building corner, "in" = toward the door
    const sgn = wi === 0 ? 1 : -1;                  // +x points inward for the left window
    const xOut = wi === 0 ? Wd.x0 : Wd.x1, xIn = wi === 0 ? Wd.x1 : Wd.x0;
    const ledge = Wd.y0;
    const seed = 10 + wi * 20;

    // planter troughs at both ends of the ledge
    for (const [x, len] of [[xOut + sgn * 0.42, 0.7], [xIn - sgn * 0.36, 0.56]]) {
      box(g, mats.woodDark, len, 0.17, 0.22, x, ledge, zOut + 0.17);
      box(g, lm.soil, len - 0.05, 0.01, 0.17, x, ledge + 0.16, zOut + 0.17, { cast: false });
      bush(S.leaves, x, ledge + 0.15, zOut + 0.18, { n: Math.round(len * 70), rx: len * 0.5, ry: 0.16, rz: 0.13, size: 0.055, seed: seed + x * 7 });
      const fr = T.rng(seed + 3 + Math.round(x * 10));
      for (let i = 0; i < Math.round(len * 22); i++) {
        flowers.add(x + (fr() - 0.5) * len * 0.9, ledge + 0.22 + fr() * 0.1, zOut + 0.17 + (fr() - 0.5) * 0.18, { s: 0.8 + fr() * 0.6 });
      }
    }

    // main vine: up the outer casing, then a little way along the top of the window
    const xo = xOut - sgn * 0.04;
    const topY = Wd.y1 + 0.04;
    const reach = 1.35 + wi * 0.25;
    vine(S, [
      [xOut + sgn * 0.2, ledge + 0.18, zOut + 0.12], [xo, ledge + 0.45, z], [xo + sgn * 0.015, ledge + 0.9, z],
      [xo - sgn * 0.01, ledge + 1.35, z], [xo, topY - 0.15, z], [xOut + sgn * 0.2, topY, z],
      [xOut + sgn * reach * 0.55, topY + 0.02, z], [xOut + sgn * reach, topY - 0.01, z],
    ], { seed: seed + 1, size: 0.058, every: 0.036 });
    // second, thinner strand from the same planter
    vine(S, [
      [xOut + sgn * 0.3, ledge + 0.18, zOut + 0.12], [xo + sgn * 0.03, ledge + 0.55, z + 0.01], [xo - sgn * 0.02, ledge + 1.0, z + 0.01],
      [xo + sgn * 0.02, ledge + 1.3, z + 0.01],
    ], { seed: seed + 2, size: 0.05 });
    // trailing strands hanging from the top run, over the corner of the glass
    for (const [u, drop, sd] of [[0.35, 0.42, 4], [0.75, 0.26, 5], [1.12, 0.34, 6]]) {
      if (u > reach - 0.1) continue;
      const x = xOut + sgn * u;
      vine(S, [[x, topY, z], [x + sgn * 0.02, topY - drop * 0.5, z + 0.02], [x - sgn * 0.01, topY - drop, z + 0.03]],
        { seed: seed + sd, size: 0.048, hang: true, every: 0.032 });
    }
    // small vine up the inner casing (by the door)
    const xi = xIn + sgn * 0.04;
    vine(S, [
      [xIn - sgn * 0.2, ledge + 0.18, zOut + 0.12], [xi, ledge + 0.4, z], [xi - sgn * 0.01, ledge + 0.75, z], [xi + sgn * 0.01, ledge + 1.05, z],
    ], { seed: seed + 7, size: 0.052 });
    // trailing over the front lip of the ledge from both planters
    for (const [x, drop, sd] of [[xOut + sgn * 0.3, 0.42, 8], [xOut + sgn * 0.6, 0.28, 9], [xIn - sgn * 0.3, 0.33, 11]]) {
      vine(S, [[x, ledge + 0.14, zOut + 0.27], [x + 0.02, ledge + 0.02, zOut + 0.41], [x - 0.02, ledge - drop, zOut + 0.42]],
        { seed: seed + sd, size: 0.05, hang: true, every: 0.032 });
    }
  });
  flowers.build(g);

  // tall pots either side of the steps
  const pot = (x, zz, h, r, size, seed) => {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.8, h, 24), mats.ceramic);
    p.position.set(x, S.yS + h / 2, zz); p.castShadow = true; p.receiveShadow = true; g.add(p);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.012, 6, 24), mats.ceramic);
    rim.rotation.x = Math.PI / 2; rim.position.set(x, S.yS + h, zz); g.add(rim);
    box(g, lm.soil, r * 1.5, 0.01, r * 1.5, x, S.yS + h - 0.03, zz, { cast: false });
    bush(S.leaves, x, S.yS + h - 0.02, zz, { n: 110, rx: 0.24 * size, ry: 0.55 * size, rz: 0.22 * size, size: 0.085 * size, seed, up: 1.1 });
  };
  const px = L.sideWindow.x0 + 0.2;
  pot(-px, zOut + 0.62, 0.6, 0.17, 1.0, 7);
  pot(px, zOut + 0.62, 0.6, 0.17, 1.0, 8);
  pot(px + 0.42, zOut + 0.42, 0.34, 0.12, 0.62, 9);
}

// ------------------------------------------------------------------
// 10. A-frame sidewalk boards with the meal deal
// ------------------------------------------------------------------
function buildBoards(S) {
  const { designs } = S;
  // hero: printed poster in a black aluminium LED snap frame (backlit, reads at night)
  const offerTex = T.sign(designs.offer);
  const photo = designs.offer.image;
  if (photo && !(photo.complete && photo.naturalWidth)) {
    photo.ready.then(() => {
      if (!photo.naturalWidth) return;
      offerTex.image = T.signTexture(designs.offer).image;
      offerTex.needsUpdate = true;
    });
  }
  const offerMat = new THREE.MeshStandardMaterial({ map: offerTex, emissive: '#ffffff', emissiveMap: offerTex, emissiveIntensity: 0.55, roughness: 0.35 });
  aFrame(S, { x: -2.45, z: S.zOut + 2.4, ry: 0.22, mat: offerMat, frame: S.lm.alu, bar: 0.035, depth: 0.045 });
  // matching chalkboard version on the other side of the steps
  const chalkTex = T.sign(designs.chalk);
  aFrame(S, { x: 2.5, z: S.zOut + 2.35, ry: -0.24, mat: signMaterial(chalkTex, { glow: 0.16, rough: 0.95 }), frame: S.mats.woodDark, bar: 0.05, depth: 0.03 });
}

// A-frame: two panels hinged at the top. Poster 0.6 x 0.88 m inside a frame, on short legs.
export const BOARD = { PW: 0.6, PH: 0.94, legs: 0.1, tilt: 0.16 };
function aFrame(S, { x, z, ry, mat, frame, bar, depth }) {
  const { PW, PH, legs, tilt } = BOARD;
  const grp = new THREE.Group();
  grp.position.set(x, S.yS, z); grp.rotation.y = ry;
  S.g.add(grp);
  const Lp = PH + bar * 2 + legs;                 // panel length (top to the foot of the legs)
  const topY = Lp * Math.cos(tilt);
  for (const s of [1, -1]) {
    const pivot = new THREE.Group();
    pivot.position.y = topY;
    pivot.rotation.x = -s * tilt;
    grp.add(pivot);
    const P = new THREE.Group();
    if (s < 0) P.rotation.y = Math.PI;
    pivot.add(P);
    const bw = PW + bar * 2;
    box(P, frame, bar, Lp, depth, -(PW / 2 + bar / 2), -Lp, 0);                   // stiles (+ legs)
    box(P, frame, bar, Lp, depth, PW / 2 + bar / 2, -Lp, 0);
    box(P, frame, bw, bar, depth, 0, -bar, 0);                                    // top rail
    box(P, frame, PW, bar, depth, 0, -(bar * 2 + PH), 0);                          // bottom rail
    box(P, frame, PW, PH, 0.008, 0, -(bar + PH), -depth / 2 + 0.006, { cast: false }); // backing board
    const face = signPlane(P, mat, PW, PH);
    face.position.set(0, -(bar + PH / 2), depth / 2 - 0.012);
    face.receiveShadow = true;
  }
  // hinges + a safety chain between the panels
  for (const dx of [-0.2, 0.2]) {
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.06, 8), S.mats.steel);
    h.rotation.z = Math.PI / 2; h.position.set(dx, topY + 0.005, 0); grp.add(h);
  }
  const cy = topY - Lp * 0.55, cz = Lp * 0.55 * Math.sin(tilt);
  rod(grp, S.mats.steel, [-PW / 2 - bar / 2, cy, -cz + 0.02], [-PW / 2 - bar / 2, cy - 0.03, cz - 0.02], 0.004, 4);
}

// ------------------------------------------------------------------
// 11. number plate, small details
// ------------------------------------------------------------------
function buildDressing(S) {
  const { g, mats, L, designs, zOut } = S;
  // Abu Dhabi style blue building-number plate on the pier left of the door
  const pierX = -(L.door.x1 + L.sideWindow.x0) / 2;
  const plate = signMaterial(T.sign(designs.plate), { glow: 0.2, rough: 0.4 });
  signBox(g, plate, mats.steel, 0.36, 0.225, 0.012, pierX, 1.42, zOut + 0.006);
}

// ------------------------------------------------------------------
// 12. upper floors over the shop (hidden in the top-down cutaway)
// ------------------------------------------------------------------
function buildUpperFloors(S) {
  const { roof, mats, lm, L } = S;
  const ub = new THREE.Group();
  ub.name = 'upperFloors';
  roof.add(ub);
  const x0 = S.X0, x1 = S.X1, W = x1 - x0;
  const z0 = L.zBack - L.wallT, z1 = L.zFrontOut, depth = z1 - z0, zc = (z0 + z1) / 2;
  const top = 11.0;
  box(ub, lm.upper, W, top - L.slabTop, depth, 0, L.slabTop, zc, { uv: 2.5 });
  const Wb = makeWindowBatches(lm);
  const xs = [-6.1, -3.65, -1.2, 1.2, 3.65, 6.1];
  const lit = { '0,1': 'warm', '0,4': 'cool', '1,0': 'warm', '1,3': 'warm', '1,5': 'cool' };
  [5.75, 8.95].forEach((y, fi) => {
    box(ub, mats.concrete, W + 0.04, 0.18, 0.08, 0, y - 0.45, z1 + 0.04, { cast: false });
    xs.forEach((x, wi) => {
      const b = Wb[lit[`${fi},${wi}`] || 'dark'];
      b.add(x, y + 0.8, z1 + 0.012, { sx: 1.5, sy: 1.55, sz: 1 });
      Wb.frame.add(x, y + 0.8, z1 + 0.006, { sx: 1.64, sy: 1.69, sz: 1 });
      box(ub, mats.concrete, 1.72, 0.06, 0.12, x, y - 0.01, z1 + 0.06, { cast: false });
    });
  });
  buildWindowBatches(ub, Wb);
  // a couple of AC condensers under windows
  for (const [x, y] of [[-3.65, 8.3], [1.2, 8.3], [6.1, 8.3]]) {
    box(ub, lm.acWhite, 0.8, 0.55, 0.3, x + 0.25, y - 0.2, z1 + 0.25, { cast: false });
    box(ub, mats.blackSteel, 0.86, 0.03, 0.34, x + 0.25, y - 0.23, z1 + 0.25, { cast: false });
    const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.01, 20), mats.blackSteel);
    fan.rotation.x = Math.PI / 2; fan.position.set(x + 0.17, y + 0.075, z1 + 0.405); ub.add(fan);
  }
  // roof slab, parapet, water tank, AC
  box(ub, mats.concrete, W + 0.2, 0.25, depth + 0.2, 0, top, zc);
  box(ub, mats.concrete, W + 0.2, 0.9, 0.15, 0, top + 0.25, z1 - 0.05);
  box(ub, mats.concrete, W + 0.2, 0.9, 0.15, 0, top + 0.25, z0 + 0.05);
  box(ub, mats.concrete, 0.15, 0.9, depth, x0 + 0.05, top + 0.25, zc);
  box(ub, mats.concrete, 0.15, 0.9, depth, x1 - 0.05, top + 0.25, zc);
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.6, 20), lm.acWhite);
  tank.position.set(4.2, top + 1.05, -14); ub.add(tank);
  box(ub, lm.acWhite, 0.9, 0.7, 0.4, -4, top + 0.25, -7);
  box(ub, lm.acWhite, 0.9, 0.7, 0.4, -2.8, top + 0.25, -7);
  mergeStatic(ub);
}

function makeWindowBatches(lm) {
  const geo = new THREE.PlaneGeometry(1, 1);
  return {
    dark: new InstanceBatch(geo, lm.winDark, { cast: false }),
    warm: new InstanceBatch(geo, lm.winWarm, { cast: false }),
    cool: new InstanceBatch(geo, lm.winCool, { cast: false }),
    frame: new InstanceBatch(geo, lm.winFrame, { cast: false }),
  };
}
function buildWindowBatches(parent, W) { Object.values(W).forEach((b) => b.build(parent)); }

function windowGrid(W, { x0, x1, y0, y1, z, face = 1, cols, rows, ww = 1.1, wh = 1.3, lit = 0.25, seed = 1 }) {
  const r = T.rng(seed);
  const ry = face > 0 ? 0 : Math.PI;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const x = x0 + ((i + 0.5) * (x1 - x0)) / cols;
      const y = y0 + ((j + 0.5) * (y1 - y0)) / rows;
      const k = r();
      const b = k < lit * 0.65 ? W.warm : k < lit ? W.cool : W.dark;
      b.add(x, y, z + face * 0.012, { ry, sx: ww, sy: wh, sz: 1 });
      W.frame.add(x, y, z + face * 0.006, { ry, sx: ww + 0.12, sy: wh + 0.12, sz: 1 });
    }
  }
}

// ------------------------------------------------------------------
// 13. street: sidewalk, curb, road, lane marks, street lamps
// ------------------------------------------------------------------
function buildStreet(S) {
  const { g, mats, lm, L } = S;
  const yS = L.sidewalkY, yR = L.roadY, cz = L.curbZ;
  box(g, mats.pavers, 120, 0.3, cz + 0.5, 0, yS - 0.3, (cz - 0.5) / 2, { uv: 1, cast: false });
  box(g, lm.curb, 120, 0.2, 0.18, 0, yS - 0.18, cz - 0.05, { cast: false });
  const roadZ1 = 17.6;
  box(g, mats.asphalt, 140, 0.3, roadZ1 - cz, 0, yR - 0.3, (cz + roadZ1) / 2, { uv: 3, cast: false });
  const dash = new InstanceBatch(new THREE.BoxGeometry(3.0, 0.006, 0.12), lm.lanePaint, { cast: false });
  for (let x = -66; x <= 66; x += 9) dash.add(x, yR, (cz + roadZ1) / 2);
  dash.build(g);
  box(g, lm.lanePaint, 140, 0.006, 0.12, 0, yR, cz + 0.45, { cast: false });
  box(g, lm.lanePaint, 140, 0.006, 0.12, 0, yR, roadZ1 - 0.45, { cast: false });
  box(g, mats.pavers, 140, 0.3, 4.0, 0, yS - 0.3, roadZ1 + 2.0, { uv: 1, cast: false });
  box(g, lm.curb, 140, 0.2, 0.18, 0, yS - 0.18, roadZ1 + 0.05, { cast: false });

  // street lamp left of the shop, near the curb — warm light that also washes the shop front
  const sx = S.X0 - 1.7, sz = cz - 0.45;
  rod(g, lm.pole, [sx, yS, sz], [sx, yS + 6.4, sz], 0.075, 10);
  rod(g, lm.pole, [sx, yS, sz], [sx, yS + 0.5, sz], 0.12, 10);
  rod(g, lm.pole, [sx, yS + 6.3, sz], [sx, yS + 6.55, sz + 1.5], 0.04, 8);
  const head = box(g, lm.pole, 0.55, 0.12, 0.28, sx, yS + 6.45, sz + 1.55, { cast: false });
  const lens = signPlane(g, mats.bulbSoft, 0.42, 0.18);
  lens.rotation.x = Math.PI / 2;
  lens.position.set(sx, head.position.y - 0.065, sz + 1.55);
  pointLight(g, '#ffb46a', 140, 26, sx, yS + 6.15, sz + 1.4);
  // a second lamp across the road (glow only)
  const fx = 12.5;
  rod(g, lm.pole, [fx, yS, roadZ1 + 0.5], [fx, yS + 6.4, roadZ1 + 0.5], 0.075, 10);
  rod(g, lm.pole, [fx, yS + 6.3, roadZ1 + 0.5], [fx, yS + 6.55, roadZ1 - 1.0], 0.04, 8);
  box(g, lm.pole, 0.55, 0.12, 0.28, fx, yS + 6.45, roadZ1 - 1.05, { cast: false });
  const lens2 = signPlane(g, mats.bulbSoft, 0.42, 0.18);
  lens2.rotation.x = Math.PI / 2;
  lens2.position.set(fx, yS + 6.445, roadZ1 - 1.05);
  // a few steel bollards along the curb
  for (const x of [-7.0, -4.4, 4.4, 7.0]) {
    rod(g, mats.blackSteel, [x, yS, cz - 0.4], [x, yS + 0.85, cz - 0.4], 0.055, 12);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), mats.blackSteel);
    cap.position.set(x, yS + 0.85, cz - 0.4); g.add(cap);
  }
}

// ------------------------------------------------------------------
// 14. neighbour buildings (strictly outside the shop's footprint, x < -7.8 and x > 7.8)
// ------------------------------------------------------------------
function buildNeighbors(S) {
  const { g, mats, lm, L, designs } = S;
  const yS = L.sidewalkY;
  const W = makeWindowBatches(lm);
  const gap = 0.03;
  const bL = S.X0 - gap, bR = S.X1 + gap;
  const bldg = (mat, x0, x1, zFront, h, depth = 26, face = 1) => {
    const zc = face > 0 ? zFront - depth / 2 : zFront + depth / 2;
    return box(g, mat, x1 - x0, h, depth, (x0 + x1) / 2, yS, zc, { uv: 2.5 });
  };

  // LEFT A: closed roll-shutter shop
  const la = [bL - 8.2, bL];
  bldg(lm.bldgA, la[0], la[1], 0.6, 14.45);
  const shX = (la[0] + la[1]) / 2 + 0.6;
  const sh = plane(g, lm.shutter, 5.2, 3.0, { uv: 1.5 });
  sh.position.set(shX, yS + 1.5, 0.605);
  box(g, mats.blackSteel, 5.4, 0.35, 0.3, shX, yS + 3.0, 0.75, { cast: false });
  box(g, mats.woodDark, 0.95, 2.2, 0.06, la[0] + 1.2, yS, 0.62, { cast: false });
  windowGrid(W, { x0: la[0] + 0.4, x1: la[1] - 0.4, y0: 3.8, y1: 13.4, z: 0.6, cols: 3, rows: 3, lit: 0.3, seed: 3 });

  // LEFT B
  bldg(lm.bldgB, la[0] - 14, la[0], 0.3, 10.45);
  windowGrid(W, { x0: la[0] - 13.5, x1: la[0] - 0.5, y0: 3.4, y1: 9.8, z: 0.3, cols: 5, rows: 2, lit: 0.35, seed: 4 });
  box(g, lm.winDark, 9, 2.4, 0.05, la[0] - 7, yS + 0.2, 0.32, { cast: false });

  // RIGHT A: small laundry with a cool glow, sign in English + Arabic, AC units by our corner
  const ra = [bR, bR + 7.8], rc = (ra[0] + ra[1]) / 2 + 0.3;
  bldg(lm.bldgC, ra[0], ra[1], 0.0, 9.45);
  const lw = T.toTexture(laundryInterior(), { wrap: false });
  const glowBack = signPlane(g, new THREE.MeshStandardMaterial({ color: '#0c1116', emissive: '#ffffff', emissiveMap: lw, emissiveIntensity: 0.3, roughness: 0.2 }), 4.5, 2.4);
  glowBack.position.set(rc, yS + 1.5, 0.006);
  const sg = plane(g, lm.glass, 4.6, 2.5, { receive: false });
  sg.position.set(rc, yS + 1.55, 0.03);
  for (const x of [-2.3, -0.75, 0.75, 2.3]) box(g, mats.blackSteel, 0.06, 2.5, 0.05, rc + x, yS + 0.3, 0.03, { cast: false });
  box(g, mats.blackSteel, 4.7, 0.08, 0.06, rc, yS + 2.8, 0.03, { cast: false });
  const lt = T.sign(designs.laundry);
  signBox(g, signMaterial(lt, { glow: 0.32 }), mats.blackSteel, 4.4, 0.86, 0.1, rc, yS + 3.05, 0.06);
  windowGrid(W, { x0: ra[0] + 0.5, x1: ra[1] - 0.2, y0: 4.6, y1: 8.6, z: 0.0, cols: 3, rows: 2, lit: 0.4, seed: 5 });
  [0, 0.62].forEach((dy, i) => {
    box(g, lm.acWhite, 0.8, 0.6, 0.3, ra[0] + 0.65, yS + dy, 0.2, { cast: true });
    const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.01, 20), mats.blackSteel);
    fan.rotation.x = Math.PI / 2; fan.position.set(ra[0] + 0.55, yS + dy + 0.3, 0.356); g.add(fan);
    rod(g, mats.rubber, [ra[0] + 0.95, yS + dy + 0.45, 0.1], [ra[0] + 0.95, yS + 3.2 + i * 0.1, 0.06], 0.025);
  });

  // RIGHT B: taller building
  bldg(lm.bldgA, ra[1], ra[1] + 15, 0.4, 16.45);
  windowGrid(W, { x0: ra[1] + 0.5, x1: ra[1] + 14.5, y0: 3.6, y1: 15.6, z: 0.4, cols: 5, rows: 4, lit: 0.3, seed: 6 });
  box(g, lm.shutter, 6, 2.8, 0.05, ra[1] + 4, yS, 0.42, { cast: false });

  // ACROSS THE STREET (seen when looking around)
  const zA = 21.6;
  bldg(lm.bldgB, -34, -9, zA, 12.45, 10, -1);
  bldg(lm.bldgA, -9, 9, zA, 8.45, 10, -1);
  bldg(lm.bldgC, 9, 34, zA, 14.45, 10, -1);
  windowGrid(W, { x0: -33, x1: -10, y0: 3.5, y1: 11.5, z: zA, face: -1, cols: 6, rows: 3, lit: 0.3, seed: 7 });
  windowGrid(W, { x0: -8.5, x1: 8.5, y0: 3.5, y1: 7.6, z: zA, face: -1, cols: 5, rows: 1, lit: 0.4, seed: 8 });
  windowGrid(W, { x0: 10, x1: 33, y0: 3.5, y1: 13.6, z: zA, face: -1, cols: 6, rows: 4, lit: 0.3, seed: 9 });
  // a closed café across the road: dim warm window behind mullions
  const acrossMat = new THREE.MeshStandardMaterial({ color: '#1a120c', emissive: '#ffcf9a', emissiveMap: T.windowGlowTexture(63), emissiveIntensity: 0.22, roughness: 0.3 });
  const across = plane(g, acrossMat, 6, 2.2);
  across.rotation.y = Math.PI;
  across.position.set(-1, yS + 1.5, zA - 0.01);
  for (const x of [-4, -2, 0, 2]) box(g, mats.blackSteel, 0.08, 2.3, 0.06, x, yS + 0.35, zA - 0.04, { cast: false });
  box(g, mats.blackSteel, 6.1, 0.1, 0.06, -1, yS + 2.6, zA - 0.04, { cast: false });
  buildWindowBatches(g, W);
}
