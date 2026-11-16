/**
 * people.js: realistic people for the Seoulicious restaurant scenes.
 * =====================================================================
 *
 * SOURCES AND LICENSE
 *   Avatars: Microsoft Rocketbox avatar library, MIT License, Copyright (c) 2020 Microsoft.
 *   https://github.com/microsoft/Microsoft-Rocketbox
 *   Converted from the original FBX + TGA files to GLB: one mesh each (the Export FBX files only
 *   contain the "hipoly_81_bones" mesh, ~7-9k triangles), webp textures (1024 px body/head,
 *   512 px hair/opacity), meshopt-compressed geometry. 0.26-0.60 MB per avatar, 14.8 MB for all 33.
 *   Aprons, hats, name tags and hand props are generated here in code.
 *
 * FILES
 *   assets/people/manifest.json   [{ id, file, sex, ageGroup, notes, height, scale, source, expr?, builtin?, defaultUniform? }]
 *                                 height = real height in meters incl. hair/headwear (after scale);
 *                                 expr = how strongly this face rig needs to be driven (default 1)
 *   assets/people/<id>.glb        needs EXT_meshopt_compression + EXT_texture_webp (handled below)
 *
 * IMPORT MAP (same as index.html)
 *   "three":         https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js
 *   "three/addons/": https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/
 *   Uses three/addons/loaders/GLTFLoader.js, libs/meshopt_decoder.module.js, utils/SkeletonUtils.js.
 *
 * API
 *   await loadPeople({ base = 'assets/people/', onProgress })   loads manifest + every GLB once (cached)
 *   listPeople()                                               manifest entries (copies)
 *   createPerson(id, opts) -> THREE.Group
 *     Feet on y = 0 at the group origin, facing +Z, real-world meters. Move/rotate the group freely.
 *     opts.pose     'stand' | 'stand-talk' | 'wave' | 'sit' | 'sit-eat' | 'sit-talk' | 'sit-cheers' |
 *                   'sit-phone' | 'cook-stir' | 'cook-flip' | 'prep-chop' | 'cashier' | 'carry-tray' |
 *                   'photo' | 'pin'                                         (default 'stand')
 *     opts.uniform  null | 'head-chef' | 'chef' | 'cook' | 'server' | 'cashier'
 *                   head-chef: tall white toque + long white apron; chef: shorter toque + white apron;
 *                   cook: black cap + charcoal apron; server: teal (#2f8f8a) apron; cashier: pink (#e89bb5)
 *                   apron. Aprons are skinned to the body, hats follow the head. 'chef-female' defaults
 *                   to 'head-chef' (her own coat/apron/cap are kept, a toque goes over the cap).
 *                   Avatars with headwear (hijab, ghutra, kufi, cap) never get a hat.
 *     opts.name     chest name tag text, e.g. '지수 Jisoo' (canvas texture, redrawn once the
 *                   "IBM Plex Sans KR" web font has loaded)
 *     opts.holding  null | 'chopsticks' | 'glass' | 'phone' | 'tray' | 'camera' | 'pan' | 'knife' |
 *                   'polaroid' | 'ladle'. Omitted: the pose's own prop (sit-eat chopsticks, sit-cheers
 *                   glass, sit-phone phone, cook-stir ladle, cook-flip pan, prep-chop knife, carry-tray tray,
 *                   photo camera, pin polaroid). null: empty hands. Other props in stand / stand-talk /
 *                   sit / sit-talk: the right hand brings them up in front (glass upright, phone facing
 *                   the eyes, tray on a raised palm); in other poses the right hand just closes on them.
 *     opts.mood     'smile' | 'laugh' | 'talk' | 'focus' | 'neutral'. Facial expression, driven by the face
 *                   bones: smile = soft closed-mouth smile that now and then opens up; laugh = open smile
 *                   with laughs (head back, shoulders bounce, eyes squint); talk = speaking and listening
 *                   turns (lips move, brows, nods, attentive smile); focus = relaxed concentration, smiles
 *                   when glancing up at guests; neutral = no expression. Defaults per pose: sit-talk and
 *                   stand-talk talk, sit-cheers laugh, cook-stir / cook-flip / prep-chop focus, all others
 *                   smile. Every mood blinks (every 2-6 s) and moves the eyes; nobody stares straight ahead.
 *     opts.seed     number: the person's own variation: which leg carries the weight, what the free hand
 *                   does (on the table, forearm across, in the lap), head tilt, lean, how much they smile,
 *                   who they glance at and when. Different seeds = visibly different people.
 *     opts.lookAt   THREE.Vector3 in the person's local space: who/what they mainly look at (e.g. a table
 *                   partner's head). Eyes and head turn to it, seated people also turn their shoulders a
 *                   little. They still glance at the other seats and the food in between.
 *     opts.face     advanced: extra face action-unit weights added on top of the mood, e.g. { browUp: 0.5 }
 *                   (units: smile, grin, jaw, lipsOpen, oo, ee, press, blink, lidDown, squint, browUp, browIn,
 *                   browSoft)
 *     opts.target   'pin' only: THREE.Vector3 (local) where the photo goes; default a wall 0.35 m ahead
 *     opts.scale    override the manifest scale (1 = the original Rocketbox size)
 *     opts.static   true: bake the posed meshes into plain Meshes (CPU skinning once); no motion. The bake
 *                   freezes a moment of the person's motion picked by the seed, so expression, gaze,
 *                   gesture and posture are baked in and differ from person to person.
 *     opts.shadows  cast/receive shadows (default true)
 *   group.userData.update(t, dt)   procedural motion, t in seconds: breathing, posture sway, head turns
 *                                  between partners with the eyes leading, blinks, talking, laughing, chewing,
 *                                  eating, stirring, chopping, tossing, waving. Does nothing when static.
 *   group.userData.person          { id, pose, mood, uniform, holding, seated, height }
 *   Also exported: SEAT_Y, TABLE_Y, TABLE_EDGE_Z, POSE_NAMES.
 *
 * SEATED CONTRACT (all sit-* poses)
 *   Seat cushion top y = 0.48; the group origin is at the FRONT EDGE of the seat (person faces +Z,
 *   the seat extends towards -Z, ~0.45 m deep). Table top y = 0.76, its near edge 0.18 m in front of the
 *   origin. Hips rest on the cushion, thighs forward, feet on the floor (children's feet hang),
 *   hands/forearms are kept above the table top.
 * STANDING CONTRACT
 *   cashier:   hands on a counter top at y ~1.02, ~0.42 m in front.
 *   cook-stir: pot on a stove ~0.90 high, ~0.42 m ahead (ladle reaches ~0.92); cook-flip: pan held
 *              ~1.0 m high over the stove; prep-chop: board top ~0.92, ~0.38 m ahead.
 *   carry-tray: tray held with both hands at ~1.1 m. photo: instant camera at the eye, aiming +Z.
 *   pin:       wall 0.35 m ahead, photo at about eye height + 9 cm (or opts.target).
 *
 * AVATAR IDS (assets/people/manifest.json; Rocketbox source in brackets)
 *   women:    woman-asian-magenta (Female_Adult_03), woman-hijab-olive (Female_Adult_06),
 *             woman-abaya-black (Female_Adult_10), woman-brown-dress (Female_Adult_11),
 *             woman-young-hoodie (Female_Adult_12), woman-blonde-pink (Female_Adult_01),
 *             woman-auburn-blue (Female_Adult_15), woman-black-suit (Business_Female_01),
 *             woman-asian-beige-suit (Business_Female_03), woman-senior-cream (Female_Adult_02),
 *             woman-pink-blazer (Female_Adult_05), woman-brown-jacket (Female_Adult_07),
 *             woman-grey-tee (Female_Adult_08), woman-cardigan-brown (Female_Adult_09),
 *             woman-short-blonde-vest (Female_Adult_13), woman-beige-cardigan (Female_Adult_14)
 *   men:      man-asian-black-tee (Male_Adult_09), man-asian-red-track (Male_Adult_10),
 *             man-asian-navy-suit (Business_Male_02), man-emirati-ghutra (Male_Adult_19),
 *             man-white-kurta (Male_Adult_15), man-black-denim (Male_Adult_12),
 *             man-cap-tracksuit (Male_Adult_17), man-older-tweed (Male_Adult_03),
 *             man-grey-beard-vest (Male_Adult_05), man-afro-hoodie (Male_Adult_04),
 *             man-blazer-rust (Male_Adult_07), man-balding-argyle (Male_Adult_13),
 *             man-blond-blue-tee (Male_Adult_16), man-emirati-kandura (Male_Adult_21)
 *   children: girl-hijab-green (Female_Child_02), boy-orange-jersey (Male_Child_02)
 *   staff:    chef-female (Professions/Chef_Female_01: white chef coat, long apron and cap built in)
 *
 * NOTES
 *   - Materials: MeshStandardMaterial, metalness 0, roughness 0.6-0.85, normal maps, hair/lashes with
 *     alphaTest 0.5 (no sorting issues). The head and body materials carry a small shader addition
 *     (onBeforeCompile): skin texels get wrap lighting, a warm scatter band where light turns to shadow
 *     and a satin finish; eyeballs are glossy and pick up catchlights. Tuned for the ACES tone mapping +
 *     warm HDR scene.environment used in main.js; nothing else is needed.
 *   - Cost: an animated person is 5-6 SkinnedMesh draw calls (~9-11k triangles); update() is ~0.08 ms.
 *     createPerson takes ~4-13 ms. For background crowds use { static: true } (plain meshes, no bones).
 *   - Shadows: if the renderer's shadowMap.autoUpdate is false, set renderer.shadowMap.needsUpdate = true
 *     after adding people (animated people then keep their first-frame shadow).
 *   - Poses are procedural (two-bone IK + hand/finger rotations solved in the person's space),
 *     precomputed as a few key poses per person and blended in update(); no animation clips.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

export const SEAT_Y = 0.48;
export const TABLE_Y = 0.76;
export const TABLE_EDGE_Z = 0.18;
const BRAND_TEAL = '#2f8f8a';
const CASHIER_PINK = '#e89bb5';
const NAME_FONT = '"IBM Plex Sans KR", "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif';

// ----------------------------------------------------------------------------------- loading
let manifest = [];
let loadingPromise = null;
const templates = new Map();

export function loadPeople({ base = 'assets/people/', onProgress } = {}) {
  if (loadingPromise) return loadingPromise;
  if (base && !base.endsWith('/')) base += '/';
  loadingPromise = (async () => {
    const res = await fetch(base + 'manifest.json');
    if (!res.ok) throw new Error(`people: cannot load ${base}manifest.json (${res.status})`);
    const list = await res.json();
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    let done = 0;
    await Promise.all(list.map(async (entry) => {
      const gltf = await loader.loadAsync(base + entry.file);
      templates.set(entry.id, prepareTemplate(gltf.scene, entry));
      done++;
      if (onProgress) onProgress(done / list.length, entry.id);
    }));
    manifest = list;
    return list;
  })();
  loadingPromise.catch(() => { loadingPromise = null; });
  return loadingPromise;
}

export function listPeople() {
  return manifest.map((e) => ({ ...e }));
}

// ----------------------------------------------------------------------------------- small utils
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0), RIGHT_X = V(1, 0, 0), FWD = V(0, 0, 1);
const DEG = Math.PI / 180;
const clamp = THREE.MathUtils.clamp;
const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashString(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

// orthonormal frame quaternion from primary axis x and secondary axis y (columns x, y, x*y)
const _m4 = new THREE.Matrix4();
function frameQuat(x, y, out = new THREE.Quaternion()) {
  const X = x.clone().normalize();
  const Y = y.clone().addScaledVector(X, -y.dot(X)).normalize();
  const Z = new THREE.Vector3().crossVectors(X, Y);
  _m4.makeBasis(X, Y, Z);
  return out.setFromRotationMatrix(_m4);
}

// Bone names: GLTFLoader turns "Bip01 L Thigh" into "Bip01_L_Thigh". Canonical: "L Thigh", "Root" for Bip01.
function canon(name) {
  const n = name.replace(/_/g, ' ').trim();
  if (/^Bip0\d$/.test(n)) return 'Root';
  return n.replace(/^Bip0\d\s*/, '');
}

// ----------------------------------------------------------------------------------- template prep
function prepareTemplate(scene, entry) {
  const tpl = { entry, scene, bones: {}, rest: new Map(), meshes: [], cache: {} };
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    if (o.isBone || /^Bip0\d/.test(o.name)) tpl.bones[canon(o.name)] = o;
    if (o.isSkinnedMesh) {
      tpl.meshes.push(o);
      const m = o.material;
      const part = (m.userData && m.userData.part) || m.name;
      o.userData.part = part;
      m.metalness = 0;
      m.envMapIntensity = 0.7;
      if (part === 'opacity' || part === 'glasses') {
        m.alphaTest = 0.5; m.transparent = false; m.side = THREE.DoubleSide;
        m.alphaToCoverage = true;
      }
      if (part === 'keffiyeh') m.side = THREE.DoubleSide;
      if (m.map) m.map.anisotropy = 4;
    }
  });
  // put the lowest skinned vertex exactly on y = 0 (shift the root bone)
  const restPts = skinnedPoints(tpl.meshes.filter((m) => m.userData.part === 'body'));
  let minY = Infinity;
  for (const p of restPts) minY = Math.min(minY, p.y);
  tpl.bones.Root.position.y -= minY;
  scene.updateMatrixWorld(true);
  for (const [name, b] of Object.entries(tpl.bones)) tpl.rest.set(name, { p: b.position.clone(), q: b.quaternion.clone() });
  tpl.restWorld = {};
  for (const [name, b] of Object.entries(tpl.bones)) tpl.restWorld[name] = new THREE.Vector3().setFromMatrixPosition(b.matrixWorld);
  // hinge signs: elbows / knees bend about the upper bone's local Z
  const zOf = (b) => V(0, 0, 1).applyQuaternion(b.getWorldQuaternion(new THREE.Quaternion()));
  tpl.hinge = {};
  for (const s of ['L', 'R']) {
    const a = tpl.restWorld[`${s} UpperArm`], b = tpl.restWorld[`${s} Forearm`], c = tpl.restWorld[`${s} Hand`];
    const n = new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(b));
    tpl.hinge[`${s}arm`] = Math.sign(zOf(tpl.bones[`${s} UpperArm`]).dot(n)) || -1;
    tpl.hinge[`${s}leg`] = Math.sign(zOf(tpl.bones[`${s} Thigh`]).dot(RIGHT_X)) || -1;
  }
  const rw = tpl.restWorld;
  tpl.dims = {
    upperArm: rw['L UpperArm'].distanceTo(rw['L Forearm']),
    forearm: rw['L Forearm'].distanceTo(rw['L Hand']),
    thigh: rw['L Thigh'].distanceTo(rw['L Calf']),
    calf: rw['L Calf'].distanceTo(rw['L Foot']),
    ankleY: (rw['L Foot'].y + rw['R Foot'].y) / 2,
    hipY: rw.Pelvis.y,
    shoulderY: rw['L UpperArm'].y,
    eyeY: rw.LEye ? rw.LEye.y : rw.Head.y + 0.08,
  };
  let top = 0;
  for (const p of skinnedPoints(tpl.meshes)) top = Math.max(top, p.y);
  tpl.dims.height = top;
  tpl.dims.child = (entry.ageGroup === 'child') || top < 1.55;
  // skin + eye shading on the head and body materials
  const tone = sampleSkinTone(tpl);
  for (const m of tpl.meshes) {
    const part = m.userData.part;
    if (part !== 'head' && part !== 'body' && part !== 'all') continue;
    addEyeMask(m);
    patchSkinMaterial(m.material, tone);
  }
  return tpl;
}

// CPU skinning of all vertices of the given meshes (current pose), in world space.
function skinnedPoints(meshes, out = []) {
  const v = new THREE.Vector3();
  for (const m of meshes) {
    m.updateMatrixWorld(true);
    m.skeleton.update();
    const pos = m.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      m.applyBoneTransform(i, v);
      out.push(v.clone().applyMatrix4(m.matrixWorld));
    }
  }
  return out;
}

// Rest-pose analysis of the body surface, done once per avatar on demand.
function restData(tpl) {
  if (tpl.cache.rest) return tpl.cache.rest;
  const t = tpl;
  // reset template to rest
  for (const [name, r] of t.rest) { t.bones[name].position.copy(r.p); t.bones[name].quaternion.copy(r.q); }
  t.scene.updateMatrixWorld(true);
  const data = { meshes: {} };
  for (const m of t.meshes) {
    m.skeleton.update();
    const g = m.geometry, pos = g.attributes.position, nrm = g.attributes.normal;
    const si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
    const n = pos.count;
    const P = new Float32Array(n * 3), N = new Float32Array(n * 3);
    const dom = new Array(n);
    const v = new THREE.Vector3(), nn = new THREE.Vector3();
    const nm = new THREE.Matrix3().getNormalMatrix(m.bindMatrix);
    const bm = m.skeleton.boneMatrices;
    const W = [];
    for (let i = 0; i < n; i++) {
      v.fromBufferAttribute(pos, i);
      m.applyBoneTransform(i, v); v.applyMatrix4(m.matrixWorld);
      P[i * 3] = v.x; P[i * 3 + 1] = v.y; P[i * 3 + 2] = v.z;
      // normal: blend of rigid bone rotations applied to the bind-space normal
      nn.fromBufferAttribute(nrm, i).applyMatrix3(nm);
      let nx = 0, ny = 0, nz = 0, best = -1, bw = -1;
      const ws = [];
      for (let k = 0; k < 4; k++) {
        const w = sw.getComponent(i, k); if (w <= 0) continue;
        const j = si.getComponent(i, k);
        const e = bm.subarray(j * 16, j * 16 + 16);
        nx += w * (e[0] * nn.x + e[4] * nn.y + e[8] * nn.z);
        ny += w * (e[1] * nn.x + e[5] * nn.y + e[9] * nn.z);
        nz += w * (e[2] * nn.x + e[6] * nn.y + e[10] * nn.z);
        if (w > bw) { bw = w; best = j; }
        ws.push([m.skeleton.bones[j].name, w]);
      }
      const l = Math.hypot(nx, ny, nz) || 1;
      N[i * 3] = nx / l; N[i * 3 + 1] = ny / l; N[i * 3 + 2] = nz / l;
      dom[i] = canon(m.skeleton.bones[best].name);
      W.push(ws);
    }
    data.meshes[m.userData.part] = { mesh: m, P, N, dom, W, index: g.index ? g.index.array : null, count: n };
  }
  tpl.cache.rest = data;
  return data;
}

const ARM_BONE = /(Clavicle|UpperArm|Forearm|Hand|Finger)/;

// ----------------------------------------------------------------------------------- the rig
class Rig {
  constructor(root, tpl) {
    this.root = root;
    this.tpl = tpl;
    this.b = {};
    this.meshes = [];
    root.traverse((o) => {
      if (o.isBone || /^Bip0\d/.test(o.name)) this.b[canon(o.name)] = o;
      if (o.isSkinnedMesh) this.meshes.push(o);
    });
    this.all = Object.values(this.b);
    this.names = Object.keys(this.b);
    this.k = root.scale.x;
    this.D = {};
    for (const [key, v] of Object.entries(tpl.dims)) this.D[key] = typeof v === 'number' ? v * this.k : v;
    this._q = new THREE.Quaternion();
    this._v = new THREE.Vector3();
  }
  reset() {
    for (const [name, r] of this.tpl.rest) {
      const b = this.b[name]; if (!b) continue;
      b.position.copy(r.p); b.quaternion.copy(r.q);
    }
    this.root.updateMatrixWorld(true);
  }
  wp(name) { return new THREE.Vector3().setFromMatrixPosition(this.b[name].matrixWorld); }
  wq(name) { const q = new THREE.Quaternion(); this.b[name].matrixWorld.decompose(this._v, q, new THREE.Vector3()); return q; }
  setWQ(name, q) {
    const b = this.b[name];
    const pq = new THREE.Quaternion();
    b.parent.matrixWorld.decompose(this._v, pq, new THREE.Vector3());
    b.quaternion.copy(pq.invert().multiply(q)).normalize();
    b.updateMatrixWorld(true);
  }
  rotW(name, axis, angle) {
    if (!angle) return;
    const q = new THREE.Quaternion().setFromAxisAngle(axis.clone().normalize(), angle);
    this.setWQ(name, q.multiply(this.wq(name)));
  }
  rotWQ(name, q) { this.setWQ(name, q.clone().multiply(this.wq(name))); }
  axis(name, local) { return local.clone().applyQuaternion(this.wq(name)); }

