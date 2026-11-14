// Geometry helpers shared by the interior and exterior builders.
// Units are meters. Convention for box(): x/z are the CENTER, y is the BOTTOM.
import * as THREE from 'three';

// Re-map BoxGeometry UVs so 1 texture tile = `scale` meters on every face.
export function worldUVBox(geo, scale = 1) {
  const { width: w, height: h, depth: d } = geo.parameters;
  const uv = geo.attributes.uv;
  const spans = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  const per = uv.count / 6;
  for (let f = 0; f < 6; f++) {
    for (let i = 0; i < per; i++) {
      const k = f * per + i;
      uv.setXY(k, (uv.getX(k) * spans[f][0]) / scale, (uv.getY(k) * spans[f][1]) / scale);
    }
  }
  uv.needsUpdate = true;
  return geo;
}

export function box(parent, mat, w, h, d, x, y, z, { cast = true, receive = true, uv = 1, rotY = 0, name } = {}) {
  const g = worldUVBox(new THREE.BoxGeometry(w, h, d), uv);
  const m = new THREE.Mesh(g, mat);
  m.position.set(x, y + h / 2, z);
  m.rotation.y = rotY;
  m.castShadow = cast;
  m.receiveShadow = receive;
  if (name) m.name = name;
  parent.add(m);
  return m;
}

// Flat plane with world-scaled UVs. Faces +Z by default.
export function plane(parent, mat, w, h, { uv = 1, receive = true, cast = false } = {}) {
  const g = new THREE.PlaneGeometry(w, h);
  const a = g.attributes.uv;
  for (let i = 0; i < a.count; i++) a.setXY(i, (a.getX(i) * w) / uv, (a.getY(i) * h) / uv);
  const m = new THREE.Mesh(g, mat);
  m.receiveShadow = receive; m.castShadow = cast;
  parent.add(m);
  return m;
}

// Corrugated metal sheet lying flat in XZ: waves across X, ridges run along Z.
// The sheet spans x: [-width/2, width/2], z: [0, -length]. Tilt the mesh afterwards for slope.
export function corrugatedGeometry(width, length, { wave = 0.076, amp = 0.016, uv = 1 } = {}) {
  const seg = Math.max(8, Math.round((width / wave) * 8));
  const g = new THREE.PlaneGeometry(width, length, seg, 1);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    pos.setZ(i, Math.sin((x / wave) * Math.PI * 2) * amp);
  }
  const a = g.attributes.uv;
  for (let i = 0; i < a.count; i++) a.setXY(i, (a.getX(i) * width) / uv, (a.getY(i) * length) / uv);
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0, -length / 2);
  g.computeVertexNormals();
  return g;
}

// Soju-style bottle profile (≈ 0.24 m tall)
export function bottleGeometry(seg = 14) {
  const p = [
    [0.0, 0.0], [0.031, 0.0], [0.033, 0.006], [0.033, 0.135], [0.03, 0.16], [0.02, 0.19],
    [0.0135, 0.205], [0.0125, 0.232], [0.014, 0.236], [0.014, 0.245], [0.0, 0.245],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  return new THREE.LatheGeometry(p, seg);
}

// Stainless water bottle (tall, slim)
export function flaskGeometry(seg = 16) {
  const p = [
    [0, 0], [0.04, 0], [0.042, 0.01], [0.042, 0.2], [0.036, 0.23], [0.024, 0.25], [0.024, 0.27], [0.03, 0.275], [0.03, 0.29], [0, 0.29],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  return new THREE.LatheGeometry(p, seg);
}

// Small banchan bowl
export function bowlGeometry(r = 0.055, h = 0.035, seg = 18) {
  const p = [[0, 0], [r * 0.6, 0], [r, h], [r * 0.93, h], [r * 0.55, 0.006], [0, 0.006]].map(([a, b]) => new THREE.Vector2(a, b));
  return new THREE.LatheGeometry(p, seg);
}

// Collect transforms, then build one InstancedMesh per geometry/material pair.
export class InstanceBatch {
  constructor(geo, mat, { cast = true, receive = true } = {}) {
    this.geo = geo; this.mat = mat; this.cast = cast; this.receive = receive;
    this.items = [];
  }
  add(x, y, z, { rx = 0, ry = 0, rz = 0, s = 1, sx, sy, sz, color } = {}) {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz));
    m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx ?? s, sy ?? s, sz ?? s));
    this.items.push({ m, color });
    return this;
  }
  build(parent) {
    if (!this.items.length) return null;
    const im = new THREE.InstancedMesh(this.geo, this.mat, this.items.length);
    this.items.forEach((it, i) => {
      im.setMatrixAt(i, it.m);
      if (it.color) im.setColorAt(i, new THREE.Color(it.color));
    });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.castShadow = this.cast; im.receiveShadow = this.receive;
    im.computeBoundingSphere();
    parent.add(im);
    return im;
  }
}

// Point light helper with sensible defaults for this scene
export function pointLight(parent, color, intensity, distance, x, y, z, { shadow = false, decay = 2 } = {}) {
  const l = new THREE.PointLight(color, intensity, distance, decay);
  l.position.set(x, y, z);
  if (shadow) {
    l.castShadow = true;
    l.shadow.mapSize.set(512, 512);
    l.shadow.bias = -0.002;
    l.shadow.radius = 3;
  }
  parent.add(l);
  return l;
}

export function spotLight(parent, color, intensity, distance, from, to, { angle = 0.6, penumbra = 0.6, shadow = false, decay = 2, mapSize = 1024 } = {}) {
  const l = new THREE.SpotLight(color, intensity, distance, angle, penumbra, decay);
  l.position.set(...from);
  l.target.position.set(...to);
  if (shadow) {
    l.castShadow = true;
    l.shadow.mapSize.set(mapSize, mapSize);
    l.shadow.bias = -0.0015;
    l.shadow.normalBias = 0.02;
    l.shadow.radius = 4;
  }
  parent.add(l); parent.add(l.target);
  return l;
}

// Merge static meshes that share a material into one mesh each (far fewer draw calls).
// Meshes with userData.keep = true, instanced meshes and multi-material meshes are left alone.
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
export function mergeStatic(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map();
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.userData.keep || Array.isArray(o.material)) return;
    let p = o.parent, skip = false;
    while (p && p !== root) { if (p.userData.keep) skip = true; p = p.parent; }
    if (skip || !o.geometry.index) return;
    const key = `${o.material.uuid}|${o.castShadow ? 1 : 0}${o.receiveShadow ? 1 : 0}`;
    if (!buckets.has(key)) buckets.set(key, { mat: o.material, cast: o.castShadow, receive: o.receiveShadow, list: [] });
    buckets.get(key).list.push(o);
  });
  for (const b of buckets.values()) {
    if (b.list.length < 2) continue;
    const geos = b.list.map((o) => {
      const g = o.geometry.clone();
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
      g.clearGroups();
      return g;
    });
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, b.mat);
    mesh.castShadow = b.cast; mesh.receiveShadow = b.receive;
    root.add(mesh);
    for (const o of b.list) o.parent.remove(o);
  }
}
