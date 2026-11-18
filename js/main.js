// Podestalia — boot, build, and the render loop.
import * as THREE from 'three';
import { Kit } from './models/kit.js';
import { buildM16, M16_INFO } from './models/m16.js';
import { buildGT3, GT3_INFO } from './models/gt3.js';
import { buildShip, SHIP_INFO, SHIP_POI } from './models/ship.js';
import { Swarm } from './fx/particles.js';
import { FatLines, aeroLines, orbitRings, vortexRibbons, globeLines, pedestalArcs, burstLines } from './fx/lines.js';
import { createFloor, createOcean, createDust, createPedestal, lightCone, studioEnvironment, PEDESTAL_TOP } from './fx/environment.js';
import { createPost } from './fx/post.js';
import { Director, FLOOR_Y, WATER_Y } from './story.js';
import { ScrollStory } from './ui/scroll.js';
import { splitText, Panels } from './ui/panels.js';
import { Overlay } from './ui/overlay.js';
import { Gallery } from './ui/gallery.js';
import { Cursor } from './ui/cursor.js';
import { clamp, damp } from './lib/util.js';

const $ = (s) => document.querySelector(s);
const html = document.documentElement;
html.classList.add('js');
const params = new URLSearchParams(location.search);

const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
let reduced = motionQuery.matches;
try {
  const saved = localStorage.getItem('podestalia:motion');
  if (saved === 'off') reduced = true;
  if (saved === 'on') reduced = false;
} catch { /* storage unavailable — fall back to the OS preference */ }

const INFOS = [M16_INFO, GT3_INFO, SHIP_INFO];
const DEFS = [
  { build: buildM16, story: { scale: 4.4 / 84, alignY: 'center' }, gal: { scale: 2.2 / 84, alignY: 'bottom', y: 0.2 }, rootY: 0.08, env: 1.35 },
  { build: buildGT3, story: { scale: 1, alignY: 'bottom' }, gal: { scale: 0.44, alignY: 'bottom', y: 0.004 }, rootY: FLOOR_Y, env: 1 },
  { build: buildShip, story: { scale: 0.93, alignY: 'none' }, gal: { scale: 0.34, alignY: 'bottom', y: 0.05 }, rootY: WATER_Y, env: 0.45 },
];
const PEDESTALS = [[-3.3, 0.55], [0, -0.45], [3.3, 0.55]];
const CALLOUT_WINDOWS = { carbine: [1.62, 2.02], gt3side: [3.4, 3.64], gt3rear: [3.74, 3.95], bow: [5.2, 5.62], stern: [6.2, 6.62], side: [7.2, 7.62], top: [8.2, 8.62] };

const loader = { el: $('#loader'), bar: $('#loader-bar'), pct: $('#loader-pct'), msg: $('#loader-msg'), dots: $('#ldr-dots'), p: 0 };
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
async function step(p, msg) {
  loader.p = p;
  loader.bar.style.transform = `scaleX(${p.toFixed(3)})`;
  loader.pct.textContent = String(Math.round(p * 100));
  if (msg) loader.msg.textContent = msg;
  drawDots(performance.now());
  await nextFrame();
}

// Dot-matrix skyline that rises with load progress.
const dotSeeds = Array.from({ length: 48 }, (_, i) => 0.35 + 0.65 * Math.abs(Math.sin(i * 12.9898 + 4.1) * 43758.5453 % 1));
function drawDots(now) {
  const c = loader.dots;
  if (!c || !c.isConnected) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = c.clientWidth, h = c.clientHeight;
  if (!w || !h) return;
  if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
  const g = c.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  const step = 7.5, cols = Math.floor(w / step), rows = Math.floor(h / step), s = 4.4;
  for (let x = 0; x < cols; x++) {
    const lvl = Math.round(rows * loader.p * dotSeeds[x % dotSeeds.length] * (0.85 + 0.15 * Math.sin(now / 260 + x)));
    for (let y = 0; y < rows; y++) {
      const on = rows - 1 - y < lvl;
      const spark = !on && ((x * 7 + y * 13 + Math.floor(now / 140)) % 53 === 0);
      g.fillStyle = on ? '#ff5a1f' : spark ? '#6b4a3a' : '#242525';
      g.fillRect(x * step, y * step, s, s);
    }
  }
}