  // move the root bone (pelvis area) to a world position
  setRootPos(p) {
    const b = this.b.Root;
    const inv = new THREE.Matrix4().copy(b.parent.matrixWorld).invert();
    b.position.copy(p.clone().applyMatrix4(inv));
    b.updateMatrixWorld(true);
  }

  // Analytic two-bone IK in world space. The upper bone keeps its natural hinge (local Z)
  // perpendicular to the limb plane, so elbows and knees only bend the way they can.
  ik(upper, lower, end, target, pole, hingeSign) {
    const pa = this.wp(upper), pb = this.wp(lower), pc = this.wp(end);
    const l1 = pa.distanceTo(pb), l2 = pb.distanceTo(pc);
    const toT = target.clone().sub(pa);
    const d = clamp(toT.length(), Math.abs(l1 - l2) + 1e-3, (l1 + l2) * 0.999);
    const u = toT.normalize();
    const v = pole.clone().sub(pa); v.addScaledVector(u, -v.dot(u));
    if (v.lengthSq() < 1e-8) v.set(0, -1, 0).addScaledVector(u, -u.y);
    v.normalize();
    const cosA = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
    const sinA = Math.sqrt(1 - cosA * cosA);
    const knee = pa.clone().addScaledVector(u, cosA * l1).addScaledVector(v, sinA * l1);
    const endP = pa.clone().addScaledVector(u, d);
    const d0 = pb.clone().sub(pa).normalize();
    const n0 = this.axis(upper, FWD).multiplyScalar(hingeSign);
    const d1 = knee.clone().sub(pa).normalize();
    const n1 = new THREE.Vector3().crossVectors(v, u).normalize();
    const R = frameQuat(d1, n1).multiply(frameQuat(d0, n0).invert());
    this.rotWQ(upper, R);
    const pb2 = this.wp(lower), pc2 = this.wp(end);
    const q2 = new THREE.Quaternion().setFromUnitVectors(pc2.sub(pb2).normalize(), endP.sub(pb2).normalize());
    this.rotWQ(lower, q2);
  }

  // Current hand frame: dir (wrist -> middle finger), side (pinky -> index), palm normal.
  handFrame(s) {
    const h = this.wp(`${s} Hand`);
    const mid = this.wp(`${s} Finger2`);
    const dir = mid.clone().sub(h).normalize();
    const side = this.wp(`${s} Finger1`).sub(this.wp(`${s} Finger4`));
    side.addScaledVector(dir, -side.dot(dir)).normalize();
    const palm = s === 'L' ? new THREE.Vector3().crossVectors(dir, side) : new THREE.Vector3().crossVectors(side, dir);
    return { pos: h, mid, dir, side, palm: palm.normalize() };
  }
  // Palm centre (the point a held object sits against)
  gripPoint(s, depth = 0.025) {
    const f = this.handFrame(s);
    return f.pos.clone().lerp(f.mid, 0.72).addScaledVector(f.palm, depth);
  }

  // Orient the hand. o = { dir, palm } (fingers + palm normal) or { thumb, palm } (grips).
  // Part of the twist about the forearm goes to the forearm so the wrist doesn't candy-wrap.
  orientHand(s, o, twistShare = 0.45) {
    let dir, palm;
    if (o.thumb) {
      palm = o.palm.clone().normalize();
      const side = o.thumb.clone().addScaledVector(palm, -o.thumb.dot(palm)).normalize();
      dir = s === 'L' ? new THREE.Vector3().crossVectors(side, palm) : new THREE.Vector3().crossVectors(palm, side);
    } else { dir = o.dir.clone().normalize(); palm = o.palm.clone(); }
    palm.addScaledVector(dir, -palm.dot(dir)).normalize();
    const cur = this.handFrame(s);
    const R = frameQuat(dir, palm).multiply(frameQuat(cur.dir, cur.palm).invert());
    // swing/twist about the forearm axis
    const fa = this.wp(`${s} Hand`).sub(this.wp(`${s} Forearm`)).normalize();
    const proj = fa.dot(V(R.x, R.y, R.z));
    const tw = new THREE.Quaternion(fa.x * proj, fa.y * proj, fa.z * proj, R.w).normalize();
    if (twistShare > 0) this.rotWQ(`${s} Forearm`, new THREE.Quaternion().slerp(tw, twistShare));
    const cur2 = this.handFrame(s);
    const R2 = frameQuat(dir, palm).multiply(frameQuat(cur2.dir, cur2.palm).invert());
    this.rotWQ(`${s} Hand`, R2);
  }

  // Finger curl in radians per joint. c = { thumb:[a,b,c], index:[..], middle, ring, pinky } or a number.
  curl(s, c) {
    const f = this.handFrame(s);
    const k = new THREE.Vector3().crossVectors(f.dir, f.palm).normalize();
    const names = { index: 1, middle: 2, ring: 3, pinky: 4 };
    for (const [finger, i] of Object.entries(names)) {
      const a = typeof c === 'number' ? [c, c * 1.1, c * 0.8] : (c[finger] || [0, 0, 0]);
      const chain = [`${s} Finger${i}`, `${s} Finger${i}1`, `${s} Finger${i}2`];
      chain.forEach((n, j) => { if (this.b[n]) this.rotW(n, k, a[j]); });
    }
    const t = typeof c === 'number' ? [c * 0.3, c * 0.5, c * 0.5] : (c.thumb || [0, 0, 0]);
    if (this.b[`${s} Finger0`]) {
      const tb = this.wp(`${s} Finger0`), tm = this.wp(`${s} Finger01`);
      const td = tm.sub(tb).normalize();
      const kt = new THREE.Vector3().crossVectors(td, f.palm).normalize();
      // opposition: swing the thumb base towards the palm, then bend its joints
      const opp = t[3] !== undefined ? t[3] : t[0] * 0.6;
      this.rotW(`${s} Finger0`, f.dir, (s === 'L' ? -1 : 1) * opp);
      this.rotW(`${s} Finger0`, kt, t[0] * 0.5);
      this.rotW(`${s} Finger01`, kt, t[1]);
      if (this.b[`${s} Finger02`]) this.rotW(`${s} Finger02`, kt, t[2]);
    }
  }

  // Bend the spine (radians): pitch > 0 leans forward, yaw > 0 turns to the person's left, roll > 0 tilts left.
  lean(pitch = 0, yaw = 0, roll = 0, w = [0.3, 0.35, 0.35]) {
    // Biped thighs hang off Spine: keep the legs planted while the upper body bends
    this.keepWorld(['L Thigh', 'R Thigh'], () => {
      ['Spine', 'Spine1', 'Spine2'].forEach((n, i) => {
        this.rotW(n, RIGHT_X, pitch * w[i]);
        this.rotW(n, UP, yaw * w[i]);
        this.rotW(n, FWD, -roll * w[i]);
      });
    });
  }
  // Torso angle from vertical (pelvis -> neck line, forward > 0). Rocketbox rest poses sit at about -8 degrees.
  torsoAngle() { const a = this.wp('Pelvis'), b = this.wp('Neck'); return Math.atan2(b.z - a.z, b.y - a.y); }
  leanTo(angle, yaw = 0, roll = 0) {
    for (let i = 0; i < 3; i++) this.lean(angle - this.torsoAngle(), i === 0 ? yaw : 0, i === 0 ? roll : 0);
  }
  // Lift (shrug > 0) or push forward (protract > 0) a shoulder.
  shoulder(s, shrug = 0, protract = 0) {
    const n = `${s} Clavicle`;
    const d = this.wp(`${s} UpperArm`).sub(this.wp(n)).normalize();
    this.rotW(n, new THREE.Vector3().crossVectors(d, UP), shrug);
    const d2 = this.wp(`${s} UpperArm`).sub(this.wp(n)).normalize();
    this.rotW(n, new THREE.Vector3().crossVectors(d2, FWD), protract);
  }
  eyes() {
    const b = this.b;
    if (b.LEye && b.REye) return this.wp('LEye').add(this.wp('REye')).multiplyScalar(0.5);
    return this.wp('Head').add(V(0, 0.08, 0.08));
  }
  mouth() {
    const b = this.b;
    if (b.MUpperLip && b.MBottomLip) return this.wp('MUpperLip').add(this.wp('MBottomLip')).multiplyScalar(0.5);
    return this.eyes().add(V(0, -0.075, 0.02));
  }
  faceDir() {
    // head forward = rest-forward (+Z) carried by the head rotation
    const q = this.wq('Head').multiply(this.tpl.headRestInv || (this.tpl.headRestInv = this.restWorldQ('Head').invert()));
    return FWD.clone().applyQuaternion(q);
  }
  restWorldQ(name) { return this.tpl.bones[name].getWorldQuaternion(new THREE.Quaternion()); }
  // Turn neck + head towards a world point (split 40/60); amount scales the turn.
  look(target, amount = 1, maxYaw = 70 * DEG) {
    // Biped clavicles hang off the neck: keep the arms where they are while the head turns
    this.keepWorld(['L Clavicle', 'R Clavicle'], () => {
      const e = this.eyes();
      const d = target.clone().sub(e).normalize();
      const f = this.faceDir();
      let yaw = Math.atan2(d.x, d.z) - Math.atan2(f.x, f.z);
      while (yaw > Math.PI) yaw -= 2 * Math.PI;
      while (yaw < -Math.PI) yaw += 2 * Math.PI;
      yaw = clamp(yaw, -maxYaw, maxYaw) * amount;
      this.rotW('Neck', UP, yaw * 0.4);
      this.rotW('Head', UP, yaw * 0.6);
      const f2 = this.faceDir();
      const pitch = clamp(Math.asin(clamp(d.y, -1, 1)) - Math.asin(clamp(f2.y, -1, 1)), -60 * DEG, 45 * DEG) * amount;
      const k = new THREE.Vector3().crossVectors(f2, UP).normalize();
      this.rotW('Neck', k, pitch * 0.4);
      this.rotW('Head', k, pitch * 0.6);
    });
  }
  // run fn, then put the named bones back to their previous world transforms
  keepWorld(names, fn) {
    const saved = names.filter((n) => this.b[n]).map((n) => [this.b[n], this.b[n].matrixWorld.clone()]);
    fn();
    const m = new THREE.Matrix4();
    for (const [b, w] of saved) {
      m.copy(b.parent.matrixWorld).invert().multiply(w);
      m.decompose(b.position, b.quaternion, b.scale);
      b.scale.set(1, 1, 1);
      b.updateMatrixWorld(true);
    }
  }
  resetFingers(s) {
    for (const n of this.names) if (n.startsWith(`${s} Finger`)) this.b[n].quaternion.copy(this.tpl.rest.get(n).q);
    this.b[`${s} Hand`].updateMatrixWorld(true);
  }
  footFlat(s, yaw = 0, pitch = 0) {
    const q = this.restWorldQ(`${s} Foot`);
    const out = new THREE.Quaternion().setFromAxisAngle(UP, yaw).multiply(new THREE.Quaternion().setFromAxisAngle(RIGHT_X, pitch)).multiply(q);
    this.setWQ(`${s} Foot`, out);
  }
  snapshot() {
    const n = this.all.length;
    const q = new Float32Array(n * 4), p = new Float32Array(n * 3);
    this.all.forEach((b, i) => { b.quaternion.toArray(q, i * 4); b.position.toArray(p, i * 3); });
    return { q, p };
  }
  apply(snap) {
    this.all.forEach((b, i) => { b.quaternion.fromArray(snap.q, i * 4); b.position.fromArray(snap.p, i * 3); });
  }
  // skinned vertex positions (world) of a mesh, only indices in list
  skinned(part, list) {
    const m = this.meshes.find((x) => x.userData.part === part);
    if (!m) return [];
    m.skeleton.update();
    const pos = m.geometry.attributes.position, v = new THREE.Vector3(), out = [];
    for (const i of list) { v.fromBufferAttribute(pos, i); m.applyBoneTransform(i, v); out.push(v.clone().applyMatrix4(m.matrixWorld)); }
    return out;
  }
}

// vertex index lists by dominant bone (rest analysis), cached per template
function vertsWhere(tpl, part, pred, key) {
  tpl.cache.vsets = tpl.cache.vsets || {};
  const k = part + ':' + key;
  if (tpl.cache.vsets[k]) return tpl.cache.vsets[k];
  const rd = restData(tpl).meshes[part];
  const list = [];
  if (rd) for (let i = 0; i < rd.count; i++) if (pred(rd.dom[i], rd.P[i * 3], rd.P[i * 3 + 1], rd.P[i * 3 + 2], i)) list.push(i);
  return (tpl.cache.vsets[k] = list);
}

// ----------------------------------------------------------------------------------- pose helpers
const GRIP = {
  relaxed: { thumb: [0.15, 0.15, 0.1], index: [0.18, 0.25, 0.15], middle: [0.22, 0.3, 0.18], ring: [0.26, 0.35, 0.2], pinky: [0.3, 0.38, 0.22] },
  rest: { thumb: [-0.45, 0.05, 0.05, -0.1], index: [0.1, 0.1, 0.06], middle: [0.11, 0.11, 0.06], ring: [0.13, 0.13, 0.08], pinky: [0.15, 0.15, 0.08] },
  flat: { thumb: [0.05, 0.05, 0.05], index: [0.06, 0.08, 0.05], middle: [0.07, 0.09, 0.05], ring: [0.08, 0.1, 0.06], pinky: [0.1, 0.12, 0.06] },
  open: { thumb: [0.1, 0.05, 0.0], index: [0.05, 0.08, 0.05], middle: [0.08, 0.1, 0.06], ring: [0.12, 0.14, 0.08], pinky: [0.16, 0.18, 0.1] },
  fist: { thumb: [0.6, 0.6, 0.6], index: [1.25, 1.35, 0.9], middle: [1.3, 1.4, 0.95], ring: [1.35, 1.45, 0.95], pinky: [1.4, 1.45, 0.95] },
  cylinder: { thumb: [0.55, 0.45, 0.35], index: [0.75, 0.75, 0.5], middle: [0.8, 0.8, 0.55], ring: [0.85, 0.85, 0.55], pinky: [0.9, 0.85, 0.55] },
  handle: { thumb: [0.6, 0.3, 0.2], index: [1.0, 1.1, 0.7], middle: [1.1, 1.2, 0.8], ring: [1.15, 1.25, 0.8], pinky: [1.2, 1.25, 0.8] },
  pencil: { thumb: [0.45, 0.25, 0.2], index: [0.35, 0.45, 0.3], middle: [0.5, 0.6, 0.4], ring: [0.9, 1.0, 0.7], pinky: [1.0, 1.05, 0.7] },
  pinch: { thumb: [0.5, 0.3, 0.2], index: [0.45, 0.5, 0.3], middle: [0.4, 0.45, 0.3], ring: [0.45, 0.5, 0.3], pinky: [0.5, 0.55, 0.35] },
  edge: { thumb: [0.3, 0.1, 0.05], index: [0.55, 0.5, 0.3], middle: [0.6, 0.55, 0.3], ring: [0.65, 0.6, 0.3], pinky: [0.7, 0.6, 0.3] },
  claw: { thumb: [0.4, 0.3, 0.2], index: [0.7, 0.9, 0.4], middle: [0.7, 0.9, 0.4], ring: [0.75, 0.95, 0.45], pinky: [0.8, 0.95, 0.45] },
  phone: { thumb: [0.35, 0.1, 0.05], index: [0.6, 0.6, 0.35], middle: [0.65, 0.65, 0.35], ring: [0.7, 0.7, 0.35], pinky: [0.75, 0.7, 0.35] },
  wave: { thumb: [0.05, 0.0, 0.0], index: [0.0, 0.03, 0.02], middle: [0.0, 0.03, 0.02], ring: [0.03, 0.05, 0.03], pinky: [0.06, 0.08, 0.05] },
};
const HOLD_GRIP = { chopsticks: 'pencil', glass: 'cylinder', phone: 'phone', tray: 'edge', camera: 'edge', pan: 'handle', knife: 'handle', polaroid: 'pinch', ladle: 'handle' };
const sideX = (s) => (s === 'L' ? 1 : -1);

// Holding a prop in a casual pose (stand, stand-talk, sit, sit-talk): the right hand brings it up in front.
const CASUAL_HOLD = new Set(['stand', 'stand-talk', 'sit', 'sit-talk']);
function holdInFront(r, kind, seated) {
  const D = r.D;
  const look = (p) => r.look(p, 0.8);
  const thumbUp = { thumb: V(0.15, 1, 0.1), palm: V(0.95, 0, 0.3) };
  const palmUp = { dir: V(0.3, 0.35, 1), palm: V(0.25, 1, -0.4) };
  const base = seated ? V(-0.13, TABLE_Y + 0.06, TABLE_EDGE_Z + 0.1 * REACH) : V(-0.16, D.hipY + 0.1, 0.21);
  let spec;
  switch (kind) {
    case 'glass': spec = { pos: base, hand: thumbUp }; break;
    case 'phone': case 'polaroid': case 'camera': case 'chopsticks':
      spec = { pos: base.clone().add(V(0.03, seated ? 0.07 : 0.05, 0.01)), hand: palmUp }; break;
    case 'tray': spec = seated ? { pos: base, hand: thumbUp } : { pos: V(-0.27, D.shoulderY - 0.07, 0.17), pole: V(-0.6, -0.8, -0.2), hand: { dir: V(0.35, 0.05, 1), palm: V(0, 1, 0) } }; break;
    default: spec = { pos: base, hand: { thumb: V(0.1, -0.1, 1), palm: V(1, 0, 0) } };   // knife, pan, ladle
  }
  r.resetFingers('R');
  const full = { pole: V(-0.35, -0.8, -0.45), grip: kind === 'tray' && !seated ? 'flat' : HOLD_GRIP[kind], twist: 0.5, ...spec };
  if (seated) solveTableArm(r, 'R', full); else arm(r, 'R', full);
  if (['phone', 'polaroid', 'camera'].includes(kind)) look(r.gripPoint('R', 0.03));
}

// arm solve: target wrist position, elbow pole direction (relative to shoulder), hand orientation and curl
function arm(r, s, { pos, pole, hand, grip = 'relaxed', twist = 0.45, shrug = 0, protract = 0 }) {
  if (shrug || protract) r.shoulder(s, shrug, protract);
  const sh = r.wp(`${s} UpperArm`);
  r.ik(`${s} UpperArm`, `${s} Forearm`, `${s} Hand`, pos, sh.clone().add(pole), r.tpl.hinge[`${s}arm`]);
  if (hand) r.orientHand(s, hand, twist);
  if (grip) r.curl(s, GRIP[grip] || grip);
}

// relaxed hanging arm next to the thigh
function relaxedArm(r, s, rng, extra = {}) {
  const t = r.tpl;
  const sh = r.wp(`${s} UpperArm`);
  const len = r.D.upperArm + r.D.forearm;
  const hipW = hipHalfWidth(t) * r.k;
  const x = r.wp('Pelvis').x + sideX(s) * (hipW + 0.045 + rng() * 0.015);
  const pos = V(x, sh.y - len * 0.94, 0.015 + rng() * 0.03);
  arm(r, s, {
    pos,
    pole: V(sideX(s) * 0.25, -0.4, -0.6),
    hand: { dir: V(sideX(s) * 0.05, -1, 0.12), palm: V(-sideX(s), 0, 0.15) },
    grip: 'relaxed', twist: 0.3, ...extra,
  });
}

function hipHalfWidth(t) {
  if (t.cache.hipW) return t.cache.hipW;
  const rd = restData(t).meshes.body;
  const hy = t.dims.hipY;
  let w = 0.15;
  for (let i = 0; i < rd.count; i++) {
    const y = rd.P[i * 3 + 1];
    if (y < hy - 0.15 || y > hy + 0.02 || ARM_BONE.test(rd.dom[i])) continue;
    w = Math.max(w, Math.abs(rd.P[i * 3]));
  }
  return (t.cache.hipW = Math.min(w, 0.26));
}

