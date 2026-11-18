// SVG overlay: flowing ribbons that react to scroll velocity, hand-drawn
// scribbles scrubbed by story time, and 3D-anchored callouts with leader lines.
import * as THREE from 'three';
import { clamp, seg, rng, bump } from '../lib/util.js';

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.append(e);
  return e;
};

function bezier(pts) {
  if (pts.length < 2) return '';
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

// A looping, pen-like scribble along a direction.
function scribble(r, x, y, len, ang, loops, rad) {
  const pts = [];
  const N = Math.max(8, Math.floor(loops * 9));
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const wob = r() * 10;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const ph = t * loops * Math.PI * 2;
    const rr = rad * (0.55 + 0.45 * Math.sin(t * 5 + wob)) * (0.4 + 0.6 * Math.sin(Math.PI * t));
    const lx = t * len + Math.cos(ph) * rr * 0.9;
    const ly = Math.sin(ph) * rr + Math.sin(t * 3 + wob) * rad * 0.4;
    pts.push([x + lx * ca - ly * sa, y + lx * sa + ly * ca]);
  }
  return bezier(pts);
}

// Hand-drawn ellipse that overshoots its start, like a quick pen circle.
function penCircle(r, cx, cy, rx, ry, turns = 1.15) {
  const pts = [];
  const a0 = -2.4 + r() * 0.4;
  for (let i = 0; i <= 48; i++) {
    const t = i / 48, a = a0 + t * Math.PI * 2 * turns;
    const j = 1 + Math.sin(t * 9 + r() * 6) * 0.025 + t * 0.06;
    pts.push([cx + Math.cos(a) * rx * j, cy + Math.sin(a) * ry * j]);
  }
  return bezier(pts);
}

export class Overlay {
  constructor(svg, calloutRoot) {
    this.svg = svg;
    this.gGrid = svg.querySelector('#fx-grid');
    this.construct = [];
    this.gFlow = svg.querySelector('#fx-flow');
    this.gScrib = svg.querySelector('#fx-scribble');
    this.gLead = svg.querySelector('#fx-leaders');
    this.calloutRoot = calloutRoot;
    this.flow = [];
    this.windows = [];
    this.sets = new Map();
    this.hero = null;
    this.w = 1; this.h = 1;
    for (let i = 0; i < 6; i++) {
      const p = el('path', { class: `flow flow--${i % 3}`, fill: 'none' }, this.gFlow);
      this.flow.push({ p, i });
    }
  }

  // Swiss construction grid: faint columns, crosshairs, index numbers, and
  // per-chapter diagonal guides that draw in and out at every transition.
  buildGrid(w, h) {
    const g = this.gGrid;
    g.replaceChildren();
    const cols = w > 860 ? 12 : 4, rows = 6;
    const left = w > 860 ? 44 : 16, right = w - (w > 860 ? 74 : 16);
    const gx = [], gy = [];
    for (let i = 0; i <= cols; i++) gx.push(Math.round(left + ((right - left) * i) / cols) + 0.5);
    for (let j = 0; j <= rows; j++) gy.push(Math.round(72 + ((h - 112) * j) / rows) + 0.5);
    for (const x of gx) el('line', { x1: x, y1: 0, x2: x, y2: h, class: 'gl-col' }, g);
    const cross = (x, y, s, cls) => el('path', { d: `M${x - s} ${y}H${x + s}M${x} ${y - s}V${y + s}`, class: cls }, g);
    for (let i = 0; i <= cols; i += 2) for (let j = 1; j < rows; j += 2) cross(gx[i], gy[j], 4, 'gl-cross');
    if (w > 860) gx.slice(0, -1).forEach((x, i) => { el('text', { x: x + 5, y: 66, class: 'gl-txt' }, g).textContent = String(i + 1).padStart(2, '0'); });
    this.construct = [];
    for (let k = 1; k <= 10; k++) {
      const r = rng(500 + k);
      const pick = (arr) => arr[Math.floor(r() * arr.length)];
      const items = [];
      for (let n = 0; n < 6; n++) {
        const a = [pick(gx), pick(gy)], b = [pick(gx), pick(gy)];
        if (a[0] === b[0] && a[1] === b[1]) continue;
        items.push({ p: el('path', { d: `M${a[0]} ${a[1]}L${b[0]} ${b[1]}`, class: n % 3 === 0 ? 'gl-lime' : 'gl-diag', pathLength: '1' }, g), k: n / 6 });
      }
      const cx = gx[1 + Math.floor(r() * (gx.length - 2))];
      items.push({ p: el('path', { d: `M${cx} 0V${h}`, class: 'gl-lime', pathLength: '1' }, g), k: 0.1 });
      const cy = gy[1 + Math.floor(r() * (gy.length - 2))];
      items.push({ p: el('path', { d: `M0 ${cy}H${w}`, class: 'gl-diag', pathLength: '1' }, g), k: 0.3 });
      for (let n = 0; n < 4; n++) items.push({ p: cross(pick(gx), pick(gy), 9, 'gl-cross gl-cross--lime'), k: 0.5 + n * 0.1, mark: true });
      this.construct.push({ win: [k - 0.08, k + 0.1, k + 0.3, k + 0.5], items });
    }
  }

