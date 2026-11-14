// The dining room, bar and kitchen.
// Look & feel from her reference pics 1 + 2: dark open ceiling, wooden high-back booths,
// little rusty tin roofs over the booth rows, yellow-framed windows, soju bottle shelves,
// hand-painted retro signs and bare warm bulbs over every grill table.
import * as THREE from 'three';
import {
  box, plane, corrugatedGeometry, InstanceBatch, pointLight, spotLight,
  bottleGeometry, flaskGeometry, bowlGeometry, mergeStatic,
} from './helpers.js';
import * as T from './textures.js';
import { signMaterial } from './materials.js';

const PITCH = 2.0;       // booth spacing along the room
const TL = 1.3;          // table length (across the room)
const TW = 0.72;         // table width
const TABLE_Y = 0.76;    // table top height

const range = (start, n, step = -PITCH) => Array.from({ length: n }, (_, i) => start + i * step);

// Booth rows. x = table center, zs = table centers, wall = which end of the table faces a wall/partition
const ROWS = {
  left:    { x: -4.3,  zs: range(-1.5, 7), wall: -1, backX: [-5.0, -3.65] },
  islandL: { x: -1.95, zs: range(-3.6, 5), wall: +1, backX: [-2.6, 0.15] },
  islandR: { x: -0.5,  zs: range(-3.6, 5), wall: -1, backX: null },
  right:   { x: 4.3,   zs: range(-7.2, 4), wall: +1, backX: [3.65, 5.0] },
};

export function buildInterior(ctx) {
  const { scene, mats: M, roof, animators, layout: L, R, F } = ctx;
  const g = new THREE.Group();
  g.name = 'interior';
  scene.add(g);

  const rnd = T.rng(2024);
  const B = makeBatches(M);

  buildShell(g, M, L);
  buildCeiling(roof, M, L, B);
  buildLeftWall(g, M, B);
  buildBooths(g, M, B, rnd);
  buildEaves(g, M, roof);
  buildBar(g, M, B, R, F);
  buildKitchen(g, M, L, B, F, animators, roof);
  buildSigns(g, M, R, F);
  buildDecor(g, M, B, F);
  buildLights(g, M);

  // flickering charcoal under the grills
  animators.push((t) => {
    M.ember.emissiveIntensity = 2.1 + Math.sin(t * 7.3) * 0.18 + Math.sin(t * 13.1) * 0.12;
  });

  for (const b of Object.values(B)) b.build(g);
  mergeStatic(g);
  mergeStatic(roof);
  return g;
}

// ---------------------------------------------------------------- batches
function makeBatches(M) {
  const cord = new THREE.CylinderGeometry(0.005, 0.005, 1, 5).translate(0, 0.5, 0);
  const grate = new THREE.MeshStandardMaterial({ map: T.grateTexture(), transparent: true, alphaTest: 0.4, metalness: 0.85, roughness: 0.42, color: '#6a6560' });
  const food = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.55 });
  const meat = new THREE.MeshStandardMaterial({ map: T.meatTexture(), color: '#ffffff', roughness: 0.45 });
  return {
    cords: new InstanceBatch(cord, M.cord, { cast: false, receive: false }),
    sockets: new InstanceBatch(new THREE.CylinderGeometry(0.02, 0.026, 0.07, 10), M.blackSteel, { cast: false }),
    bulbs: new InstanceBatch(new THREE.SphereGeometry(0.055, 16, 12), M.bulb, { cast: false, receive: false }),
    grillRing: new InstanceBatch(new THREE.CylinderGeometry(0.205, 0.215, 0.03, 28, 1, true), M.grillIron, { cast: false }),
    grillLip: new InstanceBatch(new THREE.RingGeometry(0.175, 0.225, 32), M.grillIron, { cast: false }),
    ember: new InstanceBatch(new THREE.CircleGeometry(0.175, 24), M.ember, { cast: false }),
    coldGrill: new InstanceBatch(new THREE.CircleGeometry(0.175, 24), M.grillIron, { cast: false }),
    grate: new InstanceBatch(new THREE.CircleGeometry(0.195, 24), grate, { cast: false }),
    meat: new InstanceBatch(new THREE.BoxGeometry(0.1, 0.008, 0.045), meat, { cast: false }),
    bowls: new InstanceBatch(bowlGeometry(), M.steelBrushed, { cast: false }),
    food: new InstanceBatch(new THREE.SphereGeometry(0.043, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.55, 1), food, { cast: false }),
    tongs: new InstanceBatch(new THREE.BoxGeometry(0.26, 0.008, 0.012), M.steel, { cast: false }),
    rice: new InstanceBatch(new THREE.CylinderGeometry(0.048, 0.038, 0.055, 16), M.steelBrushed, { cast: false }),
    riceLid: new InstanceBatch(new THREE.CylinderGeometry(0.05, 0.05, 0.008, 16), M.steel, { cast: false }),
    soju: new InstanceBatch(bottleGeometry(), M.bottleGreen, { cast: false }),
    beer: new InstanceBatch(bottleGeometry().scale(1.05, 1.15, 1.05), M.bottleBrown, { cast: false }),
    caps: new InstanceBatch(new THREE.CylinderGeometry(0.0145, 0.0145, 0.012, 10), M.bottleCap, { cast: false, receive: false }),
    cups: new InstanceBatch(new THREE.CylinderGeometry(0.032, 0.026, 0.065, 14, 1, true), M.steel, { cast: false }),
    flasks: new InstanceBatch(flaskGeometry(), M.steel, { cast: true }),
    sticks: new InstanceBatch(new THREE.BoxGeometry(0.21, 0.004, 0.005), M.steel, { cast: false }),
    boards: new InstanceBatch(new THREE.BoxGeometry(0.32, 0.022, 0.2), M.woodBooth, { cast: false }),
    trackHeads: new InstanceBatch(new THREE.CylinderGeometry(0.035, 0.045, 0.12, 10), M.blackSteel, { cast: false }),
    trackGlow: new InstanceBatch(new THREE.CircleGeometry(0.03, 10), M.bulbSoft, { cast: false, receive: false }),
  };
}

function addBulb(B, x, y, z, topY) {
  B.cords.add(x, y + 0.1, z, { sy: Math.max(0.05, topY - y - 0.1) });
  B.sockets.add(x, y + 0.085, z);
  B.bulbs.add(x, y, z, { sx: 1, sy: 1.3, sz: 1 });
}