function pickQuality() {
  const q = params.get('q');
  const coarse = matchMedia('(pointer: coarse)').matches;
  const mem = navigator.deviceMemory || 8, cores = navigator.hardwareConcurrency || 8;
  const small = Math.min(innerWidth, innerHeight) < 600;
  let tier = coarse || small || mem <= 4 || cores <= 4 ? 1 : 2;
  if (mem <= 2) tier = 0;
  if (q === 'low') tier = 0; else if (q === 'mid') tier = 1; else if (q === 'high') tier = 2;
  const out = {
    ...[
      { tier: 0, dpr: 1, particles: 12000, bloom: false, samples: 0, dust: 800, lines: 0.55 },
      { tier: 1, dpr: 1.5, particles: 24000, bloom: true, samples: 0, dust: 1500, lines: 0.8 },
      { tier: 2, dpr: 2, particles: 48000, bloom: true, samples: 4, dust: 2600, lines: 1 },
    ][tier],
  };
  if (params.has('msaa')) out.samples = Number(params.get('msaa')) || 0;
  if (params.has('bloom')) out.bloom = params.get('bloom') !== '0';
  return out;
}

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

function announce(text) {
  const live = $('#sr-live');
  live.textContent = '';
  setTimeout(() => { live.textContent = text; }, 30);
}

function fallback(panels, reason, detail) {
  html.classList.add('no-webgl');
  panels.ready = true;
  panels.showAll();
  const fb = $('#fallback');
  fb.hidden = false;
  if (detail) fb.querySelector('[data-detail]').textContent = detail;
  loader.el.classList.add('is-done');
  console.warn('[podestalia] static mode:', reason, detail || '');
}

function makeKit(def, info, gallery) {
  const kit = new Kit(info.id + (gallery ? '-gallery' : ''), { axis: gallery ? [0, 1, 0] : [-1, 0, 0], seed: gallery ? 17 : 7 });
  def.build(kit);
  kit.finalize(gallery ? def.gal : def.story);
  kit.info = info;
  for (const m of kit.materials) m.envMapIntensity = (m.userData.env ?? 1) * def.env;
  const u = kit.uniforms;
  if (gallery) { u.uNoiseAmp.value = 0.035; u.uNoiseFreq.value = 7; u.uEdgeWidth.value = 0.025; u.uLead.value = 0.22; }
  else { u.uNoiseAmp.value = 0.12; u.uNoiseFreq.value = 2.2; u.uEdgeWidth.value = 0.07; u.uLead.value = 0.65; }
  return kit;
}