// ---- standing: weight on one leg (hip out and up on that side, the other knee soft, shoulders counter-tilted)
function standBody(r, c, amt = 1) {
  const side = c.v.side, a = amt * (0.65 + 0.35 * c.v.lean), k = r.k;
  const ankle = { L: r.wp('L Foot'), R: r.wp('R Foot') };
  r.setRootPos(r.wp('Root').add(V(side * 0.03 * a * k, -0.007 * a * k, 0.004 * a * k)));
  r.rotW('Pelvis', FWD, side * 3.2 * DEG * a);
  const free = side > 0 ? 'R' : 'L';
  ankle[free].add(V(-side * 0.025 * a * k, 0, 0.04 * a * k));          // the free foot rests a little forward and out
  for (const s of ['L', 'R']) {
    const hip = r.wp(`${s} Thigh`);
    r.ik(`${s} Thigh`, `${s} Calf`, `${s} Foot`, ankle[s], hip.clone().add(V(sideX(s) * 0.08, 0, 1)), r.tpl.hinge[`${s}leg`]);
    r.footFlat(s, s === free ? sideX(s) * 9 * DEG * a : 0, 0);
  }
  r.rotW('Spine1', FWD, -side * 2.6 * DEG * a);
  r.rotW('Spine2', FWD, -side * 2.2 * DEG * a);
  r.rotW('Spine2', UP, -side * 3 * DEG * a * c.v.yaw);
}

// ---- seated: what the hand that isn't busy does
function restArm(r, c, s, kind) {
  const sx = sideX(s), k = r.k;
  if (kind === 'lap') {
    const hip = r.wp(`${s} Thigh`), knee = r.wp(`${s} Calf`);
    const pos = hip.clone().lerp(knee, 0.62).add(V(sx * 0.01, 0.085 * k, 0));
    arm(r, s, { pos, pole: V(sx * 0.55, -0.3, -0.8), hand: { dir: V(-sx * 0.3, -0.12, 1), palm: V(-sx * 0.15, -1, 0) }, grip: 'relaxed', twist: 0.5 });
  } else if (kind === 'inward') {
    // forearm lying across the table edge, hand towards the middle
    solveTableArm(r, s, { pos: V(sx * 0.075, TABLE_Y + 0.034, TABLE_EDGE_Z + 0.085 * REACH - (1 - REACH) * 0.04), pole: V(sx * 0.8, -0.55, -0.25), hand: { dir: V(-sx * 0.9, -0.03, 0.42), palm: V(0, -1, 0) }, grip: 'relaxed', twist: 0.5 });
  } else {
    solveTableArm(r, s, tableHand(sx * (0.155 + 0.03 * c.v.lean), 0.05 + 0.04 * c.v.arm2));
  }
}
const pickArm = (x, table, inward) => (x < table ? 'table' : x < table + inward ? 'inward' : 'lap');

// ---- seated base: pelvis on the seat, thighs forward, feet on the floor (or hanging for kids)
function seatBody(r, rng, { lean = 12 * DEG, yaw = 0, roll = 0 } = {}) {
  const t = r.tpl, D = r.D;
  // children sit further forward and more upright (the table is at their chest)
  const hipZ = -(D.thigh * (D.child ? 0.32 : 0.45));
  const hipY = SEAT_Y + (t.cache.seatDrop || 0.1) * r.k;
  if (D.child) lean = lean * 0.35;
  // Root and Pelvis share a position in Rocketbox rigs; make sure the pelvis lands at (0, hipY, hipZ)
  const off = r.wp('Pelvis').sub(r.wp('Root'));
  r.setRootPos(V(0, hipY, hipZ).sub(off));
  // slight posterior pelvic tilt is part of sitting; the spine leans forward over it
  r.rotW('Pelvis', RIGHT_X, -5 * DEG);
  r.leanTo(lean, yaw, roll);
  // legs: feet on the floor when they reach with the thighs at most ~15 degrees down, else they hang
  for (const s of ['L', 'R']) {
    const hip = r.wp(`${s} Thigh`);
    const ankleY = D.ankleY;
    const spread = sideX(s) * (0.02 + rng() * 0.03);
    const fwd = D.thigh * 0.93 + 0.07 + rng() * 0.04;
    const reaches = hip.y - D.thigh * Math.sin(15 * DEG) - D.calf * 0.985 - ankleY < 0;
    let target;
    if (reaches) {
      target = V(hip.x + spread, ankleY, hip.z + fwd);
    } else {
      // thighs rest on the seat, shins hang slightly forward, feet relaxed
      const knee = hip.clone().add(V(spread * 0.5, -0.025, D.thigh * 0.99));
      const swing = 0.12 + rng() * 0.25;
      target = knee.add(V(spread * 0.5, -D.calf * Math.cos(swing), D.calf * Math.sin(swing)));
    }
    r.ik(`${s} Thigh`, `${s} Calf`, `${s} Foot`, target, hip.clone().add(V(sideX(s) * 0.05, 0.4, 1)), t.hinge[`${s}leg`]);
    const onFloor = r.wp(`${s} Foot`).y < ankleY + 0.02;
    r.footFlat(s, sideX(s) * (6 + rng() * 6) * DEG, onFloor ? 0 : 22 * DEG);
  }
}

// After the legs are posed, measure where the buttocks touch and correct the seat height once per avatar.
function calibrateSeat(r) {
  const t = r.tpl;
  if (t.cache.seatDrop !== undefined) return false;
  const list = vertsWhere(t, 'body', (dom, x, y) => !ARM_BONE.test(dom) && y < t.dims.hipY + 0.05 && y > t.dims.hipY - 0.45, 'seat');
  const pts = r.skinned('body', list);
  const hipZ = r.wp('Pelvis').z;
  let minY = Infinity;
  for (const p of pts) if (p.z < hipZ + 0.12 && Math.abs(p.x) < 0.2) minY = Math.min(minY, p.y);
  const pelvisY = r.wp('Pelvis').y;
  // cushions compress ~1.5 cm under a person
  t.cache.seatDrop = clamp(pelvisY - minY - 0.015, 0.04, 0.16) / r.k;
  return true;
}

// Keep forearms/hands above the table top: returns how much the wrist must be lifted (m)
function tablePenetration(r, s) {
  const t = r.tpl;
  const list = vertsWhere(t, 'body', (dom) => dom === `${s} Forearm` || dom === `${s} Hand` || dom.startsWith(`${s} Finger`), 'arm' + s);
  const pts = r.skinned('body', list);
  let pen = 0;
  for (const p of pts) if (p.z > TABLE_EDGE_Z + 0.01 && p.y < TABLE_Y + 0.004) pen = Math.max(pen, TABLE_Y + 0.004 - p.y);
  return pen;
}

// hand resting on the table (palm down) at local (x, z)
let REACH = 1;   // < 1 for children (set per person while posing)
function tableHand(x, z, lift = 0, spread = 0) {
  return {
    pos: V(x * (REACH < 1 ? 0.85 : 1), TABLE_Y + 0.03 + lift, TABLE_EDGE_Z + z * REACH - (1 - REACH) * 0.04),
    hand: { dir: V(-x * 1.2 + spread, -0.03, 1), palm: V(-x * 0.6, -1, 0) },
    grip: 'rest',
  };
}

function solveTableArm(r, s, spec) {
  const pole = spec.pole || V(sideX(s) * 0.3, -0.8, -0.4);
  let lift = 0;
  for (let i = 0; i < 3; i++) {
    const snapQ = [`${s} Clavicle`, `${s} UpperArm`, `${s} Forearm`, `${s} Hand`].map((n) => r.b[n].quaternion.clone());
    const fingers = r.names.filter((n) => n.startsWith(`${s} Finger`)).map((n) => [n, r.b[n].quaternion.clone()]);
    arm(r, s, { ...spec, pole, pos: spec.pos.clone().add(V(0, lift, 0)) });
    const pen = tablePenetration(r, s);
    if (pen < 0.003 || i === 2) break;
    lift += pen + 0.004;
    // undo and retry higher
    [`${s} Clavicle`, `${s} UpperArm`, `${s} Forearm`, `${s} Hand`].forEach((n, j) => r.b[n].quaternion.copy(snapQ[j]));
    fingers.forEach(([n, q]) => r.b[n].quaternion.copy(q));
    r.b[`${s} Clavicle`].updateMatrixWorld(true);
  }
}

// ----------------------------------------------------------------------------------- poses
// Each pose: build(r, ctx, phase) poses the rig from rest. samples: phase values precomputed for
// animation; drive(t, ctx) -> fractional sample index. idle: additive motion (breathing, sway, glances).
// gaze: who/what the person looks at over time (see gazeTargets). c.v holds the person's fixed variation.
const seatTurn = (c, max = 14) => (c.lookTarget ? clamp(Math.atan2(c.lookTarget.x, Math.max(0.2, c.lookTarget.z)) * 0.35, -max * DEG, max * DEG) : c.v.yaw * 7 * DEG);
const POSES = {
  stand: {
    samples: [0],
    gaze: 'front',
    build(r, c) {
      standBody(r, c, 1);
      r.lean(c.rnd(-1, 2) * DEG, c.rnd(-3, 3) * DEG, 0);
      relaxedArm(r, 'L', c.rng); relaxedArm(r, 'R', c.rng);
      c.lookDefault(r);
    },
    idle: { look: 0.6, breathe: 1, sway: 1 },
  },
  'stand-talk': {
    samples: [0, 1, 2],
    cyclic: true,
    gaze: 'front',
    build(r, c, p) {
      standBody(r, c, 0.9);
      r.lean(c.rnd(0, 2) * DEG, c.rnd(-4, 4) * DEG, 0);
      relaxedArm(r, 'L', c.rng);
      const g = [V(-0.17, 0, 0.24), V(-0.12, 0.06, 0.28), V(-0.22, 0.03, 0.2)][p];
      const px = r.wp('Pelvis').x;
      arm(r, 'R', {
        pos: V(px + g.x, c.D.hipY + 0.14 + g.y, g.z), pole: V(-0.35, -0.6, -0.4),
        hand: { dir: V(0.35, 0.1 + p * 0.1, 1), palm: V(0.45, 0.9, 0) }, grip: 'open', twist: 0.5,
      });
      c.lookDefault(r);
    },
    drive: (t, c) => 1 + Math.sin(t * 0.9 + c.ph) * 0.8 + Math.sin(t * 2.1 + c.ph * 2) * 0.2,
    idle: { look: 0.5, breathe: 1, sway: 0.8 },
  },
  wave: {
    samples: [0, 1],
    gaze: 'front',
    build(r, c, p) {
      standBody(r, c, 0.8);
      r.lean(0, c.rnd(-3, 3) * DEG, 0);
      relaxedArm(r, 'L', c.rng);
      const e = r.eyes();
      arm(r, 'R', {
        pos: V(e.x - 0.33 + (p - 0.5) * 0.1, e.y - 0.02, 0.1), pole: V(-0.7, -0.5, -0.1), shrug: 8 * DEG,
        hand: { dir: V(-0.1 - (p - 0.5) * 0.9, 1, 0.08), palm: V(0, 0.05, 1) }, grip: 'wave', twist: 0.4,
      });
      c.lookDefault(r);
    },
    drive: (t, c) => 0.5 + 0.5 * Math.sin(t * 9.0 + c.ph),
    idle: { look: 0.3, breathe: 1, sway: 0.6 },
  },
  cashier: {
    samples: [0, 1],
    gaze: 'cashier',
    build(r, c, p) {
      standBody(r, c, 0.45);
      r.lean(7 * DEG, c.rnd(-3, 3) * DEG, 0);
      const y = 1.02 + 0.035;
      arm(r, 'L', { pos: V(0.15, y + (1 - p) * 0.012, 0.4), pole: V(0.45, -0.8, -0.4), hand: { dir: V(-0.2, -0.25, 1), palm: V(0, -1, 0.05) }, grip: 'relaxed', twist: 0.5 });
      arm(r, 'R', { pos: V(-0.12, y + p * 0.012, 0.42), pole: V(-0.45, -0.8, -0.4), hand: { dir: V(0.2, -0.25, 1), palm: V(0, -1, 0.05) }, grip: 'relaxed', twist: 0.5 });
      c.focus = V(0, 1.02, 0.5);
      r.look(c.focus.clone().lerp(V(0, 1.55, 1.6), 0.25), 0.9);
    },
    drive: (t, c) => (Math.sin(t * 7 + c.ph) > 0.3 ? 1 : 0) * (Math.sin(t * 0.7 + c.ph) > -0.2 ? 1 : 0.2),
    idle: { look: 0.3, breathe: 1, sway: 0.3 },
  },
  'carry-tray': {
    samples: [0],
    defaultHolding: 'tray',
    gaze: 'tray',
    build(r, c) {
      standBody(r, c, 0.4);
      r.lean(-3 * DEG, 0, 0);
      const y = 1.08, z = 0.34, x = 0.215;
      arm(r, 'L', { pos: V(x, y, z), pole: V(0.5, -0.8, -0.5), hand: { thumb: V(0, 0.4, 1), palm: V(-1, 0.25, 0) }, grip: 'edge', twist: 0.6 });
      arm(r, 'R', { pos: V(-x, y, z), pole: V(-0.5, -0.8, -0.5), hand: { thumb: V(0, 0.4, 1), palm: V(1, 0.25, 0) }, grip: 'edge', twist: 0.6 });
      c.tray = V(0, y, z + 0.1);
      c.lookDefault(r, 0.7);
    },
    idle: { look: 0.4, breathe: 0.6, sway: 0.25 },
  },
  photo: {
    samples: [0],
    defaultHolding: 'camera',
    gaze: 'fixed',
    build(r, c) {
      standBody(r, c, 0.5);
      r.lean(2 * DEG, 0, 0);
      r.look(V(r.eyes().x, r.eyes().y, 3), 1);
      const e = r.eyes();
      const cam = e.clone().add(V(-0.025, -0.005, 0.105));
      c.camCenter = cam; c.focus = V(e.x, e.y, 3);
      arm(r, 'R', { pos: cam.clone().add(V(-0.1, -0.035, -0.035)), pole: V(-0.25, -1, 0.1), hand: { thumb: V(0.2, 0.6, -0.6), palm: V(1, 0, 0.15) }, grip: 'edge', twist: 0.6 });
      arm(r, 'L', { pos: cam.clone().add(V(0.095, -0.06, -0.04)), pole: V(0.25, -1, 0.1), hand: { thumb: V(-0.2, 0.6, -0.6), palm: V(-1, 0.3, 0.1) }, grip: 'edge', twist: 0.6 });
    },
    idle: { look: 0, breathe: 0.6, sway: 0.15, tilt: 0 },
  },
  pin: {
    samples: [0, 1],
    defaultHolding: 'polaroid',
    gaze: 'fixed',
    build(r, c, p) {
      // where the photo goes: opts.target (local space) or ~eye height on a wall 0.35 m ahead
      const wallZ = c.target ? c.target.z : 0.35;
      const reachTop = r.wp('R UpperArm').y + (c.D.upperArm + c.D.forearm) * 0.8;
      // lean in a little when the wall is further away
      r.lean(clamp((wallZ - 0.35) * 0.9, -0.05, 0.2) - 2 * DEG, 0, 0);
      const photoY = c.target ? c.target.y : clamp(Math.min(r.eyes().y + 0.09, 1.9, reachTop + 0.1), 1.3, 1.95);
      const photoX = c.target ? c.target.x : -0.08;
      const y = photoY - 0.1;
      const z = wallZ - 0.035 - p * 0.006;
      c.pinPoint = V(photoX, photoY, wallZ); c.focus = c.pinPoint;
      r.look(c.pinPoint, 1);
      arm(r, 'R', { pos: V(photoX - 0.02, y, z), pole: V(-0.7, -0.6, -0.2), shrug: 12 * DEG, protract: 4 * DEG, hand: { dir: V(0.15, 1, 0.25), palm: V(0.1, 0, 1) }, grip: 'pinch', twist: 0.5 });
      arm(r, 'L', { pos: V(0.16, c.D.hipY + 0.2, 0.2), pole: V(0.4, -0.8, -0.4), hand: { thumb: V(-0.3, 0.5, 1), palm: V(-0.7, 0.6, 0) }, grip: 'pinch', twist: 0.5 });
    },
    drive: (t, c) => 0.5 + 0.5 * Math.sin(t * 1.3 + c.ph),
    idle: { look: 0, breathe: 1, sway: 0.15 },
  },
  'cook-stir': {
    samples: [0, 1, 2, 3, 4, 5, 6, 7],
    cyclic: true,
    defaultHolding: 'ladle',
    gaze: 'work',
    build(r, c, p) {
      standBody(r, c, 0.45);
      r.lean(10 * DEG, 0, 0);
      const a = (p / 8) * Math.PI * 2;
      const pot = V(-0.06, 0.93, 0.42);
      c.potCenter = pot; c.focus = pot;
      arm(r, 'R', { pos: V(-0.1 + Math.cos(a) * 0.05, 1.15, 0.4 + Math.sin(a) * 0.045), pole: V(-0.6, -0.7, -0.4), hand: { thumb: V(0.1, 1, 0.25), palm: V(1, -0.15, 0.2) }, grip: 'handle', twist: 0.5 });
      arm(r, 'L', { pos: V(0.2, 0.975, 0.37), pole: V(0.5, -0.8, -0.4), hand: { dir: V(-0.3, -0.3, 1), palm: V(0, -1, 0) }, grip: 'relaxed', twist: 0.5 });
      r.look(pot, 0.85);
    },
    drive: (t, c) => (t * 0.6 + c.ph) * 8,
    idle: { look: 0.2, breathe: 1, sway: 0.2 },
  },
  'cook-flip': {
    samples: [0, 1, 2],
    defaultHolding: 'pan',
    gaze: 'work',
    build(r, c, p) {
      standBody(r, c, 0.45);
      r.lean(9 * DEG, 0, 0);
      const lift = [0, 0.09, 0.03][p], tilt = [0, 32, -8][p] * DEG, push = [0, -0.04, 0.06][p];
      arm(r, 'R', { pos: V(-0.2, 1.0 + lift, 0.27 + push), pole: V(-0.6, -0.7, -0.4), hand: { thumb: V(0.1, Math.sin(0.3 + tilt), Math.cos(0.3 + tilt)), palm: V(0.6, -0.8, 0) }, grip: 'handle', twist: 0.5 });
      arm(r, 'L', { pos: V(0.19, 0.975, 0.36), pole: V(0.5, -0.8, -0.4), hand: { dir: V(-0.3, -0.3, 1), palm: V(0, -1, 0) }, grip: 'relaxed', twist: 0.5 });
      c.focus = V(-0.12, 0.95, 0.6);
      r.look(c.focus, 0.85);
    },
    drive: (t, c) => {
      const T = 5 + (c.ph % 2), x = ((t + c.ph * 3) % T) / T * T; // seconds into the cycle
      if (x > 0.75) return 0;
      if (x < 0.25) return smooth(x / 0.25);
      if (x < 0.45) return 1 + smooth((x - 0.25) / 0.2);
      return 2 - 2 * smooth((x - 0.45) / 0.3);
    },
    idle: { look: 0.2, breathe: 1, sway: 0.2 },
  },
  'prep-chop': {
    samples: [0, 1],
    defaultHolding: 'knife',
    gaze: 'work',
    build(r, c, p) {
      standBody(r, c, 0.4);
      r.lean(13 * DEG, 0, 0);
      arm(r, 'R', { pos: V(-0.13, 1.075 - p * 0.05, 0.36), pole: V(-0.6, -0.7, -0.45), hand: { thumb: V(0.1, -0.1 - p * 0.1, 1), palm: V(1, 0, 0) }, grip: 'handle', twist: 0.5 });
      arm(r, 'L', { pos: V(0.06, 0.985, 0.39), pole: V(0.6, -0.7, -0.3), hand: { dir: V(-0.55, -0.6, 0.6), palm: V(0, -1, 0) }, grip: 'claw', twist: 0.5 });
      c.focus = V(-0.02, 0.92, 0.4);
      r.look(c.focus, 0.9);
    },
    drive: (t, c) => {
      const x = (t + c.ph * 4) % 3.6;
      if (x > 2.6) return 0;
      return 0.5 - 0.5 * Math.cos(x * Math.PI * 2 * 2.4);
    },
    idle: { look: 0.15, breathe: 1, sway: 0.15 },
  },
  sit: {
    seated: true,
    samples: [0],
    gaze: 'table',
    build(r, c) {
      seatBody(r, c.rng, { lean: (13 + 8 * c.v.lean) * DEG, yaw: seatTurn(c), roll: c.v.roll * 3 * DEG });
      let a = pickArm(c.v.arm, 0.35, 0.4), b = pickArm(c.v.arm2, 0.45, 0.35);
      if (a === 'lap' && b === 'lap') b = 'table';
      restArm(r, c, 'L', a); restArm(r, c, 'R', b);
      c.lookDefault(r);
    },
    idle: { look: 0.6, breathe: 1, sway: 0.5 },
  },
  'sit-eat': {
    seated: true,
    samples: [0, 1],
    defaultHolding: 'chopsticks',
    gaze: 'eat',
    build(r, c, p) {
      seatBody(r, c.rng, { lean: (16 + p * 8) * DEG, yaw: c.v.yaw * 4 * DEG, roll: c.v.roll * 2 * DEG });
      restArm(r, c, 'L', pickArm(c.v.arm, 0.55, 0.35));
      const bowl = V(-0.04, TABLE_Y + 0.03, TABLE_EDGE_Z + 0.2 * REACH);
      c.bowl = bowl; c.focus = bowl;
      if (p === 0) {
        r.look(bowl, 0.95);
        // chopsticks dipping into the bowl: fingers point forward-down
        solveTableArm(r, 'R', { pos: V(-0.11, TABLE_Y + 0.14, TABLE_EDGE_Z + 0.08 * REACH - (1 - REACH) * 0.05), pole: V(-0.6, -0.7, -0.3), hand: { dir: V(0.35, -0.55, 0.75), palm: V(0.75, -0.2, -0.3) }, grip: 'pencil', twist: 0.5 });
      } else {
        // bite: hand just below and in front of the mouth, chopsticks pointing at the mouth
        r.look(bowl.clone().lerp(r.mouth().add(V(0, -0.1, 0.25)), 0.7), 0.85);
        const m = r.mouth();
        const hp = m.clone().add(V(-0.045, -0.085, 0.12));
        const dir = m.clone().sub(hp).normalize().add(V(0, 0.25, 0)).normalize();
        arm(r, 'R', { pos: hp, pole: V(-0.5, -0.9, -0.2), hand: { dir, palm: V(0.8, -0.45, 0.2) }, grip: 'pencil', twist: 0.5 });
      }
    },
    drive: (t, c) => {
      const T = 6 + (c.ph % 3), x = (t + c.ph * 5) % T;
      if (x < 0.75) return smooth(x / 0.75);
      if (x < 1.2) return 1;
      if (x < 1.9) return 1 - smooth((x - 1.2) / 0.7);
      return 0;
    },
    idle: { look: 0.3, breathe: 1, chew: 1, sway: 0.35 },
  },
  'sit-talk': {
    seated: true,
    samples: [0, 1, 2],
    cyclic: true,
    gaze: 'table',
    build(r, c, p) {
      seatBody(r, c.rng, { lean: (15 + 7 * c.v.lean) * DEG, yaw: seatTurn(c), roll: c.v.roll * 3 * DEG });
      restArm(r, c, 'L', pickArm(c.v.arm, 0.4, 0.4));
      const g = [V(-0.15, 0.13, 0.08), V(-0.1, 0.19, 0.13), V(-0.2, 0.15, 0.04)][p];
      solveTableArm(r, 'R', { pos: V(g.x, TABLE_Y + g.y, TABLE_EDGE_Z + g.z * REACH - (1 - REACH) * 0.05), pole: V(-0.55, -0.75, -0.3), hand: { dir: V(0.35, 0.25 + p * 0.12, 1), palm: V(0.5, 0.85, -0.1) }, grip: 'open', twist: 0.55 });
      c.lookDefault(r);
    },
    drive: (t, c) => 1 + Math.sin(t * 0.8 + c.ph) * 0.85 + Math.sin(t * 1.9 + c.ph) * 0.15,
    idle: { look: 0.5, breathe: 1, sway: 0.6 },
  },
  'sit-cheers': {
    seated: true,
    samples: [0, 1],
    defaultHolding: 'glass',
    gaze: 'table',
    build(r, c, p) {
      seatBody(r, c.rng, { lean: (13 + 5 * c.v.lean) * DEG, yaw: seatTurn(c, 10), roll: c.v.roll * 2.5 * DEG });
      restArm(r, c, 'L', pickArm(c.v.arm, 0.5, 0.3));
      const e = r.eyes();
      const gp = V(e.x * 0.5 - 0.17, e.y - 0.17 + p * 0.03, TABLE_EDGE_Z + (0.13 + p * 0.04) * REACH - (1 - REACH) * 0.06);
      arm(r, 'R', { pos: gp, pole: V(-0.7, -0.7, -0.2), shrug: 6 * DEG, protract: 6 * DEG, hand: { thumb: V(0.05, 1, 0.1), palm: V(0.85, 0, -0.5) }, grip: 'cylinder', twist: 0.5 });
      c.focus = c.lookTarget || V(c.v.side * 0.2, e.y + 0.05, 1.1);
      r.look(c.focus, 0.9);
    },
    drive: (t, c) => { const x = (t + c.ph * 3) % 4.5; return x < 0.35 ? smooth(x / 0.35) : x < 0.6 ? 1 : x < 1.1 ? 1 - smooth((x - 0.6) / 0.5) : 0; },
    idle: { look: 0.3, breathe: 1, sway: 0.5 },
  },
  'sit-phone': {
    seated: true,
    samples: [0],
    defaultHolding: 'phone',
    gaze: 'phone',
    build(r, c) {
      seatBody(r, c.rng, { lean: (18 + 5 * c.v.lean) * DEG, yaw: c.v.yaw * 3 * DEG, roll: c.v.roll * 2.5 * DEG });
      const ph = V(0, TABLE_Y + 0.15, TABLE_EDGE_Z + 0.07 * REACH - (1 - REACH) * 0.06);
      c.phoneCenter = ph; c.focus = ph;
      r.look(ph, 1);
      arm(r, 'L', { pos: ph.clone().add(V(0.06, -0.035, -0.06)), pole: V(0.5, -0.8, -0.3), hand: { thumb: V(-0.3, 0.7, 0.6), palm: V(-0.75, 0.45, -0.3) }, grip: 'phone', twist: 0.55 });
      arm(r, 'R', { pos: ph.clone().add(V(-0.06, -0.035, -0.06)), pole: V(-0.5, -0.8, -0.3), hand: { thumb: V(0.3, 0.7, 0.6), palm: V(0.75, 0.45, -0.3) }, grip: 'phone', twist: 0.55 });
    },
    idle: { look: 0, breathe: 1, thumb: 1, sway: 0.3 },
  },
};
export const POSE_NAMES = Object.keys(POSES);

