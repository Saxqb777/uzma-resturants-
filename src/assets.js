// Asset loading: photo textures, GLB models and HDR environments, all through one
// LoadingManager so the loading screen can show real progress.
//
//   onAssetProgress(({ loaded, total, ratio, url }) => …)   subscribe (returns an unsubscribe fn)
//   loadTexture(url, { srgb, repeat, rotation })             → THREE.Texture (tiling, mipmapped)
//   loadModel(url)                                            → fresh clone of the GLB scene
//   loadHDR(url, renderer)                                    → PMREM env texture for scene.environment
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

// ---------------------------------------------------------------- progress
export const manager = new THREE.LoadingManager();
const listeners = new Set();
let last = { url: '', loaded: 0, total: 0, ratio: 1 };
const emit = (url, loaded, total) => {
  last = { url, loaded, total, ratio: total ? loaded / total : 1 };
  for (const cb of listeners) { try { cb(last); } catch (e) { console.error(e); } }
};
manager.onStart = (url, loaded, total) => emit(url, loaded, total);
manager.onProgress = (url, loaded, total) => emit(url, loaded, total);
manager.onError = (url) => console.warn('[assets] failed to load', url);

/** Subscribe to loading progress. cb({ url, loaded, total, ratio }). Returns an unsubscribe function. */
export function onAssetProgress(cb) {
  listeners.add(cb);
  if (last.total) cb(last);
  return () => listeners.delete(cb);
}

// ---------------------------------------------------------------- textures
let anisotropy = 8;
/** Max anisotropic filtering for textures loaded from now on (call once with the renderer's limit). */
export function setTextureAnisotropy(n) { anisotropy = Math.max(1, n | 0); }

const texLoader = new THREE.TextureLoader(manager);
const texCache = new Map();   // url -> Promise<Texture> (the shared source image)

/**
 * Load a tiling texture. Each call returns its own Texture object (so repeat/rotation can differ)
 * but they share one image, and three.js shares the GPU upload between them.
 * @param {string} url
 * @param {{srgb?: boolean, repeat?: number|[number, number], rotation?: number, offset?: [number, number]}} opts
 *   srgb: true for colour maps (diffuse/emissive); false (default) for normal/roughness/AO data.
 *   repeat: texture repeats per UV unit. In this project 1 UV unit = 1 m, so repeat = 1 / tileSizeMeters.
 *   rotation: radians (Math.PI / 2 turns horizontal grain vertical).
 */
export async function loadTexture(url, { srgb = false, repeat = 1, rotation = 0, offset } = {}) {
  const key = new URL(url, document.baseURI).href;
  if (!texCache.has(key)) texCache.set(key, texLoader.loadAsync(key));
  const base = await texCache.get(key);
  const t = base.clone();
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = anisotropy;
  const [rx, ry] = Array.isArray(repeat) ? repeat : [repeat, repeat];
  t.repeat.set(rx, ry);
  if (offset) t.offset.set(offset[0], offset[1]);
  t.rotation = rotation;
  t.needsUpdate = true;
  return t;
}

// ---------------------------------------------------------------- models
const gltfLoader = new GLTFLoader(manager);
gltfLoader.setMeshoptDecoder(MeshoptDecoder);
const modelCache = new Map();   // url -> Promise<THREE.Group>

function prepare(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    const mats = [].concat(o.material);
    const glassy = mats.every((m) => m.transparent && !m.alphaTest);
    o.castShadow = !glassy;      // glass doesn't cast; alpha-tested leaves do (three handles alphaTest in shadow maps)
    o.receiveShadow = true;
    for (const m of mats) {
      if (m.map) m.map.anisotropy = anisotropy;
      if (m.alphaTest > 0) m.side = THREE.DoubleSide;   // leaves / cut-outs: both faces
    }
  });
  return root;
}

/**
 * Load a GLB (meshopt + webp, as in assets/models/). Cached: the file is fetched once and every
 * call returns a fresh deep clone of the scene (geometry and materials are shared between clones,
 * so clone a material before tinting it). Models are in meters; see assets/models/manifest.json
 * for each model's pivot and size.
 */
export async function loadModel(url) {
  const key = new URL(url, document.baseURI).href;
  if (!modelCache.has(key)) modelCache.set(key, gltfLoader.loadAsync(key).then((g) => prepare(g.scene)));
  const src = await modelCache.get(key);
  const copy = src.clone(true);
  copy.userData.src = url;
  return copy;
}

// ---------------------------------------------------------------- HDR environment
const rgbeLoader = new RGBELoader(manager);
const envCache = new Map();   // url -> Promise<Texture>

/** Load an equirectangular .hdr and pre-filter it (PMREM) for use as scene.environment / material.envMap. */
export async function loadHDR(url, renderer) {
  const key = new URL(url, document.baseURI).href;
  if (!envCache.has(key)) {
    envCache.set(key, rgbeLoader.loadAsync(key).then((hdr) => {
      hdr.mapping = THREE.EquirectangularReflectionMapping;
      const pmrem = new THREE.PMREMGenerator(renderer);
      const env = pmrem.fromEquirectangular(hdr).texture;
      env.name = url;
      hdr.dispose();
      pmrem.dispose();
      return env;
    }));
  }
  return envCache.get(key);
}