async function boot() {
  splitText();
  const sections = [...document.querySelectorAll('[data-chapter]')];
  const panels = new Panels(sections);
  wireChrome();
  if (!webglAvailable()) return fallback(panels, 'webgl-unavailable');

  const Q = pickQuality();
  html.dataset.quality = String(Q.tier);
  const dotTimer = setInterval(() => drawDots(performance.now()), 90);
  await step(0.04, 'Warming up the stage');
  try {
    await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1800))]);
  } catch { /* fonts are a nicety */ }

  // ── Renderer ─────────────────────────────────────────────────────────────
  const canvas = $('#gl');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
  } catch (err) {
    return fallback(panels, 'renderer-failed', String(err?.message || err));
  }
  const maxDpr = Math.min(window.devicePixelRatio || 1, Q.dpr);
  let dpr = maxDpr;
  renderer.setPixelRatio(dpr);
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07080a);
  scene.fog = new THREE.FogExp2(0x07080a, 0.018);
  scene.environment = studioEnvironment(renderer);
  const camera = new THREE.PerspectiveCamera(34, innerWidth / innerHeight, 0.25, 90);
  camera.position.set(0, 0.6, 6.6);

  const lights = {
    key: new THREE.DirectionalLight(0xfff1e0, 2.2),
    rim: new THREE.DirectionalLight(0x8eeaff, 2.5),
    hemi: new THREE.HemisphereLight(0x8fb3ff, 0x0b0b0e, 0.35),
    sweep: new THREE.PointLight(0xffd2a8, 0, 7, 2),
  };
  lights.key.position.set(4, 6, 5);
  lights.rim.position.set(-5, 3, -6);
  scene.add(lights.key, lights.rim, lights.hemi, lights.sweep);

  // ── Models ───────────────────────────────────────────────────────────────
  const stage = new THREE.Group();
  scene.add(stage);
  const story = [], galleryKits = [];
  const labels = ['Machining the carbine', 'Laying carbon and clearcoat', 'Welding the hull'];
  for (let i = 0; i < 3; i++) {
    await step(0.1 + i * 0.17, labels[i]);
    const k = makeKit(DEFS[i], INFOS[i], false);
    k.root.position.y = DEFS[i].rootY;
    stage.add(k.root);
    story.push(k);
    galleryKits.push(makeKit(DEFS[i], INFOS[i], true));
  }
  const [m16, car, ship] = story;
  fillStats(story);

  await step(0.62, 'Scattering particles');
  const swarm = new Swarm({ count: Q.particles, story, gallery: galleryKits });
  swarm.uniforms.uIntensity.value = 0.85 * Math.sqrt(24000 / Q.particles);
  scene.add(swarm.points);

  await step(0.72, 'Drawing vector lines');
  const floor = createFloor(FLOOR_Y);
  const ocean = createOcean(WATER_Y);
  const dust = createDust(Q.dust);
  scene.add(floor, ocean, dust);
  const shipBox = ship.box;
  ocean.uniforms.uStern.value = shipBox.min.x;
  ocean.uniforms.uBow.value = shipBox.max.x;
  ocean.uniforms.uHalf.value = shipBox.max.z * 0.96;

  const pedestals = PEDESTALS.map(([x, z], i) => {
    const p = createPedestal(i, INFOS[i].title, 0xff5a1f);
    p.group.position.set(x, FLOOR_Y - 1.2, z);
    p.group.visible = false;
    p.mount.add(galleryKits[i].root);
    scene.add(p.group);
    const cone = lightCone(6.5, 0.12, 1.35);
    cone.position.set(x, FLOOR_Y + PEDESTAL_TOP + 3.25, z);
    cone.visible = false;
    scene.add(cone);
    p.cone = cone;
    return p;
  });

  const fat = [];
  const L = (polys, opt) => { const l = new FatLines(polys, opt); l.baseWidth = opt.width; fat.push(l); return l; };
  const n = (v) => Math.max(8, Math.round(v * Q.lines));
  const lines = {
    aero: L(aeroLines(n(56)), { width: 1.5, colorA: 0xc9ccc0, colorB: 0xd8f23e, base: 0.07, pulse: 0.95, pulseFreq: 2.2, speed: 0.55, seed: 2 }),
    rings: L(orbitRings(), { width: 1.4, colorA: 0xff7a3a, colorB: 0xd8f23e, base: 0.32, pulse: 0.9, pulseFreq: 1, speed: 0.06, seed: 4 }),
    vortex: L(vortexRibbons(n(70)), { width: 1.5, colorA: 0xd8f23e, colorB: 0xff7a3a, base: 0.1, pulse: 1.2, pulseFreq: 1.5, speed: 0.3, seed: 6 }),
    globe: L(globeLines(), { width: 1.0, colorA: 0xc8d1c6, colorB: 0xffffff, base: 0.16, pulse: 0.5, pulseFreq: 1, speed: 0.1, seed: 8 }),
    burst: L(burstLines(n(48)), { width: 1.2, colorA: 0xffffff, colorB: 0xff7a3a, base: 0.35, pulse: 0.6, pulseFreq: 1, speed: 1.2, seed: 10 }),
    arcs: L(pedestalArcs(PEDESTALS.map(([x, z]) => new THREE.Vector3(x, FLOOR_Y + PEDESTAL_TOP + 0.35, z)), n(9)), { width: 1.6, colorA: 0xff7a3a, colorB: 0xd8f23e, base: 0.22, pulse: 1.5, pulseFreq: 1.2, speed: 0.9, seed: 12 }),
  };
  car.inner.add(lines.aero);
  stage.add(lines.rings);
  scene.add(lines.vortex, lines.globe, lines.burst, lines.arcs);
  for (const l of Object.values(lines)) l.visible = false;

  await step(0.8, 'Calibrating light');
  const post = createPost(renderer, scene, camera, { bloom: Q.bloom, samples: Q.samples });
  post.setSize(innerWidth, innerHeight, dpr);

  const director = new Director({ camera, stage, kits: story, gallery: galleryKits, swarm, floor, ocean, lines, pedestals, lights, post, scene });

  // ── UI ───────────────────────────────────────────────────────────────────
  const scroll = new ScrollStory(sections);
  const overlay = new Overlay($('#fx'), $('#callouts'));
  registerCallouts(overlay, story);
  const cursor = new Cursor($('#cursor'));
  const gallery = new Gallery({
    camera, canvas, pedestals, kits: galleryKits, infos: INFOS, announce,
    onChange: (i) => { cursor.setLabel(i >= 0 ? 'Drag' : ''); },
  });
  const rail = [...document.querySelectorAll('.rail__item')];
  const railFill = $('#rail-fill');
  rail.forEach((b) => b.addEventListener('click', () => {
    const t = Number(b.dataset.t);
    window.scrollTo({ top: scroll.yAt(t) + 2, behavior: reduced ? 'auto' : 'smooth' });
  }));
  document.querySelectorAll('[data-jump]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    window.scrollTo({ top: scroll.yAt(Number(a.dataset.jump)) + 2, behavior: reduced ? 'auto' : 'smooth' });
  }));
  const motionBtn = $('#motion');
  const syncMotion = () => {
    motionBtn.setAttribute('aria-pressed', reduced ? 'false' : 'true');
    motionBtn.querySelector('.motion__state').textContent = reduced ? 'Off' : 'On';
    html.classList.toggle('reduced', reduced);
  };
  motionBtn.addEventListener('click', () => {
    reduced = !reduced;
    try { localStorage.setItem('podestalia:motion', reduced ? 'off' : 'on'); } catch { /* not persisted */ }
    syncMotion();
    announce(reduced ? 'Ambient motion paused.' : 'Ambient motion on.');
  });
  motionQuery.addEventListener?.('change', (e) => { reduced = e.matches; syncMotion(); });
  syncMotion();

  // ── Sizing ───────────────────────────────────────────────────────────────
  const buf = new THREE.Vector2();
  const applySize = () => {
    const w = innerWidth, h = innerHeight;
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    post.setSize(w, h, dpr);
    renderer.getDrawingBufferSize(buf);
    for (const l of fat) { l.uniforms.uRes.value.copy(buf); l.uniforms.uWidth.value = l.baseWidth * dpr; }
    overlay.resize(w, h, $('.hero__title'));
    overlay.measure();
    scroll.measure();
  };
  let resizeQueued = false;
  window.addEventListener('resize', () => {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(() => { resizeQueued = false; applySize(); });
  });
  applySize();

  // ── Precompile every material so the first morph never hitches ──────────
  await step(0.9, 'Compiling shaders');
  const hidden = [];
  scene.traverse((o) => { if (!o.visible) { hidden.push(o); o.visible = true; } });
  try {
    if (renderer.compileAsync) await renderer.compileAsync(scene, camera);
    else renderer.compile(scene, camera);
  } catch (err) { console.warn('[podestalia] precompile', err); }
  hidden.forEach((o) => { o.visible = false; });
  await step(1, 'Ready');

  // ── Loop ─────────────────────────────────────────────────────────────────
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener('pointermove', (e) => {
    pointer.tx = (e.clientX / innerWidth) * 2 - 1;
    pointer.ty = (e.clientY / innerHeight) * 2 - 1;
  }, { passive: true });

  let last = performance.now(), animTime = 0, introStart = null, raf = 0;
  let perfAcc = 0, perfFrames = 0, lastDrop = -1e9;
  const hud = $('#hud');
  let hudAt = 0, fpsFrames = 0, fpsAt = performance.now(), fps = 60;
  const active = new Set();
  const allKits = [...story, ...galleryKits];

  const loop = (now) => {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    if (!reduced) animTime += dt;
    const introT = introStart === null ? 0 : Math.max(0, (now - introStart) / 1000);

    scroll.update(dt, reduced);
    const T = scroll.T;
    pointer.x = damp(pointer.x, reduced ? 0 : pointer.tx, 2.5, dt);
    pointer.y = damp(pointer.y, reduced ? 0 : pointer.ty, 2.5, dt);

    gallery.update(dt, animTime, T, reduced);
    const cam = director.cameraAt(T, camera.aspect, pointer);
    director.update(T, animTime, dt, { introT, aspect: camera.aspect, pointer, velocity: scroll.v, reduced });
    gallery.applyCamera(camera, cam, dt);
    camera.updateMatrixWorld();

    renderer.getDrawingBufferSize(buf);
    const focal = buf.y / (2 * Math.tan((camera.fov * Math.PI) / 360));
    swarm.uniforms.uScale.value = focal;
    dust.uniforms.uScale.value = focal;
    dust.uniforms.uTime.value = animTime;
    for (const k of allKits) k.uniforms.uTime.value = animTime;

    active.clear();
    for (const name in CALLOUT_WINDOWS) {
      const [a, b] = CALLOUT_WINDOWS[name];
      if (T >= a && T <= b && gallery.active < 0) active.add(name);
    }
    panels.update(T);
    const avoid = active.size ? panels.items.filter((it) => it.on).map((it) => it.el.getBoundingClientRect()) : [];
    overlay.update({ T, time: animTime, velocity: scroll.v, camera, reduced, introT, active, avoid });
    const chapter = Math.min(rail.length - 1, Math.floor(T));
    rail.forEach((b, i) => (i === chapter ? b.setAttribute('aria-current', 'step') : b.removeAttribute('aria-current')));
    railFill.style.setProperty('--p', scroll.progress.toFixed(4));
    if (gallery.enabled) gallery.placeHotspots(camera, innerWidth, innerHeight);
    cursor.setLabel(gallery.active >= 0 ? 'Drag' : gallery.hover >= 0 ? 'Inspect' : '');
    cursor.update(dt, reduced);
    fpsFrames++;
    if (now - fpsAt > 1000) { fps = Math.round((fpsFrames * 1000) / (now - fpsAt)); fpsFrames = 0; fpsAt = now; }
    if (now - hudAt > 120) {
      hudAt = now;
      const deg = (r) => `${Math.round(((r * 180) / Math.PI) % 360)}°`;
      hud.textContent = `T ${T.toFixed(3).padStart(6, '0')} · CH ${String(chapter).padStart(2, '0')}/11 · AZ ${deg(cam.az)} · EL ${deg(cam.el)} · PTCL ${Q.particles.toLocaleString('en-US')} · ${fps} FPS · DPR ${dpr.toFixed(2)}`;
    }

    post.composer.render(dt);

    // Adaptive resolution: trade pixels for frames, recover slowly.
    perfAcc += dt; perfFrames++;
    if (perfAcc > 2) {
      const avg = perfAcc / perfFrames;
      if (avg > 1 / 40 && dpr > 0.75) { dpr = Math.max(0.75, dpr - 0.25); lastDrop = now; applySize(); }
      else if (avg < 1 / 57 && dpr < maxDpr && now - lastDrop > 12000) { dpr = Math.min(maxDpr, dpr + 0.25); applySize(); }
      perfAcc = 0; perfFrames = 0;
    }
  };

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelAnimationFrame(raf);
    else { last = performance.now(); raf = requestAnimationFrame(loop); }
  });
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    cancelAnimationFrame(raf);
    fallback(panels, 'context-lost', 'The graphics context was lost. Reload the page to restore the 3D scene.');
  });

  raf = requestAnimationFrame(loop);
  await nextFrame();
  loader.el.classList.add('is-done');
  html.classList.add('is-ready');
  setTimeout(() => { loader.el.hidden = true; clearInterval(dotTimer); }, 1800);
  const startedDeep = window.scrollY > innerHeight * 0.5;
  // Reloading part-way down (scroll restored) skips the pop; otherwise it plays.
  introStart = startedDeep || reduced ? performance.now() - 10000 : performance.now() + 450;
  setTimeout(() => { panels.ready = true; }, startedDeep || reduced ? 0 : 1100);

  if (params.has('debug')) window.__podestalia = { scene, camera, renderer, story, galleryKits, swarm, director, scroll, gallery, Q };
}