// ---------------------------------------------------------------- shell
function buildShell(g, M, L) {
  const H = L.ceil;
  // floors
  const dining = plane(g, M.floor, 10, 15.3, { uv: 1.2 });
  dining.rotation.x = -Math.PI / 2; dining.position.set(0, 0, -15.3 / 2 + 0.3);
  const kfloor = plane(g, M.kitchenTile, 10, 3, { uv: 1.2 });
  kfloor.rotation.x = -Math.PI / 2; kfloor.position.set(0, 0.001, -16.5);

  // side + back walls
  box(g, M.plaster, 0.3, H, 18, -5.15, 0, -9, { cast: false, uv: 2 });
  box(g, M.plasterGrey, 0.3, H, 18, 5.15, 0, -9, { cast: false, uv: 2 });
  box(g, M.kitchenTile, 10.6, H, 0.3, 0, 0, -18.15, { cast: false, uv: 1.2 });
  // white tile wainscot on the right wall (pic 1)
  box(g, M.subway, 0.04, 1.25, 15, 4.98, 0, -7.5, { cast: false, uv: 0.6 });
  box(g, M.woodDark, 0.07, 0.06, 15, 4.965, 1.25, -7.5, { cast: false });

  // wall between dining room and kitchen, with the pass window and a kitchen door
  const kz = L.kitchenZ - 0.1;
  const wallM = [M.plasterGrey, M.plasterGrey, M.plasterGrey, M.plasterGrey, M.plasterGrey, M.kitchenTile];
  const seg = (x0, x1, y0, y1) => box(g, wallM, x1 - x0, y1 - y0, 0.2, (x0 + x1) / 2, y0, kz, { uv: 1.5, cast: false });
  seg(-5, -3.2, 0, H); seg(-3.2, 1.8, 0, 1.0); seg(-3.2, 1.8, 2.25, H);
  seg(1.8, 2.8, 0, H); seg(2.8, 3.8, 2.2, H); seg(3.8, 5, 0, H);
  // wood trim around the pass (dining side)
  box(g, M.woodDark, 5.2, 0.12, 0.08, -0.7, 2.25, kz + 0.13);
  box(g, M.woodDarkV, 0.12, 1.37, 0.08, -3.26, 1.0, kz + 0.13);
  box(g, M.woodDarkV, 0.12, 1.37, 0.08, 1.86, 1.0, kz + 0.13);
  // pass counter: steel shelf through the wall
  box(g, M.steelBrushed, 5.0, 0.05, 0.75, -0.7, 1.0, kz, { cast: false });
  // heat lamp bar over the pass (orange glow)
  box(g, M.blackSteel, 4.6, 0.06, 0.12, -0.7, 2.08, kz - 0.05, { cast: false });
  const heat = new THREE.MeshStandardMaterial({ color: '#552010', emissive: '#ff6a2a', emissiveIntensity: 2.4 });
  box(g, heat, 4.4, 0.012, 0.06, -0.7, 2.068, kz - 0.05, { cast: false });
  // kitchen swing door with a round window
  const door = box(g, M.steelBrushed, 0.98, 2.18, 0.05, 3.3, 0, kz, { cast: false });
  door.userData.keep = true;
  const portMat = new THREE.MeshStandardMaterial({ color: '#8fa0a8', emissive: '#cfe0ea', emissiveIntensity: 0.25, roughness: 0.2 });
  const port = new THREE.Mesh(new THREE.CircleGeometry(0.15, 20), portMat);
  port.position.set(3.3, 1.55, kz + 0.03); g.add(port);
  const port2 = port.clone(); port2.position.z = kz - 0.03; port2.rotation.y = Math.PI; g.add(port2);

  // door mat at the entrance + small waiting bench under the side window
  box(g, M.fabricDark, 1.3, 0.012, 0.9, 1.6, 0, -0.7, { cast: false });
  box(g, M.woodBooth, 1.5, 0.08, 0.42, 3.7, 0.4, -0.35);
  box(g, M.woodDark, 1.5, 0.4, 0.06, 3.7, 0, -0.5);
}

// ---------------------------------------------------------------- ceiling (hidden in the cutaway)
function buildCeiling(roof, M, L, B) {
  const c = plane(roof, M.ceiling, 10, 18.3, { receive: false });
  c.rotation.x = Math.PI / 2; c.position.set(0, L.ceil, -9 + 0.15);
  // exposed dark wood beams across the room
  for (let z = -1.6; z > -15; z -= 3) box(roof, M.woodDark, 10, 0.24, 0.18, 0, L.ceil - 0.24, z, { cast: false });
  // big silver duct over the main aisle, a smaller one over the island
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
  duct(0.26, 1.75, 3.62, -0.2, -15);
  duct(0.15, -2.15, 3.82, -0.6, -14.6);
  // diffusers on the big duct
  for (const z of [-3.4, -8.2, -12.6]) box(roof, M.duct, 0.36, 0.08, 0.36, 1.75, 3.3, z, { cast: false });
  // track light rails with little spot heads
  for (const x of [0.55, 2.85]) {
    box(roof, M.blackSteel, 0.05, 0.04, 14.4, x, L.ceil - 0.06, -7.6, { cast: false });
    for (let z = -0.9; z > -14.5; z -= 1.6) {
      B.trackHeads.add(x, L.ceil - 0.16, z, { rx: 0.35 * (x > 2 ? 1 : -1), rz: 0.25 * (x > 2 ? 1 : -1) });
      B.trackGlow.add(x + (x > 2 ? 0.015 : -0.015), L.ceil - 0.225, z, { rx: Math.PI / 2 });
    }
  }
}

// ---------------------------------------------------------------- left wall: yellow windows + soju shelf (pic 1)
function buildLeftWall(g, M, B) {
  const wx = -5.0;
  for (const z of ROWS.left.zs) {
    const w = 0.95, h = 0.95, y0 = 1.3;
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(w, h), M.frostedGlow);
    glow.rotation.y = Math.PI / 2; glow.position.set(wx + 0.012, y0 + h / 2, z); g.add(glow);
    const fr = (dy, hh, dz, ww) => box(g, M.yellowFrame, 0.06, hh, ww, wx + 0.03, y0 + dy, z + dz, { cast: false });
    fr(-0.05, 0.07, 0, w + 0.1); fr(h - 0.02, 0.07, 0, w + 0.1);
    fr(-0.05, h + 0.1, -w / 2 - 0.02, 0.07); fr(-0.05, h + 0.1, w / 2 + 0.02, 0.07);
    fr(0, h, 0, 0.04); fr(h / 2 - 0.02, 0.04, 0, w);
    box(g, M.woodDark, 0.16, 0.04, w + 0.2, wx + 0.08, y0 - 0.09, z, { cast: false }); // sill
  }
  // soju bottle shelf running along the wall
  const z0 = -0.15, z1 = -14.5;
  box(g, M.woodDark, 0.2, 0.04, z0 - z1, wx + 0.1, 2.42, (z0 + z1) / 2, { cast: false });
  box(g, M.woodDark, 0.2, 0.04, z0 - z1, wx + 0.1, 2.94, (z0 + z1) / 2, { cast: false });
  for (let z = z0 - 0.06; z > z1 + 0.04; z -= 0.078) {
    B.soju.add(wx + 0.1, 2.46, z, { ry: z * 13 });
    B.caps.add(wx + 0.1, 2.46 + 0.248, z);
  }
}

