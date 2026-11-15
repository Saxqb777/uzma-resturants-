// Look-around mode: a free "spectator" camera.
// Drag = look around · Scroll = fly forward/back · WASD / arrows = move · Q/E = down/up
// Right-drag = slide · Double-click = fly to that spot · Touch: drag to look, pinch to fly.
import * as THREE from 'three';

const BOUNDS = { x: [-26, 26], y: [0.35, 45], z: [-32, 26] };

export class Spectator {
  constructor(camera, dom, scene) {
    this.camera = camera;
    this.dom = dom;
    this.scene = scene;
    this.enabled = false;
    this.yaw = 0; this.pitch = 0;
    this.keys = new Set();
    this.vel = new THREE.Vector3();
    this.flyTo = null;
    this.ray = new THREE.Raycaster();
    this.pointers = new Map();
    this.pinch = 0;
    this.bind();
  }

  enable() {
    this.enabled = true;
    const e = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
    this.yaw = e.y; this.pitch = e.x;
    this.dom.style.cursor = 'grab';
  }

  disable() {
    this.enabled = false;
    this.keys.clear();
    this.vel.set(0, 0, 0);
    this.flyTo = null;
    this.dom.style.cursor = '';
  }

  bind() {
    const d = this.dom;
    d.addEventListener('contextmenu', (e) => { if (this.enabled) e.preventDefault(); });
    d.addEventListener('pointerdown', (e) => {
      if (!this.enabled) return;
      d.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, button: e.button });
      this.flyTo = null;
      d.style.cursor = 'grabbing';
    });
    d.addEventListener('pointermove', (e) => {
      if (!this.enabled || !this.pointers.has(e.pointerId)) return;
      const p = this.pointers.get(e.pointerId);
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.pinch) this.moveLocal(0, 0, (dist - this.pinch) * 0.02);
        this.pinch = dist;
        return;
      }
      if (p.button === 2 || e.shiftKey) {
        this.moveLocal(-dx * 0.01, dy * 0.01, 0);
      } else {
        const s = 0.0032 * (this.camera.fov / 55);
        this.yaw -= dx * s;
        this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch - dy * s));
      }
    });
    const up = (e) => {
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinch = 0;
      if (this.enabled) d.style.cursor = 'grab';
    };
    d.addEventListener('pointerup', up);
    d.addEventListener('pointercancel', up);
    d.addEventListener('wheel', (e) => {
      if (!this.enabled) return;
      e.preventDefault();
      this.flyTo = null;
      const step = -Math.sign(e.deltaY) * Math.min(1.2, Math.abs(e.deltaY) * 0.004 + 0.25);
      this.moveLocal(0, 0, step, true);
    }, { passive: false });
    d.addEventListener('dblclick', (e) => {
      if (!this.enabled) return;
      const r = d.getBoundingClientRect();
      const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      this.ray.setFromCamera(ndc, this.camera);
      const hit = this.ray.intersectObjects(this.scene.children, true).find((h) => h.object.visible && h.distance > 0.4);
      if (!hit) return;
      const dir = hit.point.clone().sub(this.camera.position);
      const len = dir.length();
      const target = this.camera.position.clone().add(dir.normalize().multiplyScalar(Math.max(0, len - 1.4)));
      target.y = Math.max(target.y, 1.2);
      this.flyTo = target;
    });
    window.addEventListener('keydown', (e) => { if (this.enabled) this.keys.add(e.code); });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  moveLocal(x, y, z, alongView = false) {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(alongView ? this.pitch : 0, this.yaw, 0, 'YXZ'));
    const v = new THREE.Vector3(x, 0, -z).applyQuaternion(q);
    v.y += y;
    this.camera.position.add(v);
    this.clamp();
  }

  clamp() {
    const p = this.camera.position;
    p.x = Math.max(BOUNDS.x[0], Math.min(BOUNDS.x[1], p.x));
    p.y = Math.max(BOUNDS.y[0], Math.min(BOUNDS.y[1], p.y));
    p.z = Math.max(BOUNDS.z[0], Math.min(BOUNDS.z[1], p.z));
  }

  update(dt) {
    if (!this.enabled) return;
    const k = this.keys;
    const fast = k.has('ShiftLeft') || k.has('ShiftRight') ? 2.4 : 1;
    const speed = 2.6 * fast;
    const f = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    const s = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    const u = (k.has('KeyE') ? 1 : 0) - (k.has('KeyQ') ? 1 : 0);
    const want = new THREE.Vector3(s, u, f).multiplyScalar(speed);
    this.vel.lerp(want, Math.min(1, dt * 10));
    if (this.vel.lengthSq() > 1e-6) {
      this.flyTo = null;
      this.moveLocal(this.vel.x * dt, this.vel.y * dt, this.vel.z * dt);
    }
    if (this.flyTo) {
      this.camera.position.lerp(this.flyTo, Math.min(1, dt * 3));
      if (this.camera.position.distanceTo(this.flyTo) < 0.02) this.flyTo = null;
    }
    this.camera.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
  }
}