function fillStats(story) {
  const all = {};
  for (const k of story) for (const key in k.stats) all[key] = (all[key] || 0) + k.stats[key];
  const map = { carbine: story[0].stats, gt3: story[1].stats, voyager: story[2].stats, all };
  document.querySelectorAll('[data-stat]').forEach((el) => {
    const [id, key] = el.dataset.stat.split('.');
    const v = map[id]?.[key];
    if (v === undefined) return;
    el.textContent = typeof v === 'number' ? (v >= 10000 ? `${(v / 1000).toFixed(1)}k` : v.toLocaleString('en-US')) : String(v);
  });
  // Mini bar charts: the ten heaviest parts by triangle count (measured, not invented).
  const byId = { carbine: story[0], gt3: story[1], voyager: story[2] };
  document.querySelectorAll('[data-bars]').forEach((el) => {
    const kit = byId[el.dataset.bars];
    if (!kit) return;
    const parts = [...kit.parts].filter((p) => p.tris).sort((a, b) => b.tris - a.tris).slice(0, 10);
    const max = parts[0]?.tris || 1;
    el.replaceChildren();
    parts.forEach((p, i) => {
      const row = document.createElement('span');
      row.className = `bar${i === 0 ? ' bar--max' : ''}`;
      row.style.setProperty('--h', (p.tris / max).toFixed(3));
      row.style.setProperty('--i', String(i));
      const name = document.createElement('i');
      name.textContent = p.name.replace(/-?\d+(-\d+)?$/, '').replace(/([a-z])([A-Z])/g, '$1 $2');
      const track = document.createElement('span');
      track.className = 'bar__track';
      const v = document.createElement('b');
      v.textContent = p.tris >= 1000 ? `${(p.tris / 1000).toFixed(1)}k` : String(p.tris);
      row.append(name, track, v);
      el.append(row);
    });
    el.setAttribute('aria-label', parts.map((p) => `${p.name} ${p.tris} triangles`).join(', '));
  });
}

