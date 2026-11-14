// Procedural textures drawn on <canvas>. No image files needed.
// Every texture here tiles, so it can repeat across walls and floors.
import * as THREE from 'three';

let maxAniso = 4;
export function setMaxAnisotropy(n) { maxAniso = n; }

// ---------- small utilities ----------
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

export function toTexture(c, { repeat = [1, 1], color = true, wrap = true, aniso = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso ? maxAniso : 1;
  return t;
}

// Tileable value noise. period = lattice cells across one tile.
function noise2(seed) {
  const r = rng(seed);
  const N = 256;
  const g = new Float32Array(N * N);
  for (let i = 0; i < g.length; i++) g[i] = r();
  const s = (t) => t * t * (3 - 2 * t);
  return (x, y, px, py) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const w = (i, j) => g[(((j % py) + py) % py) * N + (((i % px) + px) % px)];
    const a = w(xi, yi), b = w(xi + 1, yi), c = w(xi, yi + 1), d = w(xi + 1, yi + 1);
    const u = s(xf), v = s(yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

// fbm over the unit tile (u,v in 0..1), fx/fy = base cells across the tile
function fbmTile(n, u, v, fx, fy, oct = 4) {
  let sum = 0, amp = 0.5, norm = 0, f = 1;
  for (let o = 0; o < oct; o++) {
    const px = fx * f, py = fy * f;
    sum += amp * n(u * px, v * py, px, py);
    norm += amp; amp *= 0.5; f *= 2;
  }
  return sum / norm;
}

function pixels(ctx, w, h, fn) {
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const c = fn(x / w, y / h, x, y);
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = c[3] ?? 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

const clamp = (v, a = 0, b = 255) => Math.max(a, Math.min(b, v));
const hex = (h) => {
  const n = parseInt(h.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

// ---------- surface textures ----------

// Planks stacked along V, grain running along U. Returns { map, bump }.
export function woodTexture({ size = 512, planks = 4, base = '#7a4a26', variance = 0.18, grain = 0.32,
  seed = 1, seamDark = 0.45, joints = true, weather = 0 } = {}) {
  const [c, ctx] = makeCanvas(size, size);
  const [bc, bctx] = makeCanvas(size, size);
  const r = rng(seed);
  const n = noise2(seed + 7);
  const b = hex(base);
  const plank = [];
  for (let i = 0; i < planks; i++) {
    plank.push({ tint: 1 + (r() - 0.5) * 2 * variance, off: r() * 10, joint: joints && r() < 0.5 ? r() : -1, hue: (r() - 0.5) * 0.08 });
  }
  const bumpData = bctx.createImageData(size, size);
  pixels(ctx, size, size, (u, v, x, y) => {
    const pi = Math.min(planks - 1, Math.floor(v * planks));
    const p = plank[pi];
    const yl = v * planks - pi; // 0..1 inside plank
    const warp = fbmTile(n, u, v, 3, planks * 2, 3);
    const lines = Math.sin((yl * 26 + warp * 9 + p.off) * Math.PI * 2);
    const fine = fbmTile(n, u, v, 48, planks * 4, 2);
    let k = p.tint * (1 + lines * grain * 0.5 + (fine - 0.5) * 0.25);
    // seams between planks
    const edge = Math.min(yl, 1 - yl) * (size / planks);
    let seam = edge < 1.6 ? seamDark : edge < 3 ? 0.8 : 1;
    if (p.joint >= 0) {
      const dj = Math.abs(u - p.joint) * size;
      if (dj < 1.5) seam = Math.min(seam, seamDark);
    }
    k *= seam;
    // weathering: lighter, greyer patches
    let wr = 0;
    if (weather > 0) wr = clamp((fbmTile(n, u, v, 6, 6, 3) - 0.45) * 2 * weather, 0, 1);
    const R = b[0] * k * (1 + p.hue), G = b[1] * k, B = b[2] * k * (1 - p.hue);
    const grey = (R + G + B) / 3 * 1.15;
    const bi = (y * size + x) * 4;
    const bv = clamp(128 + lines * 18 * grain + (seam < 1 ? -90 : 0));
    bumpData.data[bi] = bumpData.data[bi + 1] = bumpData.data[bi + 2] = bv; bumpData.data[bi + 3] = 255;
    return [clamp(R + (grey - R) * wr), clamp(G + (grey - G) * wr), clamp(B + (grey - B) * wr)];
  });
  bctx.putImageData(bumpData, 0, 0);
  return { map: toTexture(c), bump: toTexture(bc, { color: false }) };
}

// Rusty corrugated tin. Corrugation itself is real geometry; this is color only.
export function rustTexture({ size = 512, seed = 3, rust = 0.65 } = {}) {
  const [c, ctx] = makeCanvas(size, size);
  const n = noise2(seed);
  const metal = [118, 116, 110], rd = [86, 46, 26], ro = [156, 86, 40];
  pixels(ctx, size, size, (u, v) => {
    const big = fbmTile(n, u, v, 4, 4, 4);
    const streak = fbmTile(n, u, v, 40, 2, 3);
    const spots = fbmTile(n, u, v, 24, 24, 2);
    let t = clamp((big - (1 - rust)) * 3 + (streak - 0.5) * 0.9 + (spots - 0.5) * 0.5, 0, 1);
    const o = clamp((streak - 0.35) * 2, 0, 1);
    const rc = rd.map((x, i) => x + (ro[i] - x) * o);
    const k = 0.85 + spots * 0.3;
    return rc.map((x, i) => clamp((metal[i] + (x - metal[i]) * t) * k));
  });
  return toTexture(c);
}

export function plasterTexture({ size = 512, base = '#cdc4b4', seed = 5, mottle = 0.12, stains = 0.2 } = {}) {
  const [c, ctx] = makeCanvas(size, size);
  const n = noise2(seed);
  const b = hex(base);
  pixels(ctx, size, size, (u, v) => {
    const m = fbmTile(n, u, v, 4, 4, 5);
    const f = fbmTile(n, u, v, 64, 64, 2);
    const s = clamp((fbmTile(n, u, v, 3, 3, 3) - 0.55) * 4, 0, 1) * stains;
    const k = 1 + (m - 0.5) * mottle * 2 + (f - 0.5) * 0.06 - s * 0.35;
    return [clamp(b[0] * k), clamp(b[1] * k * 0.99), clamp(b[2] * k * 0.96)];
  });
  return toTexture(c);
}

// Square floor tiles with grout. Returns { map, rough }.
export function tileTexture({ size = 512, tiles = 2, base = '#2b2b2d', grout = '#141414', groutPx = 3,
  variance = 0.12, seed = 9, rows = null, offset = 0, gloss = 0.55 } = {}) {
  const [c, ctx] = makeCanvas(size, size);
  const [rc, rctx] = makeCanvas(size, size);
  const n = noise2(seed);
  const r = rng(seed);
  const cols = tiles, rws = rows || tiles;
  const tint = [];
  for (let i = 0; i < cols * rws * 2; i++) tint.push(1 + (r() - 0.5) * 2 * variance);
  const b = hex(base), g = hex(grout);
  const rough = rctx.createImageData(size, size);
  pixels(ctx, size, size, (u, v, x, y) => {
    const row = Math.floor(v * rws);
    const uo = u + (row % 2 ? offset / cols : 0);
    const col = Math.floor((uo % 1) * cols);
    const lu = ((uo % 1) * cols) % 1, lv = (v * rws) % 1;
    const ex = Math.min(lu, 1 - lu) * (size / cols), ey = Math.min(lv, 1 - lv) * (size / rws);
    const isG = ex < groutPx / 2 || ey < groutPx / 2;
    const ri = (y * size + x) * 4;
    const nn = fbmTile(n, u, v, 16, 16, 3);
    const rv = isG ? 235 : clamp(255 * (1 - gloss) + (nn - 0.5) * 70);
    rough.data[ri] = rough.data[ri + 1] = rough.data[ri + 2] = rv; rough.data[ri + 3] = 255;
    if (isG) return g;
    const k = tint[row * cols + col] * (0.9 + nn * 0.2);
    // soft bevel darkening near edges
    const bev = Math.min(1, Math.min(ex, ey) / 6) * 0.15 + 0.85;
    return [clamp(b[0] * k * bev), clamp(b[1] * k * bev), clamp(b[2] * k * bev)];
  });
  rctx.putImageData(rough, 0, 0);
  return { map: toTexture(c), rough: toTexture(rc, { color: false }) };
}

export function brickTexture({ size = 512, rows = 8, cols = 4, seed = 11, base = '#7b3f2a', mortar = '#9d9282' } = {}) {
  const [c, ctx] = makeCanvas(size, size);
  const n = noise2(seed);
  const r = rng(seed);
  const tint = Array.from({ length: rows * cols * 2 }, () => 0.75 + r() * 0.45);
  const b = hex(base), m = hex(mortar);
  pixels(ctx, size, size, (u, v) => {
    const row = Math.floor(v * rows);
    const uo = (u + (row % 2 ? 0.5 / cols : 0)) % 1;
    const col = Math.floor(uo * cols);
    const lu = (uo * cols) % 1, lv = (v * rows) % 1;
    const ex = Math.min(lu, 1 - lu) * (size / cols), ey = Math.min(lv, 1 - lv) * (size / rows);
    const nn = fbmTile(n, u, v, 32, 32, 3);
    if (ex < 3 || ey < 3) return m.map((x) => clamp(x * (0.85 + nn * 0.3)));
    const k = tint[row * cols + col] * (0.85 + nn * 0.3);
    return [clamp(b[0] * k), clamp(b[1] * k), clamp(b[2] * k)];
  });
  return toTexture(c);
}

export function asphaltTexture({ size = 512, seed = 13 } = {}) {
  const [c, ctx] = makeCanvas(size, size);
  const n = noise2(seed);
  const r = rng(seed);
  pixels(ctx, size, size, (u, v) => {
    const m = fbmTile(n, u, v, 6, 6, 4);
    const k = 34 + m * 18 + (r() < 0.04 ? 25 : 0);
    return [k, k, k + 2];
  });
  return toTexture(c);
}

// Dark grey concrete / stone panel
export function concreteTexture({ size = 512, base = '#56534f', seed = 17, panels = 0 } = {}) {
  const [c, ctx] = makeCanvas(size, size);
  const n = noise2(seed);
  const b = hex(base);
  pixels(ctx, size, size, (u, v) => {
    const m = fbmTile(n, u, v, 5, 5, 5);
    let k = 0.85 + m * 0.3;
    if (panels) {
      const e = Math.min((u * panels) % 1, (v * panels) % 1, 1 - (u * panels) % 1, 1 - (v * panels) % 1) * size / panels;
      if (e < 2) k *= 0.55;
    }
    return b.map((x) => clamp(x * k));
  });
  return toTexture(c);
}

// Vertical gradient, used for the night sky background
export function skyTexture() {
  const [c, ctx] = makeCanvas(16, 512);
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#04060d');
  g.addColorStop(0.55, '#0c1220');
  g.addColorStop(0.82, '#1d2230');
  g.addColorStop(1, '#2e2726');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 16, 512);
  const t = toTexture(c, { wrap: false });
  return t;
}

// Round tabletop grill grate (alpha). Bars + rim.
export function grateTexture() {
  const s = 256;
  const [c, ctx] = makeCanvas(s, s);
  ctx.clearRect(0, 0, s, s);
  ctx.save();
  ctx.beginPath(); ctx.arc(s / 2, s / 2, s / 2 - 6, 0, Math.PI * 2); ctx.clip();
  ctx.strokeStyle = '#2a2826'; ctx.lineWidth = 7;
  for (let x = 14; x < s; x += 20) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, s); ctx.stroke(); }
  ctx.restore();
  ctx.strokeStyle = '#1d1b1a'; ctx.lineWidth = 12;
  ctx.beginPath(); ctx.arc(s / 2, s / 2, s / 2 - 8, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(s / 2, 8); ctx.lineTo(s / 2, s - 8); ctx.stroke();
  return toTexture(c, { wrap: false });
}

// Frosted window pane with warm light behind it
export function frostedGlowTexture({ warm = '#ffcf8a', dim = '#7a5a3a', seed = 21 } = {}) {
  const s = 256;
  const [c, ctx] = makeCanvas(s, s);
  const g = ctx.createRadialGradient(s * 0.5, s * 0.35, 10, s * 0.5, s * 0.5, s * 0.75);
  g.addColorStop(0, warm); g.addColorStop(1, dim);
  ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  const r = rng(seed);
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = `rgba(255,255,255,${r() * 0.05})`;
    ctx.fillRect(r() * s, r() * s, 2, 2);
  }
  return toTexture(c, { wrap: false });
}

// ---------- signs ----------
// Aged hand-painted sign board.
// lines: [{ text, font, size, color, x (0..1), y (0..1), align, stroke, strokeColor, weight, spacing, vertical }]
export function signTexture({ w = 1024, h = 256, bg = '#ece2cf', border = '#3a2414', borderW = 16, inner = null,
  lines = [], seed = 31, aged = 0.5, draw = null } = {}) {
  const [c, ctx] = makeCanvas(w, h);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  if (border) {
    ctx.strokeStyle = border; ctx.lineWidth = borderW;
    ctx.strokeRect(borderW / 2, borderW / 2, w - borderW, h - borderW);
  }
  if (inner) {
    ctx.strokeStyle = inner.color; ctx.lineWidth = inner.width || 4;
    const p = inner.pad || 28;
    ctx.strokeRect(p, p, w - p * 2, h - p * 2);
  }
  if (draw) draw(ctx, w, h);
  for (const L of lines) {
    ctx.save();
    ctx.font = `${L.weight || ''} ${L.size}px ${L.font}`.trim();
    ctx.fillStyle = L.color;
    ctx.textAlign = L.align || 'center';
    ctx.textBaseline = 'middle';
    if (L.spacing) ctx.letterSpacing = `${L.spacing}px`;
    const x = (L.x ?? 0.5) * w, y = (L.y ?? 0.5) * h;
    if (L.vertical) {
      const chars = [...L.text];
      const step = L.step || L.size * 1.02;
      const y0 = y - ((chars.length - 1) * step) / 2;
      chars.forEach((ch, i) => {
        if (L.stroke) { ctx.strokeStyle = L.strokeColor; ctx.lineWidth = L.stroke; ctx.strokeText(ch, x, y0 + i * step); }
        ctx.fillText(ch, x, y0 + i * step);
      });
    } else {
      if (L.shadow) { ctx.fillStyle = L.shadow; ctx.fillText(L.text, x + (L.shadowOff || 6), y + (L.shadowOff || 6)); ctx.fillStyle = L.color; }
      if (L.stroke) { ctx.strokeStyle = L.strokeColor; ctx.lineWidth = L.stroke; ctx.lineJoin = 'round'; ctx.strokeText(L.text, x, y); }
      ctx.fillText(L.text, x, y);
    }
    ctx.restore();
  }
  if (aged > 0) ageCanvas(ctx, w, h, aged, seed);
  const t = toTexture(c, { wrap: false });
  return t;
}

// Grime, scratches and darkened edges over any canvas
export function ageCanvas(ctx, w, h, amount = 0.5, seed = 1) {
  const r = rng(seed);
  // edge darkening
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
  g.addColorStop(0, 'rgba(40,25,10,0)');
  g.addColorStop(1, `rgba(40,25,10,${0.45 * amount})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  // blotches
  for (let i = 0; i < 60 * amount; i++) {
    const x = r() * w, y = r() * h, rad = 10 + r() * 60;
    const bg = ctx.createRadialGradient(x, y, 0, x, y, rad);
    bg.addColorStop(0, `rgba(70,50,30,${0.12 * amount})`);
    bg.addColorStop(1, 'rgba(70,50,30,0)');
    ctx.fillStyle = bg; ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // scratches / paint chips
  ctx.strokeStyle = `rgba(255,250,235,${0.25 * amount})`;
  for (let i = 0; i < 140 * amount; i++) {
    const x = r() * w, y = r() * h, l = 4 + r() * 30, a = r() * Math.PI;
    ctx.lineWidth = 0.5 + r() * 1.5;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
  }
  for (let i = 0; i < 400 * amount; i++) {
    ctx.fillStyle = `rgba(30,20,10,${r() * 0.18 * amount})`;
    ctx.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2);
  }
}

// Paper notice with vertical handwritten lines (the white sheets pinned to posts)
export function paperNoticeTexture({ cols = ['오늘도', '맛있게'], seed = 41, font = '"Nanum Pen Script", "Nanum Brush Script", cursive' } = {}) {
  const w = 256, h = 512;
  const [c, ctx] = makeCanvas(w, h);
  ctx.fillStyle = '#f3efe6'; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 3; ctx.strokeRect(10, 10, w - 20, h - 20);
  ctx.fillStyle = '#1f1a16';
  ctx.font = `64px ${font}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const step = 62;
  cols.forEach((col, ci) => {
    const x = w - 70 - ci * 80;
    [...col].forEach((ch, i) => ctx.fillText(ch, x, 60 + i * step));
  });
  ageCanvas(ctx, w, h, 0.35, seed);
  return toTexture(c, { wrap: false });
}

// ---------- sign registry ----------
// Korean web fonts load per-glyph subset, so we draw signs once with whatever is
// available, then ask the browser for exactly the glyphs each sign uses and redraw.
const registry = [];

export function sign(opts) {
  const t = signTexture(opts);
  registry.push({ kind: 'sign', opts, t });
  return t;
}

export function notice(opts) {
  const t = paperNoticeTexture(opts);
  registry.push({ kind: 'notice', opts, t });
  return t;
}

// Extra font/text pairs used by custom draw() callbacks: [{ font, text }]
const extraFonts = [];
export function registerFontText(font, text) { extraFonts.push({ font, text }); }

export async function refreshSignFonts(timeoutMs = 5000) {
  if (!document.fonts || !document.fonts.load) return;
  const want = new Map();
  const add = (font, text) => want.set(font, (want.get(font) || '') + text);
  for (const e of registry) {
    if (e.kind === 'sign') for (const L of e.opts.lines || []) add(L.font, L.text);
    else add(e.opts.font || '"Nanum Pen Script", cursive', (e.opts.cols || []).join(''));
    for (const f of e.opts.fonts || []) add(f.font, f.text);
  }
  for (const f of extraFonts) add(f.font, f.text);
  const loads = [...want].map(([font, text]) => document.fonts.load(`48px ${font}`, text).catch(() => null));
  await Promise.race([Promise.all(loads), new Promise((r) => setTimeout(r, timeoutMs))]);
  for (const e of registry) {
    const fresh = e.kind === 'sign' ? signTexture(e.opts) : paperNoticeTexture(e.opts);
    e.t.image = fresh.image;
    e.t.needsUpdate = true;
  }
}

// Glowing charcoal: dark lumps with hot orange gaps. Use as map + emissiveMap.
export function emberTexture(seed = 51) {
  const s = 256;
  const [c, ctx] = makeCanvas(s, s);
  const g = ctx.createRadialGradient(s / 2, s / 2, 8, s / 2, s / 2, s / 2);
  g.addColorStop(0, '#ffd27a'); g.addColorStop(0.45, '#ff7a22'); g.addColorStop(1, '#7a1e06');
  ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  const r = rng(seed);
  for (let i = 0; i < 70; i++) {
    const cx = r() * s, cy = r() * s, rad = 10 + r() * 18;
    ctx.beginPath();
    const n = 5 + Math.floor(r() * 3);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + r() * 0.4, rr = rad * (0.7 + r() * 0.4);
      ctx[k ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = `rgb(${20 + r() * 20},${16 + r() * 12},${14 + r() * 10})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(255,${90 + r() * 60},20,${0.35 + r() * 0.4})`;
    ctx.lineWidth = 1.5; ctx.stroke();
  }
  return toTexture(c, { wrap: false });
}

// Pork belly slice: pink meat with white fat layers along its length
export function meatTexture() {
  const [c, ctx] = makeCanvas(128, 64);
  ctx.fillStyle = '#d98c84'; ctx.fillRect(0, 0, 128, 64);
  const bands = [[0, 9, '#f3e6dc'], [20, 7, '#f0ddd2'], [38, 5, '#f5e9e0'], [55, 9, '#f3e6dc']];
  for (const [y, h, col] of bands) {
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(0, y);
    for (let x = 0; x <= 128; x += 8) ctx.lineTo(x, y + Math.sin(x * 0.11 + y) * 2);
    for (let x = 128; x >= 0; x -= 8) ctx.lineTo(x, y + h + Math.sin(x * 0.09 + y) * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(160,60,60,0.25)';
  for (let i = 0; i < 40; i++) ctx.fillRect(Math.random() * 128, Math.random() * 64, 6, 1);
  return toTexture(c, { wrap: false });
}

// Lit apartment window: warm room glow with blinds/curtain silhouettes
export function windowGlowTexture(seed = 61) {
  const w = 128, h = 160;
  const [c, ctx] = makeCanvas(w, h);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#fff2d8'); g.addColorStop(0.5, '#e8b878'); g.addColorStop(1, '#6a4428');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const r = rng(seed);
  // blinds on the top half
  ctx.fillStyle = 'rgba(60,40,25,0.35)';
  for (let y = 4; y < h * 0.45; y += 7) ctx.fillRect(0, y, w, 2);
  // curtains at the sides
  ctx.fillStyle = 'rgba(70,40,30,0.75)';
  ctx.fillRect(0, 0, 18 + r() * 10, h); ctx.fillRect(w - 20 - r() * 10, 0, 30, h);
  // a lamp shape / plant silhouette
  return toTexture(c, { wrap: false });
}