  resize(w, h, heroTitle) {
    this.w = w; this.h = h;
    this.svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    this.buildGrid(w, h);
    this.gScrib.replaceChildren();
    this.windows = [];
    const r = rng(1234);
    const S = Math.min(w, h);
    const mk = (win, n, seed) => {
      const rr = rng(seed);
      const items = [];
      for (let k = 0; k < n; k++) {
        const x = rr() * w * 0.9, y = h * (0.12 + rr() * 0.76);
        const d = scribble(rr, x - w * 0.1, y, S * (0.25 + rr() * 0.45), (rr() - 0.5) * 0.9, 3 + rr() * 6, S * (0.02 + rr() * 0.05));
        const cls = ['scrib scrib--ink', 'scrib scrib--cyan', 'scrib scrib--accent'][k % 3];
        const p = el('path', { d, class: cls, pathLength: '1', fill: 'none' }, this.gScrib);
        items.push({ p, k: k / n });
      }
      this.windows.push({ win, items });
    };
    mk([2.02, 2.32, 2.5, 2.82], 9, 11);
    mk([4.24, 4.52, 4.66, 4.96], 9, 22);
    mk([9.0, 9.28, 9.42, 9.72], 11, 33);
    void r;

    // Hero: a pen circle around the title and a swoosh under it.
    if (heroTitle) {
      const b = heroTitle.getBoundingClientRect();
      const hr = rng(99);
      const circ = el('path', { d: penCircle(hr, b.left + b.width / 2, b.top + b.height / 2, b.width * 0.56, b.height * 0.95), class: 'scrib scrib--accent scrib--bold', pathLength: '1', fill: 'none' }, this.gScrib);
      const swPts = [];
      for (let i = 0; i <= 20; i++) { const t = i / 20; swPts.push([b.left + b.width * (0.05 + t * 0.9), b.bottom + b.height * 0.25 + Math.sin(t * Math.PI * 1.6) * b.height * 0.12 - t * b.height * 0.1]); }
      const sw = el('path', { d: bezier(swPts), class: 'scrib scrib--cyan', pathLength: '1', fill: 'none' }, this.gScrib);
      this.hero = [circ, sw];
    }
  }

  // Registers a callout set: items { label, index, anchor: () => Vector3, dy, side }.
  addSet(name, items) {
    const set = { items: [], on: false, lastOn: -1 };
    for (const it of items) {
      const div = document.createElement('div');
      div.className = 'callout';
      div.innerHTML = '<span class="callout__k"></span><span class="callout__t"></span>';
      div.querySelector('.callout__k').textContent = it.index;
      div.querySelector('.callout__t').textContent = it.label;
      this.calloutRoot.append(div);
      const path = el('path', { class: 'leader', pathLength: '1', fill: 'none' }, this.gLead);
      const dot = el('circle', { class: 'leader-dot', r: '3.5' }, this.gLead);
      const ring = el('circle', { class: 'leader-ring', r: '9' }, this.gLead);
      set.items.push({ ...it, div, path, dot, ring, wpx: div.offsetWidth || 140 });
    }
    this.sets.set(name, set);
  }

