// OUTSIDE of the restaurant: shop front, tin awning, painted billboard, hanok tiled eave,
// vertical lightbox sign, lamps, lantern, plants, menu boards, upper floors and a bit of street.
// Matches her reference pics: wooden/brick/tin front (pic 3) under a black tiled eave (pic 4).
import * as THREE from 'three';
import { box, plane, corrugatedGeometry, InstanceBatch, pointLight, spotLight, bottleGeometry, mergeStatic } from './helpers.js';
import * as T from './textures.js';
import { signMaterial } from './materials.js';

export function buildExterior(ctx) {
  const { scene, camera, mats, roof, animators, layout: L, R, F } = ctx;
  const g = new THREE.Group();
  g.name = 'exterior';
  scene.add(g);

  const lm = localMaterials(mats);
  const S = { g, mats, lm, L, R, F, animators, roof, camera };

  buildFacade(S);
  buildDoor(S);
  buildSteps(S);
  buildAwning(S);
  buildBillboard(S);
  buildEave(S);
  buildLightbox(S);
  buildLampsAndLantern(S);
  buildDressing(S);
  buildUpperFloors(S);
  buildStreet(S);
  buildNeighbors(S);

  // fewer draw calls: merge everything that never moves (door hinge + lantern are kept separate)
  mergeStatic(g);
  mergeStatic(roof);
}

