// The pedestal gallery: hover + keyboard-accessible hotspots, and an inspect
// mode with orbit/zoom, exploded view, blueprint mode, paint and lights.
import * as THREE from 'three';
import { clamp, damp, lerp } from '../lib/util.js';
import { PAINTS } from '../models/gt3.js';

const D2R = Math.PI / 180;

export class Gallery {
  constructor({ camera, canvas, pedestals, kits, infos, announce, onChange }) {
    Object.assign(this, { camera, canvas, pedestals, kits, infos, announce, onChange });
    this.hover = -1;
    this.active = -1;
    this.blend = 0;
    this.enabled = false;
    this.orbit = { az: 0, el: 14 * D2R, r: 3.6, taz: 0, tel: 14 * D2R, tr: 3.6 };
    this.ray = new THREE.Raycaster();
    this.ndc = new THREE.Vector2(-2, -2);
    this.pointers = new Map();
    this.tgt = new THREE.Vector3();
    this.pos = new THREE.Vector3();
    for (const k of kits) {
      k.ui = { explode: 0, explodeT: 0, wire: 0, wireT: 0, spin: true, glow: 1, glowT: 1, yaw: -0.65 };
      k.root.rotation.y = k.ui.yaw;
    }
    for (const p of pedestals) p.hover = 0;
    this.buildDom();
    this.bind();
  }

