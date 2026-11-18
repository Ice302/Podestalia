// The morphing particle swarm. Every particle has a home on each model
// (carbine → GT3 → ship → vortex → three pedestal models). Samples are sorted
// along each model's sweep axis and paired by rank, so the dissolve front on
// one model and the arrival front on the next stay in lock-step.
import * as THREE from 'three';
import { NOISE } from './materials.js';
import { rng } from '../lib/util.js';

export const TRAVEL = 0.5; // fraction of a morph each particle spends in flight

// Area-weighted surface samples of a kit in root space (home pose).
export function sampleKit(kit, n, rand) {
  const tris = [];
  let total = 0;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (const { mesh, part } of kit.meshes) {
    if (part.weight <= 0) continue;
    const g = mesh.geometry, h = g.attributes.aHome, idx = g.index;
    const count = idx ? idx.count : h.count;
    for (let i = 0; i < count; i += 3) {
      const i0 = idx ? idx.getX(i) : i, i1 = idx ? idx.getX(i + 1) : i + 1, i2 = idx ? idx.getX(i + 2) : i + 2;
      a.fromBufferAttribute(h, i0); b.fromBufferAttribute(h, i1); c.fromBufferAttribute(h, i2);
      const area = b.clone().sub(a).cross(c.clone().sub(a)).length() * 0.5 * part.weight;
      if (area <= 0) continue;
      total += area;
      tris.push({ h, i0, i1, i2, part, cum: total });
    }
  }
  const pos = new Float32Array(n * 3), off = new Float32Array(n * 3), s = new Float32Array(n);
  const axis = kit.uniforms.uAxis.value;
  const v = new THREE.Vector3();
  const offsets = new Map(kit.parts.map((p) => [p, kit.offsetOf(p)]));
  const tmp = [];
  for (let k = 0; k < n; k++) {
    const r = rand() * total;
    let lo = 0, hi = tris.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (tris[mid].cum < r) lo = mid + 1; else hi = mid; }
    const t = tris[lo];
    let u = rand(), w = rand();
    if (u + w > 1) { u = 1 - u; w = 1 - w; }
    a.fromBufferAttribute(t.h, t.i0); b.fromBufferAttribute(t.h, t.i1); c.fromBufferAttribute(t.h, t.i2);
    v.copy(a).addScaledVector(b.sub(a), u).addScaledVector(c.sub(a), w);
    tmp.push({ x: v.x, y: v.y, z: v.z, s: v.dot(axis), o: offsets.get(t.part) });
  }
  tmp.sort((p, q) => p.s - q.s);
  tmp.forEach((p, k) => {
    pos[k * 3] = p.x; pos[k * 3 + 1] = p.y; pos[k * 3 + 2] = p.z;
    off[k * 3] = p.o.x; off[k * 3 + 1] = p.o.y; off[k * 3 + 2] = p.o.z;
    s[k] = p.s;
  });
  kit.quant = s;
  kit.sMin = s[0];
  kit.sMax = s[n - 1];
  return { pos, off };
}

export class Swarm {
  constructor({ count, story, gallery }) {
    const rand = rng(42);
    const [m16, car, ship] = story;
    const A = sampleKit(m16, count, rand);
    const B = sampleKit(car, count, rand);
    const C = sampleKit(ship, count, rand);
    for (const [kit, S] of [[m16, A], [car, B], [ship, C]]) {
      const p = kit.root.position;
      for (let i = 0; i < count; i++) { S.pos[i * 3] += p.x; S.pos[i * 3 + 1] += p.y; S.pos[i * 3 + 2] += p.z; }
    }
    const gal = new Float32Array(count * 3), galRank = new Float32Array(count), seed = new Float32Array(count * 4);
    for (let k = 0; k < 3; k++) {
      const ids = [];
      for (let i = k; i < count; i += 3) ids.push(i);
      const G = sampleKit(gallery[k], ids.length, rand);
      ids.forEach((id, j) => {
        gal.set(G.pos.subarray(j * 3, j * 3 + 3), id * 3);
        galRank[id] = j / Math.max(1, ids.length - 1);
      });
    }
    for (let i = 0; i < count; i++) {
      seed[i * 4] = i / (count - 1);
      seed[i * 4 + 1] = rand();
      seed[i * 4 + 2] = rand();
      seed[i * 4 + 3] = i % 3;
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(A.pos.slice(), 3));
    g.setAttribute('aM16', new THREE.BufferAttribute(A.pos, 3));
    g.setAttribute('aM16Off', new THREE.BufferAttribute(A.off, 3));
    g.setAttribute('aCar', new THREE.BufferAttribute(B.pos, 3));
    g.setAttribute('aCarOff', new THREE.BufferAttribute(B.off, 3));
    g.setAttribute('aShip', new THREE.BufferAttribute(C.pos, 3));
    g.setAttribute('aGal', new THREE.BufferAttribute(gal, 3));
    g.setAttribute('aGalRank', new THREE.BufferAttribute(galRank, 1));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.5, 0), 40);

    this.uniforms = {
      uPhase: { value: 0 }, uTime: { value: 0 }, uW: { value: TRAVEL },
      uExplA: { value: 1 }, uExplB: { value: 1 },
      uStage: { value: new THREE.Matrix4() },
      uGal0: { value: new THREE.Matrix4() }, uGal1: { value: new THREE.Matrix4() }, uGal2: { value: new THREE.Matrix4() },
      uVortex: { value: new THREE.Vector3(0, 0.6, 0) }, uSpin: { value: 0 },
      uSize: { value: 0.0085 }, uScale: { value: 500 }, uIntensity: { value: 1 }, uSwirl: { value: 1 },
      uColA: { value: new THREE.Color(0xe4f59a) }, uColB: { value: new THREE.Color(0xff6a2a) },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: VERT,
      fragmentShader: FRAG,
    });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    this.count = count;
  }

  set phase(v) {
    this.uniforms.uPhase.value = Math.min(3.9999, Math.max(0, v));
    const f = v - Math.floor(v);
    this.points.visible = (f > 0.0005 && f < 0.9995) || (v > 2.9 && v < 3.999);
  }
}