// ------------------------------------------------------------------
// materials only used outside
// ------------------------------------------------------------------
function localMaterials(mats) {
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const glass = mats.glass.clone();
  glass.side = THREE.DoubleSide;
  const tint = (m, color) => { const c = m.clone(); c.color = new THREE.Color(color); c.emissive = new THREE.Color('#272c38'); c.emissiveMap = m.map; c.emissiveIntensity = 1.0; return c; };
  return {
    glass,
    blackPaint: std({ color: '#1a1a1c', roughness: 0.6 }),
    shadeOuter: std({ color: '#203a2d', roughness: 0.45, metalness: 0.5 }),
    shadeInner: std({ color: '#f1ece2', emissive: '#ffcf9a', emissiveIntensity: 0.5, roughness: 0.6, side: THREE.BackSide }),
    leaf: std({ color: '#ffffff', roughness: 0.65, side: THREE.DoubleSide }),
    flower: std({ color: '#e8b52e', roughness: 0.7 }),
    soil: std({ color: '#2a1e16', roughness: 1 }),
    basket: std({ color: '#8a6a44', roughness: 0.9 }),
    curb: std({ color: '#77746e', roughness: 0.85 }),
    lanePaint: std({ color: '#a9a69e', roughness: 0.85 }),
    pole: std({ color: '#2b2d30', roughness: 0.55, metalness: 0.6 }),
    acWhite: std({ color: '#d9d8d2', roughness: 0.6 }),
    roofBase: std({ color: '#1c1d20', roughness: 0.7 }),
    soffit: std({ map: mats.woodDark.map, emissive: '#ff9548', emissiveMap: mats.woodDark.map, emissiveIntensity: 1.6, roughness: 0.8 }),
    winDark: std({ color: '#0c0f13', roughness: 0.12, metalness: 0.8, envMapIntensity: 0.7 }),
    winWarm: std({ color: '#2a1a0d', emissive: '#ffd2a0', emissiveMap: T.windowGlowTexture(61), emissiveIntensity: 0.42 }),
    winCool: std({ color: '#141a24', emissive: '#a9c4ff', emissiveMap: T.windowGlowTexture(62), emissiveIntensity: 0.26 }),
    winFrame: std({ color: '#202124', roughness: 0.6, metalness: 0.3 }),
    shopGlow: std({ color: '#0e1418', emissive: '#d6ecff', emissiveIntensity: 0.45 }),
    bldgA: tint(mats.concrete, '#a8a49e'),
    bldgB: tint(mats.concrete, '#8c7d70'),
    bldgC: tint(mats.concrete, '#7a808a'),
    upper: tint(mats.concrete, '#6e6a66'),
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

// Retro painted 3D lettering: stacked offset copies (the "extrusion") then the face
function extruded(text, { x, y, size, font, face, side, depth = 10, step = 2, w, h, stroke = 0, strokeColor = '#f3ead7' }) {
  const out = [];
  for (let i = depth; i >= 1; i--) out.push({ text, font, size, color: side, x: x + (i * step) / w, y: y + (i * step) / h });
  out.push({ text, font, size, color: face, x, y, stroke, strokeColor });
  return out;
}

// Leafy plant made of instanced flattened spheres
function foliage(batch, cx, cy, cz, { n = 50, rx = 0.25, ry = 0.35, rz = 0.25, size = 1, droop = 0, seed = 1 } = {}) {
  const r = T.rng(seed);
  const greens = ['#2e5a28', '#3f6f2f', '#24461f', '#4a7a35', '#355f2a'];
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, h = r(), rad = Math.sqrt(r());
    batch.add(
      cx + Math.cos(a) * rx * rad,
      cy + h * ry - droop * rad * rad,
      cz + Math.sin(a) * rz * rad,
      { rx: (r() - 0.5) * 1.3, ry: a, rz: (r() - 0.5) * 1.3, sx: 0.075 * size, sy: 0.012, sz: 0.036 * size, color: greens[i % greens.length] },
    );
  }
}

// ------------------------------------------------------------------
// 1. shop-front wall with real openings
// ------------------------------------------------------------------
function buildFacade({ g, mats, lm, L }) {
  const zIn = L.zFront, zOut = L.zFrontOut, d = zOut - zIn, zc = (zIn + zOut) / 2;
  const yB = L.sidewalkY, yT = L.slabTop;
  const W = L.frontWindow, D = L.door, S = L.sideWindow;
  const xl = L.x0 - 0.3, xr = L.x1 + 0.3;
  const rv = mats.woodExt; // reveals (sides of openings)

  // material array order: +x, -x, +y, -y, +z (street), -z (inside)
  const piece = (x0, x1, y0, y1, outer, uv = 1) =>
    box(g, [rv, rv, rv, rv, outer, mats.plaster], x1 - x0, y1 - y0, d, (x0 + x1) / 2, y0, zc, { uv });

  piece(xl, W.x0, yB, yT, mats.brick, 0.7);          // left brick pier (lightbox sign goes here)
  piece(W.x0, W.x1, yB, W.y0, mats.woodExt);         // wood panel under the big window
  piece(W.x0, W.x1, W.y1, yT, mats.woodExt);         // header above the big window
  piece(W.x1, D.x0, yB, yT, mats.woodExtV);          // wooden post between window and door
  piece(D.x0, D.x1, D.h, yT, mats.woodExt);          // above the door
  piece(D.x0, D.x1, yB, 0, mats.woodDeck);           // threshold below the door (shop floor is y=0)
  piece(D.x1, S.x0, yB, yT, mats.brick, 0.7);        // brick between door and side window
  piece(S.x0, S.x1, yB, S.y0, mats.brick, 0.7);      // brick under side window
  piece(S.x0, S.x1, S.y1, yT, mats.woodExt);         // above side window
  piece(S.x1, xr, yB, yT, mats.brick, 0.7);          // right brick pier

  // dark wood casings around the openings (outer face)
  const casing = (x0, x1, y0, y1, sill) => {
    const w = x1 - x0, cx = (x0 + x1) / 2, t = 0.08, zz = zOut + 0.025;
    box(g, mats.woodDark, w + t * 2, t, 0.05, cx, y1, zz);
    box(g, mats.woodDarkV, t, y1 - y0, 0.05, x0 - t / 2, y0, zz);
    box(g, mats.woodDarkV, t, y1 - y0, 0.05, x1 + t / 2, y0, zz);
    if (sill) box(g, mats.woodDark, w + 0.22, 0.06, 0.14, cx, y0 - 0.06, zOut + 0.06);
  };
  casing(W.x0, W.x1, W.y0, W.y1, true);
  casing(S.x0, S.x1, S.y0, S.y1, true);
  casing(D.x0, D.x1, 0, D.h, false);

  // window mullions + glass (pic 3 grid windows)
  const grid = (x0, x1, y0, y1, sections, cols, split) => {
    const w = x1 - x0, h = y1 - y0, zm = zc + 0.02;
    for (let s = 1; s < sections; s++) box(g, mats.woodDarkV, 0.09, h, 0.08, x0 + (w * s) / sections, y0, zm);
    const sw = w / sections;
    for (let s = 0; s < sections; s++) {
      for (let c = 1; c < cols; c++) box(g, mats.woodDarkV, 0.045, h, 0.06, x0 + s * sw + (sw * c) / cols, y0, zm, { cast: false });
    }
    box(g, mats.woodDark, w, 0.05, 0.06, (x0 + x1) / 2, y0 + h * split, zm, { cast: false });
    const gl = plane(g, lm.glass, w, h, { receive: false });
    gl.position.set((x0 + x1) / 2, (y0 + y1) / 2, zc - 0.01);
  };
  grid(W.x0, W.x1, W.y0, W.y1, 3, 2, 0.62);
  grid(S.x0, S.x1, S.y0, S.y1, 1, 3, 0.62);
}

// ------------------------------------------------------------------
// 2. glass door with wood frame + welcome sign
// ------------------------------------------------------------------
function buildDoor({ g: root, mats, lm, L, F, camera, animators }) {
  const D = L.door;
  // the opening leaf lives in its own group so it can swing open (hinge on its left edge)
  const g = new THREE.Group();
  g.userData.keep = true;
  root.add(g);
  const z0 = L.zFront + 0.05, dz = 0.06, zc = z0 + dz / 2;
  const leafX0 = D.x0 + 0.02, leafX1 = D.x0 + 0.88; // main leaf
  const sideX0 = leafX1 + 0.04, sideX1 = D.x1 - 0.02; // fixed sidelight
  const H = D.h - 0.02;
  const frame = (x0, x1) => {
    const w = x1 - x0, cx = (x0 + x1) / 2;
    box(g, mats.woodDarkV, 0.09, H, dz, x0 + 0.045, 0, zc);
    box(g, mats.woodDarkV, 0.09, H, dz, x1 - 0.045, 0, zc);
    box(g, mats.woodDark, w, 0.12, dz, cx, H - 0.12, zc);
    box(g, mats.woodDark, w, 0.26, dz, cx, 0, zc);
    const gl = plane(g, lm.glass, w - 0.18, H - 0.38, { receive: false });
    gl.position.set(cx, 0.26 + (H - 0.38) / 2, zc);
  };
  frame(leafX0, leafX1);
  const leafParts = [...g.children];
  frame(sideX0, sideX1);
  box(g, mats.woodDarkV, 0.04, H, dz, leafX1 + 0.02, 0, zc);

  // vertical pull handle (steel) on the street side
  rod(g, mats.steel, [leafX1 - 0.12, 0.85, zc + 0.07], [leafX1 - 0.12, 1.45, zc + 0.07], 0.014, 10);
  rod(g, mats.steel, [leafX1 - 0.12, 0.9, zc + 0.03], [leafX1 - 0.12, 0.9, zc + 0.07], 0.008);
  rod(g, mats.steel, [leafX1 - 0.12, 1.4, zc + 0.03], [leafX1 - 0.12, 1.4, zc + 0.07], 0.008);

  // paper welcome sign taped on the glass (pic 3 has one)
  const tex = T.sign({
    w: 512, h: 160, bg: '#f7f3ea', border: '#222', borderW: 6, aged: 0.2, seed: 71,
    lines: [
      { text: '어서오세요', font: F.display, size: 84, color: '#1d1d1d', y: 0.42 },
      { text: 'WELCOME · OPEN', font: F.sans, weight: 600, size: 26, color: '#b3302a', y: 0.84, spacing: 5 },
    ],
  });
  const s = signPlane(g, signMaterial(tex, { glow: 0.18 }), 0.48, 0.15);
  s.position.set((leafX0 + leafX1) / 2, 1.58, zc + 0.036);

  // move the leaf (frame, glass, handle, sign) onto a hinge and open it when the camera comes close
  const handleParts = g.children.slice(-4); // 3 handle rods + the paper sign
  const hinge = new THREE.Group();
  hinge.position.set(leafX0, 0, zc);
  hinge.userData.keep = true;
  root.add(hinge);
  for (const o of [...leafParts, ...handleParts]) { g.remove(o); o.position.x -= leafX0; o.position.z -= zc; hinge.add(o); }
  if (camera && animators) {
    const doorC = new THREE.Vector3((leafX0 + leafX1) / 2, 1.2, zc);
    animators.push((t, dt) => {
      const target = camera.position.distanceTo(doorC) < 5.5 ? -1.45 : 0;
      hinge.rotation.y += (target - hinge.rotation.y) * Math.min(1, dt * 4);
    });
  }
}

// ------------------------------------------------------------------
// 3. wooden deck steps (street is 0.45 m below the shop floor)
// ------------------------------------------------------------------
function buildSteps({ g, mats, L }) {
  const x0 = 0.2, x1 = 3.0, w = x1 - x0, cx = (x0 + x1) / 2;
  const zo = L.zFrontOut, yS = L.sidewalkY;
  box(g, mats.woodDeck, w, -yS, 0.55, cx, yS, zo + 0.275, { uv: 0.8 });          // landing, top y=0
  box(g, mats.woodDeck, w, 0.3, 0.35, cx, yS, zo + 0.725, { uv: 0.8 });          // middle step, top -0.15
  box(g, mats.woodDeck, w, 0.15, 0.4, cx, yS, zo + 1.1, { uv: 0.8 });            // bottom step, top -0.30
  // dark nosing on each tread edge
  [[0, zo + 0.55], [-0.15, zo + 0.9], [-0.3, zo + 1.3]].forEach(([top, z]) =>
    box(g, mats.woodDark, w + 0.02, 0.035, 0.04, cx, top - 0.034, z - 0.02, { cast: false }));
  // black steel handrail on the left side
  rod(g, mats.blackSteel, [x0 + 0.06, 0, zo + 0.45], [x0 + 0.06, 0.95, zo + 0.45], 0.02);
  rod(g, mats.blackSteel, [x0 + 0.06, -0.3, zo + 1.45], [x0 + 0.06, 0.65, zo + 1.45], 0.02);
  rod(g, mats.blackSteel, [x0 + 0.06, 0.95, zo + 0.45], [x0 + 0.06, 0.65, zo + 1.45], 0.022, 8);
  // doormat
  box(g, mats.fabricDark, 0.9, 0.012, 0.42, 1.6, 0, zo + 0.25, { cast: false });
}

// ------------------------------------------------------------------
// 4. rusty corrugated tin awning (pic 3)
// ------------------------------------------------------------------
function buildAwning({ g, mats, lm, L }) {
  const x0 = L.frontWindow.x0, x1 = L.x1 + 0.3;
  const W = x1 - x0, cx = (x0 + x1) / 2;
  const top = 3.02, len = 1.3, drop = 0.26, zOut = L.zFrontOut;
  const th = Math.asin(drop / len);

  const geo = corrugatedGeometry(W, len, { wave: 0.09, amp: 0.02, uv: 1.2 });
  geo.rotateY(Math.PI); // now runs from the wall (z=0) outward (+z)
  const tin = new THREE.Mesh(geo, mats.tin);
  tin.position.set(cx, top, zOut);
  tin.rotation.x = th;
  tin.castShadow = true; tin.receiveShadow = true;
  g.add(tin);

  const edgeZ = zOut + len * Math.cos(th), edgeY = top - drop;
  box(g, mats.woodDark, W + 0.04, 0.16, 0.05, cx, edgeY - 0.13, edgeZ + 0.02); // fascia
  box(g, mats.woodDark, W, 0.12, 0.08, cx, top - 0.17, zOut + 0.04);            // ledger on wall

  // rafters under the tin
  const rafterGeo = new THREE.BoxGeometry(0.06, 0.08, len);
  for (let x = x0 + 0.15; x <= x1 - 0.1; x += 1.6) {
    const m = new THREE.Mesh(rafterGeo, mats.woodDark);
    m.position.set(x, top - (len / 2) * Math.sin(th) - 0.06, zOut + (len / 2) * Math.cos(th));
    m.rotation.x = th;
    m.castShadow = true;
    g.add(m);
  }

  // two flood lamps sitting on the awning edge, aimed back up at the billboard
  [-2.6, 3.4].forEach((x) => {
    const lamp = new THREE.Group();
    lamp.position.set(x, edgeY + 0.08, edgeZ - 0.18);
    lamp.rotation.x = 0.7;
    box(lamp, mats.blackSteel, 0.26, 0.16, 0.1, 0, -0.08, 0, { cast: false });
    const lens = signPlane(lamp, mats.bulbSoft, 0.2, 0.11);
    lens.rotation.y = Math.PI;
    lens.position.set(0, 0, -0.051);
    rod(lamp, mats.blackSteel, [0, -0.08, 0], [0, -0.16, 0.03], 0.012);
    g.add(lamp);
  });
}

// awning underside height at a given z (for hanging things)
function awningUnderY(L, z) {
  const top = 3.02, len = 1.3, drop = 0.26;
  return top - (z - L.zFrontOut) * (drop / Math.sqrt(len * len - drop * drop)) - 0.03;
}

// ------------------------------------------------------------------
// 5. big painted retro billboard above the awning (pic 3)
// ------------------------------------------------------------------
function buildBillboard({ g, mats, L, R, F }) {
  const w = 2048, h = 282;
  const tex = T.sign({
    w, h, bg: '#efe4cb', border: null, aged: 0.55, seed: 61,
    draw: (c) => {
      const gr = c.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#8fc0d4'); gr.addColorStop(0.62, '#dbe7df'); gr.addColorStop(1, '#efe4cb');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      const r = T.rng(62);
      for (let i = 0; i < 16; i++) {
        const x = r() * w, y = h * (0.12 + r() * 0.35), s = 40 + r() * 90;
        c.fillStyle = 'rgba(255,255,255,0.5)';
        c.beginPath(); c.ellipse(x, y, s * 1.9, s * 0.42, 0, 0, Math.PI * 2); c.fill();
      }
      // painted sun rays behind the name
      c.save(); c.translate(w * 0.17, h * 1.05);
      for (let i = 0; i < 14; i++) {
        c.rotate(Math.PI / 14);
        c.fillStyle = i % 2 ? 'rgba(240,200,120,0.18)' : 'rgba(255,255,255,0.0)';
        c.beginPath(); c.moveTo(0, 0); c.lineTo(-w * 0.4, -20); c.lineTo(-w * 0.4, 20); c.fill();
      }
      c.restore();
      c.fillStyle = '#2f8a86'; c.fillRect(0, h - 30, w, 10);
      c.fillStyle = '#c8322b'; c.fillRect(0, h - 16, w, 9);
      c.strokeStyle = '#2a2522'; c.lineWidth = 12; c.strokeRect(6, 6, w - 12, h - 12);
    },
    lines: [
      ...extruded(R.nameKo, { x: 0.17, y: 0.5, size: 205, font: F.display, face: '#d23a2c', side: '#2d2a2a', depth: 11, step: 2.2, w, h, stroke: 6 }),
      ...extruded(R.kindKo, { x: 0.47, y: 0.52, size: 150, font: F.display, face: '#33393d', side: '#a9b6bd', depth: 9, step: 2, w, h }),
      ...extruded(R.nameEn, { x: 0.79, y: 0.4, size: 118, font: F.display, face: '#c8322b', side: '#2d2a2a', depth: 6, step: 2, w, h }),
      { text: `${R.kind.toUpperCase()} · 포차`, font: F.retro, size: 46, color: '#2b2b2e', x: 0.79, y: 0.76, spacing: 4 },
    ],
  });
  const bw = 9.5, bh = bw * (h / w);
  signBox(g, signMaterial(tex, { glow: 0.22 }), mats.woodDark, bw, bh, 0.08, 0.4, 3.12, L.zFrontOut + 0.04);
}

// ------------------------------------------------------------------
// 6. black hanok-style tiled eave across the top of the front (pic 4)
// ------------------------------------------------------------------
function buildEave({ g, mats, lm, L }) {
  const zOut = L.zFrontOut;
  // dark frieze band between billboard and eave
  box(g, lm.blackPaint, 10.6, 0.9, 0.06, 0, 4.47, zOut + 0.03, { cast: false });

  const e = { x0: -5.6, x1: 5.6, zw: zOut + 0.06, yw: 5.38, zo: zOut + 1.2, yo: 4.86 };
  const dz = e.zo - e.zw, dy = e.yw - e.yo;
  const a = Math.atan2(dy, dz), len = Math.hypot(dz, dy), W = e.x1 - e.x0;
  const mid = new THREE.Vector3(0, (e.yw + e.yo) / 2, (e.zw + e.zo) / 2);
  const n = new THREE.Vector3(0, Math.cos(a), Math.sin(a));     // roof normal (up & out)
  const dir = new THREE.Vector3(0, -Math.sin(a), Math.cos(a));  // down the slope
  const at = (along, off) => mid.clone().addScaledVector(dir, along).addScaledVector(n, off);

  const tilted = (geo, mat, p, { cast = true } = {}) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(p); m.rotation.x = a; m.castShadow = cast; m.receiveShadow = true;
    g.add(m); return m;
  };
  tilted(new THREE.BoxGeometry(W, 0.05, len), lm.roofBase, mid);                         // base (concave tiles)
  tilted(new THREE.BoxGeometry(W, 0.1, 0.06), lm.roofBase, at(len / 2, -0.04));          // lower edge board

  // convex cover tiles: half-cylinders running down the slope
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

  // ridge against the wall + slightly lifted corners
  box(g, mats.roofTile, W + 0.2, 0.2, 0.3, 0, e.yw - 0.06, e.zw + 0.1);
  [-1, 1].forEach((s) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.09, 0.32), mats.roofTile);
    m.position.set(s * (W / 2 - 0.1), e.yo + 0.1, e.zo - 0.05);
    m.rotation.set(a * 0.6, 0, s * 0.32);
    m.castShadow = true;
    g.add(m);
  });

  // warm glowing soffit underneath (pic 4's orange-lit eave) + rafters + downlights
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
  for (let x = -4.9; x <= 4.95; x += 1.4) dl.add(x, pd.y, pd.z, { rx: a });
  dl.build(g);

  // one wide light washing down over the billboard and awning
  spotLight(g, '#ffd2a0', 8, 9, [0.4, 4.72, 1.25], [0.4, 3.2, 0.3], { angle: 1.15, penumbra: 0.85 });
}

