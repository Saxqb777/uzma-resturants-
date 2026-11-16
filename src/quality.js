// Picture quality: Auto / High / Low.
// Auto watches the real frame rate and changes the render resolution so motion stays smooth:
// below ~48 fps it renders fewer pixels, with spare headroom it goes sharper again. If that is not enough
// (a slow CPU: too many draw calls, not too many pixels) it turns ambient occlusion off, which halves them.
const KEY = 'uzma-quality';

// Phones, tablets, built-in laptop graphics (Intel, AMD APUs) and software rendering start lighter:
// lower resolution and no ambient occlusion. Auto can still raise the resolution, and tries AO once
// if the frame rate is clearly good.
function detectWeakGpu(renderer) {
  try {
    const gl = renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/i.test(navigator.platform || ''));
    const soft = /SwiftShader|llvmpipe|Basic Render|software/i.test(name);
    const integrated = /Intel|Mali|Adreno|PowerVR|Radeon\(TM\) Graphics|Radeon Vega/i.test(name);
    const fewCores = (navigator.hardwareConcurrency || 8) <= 4;
    return { name, weak: mobile || soft || integrated || fewCores };
  } catch { return { name: '', weak: false }; }
}
const MODES = ['auto', 'high', 'low'];

export class Quality {
  constructor({ renderer, composer, bloom, ao, fixedDpr = null, onChange }) {
    this.renderer = renderer;
    this.composer = composer;
    this.bloom = bloom;
    this.ao = ao;
    this.onChange = onChange;
    this.max = Math.min(window.devicePixelRatio || 1, 2);
    this.min = 0.6;
    this.fixedDpr = fixedDpr;
    let saved = null;
    try { saved = localStorage.getItem(KEY); } catch { /* storage blocked: use the default */ }
    this.mode = fixedDpr ? 'fixed' : MODES.includes(saved) ? saved : 'auto';
    this.gpu = detectWeakGpu(renderer);
    this.dpr = this.startDpr();   // where Auto starts
    this.ceiling = this.max;
    this.acc = 0; this.frames = 0; this.good = 0; this.hold = 2; this.age = 0;
    this.aoOff = this.gpu.weak;   // Auto runs without ambient occlusion (weak GPU, or it was too slow)
    this.aoRetried = false;       // a weak GPU that turns out fast gets one try with AO
  }

  startDpr() { return Math.min(this.max, this.gpu.weak ? 1.0 : 1.5); }

  get label() { return { auto: 'Auto', high: 'High', low: 'Low', fixed: 'Fixed' }[this.mode]; }

  cycle() {
    const i = MODES.indexOf(this.mode);
    this.setMode(MODES[(i + 1) % MODES.length]);
  }

  setMode(m) {
    this.mode = m;
    try { localStorage.setItem(KEY, m); } catch { /* not saved, still works */ }
    if (m === 'auto') { this.dpr = this.startDpr(); this.ceiling = this.max; this.hold = 2; this.aoOff = this.gpu.weak; this.aoRetried = false; }
    this.apply();
  }

  // Current pixel ratio for the active mode
  target() {
    if (this.mode === 'high') return this.max;
    if (this.mode === 'low') return Math.min(0.75, this.max);
    if (this.mode === 'fixed') return this.fixedDpr;
    return this.dpr;
  }

  apply() {
    const p = this.target();
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setPixelRatio(p);
    this.composer.setPixelRatio(p);
    this.composer.setSize(w, h);
    this.bloom.enabled = this.mode !== 'low';
    if (this.ao) this.ao.enabled = this.mode !== 'low' && !(this.mode === 'auto' && this.aoOff);   // Low: no ambient occlusion (the costliest effect)
    this.current = p;
    this.onChange?.(this);
  }

  // Call once per frame with the real (unclamped) frame time in seconds
  sample(rawDt) {
    if (this.mode !== 'auto') return;
    if (rawDt > 0.25) { this.acc = 0; this.frames = 0; return; }   // tab switch or a one-off hitch
    this.acc += rawDt; this.frames++;
    if (this.acc < 1) return;
    const fps = this.frames / this.acc;
    this.acc = 0; this.frames = 0;
    if (this.hold > 0) { this.hold--; return; }
    if (fps < 48 && !this.aoOff && (fps < 34 || this.dpr <= 0.9 || this.aoRetried)) {   // very slow, fewer pixels did not help, or the AO try failed: drop AO
      this.aoOff = true; this.good = 0; this.hold = 2;
      this.apply();
    } else if (fps < 48 && this.dpr > this.min + 0.01) {
      this.ceiling = Math.max(this.min, this.dpr * 0.97);          // don't climb back to what was too slow
      this.dpr = Math.max(this.min, this.dpr * 0.8);
      this.good = 0; this.hold = 1;
      this.apply();
    } else if (fps >= 57) {
      if (this.aoOff && !this.aoRetried && this.good >= 5 && this.dpr >= 0.99) {   // clearly fast: try AO once
        this.aoOff = false; this.aoRetried = true; this.good = 0; this.hold = 2;
        this.apply();
      } else if (++this.good >= 3 && this.dpr < this.ceiling - 0.01) {
        this.dpr = Math.min(this.ceiling, this.dpr * 1.12);
        this.good = 0; this.hold = 1;
        this.apply();
      }
    } else {
      this.good = 0;
    }
    // slowly forget an old limit, so an easier scene can sharpen again
    if (fps >= 57 && ++this.age > 8) { this.age = 0; this.ceiling = Math.min(this.max, this.ceiling * 1.1); }
  }
}