// ---------------------------------------------------------------- booths + tables
function buildBooths(g, M, B, rnd) {
  // high-back panels between booths (shared by back-to-back seats)
  for (const key of ['left', 'islandL', 'right']) {
    const row = ROWS[key];
    const [xa, xb] = row.backX;
    const len = xb - xa, cx = (xa + xb) / 2;
    const backs = [row.zs[0] + PITCH / 2, ...row.zs.map((z) => z - PITCH / 2)];
    for (const bz of backs) {
      box(g, M.woodBooth, len, 1.25, 0.12, cx, 0, bz, { uv: 1 });
      box(g, M.woodDark, len + 0.03, 0.05, 0.17, cx, 1.25, bz);
    }
  }
  // island partition: low wood wall with frosted glass on top (pic 2)
  for (const z of ROWS.islandL.zs) {
    const len = PITCH - 0.12;
    box(g, M.woodBooth, 0.1, 0.92, len, -1.225, 0, z, { uv: 1 });
    const glass = box(g, M.frosted, 0.03, 0.5, len, -1.225, 0.92, z, { cast: false, receive: false });
    glass.userData.keep = true;
    box(g, M.woodDark, 0.12, 0.05, len, -1.225, 1.42, z);
  }

  for (const key of Object.keys(ROWS)) {
    const row = ROWS[key];
    for (const z of row.zs) {
      table(g, M, B, row.x, z, row.wall, rnd, key, key === 'islandR' && Math.abs(z + 5.6) < 0.01);
      for (const s of [-1, 1]) {
        const sz = z + s * 0.715;
        box(g, M.woodBooth, TL, 0.08, 0.45, row.x, 0.38, sz);                 // seat
        box(g, M.woodDark, TL, 0.38, 0.04, row.x, 0, z + s * 0.51, { cast: false }); // seat front
      }
    }
  }
}

function table(g, M, B, x, z, wall, rnd, key, hero = false) {
  box(g, M.steel, TL, 0.035, TW, x, TABLE_Y - 0.035, z, { cast: true });
  box(g, M.blackSteel, TL + 0.02, 0.05, TW + 0.02, x, TABLE_Y - 0.08, z, { cast: false });
  for (const s of [-1, 1]) {
    box(g, M.blackSteel, 0.06, TABLE_Y - 0.08, 0.06, x + s * 0.42, 0, z, { cast: false });
    box(g, M.blackSteel, 0.06, 0.03, TW - 0.1, x + s * 0.42, 0, z, { cast: false });
  }
  // round grill in the middle of the table
  const lit = hero || rnd() < 0.45;
  B.grillRing.add(x, TABLE_Y + 0.012, z);
  B.grillLip.add(x, TABLE_Y + 0.027, z, { rx: -Math.PI / 2 });
  (lit ? B.ember : B.coldGrill).add(x, TABLE_Y + 0.004, z, { rx: -Math.PI / 2 });
  B.grate.add(x, TABLE_Y + 0.024, z, { rx: -Math.PI / 2 });
  if (lit) {
    const n = hero ? 7 : 3 + Math.floor(rnd() * 4);
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2, r = rnd() * 0.12;
      const cooked = rnd();
      B.meat.add(x + Math.cos(a) * r, TABLE_Y + 0.032, z + Math.sin(a) * r, {
        ry: rnd() * Math.PI, rz: (rnd() - 0.5) * 0.08,
        color: cooked < 0.4 ? '#ffffff' : cooked < 0.75 ? '#d09070' : '#9a6044',
      });
    }
  }
  // side dishes (banchan) around the grill
  const spots = [[-0.42, 0.21], [-0.3, -0.22], [0.31, 0.22], [0.44, -0.2], [-0.5, -0.02], [0.52, 0.03]];
  const colors = ['#b8442a', '#4f7d2c', '#d8b04a', '#e9e2cf', '#8a3a24', '#6d8f3a'];
  const nb = hero ? 6 : 3 + Math.floor(rnd() * 4);
  for (let i = 0; i < nb; i++) {
    const [dx, dz] = spots[i];
    B.bowls.add(x + dx, TABLE_Y, z + dz);
    B.food.add(x + dx, TABLE_Y + 0.008, z + dz, { color: colors[Math.floor(rnd() * colors.length)] });
  }
  // a raw-meat board on some tables
  if (hero || rnd() < 0.35) {
    const bx = x - wall * 0.36, bz = z + (rnd() < 0.5 ? -0.17 : 0.17);
    B.boards.add(bx, TABLE_Y + 0.011, bz);
    for (let i = 0; i < 4; i++) B.meat.add(bx - 0.1 + i * 0.065, TABLE_Y + 0.027, bz, { ry: Math.PI / 2 + (rnd() - 0.5) * 0.3, color: '#ffffff' });
  }
  // tongs beside the grill, steel rice bowls with lids
  B.tongs.add(x + 0.05, TABLE_Y + 0.004, z - 0.25, { ry: 0.12 });
  B.tongs.add(x + 0.05, TABLE_Y + 0.012, z - 0.243, { ry: 0.16 });
  if (rnd() < 0.7) for (const s of [-1, 1]) {
    B.rice.add(x - 0.05, TABLE_Y + 0.0275, z + s * 0.29);
    B.riceLid.add(x - 0.05, TABLE_Y + 0.059, z + s * 0.29);
  }
  // drinks at the wall end
  const ex = x + wall * 0.53;
  B.flasks.add(ex, TABLE_Y, z + 0.2);
  if (rnd() < 0.8) {
    const nBottles = 1 + Math.floor(rnd() * 2);
    for (let i = 0; i < nBottles; i++) {
      const bz = z - 0.08 - i * 0.09;
      (i === 1 && rnd() < 0.5 ? B.beer : B.soju).add(ex + (rnd() - 0.5) * 0.04, TABLE_Y, bz, { ry: rnd() * 6 });
    }
  }
  // cups + chopsticks at each seat
  for (const s of [-1, 1]) {
    for (const dx of [-0.28, 0.22]) {
      if (rnd() < 0.2) continue;
      B.cups.add(x + dx, TABLE_Y + 0.0325, z + s * 0.27);
      B.sticks.add(x + dx + 0.08, TABLE_Y + 0.003, z + s * 0.3, { ry: 0.04 });
      B.sticks.add(x + dx + 0.08, TABLE_Y + 0.003, z + s * 0.31, { ry: 0.02 });
    }
  }
  // bare warm bulb over every table
  const top = key === 'islandL' || key === 'islandR' ? 2.95 : key === 'left' ? 3.0 : 3.0;
  addBulb(B, x, 2.05, z, top);
}