// ------------------------------------------------------------------
// 7. tall vertical lightbox sign on the left pier (pic 4)
// ------------------------------------------------------------------
function buildLightbox({ g, mats, L, R, F, animators }) {
  const w = 256, h = 1280;
  const tex = T.sign({
    w, h, bg: '#0b0b0b', border: '#1c1c1c', borderW: 10, aged: 0.12, seed: 81,
    draw: (c) => {
      // grill illustration at the bottom (in place of a food photo)
      const cx = w / 2, cy = h * 0.86, r = w * 0.36;
      c.save();
      c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.clip();
      const gr = c.createRadialGradient(cx, cy, 4, cx, cy, r);
      gr.addColorStop(0, '#ffb347'); gr.addColorStop(0.55, '#d9531a'); gr.addColorStop(1, '#3a1206');
      c.fillStyle = gr; c.fillRect(cx - r, cy - r, r * 2, r * 2);
      c.strokeStyle = '#181818'; c.lineWidth = 5;
      for (let x = cx - r; x < cx + r; x += 17) { c.beginPath(); c.moveTo(x, cy - r); c.lineTo(x, cy + r); c.stroke(); }
      // meat strips with fat lines
      [[-40, -30, 0.25], [10, 10, -0.2], [-20, 50, 0.1]].forEach(([dx, dy, rot]) => {
        c.save(); c.translate(cx + dx, cy + dy); c.rotate(rot);
        c.fillStyle = '#b8664a'; c.fillRect(-55, -16, 110, 32);
        c.fillStyle = '#efd2bb'; c.fillRect(-55, -6, 110, 5); c.fillRect(-55, 8, 110, 4);
        c.fillStyle = 'rgba(60,20,10,0.5)'; for (let i = -50; i < 55; i += 18) c.fillRect(i, -16, 4, 32);
        c.restore();
      });
      c.restore();
      c.strokeStyle = '#e8c23a'; c.lineWidth = 6;
      c.beginPath(); c.arc(cx, cy, r + 4, 0, Math.PI * 2); c.stroke();
      c.fillStyle = '#e8c23a'; c.fillRect(30, h * 0.165, w - 60, 4);
    },
    lines: [
      { text: R.nameKo, font: F.display, size: 64, color: '#f2c531', y: 0.07 },
      { text: R.kind.toUpperCase(), font: F.sans, weight: 600, size: 24, color: '#f2c531', y: 0.135, spacing: 3 },
      { text: R.kindKo, font: F.brush, size: 150, color: '#ffffff', y: 0.475, vertical: true, step: 185 },
    ],
  });
  const mat = signMaterial(tex, { glow: 1.25, rough: 0.5 });
  const x = L.x0 - 0.3 + 0.4, zf = L.zFrontOut + 0.08;
  signBox(g, mat, mats.blackSteel, 0.62, 3.1, 0.16, x, 1.1, zf);
  // two little spot lamps on arms at the top (pic 4)
  [-0.16, 0.16].forEach((dx) => {
    rod(g, mats.blackSteel, [x + dx, 4.2, zf + 0.08], [x + dx, 4.32, zf + 0.3], 0.012);
    const head = box(g, mats.blackSteel, 0.08, 0.1, 0.08, x + dx, 4.24, zf + 0.32, { cast: false });
    head.rotation.x = 0.5;
  });
  const glow = pointLight(g, '#fff1d6', 4, 4.5, x, 2.6, zf + 0.7);
  // very occasional faint flicker, like an old lightbox tube
  animators.push((t) => {
    const f = Math.sin(t * 0.7) > 0.995 ? 0.6 + 0.4 * Math.abs(Math.sin(t * 40)) : 1;
    mat.emissiveIntensity = 1.25 * f;
    glow.userData.level = f;
  });
}