// ----------------------------------------------------------------------------------- createPerson
export function createPerson(id, opts = {}) {
  const tpl = templates.get(id);
  if (!tpl) throw new Error(`people: unknown avatar "${id}" (did you await loadPeople()?)`);
  const poseName = opts.pose || 'stand';
  const pose = POSES[poseName];
  if (!pose) throw new Error(`people: unknown pose "${poseName}"`);
  const moodName = opts.mood || POSE_MOOD[poseName] || 'smile';
  if (!MOODS[moodName]) throw new Error(`people: unknown mood "${moodName}"`);
  const seed = opts.seed ?? hashString(id + poseName);
  const rng = mulberry32((seed * 2654435761) >>> 0);
  const builtin = tpl.entry.builtin || [];
  const uniform = opts.uniform !== undefined ? opts.uniform : (tpl.entry.defaultUniform || null);
  const holding = opts.holding !== undefined ? opts.holding : (pose.defaultHolding || null);

  const group = new THREE.Group();
  group.name = `person:${id}`;
  const root = cloneSkinned(tpl.scene);
  const scale = opts.scale || tpl.entry.scale || 1;
  root.scale.setScalar(scale);
  group.add(root);
  group.updateMatrixWorld(true);
  const r = new Rig(root, tpl);
  // all parts of one avatar share the body's skeleton (one bone-matrix update per frame)
  const bodyMesh = r.meshes.find((m) => m.userData.part === 'body');
  for (const m of r.meshes) if (m !== bodyMesh) m.bind(bodyMesh.skeleton, m.bindMatrix);
  r.reset();

  // the person's own fixed variation: which leg carries the weight, what the free hand does, head tilt ...
  const vr = mulberry32(((seed + 1) * 40503) >>> 0);
  const ctx = {
    rng, D: r.D, seed,
    rnd: (a, b) => a + (b - a) * rng(),
    ph: rng() * 100,
    v: { side: vr() < 0.5 ? -1 : 1, arm: vr(), arm2: vr(), tilt: vr() * 2 - 1, yaw: vr() * 2 - 1, roll: vr() * 2 - 1, lean: vr(), t0: 3 + vr() * 90, smile: vr() },
    lookTarget: opts.lookAt ? opts.lookAt.clone() : null,
    target: opts.target ? opts.target.clone() : null,
    focus: null,
    lookDefault(rr, amount = 1) {
      const e = rr.eyes();
      ctx.focus = ctx.lookTarget ? ctx.lookTarget.clone() : V(e.x + ctx.lookYaw, e.y + ctx.lookPitch, 2);
      rr.look(ctx.focus, amount);
    },
  };
  ctx.lookYaw = (rng() - 0.5) * 0.9;
  ctx.lookPitch = (rng() - 0.5) * 0.15 - (pose.seated ? 0.12 : 0);

  // accessories that hang on the body are made in the rest pose
  const shadows = opts.shadows !== false;
  if (uniform || opts.name) buildUniform(r, uniform || null, builtin, opts.name);

  // pose (and its animation samples)
  const tilt = (pose.idle && pose.idle.tilt !== undefined ? pose.idle.tilt : 1) * ctx.v.tilt * 4.5 * DEG;
  const build = (c, p) => {
    REACH = tpl.dims.child ? 0.45 : 1;
    try {
      r.reset();
      pose.build(r, c, p);
      // a prop the pose wasn't made for: bring it into a natural hold (casual poses) or just close the hand
      if (holding && holding !== pose.defaultHolding && HOLD_GRIP[holding]) {
        if (CASUAL_HOLD.has(poseName)) holdInFront(r, holding, !!pose.seated);
        else { r.resetFingers('R'); r.curl('R', GRIP[HOLD_GRIP[holding]]); }
      }
      if (tilt) r.rotW('Head', r.faceDir(), tilt);          // nobody holds their head perfectly level
    } finally { REACH = 1; }
  };
  if (pose.seated && tpl.cache.seatDrop === undefined) {
    // measure once per avatar where the buttocks meet the cushion (fixed random numbers and variation)
    build({ ...ctx, rng: mulberry32(1), rnd: (a, b) => (a + b) / 2, v: { ...ctx.v, arm: 0, arm2: 0, yaw: 0, roll: 0, lean: 0.5 }, lookTarget: null }, pose.samples[0]);
    calibrateSeat(r);
  }
  const snaps = [];
  const stateSeed = rng();
  for (const p of pose.samples) {
    // every sample uses the same random numbers, so samples differ only by their phase
    const local = mulberry32((stateSeed * 4294967296) >>> 0);
    ctx.rng = local; ctx.rnd = (a, b) => a + (b - a) * local();
    build(ctx, p);
    snaps.push(r.snapshot());
  }
  r.apply(snaps[0]);
  root.updateMatrixWorld(true);

  // face, gaze and motion
  ctx.mood = moodName;
  ctx.face = new Face(r);
  ctx.faceExtra = opts.face || null;
  ctx.gaze = gazeTargets(r, pose, ctx);
  const update = makeAnimator(r, pose, snaps, ctx);
  // every person starts from a moment of their own motion (also what static people are frozen in)
  update(ctx.v.t0, 0, true);
  root.updateMatrixWorld(true);

  // props
  if (holding) attachProp(r, holding, poseName, ctx);

  for (const m of r.meshes) { m.castShadow = shadows; m.receiveShadow = shadows; m.frustumCulled = true; }
  group.traverse((o) => { if (o.isMesh && !o.isSkinnedMesh) { o.castShadow = shadows && !o.userData.noShadow; o.receiveShadow = shadows; } });

  group.userData.person = { id, pose: poseName, mood: moodName, uniform, holding, seated: !!pose.seated, height: tpl.dims.height * scale };

  if (opts.static) {
    bakeStatic(group, root, r);
    group.userData.update = () => {};
    return group;
  }
  for (const m of r.meshes) { m.boundingSphere = null; m.computeBoundingSphere(); m.boundingSphere.radius += 0.25; }
  const t0 = ctx.v.t0;
  group.userData.update = (t = 0, dt) => update(t + t0, dt, false);
  return group;
}

// ----------------------------------------------------------------------------------- gaze
// Where a person looks over time, as head turns (yaw, pitch in radians) relative to the base pose.
// The first target is the pose's own focus (opts.lookAt, the bowl, the pot ...); the others are the
// people and things one naturally glances at in that situation. w = how often, people = it is a person.
function gazeTargets(r, pose, c) {
  const e = r.eyes(), f = r.faceDir();
  const yaw0 = Math.atan2(f.x, f.z), pitch0 = Math.asin(clamp(f.y, -1, 1));
  const list = [];
  const add = (p, w, people = false) => {
    if (!p) return;
    const d = p.clone().sub(e);
    if (d.lengthSq() < 1e-6) return;
    d.normalize();
    let yaw = Math.atan2(d.x, d.z) - yaw0;
    while (yaw > Math.PI) yaw -= 2 * Math.PI;
    while (yaw < -Math.PI) yaw += 2 * Math.PI;
    list.push({ yaw: clamp(yaw, -55 * DEG, 55 * DEG), pitch: clamp(Math.asin(clamp(d.y, -1, 1)) - pitch0, -35 * DEG, 30 * DEG), w, people });
  };
  const s = c.v.side, ey = e.y, kid = c.D.child ? 0.12 : 0;
  const focus = c.focus || V(e.x, ey, 2);
  const across = V(0, 1.16 + kid, 1.16), diag = V(s * 0.76, 1.16 + kid, 1.16), beside = V(s * 0.72, 1.14, 0.02), food = V(-s * 0.1, TABLE_Y + 0.03, 0.6);
  switch (pose.gaze) {
    case 'table':
      add(focus, c.lookTarget ? 5 : 2.5, true);
      if (!c.lookTarget || c.lookTarget.distanceTo(across) > 0.3) add(across, 2, true);
      add(diag, 1.6, true); add(food, 1.1); add(beside, 0.7, true);
      break;
    case 'eat': add(focus, 4.5); add(across, 1.6, true); add(diag, 1, true); break;
    case 'phone': add(focus, 8); add(across, 0.7, true); break;
    case 'front':
      add(focus, 4, true); add(V(e.x - 0.9, ey - 0.05, 2), 1, true); add(V(e.x + 0.9, ey, 2.2), 1, true); add(V(e.x + s * 0.3, ey - 0.45, 1.6), 0.5);
      break;
    case 'cashier': add(focus, 2.2); add(V(0.05, 1.56, 1.25), 3, true); add(V(s * 0.9, 1.5, 1.6), 0.6, true); break;
    case 'tray': add(focus, 3.5, true); add(c.tray, 0.8); add(V(e.x + s * 1.0, ey - 0.25, 1.6), 1, true); break;
    case 'work': add(focus, 6); add(V(e.x + s * 0.4, ey + 0.02, 1.9), 1.1, true); add(V(e.x - s * 0.25, 0.95, 0.5), 1.2); break;
    default: add(focus, 1);
  }
  if (!list.length) list.push({ yaw: 0, pitch: 0, w: 1, people: false });
  const total = list.reduce((a, t) => a + t.w, 0);
  let acc = 0;
  for (const t of list) { acc += t.w / total; t.cum = acc; }
  return { list, period: (pose.gaze === 'work' || pose.gaze === 'eat' ? 3.4 : 2.7) * (0.85 + 0.4 * c.v.arm2) };
}