function registerCallouts(overlay, [m16, car, ship]) {
  const v = (kit, name) => (t) => kit.find(name).obj.getWorldPosition(t);
  const poi = (key) => (t) => ship.inner.localToWorld(t.set(...SHIP_POI[key]));
  const num = (i) => String(i + 1).padStart(2, '0');
  const labelled = m16.parts.filter((p) => p.label);
  overlay.addSet('carbine', labelled.map((p, i) => ({
    label: p.label, index: num(i), anchor: v(m16, p.name), dy: p.explode.y >= 0 ? -44 : 44,
  })));
  overlay.addSet('gt3side', [
    ['wing', 'Swan-neck wing', -50], ['mirror1', 'Aero mirror', -60], ['roofFin', 'Roof scoop', -50], ['splitter', 'Front splitter', 50], ['wheel-front1', 'Center-lock wheel', 60],
  ].map(([n, label, dy], i) => ({ label, index: num(i), anchor: v(car, n), dy })));
  overlay.addSet('gt3rear', [
    ['wing', 'Swan-neck wing', -50], ['taillight', 'Full-width light bar', -30], ['exhaust', 'Titanium exhaust', 40], ['diffuser', 'Rear diffuser', 60],
  ].map(([n, label, dy], i) => ({ label, index: num(i), anchor: v(car, n), dy })));
  const shipSet = (name, list) => overlay.addSet(name, list.map(([k, label, dy], i) => ({ label, index: num(i), anchor: poi(k), dy })));
  SHIP_POI.wake = [-3.9, 0.0, 0.45];
  shipSet('bow', [['bow', 'Raked stem', -50], ['name', 'Nameboard', 40], ['helipad', 'Bow helipad', -70]]);
  shipSet('stern', [['terraces', 'Terraced aft decks', -50], ['stern', 'Transom', 40], ['wake', 'Kelvin wake', 60]]);
  shipSet('side', [['funnel', 'Funnel', -50], ['bridge', 'Bridge wings', -40], ['lifeboat', 'Lifeboats ×16', 50]]);
  shipSet('top', [['pool', 'Pool deck', -50], ['slides', 'Waterslides', 50], ['radar', 'Radar mast', -40], ['helipad', 'Helipad', 50]]);
}

function wireChrome() {
  const year = $('#year');
  if (year) year.textContent = String(new Date().getFullYear());
}

boot().catch((err) => {
  console.error('[podestalia] boot failed', err);
  const sections = [...document.querySelectorAll('[data-chapter]')];
  fallback(new Panels(sections), 'boot-error', 'Something went wrong while building the 3D scene. The story is still readable below.');
});
