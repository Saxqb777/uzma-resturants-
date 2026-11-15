// Real CC0 models (Poly Haven, optimized GLBs in assets/models): potted plants and
// kitchen/decor props placed around the restaurant. Pivot: bottom-centre unless the
// manifest says 'back' (back face at z = 0, facing +Z) or 'top' (top at y = 0).
import * as THREE from 'three';
import { loadModel } from './assets.js';
import { LAYOUT as L } from './config.js';
import { CASHIER } from './cashier.js';

const P = (file, x, y, z, ry = 0, s = 1, opts = {}) => ({ file, x, y, z, ry, s, ...opts });

// [file, x, y, z, rotationY, scale]
const PLACEMENTS = [
  // --- front zone: big plants flanking the door, corners, the photo spot and the nook
  P('plant_floor_pedestal', -1.45, 0, -0.55, 0.4),
  P('plant_floor_pedestal', 1.45, 0, -0.55, -0.6),
  P('plant_money_tree', -7.0, 0, -0.6, 0.8),
  P('plant_money_tree_small', -7.0, 0, -4.55, 2.1),
  P('plant_heartleaf', 3.3, 0, -0.55, 1.2),
  P('plant_succulent', CASHIER.nook.x + 0.12, 0.757, CASHIER.nook.z - 0.12, 0.3, 0.8),
  P('vase_white', CASHIER.nook.x - 0.14, 0.757, CASHIER.nook.z + 0.1, 0, 0.7),
  P('wicker_basket', 5.8, 1.05, -2.15, 0.4, 0.8),
  P('wall_clock', 7.48, 2.75, -1.05, -Math.PI / 2, 1, { back: true }),
  P('payphone_kr', L.x0 + 0.02, 1.15, -4.45, Math.PI / 2, 1, { back: true }),
  // --- plants at the front of every booth lane (the aisle entrances)
  P('plant_calathea_pot', -4.55, 0, -4.6, 0.3),
  P('plant_calathea_pot', 4.55, 0, -4.6, 2.2),
  P('plant_heartleaf', -0.7, 0, -4.55, 0.9, 0.8),
  P('plant_heartleaf', 0.7, 0, -4.55, 2.4, 0.8),
  // --- hanging ferns over the wall lanes and the front zone
  P('plant_fern_hanging', -5.6, 2.45, -2.4, 0.2, 0.75, { hang: true }),
  P('plant_fern_hanging', 3.0, 2.5, -3.2, 1.3, 0.75, { hang: true }),
  P('plant_fern_hanging', -5.95, 2.2, -16.9, 0.7, 0.7, { hang: true }),
  P('plant_fern_hanging', 5.95, 2.2, -16.9, 2.0, 0.7, { hang: true }),
  // --- live cooking station: big plants at both ends, brass pot on the back shelf, extinguisher
  P('plant_money_tree_small', -7.0, 0, -18.6, 0.4),
  P('plant_money_tree_small', 7.0, 0, -18.6, 2.6),
  P('pot_brass', -4.6, 1.985, L.live.wallZ + 0.15, 0, 0.8),
  P('fire_extinguisher_kr', 6.9, 0, -20.6, -Math.PI / 2),
  // --- main kitchen: storage, crates, prep props, proper fluorescent fittings
  P('shelf_steel_wood', L.x1 - 0.32, 0, -25.9, -Math.PI / 2),
  P('storage_bin', 5.6, 0, -26.55, 0),
  P('crate_plastic', -6.9, 0.9, -25.4, 0.3),
  P('crate_plastic', -6.9, 0, -25.1, 0.1),
  P('bowl_wood', -1.9, 0.92, -23.4, 0),
  P('spoon_wood', -0.75, 0.92, -23.45, 1.2),
  P('onion', -1.15, 0.92, -23.35, 0), P('onion', -1.08, 0.92, -23.28, 1), P('onion', -1.2, 0.92, -23.25, 2),
  P('ginger', -0.55, 0.92, -23.3, 0.6),
  P('fire_extinguisher_kr', L.x1 - 0.2, 0, -21.6, -Math.PI / 2),
  ...[-4.2, -1.4, 1.4, 4.2].flatMap((x) => [-22.6, -25.3].map((z) => P('fluorescent_lights', x, L.ceil - 0.01, z, 0, 1, { top: true, roof: true }))),
];

export async function placeProps(ctx) {
  const { scene, roof } = ctx;
  const g = new THREE.Group(); g.name = 'interior'; scene.add(g);
  const files = [...new Set(PLACEMENTS.map((p) => p.file))];
  const models = {};
  await Promise.all(files.map(async (f) => {
    try { models[f] = await loadModel(`assets/models/${f}.glb`); } catch { /* missing model: skip */ }
  }));
  for (const p of PLACEMENTS) {
    const src = models[p.file];
    if (!src) continue;
    const m = src.clone(true);
    m.position.set(p.x, p.y, p.z);
    m.rotation.y = p.ry;
    m.scale.setScalar(p.s);
    (p.roof ? roof : g).add(m);
    if (p.hang) {
      // a cord from the pot rim up to the ceiling
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, L.ceil - p.y - 0.4, 4), new THREE.MeshStandardMaterial({ color: '#2a2420' }));
      cord.position.set(p.x, (L.ceil + p.y + 0.4) / 2, p.z);
      g.add(cord);
    }
  }
  return g;
}