// ---------------------------------------------------------------- the little tin roofs (pic 1 + 2)
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

function buildEaves(g, M, roof) {
  // left row: posts + beam at the aisle edge, tin sloping up to the wall
  const leftPosts = [-0.4, -4.5, -8.5, -12.5, -14.6];
  for (const z of leftPosts) box(g, M.woodDarkV, 0.15, 2.85, 0.15, -3.3, 0, z);
  box(g, M.woodDark, 0.16, 0.2, 14.5, -3.3, 2.65, -7.5);
  box(g, M.woodDark, 0.1, 0.12, 14.5, -4.95, 3.12, -7.5, { cast: false });
  tinSheet(roof, M, 14.7, 1.95, [-3.12, 2.88, -7.5], Math.PI / 2, -Math.atan(0.32 / 1.95));

  // right row: same, mirrored
  const rightPosts = [-6.2, -10.2, -14.2];
  for (const z of rightPosts) box(g, M.woodDarkV, 0.15, 2.85, 0.15, 3.3, 0, z);
  box(g, M.woodDark, 0.16, 0.2, 8.4, 3.3, 2.65, -10.2);
  box(g, M.woodDark, 0.1, 0.12, 8.4, 4.95, 3.12, -10.2, { cast: false });
  tinSheet(roof, M, 8.6, 1.95, [3.12, 2.88, -10.2], -Math.PI / 2, Math.atan(0.32 / 1.95), M.tinLight);

  // bar eave
  for (const z of [-1.2, -5.3]) box(g, M.woodDarkV, 0.15, 2.85, 0.15, 3.3, 0, z);
  box(g, M.woodDark, 0.16, 0.2, 4.4, 3.3, 2.65, -3.25);
  tinSheet(roof, M, 4.6, 1.95, [3.12, 2.88, -3.25], -Math.PI / 2, Math.atan(0.32 / 1.95));

  // island: a pitched tin roof on a wooden frame
  const xa = -2.68, xb = 0.23, xm = -1.225;
  for (const z of [-2.6, -7.6, -12.6]) {
    box(g, M.woodDarkV, 0.14, 2.9, 0.14, xa, 0, z);
    box(g, M.woodDarkV, 0.14, 2.9, 0.14, xb, 0, z);
    box(g, M.woodDark, xb - xa + 0.2, 0.14, 0.14, xm, 2.82, z);              // tie beam
    box(g, M.woodDarkV, 0.1, 0.45, 0.1, xm, 2.95, z, { cast: false });        // king post
  }
  box(g, M.woodDark, 0.14, 0.16, 10.3, xa, 2.78, -7.6);
  box(g, M.woodDark, 0.14, 0.16, 10.3, xb, 2.78, -7.6);
  box(g, M.woodDark, 0.12, 0.14, 10.4, xm, 3.32, -7.6, { cast: false });       // ridge
  const half = 1.62, drop = Math.atan(0.42 / half);
  tinSheet(roof, M, 10.6, half, [xm, 3.46, -7.6], Math.PI / 2, drop);
  tinSheet(roof, M, 10.6, half, [xm, 3.46, -7.6], -Math.PI / 2, -drop);
}

