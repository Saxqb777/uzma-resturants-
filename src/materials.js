// All shared materials. Surfaces use CC0 photo-scanned PBR sets (Poly Haven / ambientCG) from
// assets/tex/<set>/{diff,nor,arm}.jpg — arm = AO (R), roughness (G), metalness (B).
// Signs, glows and small painted parts keep their procedural / flat looks.
//
// UV convention: box()/plane()/corrugatedGeometry() in helpers.js write WORLD-SCALED UVs where one
// UV unit = `uv` meters (default 1 m). Every texture's repeat is 1 / tile size, so with the default
// uv = 1 one texture tile covers its real-world size (MATERIAL_SCALE). If a call passes uv: 2, the
// texture is drawn twice as large; use uv: 1 for true scale.
import * as THREE from 'three';
import * as T from './textures.js';
import { loadTexture, setTextureAnisotropy } from './assets.js';

const TEX = new URL('../assets/tex/', import.meta.url).href;

/** Real-world size (meters) one texture tile covers, per material key ([w, h] when not square). */
export const MATERIAL_SCALE = {
  woodBooth: 1.5, woodBoothV: 1.5,
  woodDark: 2.0, woodDarkV: 2.0,
  woodExt: 1.57, woodExtV: 1.57,
  woodDeck: 3.0,
  woodOak: 1.2, woodOakV: 1.2,
  tin: 2.0, tinLight: 1.0,
  plaster: 2.0, plasterWarm: 2.0, plasterGrey: 1.5,
  floor: 2.3,
  subway: 1.27, kitchenTile: 1.0, whiteTile: 1.0, redTile: 0.8,
  kitchenFloor: [1.1, 0.55],
  brick: 1.0, pavers: 1.92, asphalt: 3.0, concrete: 3.0, ceiling: 3.0,
  terrazzo: 0.6, cork: 0.5,
  cushionTeal: 0.3, cushionTerracotta: 0.3,
  steel: 1.0, steelBrushed: 1.0, duct: 1.0,
  blackSteel: 1.0, metalBlack: 1.0, grillIron: 1.0,
};

// texture sets on disk -> real tile size
const SETS = {
  wood_booth: 1.5, wood_dark: 2.0, wood_oak: 1.2, wood_ext: 1.57, wood_deck: 3.0,
  plaster: 2.0, plaster_grey: 1.5, concrete: 3.0,
  subway: 1.27, tile_white: 1.0, tile_red: 0.8, kitchen_floor: [1.1, 0.55], floor_slate: 2.3,
  brick: 1.0, pavers: 1.92, asphalt: 3.0,
  tin_rust: 2.0, tin_galv: 1.0, steel_brushed: 1.0, metal_black: 1.0,
  terrazzo: 0.6, cork: 0.5, leather: 0.3,
};

const repeatFor = (tile) => (Array.isArray(tile) ? [1 / tile[0], 1 / tile[1]] : [1 / tile, 1 / tile]);

async function loadSet(name, { rotation = 0, tile = SETS[name] } = {}) {
  const repeat = repeatFor(tile);
  const o = { repeat, rotation };
  const [map, normal, arm] = await Promise.all([
    loadTexture(`${TEX}${name}/diff.jpg`, { ...o, srgb: true }),
    loadTexture(`${TEX}${name}/nor.jpg`, o),
    loadTexture(`${TEX}${name}/arm.jpg`, o),
  ]);
  return { map, normal, arm };
}

// MeshStandardMaterial from a texture set. rough/metal multiply the ARM map's G/B channels.
function pbr(set, { color = '#ffffff', rough = 1, metal = 0, metalMap = false, normal = 1, ao = 1, env = 1, noMap = false, physical = null, ...rest } = {}) {
  const params = {
    color, map: noMap ? null : set.map,
    normalMap: set.normal, normalScale: new THREE.Vector2(normal, normal),
    roughnessMap: set.arm, roughness: rough,
    aoMap: set.arm, aoMapIntensity: ao,
    metalnessMap: metalMap ? set.arm : null, metalness: metal,
    envMapIntensity: env, ...rest,
  };
  return physical ? new THREE.MeshPhysicalMaterial({ ...params, ...physical }) : new THREE.MeshStandardMaterial(params);
}

/**
 * Build every shared material. ASYNC: textures stream in through the shared LoadingManager
 * (subscribe with onAssetProgress from assets.js for the loading bar).
 * @param {THREE.WebGLRenderer} [renderer] used for the anisotropy limit
 */
