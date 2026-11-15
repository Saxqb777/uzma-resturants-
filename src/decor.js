// Decor that gives Seoulicious its personality (from her inspo boards):
// framed Korean-style art posters with real bilingual typography (artwork by AI, lettering by code
// so it's always crisp and correct), neon signs, hanging lit sign cubes, the photo-spot wall,
// painted bilingual signs on the tin-roof stalls, and greenery everywhere.
import * as THREE from 'three';
import { box, InstanceBatch, mergeStatic } from './helpers.js';
import * as T from './textures.js';
import { signMaterial } from './materials.js';
import { LAYOUT as L, FONTS as F, RESTAURANT as R } from './config.js';
import { BOOTHS, EAVE } from './interior.js';
import { leafGeometry, leafMaterial, LEAF_COLORS } from './foliage.js';

const PINK = '#f2a7c3', TEAL = '#5fc2b8';

// --------------------------------------------------------------- AI artwork (posters + mural)
let art = { posters: [], murals: [] };
export async function loadArt() {
  let list = [];
  try {
    const m = await (await fetch('assets/ai/manifest.json')).json();
    list = Array.isArray(m) ? m : m.files || m.items || [];
  } catch { /* none yet */ }
  const load = (e) => new Promise((res) => {
    const im = new Image();
    im.onload = () => res({ img: im, desc: `${e.description || e.desc || ''} ${e.file || ''}`.toLowerCase() });
    im.onerror = () => res(null);
    const f = e.file || e.path || '';
    im.src = f.startsWith('assets/') ? f : `assets/ai/${f.replace(/^\.?\//, '')}`;
  });
  const pick = (re) => list.filter((e) => re.test(`${e.category || ''} ${e.file || e.path || ''}`));
  art.posters = (await Promise.all(pick(/poster/i).map(load))).filter(Boolean);
  art.murals = (await Promise.all(pick(/mural/i).map(load))).filter(Boolean);
}

// Bilingual titles matched to the artwork by its description
const TITLES = [
  [/kimchi/, 'KIMCHI', '김치', 'Fermented with love'],
  [/bibimbap/, 'BIBIMBAP', '비빔밥', 'Mix it all together'],
  [/tteok/, 'TTEOKBOKKI', '떡볶이', 'Spicy & chewy'],
  [/fried chicken|chicken/, 'K-CHICKEN', '치킨', 'Crispy every time'],
  [/tiger/, 'HORANGI', '호랑이', 'Brave & hungry'],
  [/magpie|pine/, 'GOOD NEWS', '까치', 'The magpie brings luck'],
  [/hanok|roof/, 'HANOK', '한옥', 'Home in Seoul'],
  [/tower|skyline|night/, 'SEOUL NIGHTS', '서울의 밤', 'Abu Dhabi ♥ Seoul'],
  [/blossom|cherry/, 'SPRING', '봄', 'Cherry blossom season'],
  [/cassette|k-pop|headphone/, 'K-POP', '케이팝', 'Turn it up'],
  [/mascot|skewer|grill/, 'GRILL TIME', '고기 타임', 'Sizzle sizzle'],
  [/pear|persimmon|harvest/, 'HARVEST', '풍년', 'Sweet and seasonal'],
];
const FALLBACK = [['ANNYEONG', '안녕', 'Hello, friend'], ['MASHISSEO', '맛있어', 'So delicious'], ['SARANGHAE', '사랑해', 'Love it here']];
function titleFor(desc, i) {
  for (const [re, en, ko, sub] of TITLES) if (re.test(desc)) return [en, ko, sub];
  return FALLBACK[i % FALLBACK.length];
}