// ----------------------------------------------------------------------------------- animation
const hash1 = (x) => { const s = Math.sin(x * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
// smooth value noise in [-1, 1]
const noise1 = (x) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return (hash1(i) * (1 - u) + hash1(i + 1) * u) * 2 - 1; };

function makeAnimator(r, pose, snaps, ctx) {
  const n = snaps.length;
  const bones = r.all;
  const idx = (name) => (r.b[name] ? bones.indexOf(r.b[name]) : -1);
  // bones that differ between samples (rotation or position)
  const moving = [];
  if (n > 1) {
    bones.forEach((b, i) => {
      for (let s = 1; s < n; s++) {
        const a = snaps[0].q, c = snaps[s].q, pa = snaps[0].p, pc = snaps[s].p;
        const dot = Math.abs(a[i * 4] * c[i * 4] + a[i * 4 + 1] * c[i * 4 + 1] + a[i * 4 + 2] * c[i * 4 + 2] + a[i * 4 + 3] * c[i * 4 + 3]);
        const dp = Math.abs(pa[i * 3] - pc[i * 3]) + Math.abs(pa[i * 3 + 1] - pc[i * 3 + 1]) + Math.abs(pa[i * 3 + 2] - pc[i * 3 + 2]);
        if (dot < 0.99999 || dp > 1e-5) { moving.push(i); break; }
      }
    });
  }
  // additive layers: rotations about world axes, converted to bone-local axes in the base pose
  const layer = (name, worldAxis) => {
    const b = r.b[name]; if (!b) return null;
    const q = r.wq(name).invert();
    return { b, axis: worldAxis.clone().applyQuaternion(q).normalize(), i: bones.indexOf(b) };
  };
  const faceK = new THREE.Vector3().crossVectors(r.faceDir(), UP).normalize();
  const L = {
    sp1: layer('Spine1', RIGHT_X), sp2: layer('Spine2', RIGHT_X), sp1R: layer('Spine1', FWD), sp2R: layer('Spine2', FWD), sp2Y: layer('Spine2', UP),
    neckY: layer('Neck', UP), headY: layer('Head', UP), headP: layer('Head', faceK), neckP: layer('Neck', faceK), headR: layer('Head', r.faceDir()),
    clL: layer('L Clavicle', FWD), clR: layer('R Clavicle', FWD),
    thumb: layer('R Finger01', faceK),
  };
  const clav = [idx('L Clavicle'), idx('R Clavicle')].filter((i) => i >= 0);
  const touched = [...new Set([...moving, ...Object.values(L).filter(Boolean).map((l) => l.i), ...clav])];
  const curQ = new Float32Array(bones.length * 4), curP = new Float32Array(bones.length * 3);
  const idle = pose.idle || {};
  const ph = ctx.ph, mood = ctx.mood, face = ctx.face, gz = ctx.gaze, G = gz.list;
  const gain = r.tpl.entry.expr || 1;
  const base = snaps[0];
  const moodBase = MOODS[mood];
  const W = {};
  const eye = { yaw: 0, pitch: 0 };
  const tmpQ = new THREE.Quaternion(), qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), neckQ = new THREE.Quaternion();
  const va = new THREE.Vector3(), vb = new THREE.Vector3();
  const rate = 0.85 + (ph % 1) * 0.3;
  const sway = idle.sway === undefined ? 0.5 : idle.sway;
  const smileBias = 0.85 + 0.3 * ctx.v.smile;                       // some people simply smile more
  const pickTarget = (slot) => { const h = hash1(slot * 1.37 + ph); for (const g of G) if (h <= g.cum) return g; return G[G.length - 1]; };
  const blinkP = 3.1 + (ph % 1.7);                                   // average seconds between blinks
  const blinkAt = (t) => {                                           // 0..1 lid closure
    let b = 0;
    const k0 = Math.floor(t / blinkP);
    for (let k = k0 - 1; k <= k0 + 1; k++) {
      const tb = (k + 0.5 + (hash1(k * 3.1 + ph) - 0.5) * 0.9) * blinkP, x = t - tb;
      if (x > 0 && x < 0.2) b = Math.max(b, x < 0.06 ? x / 0.06 : x < 0.09 ? 1 : 1 - (x - 0.09) / 0.11);
    }
    return b;
  };
  const laughP = 6.2 + (ph % 2.6);
  let last = NaN;
  return function update(t = 0, dt = 0, still = false) {
    if (t === last) return;
    last = t;
    // 1) base pose, or interpolation between the precomputed samples
    curQ.set(base.q); curP.set(base.p);
    if (moving.length) {
      let f = pose.drive ? pose.drive(t * rate, ctx) : 0;
      if (pose.cyclic) f = ((f % n) + n) % n; else f = clamp(f, 0, n - 1);
      const i0 = Math.floor(f), i1 = pose.cyclic ? (i0 + 1) % n : Math.min(i0 + 1, n - 1), k = f - i0;
      const A = snaps[i0], B = snaps[i1];
      for (const i of moving) {
        qa.fromArray(A.q, i * 4); qb.fromArray(B.q, i * 4);
        qa.slerp(qb, k).toArray(curQ, i * 4);
        va.fromArray(A.p, i * 3); vb.fromArray(B.p, i * 3);
        va.lerp(vb, k).toArray(curP, i * 3);
      }
    }
    for (const i of touched) { bones[i].quaternion.fromArray(curQ, i * 4); bones[i].position.fromArray(curP, i * 3); }
    const add = (l, a) => { if (l && a) l.b.quaternion.multiply(tmpQ.setFromAxisAngle(l.axis, a)); };
    neckQ.identity();
    const neck = (l, a) => { if (l && a) { tmpQ.setFromAxisAngle(l.axis, a); l.b.quaternion.multiply(tmpQ); neckQ.multiply(tmpQ); } };

    // 2) who they are looking at: the eyes jump first, the head follows
    const tg = (t + ph * 3) / gz.period, slot = Math.floor(tg), u = (tg - slot) * gz.period;
    const cur = pickTarget(slot), prev = pickTarget(slot - 1);
    const kh = smooth(u / 0.6), ke = smooth(u / 0.16);
    const wantYaw = prev.yaw + (cur.yaw - prev.yaw) * ke, wantPitch = prev.pitch + (cur.pitch - prev.pitch) * ke;
    let headYaw = (prev.yaw + (cur.yaw - prev.yaw) * kh) * 0.8, headPitch = (prev.pitch + (cur.pitch - prev.pitch) * kh) * 0.65;
    const atPeople = prev.people ? (cur.people ? 1 : 1 - kh) : (cur.people ? kh : 0);
    // small natural head motion on top
    const lk = idle.look || 0;
    headYaw += noise1(t * 0.21 + ph) * 0.07 * lk;
    headPitch += noise1(t * 0.27 + ph * 1.7) * 0.035 * lk;
    let headRoll = noise1(t * 0.17 + ph * 2.3) * 0.03 * lk;

    // 3) mood: what the face and the upper body are doing
    for (const k in W) W[k] = 0;
    for (const k in moodBase) W[k] = moodBase[k];
    let sm = (W.smile || 0) * gain * smileBias * (0.9 + 0.12 * noise1(t * 0.13 + ph));
    let spinePitch = 0, shrug = 0;
    if (mood === 'talk') {
      const speak = smooth((Math.sin(t * 0.45 + ph) + 0.3) * 3);     // speaking / listening turns
      const syl = Math.max(0, Math.sin(t * 13.1 + ph) * 0.6 + Math.sin(t * 19.7 + ph * 2) * 0.4);
      const open = speak * (0.2 + 0.8 * syl) * (0.65 + 0.35 * noise1(t * 1.7 + ph));
      const shape = noise1(t * 2.3 + ph * 5);
      W.jaw = 0.5 * open; W.lipsOpen = 0.55 * open;
      W.oo = speak * Math.max(0, shape) * 0.5; W.ee = speak * Math.max(0, -shape) * 0.4;
      W.browUp = speak * Math.max(0, noise1(t * 0.8 + ph * 3)) * 0.45;
      sm = sm * (1 - 0.3 * speak) + (1 - speak) * 0.55 * gain * smileBias;   // listening: an attentive smile
      headPitch += speak * Math.sin(t * 2.3 + ph) * 0.03 + (1 - speak) * Math.max(0, Math.sin(t * 1.1 + ph)) ** 6 * 0.07;   // emphasis / nods
      headRoll += speak * noise1(t * 0.6 + ph) * 0.03;
    } else if (mood === 'laugh') {
      const x = (t + ph * 7) % laughP;
      const b = x < 0.3 ? smooth(x / 0.3) : x < 1.5 ? 1 : x < 2.2 ? 1 - smooth((x - 1.5) / 0.7) : 0;      // a laugh
      const ha = b * Math.abs(Math.sin(t * 17));
      W.grin = (W.grin || 0) * (0.45 + 0.9 * b);
      W.jaw = b * (0.3 + 0.25 * ha);
      W.squint = (W.squint || 0) + 0.55 * b;
      W.browUp = 0.25 * b;
      sm *= 1 + 0.12 * b;
      headPitch += b * 0.1;                                          // head goes back
      spinePitch -= b * 0.035 + ha * 0.012;
      shrug = b * (0.035 + 0.04 * ha);                               // shoulders bounce
    } else if (mood === 'focus') {
      sm += atPeople * 0.5 * gain;                                   // a smile when they glance up at the guests
      W.lidDown = (W.lidDown || 0) * (1 - atPeople);
      W.browIn = (W.browIn || 0) * (1 - 0.7 * atPeople);
    } else if (mood === 'smile') {
      const big = smooth((noise1(t * 0.11 + ph * 4) - 0.25) * 3) * atPeople;   // now and then a wider, open smile
      W.grin = 0.42 * big; sm *= 1 + 0.15 * big;
      W.browUp = 0.2 * big;
    }
    if (idle.chew) {
      const T = 6 + (ph % 3), x = (t * rate + ph * 5) % T;
      if (x > 1.9 && x < 4.6) { const c = Math.max(0, Math.sin((x - 1.9) * 9)); W.jaw = (W.jaw || 0) + c * 0.22; W.press = 0.5; sm *= 0.6; }
      else if (x <= 1.2 && x > 0.55) { W.jaw = (W.jaw || 0) + 0.75; W.lipsOpen = 0.5; sm *= 0.4; }   // mouth opens for the bite
    }
    W.smile = sm;
    if (ctx.faceExtra) for (const k in ctx.faceExtra) W[k] = (W[k] || 0) + ctx.faceExtra[k];

    // 4) apply head, posture and breathing
    neck(L.neckY, headYaw * 0.4); add(L.headY, headYaw * 0.6);
    neck(L.neckP, headPitch * 0.4); add(L.headP, headPitch * 0.6);
    add(L.headR, headRoll);
    if (neckQ.w < 0.999999) {
      neckQ.invert();
      for (const i of clav) { const b = bones[i]; b.quaternion.premultiply(neckQ); b.position.applyQuaternion(neckQ); }
    }
    const br = (idle.breathe || 0) * Math.sin(t * 1.55 + ph);
    add(L.sp1, br * 0.007 + spinePitch * 0.4); add(L.sp2, -br * 0.014 + spinePitch * 0.6);
    add(L.sp1R, sway * 0.016 * noise1(t * 0.19 + ph * 1.3)); add(L.sp2R, sway * 0.014 * noise1(t * 0.19 + ph * 1.3 + 0.4));
    add(L.sp2Y, sway * 0.03 * noise1(t * 0.15 + ph * 0.7) + headYaw * 0.08);
    add(L.clL, br * 0.012 + shrug); add(L.clR, -br * 0.012 - shrug);
    if (idle.thumb) add(L.thumb, Math.max(0, Math.sin(t * 6 + ph)) * Math.max(0, Math.sin(t * 0.9 + ph)) * 0.25);

    // 5) eyes: hold the target while the head moves, with small saccades; lids follow the gaze; blinks
    if (face.ok) {
      const sacc = Math.floor(t * 1.3 + ph);
      eye.yaw = clamp(wantYaw - headYaw + (hash1(sacc + ph) - 0.5) * 0.06, -0.4, 0.4);
      eye.pitch = clamp(wantPitch - headPitch + (hash1(sacc * 1.7 + ph) - 0.5) * 0.035, -0.42, 0.3);
      W.lidDown = (W.lidDown || 0) + 0.16 + clamp(-eye.pitch * 1.5, -0.1, 0.55);
      const shift = cur !== prev && hash1(slot * 2.3 + ph) < 0.6 && u < 0.2 ? Math.sin(u / 0.2 * Math.PI) : 0;   // blink with a gaze change
      W.blink = still ? 0 : Math.max(blinkAt(t), shift);
      face.apply(W, eye);
    }
  };
}

// ----------------------------------------------------------------------------------- static bake
function bakeStatic(group, root, r) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const out = [];
  root.traverse((o) => {
    if (o.isSkinnedMesh) {
      const g = bakeSkinned(o);
      const m = new THREE.Mesh(g, o.material);
      m.castShadow = o.castShadow; m.receiveShadow = o.receiveShadow; m.name = o.name;
      out.push(m);
    } else if (o.isMesh) {
      const m = o.clone(false);
      m.matrixAutoUpdate = true;
      new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld).decompose(m.position, m.quaternion, m.scale);
      out.push(m);
    }
  });
  group.remove(root);
  for (const m of out) group.add(m);
}

function bakeSkinned(mesh) {
  mesh.skeleton.update();
  const src = mesh.geometry;
  const pos = src.attributes.position, nrm = src.attributes.normal, si = src.attributes.skinIndex, sw = src.attributes.skinWeight;
  const n = pos.count;
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3);
  const bm = mesh.skeleton.boneMatrices, B = mesh.bindMatrix;
  const nmB = new THREE.Matrix3().getNormalMatrix(B);
  const v = new THREE.Vector3(), nn = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(B);
    nn.fromBufferAttribute(nrm, i).applyMatrix3(nmB);
    let px = 0, py = 0, pz = 0, nx = 0, ny = 0, nz = 0;
    for (let k = 0; k < 4; k++) {
      const w = sw.getComponent(i, k); if (w <= 0) continue;
      const e = bm.subarray(si.getComponent(i, k) * 16);
      px += w * (e[0] * v.x + e[4] * v.y + e[8] * v.z + e[12]);
      py += w * (e[1] * v.x + e[5] * v.y + e[9] * v.z + e[13]);
      pz += w * (e[2] * v.x + e[6] * v.y + e[10] * v.z + e[14]);
      nx += w * (e[0] * nn.x + e[4] * nn.y + e[8] * nn.z);
      ny += w * (e[1] * nn.x + e[5] * nn.y + e[9] * nn.z);
      nz += w * (e[2] * nn.x + e[6] * nn.y + e[10] * nn.z);
    }
    P[i * 3] = px; P[i * 3 + 1] = py; P[i * 3 + 2] = pz;
    const l = Math.hypot(nx, ny, nz) || 1;
    N[i * 3] = nx / l; N[i * 3 + 1] = ny / l; N[i * 3 + 2] = nz / l;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  for (const name of Object.keys(src.attributes)) {
    if (name.startsWith('uv') || name === 'pEye') g.setAttribute(name, src.attributes[name]);
  }
  if (src.index) g.setIndex(src.index);
  for (const gr of src.groups) g.addGroup(gr.start, gr.count, gr.materialIndex);
  g.computeBoundingSphere(); g.computeBoundingBox();
  return g;
}

// ----------------------------------------------------------------------------------- body surface (front depth map)
// Orthographic "z-buffer" of the rest-pose torso and legs seen from the front, with skin weights.
const FG = { x0: -0.4, x1: 0.4, y0: 0.2, y1: 1.75, step: 0.01 };
function frontMap(tpl) {
  if (tpl.cache.front) return tpl.cache.front;
  const rd = restData(tpl);
  const nx = Math.round((FG.x1 - FG.x0) / FG.step) + 1, ny = Math.round((FG.y1 - FG.y0) / FG.step) + 1;
  const Z = new Float32Array(nx * ny).fill(-Infinity);
  const T = new Int32Array(nx * ny).fill(-1);        // triangle id (into tris list)
  const Bc = new Float32Array(nx * ny * 3);          // barycentrics
  const tris = [];                                    // [meshPart, a, b, c]
  for (const part of ['body', 'head']) {
    const m = rd.meshes[part]; if (!m) continue;
    const idx = m.index, P = m.P;
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t], b = idx[t + 1], c = idx[t + 2];
      if (ARM_BONE.test(m.dom[a]) || ARM_BONE.test(m.dom[b]) || ARM_BONE.test(m.dom[c])) continue;
      const ax = P[a * 3], ay = P[a * 3 + 1], az = P[a * 3 + 2];
      const bx = P[b * 3], by = P[b * 3 + 1], bz = P[b * 3 + 2];
      const cx = P[c * 3], cy = P[c * 3 + 1], cz = P[c * 3 + 2];
      const den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
      if (Math.abs(den) < 1e-12) continue;
      const tid = tris.length; tris.push([part, a, b, c]);
      const i0 = Math.max(0, Math.ceil((Math.min(ax, bx, cx) - FG.x0) / FG.step)), i1 = Math.min(nx - 1, Math.floor((Math.max(ax, bx, cx) - FG.x0) / FG.step));
      const j0 = Math.max(0, Math.ceil((Math.min(ay, by, cy) - FG.y0) / FG.step)), j1 = Math.min(ny - 1, Math.floor((Math.max(ay, by, cy) - FG.y0) / FG.step));
      for (let j = j0; j <= j1; j++) {
        const y = FG.y0 + j * FG.step;
        for (let i = i0; i <= i1; i++) {
          const x = FG.x0 + i * FG.step;
          const l1 = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / den;
          const l2 = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / den;
          const l3 = 1 - l1 - l2;
          if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
          const z = l1 * az + l2 * bz + l3 * cz;
          const k = j * nx + i;
          if (z > Z[k]) { Z[k] = z; T[k] = tid; Bc[k * 3] = l1; Bc[k * 3 + 1] = l2; Bc[k * 3 + 2] = l3; }
        }
      }
    }
  }
  const front = { nx, ny, Z, T, Bc, tris, rd };
  front.at = (x, y) => {
    const i = clamp(Math.round((x - FG.x0) / FG.step), 0, nx - 1), j = clamp(Math.round((y - FG.y0) / FG.step), 0, ny - 1);
    return Z[j * nx + i];
  };
  // skin weights (by bone name) at a cell
  front.weights = (i, j, acc, f) => {
    const k = j * nx + i, t = T[k];
    if (t < 0) return;
    const [part, a, b, c] = tris[t];
    const W = rd.meshes[part].W;
    [a, b, c].forEach((v, n) => { for (const [name, w] of W[v]) acc.set(name, (acc.get(name) || 0) + w * Bc[k * 3 + n] * f); });
  };
  return (tpl.cache.front = front);
}

// upper convex hull of points (x, z) evaluated at xs
function hullEval(xs, zs, at) {
  const pts = [];
  for (let i = 0; i < xs.length; i++) if (Number.isFinite(zs[i])) pts.push([xs[i], zs[i]]);
  if (!pts.length) return at.map(() => -Infinity);
  const h = [];
  for (const p of pts) {
    while (h.length >= 2) {
      const a = h[h.length - 2], b = h[h.length - 1];
      if ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) >= 0) h.pop(); else break;
    }
    h.push(p);
  }
  return at.map((x) => {
    if (x <= h[0][0]) return h[0][1];
    if (x >= h[h.length - 1][0]) return h[h.length - 1][1];
    for (let i = 1; i < h.length; i++) if (x <= h[i][0]) { const a = h[i - 1], b = h[i]; return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0] || 1); }
    return h[h.length - 1][1];
  });
}

// Bone names -> indices of a skeleton, weights map -> top 4
function top4(acc, boneIndex) {
  const arr = [...acc.entries()].filter(([n]) => boneIndex.has(n)).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const sum = arr.reduce((s, a) => s + a[1], 0) || 1;
  const idx = [0, 0, 0, 0], w = [0, 0, 0, 0];
  arr.forEach(([n, v], i) => { idx[i] = boneIndex.get(n); w[i] = v / sum; });
  if (!arr.length) { idx[0] = boneIndex.get('__fallback') || 0; w[0] = 1; }
  return { idx, w };
}

// Turn rest-pose world positions into a SkinnedMesh geometry bound to the template's body skeleton.
function skinnedGeometry(tpl, positions, normals, uvs, index, weightsList) {
  const body = tpl.meshes.find((m) => m.userData.part === 'body');
  body.skeleton.update();
  const bm = body.skeleton.boneMatrices;
  const n = positions.length / 3;
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), SI = new Uint16Array(n * 4), SW = new Float32Array(n * 4);
  const M = new THREE.Matrix4(), Mi = new THREE.Matrix4(), tmp = new THREE.Matrix4(), v = new THREE.Vector3(), nn = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const { idx, w } = weightsList[i];
    M.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
    for (let k = 0; k < 4; k++) {
      SI[i * 4 + k] = idx[k]; SW[i * 4 + k] = w[k];
      if (!w[k]) continue;
      tmp.fromArray(bm, idx[k] * 16);
      for (let e = 0; e < 16; e++) M.elements[e] += tmp.elements[e] * w[k];
    }
    Mi.copy(M).invert();
    v.fromArray(positions, i * 3).applyMatrix4(Mi).toArray(P, i * 3);
    nn.fromArray(normals, i * 3).transformDirection(Mi).toArray(N, i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(SI, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(SW, 4));
  g.setIndex(index);
  return g;
}

function boneIndexOf(tpl) {
  if (tpl.cache.boneIndex) return tpl.cache.boneIndex;
  const body = tpl.meshes.find((m) => m.userData.part === 'body');
  const map = new Map();
  body.skeleton.bones.forEach((b, i) => map.set(b.name, i));
  const pel = body.skeleton.bones.findIndex((b) => /Pelvis$/.test(b.name));
  map.set('__fallback', Math.max(0, pel));
  return (tpl.cache.boneIndex = map);
}

// ----------------------------------------------------------------------------------- apron
// A bib apron fitted to the avatar: the cloth surface is the "taut" upper envelope of the body's front
// (bridging bust, belly and the gap between the legs), skinned with smoothed body weights so it follows
// every pose. Neck strap + waist tie are made the same way.
function apronGeometry(tpl, style) {
  const key = 'apron:' + style;
  if (tpl.cache[key]) return tpl.cache[key];
  const F = frontMap(tpl), D = tpl.dims, rw = tpl.restWorld;
  const boneIndex = boneIndexOf(tpl);
  const shoulderY = D.shoulderY, hipY = D.hipY, kneeY = rw['L Calf'].y;
  const waistY = hipY + 0.13;
  const bibTop = shoulderY - (tpl.entry.sex === 'female' ? 0.1 : 0.12);
  const hem = style === 'long' ? kneeY - 0.05 : kneeY + 0.05;
  const hipW = hipHalfWidth(tpl);
  // silhouette half width per row (non-arm), used to keep the cloth from sticking out sideways
  const sil = (y) => {
    const j = clamp(Math.round((y - FG.y0) / FG.step), 0, F.ny - 1);
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < F.nx; i++) if (Number.isFinite(F.Z[j * F.nx + i])) { const x = FG.x0 + i * FG.step; lo = Math.min(lo, x); hi = Math.max(hi, x); }
    return [lo, hi];
  };
  const halfW = (y) => {
    const skirt = hipW + 0.035;
    let w;
    if (y >= waistY) {
      const bibW = 0.115;
      const under = bibTop - 0.13;
      w = y > under ? bibW : bibW + (skirt - bibW) * smooth((under - y) / (under - waistY));
    } else w = skirt + (waistY - y) * 0.05;
    const [lo, hi] = sil(y);
    return Math.max(0.05, Math.min(w, (hi - lo) / 2 - 0.012));
  };
  const COLS = 18, ROWS = 44;
  const rows = [];
  for (let r = 0; r <= ROWS; r++) rows.push(bibTop + (hem - bibTop) * (r / ROWS));
  // depth: per-row upper hull of the body front, then per-column hull in two vertical sections
  const xsAll = []; for (let i = 0; i < F.nx; i++) xsAll.push(FG.x0 + i * FG.step);
  const grid = rows.map((y) => {
    const j = clamp(Math.round((y - FG.y0) / FG.step), 0, F.ny - 1);
    // dilate a little in y (cloth doesn't follow tiny dips)
    const zs = xsAll.map((x, i) => { let m = -Infinity; for (let dj = -2; dj <= 2; dj++) { const jj = clamp(j + dj, 0, F.ny - 1); m = Math.max(m, F.Z[jj * F.nx + i]); } return m; });
    const hw = halfW(y);
    const cx = (sil(y)[0] + sil(y)[1]) / 2;
    const xs = []; for (let c = 0; c <= COLS; c++) xs.push(cx - hw + (2 * hw) * (c / COLS));
    return { y, xs, z: hullEval(xsAll, zs, xs) };
  });
  for (let c = 0; c <= COLS; c++) {
    for (const [a, b] of [[0, rows.findIndex((y) => y < waistY)], [rows.findIndex((y) => y < waistY), ROWS + 1]]) {
      if (a < 0 || b <= a) continue;
      const ys = [], zs = [];
      for (let r = a; r < b; r++) { ys.push(-grid[r].y); zs.push(grid[r].z[c]); }
      const hz = hullEval(ys, zs, ys);
      for (let r = a; r < b; r++) grid[r].z[c] = hz[r - a];
    }
  }
  // the hem hangs a touch forward of the legs, the bib top sits on the chest
  const pos = [], uvs = [], wts = [];
  const tmpAcc = new Map();
  for (let r = 0; r <= ROWS; r++) {
    const g = grid[r];
    const below = clamp((hipY - 0.12 - g.y) / 0.15, 0, 1);
    for (let c = 0; c <= COLS; c++) {
      const u = c / COLS;
      const edge = Math.pow(Math.abs(u - 0.5) * 2, 6);
      const z = g.z[c] + 0.009 + below * 0.012 - edge * 0.01;
      pos.push(g.xs[c], g.y, z);
      uvs.push(u, 1 - r / ROWS);
      // weights: average body weights around the point; wide horizontally below the crotch
      tmpAcc.clear();
      const rx = Math.round((0.03 + below * 0.12) / FG.step), ry = 3;
      const i0 = Math.round((g.xs[c] - FG.x0) / FG.step), j0 = Math.round((g.y - FG.y0) / FG.step);
      for (let dj = -ry; dj <= ry; dj++) for (let di = -rx; di <= rx; di++) {
        const i = i0 + di, j = j0 + dj; if (i < 0 || j < 0 || i >= F.nx || j >= F.ny) continue;
        F.weights(i, j, tmpAcc, Math.exp(-(di * di) / (rx * rx + 1) - (dj * dj) / 9));
      }
      wts.push(top4(tmpAcc, boneIndex));
    }
  }
  const index = [];
  const W = COLS + 1;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const a = r * W + c, b = a + 1, d = a + W, e = d + 1;
    index.push(a, d, b, b, d, e);
  }
  const tmpG = new THREE.BufferGeometry();
  tmpG.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  tmpG.setIndex(index); tmpG.computeVertexNormals();
  const normals = tmpG.attributes.normal.array;
  const geo = skinnedGeometry(tpl, new Float32Array(pos), normals, uvs, index, wts);
  // straps
  const straps = strapGeometry(tpl, { bibTop, bibW: halfW(bibTop), bibZ: grid[0].z, bibXs: grid[0].xs, waistY });
  return (tpl.cache[key] = { geo, straps, bibTop, waistY, grid });
}

