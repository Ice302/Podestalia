// A Kit is a model made of independently movable parts. It owns the shared
// reveal uniforms, builds blueprint edge lines, bakes home positions (aHome)
// and knows how to explode / reassemble itself.
import * as THREE from 'three';
import { patchMaterial, edgeMaterial } from '../fx/materials.js';
import { clamp, easeInOut, rng } from '../lib/util.js';

const BIG = 1e4;

export class Kit {
  constructor(name, { axis = [-1, 0, 0], seed = 7, edge = 0xd8f23e } = {}) {
    this.name = name;
    this.root = new THREE.Group();
    this.root.name = name;
    this.inner = new THREE.Group();
    this.root.add(this.inner);
    this.parts = [];
    this.materials = [];
    this.meshes = [];
    this.lines = [];
    this.rand = rng(seed);
    this.explode = 0;
    this.stagger = 0.45;
    this.uniforms = {
      uShow: { value: BIG }, uHide: { value: -BIG }, uAxis: { value: new THREE.Vector3(...axis) },
      uNoiseAmp: { value: 0.1 }, uNoiseFreq: { value: 2.4 }, uEdgeWidth: { value: 0.07 },
      uEdgeColor: { value: new THREE.Color(edge) }, uRim: { value: 0 }, uRimColor: { value: new THREE.Color(edge) },
      uActive: { value: 0 }, uTime: { value: 0 }, uGlow: { value: 1 },
      uLead: { value: 0.6 }, uLineBase: { value: 0 }, uLineGlow: { value: 1.4 }, uWire: { value: 0 },
    };
    this.edgeMat = edgeMaterial(this.uniforms);
  }

  material(params, { physical = false, patch } = {}) {
    const M = physical ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
    const m = new M(params);
    m.polygonOffset = true;
    m.polygonOffsetFactor = 1.5;
    m.polygonOffsetUnits = 3;
    patchMaterial(m, this.uniforms, patch);
    this.materials.push(m);
    return m;
  }

  mesh(geo, mat) {
    return new THREE.Mesh(geo, mat);
  }

  // explode: offset in build units; delay ∈ [0,1] staggers the motion.
  part(name, objs, { explode = [0, 0, 0], spin = 0.5, delay, label = null, weight = 1, edges = true } = {}) {
    const g = new THREE.Group();
    g.name = name;
    for (const o of [].concat(objs)) g.add(o);
    this.inner.add(g);
    const r = this.rand;
    const axis = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize();
    const p = { name, obj: g, explode: new THREE.Vector3(...explode), axis, spin, delay: delay ?? r(), label, weight, edges };
    this.parts.push(p);
    return p;
  }

  find(name) {
    return this.parts.find((p) => p.name === name);
  }

  finalize({ scale = 1, alignY = 'center', y = 0, edgeAngle = 28 } = {}) {
    this.scale = scale;
    this.inner.scale.setScalar(scale);
    this.root.updateMatrixWorld(true);
    const tmp = new THREE.Vector3();
    const inv = new THREE.Matrix4().copy(this.inner.matrixWorld).invert();

    // Re-centre each part on its own bounds so spins pivot about the part.
    for (const p of this.parts) {
      p.obj.updateMatrixWorld(true);
      // setFromObject is in world space; inner is scaled — convert back.
      const b = new THREE.Box3().setFromObject(p.obj);
      const c = b.getCenter(tmp).applyMatrix4(inv);
      for (const ch of p.obj.children) ch.position.sub(c);
      p.obj.position.copy(c);
      p.center = c.clone();
    }

    this.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.inner);
    const c = box.getCenter(new THREE.Vector3());
    this.inner.position.x -= c.x;
    this.inner.position.z -= c.z;
    if (alignY === 'center') this.inner.position.y -= c.y;
    else if (alignY === 'bottom') this.inner.position.y -= box.min.y;
    this.inner.position.y += y;
    this.root.updateMatrixWorld(true);

    for (const p of this.parts) {
      p.homePos = p.obj.position.clone();
      p.homeQuat = p.obj.quaternion.clone();
    }