// A printed poster: artwork + a typographic band, paper grain, slight ageing
function posterTexture(entry, i) {
  const [en, ko, sub] = titleFor(entry ? entry.desc : '', i);
  const pal = [['#c8362c', '#f4ead6'], ['#1f6d66', '#f4ead6'], ['#e2a62a', '#2a1d14'], ['#e889ab', '#2a1d14'], ['#2a2d4a', '#f4ead6']][i % 5];
  return T.sign({
    w: 600, h: 860, bg: '#f2e8d5', border: null, aged: 0.35, seed: 400 + i,
    fonts: [{ font: F.display, text: en + ko }, { font: F.round, text: sub }],
    draw: (c, w, h) => {
      const band = 190, top = i % 2 === 0;
      const ay = top ? band : 0, ah = h - band;
      if (entry) {
        const im = entry.img, s = Math.max(w / im.width, ah / im.height);
        const dw = im.width * s, dh = im.height * s;
        c.save(); c.beginPath(); c.rect(0, ay, w, ah); c.clip();
        c.drawImage(im, (w - dw) / 2, ay + (ah - dh) / 2, dw, dh); c.restore();
      } else {
        const gr = c.createLinearGradient(0, ay, 0, ay + ah); gr.addColorStop(0, pal[0]); gr.addColorStop(1, '#2a1d14');
        c.fillStyle = gr; c.fillRect(0, ay, w, ah);
      }
      // typographic band
      const by = top ? 0 : h - band;
      c.fillStyle = pal[0]; c.fillRect(0, by, w, band);
      c.fillStyle = pal[1]; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = `92px ${F.display}`; c.fillText(ko, w * 0.5, by + 66);
      c.font = `44px ${F.display}`; c.fillText(en, w * 0.5, by + 128);
      c.font = `24px ${F.round}`; c.globalAlpha = 0.85; c.fillText(sub, w * 0.5, by + 165); c.globalAlpha = 1;
      // paper grain
      const r = T.rng(900 + i);
      for (let k = 0; k < 1800; k++) { c.fillStyle = `rgba(${r() < 0.5 ? '255,250,240' : '40,30,20'},${r() * 0.05})`; c.fillRect(r() * w, r() * h, 2, 2); }
    },
  });
}

function framed(parent, M, tex, w, h, x, y, z, ry, frameMat) {
  const grp = new THREE.Group(); grp.position.set(x, y, z); grp.rotation.y = ry; parent.add(grp);
  const fr = new THREE.Mesh(new THREE.BoxGeometry(w + 0.05, h + 0.05, 0.03), frameMat); fr.position.z = -0.012; fr.castShadow = true; grp.add(fr);
  const art2 = new THREE.Mesh(new THREE.PlaneGeometry(w, h), signMaterial(tex, { glow: 0.1, rough: 0.55 })); art2.position.z = 0.004; grp.add(art2);
  grp.userData.keep = true;
  return grp;
}

// --------------------------------------------------------------- neon
function neonTexture(lines, { w = 1024, h = 360, seed = 1 } = {}) {
  return T.sign({
    w, h, bg: 'rgba(0,0,0,0)', border: null, aged: 0, seed,
    fonts: lines.map((l) => ({ font: l.font, text: l.text })),
    draw: (c) => {
      c.clearRect(0, 0, w, h);
      for (const l of lines) {
        c.save(); c.textAlign = 'center'; c.textBaseline = 'middle';
        c.font = `${l.size}px ${l.font}`; if (l.rtl) c.direction = 'rtl';
        for (const [blur, col] of [[30, l.glow], [14, l.glow], [0, l.core]]) { c.shadowColor = l.glow; c.shadowBlur = blur; c.fillStyle = col; c.fillText(l.text, l.x * w, l.y * h); }
        c.restore();
      }
    },
  });
}
function neon(parent, tex, w, h, x, y, z, ry, strength = 2.4) {
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, color: new THREE.Color(strength, strength, strength) });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.set(x, y, z); m.rotation.y = ry; m.userData.keep = true; m.renderOrder = 2;
  parent.add(m);
  // clear acrylic backer like real LED neon
  const back = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.96, h * 0.9), new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.08, roughness: 0.1 }));
  back.position.set(x, y, z); back.rotation.y = ry; back.translateZ(-0.01); back.userData.keep = true; parent.add(back);
  return m;
}

// --------------------------------------------------------------- hanging lit sign cubes (her inspo)
function lightCube(parent, M, x, y, z, ko, en, bg, fg, seed) {
  const tex = T.sign({ w: 512, h: 512, bg, border: fg, borderW: 16, aged: 0.1, seed,
    fonts: [{ font: F.display, text: ko + en }],
    lines: [{ text: ko, font: F.display, size: 150, color: fg, y: 0.42 }, { text: en, font: F.display, size: 64, color: fg, y: 0.74 }] });
  const mat = signMaterial(tex, { glow: 0.9 });
  const cube = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, 0.62), [mat, mat, new THREE.MeshStandardMaterial({ color: bg }), new THREE.MeshStandardMaterial({ color: bg }), mat, mat]);
  cube.position.set(x, y, z); cube.rotation.y = (seed % 7) * 0.12 - 0.3; cube.userData.keep = true; parent.add(cube);
  box(parent, M.cord, 0.008, L.ceil - y - 0.31, 0.008, x, y + 0.31, z, { cast: false });
  return cube;
}