// ------------------------------------------------------------------
// 8a. barn pendant lamps, wall lamp and paper lantern by the door
// ------------------------------------------------------------------
function buildLampsAndLantern({ g, mats, lm, L, R, F, animators }) {
  const zOut = L.zFrontOut;
  const shadeGeo = new THREE.LatheGeometry(
    [[0.025, 0], [0.035, -0.02], [0.05, -0.06], [0.09, -0.11], [0.17, -0.17], [0.2, -0.2]].map(([r, y]) => new THREE.Vector2(r, y)), 24);

  // barn pendant lamps hanging under the awning in front of the window
  [-3.3, -1.0].forEach((x) => {
    const z = zOut + 0.62, yTop = awningUnderY(L, z), yShade = 2.38;
    rod(g, mats.cord, [x, yTop, z], [x, yShade, z], 0.006);
    const lamp = new THREE.Group();
    lamp.position.set(x, yShade, z);
    lamp.add(new THREE.Mesh(shadeGeo, lm.shadeOuter));
    lamp.add(new THREE.Mesh(shadeGeo, lm.shadeInner));
    const sock = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.06, 10), mats.blackSteel);
    sock.position.y = -0.06; lamp.add(sock);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10), mats.bulb);
    bulb.position.y = -0.13; bulb.scale.y = 1.25; lamp.add(bulb);
    g.add(lamp);
  });
  // the one shadow-casting light outside: warm pool over the ledge, steps and menu boards
  spotLight(g, '#ffc58a', 24, 9, [-0.6, 2.62, 1.05], [-0.4, -0.45, 1.9], { angle: 1.0, penumbra: 0.75, shadow: true, mapSize: 1024 });

  // caged wall lamp right of the door (pic 3)
  const wx = 2.55, wy = 2.35, wz = zOut + 0.16;
  rod(g, mats.blackSteel, [wx, wy + 0.08, zOut], [wx, wy + 0.08, wz], 0.012);
  const glassL = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.17, 14), mats.bulbSoft);
  glassL.position.set(wx, wy, wz); g.add(glassL);
  [0.1, -0.1].forEach((dy) => {
    const capM = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.03, 14), mats.blackSteel);
    capM.position.set(wx, wy + dy, wz); g.add(capM);
  });

  // red/white/blue paper lantern hanging from a bracket below it, swaying gently
  const lanTex = T.sign({
    w: 1024, h: 256, bg: '#f4efe4', border: null, aged: 0.15, seed: 51,
    draw: (c, w, h) => {
      c.fillStyle = '#c8322b'; c.fillRect(0, 0, w, h * 0.2); c.fillRect(0, h * 0.8, w, h * 0.2);
      c.fillStyle = '#2f5f9a'; c.fillRect(0, h * 0.2, w, h * 0.05); c.fillRect(0, h * 0.75, w, h * 0.05);
    },
    lines: [{ text: R.nameKo, font: F.display, size: 92, color: '#c8322b', x: 0.5, y: 0.5 }],
  });
  const lanMat = new THREE.MeshStandardMaterial({ map: lanTex, emissive: '#ffffff', emissiveMap: lanTex, emissiveIntensity: 0.6, roughness: 0.9, side: THREE.DoubleSide });
  const bracketEnd = [wx + 0.02, 2.12, zOut + 0.42];
  rod(g, mats.blackSteel, [wx + 0.02, 2.12, zOut], bracketEnd, 0.012);
  const pivot = new THREE.Group();
  pivot.userData.keep = true;   // it swings, so it must not be merged
  pivot.position.set(...bracketEnd);
  g.add(pivot);
  rod(pivot, mats.cord, [0, 0, 0], [0, -0.12, 0], 0.005);
  const body = new THREE.Mesh(new THREE.LatheGeometry(
    [[0.06, -0.21], [0.13, -0.17], [0.175, -0.1], [0.19, 0], [0.175, 0.1], [0.13, 0.17], [0.06, 0.21]].map(([r, y]) => new THREE.Vector2(r, y)), 24), lanMat);
  body.position.y = -0.34;
  body.rotation.y = Math.PI; // text faces the street
  pivot.add(body);
  [0.215, -0.215].forEach((dy) => {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.035, 14), mats.blackSteel);
    ring.position.y = -0.34 + dy; pivot.add(ring);
  });
  const tassel = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.02, 0.14, 8), mats.redPaint);
  tassel.position.y = -0.64; pivot.add(tassel);
  const lanLight = pointLight(pivot, '#ffad7a', 2.5, 4, 0, -0.34, 0);
  animators.push((t) => {
    pivot.rotation.z = Math.sin(t * 1.3) * 0.05;
    pivot.rotation.x = Math.sin(t * 0.9 + 1) * 0.035;
    lanLight.userData.level = 0.94 + 0.06 * Math.sin(t * 7.3) * Math.sin(t * 3.1);
  });
}