  buildDom() {
    const root = document.getElementById('hotspots');
    this.hotspots = this.infos.map((info, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'hotspot';
      b.innerHTML = `<span class="hotspot__n">OBJ-0${i + 1}</span><span class="hotspot__t"></span><span class="hotspot__cta">Inspect →</span>`;
      b.querySelector('.hotspot__t').textContent = info.title;
      b.setAttribute('aria-label', `Inspect ${info.full}`);
      b.addEventListener('click', () => this.open(i));
      b.addEventListener('pointerenter', () => { this.hoverDom = i; });
      b.addEventListener('pointerleave', () => { this.hoverDom = -1; });
      b.addEventListener('focus', () => { this.hoverDom = i; });
      b.addEventListener('blur', () => { this.hoverDom = -1; });
      root.append(b);
      return b;
    });
    this.hoverDom = -1;
    this.panel = document.getElementById('inspector');
    this.panel.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-act]');
      if (btn) this.act(btn.dataset.act, btn);
    });
    this.swatches = document.getElementById('insp-swatches');
    PAINTS.forEach((p, i) => {
      const s = document.createElement('button');
      s.type = 'button';
      s.className = 'swatch';
      s.setAttribute('role', 'radio');
      s.setAttribute('aria-checked', i === 0 ? 'true' : 'false');
      s.setAttribute('aria-label', p.name);
      s.title = p.name;
      s.style.setProperty('--c', `#${p.hex.toString(16).padStart(6, '0')}`);
      s.addEventListener('click', () => this.paint(i));
      this.swatches.append(s);
    });
  }

  bind() {
    const c = this.canvas;
    window.addEventListener('pointermove', (e) => {
      this.ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
      if (this.pointers.has(e.pointerId)) this.drag(e);
    });
    c.addEventListener('pointerdown', (e) => {
      if (this.active < 0) return;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      c.setPointerCapture(e.pointerId);
    });
    const up = (e) => { this.pointers.delete(e.pointerId); this.pinch = null; };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    c.addEventListener('click', () => {
      if (!this.enabled) return;
      if (this.active < 0 && this.hover >= 0) this.open(this.hover);
    });
    c.addEventListener('dblclick', () => {
      if (this.active >= 0) Object.assign(this.orbit, { taz: 0, tel: 14 * D2R, tr: 3.6 });
    });
    window.addEventListener('wheel', (e) => {
      if (this.active < 0) return;
      e.preventDefault();
      this.orbit.tr = clamp(this.orbit.tr * Math.exp(e.deltaY * 0.0012), 1.8, 7);
    }, { passive: false });
    window.addEventListener('keydown', (e) => {
      if (this.active < 0) return;
      if (e.key === 'Escape') { e.preventDefault(); this.close(); }
      else if (e.key === 'ArrowRight' && !isField(e.target)) { e.preventDefault(); this.open((this.active + 1) % 3); }
      else if (e.key === 'ArrowLeft' && !isField(e.target)) { e.preventDefault(); this.open((this.active + 2) % 3); }
      else if (e.key === '+' || e.key === '=') this.orbit.tr = clamp(this.orbit.tr * 0.85, 1.8, 7);
      else if (e.key === '-') this.orbit.tr = clamp(this.orbit.tr * 1.15, 1.8, 7);
    });
  }

  drag(e) {
    const prev = this.pointers.get(e.pointerId);
    const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
    prev.x = e.clientX; prev.y = e.clientY;
    if (this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (this.pinch) this.orbit.tr = clamp(this.orbit.tr * (this.pinch / d), 1.8, 7);
      this.pinch = d;
      return;
    }
    this.orbit.taz -= dx * 0.006;
    this.orbit.tel = clamp(this.orbit.tel + dy * 0.004, -0.15, 1.35);
  }

  open(i) {
    const first = this.active < 0;
    this.active = i;
    const info = this.infos[i], kit = this.kits[i];
    document.documentElement.classList.add('is-inspecting');
    this.panel.hidden = false;
    requestAnimationFrame(() => this.panel.classList.add('is-open'));
    this.panel.querySelector('#insp-index').textContent = `OBJ-0${i + 1} · ${info.title}`;
    this.panel.querySelector('#insp-title').textContent = info.full;
    this.panel.querySelector('#insp-blurb').textContent = info.blurb;
    const specs = this.panel.querySelector('#insp-specs');
    specs.replaceChildren();
    const rows = [
      ['Parts', kit.stats.parts], ['Meshes', kit.stats.meshes], ['Triangles', kit.stats.triangles.toLocaleString('en-US')],
      ['Materials', kit.stats.materials], ['Real length', info.real.length], ['Mass', info.real.weight],
    ];
    for (const [k, v] of rows) {
      const dt = document.createElement('dt'); dt.textContent = k;
      const dd = document.createElement('dd'); dd.textContent = String(v);
      specs.append(dt, dd);
    }
    const note = this.panel.querySelector('#insp-note');
    note.textContent = info.real.note;
    this.drawRadar(i);
    this.panel.querySelector('#insp-dump').textContent = vertexLog(kit);
    this.swatches.hidden = info.id !== 'gt3';
    this.panel.querySelector('[data-act="lights"]').hidden = info.id !== 'voyager';
    this.syncButtons();
    if (first) Object.assign(this.orbit, { az: 0, el: 14 * D2R, r: 4.6, taz: 0, tel: 14 * D2R, tr: 3.6 });
    this.panel.querySelector('#insp-title').focus({ preventScroll: true });
    this.announce(`Inspecting ${info.full}. Drag to orbit, scroll to zoom, Escape to close.`);
    this.onChange?.(i);
  }

  // Polar chart of measured stats, normalised to the largest model in the series.
  drawRadar(i) {
    const svg = this.panel.querySelector('#insp-radar');
    const axes = [
      ['Parts', (k) => k.stats.parts], ['Meshes', (k) => k.stats.meshes], ['Triangles', (k) => k.stats.triangles],
      ['Materials', (k) => k.stats.materials], ['Length', (k) => k.size.x / k.scale], ['Height', (k) => k.size.y / k.scale],
    ];
    const max = axes.map(([, f]) => Math.max(...this.kits.map(f)));
    const R = 82;
    const pt = (a, r) => [Math.sin((a / axes.length) * Math.PI * 2) * r, -Math.cos((a / axes.length) * Math.PI * 2) * r];
    const poly = (k) => axes.map(([, f], a) => pt(a, R * Math.max(0.06, f(k) / max[a])).map((v) => v.toFixed(1)).join(',')).join(' ');
    let out = '';
    for (const f of [0.25, 0.5, 0.75, 1]) out += `<polygon class="rd-ring" points="${axes.map((_, a) => pt(a, R * f).join(',')).join(' ')}"/>`;
    axes.forEach(([name], a) => {
      const [x, y] = pt(a, R), [lx, ly] = pt(a, R + 14);
      out += `<line class="rd-spoke" x1="0" y1="0" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`;
      out += `<text class="rd-lbl" x="${lx.toFixed(1)}" y="${(ly + 3).toFixed(1)}" text-anchor="middle">${name}</text>`;
    });
    this.kits.forEach((k, j) => { if (j !== i) out += `<polygon class="rd-other" points="${poly(k)}"/>`; });
    out += `<polygon class="rd-shape" points="${poly(this.kits[i])}"/>`;
    axes.forEach(([, f], a) => { const [x, y] = pt(a, R * Math.max(0.06, f(this.kits[i]) / max[a])); out += `<circle class="rd-dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2"/>`; });
    svg.innerHTML = out;
  }

  close() {
    if (this.active < 0) return;
    const i = this.active;
    this.active = -1;
    document.documentElement.classList.remove('is-inspecting');
    this.panel.classList.remove('is-open');
    setTimeout(() => { if (this.active < 0) this.panel.hidden = true; }, 450);
    this.hotspots[i].focus({ preventScroll: true });
    this.announce('Closed inspector.');
    this.onChange?.(-1);
  }

  act(name, btn) {
    const kit = this.kits[this.active];
    if (name === 'close') return this.close();
    if (name === 'next') return this.open((this.active + 1) % 3);
    if (name === 'prev') return this.open((this.active + 2) % 3);
    if (!kit) return;
    const u = kit.ui;
    if (name === 'explode') u.explodeT = u.explodeT ? 0 : 1;
    if (name === 'wire') u.wireT = u.wireT ? 0 : 1;
    if (name === 'spin') u.spin = !u.spin;
    if (name === 'lights') u.glowT = u.glowT > 0.5 ? 0.12 : 1;
    this.syncButtons();
    void btn;
  }

  syncButtons() {
    const kit = this.kits[this.active];
    if (!kit) return;
    const set = (act, v) => this.panel.querySelector(`[data-act="${act}"]`).setAttribute('aria-pressed', v ? 'true' : 'false');
    set('explode', kit.ui.explodeT > 0.5);
    set('wire', kit.ui.wireT > 0.5);
    set('spin', kit.ui.spin);
    set('lights', kit.ui.glowT > 0.5);
  }

  paint(i) {
    const kit = this.kits[1];
    kit.ui.paintT = new THREE.Color(PAINTS[i].hex);
    [...this.swatches.children].forEach((s, k) => s.setAttribute('aria-checked', k === i ? 'true' : 'false'));
    this.announce(`Paint: ${PAINTS[i].name}`);
  }

  // Called every frame before the director reads gallery matrices.
  update(dt, time, T, reduced) {
    const enabled = T > 9.96 && T < 10.92;
    if (enabled !== this.enabled) document.documentElement.classList.toggle('gallery-on', enabled);
    this.enabled = enabled;
    if (!this.enabled && this.active >= 0) this.close();

    // Hover via raycast.
    let hover = this.hoverDom;
    if (this.enabled && this.active < 0 && hover < 0) {
      this.ray.setFromCamera(this.ndc, this.camera);
      const hits = this.ray.intersectObjects(this.pedestals.map((p) => p.hit), false);
      hover = hits.length ? hits[0].object.userData.pedestal : -1;
    }
    if (hover !== this.hover) {
      this.hover = hover;
      document.documentElement.classList.toggle('pedestal-hover', hover >= 0);
      this.hotspots.forEach((h, i) => h.classList.toggle('is-hot', i === hover));
    }

    this.pedestals.forEach((p, i) => {
      const target = (this.enabled && (i === this.hover || i === this.active)) ? 1 : 0;
      p.hover = damp(p.hover, target, 8, dt);
      const k = this.kits[i], u = k.ui;
      u.explode = damp(u.explode, u.explodeT, 4.5, dt);
      u.wire = damp(u.wire, u.wireT, 3.5, dt);
      u.glow = damp(u.glow, u.glowT, 4, dt);
      k.setExplode(u.explode);
      k.uniforms.uWire.value = u.wire;
      k.uniforms.uRim.value = u.explode * 0.35;
      k.uniforms.uLineBase.value = u.explode * 0.12;
      k.uniforms.uGlow.value = u.glow;
      k.wireHide = u.wire > 0.002 ? k.frontAt(u.wire) : null;
      if (u.paintT && k.paint) k.paint.color.lerp(u.paintT, 1 - Math.exp(-6 * dt));
      if (u.spin && !reduced) u.yaw += dt * (i === this.active ? 0.18 : 0.32);
      k.root.rotation.y = u.yaw;
      k.root.position.y = 0.06 * p.hover + Math.sin(time * 1.1 + i * 2) * 0.03 * (reduced ? 0 : 1);
    });
  }

  // Blend the story camera toward the inspect orbit.
  applyCamera(cam, story, dt) {
    const o = this.orbit;
    this.blend = damp(this.blend, this.active >= 0 ? 1 : 0, 4.2, dt);
    o.az = damp(o.az, o.taz, 8, dt); o.el = damp(o.el, o.tel, 8, dt); o.r = damp(o.r, o.tr, 6, dt);
    let fov = story.fov;
    if (this.blend > 0.0005 && (this.active >= 0 || this.last >= 0)) {
      const i = this.active >= 0 ? this.active : this.last;
      this.last = i;
      const p = this.pedestals[i];
      const k = this.kits[i];
      p.mount.getWorldPosition(this.tgt);
      this.tgt.y += k.size.y * 0.5 + 0.12;
      const fit = cam.aspect >= 1.1 ? 1 : 1.5;
      const r = o.r * fit;
      this.pos.set(this.tgt.x + Math.sin(o.az) * Math.cos(o.el) * r, this.tgt.y + Math.sin(o.el) * r, this.tgt.z + Math.cos(o.az) * Math.cos(o.el) * r);
      // Shift the subject left of centre on wide screens so the panel never covers it.
      const side = new THREE.Vector3().subVectors(this.tgt, this.pos).cross(cam.up).normalize();
      const shift = cam.aspect > 1.1 ? 0.55 * this.blend : 0;
      const b = this.blend * this.blend * (3 - 2 * this.blend);
      cam.position.lerpVectors(story.pos, this.pos.clone().addScaledVector(side, shift), b);
      const look = new THREE.Vector3().lerpVectors(story.tgt, this.tgt.clone().addScaledVector(side, shift), b);
      cam.lookAt(look);
      fov = lerp(story.fov, 34, b);
    } else {
      this.last = -1;
      cam.position.copy(story.pos);
      cam.lookAt(story.tgt);
    }
    if (Math.abs(cam.fov - fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); }
  }

  // Screen positions for the DOM hotspots.
  placeHotspots(cam, w, h) {
    const v = new THREE.Vector3();
    this.pedestals.forEach((p, i) => {
      p.group.getWorldPosition(v);
      v.y += 0.06;
      v.z += 1.15;
      v.project(cam);
      const x = (v.x * 0.5 + 0.5) * w, y = (-v.y * 0.5 + 0.5) * h;
      this.hotspots[i].style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%)`;
    });
  }
}

// The first vertices of the model's largest mesh, in model space.
function vertexLog(kit) {
  const m = [...kit.meshes].sort((a, b) => b.mesh.geometry.attributes.aHome.count - a.mesh.geometry.attributes.aHome.count)[0];
  const h = m.mesh.geometry.attributes.aHome;
  const rows = [];
  for (let i = 0; i < Math.min(12, h.count); i++) {
    const f = (v) => (v >= 0 ? '+' : '') + v.toFixed(3);
    rows.push(`${String(i).padStart(2, '0')}  ${f(h.getX(i))} ${f(h.getY(i))} ${f(h.getZ(i))}`);
  }
  return `${m.part.name} · ${h.count.toLocaleString('en-US')} verts\n${rows.join('\n')}`;
}

function isField(t) {
  return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
}
