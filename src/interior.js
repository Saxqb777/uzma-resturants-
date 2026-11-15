// Dining room shell, 30 booths for four, the tin-roof "street stalls", tables and lights.
// The cashier corner, kitchens, decor and people live in their own modules.
//
// Booth anatomy along z (one table, centre zc, pitch 2.3 m):
//   back panel (0.12) | back cushion (0.07) | seat (0.46) | gap 0.18 | table (0.76) | gap | seat | cushion | panel
// Seated people stand on the seat's front edge (zc ± 0.56) facing the table (see BOOTHS[].seats).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { box, plane, corrugatedGeometry, InstanceBatch, pointLight, spotLight, flaskGeometry, mergeStatic } from './helpers.js';
import * as T from './textures.js';
import { LAYOUT as L } from './config.js';
import { makeFoodKit } from './food.js';

const TBL = L.table;                 // len 1.4 (x), wid 0.76 (z), top 0.76, seat 0.48
const PITCH = L.dining.pitch;        // 2.3
const SEAT_FRONT = 0.56;             // seat front edge distance from the table centre line
const SEAT_DEPTH = 0.46;

// ------------------------------------------------------------------ booth records
// lane, table x, which end faces a wall/partition (+1 = +x side), which end faces an aisle
const LANE_TABLES = [
  { lane: 'wallL', x: L.lanes.wallL.x, inner: -1 },      // inner = wall / partition side
  { lane: 'isl1L', x: L.lanes.isl1.xL, inner: +1 },
  { lane: 'isl1R', x: L.lanes.isl1.xR, inner: -1 },
  { lane: 'isl2L', x: L.lanes.isl2.xL, inner: +1 },
  { lane: 'isl2R', x: L.lanes.isl2.xR, inner: -1 },
  { lane: 'wallR', x: L.lanes.wallR.x, inner: +1 },
];

export const BOOTHS = (() => {
  const out = [];
  for (let row = 0; row < L.dining.count; row++) {
    const z = L.dining.z0 - PITCH * (row + 0.5);
    for (const t of LANE_TABLES) {
      const seats = [];
      for (const s of [-1, 1]) for (const k of [-1, 1]) {
        seats.push({ x: t.x + k * 0.33, z: z + s * SEAT_FRONT, ry: s > 0 ? Math.PI : 0, side: s, slot: k });
      }
      out.push({ id: `${t.lane}-${row}`, lane: t.lane, row, x: t.x, z, inner: t.inner, seats });
    }
  }
  return out;
})();

// Tables with guests (people + food). Spread out so every view has life but it never feels packed.
export const OCCUPIED = new Set([
  'isl2L-0', 'isl1R-1', 'wallL-0', 'wallR-1', 'isl1L-0', 'isl2R-2', 'wallL-2', 'isl1R-3',
  'isl2L-3', 'wallR-3', 'isl1L-2', 'isl2R-0', 'wallL-4', 'isl2L-4', 'isl1R-4', 'wallR-4',
]);
export const HERO_TABLE = 'isl2L-0';      // the grill-table slide
export const PHOTO_TABLE = 'isl1R-1';     // the table that gets its polaroid taken

// ------------------------------------------------------------------ build
export function buildInterior(ctx) {
  const { scene, mats: M, roof, animators } = ctx;
  const g = new THREE.Group();
  g.name = 'interior';
  scene.add(g);
  const W = (k, fb) => M[k] || M[fb];            // new material keys fall back to older ones
  const rnd = T.rng(1207);
  const B = batches(M);
  const food = makeFoodKit(M);

  shell(g, M, W);
  ceiling(roof, M, B);
  booths(g, M, W);
  eaves(g, roof, M);
  tables(g, M, B, food, rnd);
  lights(g);

  animators.push((t) => {
    M.ember.emissiveIntensity = 2.0 + Math.sin(t * 7.3) * 0.18 + Math.sin(t * 13.1) * 0.12;
  });

  for (const b of Object.values(B)) b.build(g);
  mergeStatic(g);
  mergeStatic(roof);
  return g;
}

