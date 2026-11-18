// Screen-space "fat" polylines with draw-on, erase and travelling pulses.
// Used for aero streamlines, orbit rings, the finale vortex ribbons and the
// light trails that lead particles to each pedestal.
import * as THREE from 'three';
import { bodyHalfWidth, bodyTop } from '../models/gt3.js';
import { rng } from '../lib/util.js';

export class FatLines extends THREE.Mesh {
  constructor(polylines, opt = {}) {
    const {
      width = 2, colorA = 0x8eeaff, colorB = 0xffffff, base = 0.18, pulse = 1, pulseFreq = 2, speed = 0.25,
      opacity = 1, seed = 1, blending = THREE.AdditiveBlending,
    } = opt;
    const pos = [], prev = [], next = [], side = [], u = [], sd = [], idx = [];
    const r = rng(seed);
    let base0 = 0;
    for (const line of polylines) {
      const n = line.length;
      const s = r();
      for (let i = 0; i < n; i++) {
        const p = line[i], a = line[Math.max(0, i - 1)], b = line[Math.min(n - 1, i + 1)];
        for (const sgn of [-1, 1]) {
          pos.push(p.x, p.y, p.z); prev.push(a.x, a.y, a.z); next.push(b.x, b.y, b.z);
          side.push(sgn); u.push(i / (n - 1)); sd.push(s);
        }
      }
      for (let i = 0; i < n - 1; i++) {
        const k = base0 + i * 2;
        idx.push(k, k + 1, k + 2, k + 2, k + 1, k + 3);
      }
      base0 += n * 2;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aPrev', new THREE.Float32BufferAttribute(prev, 3));
    g.setAttribute('aNext', new THREE.Float32BufferAttribute(next, 3));
    g.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 1));
    g.setAttribute('aU', new THREE.Float32BufferAttribute(u, 1));
    g.setAttribute('aSeed', new THREE.Float32BufferAttribute(sd, 1));
    g.setIndex(idx);
    g.computeBoundingSphere();
    const uniforms = {
      uRes: { value: new THREE.Vector2(1, 1) }, uWidth: { value: width }, uTime: { value: 0 },
      uOpacity: { value: opacity }, uDraw: { value: 1 }, uErase: { value: 0 },
      uColorA: { value: new THREE.Color(colorA) }, uColorB: { value: new THREE.Color(colorB) },
      uBase: { value: base }, uPulse: { value: pulse }, uPulseFreq: { value: pulseFreq }, uSpeed: { value: speed },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms, transparent: true, depthWrite: false, blending, side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        attribute vec3 aPrev; attribute vec3 aNext; attribute float aSide; attribute float aU; attribute float aSeed;
        uniform vec2 uRes; uniform float uWidth;
        varying float vU; varying float vSeed; varying float vSide;
        void main(){
          mat4 mvp = projectionMatrix * modelViewMatrix;
          vec4 c = mvp * vec4(position, 1.0);
          vec4 p = mvp * vec4(aPrev, 1.0);
          vec4 n = mvp * vec4(aNext, 1.0);
          vec2 asp = vec2(uRes.x / uRes.y, 1.0);
          vec2 cs = c.xy / max(c.w, 1e-4) * asp, ps = p.xy / max(p.w, 1e-4) * asp, ns = n.xy / max(n.w, 1e-4) * asp;
          vec2 d1 = ns - cs, d0 = cs - ps;
          vec2 dir = length(d1) > 1e-6 ? normalize(d1) : normalize(d0 + vec2(1e-6));
          if (length(d0) > 1e-6 && length(d1) > 1e-6) dir = normalize(normalize(d0) + normalize(d1) + vec2(1e-6));
          vec2 nrm = vec2(-dir.y, dir.x);
          float taper = smoothstep(0.0, 0.08, aU) * (1.0 - smoothstep(0.9, 1.0, aU)) * 0.55 + 0.45;
          vec2 off = nrm * (uWidth * taper / uRes.y);
          off.x /= asp.x;
          c.xy += off * aSide * c.w;
          gl_Position = c;
          vU = aU; vSeed = aSeed; vSide = aSide;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform float uOpacity; uniform float uDraw; uniform float uErase;
        uniform vec3 uColorA; uniform vec3 uColorB; uniform float uBase; uniform float uPulse; uniform float uPulseFreq; uniform float uSpeed;
        varying float vU; varying float vSeed; varying float vSide;
        void main(){
          float draw = uDraw * 1.08 - vSeed * 0.08;
          if (vU > draw || vU < uErase * 1.08 - vSeed * 0.08) discard;
          float edge = 1.0 - smoothstep(0.35, 1.0, abs(vSide));
          float head = smoothstep(draw - 0.06, draw, vU) * (1.0 - smoothstep(0.96, 1.0, uDraw));
          float f = fract(vU * uPulseFreq - uTime * uSpeed + vSeed * 7.0);
          float pulse = smoothstep(0.0, 0.03, f) * (1.0 - smoothstep(0.03, 0.32, f));
          float ends = smoothstep(0.0, 0.04, vU) * (1.0 - smoothstep(0.96, 1.0, vU));
          float a = (uBase + pulse * uPulse + head * 1.6) * ends * edge * uOpacity;
          if (a < 0.003) discard;
          vec3 col = mix(uColorA, uColorB, pulse * 0.7 + head) * (1.0 + head * 2.0 + pulse * 1.5);
          gl_FragColor = vec4(col, min(a, 1.0));
        }`,
    });
    super(g, mat);
    this.uniforms = uniforms;
    this.renderOrder = 4;
  }

  set opacity(v) {
    this.uniforms.uOpacity.value = v;
    this.visible = v > 0.002 && this.uniforms.uDraw.value > 0.001;
  }
}

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Wind-tunnel streamlines that pour over the GT3's real envelope.
export function aeroLines(count = 64, seed = 3) {
  const r = rng(seed);
  const lines = [];
  const wingTop = (x) => (x < -1.86 && x > -2.32 ? 1.46 : 0);
  for (let k = 0; k < count; k++) {
    const y0 = 0.22 + r() * 1.25;
    const z0 = (r() * 2 - 1) * 1.15;
    const xs = [], ys = [], zs = [];
    for (let x = 3.4; x >= -5.2; x -= 0.05) {
      let y = y0, z = z0;
      const inLen = x < 2.42 && x > -2.45;
      if (inLen) {
        const top = Math.max(bodyTop(x), wingTop(x)) + 0.06;
        const hw = bodyHalfWidth(x) + 0.08;
        const needUp = top - y, needOut = hw - Math.abs(z);
        if (needUp > 0 && needOut > 0) {
          if (needUp < needOut * 1.6) y = top;
          else z = Math.sign(z || 1) * hw;
        }
      }
      xs.push(x); ys.push(y); zs.push(z);
    }
    // Downwash behind the tail.
    for (let i = 0; i < xs.length; i++) if (xs[i] < -2.4) ys[i] -= Math.min(0.35, (-2.4 - xs[i]) * 0.12) * (ys[i] > 0.9 ? 1 : 0.3);
    smoothArr(ys, 7, 4); smoothArr(zs, 7, 4);
    lines.push(xs.map((x, i) => V(x, ys[i], zs[i])));
  }
  return lines;
}

function smoothArr(a, radius, passes) {
  for (let p = 0; p < passes; p++) {
    const src = a.slice();
    for (let i = 0; i < a.length; i++) {
      let s = 0, w = 0;
      for (let j = -radius; j <= radius; j++) {
        const k = Math.min(a.length - 1, Math.max(0, i + j));
        const wt = radius + 1 - Math.abs(j);
        s += src[k] * wt; w += wt;
      }
      a[i] = s / w;
    }
  }
}

// Tilted orbit ellipses for the hero "pop".
export function orbitRings() {
  const out = [];
  const specs = [[2.9, 0.9, 0.35, 0.2], [3.3, 1.2, -0.5, 1.1], [2.5, 0.7, 0.9, 2.2], [3.8, 1.5, 0.15, 3.0]];
  for (const [a, b, tilt, rot] of specs) {
    const pts = [];
    for (let i = 0; i <= 200; i++) {
      const t = (i / 200) * Math.PI * 2;
      const p = V(Math.cos(t) * a, Math.sin(t) * b * 0.4, Math.sin(t) * b);
      p.applyAxisAngle(V(1, 0, 0), tilt).applyAxisAngle(V(0, 1, 0), rot);
      pts.push(p);
    }
    out.push(pts);
  }
  return out;
}

// Finale: spiral ribbons orbiting the vortex.
export function vortexRibbons(count = 70, seed = 9) {
  const r = rng(seed);
  const out = [];
  for (let k = 0; k < count; k++) {
    const R = 1.2 + r() * 4.6, turns = 0.6 + r() * 1.3, a0 = r() * Math.PI * 2, y0 = 0.6 + (r() - 0.5) * 1.4;
    const pts = [];
    for (let i = 0; i <= 160; i++) {
      const t = i / 160, a = a0 + t * turns * Math.PI * 2;
      const rr = R * (1 - 0.35 * t);
      pts.push(V(Math.cos(a) * rr, y0 + Math.sin(t * Math.PI * 2 + k) * 0.35 + t * 0.3, Math.sin(a) * rr * 0.82));
    }
    out.push(pts);
  }
  return out;
}

// Meridian / latitude lines of a wireframe globe around the vortex.
export function globeLines(radius = 3.4) {
  const out = [];
  for (let k = 0; k < 10; k++) {
    const pts = [], ang = (k / 10) * Math.PI;
    for (let i = 0; i <= 120; i++) {
      const t = (i / 120) * Math.PI * 2;
      pts.push(V(Math.cos(t) * radius, Math.sin(t) * radius, 0).applyAxisAngle(V(0, 1, 0), ang).add(V(0, 0.6, 0)));
    }
    out.push(pts);
  }
  for (const lat of [-0.6, -0.3, 0, 0.3, 0.6]) {
    const pts = [], rr = Math.cos(lat) * radius, y = Math.sin(lat) * radius;
    for (let i = 0; i <= 120; i++) { const t = (i / 120) * Math.PI * 2; pts.push(V(Math.cos(t) * rr, y + 0.6, Math.sin(t) * rr)); }
    out.push(pts);
  }
  return out;
}

// Arcs from the vortex heart down to each pedestal top.
export function pedestalArcs(tops, perPedestal = 9, seed = 5) {
  const r = rng(seed);
  const out = [];
  for (const top of tops) {
    for (let k = 0; k < perPedestal; k++) {
      const start = V((r() - 0.5) * 1.2, 0.6 + (r() - 0.5) * 0.6, (r() - 0.5) * 1.2);
      const ctrl = start.clone().lerp(top, 0.5).add(V((r() - 0.5) * 2, 1.8 + r() * 1.6, (r() - 0.5) * 2));
      const end = top.clone().add(V((r() - 0.5) * 0.5, 0.25, (r() - 0.5) * 0.5));
      const curve = new THREE.QuadraticBezierCurve3(start, ctrl, end);
      out.push(curve.getPoints(90));
    }
  }
  return out;
}

// Radial burst from the centre when the pedestals rise.
export function burstLines(count = 48, seed = 11) {
  const r = rng(seed);
  const out = [];
  for (let k = 0; k < count; k++) {
    const a = (k / count) * Math.PI * 2 + r() * 0.1, el = (r() - 0.3) * 0.6;
    const dir = V(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el));
    const len = 4 + r() * 6;
    const pts = [];
    for (let i = 0; i <= 30; i++) pts.push(dir.clone().multiplyScalar(0.6 + (i / 30) * len).add(V(0, 0.6, 0)));
    out.push(pts);
  }
  return out;
}