// ------------------------------------------------------------------
// 8b. ledge, planters, potted plants, A-frame boards, number plate
// ------------------------------------------------------------------
function buildDressing({ g, mats, lm, L, R, F }) {
  const zOut = L.zFrontOut, yS = L.sidewalkY, W = L.frontWindow;
  const leaves = new InstanceBatch(new THREE.SphereGeometry(1, 6, 4), lm.leaf, { cast: true });
  const flowers = new InstanceBatch(new THREE.IcosahedronGeometry(0.028, 0), lm.flower, { cast: false });

  // wooden ledge under the big window, with brackets (pic 3)
  const ledgeTop = W.y0 + 0.02;
  box(g, mats.woodExt, W.x1 - W.x0 - 0.1, 0.06, 0.4, (W.x0 + W.x1) / 2, ledgeTop - 0.06, zOut + 0.2);
  [W.x0 + 0.3, (W.x0 + W.x1) / 2, W.x1 - 0.3].forEach((x) => {
    box(g, mats.woodDark, 0.05, 0.28, 0.05, x, ledgeTop - 0.34, zOut + 0.03, { cast: false });
    rod(g, mats.woodDark, [x, ledgeTop - 0.32, zOut + 0.03], [x, ledgeTop - 0.07, zOut + 0.34], 0.02);
  });
  // planter box with yellow flowers
  box(g, mats.woodDark, 0.7, 0.16, 0.24, -3.0, ledgeTop, zOut + 0.2);
  box(g, lm.soil, 0.64, 0.01, 0.18, -3.0, ledgeTop + 0.155, zOut + 0.2, { cast: false });
  foliage(leaves, -3.0, ledgeTop + 0.17, zOut + 0.2, { n: 40, rx: 0.32, ry: 0.16, rz: 0.11, size: 0.8, seed: 3 });
  const fr = T.rng(4);
  for (let i = 0; i < 26; i++) flowers.add(-3.0 + (fr() - 0.5) * 0.6, ledgeTop + 0.22 + fr() * 0.1, zOut + 0.2 + (fr() - 0.5) * 0.18, { s: 0.8 + fr() * 0.6 });
  // woven basket + trailing plant at the left end
  const bask = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.1, 0.16, 14), lm.basket);
  bask.position.set(-4.1, ledgeTop + 0.08, zOut + 0.2); bask.castShadow = true; g.add(bask);
  foliage(leaves, -4.1, ledgeTop + 0.1, zOut + 0.22, { n: 45, rx: 0.2, ry: 0.2, rz: 0.15, size: 0.9, droop: 0.35, seed: 5 });
  // a few bottles lined up at the right end of the ledge
  const bottles = new InstanceBatch(bottleGeometry(12), mats.bottleBrown);
  for (let i = 0; i < 5; i++) bottles.add(-0.55 + i * 0.1, ledgeTop, zOut + 0.24, { s: 1.25 });
  bottles.build(g);

  // tall white pots right of the steps (pic 3)
  const pot = (x, z, h, r, plantSize, seed) => {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.78, h, 20), mats.ceramic);
    p.position.set(x, yS + h / 2, z); p.castShadow = true; p.receiveShadow = true; g.add(p);
    box(g, lm.soil, r * 1.6, 0.01, r * 1.6, x, yS + h - 0.03, z, { cast: false });
    foliage(leaves, x, yS + h, z, { n: 70, rx: 0.28 * plantSize, ry: 0.6 * plantSize, rz: 0.28 * plantSize, size: 1.2 * plantSize, seed });
  };
  pot(3.4, zOut + 0.5, 0.62, 0.17, 1.0, 7);
  pot(3.85, zOut + 0.95, 0.32, 0.12, 0.6, 8);

  leaves.build(g); flowers.build(g);

  // blue address plate on the right pier (pic 3)
  const plate = T.sign({
    w: 256, h: 160, bg: '#21508f', border: '#e9eef5', borderW: 6, aged: 0.15, seed: 91,
    lines: [
      { text: '18', font: F.sans, weight: 700, size: 92, color: '#ffffff', y: 0.45 },
      { text: `${R.nameKo}길`, font: F.sans, size: 26, color: '#dfe8f5', y: 0.86 },
    ],
  });
  const pl = signPlane(g, signMaterial(plate, { glow: 0.15 }), 0.26, 0.16);
  pl.position.set(4.9, 2.05, zOut + 0.005);

  // A-frame sidewalk boards: printed menu + chalkboard
  const menuItems = [
    ['삼겹살', 'Pork belly', '15,000'], ['목살', 'Pork neck', '16,000'], ['양념갈비', 'Marinated ribs', '19,000'],
    ['소불고기', 'Beef bulgogi', '17,000'], ['된장찌개', 'Soybean stew', '8,000'], ['공기밥', 'Rice', '1,000'], ['소주 · 맥주', 'Soju · Beer', '5,000'],
  ];
  const menuLines = [
    { text: '오늘의 메뉴', font: F.display, size: 64, color: '#fff6e6', y: 0.085 },
    { text: "TODAY'S MENU", font: F.sans, weight: 600, size: 22, color: '#ffd9c2', y: 0.152, spacing: 5 },
    { text: '2인분 이상 주문 가능 · 2 servings min.', font: F.sans, size: 20, color: '#5a4a3c', y: 0.94 },
  ];
  menuItems.forEach(([ko, en, price], i) => {
    const y = 0.25 + i * 0.094;
    menuLines.push({ text: ko, font: F.retro, size: 44, color: '#2a1a12', x: 0.09, y, align: 'left' });
    menuLines.push({ text: en, font: F.sans, size: 19, color: '#7a6a5c', x: 0.09, y: y + 0.037, align: 'left' });
    menuLines.push({ text: `${price}원`, font: F.retro, size: 40, color: '#b3302a', x: 0.91, y, align: 'right' });
  });
  const menuTex = T.sign({
    w: 512, h: 800, bg: '#f1e6cf', border: '#7a1d14', borderW: 12, aged: 0.4, seed: 101,
    draw: (c, w, h) => {
      c.fillStyle = '#b3302a'; c.fillRect(0, 0, w, h * 0.19);
      c.strokeStyle = 'rgba(90,60,40,0.45)'; c.setLineDash([3, 7]); c.lineWidth = 2;
      menuItems.forEach((_, i) => { const y = (0.25 + i * 0.094) * h + 8; c.beginPath(); c.moveTo(w * 0.44, y); c.lineTo(w * 0.66, y); c.stroke(); });
      c.setLineDash([]);
    },
    lines: menuLines,
  });
  const chalkTex = T.sign({
    w: 512, h: 800, bg: '#1f2a24', border: '#5a3a22', borderW: 26, aged: 0.3, seed: 111,
    draw: (c, w, h) => {
      const r = T.rng(112);
      for (let i = 0; i < 40; i++) {
        c.fillStyle = `rgba(255,255,255,${0.02 + r() * 0.03})`;
        c.beginPath(); c.ellipse(r() * w, r() * h, 30 + r() * 80, 8 + r() * 20, r() * 3, 0, Math.PI * 2); c.fill();
      }
      c.strokeStyle = 'rgba(242,220,138,0.8)'; c.lineWidth = 3;
      [[90, 640], [420, 300], [440, 700]].forEach(([x, y]) => {
        c.beginPath();
        for (let k = 0; k < 5; k++) { const a = (k * 4 * Math.PI) / 5 - Math.PI / 2; c.lineTo(x + Math.cos(a) * 16, y + Math.sin(a) * 16); }
        c.closePath(); c.stroke();
      });
    },
    lines: [
      { text: '어서오세요!', font: F.pen, size: 110, color: '#f4f1ea', y: 0.13 },
      { text: 'Welcome in', font: F.pen, size: 58, color: '#f2dc8a', y: 0.24 },
      { text: '오늘의 추천', font: F.pen, size: 72, color: '#f2a7b5', y: 0.38 },
      { text: '숯불 삼겹살 세트', font: F.pen, size: 66, color: '#f4f1ea', y: 0.5 },
      { text: '+ 된장찌개 + 소주', font: F.pen, size: 52, color: '#bfe3d0', y: 0.6 },
      { text: 'Charcoal pork belly set', font: F.pen, size: 40, color: '#d8d4ca', y: 0.69 },
      { text: '39,000원', font: F.pen, size: 84, color: '#f2dc8a', y: 0.82 },
    ],
  });
  const aFrame = (x, z, ry, tex) => {
    const grp = new THREE.Group();
    grp.position.set(x, yS, z); grp.rotation.y = ry;
    const face = signMaterial(tex, { glow: 0.14 });
    const bw = 0.62, bh = 0.95, tilt = 0.17;
    [1, -1].forEach((s) => {
      const piv = new THREE.Group();
      piv.position.z = s * 0.17; piv.rotation.x = -s * tilt;
      const mats6 = s > 0
        ? [mats.blackSteel, mats.blackSteel, mats.blackSteel, mats.blackSteel, face, mats.blackSteel]
        : [mats.blackSteel, mats.blackSteel, mats.blackSteel, mats.blackSteel, mats.blackSteel, face];
      const p = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.025), mats6);
      p.position.y = bh / 2; p.castShadow = true; p.receiveShadow = true;
      piv.add(p); grp.add(piv);
    });
    g.add(grp);
  };
  aFrame(-2.9, zOut + 1.75, 0.18, menuTex);
  aFrame(-1.35, zOut + 1.95, -0.12, chalkTex);
}