    const rootInv = new THREE.Matrix4().copy(this.root.matrixWorld).invert();
    const seen = new Set();
    let tris = 0;
    this.parts.forEach((p, pi) => {
      p.obj.traverse((o) => {
        if (!o.isMesh) return;
        if (seen.has(o.geometry)) o.geometry = o.geometry.clone();
        seen.add(o.geometry);
        const g = o.geometry;
        const m = new THREE.Matrix4().multiplyMatrices(rootInv, o.matrixWorld);
        g.setAttribute('aHome', bakeHome(g.attributes.position, m));
        const t = (g.index ? g.index.count : g.attributes.position.count) / 3;
        tris += t;
        p.tris = (p.tris || 0) + t;
        this.meshes.push({ mesh: o, part: p, partIndex: pi, matrix: m });
        if (p.edges) {
          const eg = new THREE.EdgesGeometry(g, edgeAngle);
          eg.setAttribute('aHome', bakeHome(eg.attributes.position, m));
          const line = new THREE.LineSegments(eg, this.edgeMat);
          line.raycast = () => {};
          line.visible = false;
          o.add(line);
          this.lines.push(line);
        }
      });
    });

    this.box = new THREE.Box3().setFromObject(this.inner);
    this.size = this.box.getSize(new THREE.Vector3());
    this.stats = { parts: this.parts.length, meshes: this.meshes.length, triangles: Math.round(tris), materials: this.materials.length };
    return this;
  }

  // Exploded offset of a part in root space (used by the particle mapping).
  offsetOf(part) {
    return part.explode.clone().multiplyScalar(this.scale);
  }

  setExplode(e) {
    this.explode = e;
    const S = this.stagger;
    const q = new THREE.Quaternion();
    for (const p of this.parts) {
      const k = easeInOut(clamp((e - p.delay * S) / (1 - S)));
      p.obj.position.copy(p.homePos).addScaledVector(p.explode, k);
      q.setFromAxisAngle(p.axis, Math.sin(Math.PI * k) * p.spin);
      p.obj.quaternion.copy(p.homeQuat).multiply(q);
    }
  }

  // show/hide fronts in sweep units; null = fully shown / not hidden.
  setReveal(show = null, hide = null) {
    const u = this.uniforms;
    u.uShow.value = show ?? BIG;
    u.uHide.value = hide ?? -BIG;
    u.uActive.value = show !== null || hide !== null ? 1 : 0;
  }

  get hidden() {
    const u = this.uniforms;
    return u.uShow.value <= this.sMin - 1 || u.uHide.value >= this.sMax + 1;
  }

  updateLines() {
    const u = this.uniforms;
    const on = u.uActive.value > 0.5 || u.uRim.value > 0.01 || u.uWire.value > 0.01 || u.uLineBase.value > 0.01;
    for (const l of this.lines) l.visible = on;
  }

  // Sweep-front helpers — filled in by the particle sampler (quantile table).
  frontAt(q) {
    const s = this.quant;
    if (!s) return 0;
    const pad = this.uniforms.uNoiseAmp.value + this.uniforms.uEdgeWidth.value + 0.02;
    if (q <= 0) return s[0] - pad;
    if (q >= 1) return s[s.length - 1] + pad;
    const f = q * (s.length - 1), i = Math.floor(f);
    return s[i] + (s[Math.min(s.length - 1, i + 1)] - s[i]) * (f - i);
  }

  worldOf(part, target = new THREE.Vector3()) {
    return part.obj.getWorldPosition(target);
  }
}

function bakeHome(posAttr, m) {
  const v = new THREE.Vector3();
  const out = new Float32Array(posAttr.count * 3);
  for (let i = 0; i < posAttr.count; i++) {
    v.fromBufferAttribute(posAttr, i).applyMatrix4(m);
    out[i * 3] = v.x; out[i * 3 + 1] = v.y; out[i * 3 + 2] = v.z;
  }
  return new THREE.BufferAttribute(out, 3);
}