// ------------------------------------------------------------------ shared instanced props
function batches(M) {
  const cord = new THREE.CylinderGeometry(0.005, 0.005, 1, 5).translate(0, 0.5, 0);
  const grate = new THREE.MeshStandardMaterial({ map: T.grateTexture(), transparent: true, alphaTest: 0.4, metalness: 0.85, roughness: 0.42, color: '#6a6560' });
  return {
    cords: new InstanceBatch(cord, M.cord, { cast: false, receive: false }),
    sockets: new InstanceBatch(new THREE.CylinderGeometry(0.02, 0.026, 0.07, 10), M.blackSteel, { cast: false }),
    bulbs: new InstanceBatch(new THREE.SphereGeometry(0.055, 12, 8), M.bulb, { cast: false, receive: false }),
    grillRing: new InstanceBatch(new THREE.CylinderGeometry(0.205, 0.215, 0.03, 28, 1, true), M.grillIron, { cast: false }),
    grillLip: new InstanceBatch(new THREE.RingGeometry(0.175, 0.225, 32), M.grillIron, { cast: false }),
    ember: new InstanceBatch(new THREE.CircleGeometry(0.175, 24), M.ember, { cast: false }),
    coldGrill: new InstanceBatch(new THREE.CircleGeometry(0.175, 24), M.grillIron, { cast: false }),
    grate: new InstanceBatch(new THREE.CircleGeometry(0.195, 24), grate, { cast: false }),
    flasks: new InstanceBatch(flaskGeometry(), M.steel, { cast: true }),
    cups: new InstanceBatch(new THREE.CylinderGeometry(0.034, 0.028, 0.08, 12, 1, true), M.steel, { cast: false }),
    water: new InstanceBatch(new THREE.CircleGeometry(0.031, 12), new THREE.MeshStandardMaterial({ color: '#c9dce0', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.7 }), { cast: false }),
    sticks: new InstanceBatch(new THREE.BoxGeometry(0.21, 0.004, 0.005), M.steel, { cast: false }),
    spoons: new InstanceBatch(new THREE.BoxGeometry(0.17, 0.003, 0.012), M.steel, { cast: false }),
    napkins: new InstanceBatch(new THREE.BoxGeometry(0.12, 0.003, 0.24), new THREE.MeshStandardMaterial({ color: '#f2efe8', roughness: 0.95 }), { cast: false }),
    tissue: new InstanceBatch(new THREE.BoxGeometry(0.12, 0.08, 0.12), M.woodDark, { cast: false }),
    tongs: new InstanceBatch(new THREE.BoxGeometry(0.26, 0.008, 0.012), M.steel, { cast: false }),
    scissors: new InstanceBatch(new THREE.BoxGeometry(0.2, 0.006, 0.03), M.steel, { cast: false }),
    menuStand: new InstanceBatch(new THREE.BoxGeometry(0.11, 0.16, 0.012), new THREE.MeshStandardMaterial({ color: '#f4ecdf', roughness: 0.6 }), { cast: false }),
    trackHeads: new InstanceBatch(new THREE.CylinderGeometry(0.035, 0.045, 0.12, 10), M.blackSteel, { cast: false }),
    trackGlow: new InstanceBatch(new THREE.CircleGeometry(0.03, 10), M.bulbSoft, { cast: false, receive: false }),
  };
}

function addBulb(B, x, y, z, topY) {
  B.cords.add(x, y + 0.1, z, { sy: Math.max(0.05, topY - y - 0.1) });
  B.sockets.add(x, y + 0.085, z);
  B.bulbs.add(x, y, z, { sx: 1, sy: 1.3, sz: 1 });
}