// ---------------------------------------------------------------- bar + counter
function buildBar(g, M, B, R, F) {
  // counter facing the aisle
  box(g, M.woodBooth, 0.14, 1.0, 3.6, 3.28, 0, -3.3, { uv: 1 });
  box(g, M.woodDark, 0.62, 0.05, 3.7, 3.5, 1.0, -3.3);
  box(g, M.steelBrushed, 0.4, 0.03, 3.5, 3.62, 0.86, -3.3, { cast: false });   // staff-side shelf
  // back bar cabinet + shelves of bottles
  box(g, M.woodDark, 0.6, 0.9, 3.0, 4.68, 0, -3.85);
  box(g, M.steelBrushed, 0.62, 0.03, 3.0, 4.68, 0.9, -3.85, { cast: false });
  for (const y of [1.5, 1.92]) {
    box(g, M.woodDark, 0.24, 0.035, 3.0, 4.86, y, -3.85, { cast: false });
    for (let z = -2.45; z > -5.3; z -= 0.085) {
      const brown = Math.sin(z * 37 + y) > 0.55;
      (brown ? B.beer : B.soju).add(4.86, y + 0.035, z, { ry: z * 9 });
      if (!brown) B.caps.add(4.86, y + 0.035 + 0.248, z);
    }
  }
  // tall drinks fridge with a lit glass door
  // hollow steel body (open at the front), cool-lit back panel, glass door
  box(g, M.steelBrushed, 0.68, 0.16, 0.95, 4.64, 0, -1.75);
  box(g, M.steelBrushed, 0.68, 0.14, 0.95, 4.64, 1.86, -1.75);
  box(g, M.steelBrushed, 0.68, 1.7, 0.06, 4.64, 0.16, -1.305);
  box(g, M.steelBrushed, 0.68, 1.7, 0.06, 4.64, 0.16, -2.195);
  const inside = new THREE.MeshStandardMaterial({ color: '#9fb6cc', emissive: '#8fb6e0', emissiveIntensity: 0.3 });
  box(g, inside, 0.03, 1.7, 0.85, 4.96, 0.16, -1.75, { cast: false });
  const fl = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#e6f2ff', emissiveIntensity: 1.2 });
  box(g, fl, 0.5, 0.02, 0.04, 4.62, 1.83, -1.75, { cast: false, receive: false });
  const fglass = box(g, M.glass, 0.02, 1.76, 0.86, 4.28, 0.15, -1.75, { cast: false, receive: false });
  fglass.userData.keep = true;
  for (const y of [0.3, 0.72, 1.14, 1.56]) {
    box(g, M.steel, 0.5, 0.015, 0.8, 4.6, y, -1.75, { cast: false });
    for (let z = -1.42; z > -2.1; z -= 0.075) {
      const brown = y > 1.0;
      (brown ? B.beer : B.soju).add(4.42 + (y > 0.6 ? 0.08 : 0), y + 0.015, z);
    }
  }
  // till + tablet on the counter
  box(g, M.blackSteel, 0.28, 0.12, 0.34, 3.55, 1.05, -2.3);
  const posTex = T.signTexture({
    w: 256, h: 200, bg: '#0f1d26', border: null, aged: 0,
    draw: (c, w, h) => {
      c.fillStyle = '#1c3442'; c.fillRect(0, 0, w, 26);
      const cols = ['#e4574a', '#f2c14e', '#4fb3a9', '#7aa6e8'];
      for (let i = 0; i < 12; i++) { c.fillStyle = cols[i % 4]; c.fillRect(10 + (i % 4) * 46, 36 + Math.floor(i / 4) * 40, 40, 32); }
      c.fillStyle = '#e9f3f8'; c.fillRect(196, 36, 50, 150);
      c.fillStyle = '#4fb3a9'; c.fillRect(10, 160, 178, 28);
    },
  });
  const screen = new THREE.MeshStandardMaterial({ map: posTex, emissive: '#ffffff', emissiveMap: posTex, emissiveIntensity: 0.7 });
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.2), screen);
  scr.position.set(3.44, 1.24, -2.3); scr.rotation.set(0, -Math.PI / 2, 0); scr.rotateX(-0.35); scr.userData.keep = true; g.add(scr);
  box(g, M.blackSteel, 0.03, 0.22, 0.3, 3.46, 1.13, -2.3, { cast: false }).rotation.z = 0.35;
  // stools
  const seat = new THREE.CylinderGeometry(0.18, 0.18, 0.05, 20);
  const leg = new THREE.CylinderGeometry(0.025, 0.035, 0.7, 8);
  const ring = new THREE.TorusGeometry(0.14, 0.012, 6, 20);
  for (const z of [-2.5, -3.5, -4.5]) {
    const s = new THREE.Mesh(seat, M.woodBooth); s.position.set(2.85, 0.74, z); s.castShadow = true; g.add(s);
    const l = new THREE.Mesh(leg, M.blackSteel); l.position.set(2.85, 0.37, z); g.add(l);
    const r = new THREE.Mesh(ring, M.blackSteel); r.rotation.x = Math.PI / 2; r.position.set(2.85, 0.28, z); g.add(r);
  }
  // neon name sign on the wall behind the bar
  T.registerFontText(F.display, R.nameKo + R.nameEn);
  const neon = T.sign({
    w: 1024, h: 384, bg: '#120d0b', border: '#2a1a12', borderW: 10, aged: 0.15, seed: 77,
    lines: [], fonts: [{ font: F.display, text: R.nameKo }, { font: F.retro, text: `${R.nameEn} ${R.kind}`.toUpperCase() }],
    draw: (ctx, w, h) => {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = '#ff3d5a'; ctx.shadowBlur = 28;
      ctx.fillStyle = '#ffd3da'; ctx.font = `190px ${F.display}`;
      ctx.fillText(R.nameKo, w / 2, h * 0.43);
      ctx.shadowColor = '#4fe0d2'; ctx.fillStyle = '#d9fffb'; ctx.font = `64px ${F.retro}`;
      ctx.letterSpacing = '18px';
      ctx.fillText(`${R.nameEn} · ${R.kind}`.toUpperCase(), w / 2, h * 0.82);
      ctx.shadowBlur = 0;
    },
  });
  const nm = signMaterial(neon, { glow: 1.6 });
  const n = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.71), nm);
  n.rotation.y = -Math.PI / 2; n.position.set(4.96, 2.48, -3.85); n.userData.keep = true; g.add(n);
}

// ---------------------------------------------------------------- kitchen
function buildKitchen(g, M, L, B, F, animators, roof) {
  const kz = L.kitchenZ - 0.2;
  // back counter + upper shelf
  box(g, M.steelBrushed, 9.4, 0.9, 0.7, 0, 0, -17.6);
  box(g, M.steel, 9.4, 0.04, 0.72, 0, 0.9, -17.6, { cast: false });
  box(g, M.steelBrushed, 6, 0.04, 0.35, 1.5, 1.75, -17.82, { cast: false });
  // range with blue flames under big pots
  box(g, M.blackSteel, 2.4, 0.06, 0.66, -2.8, 0.94, -17.6, { cast: false });
  const flame = new THREE.MeshStandardMaterial({ color: '#0a1530', emissive: '#4a8cff', emissiveIntensity: 2.6 });
  const pot = new THREE.CylinderGeometry(0.2, 0.18, 0.32, 20, 1, true);
  const potLid = new THREE.CircleGeometry(0.2, 20);
  for (const x of [-3.5, -2.8, -2.1]) {
    const f = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 6, 18), flame);
    f.rotation.x = Math.PI / 2; f.position.set(x, 1.01, -17.6); g.add(f);
    const p = new THREE.Mesh(pot, M.steelBrushed); p.position.set(x, 1.18, -17.6); p.castShadow = true; g.add(p);
    const lid = new THREE.Mesh(potLid, M.steel); lid.rotation.x = -Math.PI / 2; lid.position.set(x, 1.34, -17.6); g.add(lid);
  }
  animators.push((t) => { flame.emissiveIntensity = 2.4 + Math.sin(t * 21) * 0.25 + Math.sin(t * 9) * 0.2; });
  // the big stainless hood (pic 2)
  box(g, M.steelBrushed, 3.2, 0.55, 1.1, -2.8, 2.4, -17.5);
  box(g, M.steelBrushed, 0.8, 1.25, 0.6, -2.8, 2.95, -17.7, { cast: false });
  // prep table in the middle
  box(g, M.steel, 3.4, 0.04, 0.7, -0.4, 0.88, -16.35);
  for (const x of [-2, 1.2]) for (const z of [-16.05, -16.65]) box(g, M.steelBrushed, 0.04, 0.88, 0.04, x, 0, z, { cast: false });
  box(g, M.steelBrushed, 3.3, 0.02, 0.6, -0.4, 0.2, -16.35, { cast: false });
  // stacks of bowls on the shelves
  for (let x = -0.9; x < 4.2; x += 0.22) for (let k = 0; k < 4; k++) B.bowls.add(x, 1.79 + k * 0.02, -17.82, { s: 1.3 });
  for (let x = -1.6; x < 0.8; x += 0.3) B.bowls.add(x, 0.92, -16.35, { s: 1.6 });
  // rice cooker + containers on the back counter
  const rc = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.3, 20), M.ceramic); rc.position.set(0.6, 1.07, -17.6); g.add(rc);
  for (let x = 1.4; x < 4.2; x += 0.45) box(g, M.ceramic, 0.3, 0.2, 0.3, x, 0.94, -17.55, { cast: false });
  // string lights draped over the pass (dining side), like her booths photo
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24, x = -3.3 + t * 5.2;
    const y = 2.33 - Math.sin(t * Math.PI * 2) ** 2 * 0.1;
    pts.push(new THREE.Vector3(x, y, L.kitchenZ + 0.08));
    if (i % 2 === 1) B.bulbs.add(x, y - 0.04, L.kitchenZ + 0.08, { s: 0.42 });
  }
  g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#1a1410' })));
  // order tickets clipped under the heat lamp
  const ticket = new THREE.MeshStandardMaterial({ color: '#f4f1ea', roughness: 0.9, emissive: '#ffffff', emissiveIntensity: 0.08, side: THREE.DoubleSide });
  for (const x of [-2.6, -2.1, -1.5, -0.4, 0.7]) {
    const tk = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.14), ticket);
    tk.position.set(x, 1.98, L.kitchenZ - 0.09); tk.rotation.z = (x * 7 % 1 - 0.5) * 0.1; tk.userData.keep = true; g.add(tk);
  }
  // ladles hanging from a rail on the hood
  box(g, M.steel, 2.6, 0.02, 0.02, -2.8, 2.36, -16.92, { cast: false });
  for (let i = 0; i < 6; i++) {
    const x = -3.9 + i * 0.42;
    box(g, M.steel, 0.012, 0.32, 0.012, x, 2.04, -16.92, { cast: false });
    const cup = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M.steel);
    cup.position.set(x, 2.04, -16.92); g.add(cup);
  }
  // bright cool ceiling panels
  for (const x of [-2.5, 1.5]) box(roof, M.coolPanel, 1.4, 0.03, 0.5, x, L.ceil - 0.03, -16.5, { cast: false, receive: false });
}