// ------------------------------------------------------------------
// 9. upper floors over the shop (hidden in the top-down cutaway)
// ------------------------------------------------------------------
function buildUpperFloors({ roof, mats, lm, L }) {
  const ub = new THREE.Group();
  ub.name = 'upperFloors';
  roof.add(ub);
  const z0 = L.zBack - 0.3, z1 = L.zFrontOut, depth = z1 - z0, zc = (z0 + z1) / 2;
  const top = 11;
  box(ub, lm.upper, 10.6, top - L.slabTop, depth, 0, L.slabTop, zc, { uv: 2.5 });
  // floor bands and windows on the street face
  const W = makeWindowBatches(lm);
  [5.6, 8.45].forEach((y, fi) => {
    box(ub, mats.concrete, 10.6, 0.18, 0.08, 0, y - 0.3, z1 + 0.04, { cast: false });
    [-3.9, -1.3, 1.3, 3.9].forEach((x, wi) => {
      const lit = (fi === 0 && wi === 1) ? W.warm : (fi === 1 && wi === 3) ? W.cool : (fi === 1 && wi === 0) ? W.warm : W.dark;
      lit.add(x, y + 0.95, z1 + 0.012, { sx: 1.8, sy: 1.6, sz: 1 });
      W.frame.add(x, y + 0.95, z1 + 0.006, { sx: 1.94, sy: 1.74, sz: 1 });
      box(ub, mats.concrete, 2.0, 0.06, 0.12, x, y + 0.08, z1 + 0.06, { cast: false }); // sill
    });
  });
  buildWindowBatches(ub, W);
  // roof slab, parapet and a water tank
  box(ub, mats.concrete, 10.8, 0.25, depth + 0.2, 0, top, zc);
  box(ub, mats.concrete, 10.8, 0.9, 0.15, 0, top + 0.25, z1 - 0.05);
  box(ub, mats.concrete, 10.8, 0.9, 0.15, 0, top + 0.25, z0 + 0.05);
  box(ub, mats.concrete, 0.15, 0.9, depth, -5.35, top + 0.25, zc);
  box(ub, mats.concrete, 0.15, 0.9, depth, 5.35, top + 0.25, zc);
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.6, 20), lm.acWhite);
  tank.position.set(2.8, top + 1.05, -12); ub.add(tank);
  box(ub, lm.acWhite, 0.9, 0.7, 0.4, -3, top + 0.25, -6);
}