// ------------------------------------------------------------------ shell
function shell(g, M, W) {
  const H = L.ceil, x0 = L.x0, x1 = L.x1, wt = L.wallT;
  const depth = -L.zBack;                              // 27
  // floors: dining + front zone (dark tile), kitchen (light anti-slip tile)
  const dz = -L.kitchenZ + 0.3;
  const dining = plane(g, M.floor, x1 - x0, dz, { uv: 1.2 });
  dining.rotation.x = -Math.PI / 2; dining.position.set(0, 0, 0.3 - dz / 2);
  const kd = L.kitchen.z0 - L.zBack;
  const kfloor = plane(g, W('kitchenFloor', 'kitchenTile'), x1 - x0, kd, { uv: 1.2 });
  kfloor.rotation.x = -Math.PI / 2; kfloor.position.set(0, 0.001, (L.kitchen.z0 + L.zBack) / 2);

  // side walls: plaster in the dining room, white tile in the kitchen
  const wallLen = -L.kitchen.z0;
  box(g, W('plasterWarm', 'plaster'), wt, H, wallLen, x0 - wt / 2, 0, -wallLen / 2, { cast: false, uv: 2 });
  box(g, W('plasterWarm', 'plaster'), wt, H, wallLen, x1 + wt / 2, 0, -wallLen / 2, { cast: false, uv: 2 });
  const kLen = L.kitchen.z0 - L.zBack;
  box(g, W('whiteTile', 'kitchenTile'), wt, H, kLen, x0 - wt / 2, 0, (L.kitchen.z0 + L.zBack) / 2, { cast: false, uv: 1 });
  box(g, W('whiteTile', 'kitchenTile'), wt, H, kLen, x1 + wt / 2, 0, (L.kitchen.z0 + L.zBack) / 2, { cast: false, uv: 1 });
  box(g, W('whiteTile', 'kitchenTile'), x1 - x0 + 2 * wt, H, wt, 0, 0, L.zBack - wt / 2, { cast: false, uv: 1 });

  // red glossy tile wainscot along the right dining wall (retro pocha look, her inspo)
  box(g, W('redTile', 'subway'), 0.03, 1.15, L.dining.z0 - (L.live.counterFront) + 2.6, x1 - 0.015, 0, (L.dining.z0 + L.live.counterFront) / 2 - 0.4, { cast: false, uv: 0.6 });
  box(g, M.woodDark, 0.06, 0.05, L.dining.z0 - L.live.counterFront + 2.6, x1 - 0.03, 1.15, (L.dining.z0 + L.live.counterFront) / 2 - 0.4, { cast: false });

  // wall between the live station and the main kitchen: pass window + two swing doors
  const wz = L.kitchenZ - 0.1;
  const wallM = [M.plasterGrey, M.plasterGrey, M.plasterGrey, M.plasterGrey, W('plasterWarm', 'plaster'), W('whiteTile', 'kitchenTile')];
  const seg = (a, b, y0, y1) => box(g, wallM, b - a, y1 - y0, 0.2, (a + b) / 2, y0, wz, { uv: 1.5, cast: false });
  const P = L.kitchen.pass, [dL, dR] = L.kitchen.doors, dw = 0.5;
  seg(x0, dL - dw, 0, H); seg(dL - dw, dL + dw, 2.2, H); seg(dL + dw, P.x0, 0, H);
  seg(P.x0, P.x1, 0, P.y0); seg(P.x0, P.x1, P.y1, H);
  seg(P.x1, dR - dw, 0, H); seg(dR - dw, dR + dw, 2.2, H); seg(dR + dw, x1, 0, H);
  // pass shelf (steel), heat lamp
  box(g, M.steelBrushed, P.x1 - P.x0 + 0.1, 0.05, 0.7, 0, P.y0, wz, { cast: false });
  const heat = new THREE.MeshStandardMaterial({ color: '#552010', emissive: '#ff6a2a', emissiveIntensity: 2.0 });
  box(g, M.blackSteel, P.x1 - P.x0, 0.06, 0.12, 0, P.y1 - 0.12, wz, { cast: false });
  box(g, heat, P.x1 - P.x0 - 0.1, 0.012, 0.06, 0, P.y1 - 0.132, wz, { cast: false });
  // swing doors with round windows
  const portMat = new THREE.MeshStandardMaterial({ color: '#cfe0ea', emissive: '#e8f2ff', emissiveIntensity: 0.5, roughness: 0.15 });
  for (const dx of [dL, dR]) {
    const d = box(g, M.steelBrushed, 0.96, 2.18, 0.05, dx, 0, wz, { cast: false });
    d.userData.keep = true;
    for (const s of [1, -1]) {
      const port = new THREE.Mesh(new THREE.CircleGeometry(0.15, 20), portMat);
      port.position.set(dx, 1.55, wz + s * 0.03); if (s < 0) port.rotation.y = Math.PI; g.add(port);
    }
    box(g, M.steel, 0.3, 0.02, 0.01, dx, 1.05, wz + 0.03, { cast: false });
  }
}