export async function buildMaterials(renderer) {
  const aniso = renderer ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 4;
  setTextureAnisotropy(aniso);
  T.setMaxAnisotropy(aniso);
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const V = Math.PI / 2;

  const want = {
    booth: ['wood_booth'], boothV: ['wood_booth', V], dark: ['wood_dark'], darkV: ['wood_dark', V],
    oak: ['wood_oak'], oakV: ['wood_oak', V], ext: ['wood_ext'], extV: ['wood_ext', V], deck: ['wood_deck'],
    plaster: ['plaster'], plasterGrey: ['plaster_grey'], concrete: ['concrete'],
    subway: ['subway'], tileWhite: ['tile_white'], tileRed: ['tile_red'], kitchenFloor: ['kitchen_floor'], floor: ['floor_slate'],
    brick: ['brick'], pavers: ['pavers'], asphalt: ['asphalt'],
    tin: ['tin_rust'], tinGalv: ['tin_galv'], steel: ['steel_brushed'], black: ['metal_black'],
    terrazzo: ['terrazzo'], cork: ['cork'], leather: ['leather'],
  };
  const keys = Object.keys(want);
  const loaded = await Promise.all(keys.map((k) => loadSet(want[k][0], { rotation: want[k][1] || 0 })));
  const S = Object.fromEntries(keys.map((k, i) => [k, loaded[i]]));

  const m = {
    textures: S,

    // ---- wood
    woodBooth: pbr(S.booth, { rough: 0.78, normal: 0.8 }),                 // satin-varnished pine planks
    woodBoothV: pbr(S.boothV, { rough: 0.78, normal: 0.8 }),
    woodDark: pbr(S.dark, { rough: 1.0, normal: 0.7 }),                     // dark stained timber: beams, posts, trim
    woodDarkV: pbr(S.darkV, { rough: 1.0, normal: 0.7 }),
    woodExt: pbr(S.ext, { rough: 1.0, normal: 1.0 }),                      // weathered siding outside
    woodExtV: pbr(S.extV, { rough: 1.0, normal: 1.0 }),
    woodDeck: pbr(S.deck, { rough: 1.0, normal: 1.0, color: '#d9cfc4' }),
    woodOak: pbr(S.oak, { rough: 0.95, normal: 0.6 }),                     // light oak slats (cashier / live station)
    woodOakV: pbr(S.oakV, { rough: 0.95, normal: 0.6 }),

    // ---- metal roofs
    tin: pbr(S.tin, { color: '#e3d3c8', rough: 1.0, normal: 0.3, ao: 0.6, side: THREE.DoubleSide }),          // rusty corrugated (geometry does the waves)
    tinLight: pbr(S.tinGalv, { rough: 1.0, metal: 1.0, metalMap: true, normal: 0.5, side: THREE.DoubleSide }),  // galvanised with rust spots

    // ---- walls
    plaster: pbr(S.plaster, { color: '#efe9e1', rough: 1.0, normal: 0.6 }),       // warm light grey
    plasterWarm: pbr(S.plaster, { color: '#f6e6cf', rough: 1.0, normal: 0.6 }),   // creamier, for cosy corners
    plasterGrey: pbr(S.plasterGrey, { color: '#d9d5cf', rough: 1.0, normal: 0.6, ao: 0.8 }),
    concrete: pbr(S.concrete, { rough: 1.0, normal: 0.8 }),
    ceiling: pbr(S.concrete, { color: '#2a2724', rough: 1.0, normal: 0.6, env: 0.4 }),       // dark painted open ceiling
    brick: pbr(S.brick, { rough: 1.0, normal: 1.0 }),

    // ---- tiles & floors
    subway: pbr(S.subway, { rough: 1.0, normal: 0.8, env: 1.0 }),                 // long white glazed tiles
    whiteTile: pbr(S.tileWhite, { color: '#f4f3ef', rough: 1.0, normal: 0.7, env: 1.0 }),  // kitchen wall tile
    kitchenTile: pbr(S.tileWhite, { color: '#f4f3ef', rough: 1.0, normal: 0.7, env: 1.0 }),
    redTile: pbr(S.tileRed, { rough: 1.0, normal: 0.8, env: 1.0 }),               // small glossy red pocha tiles
    floor: pbr(S.floor, { rough: 0.9, normal: 0.8, env: 0.8 }),                   // dark slate tiles (dining)
    kitchenFloor: pbr(S.kitchenFloor, { color: '#f1f0ec', rough: 1.0, normal: 0.8 }),     // light anti-slip tiles
    pavers: pbr(S.pavers, { rough: 1.0, normal: 1.0 }),
    asphalt: pbr(S.asphalt, { rough: 1.0, normal: 1.0, env: 0.5 }),

    // ---- counters & boards
    terrazzo: pbr(S.terrazzo, { rough: 1.0, normal: 0.4, physical: { clearcoat: 0.6, clearcoatRoughness: 0.12 } }),
    cork: pbr(S.cork, { rough: 1.0, normal: 0.8, env: 0.3 }),

    // ---- upholstery (neutral leather scan, tinted)
    cushionTeal: pbr(S.leather, { color: '#1f6668', rough: 0.85, normal: 1.0 }),
    cushionTerracotta: pbr(S.leather, { color: '#b4553a', rough: 0.85, normal: 1.0 }),

    // ---- steel
    steel: pbr(S.steel, { noMap: true, color: '#c9cdd1', metal: 1.0, rough: 0.75, normal: 0.25, env: 1.0 }),          // stainless, brushed
    steelBrushed: pbr(S.steel, { noMap: true, color: '#bfc3c7', metal: 1.0, rough: 0.95, normal: 0.3, env: 0.9 }),
    duct: pbr(S.steel, { noMap: true, color: '#a9adb2', metal: 1.0, rough: 1.0, normal: 0.2, env: 0.7 }),
    blackSteel: pbr(S.black, { color: '#9a9a9a', metal: 0.5, rough: 1.5, normal: 0.5 }),   // dark steel frames
    metalBlack: pbr(S.black, { metal: 0.0, rough: 1.6, normal: 0.5 }),                     // black powder coat
    grillIron: pbr(S.black, { color: '#5a5450', metal: 0.8, rough: 1.8, normal: 0.6 }),

    // ---- flat-coloured bits (unchanged)
    rubber: std({ color: '#121212', roughness: 0.9 }),
    yellowFrame: std({ color: '#d8b84a', roughness: 0.7 }),
    tealPaint: std({ color: '#2f8a86', roughness: 0.75 }),
    redPaint: std({ color: '#b3302a', roughness: 0.7 }),
    roofTile: std({ color: '#26272a', roughness: 0.6, metalness: 0.15 }),
    glass: new THREE.MeshStandardMaterial({ color: '#9fb4b8', roughness: 0.05, metalness: 0, transparent: true, opacity: 0.18, envMapIntensity: 1.2, depthWrite: false }),
    frosted: std({ color: '#d9d7cf', roughness: 0.3, transparent: true, opacity: 0.22, depthWrite: false }),
    bottleGreen: new THREE.MeshStandardMaterial({ color: '#2f8a4a', roughness: 0.12, metalness: 0, transparent: true, opacity: 0.93, envMapIntensity: 1.4, emissive: '#0b2a14', emissiveIntensity: 0.6 }),
    bottleBrown: new THREE.MeshStandardMaterial({ color: '#5a3212', roughness: 0.15, transparent: true, opacity: 0.95, envMapIntensity: 1.2 }),
    bottleCap: std({ color: '#2c7a3a', roughness: 0.4, metalness: 0.6 }),
    ceramic: std({ color: '#efece6', roughness: 0.35 }),
    ceramicDark: std({ color: '#2a2622', roughness: 0.45 }),
    fabricDark: std({ color: '#1b1714', roughness: 1 }),

    // ---- light-emitting (unchanged)
    bulb: std({ color: '#ffd9a0', emissive: '#ffb25e', emissiveIntensity: 4.5, roughness: 0.3 }),
    bulbSoft: std({ color: '#ffe2b8', emissive: '#ffc078', emissiveIntensity: 3.2, roughness: 0.4 }),
    ember: (() => { const t = T.emberTexture(); return std({ map: t, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 2.2, roughness: 0.9 }); })(),
    coolPanel: std({ color: '#ffffff', emissive: '#e8f2ff', emissiveIntensity: 3.0 }),
    frostedGlow: (() => { const t = T.frostedGlowTexture(); return std({ map: t, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 0.5, roughness: 0.4, color: '#c9a070' }); })(),
    cord: std({ color: '#151515', roughness: 0.8 }),
  };
  for (const [k, v] of Object.entries(m)) if (v && v.isMaterial) v.name = k;
  return m;
}

// Unlit-ish sign material from a canvas texture (lit by scene, slightly self-lit so it reads in the dark)
export function signMaterial(tex, { glow = 0.12, side = THREE.FrontSide, rough = 0.75 } = {}) {
  return new THREE.MeshStandardMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: glow, roughness: rough, side });
}
