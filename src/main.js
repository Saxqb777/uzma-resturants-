// Boot: renderer, post-processing, builds the restaurant, then runs the tour.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';

import { RESTAURANT, FONTS, LAYOUT, SCENES } from './config.js';
import { buildMaterials } from './materials.js';
import { setMaxAnisotropy, refreshSignFonts, skyTexture } from './textures.js';
import { buildInterior } from './interior.js';
import { loadFoodTextures } from './food.js';
import { buildCashier, loadPolaroidPhotos } from './cashier.js';
import { buildKitchen } from './kitchen.js';
import { buildDecor, loadArt } from './decor.js';
import { buildExterior } from './exterior.js';
import { Director } from './director.js';
import { Spectator } from './spectator.js';
import { Quality } from './quality.js';
import { ZoneLights } from './lighting.js';

const $ = (id) => document.getElementById(id);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const params = new URLSearchParams(location.search);

const loadBar = $('loadBar'), loadMsg = $('loadMsg');
const step = async (pct, msg) => {
  loadBar.style.width = `${pct}%`;
  if (msg) loadMsg.textContent = msg;
  await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
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
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.4, 0.4, 1.0);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const fxaa = new ShaderPass(FXAAShader);
composer.addPass(fxaa);
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, vignette: { value: 0.42 }, grain: { value: 0.035 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float time, vignette, grain; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 d = (vUv - 0.5) * vec2(1.0, 0.82);
      float v = smoothstep(0.78, 0.18, length(d));
      c.rgb *= mix(1.0 - vignette, 1.0, v);
      c.rgb = mix(c.rgb, c.rgb * vec3(1.05, 1.0, 0.93), 0.6);          // warm grade
      c.rgb += (h(vUv * 917.0 + fract(time) * 37.0) - 0.5) * grain;     // film grain
      gl_FragColor = c;
    }`,
});
composer.addPass(grade);

const quality = new Quality({ renderer, composer, bloom, fxaa, fixedDpr, onChange: (q) => showQuality(q) });

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
};
const zones = new ZoneLights(scene, camera);

async function build() {
  await step(8, 'Lighting the grill…');
  const mats = await buildMaterials(renderer);
  if (!scene.environment) scene.environment = makeEnvironment();
  await loadFoodTextures();
  await step(35, 'Setting the tables…');
  const ctx = { scene, camera, renderer, mats, roof, animators, layout: LAYOUT, R: RESTAURANT, F: FONTS };
  buildInterior(ctx);
  await loadPolaroidPhotos();
  buildCashier(ctx);
  buildKitchen(ctx);
  await loadArt();
  buildDecor(ctx);
  await step(60, 'Hanging the signs…');
  buildExterior(ctx);
  scene.add(hemi);
  await step(75, 'Painting the signs…');
  await document.fonts?.ready;
  await refreshSignFonts(6000);
  await step(85, 'Opening the doors…');
  zones.tag();
  await preload();
  renderer.shadowMap.needsUpdate = true;
}

// Do all the GPU set-up now, behind the loading screen, so the tour never stutters
// the first time a new area comes into view.
async function preload() {
  // 1) upload every texture
  const seen = new Set();
  const upload = (v) => { if (v && v.isTexture && !seen.has(v)) { seen.add(v); renderer.initTexture(v); } };
  scene.traverse((o) => { for (const m of [].concat(o.material || [])) for (const k of Object.keys(m)) upload(m[k]); });
  upload(scene.background);
  await step(90);
  // 2) compile shaders for each lighting combination, as they are drawn (into the post-processing target)
  renderer.setRenderTarget(composer.readBuffer);
  for (const z of ['in', 'out', 'all']) { zones.force(z); renderer.compile(scene, camera); }
  renderer.setRenderTarget(null);
  await step(95);
  // 3) draw every tour shot once (with that spot's lighting) into a tiny target,
  //    so geometry is uploaded and every shader has actually been used once
  const tmp = new THREE.WebGLRenderTarget(64, 36, { type: THREE.HalfFloatType });
  renderer.setRenderTarget(tmp);
  for (const s of SCENES) {
    director.snapTo(s);
    roof.visible = !s.cutaway;
    for (const z of ['all', zones.zoneOf(camera.position)]) { zones.force(z); renderer.render(scene, camera); }
  }
  renderer.setRenderTarget(null);
  tmp.dispose();
  roof.visible = true;
  zones.force('all');
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
  const want = !roof.visible ? HEMI.top : zoneNow === 'in' ? HEMI.in : HEMI.out;
  const k = Math.min(1, dt * 3);
  hemi.intensity += (want.i - hemi.intensity) * k;
  hemi.color.lerp(want.sky, k); hemi.groundColor.lerp(want.ground, k);
  zones.update(dt);
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
  quality, zones, composer,
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