// ------------------------------------------------------------------ ceiling (hidden in the floor-plan view)
function ceiling(roof, M, B) {
  const depth = -L.zBack;
  const c = plane(roof, M.ceiling, L.x1 - L.x0, depth + 0.3, { receive: false });
  c.rotation.x = Math.PI / 2; c.position.set(0, L.ceil, -depth / 2 + 0.15);
  for (let z = -1.6; z > L.kitchenZ; z -= 3) box(roof, M.woodDark, L.x1 - L.x0, 0.24, 0.18, 0, L.ceil - 0.24, z, { cast: false });
  const duct = (r, x, y, z0, z1) => {
    const len = z0 - z1;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 24, 1, true), M.duct);
    m.rotation.x = Math.PI / 2; m.position.set(x, y, (z0 + z1) / 2);
    roof.add(m);
    for (let z = z0 - 0.6; z > z1; z -= 2.4) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r + 0.004, 0.012, 6, 24), M.duct);
      ring.position.set(x, y, z); roof.add(ring);
      box(roof, M.blackSteel, 0.02, L.ceil - y - r, 0.02, x, y + r, z, { cast: false });
    }
  };
  duct(0.26, -5.05, 3.65, -0.3, -20.6);
  duct(0.26, 5.05, 3.65, -0.3, -20.6);
  duct(0.16, 0, 3.86, -1.0, -20.4);
  for (const x of [-5.05, 5.05]) for (const z of [-4.2, -10.6, -16.8]) box(roof, M.duct, 0.36, 0.08, 0.36, x, 3.32, z, { cast: false });
  // track lights over the centre aisle
  for (const x of [-0.5, 0.5]) {
    box(roof, M.blackSteel, 0.05, 0.04, 19.5, x, L.ceil - 0.06, -10.6, { cast: false });
    for (let z = -1.2; z > -20.4; z -= 1.8) {
      const s = x > 0 ? 1 : -1;
      B.trackHeads.add(x, L.ceil - 0.16, z, { rx: 0.3 * s, rz: 0.35 * s });
      B.trackGlow.add(x + 0.02 * s, L.ceil - 0.225, z, { rx: Math.PI / 2 });
    }
  }
}

// ------------------------------------------------------------------ booths
const roundBoxCache = new Map();
function rbox(parent, mat, w, h, d, x, y, z, r = 0.03) {
  const key = `${w}|${h}|${d}|${r}`;
  if (!roundBoxCache.has(key)) roundBoxCache.set(key, new RoundedBoxGeometry(w, h, d, 3, r));
  const m = new THREE.Mesh(roundBoxCache.get(key), mat);
  m.position.set(x, y + h / 2, z);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}

function booths(g, M, W) {
  const cushionA = W('cushionTeal', 'fabricDark');
  const cushionB = W('cushionTerracotta', 'fabricDark');
  const zBacks = [];
  for (let i = 0; i <= L.dining.count; i++) zBacks.push(L.dining.z0 - i * PITCH);

  // high-back panels spanning each lane (wall lanes and the two islands)
  const spans = [
    [L.lanes.wallL.xa, L.lanes.wallL.xb], [L.lanes.isl1.xa, L.lanes.isl1.xb],
    [L.lanes.isl2.xa, L.lanes.isl2.xb], [L.lanes.wallR.xa, L.lanes.wallR.xb],
  ];
  for (const [xa, xb] of spans) {
    for (const bz of zBacks) {
      box(g, M.woodBooth, xb - xa, 1.3, 0.12, (xa + xb) / 2, 0, bz, { uv: 1 });
      box(g, M.woodDark, xb - xa + 0.04, 0.05, 0.18, (xa + xb) / 2, 1.3, bz);
    }
  }
  // island partitions: wood lower half, frosted glass, top rail
  for (const isl of [L.lanes.isl1, L.lanes.isl2]) {
    for (let r = 0; r < L.dining.count; r++) {
      const z = L.dining.z0 - PITCH * (r + 0.5), len = PITCH - 0.12;
      box(g, M.woodBooth, 0.1, 0.95, len, isl.part, 0, z, { uv: 1 });
      const glass = box(g, M.frosted, 0.03, 0.42, len, isl.part, 0.95, z, { cast: false, receive: false });
      glass.userData.keep = true;
      box(g, M.woodDark, 0.12, 0.05, len, isl.part, 1.37, z);
    }
  }

  // benches with cushions and armrests, one pair per table
  BOOTHS.forEach((b, i) => {
    const cushion = (b.row + i) % 3 === 0 ? cushionB : cushionA;
    const len = TBL.len;
    for (const s of [-1, 1]) {
      const zFront = b.z + s * SEAT_FRONT;            // seat front edge
      const zc = zFront + s * SEAT_DEPTH / 2;         // seat centre
      // wooden bench box + front kick panel
      box(g, M.woodBooth, len, 0.41, SEAT_DEPTH, b.x, 0, zc, { uv: 1 });
      box(g, M.woodDark, len, 0.08, 0.03, b.x, 0, zFront + s * 0.015, { cast: false });
      // seat cushion + back cushion (soft, rounded)
      rbox(g, cushion, len - 0.06, 0.075, SEAT_DEPTH - 0.02, b.x, 0.405, zc, 0.03);
      const backZ = b.z + s * (PITCH / 2 - 0.06 - 0.045);
      rbox(g, cushion, len - 0.08, 0.5, 0.09, b.x, 0.5, backZ, 0.035);
      // armrest on the aisle end (wood, rounded top)
      const ax = b.x - b.inner * (len / 2 - 0.035);
      box(g, M.woodBooth, 0.07, 0.3, SEAT_DEPTH + 0.06, ax, 0.41, zc - s * 0.01, { uv: 1 });
      rbox(g, M.woodDark, 0.1, 0.04, SEAT_DEPTH + 0.1, ax, 0.71, zc - s * 0.01, 0.015);
    }
  });
}