// ---------------------------------------------------------------- signs
function signBoard(parent, tex, w, h, x, y, z, { rotY = 0, tilt = 0, glow = 0.14, frame = null, depth = 0.04, hangTo = null, cordMat = null } = {}) {
  const grp = new THREE.Group();
  grp.position.set(x, y, z);
  grp.rotation.set(tilt, rotY, 0, 'YXZ');
  if (frame) {
    const back = new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, h + 0.06, depth), frame);
    back.position.z = -depth / 2 - 0.002; back.castShadow = true; grp.add(back);
  }
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), signMaterial(tex, { glow }));
  grp.add(face);
  grp.userData.keep = true;
  parent.add(grp);
  if (hangTo) {
    for (const s of [-1, 1]) {
      const len = hangTo - (y + h / 2);
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, len, 4), cordMat);
      const lx = Math.cos(rotY) * s * w * 0.4, lz = -Math.sin(rotY) * s * w * 0.4;
      c.position.set(x + lx, y + h / 2 + len / 2, z + lz);
      parent.add(c);
    }
  }
  return grp;
}

function buildSigns(g, M, R, F) {
  // 1) red board with teal frame, white lettering: "고기 굽는 집" (the house where we grill meat) — pic 1, top left
  const s1 = T.sign({
    w: 1024, h: 300, bg: '#b8322b', border: '#2f8f8a', borderW: 34, seed: 101, aged: 0.55,
    inner: { color: '#f2e9d8', width: 6, pad: 46 },
    lines: [{ text: '고기 굽는 집', font: F.display, size: 150, color: '#f6efe2', y: 0.53, shadow: 'rgba(40,10,5,0.55)', shadowOff: 7 }],
  });
  signBoard(g, s1, 1.75, 0.52, -3.25, 3.3, -1.1, { rotY: Math.PI / 4, frame: M.woodDark, glow: 0.22 });

  // 2) yellow board, black lettering: "소주 한잔" (a glass of soju) — pic 1, middle. Hangs at the front of the island roof.
  const s2 = T.sign({
    w: 1024, h: 320, bg: '#e7c54a', border: '#1d1a16', borderW: 26, seed: 102, aged: 0.6,
    lines: [
      { text: '소주 한잔', font: F.display, size: 160, color: '#1d1a16', y: 0.47 },
      { text: 'ONE MORE GLASS', font: F.retro, size: 46, color: '#1d1a16', y: 0.84, spacing: 10 },
    ],
  });
  signBoard(g, s2, 1.6, 0.5, -1.225, 2.42, -2.45, { tilt: -0.18, frame: M.woodDark, glow: 0.22, hangTo: 2.82, cordMat: M.cord });

  // 3) cream board, red lettering + a little pig emblem: "삼겹살 ◎ 목살" — pic 2 style. Faces the main aisle.
  const s3 = T.sign({
    w: 1200, h: 340, bg: '#efe7d6', border: '#3a2414', borderW: 18, seed: 103, aged: 0.6,
    lines: [
      { text: '삼겹살', font: F.display, size: 170, color: '#c4252a', x: 0.2, y: 0.52 },
      { text: '목　살', font: F.display, size: 170, color: '#c4252a', x: 0.8, y: 0.52 },
    ],
    draw: (ctx, w, h) => pigEmblem(ctx, w / 2, h * 0.5, 110),
  });
  signBoard(g, s3, 2.3, 0.65, 0.52, 3.36, -7.6, { rotY: Math.PI / 2, tilt: -0.08, frame: M.woodDark, glow: 0.2 });

  // 4) teal board over the bar: "소주 · 맥주" (soju · beer)
  const s4 = T.sign({
    w: 1024, h: 260, bg: '#2a7f7b', border: '#efe6d3', borderW: 16, seed: 104, aged: 0.5,
    lines: [{ text: '소주 · 맥주', font: F.display, size: 132, color: '#f4ecdc', y: 0.52 }],
  });
  signBoard(g, s4, 1.5, 0.38, 3.18, 3.2, -3.25, { rotY: -Math.PI / 2 + Math.PI, frame: M.woodDark, glow: 0.2 });

  // 5) violet vertical plaque on the right row (pic 1, right side): "원조 숯불구이" (the original charcoal grill)
  const s5 = T.sign({
    w: 256, h: 900, bg: '#4b3d6e', border: '#e8e0f0', borderW: 12, seed: 105, aged: 0.4,
    lines: [{ text: '원조숯불구이', font: F.retro, size: 112, color: '#f3eefa', vertical: true, step: 132, y: 0.5 }],
  });
  signBoard(g, s5, 0.26, 0.9, 3.2, 1.7, -6.2, { rotY: -Math.PI / 2, glow: 0.2 });

  // 7) cream board, red lettering, teal frame, angled off the left eave: "막걸리 · 파전" (rice wine · scallion pancake)
  const s7 = T.sign({
    w: 1100, h: 300, bg: '#efe5cf', border: '#2f8f8a', borderW: 26, seed: 107, aged: 0.6,
    lines: [
      { text: '막걸리 · 파전', font: F.display, size: 140, color: '#b62a28', y: 0.47 },
      { text: 'RICE WINE & PANCAKE', font: F.retro, size: 38, color: '#2a1a10', y: 0.85, spacing: 8 },
    ],
  });
  signBoard(g, s7, 1.9, 0.52, -3.2, 3.32, -7.3, { rotY: Math.PI / 3.2, tilt: -0.06, frame: M.woodDark, glow: 0.2 });

  // 8) mustard board, black lettering, hanging over the main aisle: "오늘의 고기" (today's meat)
  const s8 = T.sign({
    w: 1024, h: 300, bg: '#d9a92e', border: '#1d1a16', borderW: 22, seed: 108, aged: 0.65,
    lines: [
      { text: '오늘의 고기', font: F.display, size: 150, color: '#1d1a16', y: 0.47 },
      { text: "TODAY'S CUT", font: F.retro, size: 42, color: '#1d1a16', y: 0.86, spacing: 12 },
    ],
  });
  signBoard(g, s8, 1.55, 0.46, 1.55, 2.88, -9.6, { rotY: 0.32, tilt: -0.1, frame: M.woodDark, glow: 0.22, hangTo: 3.95, cordMat: M.cord });

  // 9) red board, white lettering, angled off the right eave: "냉면 개시" (cold noodles now on)
  const s9 = T.sign({
    w: 900, h: 300, bg: '#a92a26', border: '#efe6d3', borderW: 18, seed: 109, aged: 0.6,
    inner: { color: '#e7c54a', width: 5, pad: 34 },
    lines: [{ text: '냉면 개시', font: F.display, size: 150, color: '#f6efe2', y: 0.52 }],
  });
  signBoard(g, s9, 1.5, 0.5, 3.2, 3.3, -11.6, { rotY: -Math.PI / 3.2, tilt: -0.06, frame: M.woodDark, glow: 0.2 });

  // 6) above the kitchen pass: "주방" (kitchen) + a row of wooden menu plaques
  const kz = -15 + 0.04;
  const s6 = T.sign({
    w: 600, h: 260, bg: '#efe6d3', border: '#3a2414', borderW: 16, seed: 106, aged: 0.5,
    lines: [
      { text: '주 방', font: F.display, size: 130, color: '#b62a28', y: 0.45 },
      { text: 'KITCHEN', font: F.retro, size: 44, color: '#3a2414', y: 0.84, spacing: 12 },
    ],
  });
  signBoard(g, s6, 1.15, 0.5, 3.3, 2.75, kz + 0.02, { frame: M.woodDark, glow: 0.2 });

  const menu = [
    ['삼겹살', '15,000', 'PORK BELLY'], ['목살', '16,000', 'PORK NECK'], ['소갈비', '24,000', 'BEEF RIBS'],
    ['차돌박이', '18,000', 'BRISKET'], ['된장찌개', '8,000', 'SOYBEAN STEW'], ['김치찌개', '8,000', 'KIMCHI STEW'],
    ['물냉면', '9,000', 'COLD NOODLES'], ['소주', '5,000', 'SOJU'],
  ];
  menu.forEach(([ko, price, en], i) => {
    const t = T.sign({
      w: 300, h: 820, bg: '#c49a63', border: '#4a2c16', borderW: 14, seed: 200 + i, aged: 0.45,
      lines: [
        { text: ko, font: F.brush, size: 150, color: '#1e140c', vertical: true, step: 128, y: 0.4 },
        { text: price, font: F.retro, size: 60, color: '#a8221f', y: 0.84 },
        { text: en, font: F.sans, size: 24, color: '#3a2414', y: 0.92, weight: 600, spacing: 2 },
      ],
    });
    signBoard(g, t, 0.36, 0.98, -3.0 + i * 0.6, 2.85, kz, { glow: 0.22 });
  });
  // "메뉴 MENU" header plaque at the left of the row
  const mh = T.sign({
    w: 512, h: 512, bg: '#1f1a16', border: '#c49a63', borderW: 14, seed: 222, aged: 0.3,
    lines: [
      { text: '메뉴', font: F.display, size: 170, color: '#f1e5cf', y: 0.42 },
      { text: 'MENU', font: F.retro, size: 80, color: '#e7c54a', y: 0.78, spacing: 16 },
    ],
  });
  signBoard(g, mh, 0.62, 0.62, -3.85, 2.85, kz, { glow: 0.25 });
}

