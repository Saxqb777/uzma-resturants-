/**
 * people.js: realistic people for the Seoulicious restaurant scenes.
 * =====================================================================
 *
 * SOURCES AND LICENSE
 *   Avatars: Microsoft Rocketbox avatar library (MIT License,
 *   Copyright (c) 2020 Microsoft). https://github.com/microsoft/Microsoft-Rocketbox
 *   Converted from the original FBX + TGA files to GLB (one LOD each, the
 *   "hipoly_81_bones" mesh, ~7-9k triangles; webp textures; meshopt geometry).
 *   Accessories (aprons, hats, name tags) and props are generated in code here.
 *
 * FILES
 *   assets/people/manifest.json   [{ id, file, sex, ageGroup, notes, height, source, builtin? }]
 *   assets/people/<id>.glb        one avatar each, needs EXT_meshopt_compression + EXT_texture_webp
 *
 * IMPORT MAP (same as index.html)
 *   "three":         https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js
 *   "three/addons/": https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/
 *   (uses GLTFLoader, libs/meshopt_decoder.module.js and utils/SkeletonUtils.js from addons)
 *
 * API
 *   await loadPeople({ base = 'assets/people/', onProgress })   // loads manifest + every GLB once (cached)
 *   listPeople()                                               // manifest entries
 *   createPerson(id, opts) -> THREE.Group
 *     Feet on y = 0 at the group origin, facing +Z, real-world meters.
 *     opts.pose     'stand' | 'stand-talk' | 'wave' | 'sit' | 'sit-eat' | 'sit-talk' | 'sit-cheers' |
 *                   'sit-phone' | 'cook-stir' | 'cook-flip' | 'prep-chop' | 'cashier' | 'carry-tray' |
 *                   'photo' | 'pin'                               (default 'stand')
 *     opts.uniform  null | 'head-chef' | 'chef' | 'cook' | 'server' | 'cashier'
 *                   (the 'chef-female' avatar defaults to 'head-chef'; pass null to turn it off)
 *     opts.name     text for a chest name tag, e.g. '지수 Jisoo' (shown when a name is given)
 *     opts.holding  null | 'chopsticks' | 'glass' | 'phone' | 'tray' | 'camera' | 'pan' | 'knife' |
 *                   'polaroid' | 'ladle'.  When omitted, the pose's own prop is used
 *                   (sit-eat: chopsticks, sit-cheers: glass, sit-phone: phone, cook-stir: ladle,
 *                   cook-flip: pan, prep-chop: knife, carry-tray: tray, photo: camera, pin: polaroid).
 *                   Pass null to force empty hands.
 *     opts.seed     number, small variation (head turn, arm offsets, timing) so crowds don't look cloned
 *     opts.lookAt   THREE.Vector3 in the person's local space (e.g. the face of a table partner)
 *     opts.static   true: bake the posed mesh into plain Meshes (CPU skinning once). No motion.
 *     opts.shadows  cast/receive shadows (default true)
 *   group.userData.update(t, dt)   subtle procedural motion (seconds). No-op for static people.
 *   group.userData.person          { id, pose, uniform, holding, seated }
 *
 * SEATED CONTRACT (all sit-* poses)
 *   Seat cushion top y = 0.48; the group origin is at the FRONT EDGE of the seat (person faces +Z,
 *   the seat extends towards -Z). Table top y = 0.76, its near edge 0.18 m in front of the origin.
 *   Exported as SEAT_Y, TABLE_Y, TABLE_EDGE_Z.
 * STANDING CONTRACT
 *   cashier:    hands on a counter top at y ~1.02, 0.45 m in front.
 *   cook-stir, cook-flip, prep-chop: work surface (stove / board) ~0.90-0.95 m high, ~0.40 m in front.
 *   pin:        wall 0.35 m in front, the hand pins at y ~1.6-1.85 (clamped to the person's reach).
 *
 * AVATAR IDS: see assets/people/manifest.json (listPeople()). Built from these Rocketbox sources:
 *   women:    woman-asian-magenta (Female_Adult_03), woman-hijab-olive (Female_Adult_06),
 *             woman-abaya-black (Female_Adult_10), woman-brown-dress (Female_Adult_11),
 *             woman-young-hoodie (Female_Adult_12), woman-blonde-pink (Female_Adult_01),
 *             woman-auburn-blue (Female_Adult_15), woman-black-suit (Business_Female_01),
 *             woman-asian-beige-suit (Business_Female_03)
 *   men:      man-asian-black-tee (Male_Adult_09), man-asian-red-track (Male_Adult_10),
 *             man-asian-navy-suit (Business_Male_02), man-emirati-ghutra (Male_Adult_19),
 *             man-white-kurta (Male_Adult_15), man-black-denim (Male_Adult_12),
 *             man-cap-tracksuit (Male_Adult_17), man-older-tweed (Male_Adult_03),
 *             man-grey-beard-vest (Male_Adult_05)
 *   children: girl-hijab-green (Female_Child_02), boy-orange-jersey (Male_Child_02)
 *   staff:    chef-female (Professions/Chef_Female_01; white chef coat, apron and cap built in)
 *
 * NOTES
 *   - Lighting: materials are MeshStandardMaterial (metalness 0, roughness 0.6-0.85, normal maps).
 *     They expect ordinary scene lights; tone mapping (ACES) as in main.js looks right.
 *   - Animated people are SkinnedMeshes (3-5 draw calls each). For crowds use { static: true }.
 *   - Shadows: meshes cast + receive shadows. If the renderer's shadowMap.autoUpdate is false,
 *     set renderer.shadowMap.needsUpdate = true after adding people.
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
  const boneIndexName = {};
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
  const len = t.dims.upperArm + t.dims.forearm;
  const hipW = hipHalfWidth(t);
  const x = sideX(s) * (hipW + 0.045 + rng() * 0.015);
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

// ---- seated base: pelvis on the seat, thighs forward, feet on the floor (or hanging for kids)
function seatBody(r, rng, { lean = 12 * DEG, yaw = 0 } = {}) {
  const t = r.tpl, D = t.dims;
  const hipZ = -(D.thigh * 0.45);
  const hipY = SEAT_Y + (t.cache.seatDrop || 0.1);
  // Root and Pelvis share a position in Rocketbox rigs; make sure the pelvis lands at (0, hipY, hipZ)
  const off = r.wp('Pelvis').sub(r.wp('Root'));
  r.setRootPos(V(0, hipY, hipZ).sub(off));
  // slight posterior pelvic tilt is part of sitting; the spine leans forward over it
  r.rotW('Pelvis', RIGHT_X, -5 * DEG);
  r.leanTo(lean, yaw, 0);
  // legs
  for (const s of ['L', 'R']) {
    const hip = r.wp(`${s} Thigh`);
    const reach = D.thigh + D.calf;
    const ankleY = D.ankleY;
    const drop = hip.y - ankleY;
    const spread = sideX(s) * (0.02 + rng() * 0.03);
    const fwd = D.thigh * 0.93 + 0.07 + rng() * 0.04;
    let target;
    if (drop < Math.sqrt(Math.max(0, reach * reach * 0.985 - fwd * fwd)) || drop < reach * 0.9) {
      target = V(hip.x + spread, ankleY, hip.z + fwd);
    } else {
      // legs too short to reach the floor (children): thighs on the seat, shins hang, slightly forward
      const knee = hip.clone().add(V(spread * 0.5, -0.02, D.thigh * 0.995));
      target = knee.add(V(spread * 0.5, -D.calf * 0.94, D.calf * 0.3));
    }
    r.ik(`${s} Thigh`, `${s} Calf`, `${s} Foot`, target, hip.clone().add(V(sideX(s) * 0.05, 0.4, 1)), t.hinge[`${s}leg`]);
    const onFloor = r.wp(`${s} Foot`).y < ankleY + 0.02;
    r.footFlat(s, sideX(s) * (6 + rng() * 6) * DEG, onFloor ? 0 : 18 * DEG);
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
  t.cache.seatDrop = clamp(pelvisY - minY - 0.015, 0.04, 0.16);
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
function tableHand(x, z, lift = 0, spread = 0) {
  return {
    pos: V(x, TABLE_Y + 0.03 + lift, TABLE_EDGE_Z + z),
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
// animation; drive(t, ctx) -> fractional sample index. idle: additive breathing/head motion.
const POSES = {
  stand: {
    samples: [0],
    build(r, c) {
      r.lean(c.rnd(-1, 2) * DEG, c.rnd(-3, 3) * DEG, c.rnd(-1.5, 1.5) * DEG);
      relaxedArm(r, 'L', c.rng); relaxedArm(r, 'R', c.rng);
      c.lookDefault(r);
    },
    idle: { look: 1, breathe: 1 },
  },
  'stand-talk': {
    samples: [0, 1, 2],
    cyclic: true,
    build(r, c, p) {
      r.lean(c.rnd(0, 2) * DEG, c.rnd(-4, 4) * DEG, 0);
      relaxedArm(r, 'L', c.rng);
      const g = [V(-0.17, 0, 0.24), V(-0.12, 0.05, 0.27), V(-0.2, 0.02, 0.2)][p];
      arm(r, 'R', {
        pos: V(g.x, c.D.hipY + 0.13 + g.y, g.z), pole: V(-0.35, -0.6, -0.4),
        hand: { dir: V(0.35, 0.1, 1), palm: V(0.45, 0.9, 0) }, grip: 'open', twist: 0.5,
      });
      c.lookDefault(r);
    },
    drive: (t, c) => 1 + Math.sin(t * 0.9 + c.ph) * 0.8 + Math.sin(t * 2.1 + c.ph * 2) * 0.2,
    idle: { look: 0.6, breathe: 1, talk: 1 },
  },
  wave: {
    samples: [0, 1],
    build(r, c, p) {
      r.lean(0, c.rnd(-3, 3) * DEG, -2 * DEG);
      relaxedArm(r, 'L', c.rng);
      const e = r.eyes();
      arm(r, 'R', {
        pos: V(-0.33 + (p - 0.5) * 0.07, e.y - 0.02, 0.1), pole: V(-0.7, -0.5, -0.1), shrug: 8 * DEG,
        hand: { dir: V(-0.15 - (p - 0.5) * 0.5, 1, 0.08), palm: V(0, 0.05, 1) }, grip: 'wave', twist: 0.4,
      });
      c.lookDefault(r);
    },
    drive: (t, c) => 0.5 + 0.5 * Math.sin(t * 9.0 + c.ph),
    idle: { look: 0.4, breathe: 1 },
  },
  cashier: {
    samples: [0, 1],
    build(r, c, p) {
      r.lean(7 * DEG, c.rnd(-3, 3) * DEG, 0);
      const y = 1.02 + 0.035;
      arm(r, 'L', { pos: V(0.15, y + (1 - p) * 0.012, 0.4), pole: V(0.45, -0.8, -0.4), hand: { dir: V(-0.2, -0.25, 1), palm: V(0, -1, 0.05) }, grip: 'relaxed', twist: 0.5 });
      arm(r, 'R', { pos: V(-0.12, y + p * 0.012, 0.42), pole: V(-0.45, -0.8, -0.4), hand: { dir: V(0.2, -0.25, 1), palm: V(0, -1, 0.05) }, grip: 'relaxed', twist: 0.5 });
      r.look(V(0, 1.0, 0.45).lerp(V(0, 1.55, 1.6), 0.25), 0.9);
    },
    drive: (t, c) => (Math.sin(t * 7 + c.ph) > 0.3 ? 1 : 0) * (Math.sin(t * 0.7 + c.ph) > -0.2 ? 1 : 0.2),
    idle: { look: 0.5, breathe: 1, glanceUp: 1 },
  },
  'carry-tray': {
    samples: [0],
    defaultHolding: 'tray',
    build(r, c) {
      r.lean(-3 * DEG, 0, 0);
      const y = 1.08, z = 0.31, x = 0.215;
      arm(r, 'L', { pos: V(x, y, z), pole: V(0.5, -0.8, -0.5), hand: { thumb: V(0, 0.4, 1), palm: V(-1, 0.25, 0) }, grip: 'edge', twist: 0.6 });
      arm(r, 'R', { pos: V(-x, y, z), pole: V(-0.5, -0.8, -0.5), hand: { thumb: V(0, 0.4, 1), palm: V(1, 0.25, 0) }, grip: 'edge', twist: 0.6 });
      c.lookDefault(r, 0.6);
    },
    idle: { look: 0.5, breathe: 0.6 },
  },
  photo: {
    samples: [0],
    defaultHolding: 'camera',
    build(r, c) {
      r.lean(2 * DEG, 0, 0);
      r.look(V(0, r.eyes().y, 3), 1);
      const e = r.eyes();
      const cam = e.clone().add(V(-0.025, -0.005, 0.105));
      c.camCenter = cam;
      arm(r, 'R', { pos: cam.clone().add(V(-0.1, -0.035, -0.035)), pole: V(-0.4, -1, -0.15), hand: { thumb: V(0.2, 0.6, -0.6), palm: V(1, 0, 0.15) }, grip: 'edge', twist: 0.6 });
      arm(r, 'L', { pos: cam.clone().add(V(0.095, -0.06, -0.04)), pole: V(0.4, -1, -0.15), hand: { thumb: V(-0.2, 0.6, -0.6), palm: V(-1, 0.3, 0.1) }, grip: 'edge', twist: 0.6 });
    },
    idle: { look: 0, breathe: 0.6 },
  },
  pin: {
    samples: [0, 1],
    defaultHolding: 'polaroid',
    build(r, c, p) {
      r.lean(-2 * DEG, 0, 0);
      const reachTop = r.wp('R UpperArm').y + (c.D.upperArm + c.D.forearm) * 0.86;
      const y = clamp(Math.min(1.82, reachTop), 1.2, 1.9);
      const z = 0.35 - 0.035 - p * 0.006;
      c.pinPoint = V(-0.08, y + 0.05, 0.35);
      r.look(c.pinPoint, 1);
      arm(r, 'R', { pos: V(-0.1, y, z), pole: V(-0.7, -0.6, -0.2), shrug: 12 * DEG, protract: 4 * DEG, hand: { dir: V(0.05, 1, 0.15), palm: V(0, 0, 1) }, grip: 'flat', twist: 0.5 });
      arm(r, 'L', { pos: V(0.16, c.D.hipY + 0.2, 0.2), pole: V(0.4, -0.8, -0.4), hand: { thumb: V(-0.3, 0.5, 1), palm: V(-0.7, 0.6, 0) }, grip: 'pinch', twist: 0.5 });
    },
    drive: (t, c) => 0.5 + 0.5 * Math.sin(t * 1.3 + c.ph),
    idle: { look: 0, breathe: 1 },
  },
  'cook-stir': {
    samples: [0, 1, 2, 3, 4, 5, 6, 7],
    cyclic: true,
    defaultHolding: 'ladle',
    build(r, c, p) {
      r.lean(10 * DEG, 0, 0);
      const a = (p / 8) * Math.PI * 2;
      const pot = V(-0.06, 0.93, 0.42);
      c.potCenter = pot;
      arm(r, 'R', { pos: V(-0.1 + Math.cos(a) * 0.055, 1.08, 0.38 + Math.sin(a) * 0.05), pole: V(-0.6, -0.7, -0.4), hand: { thumb: V(0.1, 1, 0.25), palm: V(1, -0.15, 0.2) }, grip: 'handle', twist: 0.5 });
      arm(r, 'L', { pos: V(0.2, 0.975, 0.37), pole: V(0.5, -0.8, -0.4), hand: { dir: V(-0.3, -0.3, 1), palm: V(0, -1, 0) }, grip: 'relaxed', twist: 0.5 });
      r.look(pot, 0.85);
    },
    drive: (t, c) => (t * 0.6 + c.ph) * 8,
    idle: { look: 0.2, breathe: 1 },
  },
  'cook-flip': {
    samples: [0, 1, 2],
    defaultHolding: 'pan',
    build(r, c, p) {
      r.lean(9 * DEG, 0, 0);
      const lift = [0, 0.05, 0.015][p], tilt = [0, 22, -6][p] * DEG, push = [0, -0.03, 0.04][p];
      arm(r, 'R', { pos: V(-0.2, 1.0 + lift, 0.27 + push), pole: V(-0.6, -0.7, -0.4), hand: { thumb: V(0.1, Math.sin(0.3 + tilt), Math.cos(0.3 + tilt)), palm: V(0.6, -0.8, 0) }, grip: 'handle', twist: 0.5 });
      arm(r, 'L', { pos: V(0.19, 0.975, 0.36), pole: V(0.5, -0.8, -0.4), hand: { dir: V(-0.3, -0.3, 1), palm: V(0, -1, 0) }, grip: 'relaxed', twist: 0.5 });
      r.look(V(-0.12, 0.95, 0.6), 0.85);
    },
    drive: (t, c) => {
      const T = 5 + (c.ph % 2), x = ((t + c.ph * 3) % T) / T * T; // seconds into the cycle
      if (x > 0.75) return 0;
      if (x < 0.25) return smooth(x / 0.25);
      if (x < 0.45) return 1 + smooth((x - 0.25) / 0.2);
      return 2 - 2 * smooth((x - 0.45) / 0.3);
    },
    idle: { look: 0.2, breathe: 1 },
  },
  'prep-chop': {
    samples: [0, 1],
    defaultHolding: 'knife',
    build(r, c, p) {
      r.lean(13 * DEG, 0, 0);
      arm(r, 'R', { pos: V(-0.13, 1.045 - p * 0.04, 0.37), pole: V(-0.6, -0.7, -0.45), hand: { thumb: V(0.15, -0.3 - p * 0.15, 1), palm: V(1, 0, 0) }, grip: 'handle', twist: 0.5 });
      arm(r, 'L', { pos: V(0.06, 0.985, 0.39), pole: V(0.6, -0.7, -0.3), hand: { dir: V(-0.55, -0.6, 0.6), palm: V(0, -1, 0) }, grip: 'claw', twist: 0.5 });
      r.look(V(-0.02, 0.92, 0.4), 0.9);
    },
    drive: (t, c) => {
      const x = (t + c.ph * 4) % 3.6;
      if (x > 2.6) return 0;
      return 0.5 - 0.5 * Math.cos(x * Math.PI * 2 * 2.4);
    },
    idle: { look: 0.15, breathe: 1 },
  },
  sit: {
    seated: true,
    samples: [0],
    build(r, c) {
      seatBody(r, c.rng, { lean: c.rnd(15, 19) * DEG, yaw: c.rnd(-3, 3) * DEG });
      solveTableArm(r, 'L', tableHand(0.16 + c.rnd(0, 0.03), 0.06 + c.rnd(0, 0.04)));
      solveTableArm(r, 'R', tableHand(-0.15 - c.rnd(0, 0.03), 0.05 + c.rnd(0, 0.04)));
      c.lookDefault(r);
    },
    idle: { look: 1, breathe: 1 },
  },
  'sit-eat': {
    seated: true,
    samples: [0, 1],
    defaultHolding: 'chopsticks',
    build(r, c, p) {
      seatBody(r, c.rng, { lean: (19 + p * 7) * DEG, yaw: 0 });
      solveTableArm(r, 'L', tableHand(0.16, 0.06 + c.rnd(0, 0.03)));
      const bowl = V(-0.04, TABLE_Y + 0.03, TABLE_EDGE_Z + 0.2);
      c.bowl = bowl;
      if (p === 0) {
        r.look(bowl, 0.95);
        solveTableArm(r, 'R', { pos: V(-0.12, TABLE_Y + 0.13, TABLE_EDGE_Z + 0.1), pole: V(-0.6, -0.7, -0.3), hand: { thumb: V(0.5, 0.75, 0.3), palm: V(0.75, -0.2, -0.3) }, grip: 'pencil', twist: 0.5 });
      } else {
        r.look(bowl.clone().lerp(r.mouth().add(V(0, -0.1, 0.25)), 0.6), 0.9);
        const m = r.mouth();
        arm(r, 'R', { pos: m.clone().add(V(-0.05, -0.1, 0.11)), pole: V(-0.5, -0.9, -0.2), hand: { thumb: V(0.4, 0.8, 0.1), palm: V(0.75, -0.05, -0.6) }, grip: 'pencil', twist: 0.5 });
      }
    },
    drive: (t, c) => {
      const T = 6 + (c.ph % 3), x = (t + c.ph * 5) % T;
      if (x < 0.75) return smooth(x / 0.75);
      if (x < 1.2) return 1;
      if (x < 1.9) return 1 - smooth((x - 1.2) / 0.7);
      return 0;
    },
    idle: { look: 0.3, breathe: 1, chew: 1 },
  },
  'sit-talk': {
    seated: true,
    samples: [0, 1, 2],
    cyclic: true,
    build(r, c, p) {
      seatBody(r, c.rng, { lean: c.rnd(14, 17) * DEG, yaw: c.rnd(-4, 4) * DEG });
      solveTableArm(r, 'L', tableHand(0.16, 0.06 + c.rnd(0, 0.03)));
      const g = [V(-0.15, 0.13, 0.08), V(-0.11, 0.17, 0.12), V(-0.18, 0.15, 0.05)][p];
      solveTableArm(r, 'R', { pos: V(g.x, TABLE_Y + g.y, TABLE_EDGE_Z + g.z), pole: V(-0.55, -0.75, -0.3), hand: { dir: V(0.35, 0.25, 1), palm: V(0.5, 0.85, -0.1) }, grip: 'open', twist: 0.55 });
      c.lookDefault(r);
    },
    drive: (t, c) => 1 + Math.sin(t * 0.8 + c.ph) * 0.85 + Math.sin(t * 1.9 + c.ph) * 0.15,
    idle: { look: 0.6, breathe: 1, talk: 1 },
  },
  'sit-cheers': {
    seated: true,
    samples: [0, 1],
    defaultHolding: 'glass',
    build(r, c, p) {
      seatBody(r, c.rng, { lean: c.rnd(14, 17) * DEG, yaw: c.rnd(-2, 2) * DEG });
      solveTableArm(r, 'L', tableHand(0.16, 0.06 + c.rnd(0, 0.03)));
      const e = r.eyes();
      const gp = V(-0.12, e.y - 0.1 + p * 0.025, TABLE_EDGE_Z + 0.08 + p * 0.03);
      arm(r, 'R', { pos: gp, pole: V(-0.7, -0.7, -0.2), shrug: 6 * DEG, protract: 6 * DEG, hand: { thumb: V(0.05, 1, 0.1), palm: V(0.85, 0, -0.5) }, grip: 'cylinder', twist: 0.5 });
      r.look(c.lookTarget || V(0, e.y + 0.05, 1.1), 0.9);
    },
    drive: (t, c) => { const x = (t + c.ph * 3) % 4.5; return x < 0.35 ? smooth(x / 0.35) : x < 0.6 ? 1 : x < 1.1 ? 1 - smooth((x - 0.6) / 0.5) : 0; },
    idle: { look: 0.2, breathe: 1 },
  },
  'sit-phone': {
    seated: true,
    samples: [0],
    defaultHolding: 'phone',
    build(r, c) {
      seatBody(r, c.rng, { lean: c.rnd(19, 23) * DEG, yaw: 0 });
      const ph = V(0, TABLE_Y + 0.15, TABLE_EDGE_Z + 0.07);
      c.phoneCenter = ph;
      r.look(ph, 1);
      arm(r, 'L', { pos: ph.clone().add(V(0.06, -0.035, -0.06)), pole: V(0.5, -0.8, -0.3), hand: { thumb: V(-0.3, 0.7, 0.6), palm: V(-0.75, 0.45, -0.3) }, grip: 'phone', twist: 0.55 });
      arm(r, 'R', { pos: ph.clone().add(V(-0.06, -0.035, -0.06)), pole: V(-0.5, -0.8, -0.3), hand: { thumb: V(0.3, 0.7, 0.6), palm: V(0.75, 0.45, -0.3) }, grip: 'phone', twist: 0.55 });
    },
    idle: { look: 0, breathe: 1, thumb: 1 },
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
  const seed = opts.seed ?? hashString(id + poseName);
  const rng = mulberry32((seed * 2654435761) >>> 0);
  const builtin = tpl.entry.builtin || [];
  const uniform = opts.uniform !== undefined ? opts.uniform : (tpl.entry.defaultUniform || null);
  const holding = opts.holding !== undefined ? opts.holding : (pose.defaultHolding || null);

  const group = new THREE.Group();
  group.name = `person:${id}`;
  const root = cloneSkinned(tpl.scene);
  group.add(root);
  group.updateMatrixWorld(true);
  const r = new Rig(root, tpl);
  r.reset();

  const ctx = {
    rng, D: tpl.dims, seed,
    rnd: (a, b) => a + (b - a) * rng(),
    ph: rng() * 100,
    lookTarget: opts.lookAt ? opts.lookAt.clone() : null,
    lookDefault(rr, amount = 1) {
      const e = rr.eyes();
      const tgt = ctx.lookTarget ? ctx.lookTarget.clone() : V(ctx.lookYaw, e.y + ctx.lookPitch, 2);
      rr.look(tgt, amount);
    },
  };
  ctx.lookYaw = (rng() - 0.5) * 0.9;
  ctx.lookPitch = (rng() - 0.5) * 0.15 - (pose.seated ? 0.12 : 0);

  // accessories that hang on the body are made in the rest pose
  const shadows = opts.shadows !== false;
  const acc = [];
  if (uniform) acc.push(...buildUniform(r, uniform, builtin, opts.name));
  else if (opts.name) acc.push(...buildUniform(r, null, builtin, opts.name));

  // pose (and its animation samples)
  if (pose.seated && tpl.cache.seatDrop === undefined) {
    const save = rng; // calibration uses its own random numbers so results don't depend on call order
    const c2 = { ...ctx, rng: mulberry32(1), rnd: (a, b) => (a + b) / 2 };
    r.reset(); pose.build(r, c2, pose.samples[0]); calibrateSeat(r); ctx.rng = save;
  }
  const snaps = [];
  const stateSeed = rng();
  for (const p of pose.samples) {
    const local = mulberry32((stateSeed * 4294967296) >>> 0);
    ctx.rng = local; ctx.rnd = (a, b) => a + (b - a) * local();
    r.reset();
    pose.build(r, ctx, p);
    snaps.push(r.snapshot());
  }
  r.apply(snaps[0]);
  root.updateMatrixWorld(true);

  // props
  if (holding) attachProp(r, holding, poseName, ctx);

  for (const m of r.meshes) { m.castShadow = shadows; m.receiveShadow = shadows; m.frustumCulled = true; }
  group.traverse((o) => { if (o.isMesh && !o.isSkinnedMesh) { o.castShadow = shadows && !o.userData.noShadow; o.receiveShadow = shadows; } });

  group.userData.person = { id, pose: poseName, uniform, holding, seated: !!pose.seated, height: tpl.dims.height };

  if (opts.static) {
    bakeStatic(group, root, r);
    group.userData.update = () => {};
    return group;
  }
  for (const m of r.meshes) { m.boundingSphere = null; m.computeBoundingSphere(); m.boundingSphere.radius += 0.25; }
  group.userData.update = makeAnimator(r, pose, snaps, ctx);
  return group;
}

// ----------------------------------------------------------------------------------- animation
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
    sp1: layer('Spine1', RIGHT_X), sp2: layer('Spine2', RIGHT_X),
    neckY: layer('Neck', UP), headY: layer('Head', UP), headP: layer('Head', faceK), neckP: layer('Neck', faceK),
    jaw: layer('MJaw', faceK),
    clL: layer('L Clavicle', FWD), clR: layer('R Clavicle', FWD),
    thumb: layer('R Finger01', faceK),
  };
  const clav = [idx('L Clavicle'), idx('R Clavicle')].filter((i) => i >= 0);
  const touched = [...new Set([...moving, ...Object.values(L).filter(Boolean).map((l) => l.i), ...clav])];
  const curQ = new Float32Array(bones.length * 4), curP = new Float32Array(bones.length * 3);
  const idle = pose.idle || {};
  const ph = ctx.ph;
  const tmpQ = new THREE.Quaternion(), qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), neckQ = new THREE.Quaternion();
  const va = new THREE.Vector3(), vb = new THREE.Vector3();
  const rate = 0.85 + (ph % 1) * 0.3;
  const base = snaps[0];
  let last = -1;
  return function update(t = 0) {
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
    // 2) head motion (neck part is compensated on the clavicles so the arms stay put)
    neckQ.identity();
    const neck = (l, a) => { if (l && a) { tmpQ.setFromAxisAngle(l.axis, a); l.b.quaternion.multiply(tmpQ); neckQ.multiply(tmpQ); } };
    const lk = idle.look || 0;
    if (lk) {
      const yaw = (Math.sin(t * 0.23 + ph) * 0.6 + Math.sin(t * 0.61 + ph * 1.7) * 0.4) * 0.16 * lk;
      const pit = (Math.sin(t * 0.31 + ph * 0.7) * 0.5 + Math.sin(t * 0.83 + ph) * 0.5) * 0.05 * lk;
      neck(L.neckY, yaw * 0.4); add(L.headY, yaw * 0.6);
      neck(L.neckP, pit * 0.4); add(L.headP, pit * 0.6);
    }
    if (idle.glanceUp) {
      const g = smooth((Math.sin(t * 0.35 + ph) - 0.55) * 4);
      neck(L.neckP, g * 0.14); add(L.headP, g * 0.2);
    }
    if (idle.talk) {
      const on = Math.sin(t * 0.5 + ph) > -0.3 ? 1 : 0;
      const j = on * Math.max(0, Math.sin(t * 11 + ph) * 0.6 + Math.sin(t * 17 + ph * 2) * 0.4);
      add(L.jaw, j * 0.07);
      add(L.headP, on * Math.sin(t * 2.3 + ph) * 0.025);
    }
    if (idle.chew) {
      const T = 6 + (ph % 3), x = (t * rate + ph * 5) % T;
      if (x > 1.9 && x < 4.5) add(L.jaw, Math.max(0, Math.sin((x - 1.9) * 9)) * 0.05);
    }
    if (neckQ.w < 0.999999) {
      neckQ.invert();
      for (const i of clav) { const b = bones[i]; b.quaternion.premultiply(neckQ); b.position.applyQuaternion(neckQ); }
    }
    // 3) breathing (chest + a hint of shoulder lift)
    const br = (idle.breathe || 0) * Math.sin(t * 1.55 + ph);
    add(L.sp1, br * 0.006); add(L.sp2, -br * 0.01);
    add(L.clL, br * 0.008); add(L.clR, -br * 0.008);
    if (idle.thumb) add(L.thumb, Math.max(0, Math.sin(t * 6 + ph)) * Math.max(0, Math.sin(t * 0.9 + ph)) * 0.25);
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
    if (name.startsWith('uv')) g.setAttribute(name, src.attributes[name]);
  }
  if (src.index) g.setIndex(src.index);
  for (const gr of src.groups) g.addGroup(gr.start, gr.count, gr.materialIndex);
  g.computeBoundingSphere(); g.computeBoundingBox();
  return g;
}

// TEMP stubs
function buildUniform() { return []; }
function attachProp() {}
// TEMP debug
export const _debug = { rig(id) { const tpl = templates.get(id); const g = new THREE.Group(); const root = cloneSkinned(tpl.scene); g.add(root); g.updateMatrixWorld(true); const r = new Rig(root, tpl); r.reset(); return r; } };
