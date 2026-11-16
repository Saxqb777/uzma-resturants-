// Boot: renderer, post-processing, builds the restaurant, then runs the tour.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';

import { RESTAURANT, FONTS, LAYOUT, SCENES } from './config.js';
import { buildMaterials } from './materials.js';
import { setMaxAnisotropy, refreshSignFonts, skyTexture } from './textures.js';
import { loadHDR, onAssetProgress } from './assets.js';
import { buildInterior } from './interior.js';
import { loadFoodTextures } from './food.js';
import { buildCashier, loadPolaroidPhotos } from './cashier.js';
import { buildKitchen } from './kitchen.js';
import { buildDecor, loadArt } from './decor.js';
import { placeProps } from './props.js';
import { buildCrowd } from './crowd.js';
import { buildExterior } from './exterior.js';
import { Director } from './director.js';
import { Spectator } from './spectator.js';
import { Quality } from './quality.js';
import { ZoneLights } from './lighting.js';

const $ = (id) => document.getElementById(id);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const params = new URLSearchParams(location.search);

const loadBar = $('loadBar'), loadMsg = $('loadMsg');
// Update the loading bar and give the browser a moment to paint and handle input.
// (A timer races the animation frame: background tabs get no frames, and loading must not stop there.)
const step = async (pct, msg) => {
  if (pct != null) loadBar.style.width = `${pct}%`;
  if (msg) loadMsg.textContent = msg;
  await new Promise((r) => { let done = false; const go = () => { if (!done) { done = true; r(); } }; requestAnimationFrame(() => setTimeout(go, 0)); setTimeout(go, 60); });
};

// ------------------------------------------------------------ renderer
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
const fixedDpr = params.has('dpr') ? Number(params.get('dpr')) : null;   // ?dpr=1 forces a resolution
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;   // the room is static: draw shadows once
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;
$('stage').appendChild(renderer.domElement);
renderer.domElement.tabIndex = 0;
setMaxAnisotropy(Math.min(8, renderer.capabilities.getMaxAnisotropy()));

const scene = new THREE.Scene();
scene.background = skyTexture();
scene.fog = new THREE.Fog('#0d1018', 22, 75);
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.05, 160);

// Dim warm reflections for the steel tables and bottles (a tiny "room" rendered into an env map)
function makeEnvironment() {
  const env = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(20, 8, 20), new THREE.MeshBasicMaterial({ color: '#1a120c', side: THREE.BackSide }));
  env.add(room);
  const warm = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb36b').multiplyScalar(6) });
  for (let i = 0; i < 8; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), warm);
    b.position.set(Math.cos(i * 0.8) * 6, 2.5 + (i % 2), Math.sin(i * 0.8) * 6);
    env.add(b);
  }
  const cool = new THREE.Mesh(new THREE.PlaneGeometry(6, 2), new THREE.MeshBasicMaterial({ color: new THREE.Color('#dfe9ff').multiplyScalar(2), side: THREE.DoubleSide }));
  cool.position.set(0, 3.9, -9); cool.rotation.x = Math.PI / 2; env.add(cool);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(env, 0.04).texture;
  pmrem.dispose();
  return tex;
}

// ------------------------------------------------------------ post-processing
// No MSAA (it was ~45% of each frame): edges are smoothed by a cheap FXAA pass instead.
const rt = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, { type: THREE.HalfFloatType });
const composer = new EffectComposer(renderer, rt);
composer.setPixelRatio(renderer.getPixelRatio());
composer.addPass(new RenderPass(scene, camera));

// Ambient occlusion: soft contact shadows where things meet (under tables, benches, people, in corners).
// It grounds everything in the room. Runs at reduced resolution; off in Low quality.
const AO_SCALE = 0.6;
const ao = new GTAOPass(scene, camera, 4, 4);
ao.blendIntensity = 1.0;
ao.updateGtaoMaterial({ radius: 0.55, distanceExponent: 1.4, thickness: 1.3, scale: 1.25, samples: 12, screenSpaceRadius: false });
ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, radiusExponent: 1.3, rings: 2, samples: 12 });
{
  const setSize = ao.setSize.bind(ao);
  ao.setSize = (w, h) => setSize(Math.max(2, Math.round(w * AO_SCALE)), Math.max(2, Math.round(h * AO_SCALE)));
  // see-through things (glass, leaves, hair cards, neon) must not write the AO depth, or they leave dark halos
  ao.overrideVisibility = function () {
    const cache = this._visibilityCache;
    this.scene.traverse((o) => {
      cache.set(o, o.visible);
      if (o.isPoints || o.isLine) { o.visible = false; return; }
      if (o.isMesh) {
        const m = Array.isArray(o.material) ? o.material[0] : o.material;
        if (m && (m.transparent || m.alphaTest > 0)) o.visible = false;
      }
    });
  };
}
composer.addPass(ao);