function pigEmblem(ctx, cx, cy, r) {
  ctx.save();
  ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 10;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cy, r - 16, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#c4252a';
  // body
  ctx.beginPath(); ctx.ellipse(cx - 6, cy + 6, r * 0.5, r * 0.32, 0, 0, Math.PI * 2); ctx.fill();
  // head
  ctx.beginPath(); ctx.ellipse(cx + r * 0.42, cy - 6, r * 0.24, r * 0.21, 0, 0, Math.PI * 2); ctx.fill();
  // snout
  ctx.fillStyle = '#e46a6a';
  ctx.beginPath(); ctx.ellipse(cx + r * 0.62, cy - 2, r * 0.08, r * 0.1, 0, 0, Math.PI * 2); ctx.fill();
  // ear
  ctx.fillStyle = '#c4252a';
  ctx.beginPath(); ctx.moveTo(cx + r * 0.32, cy - r * 0.18); ctx.lineTo(cx + r * 0.4, cy - r * 0.42); ctx.lineTo(cx + r * 0.5, cy - r * 0.2); ctx.fill();
  // legs
  for (const lx of [-0.38, -0.12, 0.12, 0.3]) ctx.fillRect(cx + lx * r - 6, cy + r * 0.28, 13, r * 0.26);
  // tail
  ctx.strokeStyle = '#c4252a'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(cx - r * 0.6, cy - 4, 10, 0, Math.PI * 1.6); ctx.stroke();
  // eye
  ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.arc(cx + r * 0.48, cy - r * 0.1, 4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- posters, notes, lanterns
function buildDecor(g, M, B, F) {
  // white paper notes pinned to posts (pics 1 + 2)
  const notes = [
    { cols: ['오늘도', '수고했어요'], at: [-3.21, 1.55, -4.5], ry: Math.PI / 2 },   // "you worked hard today"
    { cols: ['고기는', '사랑입니다'], at: [-3.21, 1.55, -8.5], ry: Math.PI / 2 },   // "meat is love"
    { cols: ['한잔', '더'], at: [3.21, 1.55, -10.2], ry: -Math.PI / 2 },           // "one more glass"
    { cols: ['천천히', '드세요'], at: [0.31, 1.62, -2.6], ry: Math.PI / 2 },        // "take your time and enjoy"
  ];
  notes.forEach((n, i) => {
    const tex = T.notice({ cols: n.cols, seed: 300 + i, font: F.pen });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.52), signMaterial(tex, { glow: 0.12 }));
    m.position.set(...n.at); m.rotation.y = n.ry; m.rotation.z = (i % 2 ? 1 : -1) * 0.03;
    m.userData.keep = true; g.add(m);
  });

  // retro posters on the right wall
  const posters = [
    {
      bg: '#e9dfc8', z: -8.2, seed: 401,
      lines: [{ text: '시원하게', font: F.display, size: 96, color: '#1f6d5a', y: 0.16 }, { text: '한잔!', font: F.display, size: 130, color: '#c4252a', y: 0.86 }],
      draw: (ctx, w, h) => {
        ctx.save(); ctx.translate(w / 2, h * 0.52);
        for (let i = 0; i < 18; i++) { ctx.rotate(Math.PI / 9); ctx.fillStyle = i % 2 ? '#f2c14e' : '#efe2b8'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-30, -360); ctx.lineTo(30, -360); ctx.fill(); }
        ctx.restore();
        ctx.fillStyle = '#2f8a4a';
        ctx.beginPath(); ctx.roundRect(w / 2 - 55, h * 0.36, 110, 230, 18); ctx.fill();
        ctx.fillRect(w / 2 - 22, h * 0.25, 44, 80);
        ctx.fillStyle = '#efe6d3'; ctx.fillRect(w / 2 - 55, h * 0.47, 110, 70);
        ctx.fillStyle = '#2f8a4a'; ctx.font = `44px ${F.display}`; ctx.textAlign = 'center'; ctx.fillText('소주', w / 2, h * 0.53);
      },
      fonts: [{ font: F.display, text: '소주' }],
    },
    {
      bg: '#1f2a3a', z: -12.2, seed: 402,
      lines: [{ text: '숯불 맛집', font: F.display, size: 110, color: '#f2c14e', y: 0.16 }, { text: 'SINCE 1988', font: F.retro, size: 56, color: '#efe6d3', y: 0.88, spacing: 10 }],
      draw: (ctx, w, h) => {
        const cx = w / 2, cy = h * 0.55;
        for (let i = 0; i < 3; i++) {
          ctx.fillStyle = ['#c4252a', '#f07a2a', '#f2c14e'][i];
          const s = 1 - i * 0.28;
          ctx.beginPath();
          ctx.moveTo(cx, cy - 190 * s);
          ctx.bezierCurveTo(cx + 140 * s, cy - 60 * s, cx + 120 * s, cy + 120 * s, cx, cy + 130 * s);
          ctx.bezierCurveTo(cx - 120 * s, cy + 120 * s, cx - 140 * s, cy - 60 * s, cx, cy - 190 * s);
          ctx.fill();
        }
      },
    },
  ];
  posters.forEach((p) => {
    const t = T.sign({ w: 600, h: 840, bg: p.bg, border: '#2a1a10', borderW: 14, seed: p.seed, aged: 0.6, lines: p.lines, draw: p.draw, fonts: p.fonts });
    signBoard(g, t, 0.62, 0.87, 4.95, 1.55, p.z, { rotY: -Math.PI / 2, frame: M.woodDark, depth: 0.03, glow: 0.12 });
  });

  // caged wall lanterns on the right posts (pic 1)
  const glass = new THREE.CylinderGeometry(0.065, 0.065, 0.2, 14);
  const cap = new THREE.CylinderGeometry(0.03, 0.085, 0.06, 14);
  for (const [x, z] of [[3.15, -6.2], [3.15, -10.2], [3.15, -14.2], [-3.15, -0.4], [-3.15, -8.5]]) {
    const dir = x > 0 ? -1 : 1;
    box(g, M.blackSteel, 0.18, 0.025, 0.025, x + dir * 0.02, 2.42, z, { cast: false });
    const gl = new THREE.Mesh(glass, M.bulbSoft); gl.position.set(x + dir * 0.13, 2.3, z); gl.userData.keep = true; g.add(gl);
    const c1 = new THREE.Mesh(cap, M.blackSteel); c1.position.set(x + dir * 0.13, 2.43, z); g.add(c1);
    const c2 = new THREE.Mesh(cap, M.blackSteel); c2.position.set(x + dir * 0.13, 2.17, z); c2.rotation.x = Math.PI; g.add(c2);
  }
}