  measure() {
    for (const set of this.sets.values()) for (const it of set.items) it.wpx = it.div.offsetWidth || it.wpx;
  }

  update({ T, time, velocity, camera, reduced, introT, active, avoid = [] }) {
    const { w, h } = this;
    // Flowing ribbons.
    const tt = reduced ? 0 : time;
    const vel = clamp(velocity * 0.00025, -0.35, 0.35);
    const flowOp = 0.18 + 0.5 * Math.max(bump(T, 1.95, 2.15, 2.75, 3.0), bump(T, 4.2, 4.4, 4.85, 5.05), bump(T, 8.95, 9.2, 9.7, 10.0)) + (1 - seg(T, 0.2, 0.7)) * 0.25;
    this.gFlow.style.opacity = flowOp.toFixed(3);
    for (const f of this.flow) {
      const pts = [];
      const base = h * (0.18 + 0.64 * (f.i / 5));
      for (let k = 0; k <= 9; k++) {
        const x = -w * 0.1 + (k / 9) * w * 1.2;
        const y = base + Math.sin(k * 0.8 + tt * (0.35 + f.i * 0.05) + f.i * 1.7) * h * 0.05
          + Math.sin(k * 0.33 - tt * 0.22 + f.i * 2.3) * h * 0.06 + vel * h * Math.sin(k * 0.7 + f.i) * 0.8;
        pts.push([x, y]);
      }
      f.p.setAttribute('d', bezier(pts));
    }

    // Construction guides (scrubbed).
    for (const { win, items } of this.construct) {
      const [a, b, c, d] = win;
      const live = T > a - 0.01 && T < d + 0.01;
      for (const it of items) {
        if (!live) { it.p.style.display = 'none'; continue; }
        const dr = clamp(seg(T, a, b) * 1.5 - it.k * 0.5);
        const er = clamp(seg(T, c, d) * 1.5 - it.k * 0.5);
        const on = dr > 0.001 && er < 0.999;
        it.p.style.display = on ? '' : 'none';
        if (it.mark) { it.p.style.opacity = on ? String(Math.min(dr, 1 - er)) : '0'; continue; }
        it.p.setAttribute('stroke-dasharray', `${Math.max(0, dr - er).toFixed(4)} 2`);
        it.p.setAttribute('stroke-dashoffset', (-er).toFixed(4));
      }
    }

    // Transition scribbles (scrubbed).
    for (const { win, items } of this.windows) {
      const [a, b, c, d] = win;
      const live = T > a - 0.01 && T < d + 0.01;
      for (const it of items) {
        if (!live) { it.p.style.display = 'none'; continue; }
        const dr = clamp(seg(T, a, b) * 1.4 - it.k * 0.4);
        const er = clamp(seg(T, c, d) * 1.4 - it.k * 0.4);
        it.p.style.display = dr > 0.001 && er < 0.999 ? '' : 'none';
        it.p.setAttribute('stroke-dasharray', `${Math.max(0, dr - er).toFixed(4)} 2`);
        it.p.setAttribute('stroke-dashoffset', (-er).toFixed(4));
      }
    }
    if (this.hero) {
      const dr = reduced ? 1 : clamp((introT - 0.9) / 1.1);
      const er = seg(T, 0.12, 0.45);
      this.hero.forEach((p, i) => {
        const d = clamp(dr * 1.3 - i * 0.3), e = clamp(er * 1.3 - i * 0.3);
        p.style.display = d > 0.001 && e < 0.999 ? '' : 'none';
        p.setAttribute('stroke-dasharray', `${Math.max(0, d - e).toFixed(4)} 2`);
        p.setAttribute('stroke-dashoffset', (-e).toFixed(4));
      });
    }

    // Callouts.
    const v = new THREE.Vector3();
    for (const [name, set] of this.sets) {
      const on = active.has(name);
      if (on !== set.on) {
        set.on = on;
        for (const it of set.items) { it.div.classList.toggle('is-on', on); it.path.classList.toggle('is-on', on); it.dot.classList.toggle('is-on', on); it.ring.classList.toggle('is-on', on); }
        if (!on) set.lastOn = time;
      }
      if (!on && time - set.lastOn > 0.8) continue;
      const blocks = avoid.map((r) => [r.left - 10, r.top - 10, r.right + 10, r.bottom + 10]);
      const reach = Math.min(70, w * 0.06), arm = 46;
      const minX = w > 1100 ? 44 : 12, maxX = w - (w > 860 ? 70 : 12), minY = 78, maxY = h - 28;
      const hits = (b) => blocks.some((k) => b[0] < k[2] && b[2] > k[0] && b[1] < k[3] && b[3] > k[1]);
      for (const it of set.items) {
        it.anchor(v);
        v.project(camera);
        it.behind = v.z > 1;
        it.ax = (v.x * 0.5 + 0.5) * w; it.ay = (-v.y * 0.5 + 0.5) * h;
      }
      // Place labels one by one, trying both sides and a few heights; avoid
      // panels, other labels and the viewport edges. A label keeps last
      // frame's slot while it still fits, and glides (never jumps) to a new one.
      const order = [...set.items].sort((a, b) => a.ay - b.ay);
      for (const it of order) {
        const pref = it.side === 'L' ? -1 : it.side === 'R' ? 1 : it.ax < w * 0.5 ? -1 : 1;
        const dy0 = it.dy ?? -40;
        const test = (c) => {
          const ex = it.ax + c.dir * reach, ey = it.ay + c.dy, bx = ex + c.dir * arm;
          const x0 = c.dir > 0 ? bx + 8 : bx - 8 - it.wpx;
          const b = [x0, ey - 12, x0 + it.wpx, ey + 12];
          return { ...c, ex, ey, bx, b, ok: b[0] >= minX && b[2] <= maxX && b[1] >= minY && b[3] <= maxY && !hits(b) };
        };
        let best = it.choice ? test(it.choice) : null;
        if (!best || !best.ok) {
          best = null;
          for (const dir of [pref, -pref]) {
            for (const dy of [dy0, -dy0, dy0 * 1.9, -dy0 * 1.9, dy0 * 2.8]) {
              const r = test({ dir, dy });
              if (r.ok) { best = r; break; }
            }
            if (best) break;
          }
        }
        if (!best) {
          best = test(it.choice || { dir: pref, dy: dy0 });
          best.ey = clamp(best.ey, minY + 12, maxY - 12);
          const shift = Math.max(0, minX - best.b[0]) - Math.max(0, best.b[2] - maxX);
          best.bx += shift;
          best.b = [best.b[0] + shift, best.ey - 12, best.b[2] + shift, best.ey + 12];
        }
        it.choice = { dir: best.dir, dy: best.dy };
        blocks.push([best.b[0] - 4, best.b[1] - 4, best.b[2] + 4, best.b[3] + 4]);
        // Offsets relative to the anchor are smoothed so a slot change is a glide.
        const tx = best.ex - it.ax, ty = best.ey - it.ay, tb = best.bx - it.ax;
        if (it.ox === undefined || !set.on) { it.ox = tx; it.oy = ty; it.ob = tb; it.dirS = best.dir; }
        else { it.ox += (tx - it.ox) * 0.22; it.oy += (ty - it.oy) * 0.22; it.ob += (tb - it.ob) * 0.22; it.dirS += (best.dir - it.dirS) * 0.22; }
        const ex = it.ax + it.ox, ey = it.ay + it.oy, bx = it.ax + it.ob;
        it.path.setAttribute('d', `M${it.ax.toFixed(1)} ${it.ay.toFixed(1)} L${ex.toFixed(1)} ${ey.toFixed(1)} L${bx.toFixed(1)} ${ey.toFixed(1)}`);
        it.dot.setAttribute('cx', it.ax.toFixed(1)); it.dot.setAttribute('cy', it.ay.toFixed(1));
        it.ring.setAttribute('cx', it.ax.toFixed(1)); it.ring.setAttribute('cy', it.ay.toFixed(1));
        const k = (it.dirS + 1) / 2;
        const lx = bx + 8 * (2 * k - 1) - it.wpx * (1 - k);
        it.div.style.transform = `translate3d(${lx.toFixed(1)}px, ${(ey - 11).toFixed(1)}px, 0)`;
        const hide = it.behind ? '0' : '';
        it.div.style.opacity = hide; it.path.style.opacity = hide;
      }
    }
  }
}