// Depth of field for the close-up slides: the subject stays sharp, the background melts away like a
// real camera lens. Reuses the ambient-occlusion depth buffer, so it costs one extra blur pass.
const dof = new ShaderPass({
  uniforms: {
    tDiffuse: { value: null }, tDepth: { value: null },
    focus: { value: 3 }, range: { value: 0.6 }, maxBlur: { value: 0 },
    near: { value: 0.05 }, far: { value: 160 }, px: { value: new THREE.Vector2(1 / 1280, 1 / 720) }, edge: { value: 2.2 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `
    #include <packing>
    uniform sampler2D tDiffuse, tDepth; uniform float focus, range, maxBlur, near, far, edge; uniform vec2 px; varying vec2 vUv;
    float dist(vec2 uv){ return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, near, far); }
    float coc(float d){ return clamp((abs(d - focus) - range) / max(focus, 0.6), 0.0, 1.0) * maxBlur; }
    void main(){
      vec4 base = texture2D(tDiffuse, vUv);
      // the depth buffer is lower-res than the picture: take the sharpest of the neighbouring depths,
      // so the outline of an in-focus subject never picks up a blurry halo
      vec2 e = px * edge;
      float c0 = min(min(coc(dist(vUv)), min(coc(dist(vUv + vec2(e.x, 0.0))), coc(dist(vUv - vec2(e.x, 0.0))))),
                     min(coc(dist(vUv + vec2(0.0, e.y))), coc(dist(vUv - vec2(0.0, e.y)))));
      if (maxBlur <= 0.01 || c0 < 0.6) { gl_FragColor = base; return; }
      vec3 acc = base.rgb; float wsum = 1.0;
      for (int i = 0; i < 18; i++) {
        float fi = float(i);
        float r = sqrt((fi + 0.5) / 18.0), a = fi * 2.39996323;
        vec2 uv = vUv + vec2(cos(a), sin(a)) * r * c0 * px;
        float w = coc(dist(uv)) >= c0 * r * 0.8 ? 1.0 : 0.12;     // keep sharp things from smearing into the blur
        acc += texture2D(tDiffuse, uv).rgb * w; wsum += w;
      }
      gl_FragColor = vec4(acc / wsum, base.a);
    }`,
});
dof.uniforms.tDepth.value = ao.depthTexture;   // (set after construction: ShaderPass clones its uniforms)
dof.enabled = false;
composer.addPass(dof);

// Bloom only for things that really glow (bulbs, neon, embers, flames). The threshold is above what a lit
// surface reaches, with a soft knee, and the bloom input is capped so a specular hot spot on steel or glass
// can never blow up into a white blob (the "glare" bug).
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.36, 0.42, 1.55);
bloom.highPassUniforms.smoothWidth.value = 0.6;
bloom.materialHighPassFilter.fragmentShader = bloom.materialHighPassFilter.fragmentShader.replace(
  'vec4 texel = texture2D( tDiffuse, vUv );',
  'vec4 texel = texture2D( tDiffuse, vUv ); texel.rgb *= min( 1.0, 3.0 / max( dot( texel.rgb, vec3( 0.299, 0.587, 0.114 ) ), 1e-4 ) );');
bloom.materialHighPassFilter.needsUpdate = true;
composer.addPass(bloom);
composer.addPass(new OutputPass());
const smaa = new SMAAPass(window.innerWidth, window.innerHeight);   // sharper edges than FXAA, text stays crisp
composer.addPass(smaa);
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, vignette: { value: 0.42 }, grain: { value: 0.035 }, warmth: { value: 0.6 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float time, vignette, grain, warmth; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 d = (vUv - 0.5) * vec2(1.0, 0.82);
      float v = smoothstep(0.78, 0.18, length(d));
      c.rgb *= mix(1.0 - vignette, 1.0, v);
      c.rgb = mix(c.rgb, c.rgb * vec3(1.05, 1.0, 0.93), warmth);       // warm grade (off in the white kitchen)
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      c.rgb = mix(vec3(l), c.rgb, 1.12);                                // a little more colour
      c.rgb = (c.rgb - 0.5) * 1.05 + 0.5;                               // a little more contrast
      c.rgb += (h(vUv * 917.0 + fract(time) * 37.0) - 0.5) * grain;     // film grain
      gl_FragColor = c;
    }`,
});
composer.addPass(grade);

const quality = new Quality({ renderer, composer, bloom, ao, fixedDpr, onChange: (q) => showQuality(q) });

// ------------------------------------------------------------ build
const roof = new THREE.Group();
roof.name = 'roof';
scene.add(roof);
const animators = [];
const hemi = new THREE.HemisphereLight('#3a4a6a', '#1a120c', 0.55);
const HEMI = {
  in: { i: 1.15, sky: new THREE.Color('#ffe0c0'), ground: new THREE.Color('#5a3e2c') },
  out: { i: 0.6, sky: new THREE.Color('#4a5878'), ground: new THREE.Color('#2a1c14') },
  top: { i: 1.8, sky: new THREE.Color('#fff0dc'), ground: new THREE.Color('#6a5040') },
  kitchen: { i: 0.75, sky: new THREE.Color('#f4f8ff'), ground: new THREE.Color('#aab2b8') },
};
const zones = new ZoneLights(scene, camera);

async function build() {
  await step(8, 'Lighting the grill…');
  const mats = await buildMaterials(renderer);
  // real HDR light probes: warm restaurant for reflections inside, a clean white room for the kitchen
  const [envWarm, envKitchen] = await Promise.all([
    loadHDR('assets/env/warm_restaurant_1k.hdr', renderer).catch(() => null),
    loadHDR('assets/env/kitchen_white_512.hdr', renderer).catch(() => null),
  ]);
  scene.environment = envWarm || makeEnvironment();
  await loadFoodTextures();
  await step(35, 'Setting the tables…');
  const ctx = { scene, camera, renderer, mats, roof, animators, envKitchen, layout: LAYOUT, R: RESTAURANT, F: FONTS };
  buildInterior(ctx);
  await loadPolaroidPhotos();
  buildCashier(ctx);
  buildKitchen(ctx);
  await loadArt();
  buildDecor(ctx);
  await placeProps(ctx);
  await step(52, 'Seating the guests…');
  await buildCrowd(ctx, story);
  await step(60, 'Hanging the signs…');
  buildExterior(ctx);
  scene.add(hemi);
  await step(75, 'Painting the signs…');
  await document.fonts?.ready;
  await refreshSignFonts(6000);
  await step(85, 'Opening the doors…');
  zones.tag();
  await preload();   // (it also draws the shadows, once: the room is static)
}

// Do all the GPU set-up now, behind the loading screen, so the tour never stutters the first time a new
// area comes into view. It runs in small slices with breaks in between, and shaders compile in the
// background (in parallel where the browser can): the page never freezes. (One big block used to make
// Chrome/Edge on Windows, which prepare shaders slowly, show "Page unresponsive".)
async function preload() {
  // Wait until the graphics chip has really finished the queued work, without freezing the page
  // (a fence we poll between short breaks; the browser keeps working in the background).
  const gl = renderer.getContext();
  const gpuDone = async (pct, msg) => {
    if (!gl.fenceSync) return;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    await step(pct, msg);
    while (gl.getSyncParameter(sync, gl.SYNC_STATUS) !== gl.SIGNALED) await step(null);
    gl.deleteSync(sync);
  };
  let t0 = performance.now();
  const breathe = async (pct, msg) => { if (performance.now() - t0 > 150 || msg) { await step(pct, msg); t0 = performance.now(); } };   // short breaks, not too many
  // 1) upload every texture
  const textures = new Set();
  const add = (v) => { if (v && v.isTexture) textures.add(v); };
  scene.traverse((o) => { for (const m of [].concat(o.material || [])) for (const k of Object.keys(m)) add(m[k]); });
  add(scene.background);
  let i = 0;
  for (const t of textures) { renderer.initTexture(t); await breathe(85 + 3 * (++i / textures.size)); }
  await gpuDone(88);
  // 2) compile the shaders for each lighting combination (into the post-processing target, like the real frames)
  const parts = [['out', 'Preparing the street…'], ['in', 'Preparing the dining room…'], ['all', 'Preparing the kitchen…']];
  const parallel = renderer.extensions.has('KHR_parallel_shader_compile');
  for (const [k, [z, msg]] of parts.entries()) {
    await step(89 + k * 2, msg);
    zones.force(z);
    renderer.setRenderTarget(composer.readBuffer);
    const mats = renderer.compile(scene, camera);           // only queues the work, returns at once
    renderer.setRenderTarget(null);
    const programs = new Set();
    for (const m of mats) { const pr = renderer.properties.get(m).currentProgram; if (pr) programs.add(pr); }
    // with parallel compiling, wait without blocking until the browser is done
    if (parallel) while ([...programs].some((pr) => !pr.isReady())) await step(null);
    // then finish each program, a few at a time (without parallel compiling, this is where the work happens)
    let n = 0;
    for (const pr of programs) { pr.getUniforms(); await breathe(89 + k * 2 + 2 * (++n / programs.size)); }
  }
  // 3) draw every tour shot once (with that spot's lighting) into a tiny target, one shot per slice,
  //    so geometry is uploaded and every shader has really been used. The shadows are drawn first, once.
  const tmp = new THREE.WebGLRenderTarget(64, 36, { type: THREE.HalfFloatType });
  zones.force('all');   // every shadow-casting light on, so every shadow map is drawn
  renderer.shadowMap.needsUpdate = true;
  renderer.setRenderTarget(tmp);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  await gpuDone(95, 'Drawing the shadows…');
  for (const [k, s] of SCENES.entries()) {
    await step(95 + 4 * (k / SCENES.length), `Final touches… ${k + 1}/${SCENES.length}`);
    renderer.setRenderTarget(tmp);
    director.snapTo(s);
    roof.visible = !s.cutaway;
    for (const z of ['all', zones.zoneOf(camera.position)]) { zones.force(z); renderer.render(scene, camera); }
    renderer.setRenderTarget(null);
  }
  tmp.dispose();
  roof.visible = true;
  zones.force('all');
  // 4) one frame through the whole effect chain with every effect on (even ones the current quality
  //    setting leaves off), so ambient occlusion, depth of field and bloom never compile mid-tour
  await gpuDone(99, 'Almost there…');
  director.snapTo(SCENES[0]);
  const was = [ao.enabled, dof.enabled, bloom.enabled];
  ao.enabled = dof.enabled = bloom.enabled = true;
  composer.render();
  [ao.enabled, dof.enabled, bloom.enabled] = was;
  await gpuDone(99);
}

// ------------------------------------------------------------ tour + look-around
const ui = $('ui'), caption = $('caption'), lookpanel = $('lookpanel'), hint = $('hint');
const btnPrev = $('prev'), btnNext = $('next'), btnLook = $('look'), btnFull = $('full'), btnQuality = $('quality');
const dots = $('dots');
$('brandKo').textContent = RESTAURANT.name;
$('brandEn').textContent = `${RESTAURANT.kind} · ${RESTAURANT.city}`;

let mode = 'tour';
let roofOn = true;

const director = new Director(camera, SCENES, {
  fadeEl: $('fade'),
  reducedMotion,
  onChange: (i) => { showCaption(i); story.onScene?.(SCENES[i], i); },
});
// Scene-specific "story" (photographer position, flash, new polaroid). Filled in by the crowd module.
const story = {};
function cameraFlash() {
  const f = $('flash');
  if (!f || reducedMotion) return;
  f.style.transition = 'none'; f.style.opacity = '0.95';
  requestAnimationFrame(() => requestAnimationFrame(() => { f.style.transition = 'opacity 0.9s ease-out'; f.style.opacity = '0'; }));
}
director.onArrive = (i) => { if (SCENES[i].flash) cameraFlash(); story.onArrive?.(SCENES[i], i); };
const spectator = new Spectator(camera, renderer.domElement, scene);

SCENES.forEach((s, i) => {
  const b = document.createElement('button');
  b.setAttribute('role', 'tab');
  b.setAttribute('aria-label', `Scene ${i + 1}: ${s.title}`);
  b.title = s.title;
  b.addEventListener('click', () => { if (mode === 'look') setMode('tour'); director.go(i); b.blur(); });
  dots.appendChild(b);
});

// Room labels for the floor-plan scene, projected from 3D each frame
const labelsEl = $('labels');
let labelItems = [];
function buildLabels(s) {
  labelsEl.textContent = '';
  labelItems = (s.labels || []).map((l) => {
    const el = document.createElement('span');
    el.textContent = l.text;
    labelsEl.appendChild(el);
    return { el, p: new THREE.Vector3(...l.at) };
  });
}
const tmpV = new THREE.Vector3();
function updateLabels() {
  const show = mode === 'tour' && labelItems.length > 0 && !director.anim;
  labelsEl.classList.toggle('off', !show);
  if (!show) return;
  const w = window.innerWidth, h = window.innerHeight;
  for (const it of labelItems) {
    tmpV.copy(it.p).project(camera);
    it.el.style.transform = `translate(${(tmpV.x * 0.5 + 0.5) * w}px, ${(-tmpV.y * 0.5 + 0.5) * h}px) translate(-50%, -50%)`;
  }
}

let capTimer = 0;
function showCaption(i) {
  const s = SCENES[i];
  const total = String(SCENES.length).padStart(2, '0');
  [...dots.children].forEach((d, k) => d.setAttribute('aria-current', k === i ? 'true' : 'false'));
  btnPrev.disabled = i === 0;
  const last = i === SCENES.length - 1;
  btnNext.querySelector('.label').textContent = last ? 'Start over' : 'Next';
  btnNext.setAttribute('aria-label', last ? 'Start the tour over' : 'Next scene');
  buildLabels(s);
  caption.classList.add('swap');
  clearTimeout(capTimer);
  capTimer = setTimeout(() => {
    $('capNum').textContent = `${String(i + 1).padStart(2, '0')} / ${total}`;
    $('capKicker').textContent = s.kicker;
    $('capTitle').textContent = s.title;
    $('capText').textContent = s.text || '';
    $('capText').hidden = !s.text;
    caption.classList.remove('swap');
  }, reducedMotion ? 0 : 280);
}

function setMode(m) {
  if (m === mode) return;
  mode = m;
  const look = m === 'look';
  btnLook.setAttribute('aria-pressed', String(look));
  caption.hidden = look;
  lookpanel.hidden = !look;
  if (look) {
    director.anim = null;
    $('fade').style.opacity = '0';
    camera.up.set(0, 1, 0);
    spectator.enable();
    renderer.domElement.focus();
  } else {
    spectator.disable();
    director.resume();
  }
  flashHint();
}

let hintTimer = 0;
function flashHint() {
  hint.classList.remove('faded');
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => hint.classList.add('faded'), 7000);
}

function toggleFull() {
  const el = document.documentElement;
  if (!document.fullscreenElement) el.requestFullscreen?.().catch(() => {});
  else document.exitFullscreen?.().catch(() => {});
}

btnPrev.addEventListener('click', () => { if (mode === 'look') setMode('tour'); director.prev(); btnPrev.blur(); });
btnNext.addEventListener('click', () => {
  if (mode === 'look') setMode('tour');
  if (director.index === SCENES.length - 1) director.go(0); else director.next();
  btnNext.blur();
});
btnLook.addEventListener('click', () => { setMode(mode === 'look' ? 'tour' : 'look'); btnLook.blur(); });
btnFull.addEventListener('click', () => { toggleFull(); btnFull.blur(); });
btnQuality.addEventListener('click', () => { quality.cycle(); btnQuality.blur(); });
function showQuality(q) {
  $('qualityLabel').textContent = q.label;
  btnQuality.setAttribute('aria-label', `Picture quality: ${q.label}. Click to change.`);
  btnQuality.title = { Auto: 'Quality: Auto (adjusts to keep motion smooth)', High: 'Quality: High (sharpest)', Low: 'Quality: Low (for slow laptops)', Fixed: 'Quality: fixed by the link' }[q.label];
}

window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'BUTTON' && (e.key === 'Enter' || e.key === ' ')) return;
  if (!$('loader').classList.contains('done')) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key;
  if (k === 'v' || k === 'V') { setMode(mode === 'look' ? 'tour' : 'look'); return; }
  if (k === 'h' || k === 'H') { ui.classList.toggle('hidden'); return; }
  if (k === 'f' || k === 'F') { toggleFull(); return; }
  if (mode === 'look') {
    if (k === 'Enter' || k === 'Escape') setMode('tour');
    if (k === 'r' || k === 'R') roofOn = !roofOn;
    return;
  }
  if (k === 'Enter' || k === ' ' || k === 'ArrowRight' || k === 'PageDown' || k === 'ArrowDown') { e.preventDefault(); director.next(); }
  else if (k === 'ArrowLeft' || k === 'Backspace' || k === 'PageUp' || k === 'ArrowUp') { e.preventDefault(); director.prev(); }
  else if (k === 'Home') director.go(0);
  else if (k === 'End') director.go(SCENES.length - 1);
  else if (/^[1-9]$/.test(k)) director.go(Number(k) - 1);
});

window.addEventListener('resize', () => {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  quality.apply();
});

// ------------------------------------------------------------ loop
const clock = new THREE.Clock();
let snapLook = false;   // screenshots: jump straight to the settled ambient light instead of easing
let t = 0;
function frame() {
  const raw = clock.getDelta();
  const dt = Math.min(raw, 0.05);
  t += dt;
  quality.sample(raw);
  for (const f of animators) f(t, dt);
  if (mode === 'tour') director.update(dt);
  else spectator.update(dt);
  const above = camera.position.y > LAYOUT.slabTop + 3;
  roof.visible = mode === 'tour' ? !director.cutaway : roofOn && !above;
  // ambient fill follows where the camera is: warm inside, cool night outside, bright for the floor plan
  const zoneNow = zones.zoneOf(camera.position);
  const inKitchen = zoneNow === 'in' && camera.position.z < LAYOUT.kitchen.z0 + 0.3;
  const want = !roof.visible ? HEMI.top : inKitchen ? HEMI.kitchen : zoneNow === 'in' ? HEMI.in : HEMI.out;
  const k = snapLook ? 1 : Math.min(1, dt * 3);
  grade.uniforms.warmth.value += ((inKitchen ? 0 : 0.6) - grade.uniforms.warmth.value) * k;
  hemi.intensity += (want.i - hemi.intensity) * k;
  hemi.color.lerp(want.sky, k); hemi.groundColor.lerp(want.ground, k);
  zones.update(dt);
  // focus: close-up slides pull focus onto their subject once the camera has arrived
  const sc = SCENES[director.index];
  const wantBlur = mode === 'tour' && !director.anim && sc.dof && ao.enabled ? sc.dof * (renderer.domElement.height / 1080) : 0;
  const du = dof.uniforms;
  du.maxBlur.value += (wantBlur - du.maxBlur.value) * (snapLook ? 1 : Math.min(1, dt * 2.2));
  if (sc.dof) du.focus.value = sc.focus || new THREE.Vector3(...sc.cam).distanceTo(new THREE.Vector3(...sc.look));
  du.near.value = camera.near; du.far.value = camera.far;
  du.px.value.set(1 / renderer.domElement.width, 1 / renderer.domElement.height);
  dof.enabled = du.maxBlur.value > 0.05;
  grade.uniforms.time.value = t;
  composer.render();
  updateLabels();
}

// Exposed for screenshots / debugging
window.__uzma = {
  director, spectator, camera, scene, renderer, setMode, get mode() { return mode; },
  pause: () => renderer.setAnimationLoop(null),
  resume: () => renderer.setAnimationLoop(frame),
  renderOnce: () => frame(),
  tick: (dt) => { t += dt; for (const f of animators) f(t, dt); },
  quality, zones, composer, ao, bloom, dof,
  settle: (on = true) => { snapLook = on; },
};

quality.apply();
build().then(async () => {
  const start = Math.max(0, Math.min(SCENES.length - 1, Number(params.get('scene') || 1) - 1));
  director.start(start);
  showCaption(start);
  renderer.setAnimationLoop(frame);
  await step(100, 'Ready');
  const startBtn = $('startBtn');
  startBtn.hidden = false;
  $('startHint').hidden = false;
  startBtn.focus();
  const begin = () => {
    $('loader').classList.add('done');
    renderer.domElement.focus();
    flashHint();
  };
  startBtn.addEventListener('click', begin, { once: true });
  window.__uzma.ready = true;
  window.__uzma.begin = begin;
}).catch((err) => {
  console.error(err);
  loadMsg.textContent = 'Something went wrong while building the restaurant. Try reloading the page.';
});
