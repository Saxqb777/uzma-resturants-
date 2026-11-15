// Light only the area the camera is in.
// Every light costs time on every pixel, so: on the street, the deep dining room and
// kitchen lights are off (only the ones you can see through the front windows stay);
// inside, the street lights are off; from above (floor plan) everything is on.
// Lights fade over ~0.6 s so nothing pops. The three on/off combinations are compiled
// during loading, so switching never stalls on shader compiles.
import * as THREE from 'three';

const FOOTPRINT = { x0: -7.8, x1: 7.8, z0: -27.3, z1: 0.35, yTop: 4.4 };
const STREET_VISIBLE_Z = -7.5;   // interior lights in front of this line are seen through the windows
const FADE = 0.6;

export class ZoneLights {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.lights = [];
    this.zone = 'all';
  }

  // Tag every light by the group it was built in ('interior' / 'exterior'). Run once after building.
  tag() {
    this.scene.updateMatrixWorld(true);
    const p = new THREE.Vector3();
    this.scene.traverse((o) => {
      if (!o.isLight || o.isHemisphereLight || o.isAmbientLight) return;
      let zone = null;
      for (let a = o.parent; a; a = a.parent) {
        if (a.name === 'interior') zone = 'in';
        if (a.name === 'exterior') zone = 'out';
      }
      if (!zone) return;
      o.getWorldPosition(p);
      o.userData.zone = zone;
      o.userData.street = zone === 'in' && p.z > STREET_VISIBLE_Z;
      o.userData.base = o.intensity;
      o.userData.level ??= 1;     // animators (flicker) set this instead of intensity
      o.userData.fade = 1;
      this.lights.push(o);
    });
  }

  zoneOf(pos) {
    if (pos.y > 6) return 'all';
    const f = FOOTPRINT;
    if (pos.x > f.x0 && pos.x < f.x1 && pos.z > f.z0 && pos.z < f.z1 && pos.y < f.yTop) return 'in';
    return 'out';
  }

  wants(l, zone) {
    if (zone === 'all') return true;
    if (zone === 'in') return l.userData.zone === 'in';
    return l.userData.zone === 'out' || l.userData.street;
  }

  // Jump straight to a zone (used while precompiling)
  force(zone) {
    this.zone = zone;
    for (const l of this.lights) {
      const w = this.wants(l, zone);
      l.visible = w;
      l.userData.fade = w ? 1 : 0;
      l.intensity = l.userData.base * l.userData.level * l.userData.fade;
    }
  }

  update(dt) {
    const zone = this.zoneOf(this.camera.position);
    this.zone = zone;
    const step = dt / FADE;
    for (const l of this.lights) {
      const want = this.wants(l, zone);
      let f = l.userData.fade;
      if (want) {
        l.visible = true;
        f = Math.min(1, f + step);
      } else {
        f = Math.max(0, f - step);
        if (f === 0) l.visible = false;
      }
      l.userData.fade = f;
      l.intensity = l.userData.base * l.userData.level * f;
    }
  }
}