const VERT = /* glsl */ `
attribute vec3 aM16; attribute vec3 aM16Off; attribute vec3 aCar; attribute vec3 aCarOff;
attribute vec3 aShip; attribute vec3 aGal; attribute float aGalRank; attribute vec4 aSeed;
uniform float uPhase; uniform float uTime; uniform float uW; uniform float uExplA; uniform float uExplB;
uniform mat4 uStage; uniform mat4 uGal0; uniform mat4 uGal1; uniform mat4 uGal2;
uniform vec3 uVortex; uniform float uSpin; uniform float uSize; uniform float uScale; uniform float uSwirl;
uniform vec3 uColA; uniform vec3 uColB;
varying float vAlpha; varying vec3 vColor;
${NOISE}
vec3 vortex() {
  float arm = aSeed.w;
  float r = 1.1 + pow(aSeed.y, 0.7) * 4.2;
  float ang = arm * 2.0944 + r * 0.85 + (aSeed.z - 0.5) * 0.9 + uSpin * (0.45 + 1.4 / r);
  float h = (aSeed.z - 0.5) * 0.5 + sin(ang * 3.0 + aSeed.y * 9.0) * 0.12 + (aSeed.x - 0.5) * 0.25;
  return uVortex + vec3(cos(ang) * r, h, sin(ang) * r * 0.82);
}
vec3 galPos() {
  vec4 p = vec4(aGal, 1.0);
  if (aSeed.w < 0.5) return (uGal0 * p).xyz;
  if (aSeed.w < 1.5) return (uGal1 * p).xyz;
  return (uGal2 * p).xyz;
}
void main() {
  float ph = uPhase;
  float m = fract(ph);
  float rank = aSeed.x;
  vec3 a; vec3 b; float alpha;
  if (ph < 1.0) {
    a = (uStage * vec4(aM16 + aM16Off * uExplA, 1.0)).xyz;
    b = (uStage * vec4(aCar + aCarOff * uExplB, 1.0)).xyz;
  } else if (ph < 2.0) {
    a = (uStage * vec4(aCar + aCarOff * uExplA, 1.0)).xyz;
    b = (uStage * vec4(aShip, 1.0)).xyz;
  } else if (ph < 3.0) {
    a = (uStage * vec4(aShip, 1.0)).xyz;
    b = vortex();
  } else {
    a = vortex();
    b = galPos();
    rank = aGalRank;
  }
  float t = clamp((m - rank * (1.0 - uW)) / uW, 0.0, 1.0);
  if (ph < 2.0) alpha = smoothstep(0.0, 0.05, t) * (1.0 - smoothstep(0.93, 1.0, t));
  else if (ph < 3.0) alpha = smoothstep(0.0, 0.05, t);
  else alpha = 1.0 - smoothstep(0.7, 1.0, t);
  float e = t * t * (3.0 - 2.0 * t);
  vec3 p = mix(a, b, e);
  float arc = sin(3.14159 * t);
  vec3 q = p * 0.55 + vec3(aSeed.y * 10.0, uTime * 0.15, aSeed.z * 10.0);
  vec3 flow = vec3(snoise(q), snoise(q + 17.3), snoise(q + 41.1));
  p += flow * arc * 0.9 * uSwirl;
  p.y += arc * (0.4 + aSeed.y * 0.9) * uSwirl;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float sz = uSize * (0.45 + aSeed.z * 1.1) * (1.0 + arc * 1.2);
  gl_PointSize = clamp(sz * uScale / -mv.z, 0.0, 14.0);
  vAlpha = alpha;
  vColor = mix(uColA, uColB, step(0.86, aSeed.y)) * (0.5 + arc * 0.9);
}`;

const FRAG = /* glsl */ `
uniform float uIntensity;
varying float vAlpha; varying vec3 vColor;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float a = smoothstep(0.5, 0.0, d);
  a *= a;
  if (a * vAlpha < 0.003) discard;
  gl_FragColor = vec4(vColor * uIntensity, a * vAlpha);
}`;