// ---------------------------------------------------------------- lights
function buildLights(g, M) {
  const warm = '#ffb46e', warm2 = '#ffc184';
  // bulbs over the booth rows (one real light per pair of tables)
  for (const z of [-2.5, -6.5, -10.5, -13.8]) pointLight(g, warm, 3.2, 5.5, -4.25, 2.0, z);
  for (const z of [-4.6, -8.6, -11.6]) pointLight(g, warm, 3.6, 6, -1.2, 2.1, z);
  for (const z of [-8.2, -12.2]) pointLight(g, warm, 3.2, 5.5, 4.25, 2.0, z);
  // bar + fridge spill
  pointLight(g, warm2, 3.5, 5, 4.0, 2.3, -3.4);
  pointLight(g, '#cfe6ff', 0.6, 2.5, 4.6, 1.2, -1.75);
  // ceiling track spots over the main aisle (these two cast shadows)
  spotLight(g, '#ffd2a0', 24, 12, [1.8, 4.1, -2.0], [0.4, 0, -6.5], { angle: 0.75, penumbra: 0.8, shadow: true });
  spotLight(g, '#ffd2a0', 20, 12, [1.8, 4.1, -9.5], [0.0, 0, -12.5], { angle: 0.75, penumbra: 0.8, shadow: true });
  // entrance
  pointLight(g, warm2, 2.2, 5, 1.8, 3.0, -0.8);
  // kitchen: bright and cool
  pointLight(g, '#e4eeff', 9, 9, -0.6, 3.6, -16.5);
  pointLight(g, '#ffd9b0', 1.5, 4, -0.7, 1.9, -15.1);
}
