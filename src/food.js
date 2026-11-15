// Food and tableware. Dishes are simple, well-proportioned geometry wearing real
// top-down food photos (assets/ai/food/*.jpg) — the photo does the realism, the
// geometry gives it volume and the right silhouette. If a photo is missing the dish
// falls back to a plain colour so nothing breaks.
import * as THREE from 'three';

const loader = new THREE.TextureLoader();
const NAMES = ['spicy-chicken', 'rice', 'kimchi', 'cucumber-salad', 'dipping-sauce', 'lettuce', 'grill-grate-chicken', 'charcoal-embers'];
const textures = {};

// Load every food photo up front (missing files are fine: the dish keeps a plain colour)
export async function loadFoodTextures() {
  const load = (key, url) => new Promise((res) => {
    loader.load(url, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; textures[key] = t; res(); }, undefined, () => res());
  });
  await Promise.all([
    ...NAMES.map((n) => load(n, `assets/ai/food/${n}.jpg`)),
    load('hero-polaroid', 'assets/ai/hero/01.jpg'),
  ]);
}
export function foodTexture(name) { return textures[name] || null; }

function foodMat(name, fallback, { rough = 0.55, glossy = false } = {}) {
  const t = textures[name];
  return new THREE.MeshStandardMaterial({
    color: t ? '#ffffff' : fallback, map: t || null, roughness: glossy ? 0.3 : rough, metalness: 0,
  });
}

// Mound / dome surface for food inside a bowl (radius r, height h)
function mound(r, h, seg = 20) {
  const g = new THREE.SphereGeometry(1, seg, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  g.scale(r, h, r);
  // planar top-down UVs so the photo lies naturally on the food
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / (2 * r) + 0.5, p.getZ(i) / (2 * r) + 0.5);
  return g;
}

// Lathe profile for bowls/plates: [[radius, y], ...] outer then inner
function lathe(points, seg = 28) {
  return new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), seg);
}

export function makeFoodKit(M) {
  const mats = {
    chicken: foodMat('spicy-chicken', '#b33a1e', { glossy: true }),
    rice: foodMat('rice', '#f1ece0', { rough: 0.7 }),
    kimchi: foodMat('kimchi', '#c2412a', { glossy: true }),
    cucumber: foodMat('cucumber-salad', '#7da24a', { glossy: true }),
    sauce: foodMat('dipping-sauce', '#8e1f12', { glossy: true }),
    lettuce: foodMat('lettuce', '#6ea14a', { rough: 0.5 }),
    grillChicken: foodMat('grill-grate-chicken', '#a63a1c', { glossy: true }),
  };
  const steel = M.steelBrushed || M.steel;
  const ceramic = M.ceramic;
  const ceramicDark = M.ceramicDark;
  const wood = M.woodBooth;

  const geo = {
    steelBowl: lathe([[0, 0], [0.034, 0], [0.05, 0.05], [0.048, 0.052], [0.032, 0.004], [0, 0.004]]),
    lid: lathe([[0, 0.012], [0.02, 0.012], [0.05, 0.002], [0.052, 0], [0.0, 0]]),
    banchan: lathe([[0, 0], [0.035, 0], [0.06, 0.028], [0.057, 0.03], [0.034, 0.004], [0, 0.004]]),
    sauceDish: lathe([[0, 0], [0.026, 0], [0.04, 0.018], [0.038, 0.02], [0.025, 0.003], [0, 0.003]]),
    plate: lathe([[0, 0], [0.09, 0], [0.12, 0.016], [0.117, 0.018], [0.088, 0.004], [0, 0.004]]),
    riceMound: mound(0.044, 0.028),
    banchanMound: mound(0.05, 0.018),
    sauceSurf: new THREE.CircleGeometry(0.032, 20).rotateX(-Math.PI / 2),
    piece: new THREE.CapsuleGeometry(0.014, 0.03, 4, 8).rotateZ(Math.PI / 2),
  };

  // planar UVs for the sauce disc
  const su = geo.sauceSurf.attributes.uv, sp = geo.sauceSurf.attributes.position;
  for (let i = 0; i < sp.count; i++) su.setXY(i, sp.getX(i) / 0.064 + 0.5, sp.getZ(i) / 0.064 + 0.5);

  const add = (parent, g, m, x, y, z, ry = 0, s = 1) => {
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(x, y, z); mesh.rotation.y = ry; mesh.scale.setScalar(s);
    mesh.castShadow = false; mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };

  return {
    mats, geo,
    // steel rice bowl, open with rice, lid leaning beside it
    rice(parent, x, y, z, ry = 0) {
      add(parent, geo.steelBowl, steel, x, y, z);
      add(parent, geo.riceMound, mats.rice, x, y + 0.044, z, ry);
    },
    riceClosed(parent, x, y, z) {
      add(parent, geo.steelBowl, steel, x, y, z);
      add(parent, geo.lid, steel, x, y + 0.052, z);
    },
    banchan(parent, kind, x, y, z, ry = 0) {
      add(parent, geo.banchan, kind === 'kimchi' ? ceramicDark : ceramic, x, y, z);
      add(parent, geo.banchanMound, mats[kind] || mats.kimchi, x, y + 0.02, z, ry);
    },
    sauce(parent, x, y, z) {
      add(parent, geo.sauceDish, ceramic, x, y, z);
      add(parent, geo.sauceSurf, mats.sauce, x, y + 0.014, z);
    },
    lettuce(parent, x, y, z, ry = 0) {
      add(parent, geo.plate, ceramic, x, y, z);
      add(parent, geo.banchanMound, mats.lettuce, x, y + 0.008, z, ry, 1.5);
    },
    // a raw tray of marinated chicken waiting to be grilled
    chickenPlate(parent, x, y, z, ry = 0) {
      add(parent, geo.plate, ceramic, x, y, z);
      add(parent, geo.banchanMound, mats.chicken, x, y + 0.008, z, ry, 1.6);
    },
    // pieces on the grill (grill top at y)
    grillPieces(parent, x, y, z, rnd, n = 9) {
      for (let i = 0; i < n; i++) {
        const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 0.13;
        const m = add(parent, geo.piece, mats.chicken, x + Math.cos(a) * r, y + 0.012, z + Math.sin(a) * r, rnd() * Math.PI);
        m.scale.set(1 + rnd() * 0.4, 0.8, 1);
      }
    },
  };
}
