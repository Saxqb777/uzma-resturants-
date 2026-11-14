// All shared materials, built once from the procedural textures.
import * as THREE from 'three';
import * as T from './textures.js';

function clone(tex, { rot = 0, repeat } = {}) {
  const t = tex.clone();
  t.needsUpdate = true;
  if (rot) { t.center.set(0.5, 0.5); t.rotation = rot; }
  if (repeat) t.repeat.set(...repeat);
  return t;
}

export function buildMaterials() {
  const std = (o) => new THREE.MeshStandardMaterial(o);

  // wood: booth planks (warm orange-brown), posts/beams (dark), exterior (weathered reddish)
  const booth = T.woodTexture({ base: '#6c4a30', planks: 4, seed: 2, grain: 0.16, variance: 0.12, joints: false });
  const dark = T.woodTexture({ base: '#3e2a1b', planks: 3, seed: 4, grain: 0.4, variance: 0.2, joints: false });
  const ext = T.woodTexture({ base: '#5a3420', planks: 5, seed: 6, grain: 0.3, weather: 0.35 });
  const deck = T.woodTexture({ base: '#4b2e1c', planks: 5, seed: 8, grain: 0.3, weather: 0.5 });

  const rust = T.rustTexture({ seed: 3, rust: 0.5 });
  const rustLight = T.rustTexture({ seed: 12, rust: 0.35 });
  const plaster = T.plasterTexture({ base: '#aaa69f', seed: 5 });
  const plasterGrey = T.plasterTexture({ base: '#8e8c88', seed: 15, mottle: 0.16 });
  const floor = T.tileTexture({ tiles: 2, base: '#2c2c2e', grout: '#121212', variance: 0.1, seed: 9, gloss: 0.5 });
  const subway = T.tileTexture({ tiles: 2, rows: 4, offset: 0.5, base: '#f1efea', grout: '#8f8c86', groutPx: 4, variance: 0.04, seed: 19, gloss: 0.8 });
  const kitchenTile = T.tileTexture({ tiles: 4, base: '#d8d6d0', grout: '#9a968e', groutPx: 3, variance: 0.03, seed: 23, gloss: 0.8 });
  const brick = T.brickTexture({ seed: 11 });
  const pavers = T.tileTexture({ tiles: 4, rows: 8, offset: 0.5, base: '#6e4a3e', grout: '#3a332e', groutPx: 3, variance: 0.25, seed: 29, gloss: 0.3 });
  const asphalt = T.asphaltTexture({ seed: 13 });
  const concrete = T.concreteTexture({ base: '#3d3b39', seed: 17, panels: 2 });

  const m = {
    textures: { booth, dark, ext, deck, rust, plaster, floor, subway, brick, pavers, asphalt, concrete },

    woodBooth: std({ map: booth.map, bumpMap: booth.bump, bumpScale: 0.6, roughness: 0.72, color: '#ffffff' }),
    woodBoothV: std({ map: clone(booth.map, { rot: Math.PI / 2 }), bumpMap: clone(booth.bump, { rot: Math.PI / 2 }), bumpScale: 0.6, roughness: 0.72 }),
    woodDark: std({ map: dark.map, bumpMap: dark.bump, bumpScale: 0.8, roughness: 0.8 }),
    woodDarkV: std({ map: clone(dark.map, { rot: Math.PI / 2 }), bumpMap: clone(dark.bump, { rot: Math.PI / 2 }), bumpScale: 0.8, roughness: 0.8 }),
    woodExt: std({ map: ext.map, bumpMap: ext.bump, bumpScale: 0.7, roughness: 0.82 }),
    woodExtV: std({ map: clone(ext.map, { rot: Math.PI / 2 }), bumpMap: clone(ext.bump, { rot: Math.PI / 2 }), bumpScale: 0.7, roughness: 0.82 }),
    woodDeck: std({ map: deck.map, bumpMap: deck.bump, bumpScale: 0.8, roughness: 0.85 }),

    tin: std({ map: rust, roughness: 0.62, metalness: 0.45, side: THREE.DoubleSide }),
    tinLight: std({ map: rustLight, roughness: 0.55, metalness: 0.55, side: THREE.DoubleSide }),
    plaster: std({ map: plaster, roughness: 0.92 }),
    plasterGrey: std({ map: plasterGrey, roughness: 0.92 }),
    floor: std({ map: floor.map, roughnessMap: floor.rough, roughness: 1, metalness: 0.0, envMapIntensity: 0.6 }),
    subway: std({ map: subway.map, roughnessMap: subway.rough, roughness: 1, envMapIntensity: 0.5 }),
    kitchenTile: std({ map: kitchenTile.map, roughnessMap: kitchenTile.rough, roughness: 1, envMapIntensity: 0.5 }),
    brick: std({ map: brick, roughness: 0.9 }),
    pavers: std({ map: pavers.map, roughnessMap: pavers.rough, roughness: 1 }),
    asphalt: std({ map: asphalt, roughness: 0.75, metalness: 0.0, envMapIntensity: 0.4 }),
    concrete: std({ map: concrete, roughness: 0.9 }),

    ceiling: std({ color: '#141210', roughness: 0.95 }),
    blackSteel: std({ color: '#1a1a1a', roughness: 0.5, metalness: 0.7 }),
    steel: std({ color: '#b9bdc2', roughness: 0.38, metalness: 0.6, envMapIntensity: 0.9 }),
    steelBrushed: std({ color: '#aeb2b6', roughness: 0.42, metalness: 1.0, envMapIntensity: 0.8 }),
    duct: std({ color: '#8d9196', roughness: 0.38, metalness: 0.9, envMapIntensity: 0.6 }),
    grillIron: std({ color: '#262422', roughness: 0.55, metalness: 0.8 }),
    rubber: std({ color: '#121212', roughness: 0.9 }),
    yellowFrame: std({ color: '#d8b84a', roughness: 0.7 }),
    tealPaint: std({ color: '#2f8a86', roughness: 0.75 }),
    redPaint: std({ color: '#b3302a', roughness: 0.7 }),
    roofTile: std({ color: '#26272a', roughness: 0.6, metalness: 0.15 }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#9fb4b8', roughness: 0.05, metalness: 0, transparent: true, opacity: 0.18, envMapIntensity: 1.2, depthWrite: false }),
    frosted: std({ color: '#d9d7cf', roughness: 0.3, transparent: true, opacity: 0.22, depthWrite: false }),
    bottleGreen: new THREE.MeshPhysicalMaterial({ color: '#2f8a4a', roughness: 0.12, metalness: 0, transparent: true, opacity: 0.93, envMapIntensity: 1.4, emissive: '#0b2a14', emissiveIntensity: 0.6 }),
    bottleBrown: new THREE.MeshPhysicalMaterial({ color: '#5a3212', roughness: 0.15, transparent: true, opacity: 0.95, envMapIntensity: 1.2 }),
    bottleCap: std({ color: '#2c7a3a', roughness: 0.4, metalness: 0.6 }),
    ceramic: std({ color: '#efece6', roughness: 0.35 }),
    ceramicDark: std({ color: '#2a2622', roughness: 0.45 }),
    fabricDark: std({ color: '#1b1714', roughness: 1 }),

    // light-emitting
    bulb: std({ color: '#ffd9a0', emissive: '#ffb25e', emissiveIntensity: 4.5, roughness: 0.3 }),
    bulbSoft: std({ color: '#ffe2b8', emissive: '#ffc078', emissiveIntensity: 3.2, roughness: 0.4 }),
    ember: (() => { const t = T.emberTexture(); return std({ map: t, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 2.2, roughness: 0.9 }); })(),
    coolPanel: std({ color: '#ffffff', emissive: '#e8f2ff', emissiveIntensity: 3.0 }),
    frostedGlow: std({ map: T.frostedGlowTexture(), emissive: '#ffffff', emissiveMap: T.frostedGlowTexture(), emissiveIntensity: 0.5, roughness: 0.4, color: '#c9a070' }),
    cord: std({ color: '#151515', roughness: 0.8 }),
  };
  return m;
}

// Unlit-ish sign material from a canvas texture (lit by scene, slightly self-lit so it reads in the dark)
export function signMaterial(tex, { glow = 0.12, side = THREE.FrontSide, rough = 0.75 } = {}) {
  return new THREE.MeshStandardMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: glow, roughness: rough, side });
}