// neck loop + waist tie as thin ribbons
function strapGeometry(tpl, { bibTop, bibXs, bibZ, waistY }) {
  const rd = restData(tpl), boneIndex = boneIndexOf(tpl);
  const pts = [];
  for (const part of ['body', 'head']) {
    const m = rd.meshes[part]; if (!m) continue;
    for (let i = 0; i < m.count; i++) if (!ARM_BONE.test(m.dom[i])) pts.push([m.P[i * 3], m.P[i * 3 + 1], m.P[i * 3 + 2], part, i]);
  }
  // radial profile of the body at height y (centroid + max radius per angle)
  const ring = (y, band = 0.012, N = 40) => {
    let sel = pts.filter((p) => Math.abs(p[1] - y) < band);
    for (let w = band * 1.5; sel.length < 24 && w < 0.08; w *= 1.5) sel = pts.filter((p) => Math.abs(p[1] - y) < w);
    let cx = 0, cz = 0; sel.forEach((p) => { cx += p[0]; cz += p[2]; }); cx /= sel.length || 1; cz /= sel.length || 1;
    const R = new Array(N).fill(0), near = new Array(N).fill(null);
    for (const p of sel) {
      const a = Math.atan2(p[0] - cx, p[2] - cz);
      const k = ((Math.round(a / (2 * Math.PI) * N) % N) + N) % N;
      const d = Math.hypot(p[0] - cx, p[2] - cz);
      if (d > R[k]) { R[k] = d; near[k] = p; }
    }
    const R0 = R.slice(), n0 = near.slice();
    for (let k = 0; k < N; k++) if (!n0[k]) {
      for (let d = 1; d < N; d++) {
        const a = (k + d) % N, b = (k - d + N) % N;
        if (n0[a] || n0[b]) { const src = n0[a] ? a : b; R[k] = R0[src]; near[k] = n0[src]; break; }
      }
    }
    // smooth radii a little
    const Rs = R.map((r, k) => Math.max(r, (R[(k + 1) % N] + R[(k + N - 1) % N]) / 2));
    return { cx, cz, R: Rs, near, N };
  };
  const wOf = (p) => {
    const m = rd.meshes[p[3]]; const acc = new Map();
    for (const [n, w] of m.W[p[4]]) acc.set(n, w);
    return top4(acc, boneIndex);
  };
  const pos = [], nor = [], uv = [], idx = [], wts = [];
  // ribbon through a list of {p, n (outward), w} samples
  const ribbon = (samples, width) => {
    const base = pos.length / 3;
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      const prev = samples[Math.max(0, i - 1)].p, next = samples[Math.min(samples.length - 1, i + 1)].p;
      const t = next.clone().sub(prev).normalize();
      const side = new THREE.Vector3().crossVectors(t, s.n).normalize().multiplyScalar(width / 2);
      for (const sgn of [-1, 1]) {
        const q = s.p.clone().addScaledVector(side, sgn);
        pos.push(q.x, q.y, q.z); nor.push(s.n.x, s.n.y, s.n.z); uv.push(i / (samples.length - 1), sgn > 0 ? 1 : 0); wts.push(s.w);
      }
    }
    for (let i = 0; i < samples.length - 1; i++) { const a = base + i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  };
  // waist tie: full loop + two tails at the back
  const wr = ring(waistY);
  const waist = [];
  const k0 = Math.round(wr.N * 0.17), k1 = Math.round(wr.N * 0.83);
  for (let k = k0; k <= k1; k++) {
    const kk = k % wr.N, a = (kk / wr.N) * 2 * Math.PI, r = wr.R[kk] + 0.006;
    const n = V(Math.sin(a), 0, Math.cos(a));
    waist.push({ p: V(wr.cx + n.x * r, waistY, wr.cz + n.z * r), n, w: wOf(wr.near[kk]) });
  }
  ribbon(waist, 0.022);
  const back = wr.near[Math.round(wr.N / 2)];
  const bz = wr.cz - wr.R[Math.round(wr.N / 2)] - 0.008;
  for (const sx of [-1, 1]) {
    const tail = [];
    for (let i = 0; i <= 6; i++) {
      const f = i / 6;
      tail.push({ p: V(wr.cx + sx * (0.01 + f * 0.035), waistY - f * 0.26, bz - 0.004 - f * 0.012), n: V(0, 0, -1), w: wOf(back) });
    }
    ribbon(tail, 0.02);
  }
  // neck loop: bib corners -> sides of the neck -> around the back of the neck
  const neckY = tpl.restWorld.Neck.y + 0.03;
  const nr = ring(neckY, 0.015, 32);
  const neck = [];
  const corner = (sx) => { const c = sx < 0 ? 0 : bibXs.length - 1; return V(bibXs[c] - sx * 0.012, bibTop + 0.005, bibZ[c] + 0.006); };
  const L0 = corner(-1), R0 = corner(1);
  const ringPt = (a) => { const k = ((Math.round(a / (2 * Math.PI) * nr.N) % nr.N) + nr.N) % nr.N; const r = nr.R[k] + 0.008; return { p: V(nr.cx + Math.sin(a) * r, neckY, nr.cz + Math.cos(a) * r), n: V(Math.sin(a), 0.3, Math.cos(a)).normalize(), w: wOf(nr.near[k]) }; };
  const nearestW = (p) => { let best = null, bd = Infinity; for (const q of pts) { const d = (q[0] - p.x) ** 2 + (q[1] - p.y) ** 2 + (q[2] - p.z) ** 2; if (d < bd) { bd = d; best = q; } } return wOf(best); };
  const sA = 0.34 * Math.PI;   // where the strap meets the neck at the sides
  const sideL = ringPt(-sA), sideR = ringPt(sA);
  const F = frontMap(tpl);
  // straight part: lies on the chest (front depth map), blending into the neck loop at the top
  const onChest = (a, b, f, ring) => {
    const p = a.clone().lerp(b, f);
    const zf = F.at(p.x, p.y), k = ring === 'end' ? smooth((f - 0.55) / 0.45) : 1 - smooth((0.45 - f) / 0.45);
    let n = V(0, 0.3, 1);
    if (Number.isFinite(zf)) {
      const zx = F.at(p.x + 0.02, p.y) - F.at(p.x - 0.02, p.y), zy = F.at(p.x, p.y + 0.02) - F.at(p.x, p.y - 0.02);
      if (Number.isFinite(zx) && Number.isFinite(zy)) n = V(-zx / 0.04, -zy / 0.04, 1);
      p.z = THREE.MathUtils.lerp(Math.max(p.z, zf + 0.006), p.z, k);
    }
    n.normalize().lerp(ring === 'end' ? sideL.n : sideR.n, k).normalize();
    return { p, n, w: nearestW(p) };
  };
  const steps = 8;
  for (let i = 0; i <= steps; i++) neck.push(onChest(L0, sideL.p, i / steps, 'end'));
  for (let i = 1; i < 16; i++) { const a = -sA - (i / 16) * (2 * Math.PI - 2 * sA); neck.push(ringPt(a)); }
  for (let i = 0; i <= steps; i++) neck.push(onChest(sideR.p, R0, i / steps, 'start'));
  ribbon(neck, 0.02);
  return skinnedGeometry(tpl, new Float32Array(pos), new Float32Array(nor), uv, idx, wts);
}

// ----------------------------------------------------------------------------------- materials / textures
const sharedMats = new Map();
function cachedMat(key, make) { if (!sharedMats.has(key)) sharedMats.set(key, make()); return sharedMats.get(key); }

function fabricTexture(color, { logo = false, pocket = true } = {}) {
  const key = `fab:${color}:${logo}:${pocket}`;
  return cachedMat(key, () => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 512;
    const g = c.getContext('2d');
    g.fillStyle = color; g.fillRect(0, 0, 256, 512);
    // woven noise
    const img = g.getImageData(0, 0, 256, 512), d = img.data;
    let s = 1234567;
    for (let i = 0; i < d.length; i += 4) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      const n = ((s >> 16) & 255) / 255 - 0.5;
      const x = (i / 4) % 256, y = Math.floor(i / 4 / 256);
      const weave = ((x + y) % 4 < 2 ? 1 : -1) * 2;
      for (let k = 0; k < 3; k++) d[i + k] = clamp(d[i + k] + n * 10 + weave, 0, 255);
    }
    g.putImageData(img, 0, 0);
    const cc = new THREE.Color(color), dark = cc.r * 0.3 + cc.g * 0.59 + cc.b * 0.11 < 0.25;
    g.strokeStyle = dark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.16)';
    g.lineWidth = 1.5; g.setLineDash([5, 4]);
    g.strokeRect(5, 5, 246, 502);                                  // hem stitching
    if (pocket) { g.strokeRect(58, 340, 140, 92); g.beginPath(); g.moveTo(128, 340); g.lineTo(128, 432); g.stroke(); }
    g.setLineDash([]);
    if (logo) {
      g.fillStyle = dark ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.92)';
      g.font = '600 22px "Fredoka", "Jua", "IBM Plex Sans KR", sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('Seoulicious', 128, 92);
      g.font = '500 13px "IBM Plex Sans KR", sans-serif';
      g.fillText('서울리셔스', 128, 114);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return t;
  });
}

function apronMaterial(color, logo) {
  return cachedMat(`apron:${color}:${logo}`, () => new THREE.MeshStandardMaterial({ map: fabricTexture(color, { logo }), roughness: 0.93, metalness: 0, side: THREE.DoubleSide }));
}

// ----------------------------------------------------------------------------------- hats
function headFit(tpl) {
  if (tpl.cache.headFit) return tpl.cache.headFit;
  const rd = restData(tpl);
  const pts = [];
  for (const part of ['head', 'opacity']) {
    const m = rd.meshes[part]; if (!m) continue;
    for (let i = 0; i < m.count; i++) if (/Head|Neck|Eye|Brow|Nose|Cheek|Jaw|Lip|Mouth/.test(m.dom[i])) pts.push([m.P[i * 3], m.P[i * 3 + 1], m.P[i * 3 + 2], part]);
  }
  const head = tpl.restWorld.Head;
  const top = Math.max(...pts.filter((p) => Math.hypot(p[0] - head.x, p[2] - head.z) < 0.12).map((p) => p[1]));
  const bandY = top - 0.1;
  const sel = pts.filter((p) => Math.abs(p[1] - bandY - 0.015) < 0.02 && Math.hypot(p[0] - head.x, p[2] - head.z) < 0.16);
  const pct = (arr, q) => { const a = arr.slice().sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(q * (a.length - 1)))]; };
  const xs = sel.map((p) => p[0]), zs = sel.map((p) => p[2]);
  const x0 = pct(xs, 0.02), x1 = pct(xs, 0.98), z0 = pct(zs, 0.02), z1 = pct(zs, 0.98);
  const eyeY = tpl.restWorld.LEye ? (tpl.restWorld.LEye.y + tpl.restWorld.REye.y) / 2 : top - 0.12;
  const capY = Math.max(eyeY + 0.055, top - 0.115);
  const sel2 = pts.filter((p) => Math.abs(p[1] - capY - 0.02) < 0.02 && Math.hypot(p[0] - head.x, p[2] - head.z) < 0.16);
  const xs2 = sel2.map((p) => p[0]), zs2 = sel2.map((p) => p[2]);
  const cap = sel2.length > 10
    ? { y: capY, cx: (pct(xs2, 0.02) + pct(xs2, 0.98)) / 2, cz: (pct(zs2, 0.02) + pct(zs2, 0.98)) / 2, a: (pct(xs2, 0.98) - pct(xs2, 0.02)) / 2, b: (pct(zs2, 0.98) - pct(zs2, 0.02)) / 2 }
    : { y: capY, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, a: (x1 - x0) / 2, b: (z1 - z0) / 2 };
  return (tpl.cache.headFit = { top, bandY, eyeY, cap, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, a: (x1 - x0) / 2, b: (z1 - z0) / 2 });
}

function toqueGeometry(a, b, height) {
  const key = `toque:${a.toFixed(3)}:${b.toFixed(3)}:${height}`;
  return cachedMat(key, () => {
    // band, then a pleated body that flares out, then a soft puffed crown that overhangs a little
    const band = 0.065, crown = 0.07, body = height - band - crown;
    const prof = [new THREE.Vector2(0.97, -0.004), new THREE.Vector2(1.0, 0.0), new THREE.Vector2(1.0, band), new THREE.Vector2(0.99, band + 0.006)];
    for (let i = 1; i <= 10; i++) { const f = i / 10; prof.push(new THREE.Vector2(1.0 + 0.13 * Math.pow(f, 1.4), band + 0.006 + f * body)); }
    const r0 = 1.13, top = band + 0.006 + body;
    for (let i = 1; i <= 12; i++) {
      const th = (i / 12) * Math.PI;                       // around the puff: out, over, in
      const rr = r0 + 0.1 * Math.sin(th) - (r0 - 0.0) * (1 - Math.cos(th)) / 2 * (i === 12 ? 1 : 1);
      prof.push(new THREE.Vector2(Math.max(0.0001, rr * (i < 6 ? 1 : 1)), top + crown * 0.85 * Math.sin(th / 2) ** 1.2));
    }
    prof.push(new THREE.Vector2(0.0001, top + crown * 0.86));
    const g = new THREE.LatheGeometry(prof, 64);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const th = Math.atan2(z, x);
      const pleatW = smooth((y - band) / 0.04) * (1 - 0.6 * smooth((y - top) / crown));
      const pleat = 1 + 0.045 * pleatW * (Math.abs(Math.sin(th * 12)) - 0.5);
      p.setXYZ(i, x * a * pleat, y, z * b * pleat);
    }
    g.computeVertexNormals();
    return g;
  });
}

function capGeometry(a, b, h) {
  const key = `cap:${a.toFixed(3)}:${b.toFixed(3)}:${h.toFixed(3)}`;
  return cachedMat(key, () => {
    // six-panel crown: a slightly flattened dome, lower at the back
    const crown = new THREE.SphereGeometry(1, 36, 14, 0, Math.PI * 2, 0, Math.PI / 2);
    const p = crown.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const yy = Math.pow(y, 0.85);                              // fuller crown
      p.setXYZ(i, x * a, yy * h * (1 - 0.12 * Math.max(0, -z)), z * b);
    }
    crown.computeVertexNormals();
    // brim: crescent in front of the crown, gently curved down at the sides
    const bw = a * 0.92, bl = 0.072;
    const shape = new THREE.Shape();
    shape.moveTo(-bw, 0);
    shape.bezierCurveTo(-bw * 0.95, bl * 0.75, -bw * 0.45, bl, 0, bl);
    shape.bezierCurveTo(bw * 0.45, bl, bw * 0.95, bl * 0.75, bw, 0);
    shape.lineTo(-bw, 0);
    const brim = new THREE.ExtrudeGeometry(shape, { depth: 0.006, bevelEnabled: false, curveSegments: 16 });
    brim.rotateX(Math.PI / 2);
    const bp = brim.attributes.position;
    for (let i = 0; i < bp.count; i++) {
      const x = bp.getX(i), z = bp.getZ(i);
      const front = b * Math.sqrt(Math.max(0, 1 - (x / a) ** 2));
      bp.setXYZ(i, x, bp.getY(i) - 0.3 * (x * x) / bw - 0.08 * z + 0.004, z + front - 0.006);
    }
    brim.computeVertexNormals();
    const button = new THREE.SphereGeometry(0.008, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, h * 0.995, 0);
    return { crown, brim, button };
  });
}

function capTexture() {
  return cachedMat('capTex', () => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = '#1e1e21'; g.fillRect(0, 0, 256, 64);
    g.strokeStyle = 'rgba(255,255,255,0.10)'; g.lineWidth = 1.2;
    for (let k = 0; k < 6; k++) { const x = (k / 6) * 256 + 21; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 64); g.stroke(); }
    g.setLineDash([3, 3]); g.strokeStyle = 'rgba(255,255,255,0.08)';
    g.beginPath(); g.moveTo(0, 56); g.lineTo(256, 56); g.stroke();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return t;
  });
}

// ----------------------------------------------------------------------------------- name tag
function nameTagTexture(name) {
  return cachedMat('tag:' + name, () => {
    const c = document.createElement('canvas'); c.width = 384; c.height = 128;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    const draw = () => {
      const g = c.getContext('2d');
      g.fillStyle = '#fbfaf6'; g.fillRect(0, 0, 384, 128);
      g.fillStyle = BRAND_TEAL; g.fillRect(0, 0, 384, 30);
      g.fillStyle = '#ffffff'; g.font = '600 19px "Fredoka", "IBM Plex Sans KR", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('Seoulicious', 192, 16);
      g.fillStyle = '#1f2a2a';
      let size = 58;
      g.font = `600 ${size}px ${NAME_FONT}`;
      while (g.measureText(name).width > 350 && size > 20) { size -= 2; g.font = `600 ${size}px ${NAME_FONT}`; }
      g.fillText(name, 192, 80);
      t.needsUpdate = true;
    };
    draw();
    if (document.fonts && document.fonts.load) document.fonts.load(`600 40px "IBM Plex Sans KR"`, name).then(draw).catch(() => {});
    return t;
  });
}

// ----------------------------------------------------------------------------------- uniforms
const UNIFORMS = {
  'head-chef': { apron: '#f4f2ec', apronStyle: 'long', hat: 'toque', hatH: 0.24, logo: false },
  chef: { apron: '#f4f2ec', apronStyle: 'long', hat: 'toque', hatH: 0.17, logo: false },
  cook: { apron: '#2b2b2e', apronStyle: 'long', hat: 'cap', logo: true },
  server: { apron: BRAND_TEAL, apronStyle: 'short', hat: null, logo: true },
  cashier: { apron: CASHIER_PINK, apronStyle: 'short', hat: null, logo: true },
};