// window planes shared by every building
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
// 10a. street: sidewalk, curb, road, lane marks, street lamp
// ------------------------------------------------------------------
function buildStreet({ g, mats, lm, L }) {
  const yS = L.sidewalkY, yR = L.roadY, cz = L.curbZ;
  // near sidewalk (brick pavers, pic 4)
  box(g, mats.pavers, 60, 0.3, cz + 0.5, 0, yS - 0.3, (cz - 0.5) / 2, { uv: 1.6, cast: false });
  box(g, lm.curb, 60, 0.2, 0.18, 0, yS - 0.18, cz - 0.05, { cast: false });
  // road
  const roadZ1 = 17.6;
  box(g, mats.asphalt, 90, 0.3, roadZ1 - cz, 0, yR - 0.3, (cz + roadZ1) / 2, { uv: 3, cast: false });
  const dash = new InstanceBatch(new THREE.BoxGeometry(1.6, 0.006, 0.12), lm.lanePaint, { cast: false });
  for (let x = -42; x <= 42; x += 4) dash.add(x, yR, (cz + roadZ1) / 2);
  dash.build(g);
  box(g, lm.lanePaint, 90, 0.006, 0.1, 0, yR, cz + 0.45, { cast: false });
  box(g, lm.lanePaint, 90, 0.006, 0.1, 0, yR, roadZ1 - 0.45, { cast: false });
  // far sidewalk + curb
  box(g, mats.pavers, 90, 0.3, 4.0, 0, yS - 0.3, roadZ1 + 2.0, { uv: 1.6, cast: false });
  box(g, lm.curb, 90, 0.2, 0.18, 0, yS - 0.18, roadZ1 + 0.05, { cast: false });

  // street lamp (left, near the curb) — warm sodium light
  const sx = -8.4, sz = cz - 0.45;
  rod(g, lm.pole, [sx, yS, sz], [sx, yS + 6.4, sz], 0.075, 10);
  rod(g, lm.pole, [sx, yS + 6.3, sz], [sx, yS + 6.55, sz + 1.5], 0.04, 8);
  const head = box(g, lm.pole, 0.55, 0.12, 0.28, sx, yS + 6.45, sz + 1.55, { cast: false });
  const lens = signPlane(g, mats.bulbSoft, 0.42, 0.18);
  lens.rotation.x = Math.PI / 2;
  lens.position.set(sx, head.position.y - 0.065, sz + 1.55);
  pointLight(g, '#ffb267', 90, 22, sx, yS + 6.15, sz + 1.55);
  // a second lamp across the road, glow only (no light) for depth
  rod(g, lm.pole, [12, yS, roadZ1 + 0.5], [12, yS + 6.4, roadZ1 + 0.5], 0.075, 10);
  rod(g, lm.pole, [12, yS + 6.3, roadZ1 + 0.5], [12, yS + 6.55, roadZ1 - 1.0], 0.04, 8);
  box(g, lm.pole, 0.55, 0.12, 0.28, 12, yS + 6.45, roadZ1 - 1.05, { cast: false });
  const lens2 = signPlane(g, mats.bulbSoft, 0.42, 0.18);
  lens2.rotation.x = Math.PI / 2;
  lens2.position.set(12, yS + 6.445, roadZ1 - 1.05);
}