// ------------------------------------------------------------------ tin-roof stalls (their photos)
function tinSheet(parent, M, width, length, pivot, yaw, pitch, mat = M.tin) {
  const grp = new THREE.Group();
  grp.position.set(...pivot);
  grp.rotation.set(0, 0, pitch);
  const m = new THREE.Mesh(corrugatedGeometry(width, length, { uv: 1.2 }), mat);
  m.rotation.y = yaw;
  m.castShadow = true; m.receiveShadow = true;
  grp.add(m);
  parent.add(grp);
  return grp;
}

export const EAVE = { postZ: [-4.9, -9.6, -14.2, -16.6] };

function eaves(g, roof, M) {
  const zA = L.dining.z0 + 0.3, zB = L.dining.z0 - PITCH * L.dining.count - 0.2;
  const len = zA - zB, zm = (zA + zB) / 2;
  const rise = 0.32;
  // wall rows: posts at the aisle edge, tin sloping up to the wall
  for (const [side, edge, wallX, mat] of [[-1, L.lanes.wallL.xb + 0.12, L.x0, M.tin], [1, L.lanes.wallR.xa - 0.12, L.x1, M.tinLight]]) {
    for (const z of EAVE.postZ) box(g, M.woodDarkV, 0.15, 2.85, 0.15, edge, 0, z);
    box(g, M.woodDark, 0.16, 0.2, len, edge, 2.65, zm);
    box(g, M.woodDark, 0.1, 0.12, len, wallX - side * 0.05, 3.12, zm, { cast: false });
    const run = Math.abs(wallX - edge) + 0.2;
    tinSheet(roof, M, len + 0.2, run, [edge - side * 0.18, 2.88, zm], side < 0 ? Math.PI / 2 : -Math.PI / 2, side < 0 ? -Math.atan(rise / run) : Math.atan(rise / run), mat);
  }
  // islands: pitched tin roof on a wooden frame
  for (const isl of [L.lanes.isl1, L.lanes.isl2]) {
    const xa = isl.xa - 0.08, xb = isl.xb + 0.08, xm = isl.part;
    for (const z of [EAVE.postZ[0], EAVE.postZ[2], EAVE.postZ[3]]) {
      box(g, M.woodDarkV, 0.14, 2.9, 0.14, xa, 0, z);
      box(g, M.woodDarkV, 0.14, 2.9, 0.14, xb, 0, z);
      box(g, M.woodDark, xb - xa + 0.2, 0.14, 0.14, xm, 2.82, z);
      box(g, M.woodDarkV, 0.1, 0.45, 0.1, xm, 2.95, z, { cast: false });
    }
    box(g, M.woodDark, 0.14, 0.16, len, xa, 2.78, zm);
    box(g, M.woodDark, 0.14, 0.16, len, xb, 2.78, zm);
    box(g, M.woodDark, 0.12, 0.14, len + 0.1, xm, 3.32, zm, { cast: false });
    const half = (xb - xa) / 2 + 0.15, drop = Math.atan(0.42 / half);
    tinSheet(roof, M, len + 0.3, half, [xm, 3.42, zm], Math.PI / 2, drop);
    tinSheet(roof, M, len + 0.3, half, [xm, 3.42, zm], -Math.PI / 2, -drop);
  }
}