function buildUniform(r, uniform, builtin, name) {
  const tpl = r.tpl, out = [];
  const spec = uniform ? UNIFORMS[uniform] : null;
  if (uniform && !spec) throw new Error(`people: unknown uniform "${uniform}"`);
  const body = r.meshes.find((m) => m.userData.part === 'body');
  let apron = null;
  if (spec && spec.apron && !builtin.includes('apron')) {
    apron = apronGeometry(tpl, spec.apronStyle);
    const mat = apronMaterial(spec.apron, spec.logo);
    const m = new THREE.SkinnedMesh(apron.geo, mat);
    m.name = 'apron';
    m.bind(body.skeleton, new THREE.Matrix4());
    r.root.add(m);
    r.meshes.push(m); m.userData.part = 'apron';
    const sm = new THREE.SkinnedMesh(apron.straps, cachedMat(`strap:${spec.apron}`, () => new THREE.MeshStandardMaterial({ color: new THREE.Color(spec.apron).multiplyScalar(0.85), roughness: 0.9, side: THREE.DoubleSide })));
    sm.name = 'apron-straps';
    sm.bind(body.skeleton, new THREE.Matrix4());
    r.root.add(sm); r.meshes.push(sm); sm.userData.part = 'straps';
    out.push(m, sm);
  }
  if (spec && spec.hat && !builtin.includes('headwear')) {
    const hf = headFit(tpl);
    const headBone = r.b.Head;
    let hat;
    if (spec.hat === 'toque') {
      const builtinCap = builtin.includes('chef-cap');
      const a = hf.a + (builtinCap ? 0.004 : 0.008), b = hf.b + (builtinCap ? 0.004 : 0.008);
      hat = new THREE.Mesh(toqueGeometry(a, b, spec.hatH), cachedMat('toqueMat', () => new THREE.MeshStandardMaterial({ color: '#f7f6f2', roughness: 0.85 })));
      hat.position.set(hf.cx, hf.bandY - 0.005, hf.cz);
    } else {
      const cf = hf.cap;
      const { crown, brim, button } = capGeometry(cf.a + 0.007, cf.b + 0.007, hf.top - cf.y + 0.014);
      const mat = cachedMat('capMat', () => new THREE.MeshStandardMaterial({ map: capTexture(), color: '#ffffff', roughness: 0.85 }));
      const plain = cachedMat('capMat2', () => new THREE.MeshStandardMaterial({ color: '#1b1b1e', roughness: 0.8 }));
      hat = new THREE.Group();
      hat.add(new THREE.Mesh(crown, mat), new THREE.Mesh(brim, plain), new THREE.Mesh(button, plain));
      hat.position.set(cf.cx, cf.y, cf.cz);
    }
    hat.rotation.x = spec.hat === 'cap' ? -0.1 : -0.06;
    hat.name = 'hat';
    r.root.updateMatrixWorld(true);
    r.root.add(hat); hat.updateMatrixWorld(true);
    headBone.attach(hat);
    out.push(hat);
  }
  if (name) {
    const F = frontMap(tpl), D = tpl.dims;
    const x = 0.085, y = D.shoulderY - 0.145;
    let z = F.at(x, y);
    let n = V(0, 0, 1);
    if (apron) {
      const g = apron.grid;
      const ri = g.reduce((best, row, i) => (Math.abs(row.y - y) < Math.abs(g[best].y - y) ? i : best), 0);
      const row = g[ri];
      const ci = row.xs.reduce((best, xx, i) => (Math.abs(xx - x) < Math.abs(row.xs[best] - x) ? i : best), 0);
      z = Math.max(z, row.z[ci] + 0.009);
    }
    // surface slope -> tag orientation
    const zU = F.at(x, y + 0.03), zD = F.at(x, y - 0.03), zL = F.at(x - 0.03, y), zR = F.at(x + 0.03, y);
    if ([zU, zD, zL, zR].every(Number.isFinite)) n = V(-(zR - zL) / 0.06, -(zU - zD) / 0.06, 1).normalize();
    const tag = new THREE.Mesh(cachedMat('tagGeo', () => new THREE.BoxGeometry(0.074, 0.025, 0.002)),
      cachedMat('tagMat:' + name, () => new THREE.MeshStandardMaterial({ map: nameTagTexture(name), roughness: 0.45 })));
    tag.position.set(x, y, z + 0.004);
    tag.quaternion.setFromUnitVectors(FWD, n);
    tag.name = 'name-tag';
    tag.userData.noShadow = true;
    r.root.add(tag); tag.updateMatrixWorld(true);
    r.b.Spine2.attach(tag);
    out.push(tag);
  }
  return out;
}

// ----------------------------------------------------------------------------------- props
function std(key, params) { return cachedMat('m:' + key, () => new THREE.MeshStandardMaterial(params)); }
const PROP_MATS = {
  steel: () => std('steel', { color: '#d9dcdf', metalness: 0.55, roughness: 0.3 }),
  darkSteel: () => std('darkSteel', { color: '#2b2c2e', metalness: 0.6, roughness: 0.45 }),
  black: () => std('black', { color: '#141414', roughness: 0.55 }),
  glass: () => cachedMat('glassMat', () => new THREE.MeshStandardMaterial({ color: '#e8f0f2', roughness: 0.05, metalness: 0, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide })),
  wood: () => std('wood', { color: '#5a3a24', roughness: 0.6 }),
  ceramic: () => std('ceramic', { color: '#f1efe9', roughness: 0.35 }),
  stone: () => std('stone', { color: '#2f2d2b', roughness: 0.8 }),
  paper: () => std('paper', { color: '#f6f4ee', roughness: 0.8 }),
};

const PROPS = {
  chopsticks() {
    // Korean flat stainless chopsticks, along +Y, held end at y = 0
    const g = new THREE.Group();
    const geo = cachedMat('chopGeo', () => { const b = new THREE.CylinderGeometry(0.0022, 0.0035, 0.21, 6, 1); b.scale(1, 1, 0.45); b.translate(0, 0.105, 0); return b; });
    const a = new THREE.Mesh(geo, PROP_MATS.steel()), b = new THREE.Mesh(geo, PROP_MATS.steel());
    a.position.x = -0.006; a.rotation.z = -0.045; b.position.x = 0.006; b.rotation.z = 0.045;
    g.add(a, b); return g;
  },
  glass(variant = 0) {
    // tall tumbler of a soft drink (no alcohol is served): 0 = strawberry milk + teal straw,
    // 1 = orange juice + pink straw; ice cubes on top. Axis +Y, base at y = 0.
    const g = new THREE.Group();
    const H = 0.14, fillH = 0.108;
    const wall = new THREE.Mesh(cachedMat('glassGeo2', () => new THREE.CylinderGeometry(0.035, 0.029, H, 28, 1, true).translate(0, H / 2, 0)), PROP_MATS.glass());
    const bottom = new THREE.Mesh(cachedMat('glassBot2', () => new THREE.CylinderGeometry(0.029, 0.029, 0.008, 28).translate(0, 0.004, 0)), PROP_MATS.glass());
    const fillMat = variant ? std('juice', { color: '#f39a1c', roughness: 0.25, transparent: true, opacity: 0.94 }) : std('strawberryMilk', { color: '#f3a7bd', roughness: 0.45 });
    const fill = new THREE.Mesh(cachedMat('fillGeo2', () => new THREE.CylinderGeometry(0.0325, 0.0275, fillH, 28).translate(0, 0.008 + fillH / 2, 0)), fillMat);
    const ice = std('ice', { color: '#eef7fa', roughness: 0.05, transparent: true, opacity: 0.55 });
    const cube = cachedMat('iceGeo', () => new THREE.BoxGeometry(0.017, 0.015, 0.017));
    [[-0.011, 0.004, 0.3], [0.012, -0.006, 1.1], [0.0, 0.013, 2.0]].forEach(([x, z, r], i) => {
      const c = new THREE.Mesh(cube, ice);
      c.position.set(x, 0.008 + fillH - 0.002 + (i === 2 ? 0.004 : 0), z);
      c.rotation.set(r * 0.4, r, r * 0.25);
      g.add(c);
    });
    const straw = new THREE.Mesh(cachedMat('strawGeo', () => new THREE.CylinderGeometry(0.0033, 0.0033, 0.2, 8).translate(0, 0.1, 0)),
      std(variant ? 'strawPink' : 'strawTeal', { color: variant ? CASHIER_PINK : BRAND_TEAL, roughness: 0.4 }));
    straw.position.set(0.008, 0.012, -0.004);
    straw.rotation.set(-0.08, 0, -0.2);
    wall.renderOrder = 2; bottom.renderOrder = 2;
    wall.userData.noShadow = true; bottom.userData.noShadow = true;
    g.add(fill, straw, bottom, wall);
    return g;
  },
  phone() {
    // portrait phone, long axis +Y, screen facing +Z, centered
    const g = new THREE.Group();
    const body = new THREE.Mesh(cachedMat('phoneGeo', () => new THREE.BoxGeometry(0.071, 0.148, 0.008)), PROP_MATS.black());
    const screenMat = cachedMat('screenMat', () => {
      const c = document.createElement('canvas'); c.width = 64; c.height = 128;
      const x = c.getContext('2d'); const gr = x.createLinearGradient(0, 0, 0, 128);
      gr.addColorStop(0, '#3a6c8f'); gr.addColorStop(1, '#a9d1c9'); x.fillStyle = gr; x.fillRect(0, 0, 64, 128);
      x.fillStyle = 'rgba(255,255,255,0.75)'; for (let i = 0; i < 5; i++) x.fillRect(8, 20 + i * 20, 48 - (i % 2) * 14, 8);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      return new THREE.MeshStandardMaterial({ map: t, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 0.55, roughness: 0.2 });
    });
    const screen = new THREE.Mesh(cachedMat('screenGeo', () => new THREE.PlaneGeometry(0.066, 0.14)), screenMat);
    screen.position.z = 0.0042;
    g.add(body, screen); return g;
  },
  tray(width = 0.46) {
    // serving tray in the XZ plane (top surface at y = 0), centered, with Korean BBQ side dishes
    const g = new THREE.Group();
    const d = 0.34, w = width;
    const base = new THREE.Mesh(new THREE.BoxGeometry(w, 0.012, d), PROP_MATS.wood());
    base.position.y = -0.006;
    g.add(base);
    const rimGeoX = new THREE.BoxGeometry(w, 0.022, 0.012), rimGeoZ = new THREE.BoxGeometry(0.012, 0.022, d);
    for (const s of [-1, 1]) {
      const rx = new THREE.Mesh(rimGeoX, PROP_MATS.wood()); rx.position.set(0, 0.005, s * (d / 2 - 0.006)); g.add(rx);
      const rz = new THREE.Mesh(rimGeoZ, PROP_MATS.wood()); rz.position.set(s * (w / 2 - 0.006), 0.005, 0); g.add(rz);
    }
    const bowl = cachedMat('bowlGeo', () => new THREE.CylinderGeometry(0.045, 0.03, 0.035, 20).translate(0, 0.0175, 0));
    const fill = cachedMat('fillGeo', () => new THREE.CylinderGeometry(0.041, 0.041, 0.004, 20).translate(0, 0.031, 0));
    const colors = ['#b8432c', '#6d8f3a', '#d9b25a', '#a83a2a'];
    [[-0.13, -0.08], [-0.03, -0.09], [0.07, -0.08], [-0.13, 0.05]].forEach(([x, z], i) => {
      const b = new THREE.Mesh(bowl, PROP_MATS.ceramic()); b.position.set(x, 0, z); g.add(b);
      const f = new THREE.Mesh(fill, std('fill' + i, { color: colors[i], roughness: 0.6 })); f.position.set(x, 0, z); g.add(f);
    });
    const pot = new THREE.Mesh(cachedMat('potGeo', () => new THREE.CylinderGeometry(0.075, 0.06, 0.07, 24).translate(0, 0.035, 0)), PROP_MATS.stone());
    pot.position.set(0.1, 0, 0.06); g.add(pot);
    const stew = new THREE.Mesh(cachedMat('stewGeo', () => new THREE.CylinderGeometry(0.068, 0.068, 0.004, 24).translate(0, 0.062, 0)), std('stew', { color: '#c0402a', roughness: 0.35 }));
    stew.position.copy(pot.position); g.add(stew);
    return g;
  },
  camera() {
    // instant camera, lens facing +Z, centered, up +Y
    const g = new THREE.Group();
    const colors = ['#a9d8c6', '#f2b8c6', '#f4f1ea', '#9cc3e6'];
    const body = new THREE.Mesh(cachedMat('camGeo', () => new THREE.BoxGeometry(0.108, 0.118, 0.068)), std('cam' + (instantCamColor % 4), { color: colors[instantCamColor++ % 4], roughness: 0.55 }));
    g.add(body);
    const lensRing = new THREE.Mesh(cachedMat('lensGeo', () => new THREE.CylinderGeometry(0.03, 0.032, 0.022, 24).rotateX(Math.PI / 2)), PROP_MATS.black());
    lensRing.position.set(0.004, -0.008, 0.044); g.add(lensRing);
    const glass = new THREE.Mesh(cachedMat('lensGlass', () => new THREE.CircleGeometry(0.019, 20)), std('lensGlass', { color: '#1a2633', roughness: 0.05, metalness: 0.3 }));
    glass.position.set(0.004, -0.008, 0.0552); g.add(glass);
    const flash = new THREE.Mesh(cachedMat('flashGeo', () => new THREE.PlaneGeometry(0.03, 0.016)), std('flash', { color: '#e9eef0', roughness: 0.1, emissive: '#555', emissiveIntensity: 0.3 }));
    flash.position.set(0.03, 0.04, 0.0345); g.add(flash);
    const vf = new THREE.Mesh(cachedMat('vfGeo', () => new THREE.BoxGeometry(0.018, 0.014, 0.004)), PROP_MATS.black());
    vf.position.set(-0.03, 0.04, -0.035); g.add(vf);
    return g;
  },
  pan() {
    // frying pan; handle along +X from the grip (x = 0), pan bowl centered at x = 0.3, bottom normal +Y
    const g = new THREE.Group();
    const prof = [new THREE.Vector2(0, 0), new THREE.Vector2(0.1, 0), new THREE.Vector2(0.125, 0.012), new THREE.Vector2(0.135, 0.045), new THREE.Vector2(0.131, 0.046), new THREE.Vector2(0.12, 0.014), new THREE.Vector2(0.097, 0.004), new THREE.Vector2(0, 0.004)];
    const pan = new THREE.Mesh(cachedMat('panGeo', () => new THREE.LatheGeometry(prof, 32)), PROP_MATS.darkSteel());
    pan.position.set(0.3, -0.05, 0); g.add(pan);
    const handle = new THREE.Mesh(cachedMat('handleGeo', () => new THREE.CylinderGeometry(0.011, 0.013, 0.2, 10).rotateZ(Math.PI / 2)), PROP_MATS.black());
    handle.position.set(0.07, -0.02, 0); handle.rotation.z = 0.15; g.add(handle);
    const food = new THREE.Mesh(cachedMat('panFood', () => new THREE.CylinderGeometry(0.09, 0.09, 0.01, 20)), std('panFood', { color: '#b5652e', roughness: 0.7 }));
    food.position.set(0.3, -0.04, 0); g.add(food);
    return g;
  },
  knife() {
    // chef knife: handle along +X centered on the grip, blade continues along +X, edge towards -Y
    const g = new THREE.Group();
    const handle = new THREE.Mesh(cachedMat('kHandle', () => new THREE.BoxGeometry(0.115, 0.024, 0.017)), PROP_MATS.black());
    handle.position.x = 0.0; g.add(handle);
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.012); shape.lineTo(0.2, 0.004); shape.quadraticCurveTo(0.21, -0.01, 0.19, -0.02); shape.quadraticCurveTo(0.1, -0.038, 0, -0.036); shape.lineTo(0, 0.012);
    const blade = new THREE.Mesh(cachedMat('kBlade', () => new THREE.ExtrudeGeometry(shape, { depth: 0.002, bevelEnabled: false }).translate(0, 0, -0.001)), PROP_MATS.steel());
    blade.position.x = 0.06; g.add(blade);
    return g;
  },
  ladle() {
    // long ladle: grip at origin, shaft towards -X (into the pot), bowl at the end
    const g = new THREE.Group();
    const shaft = new THREE.Mesh(cachedMat('ladleShaft', () => new THREE.CylinderGeometry(0.005, 0.006, 0.3, 8).rotateZ(Math.PI / 2)), PROP_MATS.steel());
    shaft.position.x = -0.09; g.add(shaft);
    const bowl = new THREE.Mesh(cachedMat('ladleBowl', () => new THREE.SphereGeometry(0.038, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)), PROP_MATS.steel());
    bowl.position.x = -0.255; bowl.rotation.z = Math.PI / 2; g.add(bowl);
    return g;
  },
  polaroid() {
    // instant photo, in the XY plane, image facing +Z, centered
    const g = new THREE.Group();
    const frame = new THREE.Mesh(cachedMat('polFrame', () => new THREE.BoxGeometry(0.054, 0.086, 0.0008)), PROP_MATS.paper());
    g.add(frame);
    const c = document.createElement('canvas'); c.width = 64; c.height = 64;
    const x = c.getContext('2d');
    const hue = Math.floor(Math.random() * 360);
    const gr = x.createLinearGradient(0, 0, 64, 64);
    gr.addColorStop(0, `hsl(${hue},45%,62%)`); gr.addColorStop(1, `hsl(${(hue + 50) % 360},40%,38%)`);
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    x.fillStyle = 'rgba(255,230,200,0.75)'; x.beginPath(); x.arc(24, 30, 9, 0, 7); x.arc(42, 32, 8, 0, 7); x.fill();
    x.fillStyle = 'rgba(60,40,30,0.55)'; x.fillRect(12, 40, 24, 24); x.fillRect(34, 40, 18, 24);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const img = new THREE.Mesh(cachedMat('polImgGeo', () => new THREE.PlaneGeometry(0.046, 0.046)), new THREE.MeshStandardMaterial({ map: t, roughness: 0.4 }));
    img.position.set(0, 0.008, 0.0005); g.add(img);
    return g;
  },
};
let instantCamColor = 0;

