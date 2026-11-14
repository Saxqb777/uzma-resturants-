// Presentation mode: each scene is a fixed camera shot. Enter → next.
// Same-zone moves glide smoothly; zone changes (outside ↔ inside) fade through black,
// except scenes marked `glide: true`, which glide in from the previous scene
// (through the front door, or up through the lifted roof).
import * as THREE from 'three';

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const V = (a) => new THREE.Vector3(...a);
const UP = [0, 1, 0];

export class Director {
  constructor(camera, scenes, { fadeEl, onChange, reducedMotion = false }) {
    this.camera = camera;
    this.scenes = scenes;
    this.fadeEl = fadeEl;
    this.onChange = onChange;
    this.reduced = reducedMotion;
    this.index = 0;
    this.pos = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.fov = 50;
    this.up = new THREE.Vector3(0, 1, 0);
    this.anim = null;        // current transition
    this.dwell = 0;          // seconds since arriving (drives the slow drift)
    this.cutaway = false;
  }

  get scene() { return this.scenes[this.index]; }

  start(i = 0) {
    this.index = i;
    this.snapTo(this.scene);
    this.onChange?.(i);
  }

  next() { this.go(this.index + 1); }
  prev() { this.go(this.index - 1); }

  go(i) {
    i = Math.max(0, Math.min(this.scenes.length - 1, i));
    if (i === this.index && !this.anim) return;
    const from = this.scenes[this.index];
    const to = this.scenes[i];
    const adjacent = Math.abs(i - this.index) === 1;
    const glideIn = adjacent && ((i > this.index && to.glide) || (i < this.index && from.glide));
    const sameZone = from.zone === to.zone;
    const via = glideIn ? (i > this.index ? to.via : from.via) : null;
    this.index = i;
    this.onChange?.(i);

    const startPos = this.camera.position.clone();
    const startLook = this.currentLook();
    const startFov = this.camera.fov;
    this.cutaway = !!(from.cutaway || to.cutaway);

    if (this.reduced || (!sameZone && !glideIn) || (!adjacent && !sameZone)) {
      this.anim = { type: 'fade', t: 0, dur: this.reduced ? 0.5 : 0.9, to, switched: false };
    } else {
      const dist = startPos.distanceTo(V(to.cam));
      const dur = Math.min(3.6, Math.max(1.7, dist * 0.22 + 1.1));
      this.anim = { type: 'glide', t: 0, dur, to, startPos, startLook, startFov, startUp: this.camera.up.clone(), via: via ? V(via) : null };
    }
  }

  currentLook() {
    const d = new THREE.Vector3();
    this.camera.getWorldDirection(d);
    return this.camera.position.clone().add(d.multiplyScalar(this.look.distanceTo(this.camera.position) || 5));
  }

  snapTo(s) {
    this.pos.copy(V(s.cam));
    this.look.copy(V(s.look));
    this.fov = s.fov || 50;
    this.dwell = 0;
    this.cutaway = !!s.cutaway;
    this.camera.up.copy(V(s.up || UP));
    this.apply(this.pos, this.look, this.fov);
  }

  apply(pos, look, fov) {
    this.camera.position.copy(pos);
    this.camera.lookAt(look);
    if (Math.abs(this.camera.fov - fov) > 1e-3) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }

  get resting() { return !this.anim; }

  // Called when returning from look-around mode: glide back to the current shot.
  resume() {
    const s = this.scene;
    this.cutaway = !!s.cutaway;
    this.anim = {
      type: 'glide', t: 0, dur: 1.6, to: s,
      startPos: this.camera.position.clone(), startLook: this.currentLook(), startFov: this.camera.fov,
      startUp: new THREE.Vector3(0, 1, 0),
    };
  }

  update(dt) {
    const a = this.anim;
    if (a && a.type === 'glide') {
      a.t += dt;
      const k = ease(Math.min(1, a.t / a.dur));
      const end = V(a.to.cam);
      const p = a.via
        ? a.startPos.clone().multiplyScalar((1 - k) ** 2).add(a.via.clone().multiplyScalar(2 * (1 - k) * k)).add(end.multiplyScalar(k * k))
        : a.startPos.clone().lerp(end, k);
      const l = a.startLook.clone().lerp(V(a.to.look), k);
      const f = a.startFov + ((a.to.fov || 50) - a.startFov) * k;
      this.camera.up.copy(a.startUp).lerp(V(a.to.up || UP), k).normalize();
      this.look.copy(l);
      this.apply(p, l, f);
      if (a.t >= a.dur) { this.anim = null; this.snapTo(a.to); }
      return;
    }
    if (a && a.type === 'fade') {
      a.t += dt;
      const half = a.dur / 2;
      const o = a.t < half ? a.t / half : Math.max(0, 1 - (a.t - half) / half);
      this.fadeEl.style.opacity = String(Math.min(1, o));
      if (!a.switched && a.t >= half) { a.switched = true; this.snapTo(a.to); }
      if (a.t >= a.dur) { this.anim = null; this.fadeEl.style.opacity = '0'; }
      if (!a.switched) return;
    }
    // slow drift while resting on a shot, like a camera on a slider
    this.dwell += dt;
    const s = this.scene;
    const d = s.drift || [0, 0, 0];
    const k = this.reduced ? 0 : 0.5 - 0.5 * Math.cos((this.dwell / 18) * Math.PI * 2);
    const sway = this.reduced ? 0 : 1;
    const p = V(s.cam).add(V(d).multiplyScalar(k));
    p.x += Math.sin(this.dwell * 0.7) * 0.012 * sway;
    p.y += Math.sin(this.dwell * 0.9 + 1) * 0.008 * sway;
    const l = V(s.look).add(V(d).multiplyScalar(k * 0.35));
    this.look.copy(l);
    this.apply(p, l, s.fov || 50);
  }
}