// ------------------------------------------------------------------ tables + settings
function tables(g, M, B, food, rnd) {
  const Y = TBL.top;
  for (const b of BOOTHS) {
    const { x, z } = b;
    // table: stainless top, black edge band, two legs with feet
    box(g, M.steel, TBL.len, 0.035, TBL.wid, x, Y - 0.035, z);
    box(g, M.blackSteel, TBL.len + 0.02, 0.05, TBL.wid + 0.02, x, Y - 0.08, z, { cast: false });
    for (const s of [-1, 1]) {
      box(g, M.blackSteel, 0.06, Y - 0.08, 0.06, x + s * 0.45, 0, z, { cast: false });
      box(g, M.blackSteel, 0.06, 0.03, TBL.wid - 0.12, x + s * 0.45, 0, z, { cast: false });
    }
    // round grill in the middle
    const busy = OCCUPIED.has(b.id);
    B.grillRing.add(x, Y + 0.012, z);
    B.grillLip.add(x, Y + 0.027, z, { rx: -Math.PI / 2 });
    (busy ? B.ember : B.coldGrill).add(x, Y + 0.004, z, { rx: -Math.PI / 2 });
    B.grate.add(x, Y + 0.024, z, { rx: -Math.PI / 2 });

    // things at the inner (wall/partition) end: flask, tissue box, menu stand
    const ex = x + b.inner * 0.56;
    B.flasks.add(ex, Y, z + 0.2);
    B.tissue.add(ex, Y, z - 0.05);
    B.menuStand.add(ex - b.inner * 0.02, Y + 0.08, z - 0.24, { ry: b.inner * Math.PI / 2, rx: 0.08 });

    // a place setting for each seat: napkin, chopsticks + spoon, cup of water
    for (const seat of b.seats) {
      const sx = seat.x, sz = z + seat.side * 0.26;
      B.napkins.add(sx + 0.05, Y + 0.002, sz, { ry: Math.PI / 2 });
      B.sticks.add(sx + 0.05, Y + 0.006, sz - 0.01, { ry: Math.PI / 2 });
      B.spoons.add(sx + 0.08, Y + 0.006, sz - 0.01, { ry: Math.PI / 2 });
      B.cups.add(sx - 0.12, Y + 0.04, z + seat.side * 0.22);
      B.water.add(sx - 0.12, Y + 0.065, z + seat.side * 0.22, { rx: -Math.PI / 2 });
    }

    if (busy) {
      // the meal deal: chicken on the grill, rice for everyone, kimchi, cucumber salad, sauce, lettuce
      food.grillPieces(g, x, Y + 0.024, z, rnd, b.id === HERO_TABLE ? 11 : 8);
      for (const seat of b.seats) food.rice(g, seat.x + 0.13, Y, z + seat.side * 0.24, rnd() * 6);
      food.banchan(g, 'kimchi', x - 0.36, Y, z - 0.08, rnd() * 6);
      food.banchan(g, 'cucumber', x + 0.36, Y, z + 0.08, rnd() * 6);
      food.sauce(g, x - 0.33, Y, z + 0.12);
      food.sauce(g, x + 0.33, Y, z - 0.12);
      food.lettuce(g, x - b.inner * 0.42, Y, z + 0.0, rnd() * 6);
      B.tongs.add(x + 0.05, Y + 0.004, z - 0.27, { ry: 0.12 });
      B.scissors.add(x - 0.05, Y + 0.004, z + 0.27, { ry: -0.2 });
    } else {
      // set table, closed rice bowls waiting
      if (rnd() < 0.5) for (const s of [-1, 1]) food.riceClosed(g, x - 0.05, Y, z + s * 0.27);
    }

    // bare warm bulb over every table
    const top = b.lane.startsWith('isl') ? 3.05 : 3.0;
    addBulb(B, x, 2.08, z, top);
  }
}

// ------------------------------------------------------------------ lights
function lights(g) {
  const warm = '#ffb877', warm2 = '#ffc690';
  // dining room: two rows of lights over each lane pair
  for (const x of [-5.6, -2.5, 2.5, 5.6]) for (const z of [-7.2, -14.0]) pointLight(g, warm, 9, 9.5, x, 2.35, z);
  // front zone
  pointLight(g, warm2, 7, 8, -5.2, 2.6, -2.4);     // photo spot
  pointLight(g, warm2, 6, 8, 0, 2.9, -1.8);        // entrance
  pointLight(g, '#ffd8c0', 7, 8, 5.2, 2.6, -2.4);  // cashier
  // centre aisle, front and back (these two cast the static shadows)
  spotLight(g, '#ffd6a8', 30, 14, [0, 4.1, -5.5], [0, 0, -8.5], { angle: 0.8, penumbra: 0.85, shadow: true });
  spotLight(g, '#ffd6a8', 26, 14, [0, 4.1, -12.5], [0, 0, -15], { angle: 0.8, penumbra: 0.85, shadow: true });
}