// Place a prop. Default: in the right hand's grip frame (X = thumb side, Y = fingers, Z = out of the palm).
function attachProp(r, kind, poseName, ctx) {
  if (!PROPS[kind]) throw new Error(`people: unknown prop "${kind}"`);
  const s = 'R';
  const f = r.handFrame(s);
  const grip = r.gripPoint(s, 0.02);
  const X = f.side.clone(), Y = f.dir.clone(), Z = f.palm.clone();
  const basis = (x, y, z) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  let obj, pos, quat;
  const upRef = (axis) => { const u = UP.clone().addScaledVector(axis, -UP.dot(axis)); if (u.lengthSq() < 1e-4) u.copy(Z); return u.normalize(); };
  switch (kind) {
    case 'chopsticks': {
      obj = PROPS.chopsticks();
      const d = Y.clone().multiplyScalar(0.95).addScaledVector(Z, 0.12).addScaledVector(X, -0.12).normalize();
      const side = new THREE.Vector3().crossVectors(d, Z).normalize();
      quat = basis(side, d, new THREE.Vector3().crossVectors(side, d));
      pos = r.wp(`${s} Hand`).lerp(f.mid, 0.55).addScaledVector(X, 0.022).addScaledVector(Z, 0.004).addScaledVector(d, -0.07);
      break;
    }
    case 'glass': {
      obj = PROPS.glass(Math.abs(Math.floor(ctx.seed || 0)) % 2);
      const up = X.clone();
      const zz = Z.clone().addScaledVector(up, -Z.dot(up)).normalize();
      quat = basis(new THREE.Vector3().crossVectors(up, zz), up, zz);
      pos = grip.clone().addScaledVector(Z, 0.022).addScaledVector(up, -0.05);
      break;
    }
    case 'phone': {
      obj = PROPS.phone();
      if (ctx.phoneCenter) {
        // screen faces the eyes, top of the phone away from the person
        const toEye = r.eyes().sub(ctx.phoneCenter).normalize();
        const yy = FWD.clone().addScaledVector(toEye, -FWD.dot(toEye)).normalize();
        quat = basis(new THREE.Vector3().crossVectors(yy, toEye), yy, toEye);
        pos = r.gripPoint('L', 0.015).add(r.gripPoint('R', 0.015)).multiplyScalar(0.5);
      } else {
        quat = basis(X.clone(), Y.clone(), Z.clone());
        pos = grip.clone().addScaledVector(Z, -0.004).addScaledVector(Y, 0.01);
      }
      break;
    }
    case 'tray': {
      if (ctx && poseName === 'carry-tray') {
        const gl = r.gripPoint('L', 0.012), gr = r.gripPoint('R', 0.012);
        const w = gl.distanceTo(gr) + 0.04;
        obj = PROPS.tray(w);
        const xAxis = gl.clone().sub(gr).normalize();
        const yAxis = UP.clone().addScaledVector(xAxis, -UP.dot(xAxis)).normalize();
        quat = basis(xAxis, yAxis, new THREE.Vector3().crossVectors(xAxis, yAxis));
        pos = gl.clone().add(gr).multiplyScalar(0.5).add(V(0, 0.012, 0.05));
      } else {
        obj = PROPS.tray(0.42);
        const yAxis = Z.clone();
        const xAxis = Y.clone().addScaledVector(yAxis, -Y.dot(yAxis)).normalize();
        quat = basis(xAxis, yAxis, new THREE.Vector3().crossVectors(xAxis, yAxis));
        pos = grip.clone().addScaledVector(Z, -0.004).addScaledVector(Y, -0.02);
      }
      break;
    }
    case 'camera': {
      obj = PROPS.camera();
      if (ctx.camCenter) {
        quat = basis(RIGHT_X.clone(), UP.clone(), FWD.clone());
        pos = ctx.camCenter.clone();
      } else {
        quat = basis(new THREE.Vector3().crossVectors(X, Z), X, Z);
        pos = grip.clone().addScaledVector(Z, 0.035);
      }
      break;
    }
    case 'pan': case 'knife': case 'ladle': {
      obj = PROPS[kind]();
      // the handle runs through the fist along the thumb direction (X); pan and knife extend past the
      // thumb, the ladle's shaft hangs out below the little finger. Keep the prop's "up" close to world up.
      const xAxis = X.clone();
      const yAxis = upRef(xAxis);
      quat = basis(xAxis, yAxis, new THREE.Vector3().crossVectors(xAxis, yAxis));
      pos = grip.clone().addScaledVector(Z, 0.004).addScaledVector(xAxis, kind === 'knife' ? -0.01 : 0);
      break;
    }
    case 'polaroid': {
      obj = PROPS.polaroid();
      if (ctx.pinPoint) {
        // pressed to the wall by thumb + index at its bottom edge; the picture faces the room
        quat = basis(RIGHT_X.clone().negate(), UP.clone(), FWD.clone().negate());
        const tip = r.wp('R Finger12').add(r.wp('R Finger02')).multiplyScalar(0.5);
        pos = V(tip.x + 0.01, tip.y + 0.04, ctx.pinPoint.z - 0.002);
        // a small stack of more photos in the other hand
        const stack = new THREE.Group();
        for (let i = 0; i < 3; i++) { const ph = PROPS.polaroid(); ph.position.set(i * 0.004, i * 0.003, i * 0.0012); ph.rotation.z = (i - 1) * 0.08; stack.add(ph); }
        const fl = r.handFrame('L');
        stack.quaternion.copy(basis(new THREE.Vector3().crossVectors(fl.dir, fl.palm), fl.dir, fl.palm));
        stack.position.copy(r.gripPoint('L', 0.012).addScaledVector(fl.dir, 0.03));
        stack.name = 'prop:polaroids';
        r.root.parent.add(stack); stack.updateMatrixWorld(true); r.b['L Hand'].attach(stack);
      } else {
        const zz = Z.clone();
        quat = basis(new THREE.Vector3().crossVectors(Y, zz), Y, zz);
        pos = grip.clone().addScaledVector(Y, 0.03).addScaledVector(Z, 0.006);
      }
      break;
    }
  }
  obj.position.copy(pos);
  obj.quaternion.copy(quat);
  obj.name = 'prop:' + kind;
  r.root.parent.add(obj);              // props are placed in world (person) space, unscaled
  obj.updateMatrixWorld(true);
  r.b[`${s} Hand`].attach(obj);
  return obj;
}

// ----------------------------------------------------------------------------------- faces
// Rocketbox faces are driven by ~28 small bones. Expressions are built from "action units": offsets in
// millimetres in face space (x = towards the person's LEFT, y = up, z = forward) for the left-side bone
// (the right side is mirrored), or rotations in degrees about the face's left-right axis.
//   { b: bone, t: [x, y, z] }          translate         (paired bones are written without the L/R prefix)
//   { b: bone, r: deg }                rotate about its own origin (jaw)
//   { b: bone, r: deg, pivot: 'Eye' }  rotate about the eye centre (eyelids slide over the eyeball)
const FACE_AU = {
  // closed-mouth smile: lip corners up/out/back, cheeks lifted, lower lids pushed up a little
  smile: [
    { b: 'MouthCorner', t: [5.5, 6.5, -4.0] }, { b: 'Cheek', t: [1.5, 4.5, 1.5] }, { b: 'Caninus', t: [2.0, 3.0, 0.3] },
    { b: 'Upperlip', t: [2.0, 1.2, -0.8] }, { b: 'MouthBottom', t: [2.4, 2.0, -1.0] }, { b: 'Masseter', t: [1.2, 1.4, 0] },
    { b: 'MBottomLip', t: [0, 1.0, -0.6] }, { b: 'MUpperLip', t: [0, 0.3, -0.5] }, { b: 'EyeBlinkBottom', r: -5, pivot: 'Eye' },
  ],
  // open smile on top of "smile": upper lip lifts off the teeth, jaw drops, corners go wider
  grin: [
    { b: 'MouthCorner', t: [2.0, 2.0, -1.5] }, { b: 'MUpperLip', t: [0, 2.2, 0.2] }, { b: 'Upperlip', t: [0.5, 2.6, 0] },
    { b: 'Cheek', t: [0.6, 2.0, 0.8] }, { b: 'Caninus', t: [0.6, 1.8, 0.2] }, { b: 'MJaw', r: 5.0 },
    { b: 'MBottomLip', t: [0, -0.4, 0] }, { b: 'EyeBlinkBottom', r: -5, pivot: 'Eye' }, { b: 'EyeBlinkTop', r: 6, pivot: 'Eye' },
  ],
  jaw: [{ b: 'MJaw', r: 9 }],                                                        // mouth open
  lipsOpen: [{ b: 'MUpperLip', t: [0, 1.0, 0] }, { b: 'Upperlip', t: [0, 0.8, 0] }, { b: 'MBottomLip', t: [0, -1.4, 0] }, { b: 'MouthBottom', t: [0, -1.1, 0] }],
  oo: [{ b: 'MouthCorner', t: [-2.6, 0, 1.2] }, { b: 'MUpperLip', t: [0, 0.3, 1.2] }, { b: 'MBottomLip', t: [0, -0.3, 1.2] }, { b: 'Upperlip', t: [-0.8, 0.2, 0.8] }, { b: 'MouthBottom', t: [-0.8, -0.2, 0.8] }],
  ee: [{ b: 'MouthCorner', t: [2.2, 0.6, -1.0] }, { b: 'Upperlip', t: [0.5, 0.5, 0] }, { b: 'MouthBottom', t: [0.5, -0.4, 0] }],
  press: [{ b: 'MBottomLip', t: [0, 0.7, -0.4] }, { b: 'MUpperLip', t: [0, -0.4, -0.3] }, { b: 'MouthCorner', t: [0.8, 0.3, -0.6] }],
  blink: [{ b: 'EyeBlinkTop', r: 34, pivot: 'Eye' }, { b: 'EyeBlinkBottom', r: -8, pivot: 'Eye' }],
  lidDown: [{ b: 'EyeBlinkTop', r: 12, pivot: 'Eye' }],                              // relaxed / looking down
  squint: [{ b: 'EyeBlinkBottom', r: -6, pivot: 'Eye' }, { b: 'EyeBlinkTop', r: 5, pivot: 'Eye' }, { b: 'Cheek', t: [0, 1.0, 0.4] }],
  browUp: [{ b: 'InnerEyebrow', t: [0, 5.0, 0] }, { b: 'OuterEyebrow', t: [0, 4.5, 0] }, { b: 'MMiddleEyebrow', t: [0, 4.0, 0] }, { b: 'EyeBlinkTop', r: -4, pivot: 'Eye' }],
  browIn: [{ b: 'InnerEyebrow', t: [-1.2, -1.0, 0.4] }, { b: 'MMiddleEyebrow', t: [0, -0.8, 0.3] }],   // concentration
  browSoft: [{ b: 'InnerEyebrow', t: [0, 1.6, 0] }, { b: 'OuterEyebrow', t: [0, -0.4, 0] }],          // friendly, open
};
const FACE_PAIRED = new Set(['Eye', 'MouthBottom', 'Masseter', 'Caninus', 'EyeBlinkBottom', 'Upperlip', 'MouthCorner', 'Cheek', 'EyeBlinkTop', 'InnerEyebrow', 'OuterEyebrow']);

// Base expression per mood (action-unit weights). Animated people move around these; static ones bake them.
const MOODS = {
  neutral: {},
  smile: { smile: 1.1, browSoft: 0.4, squint: 0.2 },
  laugh: { smile: 1.2, grin: 0.6, browSoft: 0.4, squint: 0.3 },
  talk: { smile: 0.7, browSoft: 0.3, squint: 0.1 },
  focus: { smile: 0.4, browIn: 0.3, lidDown: 0.3, press: 0.2 },
};
const POSE_MOOD = {
  stand: 'smile', 'stand-talk': 'talk', wave: 'smile', sit: 'smile', 'sit-eat': 'smile', 'sit-talk': 'talk', 'sit-cheers': 'laugh',
  'sit-phone': 'smile', 'cook-stir': 'focus', 'cook-flip': 'focus', 'prep-chop': 'focus', cashier: 'smile', 'carry-tray': 'smile', photo: 'smile', pin: 'smile',
};

function faceTemplate(tpl) {
  if (tpl.cache.face !== undefined) return tpl.cache.face;
  const b = tpl.bones;
  if (!b.LEye || !b.REye || !b.MJaw || !b.LMouthCorner) return (tpl.cache.face = null);
  // rest pose of the template
  for (const [name, r] of tpl.rest) { b[name].position.copy(r.p); b[name].quaternion.copy(r.q); }
  tpl.scene.updateMatrixWorld(true);
  const wp = (n) => new THREE.Vector3().setFromMatrixPosition(b[n].matrixWorld);
  const scale = wp('LEye').distanceTo(wp('REye')) / 0.062;            // face size relative to an average adult
  const data = {};
  const add = (name, side) => {
    const bone = b[name]; if (!bone) return;
    const pq = bone.parent.getWorldQuaternion(new THREE.Quaternion());
    const inv = pq.clone().invert();
    const d = { rest: tpl.rest.get(name), inv, side, axX: RIGHT_X.clone().applyQuaternion(inv), axY: UP.clone().applyQuaternion(inv) };
    const eye = side ? b[(side > 0 ? 'L' : 'R') + 'Eye'] : null;
    if (eye) d.pivot = bone.parent.worldToLocal(wp(eye.name === b.LEye.name ? 'LEye' : 'REye'));
    data[name] = d;
  };
  for (const n of FACE_PAIRED) { add('L' + n, 1); add('R' + n, -1); }
  for (const n of ['MJaw', 'MBottomLip', 'MUpperLip', 'MMiddleEyebrow', 'MNose', 'MTongue']) add(n, 0);
  return (tpl.cache.face = { scale, data });
}

class Face {
  constructor(rig) {
    this.rig = rig;
    this.tpl = faceTemplate(rig.tpl);
    this.ok = !!this.tpl;
    if (!this.ok) return;
    this.items = Object.entries(this.tpl.data).filter(([n]) => rig.b[n]).map(([name, d]) => ({ name, d, bone: rig.b[name], t: new THREE.Vector3(), r: 0, touched: false }));
    this.byName = new Map(this.items.map((it) => [it.name, it]));
    this.eyes = ['LEye', 'REye'].map((n) => this.byName.get(n));
    this._q = new THREE.Quaternion(); this._v = new THREE.Vector3();
  }
  // weights: { au: weight }, gaze: { yaw, pitch } in radians (yaw > 0 looks to the person's left, pitch > 0 looks up)
  apply(weights, gaze) {
    if (!this.ok) return;
    for (const it of this.items) { it.t.set(0, 0, 0); it.r = 0; }
    for (const au in weights) {
      const w = weights[au], ops = FACE_AU[au];
      if (!w || !ops) continue;
      for (const op of ops) {
        const paired = FACE_PAIRED.has(op.b);
        for (const side of paired ? [1, -1] : [0]) {
          const it = this.byName.get(paired ? (side > 0 ? 'L' : 'R') + op.b : op.b);
          if (!it) continue;
          if (op.t) { it.t.x += op.t[0] * w * (side || 1); it.t.y += op.t[1] * w; it.t.z += op.t[2] * w; }
          if (op.r) it.r += op.r * w;
        }
      }
    }
    const k = this.tpl.scale * 0.001;
    const q = this._q, v = this._v;
    for (const it of this.items) {
      const d = it.d, bone = it.bone;
      if (it === this.eyes[0] || it === this.eyes[1]) continue;
      bone.position.copy(d.rest.p); bone.quaternion.copy(d.rest.q);
      if (it.r) {
        q.setFromAxisAngle(d.axX, it.r * DEG);
        bone.quaternion.premultiply(q);
        if (d.pivot && it.name.includes('Blink')) bone.position.sub(d.pivot).applyQuaternion(q).add(d.pivot);
      }
      if (it.t.lengthSq() > 0) bone.position.add(v.copy(it.t).multiplyScalar(k).applyQuaternion(d.inv));
    }
    const yaw = gaze ? gaze.yaw : 0, pitch = gaze ? gaze.pitch : 0;
    for (const it of this.eyes) {
      if (!it) continue;
      it.bone.quaternion.copy(it.d.rest.q);
      if (pitch) it.bone.quaternion.premultiply(q.setFromAxisAngle(it.d.axX, -pitch));
      if (yaw) it.bone.quaternion.premultiply(q.setFromAxisAngle(it.d.axY, yaw));
    }
  }
}

// ----------------------------------------------------------------------------------- skin + eye shading
// Small additions to MeshStandardMaterial for the avatar head/body materials:
//   - skin texels (found by comparing the colour map with the avatar's own skin tone) get wrap lighting,
//     a reddish scatter band at the light terminator, a warm lift of the ambient light and a satin
//     roughness, so shadowed cheeks/hands stay warm instead of grey;
//   - eyeballs (per-vertex mask "pEye") get a wet, glossy surface that picks up catchlights, and a
//     little extra fill so the whites never go dark under the brow.
const SKIN = { wrap: 0.3, scatter: 0.3, ambient: 0.1, rough: 0.56, eyeRough: 0.07, eyeFill: 0.25 };

function sampleSkinTone(tpl) {
  const head = tpl.meshes.find((m) => m.userData.part === 'head') || tpl.meshes[0];
  const map = head && head.material.map;
  const fallback = new THREE.Color(0.55, 0.36, 0.27);
  if (!map || !map.image || typeof document === 'undefined') return fallback;
  try {
    const S = 128;
    const c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(map.image, 0, 0, S, S);
    const px = g.getImageData(0, 0, S, S).data;
    const rd = restData(tpl).meshes[head.userData.part];
    const uv = head.geometry.attributes.uv;
    map.updateMatrix();
    const v = new THREE.Vector2(), samples = [];
    for (let i = 0; i < rd.count; i++) {
      if (!/Cheek|Caninus|Masseter|MNose/.test(rd.dom[i])) continue;
      v.fromBufferAttribute(uv, i).applyMatrix3(map.matrix);
      const x = clamp(Math.floor((v.x - Math.floor(v.x)) * S), 0, S - 1), y = clamp(Math.floor((v.y - Math.floor(v.y)) * S), 0, S - 1);
      const o = (y * S + x) * 4;
      samples.push([px[o], px[o + 1], px[o + 2]]);
    }
    if (samples.length < 8) return fallback;
    samples.sort((a, b) => (a[0] + a[1] + a[2]) - (b[0] + b[1] + b[2]));
    const mid = samples.slice(Math.floor(samples.length * 0.3), Math.ceil(samples.length * 0.8));
    const s = mid.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]], [0, 0, 0]).map((x) => x / mid.length / 255);
    return new THREE.Color().setRGB(s[0], s[1], s[2], THREE.SRGBColorSpace);
  } catch (e) { return fallback; }
}

function patchSkinMaterial(mat, tone) {
  mat.userData.skinTone = tone;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.pSkinTone = { value: tone };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float pEye;\nvarying float vPEye;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvPEye = pEye;');
    let f = shader.fragmentShader;
    f = f.replace('#include <common>', '#include <common>\nuniform vec3 pSkinTone;\nvarying float vPEye;\nfloat gSkin = 0.0;');
    f = f.replace('#include <map_fragment>', `#include <map_fragment>
	{
		vec3 pc = diffuseColor.rgb;
		float pl = dot( pc, vec3( 0.3333 ) ) + 1e-4;
		float pr = dot( pSkinTone, vec3( 0.3333 ) ) + 1e-4;
		float pd = distance( pc / pl, pSkinTone / pr );
		float plr = pl / pr;
		gSkin = ( 1.0 - smoothstep( 0.16, 0.40, pd ) ) * smoothstep( 0.22, 0.5, plr ) * ( 1.0 - smoothstep( 2.4, 3.6, plr ) ) * ( 1.0 - vPEye );
		// eyes: lift the whites and irises a little
		diffuseColor.rgb = mix( diffuseColor.rgb, min( vec3( 1.0 ), pow( diffuseColor.rgb, vec3( 0.93 ) ) * 1.05 ), vPEye );
	}`);
    f = f.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
	roughnessFactor = mix( roughnessFactor, ${SKIN.rough.toFixed(3)}, gSkin );
	roughnessFactor = mix( roughnessFactor, ${SKIN.eyeRough.toFixed(3)}, vPEye );`);
    const chunk = THREE.ShaderChunk.lights_physical_pars_fragment;
    const lambert = 'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );';
    if (chunk && chunk.includes(lambert)) {
      f = f.replace('#include <lights_physical_pars_fragment>', chunk.replace(lambert, `
	float pWrap = ${SKIN.wrap.toFixed(3)} * gSkin;
	float pNL = saturate( ( dot( geometryNormal, directLight.direction ) + pWrap ) / ( 1.0 + pWrap ) );
	vec3 pIrr = pNL * directLight.color;
	pIrr += gSkin * ${SKIN.scatter.toFixed(3)} * directLight.color * vec3( 1.0, 0.28, 0.12 ) * smoothstep( 0.0, 0.3, pNL ) * ( 1.0 - smoothstep( 0.05, 0.55, dotNL ) );
	reflectedLight.directDiffuse += pIrr * BRDF_Lambert( material.diffuseColor );`));
    }
    f = f.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
	{
		float pFres = pow( 1.0 - saturate( dot( geometryNormal, geometryViewDir ) ), 3.0 );
		reflectedLight.indirectDiffuse *= mix( vec3( 1.0 ), vec3( 1.0 + ${SKIN.ambient.toFixed(3)}, 1.0 + ${(SKIN.ambient * 0.35).toFixed(3)}, 1.0 ) * ( 1.0 + 0.35 * pFres ), gSkin );
		reflectedLight.indirectDiffuse *= 1.0 + ${SKIN.eyeFill.toFixed(3)} * vPEye;
	}`);
    shader.fragmentShader = f;
  };
  mat.customProgramCacheKey = () => 'people-skin-1';
  mat.needsUpdate = true;
}

// per-vertex eye mask for the head mesh (zeros elsewhere)
function addEyeMask(mesh) {
  const g = mesh.geometry;
  if (g.attributes.pEye) return;
  const n = g.attributes.position.count, a = new Float32Array(n);
  const bones = mesh.skeleton.bones, si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
  const isEye = bones.map((b) => /(^|_)[LR]Eye$/.test(b.name));
  if (isEye.some(Boolean)) for (let i = 0; i < n; i++) { let w = 0; for (let k = 0; k < 4; k++) if (isEye[si.getComponent(i, k)]) w += sw.getComponent(i, k); a[i] = w > 0.5 ? 1 : 0; }
  g.setAttribute('pEye', new THREE.BufferAttribute(a, 1));
}