// ------------------------------------------------------------------
// 10b. neighbor buildings: dim masses with a few lit windows
// ------------------------------------------------------------------
function buildNeighbors({ g, mats, lm, L, F }) {
  const yS = L.sidewalkY;
  const W = makeWindowBatches(lm);
  const bldg = (mat, x0, x1, zFront, h, depth = 18.6, face = 1) => {
    const zc = face > 0 ? zFront - depth / 2 : zFront + depth / 2;
    return box(g, mat, x1 - x0, h, depth, (x0 + x1) / 2, yS, zc, { uv: 2.5 });
  };

  // LEFT A: closed roll-shutter shop
  bldg(lm.bldgA, -14, -5.3, 0.6, 14.45);
  const sh = plane(g, lm.shutter, 5.2, 3.0, { uv: 1.5 });
  sh.position.set(-8.9, yS + 1.5, 0.605);
  box(g, mats.blackSteel, 5.4, 0.35, 0.3, -8.9, yS + 3.0, 0.75, { cast: false });
  box(g, mats.woodDark, 0.95, 2.2, 0.06, -12.4, yS, 0.62, { cast: false }); // side door
  windowGrid(W, { x0: -13.6, x1: -5.7, y0: 3.8, y1: 13.4, z: 0.6, cols: 3, rows: 3, lit: 0.3, seed: 3 });

  // LEFT B
  bldg(lm.bldgB, -28, -14, 0.3, 10.45);
  windowGrid(W, { x0: -27.5, x1: -14.5, y0: 3.4, y1: 9.8, z: 0.3, cols: 5, rows: 2, lit: 0.35, seed: 4 });
  box(g, lm.winDark, 9, 2.4, 0.05, -21, yS + 0.2, 0.32, { cast: false });

  // RIGHT A: small laundry shop with a cool dim glow + AC units (pic 4)
  bldg(lm.bldgC, 5.3, 13, 0.0, 9.45, 18.3);
  const glowBack = plane(g, lm.shopGlow, 4.4, 2.3);
  glowBack.position.set(9.3, yS + 1.55, -0.6);
  const sg = plane(g, lm.glass, 4.6, 2.5, { receive: false });
  sg.position.set(9.3, yS + 1.55, 0.01);
  box(g, mats.blackSteel, 4.7, 0.08, 0.06, 9.3, yS + 2.8, 0.03, { cast: false });
  const lt = T.sign({
    w: 1024, h: 200, bg: '#e8eef2', border: '#2d5d8f', borderW: 10, aged: 0.45, seed: 121,
    lines: [
      { text: '행복세탁', font: F.retro, size: 120, color: '#2d5d8f', x: 0.36 },
      { text: 'LAUNDRY', font: F.sans, weight: 600, size: 52, color: '#2d5d8f', x: 0.8, spacing: 4 },
    ],
  });
  signBox(g, signMaterial(lt, { glow: 0.3 }), mats.blackSteel, 4.4, 0.86, 0.1, 9.3, yS + 3.05, 0.06);
  windowGrid(W, { x0: 5.8, x1: 12.6, y0: 4.6, y1: 8.6, z: 0.0, cols: 3, rows: 2, lit: 0.4, seed: 5 });
  // stacked outdoor AC units with hoses
  [0, 0.62].forEach((dy, i) => {
    box(g, lm.acWhite, 0.8, 0.6, 0.3, 5.95, yS + dy, 0.2, { cast: true });
    const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.01, 20), mats.blackSteel);
    fan.rotation.x = Math.PI / 2; fan.position.set(5.85, yS + dy + 0.3, 0.356); g.add(fan);
    rod(g, mats.rubber, [6.25, yS + dy + 0.45, 0.1], [6.25, yS + 3.2 + i * 0.1, 0.06], 0.025);
  });

  // RIGHT B: taller building
  bldg(lm.bldgA, 13, 28, 0.4, 16.45);
  windowGrid(W, { x0: 13.5, x1: 27.5, y0: 3.6, y1: 15.6, z: 0.4, cols: 5, rows: 4, lit: 0.3, seed: 6 });
  box(g, lm.shutter, 6, 2.8, 0.05, 17, yS, 0.42, { cast: false });

  // ACROSS THE STREET (behind the camera on the street shot, seen when looking around)
  const zA = 21.6;
  bldg(lm.bldgB, -32, -8, zA, 12.45, 10, -1);
  bldg(lm.bldgA, -8, 8, zA, 8.45, 10, -1);
  bldg(lm.bldgC, 8, 32, zA, 14.45, 10, -1);
  windowGrid(W, { x0: -31, x1: -9, y0: 3.5, y1: 11.5, z: zA, face: -1, cols: 6, rows: 3, lit: 0.3, seed: 7 });
  windowGrid(W, { x0: -7.5, x1: 7.5, y0: 3.5, y1: 7.6, z: zA, face: -1, cols: 4, rows: 1, lit: 0.4, seed: 8 });
  windowGrid(W, { x0: 9, x1: 31, y0: 3.5, y1: 13.6, z: zA, face: -1, cols: 6, rows: 4, lit: 0.3, seed: 9 });
  const across = plane(g, lm.shopGlow, 6, 2.2);
  across.rotation.y = Math.PI;
  across.position.set(-1, yS + 1.4, zA - 0.01);
  buildWindowBatches(g, W);
}