// --------------------------------------------------------------- greenery
function leafBatches() {
  return LEAF_COLORS.map((c) => new InstanceBatch(leafGeometry(), leafMaterial(c), { cast: false }));
}
// a vine running along a line with leaves, drooping strands hanging down
function vineRun(B, a, b, n, droop, seed) {
  const r = T.rng(seed), A = new THREE.Vector3(...a), Bv = new THREE.Vector3(...b);
  for (let i = 0; i < n; i++) {
    const t = r(), p = A.clone().lerp(Bv, t);
    const hang = r() < 0.45 ? r() * droop : 0;
    B[i % B.length].add(p.x + (r() - 0.5) * 0.08, p.y - hang + (r() - 0.5) * 0.05, p.z + (r() - 0.5) * 0.08, { rx: (r() - 0.5) * 2, ry: r() * 6.3, rz: (r() - 0.5) * 2, s: 0.6 + r() * 0.8 });
  }
}

// --------------------------------------------------------------- build
export function buildDecor(ctx) {
  const { scene, mats: M } = ctx;
  const g = new THREE.Group(); g.name = 'interior'; scene.add(g);
  const frameMat = M.woodDark;
  const blackFrame = new THREE.MeshStandardMaterial({ color: '#1a1716', roughness: 0.5 });

  // 1) posters: above every wall-lane table (replaces the old fake windows), both walls
  let pi = 0;
  const posterAt = (x, y, z, ry, w = 0.62, h = 0.89) => {
    const entry = art.posters.length ? art.posters[pi % art.posters.length] : null;
    framed(g, M, posterTexture(entry, pi), w, h, x, y, z, ry, pi % 3 ? blackFrame : frameMat);
    pi++;
  };
  for (const b of BOOTHS.filter((b) => b.lane === 'wallL')) posterAt(L.x0 + 0.03, 2.0, b.z, Math.PI / 2);
  for (const b of BOOTHS.filter((b) => b.lane === 'wallR')) posterAt(L.x1 - 0.03, 2.0, b.z, -Math.PI / 2);
  // a gallery cluster on the front wall above the right window (by the nook)
  posterAt(3.0, 3.2, -0.03, Math.PI, 0.5, 0.72); posterAt(4.3, 3.25, -0.03, Math.PI, 0.5, 0.72); posterAt(5.6, 3.2, -0.03, Math.PI, 0.5, 0.72);

  // 2) photo spot (front left): mural wall + neon + vine frame + bench + a floor marker
  photoSpot(g, M);

  // 3) neon: multilingual welcome above the door (inside), and fun signs on the island roofs
  neon(g, neonTexture([
    { text: '안녕하세요 · Hello · مرحبا', font: `${F.cute}, ${F.arabic}`, size: 92, glow: '#ff5fa2', core: '#ffe0ee', x: 0.5, y: 0.5 },
  ], { w: 1400, h: 220, seed: 501 }), 3.2, 0.5, 0, 3.15, -0.06, Math.PI);
  const islandFront = L.dining.z0 + 0.32;
  neon(g, neonTexture([
    { text: '맛있다!', font: F.cute, size: 150, glow: '#ff4f8b', core: '#ffe3ef', x: 0.5, y: 0.4 },
    { text: 'so delicious', font: F.neon, size: 84, glow: '#ffd35c', core: '#fff6d8', x: 0.5, y: 0.8 },
  ], { w: 900, h: 420, seed: 502 }), 1.6, 0.75, L.lanes.isl1.part, 3.15, islandFront, 0);
  neon(g, neonTexture([
    { text: 'Korean BBQ', font: F.neon, size: 120, glow: '#36e0cf', core: '#e3fffb', x: 0.5, y: 0.38 },
    { text: 'for everyone ♥', font: F.neon, size: 84, glow: '#ff5fa2', core: '#ffe3ef', x: 0.5, y: 0.78 },
  ], { w: 900, h: 420, seed: 503 }), 1.6, 0.75, L.lanes.isl2.part, 3.15, islandFront, 0);

  // 4) painted bilingual signs angled off the wall-lane tin roofs (retro pocha style)
  const painted = [
    [L.lanes.wallL.xb + 0.12, -4.75, Math.PI / 4, '#b8322b', '#2f8f8a', '#f6efe2', 'GRILL HOUSE', '고기 굽는 집'],
    [L.lanes.wallR.xa - 0.12, -4.75, -Math.PI / 4, '#e7c54a', '#1d1a16', '#1d1a16', "TODAY'S SPECIAL", '오늘의 메뉴'],
    [L.lanes.wallL.xb + 0.12, -11.9, Math.PI / 3.2, '#efe5cf', '#2f8f8a', '#b62a28', 'SPICY CHICKEN', '매운 닭갈비'],
    [L.lanes.wallR.xa - 0.12, -11.9, -Math.PI / 3.2, '#2a7f7b', '#efe6d3', '#f4ecdc', 'FRESH RICE', '갓 지은 밥'],
  ];
  painted.forEach(([x, z, ry, bg, border, fg, en, ko], i) => {
    const tex = T.sign({ w: 1024, h: 330, bg, border, borderW: 24, seed: 520 + i, aged: 0.55,
      lines: [{ text: ko, font: F.display, size: 140, color: fg, y: 0.42 }, { text: en, font: F.display, size: 58, color: fg, y: 0.82, spacing: 6 }] });
    const grp = new THREE.Group(); grp.position.set(x, 3.3, z); grp.rotation.y = ry; g.add(grp);
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.58, 0.04), frameMat); back.position.z = -0.022; grp.add(back);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.52), signMaterial(tex, { glow: 0.22 })); grp.add(face);
    grp.userData.keep = true;
  });

  // 5) hanging lit sign cubes over the centre aisle (her inspo)
  const cubes = [
    ['안녕', 'HELLO', '#f7efe1', '#c8362c'], ['맛있어요', 'YUMMY', '#ffd35c', '#2a1d14'], ['감사합니다', 'THANK YOU', '#2f8f8a', '#f7efe1'],
    ['치킨', 'CHICKEN', '#f2a7c3', '#2a1d14'], ['김치', 'KIMCHI', '#c8362c', '#f7efe1'],
  ];
  cubes.forEach(([ko, en, bg, fg], i) => lightCube(g, M, (i % 2 ? 0.35 : -0.35), 3.05 + (i % 3) * 0.12, -6.0 - i * 2.4, ko, en, bg, fg, 540 + i));

  // 6) greenery: vines along every tin-roof edge, trailing down; hanging planters
  const VB = leafBatches();
  const zA = L.dining.z0 + 0.3, zB = L.dining.z0 - L.dining.pitch * L.dining.count - 0.2;
  for (const x of [L.lanes.wallL.xb + 0.05, L.lanes.wallR.xa - 0.05]) vineRun(VB, [x, 2.86, zA], [x, 2.86, zB], 520, 0.75, Math.round(x * 13));
  for (const isl of [L.lanes.isl1, L.lanes.isl2]) for (const x of [isl.xa - 0.2, isl.xb + 0.2]) vineRun(VB, [x, 3.0, zA], [x, 3.0, zB], 380, 0.55, Math.round(x * 17));
  // vines on the posts
  for (const z of EAVE.postZ) for (const x of [L.lanes.wallL.xb + 0.12, L.lanes.wallR.xa - 0.12]) vineRun(VB, [x, 0.4, z], [x, 2.8, z], 60, 0, Math.round(z * 31 + x));
  // hanging planters in the front zone
  for (const [x, z] of [[-2.6, -2.2], [2.6, -2.2], [-4.6, -3.6], [2.4, -4.0]]) hangingPlanter(g, M, VB, x, 2.5, z, Math.round(x * 7 + z));
  VB.forEach((b) => b.build(g));

  mergeStatic(g);
  return g;
}

function hangingPlanter(g, M, VB, x, y, z, seed) {
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.18, 20), new THREE.MeshStandardMaterial({ color: '#d9c7b0', roughness: 0.8 }));
  pot.position.set(x, y, z); pot.castShadow = true; g.add(pot);
  for (let i = 0; i < 3; i++) { const a = i * 2.1; box(g, M.cord, 0.004, L.ceil - y - 0.09, 0.004, x + Math.cos(a) * 0.13, y + 0.09, z + Math.sin(a) * 0.13, { cast: false }); }
  const r = T.rng(seed);
  for (let k = 0; k < 8; k++) {
    const a = r() * 6.3, len = 0.4 + r() * 0.9;
    vineRun(VB, [x + Math.cos(a) * 0.14, y + 0.08, z + Math.sin(a) * 0.14], [x + Math.cos(a) * 0.22, y - len, z + Math.sin(a) * 0.22], 18, 0, seed * 10 + k);
  }
  vineRun(VB, [x - 0.12, y + 0.12, z], [x + 0.12, y + 0.12, z], 30, 0, seed + 3);
}

// --------------------------------------------------------------- photo spot
export const PHOTO_SPOT = { x: -6.2, z: -2.5 };
function photoSpot(g, M) {
  const x = L.x0 + 0.02, z0 = -0.7, z1 = -4.3, y0 = 0.35, y1 = 3.0, zc = (z0 + z1) / 2, w = z0 - z1, h = y1 - y0;
  const mural = art.murals[0];
  const tex = T.sign({ w: 2048, h: 1500, bg: '#2c2a3d', border: null, aged: 0.05, seed: 600,
    draw: (c, cw, ch) => {
      if (mural) {
        const im = mural.img, s = Math.max(cw / im.width, ch / im.height);
        c.drawImage(im, (cw - im.width * s) / 2, (ch - im.height * s) / 2, im.width * s, im.height * s);
      } else {
        const gr = c.createLinearGradient(0, 0, 0, ch); gr.addColorStop(0, '#2b2a49'); gr.addColorStop(1, '#f2a7c3');
        c.fillStyle = gr; c.fillRect(0, 0, cw, ch);
      }
    } });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(w, h), signMaterial(tex, { glow: 0.12, rough: 0.85 }));
  wall.position.set(x, y0 + h / 2, zc); wall.rotation.y = Math.PI / 2; wall.userData.keep = true; g.add(wall);
  // neon over the mural
  neon(g, neonTexture([
    { text: R.name, font: F.neon, size: 200, glow: '#ff4f9a', core: '#ffe6f1', x: 0.5, y: 0.42 },
    { text: 'say kimchi! · 김치~', font: `${F.cute}`, size: 80, glow: '#38e2d2', core: '#e6fffc', x: 0.5, y: 0.85 },
  ], { w: 1400, h: 520, seed: 610 }), 2.6, 0.97, x + 0.06, 2.35, zc, Math.PI / 2, 2.6);
  // vine & blossom frame around the mural
  const VB = leafBatches();
  vineRun(VB, [x + 0.05, y1 + 0.05, z0], [x + 0.05, y1 + 0.05, z1], 260, 0.35, 611);
  vineRun(VB, [x + 0.05, y0, z0 + 0.05], [x + 0.05, y1, z0 + 0.05], 160, 0, 612);
  vineRun(VB, [x + 0.05, y0, z1 - 0.05], [x + 0.05, y1, z1 - 0.05], 160, 0, 613);
  VB.forEach((b) => b.build(g));
  const blossom = new THREE.SphereGeometry(0.03, 8, 6);
  const bb = ['#f7c6d6', '#ffffff', '#f29bbb'].map((c) => new InstanceBatch(blossom, new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 }), { cast: false }));
  const r = T.rng(614);
  for (let i = 0; i < 120; i++) {
    const t = r(), side = r();
    const p = side < 0.5 ? [x + 0.06, y1 + 0.03 - r() * 0.3, z0 - t * w] : [x + 0.06, y0 + t * h, side < 0.75 ? z0 : z1];
    bb[i % 3].add(p[0], p[1], p[2], { s: 0.7 + r() * 0.8 });
  }
  bb.forEach((b) => b.build(g));
  // a cute bench to sit on for photos
  box(g, M.woodOak || M.woodBooth, 0.45, 0.42, 1.6, x + 0.45, 0, zc);
  const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 1.55), new THREE.MeshStandardMaterial({ color: PINK, roughness: 0.9 }));
  cushion.position.set(x + 0.45, 0.45, zc); cushion.castShadow = true; g.add(cushion);
  // floor sticker: "stand here 📷"
  const st = T.sign({ w: 512, h: 512, bg: 'rgba(0,0,0,0)', border: null, aged: 0, seed: 615, fonts: [{ font: F.round, text: 'PHOTO SPOT stand here' }, { font: F.cute, text: '사진 찍어요' }],
    draw: (c, cw) => {
      c.clearRect(0, 0, cw, cw); c.fillStyle = TEAL; c.beginPath(); c.arc(cw / 2, cw / 2, cw / 2 - 8, 0, 7); c.fill();
      c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = `64px ${F.round}`; c.fillText('PHOTO SPOT', cw / 2, cw / 2 - 30);
      c.font = `40px ${F.cute}`; c.fillText('사진 찍어요', cw / 2, cw / 2 + 30); c.font = `34px ${F.round}`; c.fillText('stand here', cw / 2, cw / 2 + 85);
    } });
  const sticker = new THREE.Mesh(new THREE.CircleGeometry(0.42, 40), new THREE.MeshStandardMaterial({ map: st, transparent: true, roughness: 0.6 }));
  sticker.rotation.x = -Math.PI / 2; sticker.position.set(-4.4, 0.006, zc); sticker.userData.keep = true; g.add(sticker);
}
