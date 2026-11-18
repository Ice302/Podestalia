// Procedural geometry toolkit: profile extrusions, superellipse lofts, strokes,
// smooth tables. Everything the three models are carved from.
import * as THREE from 'three';
import { mergeGeometries, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

// Monotone cubic interpolation through [[x, v], ...] (no overshoot bulges).
export function table(pairs) {
  const n = pairs.length;
  const xs = pairs.map((p) => p[0]);
  const vs = pairs.map((p) => p[1]);
  const d = [];
  for (let k = 0; k < n - 1; k++) d.push((vs[k + 1] - vs[k]) / (xs[k + 1] - xs[k]));
  const m = new Array(n);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let k = 1; k < n - 1; k++) m[k] = d[k - 1] * d[k] <= 0 ? 0 : (d[k - 1] + d[k]) / 2;
  for (let k = 0; k < n - 1; k++) {
    if (d[k] === 0) { m[k] = 0; m[k + 1] = 0; continue; }
    const a = m[k] / d[k], b = m[k + 1] / d[k], s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[k] = t * a * d[k]; m[k + 1] = t * b * d[k]; }
  }
  return (x) => {
    if (x <= xs[0]) return vs[0];
    if (x >= xs[n - 1]) return vs[n - 1];
    let k = 0;
    while (x > xs[k + 1]) k++;
    const h = xs[k + 1] - xs[k], t = (x - xs[k]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * vs[k] + (t3 - 2 * t2 + t) * h * m[k] + (-2 * t3 + 3 * t2) * vs[k + 1] + (t3 - t2) * h * m[k + 1];
  };
}

export function shapeFrom(points) {
  const s = new THREE.Shape();
  s.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) s.lineTo(points[i][0], points[i][1]);
  s.closePath();
  return s;
}

export function arc(cx, cy, r, a0, a1, n = 16) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + (a1 - a0) * (i / n);
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

export function quad(p0, p1, p2, n = 16) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    pts.push([u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]]);
  }
  return pts;
}

// Offsets a 2D polyline into a closed ribbon shape of width w0 → w1.
export function strokeShape(pts, w0, w1 = w0) {
  const L = [], R = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    dx /= l; dy /= l;
    const w = (w0 + (w1 - w0) * (i / (pts.length - 1))) / 2;
    L.push([pts[i][0] - dy * w, pts[i][1] + dx * w]);
    R.push([pts[i][0] + dy * w, pts[i][1] - dx * w]);
  }
  return shapeFrom([...L, ...R.reverse()]);
}

// Hash-safe creased normals: toCreasedNormals hashes at 0.01 units, so tiny
// geometry is scaled up first.
export function creased(g, angle = 0.62, unit = 1) {
  if (unit !== 1) g.scale(unit, unit, unit);
  const out = toCreasedNormals(g, angle);
  if (unit !== 1) out.scale(1 / unit, 1 / unit, 1 / unit);
  return out;
}

// Scales an un-creased extrusion's z by s(x, y), then gives the flat side caps
// analytic normals so their long sliver triangles shade as one smooth surface.
export function warpExtrusion(g, s, { crease = 0.7, unit = 1 } = {}) {
  const p = g.attributes.position, n = g.attributes.normal;
  const cap = new Int8Array(p.count), z0 = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    const nz = n.getZ(i);
    cap[i] = Math.abs(nz) > 0.999 ? Math.sign(nz) : 0;
    z0[i] = p.getZ(i);
    p.setZ(i, z0[i] * s(p.getX(i), p.getY(i)));
  }
  const out = creased(g, crease, unit);
  const on = out.attributes.normal, op = out.attributes.position;
  const e = 1e-3;
  for (let i = 0; i < op.count; i++) {
    if (!cap[i]) continue;
    const x = op.getX(i), y = op.getY(i), c = z0[i];
    const sx = (s(x + e, y) - s(x - e, y)) / (2 * e), sy = (s(x, y + e) - s(x, y - e)) / (2 * e);
    const nx = -c * sx * cap[i], ny = -c * sy * cap[i], nz = cap[i];
    const l = Math.hypot(nx, ny, nz);
    on.setXYZ(i, nx / l, ny / l, nz / l);
  }
  on.needsUpdate = true;
  return out;
}

// Side-profile extrusion centred on z = 0.
export function extrude(shapeOrPts, depth, opt = {}) {
  const { bevel = 0, bevelSize = bevel * 0.7, bevelSeg = 3, curveSeg = 12, crease = 0.62, unit = 1 } = opt;
  const shape = Array.isArray(shapeOrPts) ? shapeFrom(shapeOrPts) : shapeOrPts;
  const g = new THREE.ExtrudeGeometry(shape, {
    depth, steps: 1, curveSegments: curveSeg,
    bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize, bevelSegments: bevelSeg,
  });
  g.translate(0, 0, -depth / 2);
  g.deleteAttribute('uv');
  return crease ? creased(g, crease, unit) : g;
}

// Plan-view extrusion: shape drawn in (x, z), extruded upward along +y.
export function extrudeUp(shapeOrPts, height, y0 = 0, opt = {}) {
  const g = extrude(shapeOrPts, height, { ...opt, crease: 0 });
  g.translate(0, 0, height / 2);
  g.rotateX(Math.PI / 2); // (x, y, z) → (x, -z, y)
  g.translate(0, height + y0, 0);
  return opt.crease === 0 ? g : creased(g, opt.crease ?? 0.62, opt.unit ?? 1);
}

export function box(x0, x1, y0, y1, z0, z1) {
  const g = new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0));
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return g;
}

// Cylinder whose axis runs along +x from x0 to x1.
export function cylX(x0, x1, r0, r1 = r0, y = 0, z = 0, seg = 32, open = false) {
  const g = new THREE.CylinderGeometry(r1, r0, x1 - x0, seg, 1, open);
  g.rotateZ(-Math.PI / 2);
  g.translate((x0 + x1) / 2, y, z);
  return g;
}

export function cylY(y0, y1, r0, r1 = r0, x = 0, z = 0, seg = 32) {
  const g = new THREE.CylinderGeometry(r1, r0, y1 - y0, seg);
  g.translate(x, (y0 + y1) / 2, z);
  return g;
}

export function cylZ(z0, z1, r0, r1 = r0, x = 0, y = 0, seg = 32) {
  const g = new THREE.CylinderGeometry(r1, r0, z1 - z0, seg);
  g.rotateX(Math.PI / 2);
  g.translate(x, y, (z0 + z1) / 2);
  return g;
}

// Superellipse loft along x. section(x) → { hw, top, bot, mid, nTop, nBot, tumble, flare }.
export function loft({ x0, x1, rings = 80, seg = 48, section, deform, caps = true }) {
  const pos = [], idx = [];
  const ringPts = [];
  for (let i = 0; i <= rings; i++) {
    const x = x0 + (x1 - x0) * (i / rings);
    const s = section(x);
    const ring = [];
    for (let j = 0; j <= seg; j++) {
      const th = -Math.PI / 2 + (j / seg) * Math.PI * 2;
      const c = Math.cos(th), sn = Math.sin(th), up = sn >= 0;
      const n = up ? s.nTop : s.nBot;
      let z = s.hw * Math.sign(c) * Math.pow(Math.abs(c), 2 / n);
      const hh = up ? s.top - s.mid : s.mid - s.bot;
      const y = s.mid + hh * Math.sign(sn) * Math.pow(Math.abs(sn), 2 / n);
      if (up) {
        const yn = (y - s.mid) / Math.max(1e-6, s.top - s.mid);
        z *= (1 - (s.tumble || 0) * yn * yn) * (1 + (s.flare || 0) * yn);
      }
      let p = [x, y, z];
      if (deform) p = deform(p, s);
      ring.push(p);
      pos.push(p[0], p[1], p[2]);
    }
    ringPts.push(ring);
  }
  const W = seg + 1;
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < seg; j++) {
      const a = i * W + j, b = a + W;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  if (caps) {
    for (const [ri, flip] of [[0, false], [rings, true]]) {
      const ring = ringPts[ri];
      const c = ring.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]], [0, 0, 0]).map((v) => v / ring.length);
      const base = pos.length / 3;
      pos.push(...c);
      for (const p of ring) pos.push(...p);
      for (let j = 0; j < seg; j++) {
        if (flip) idx.push(base, base + 2 + j, base + 1 + j);
        else idx.push(base, base + 1 + j, base + 2 + j);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function helix({ x0, x1, r, turns, wire, y = 0, z = 0, seg = 640 }) {
  const pts = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, a = t * turns * Math.PI * 2;
    pts.push(new THREE.Vector3(x0 + (x1 - x0) * t, y + Math.cos(a) * r, z + Math.sin(a) * r));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), seg, wire, 6, false);
}

export function tube(points, radius, seg = 120, radial = 10) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  return new THREE.TubeGeometry(curve, seg, radius, radial, false);
}

// Merges geometries of mixed provenance (indexed / not, with / without uv).
export function merge(geos) {
  const prepared = geos.map((g) => {
    let h = g.index ? g.toNonIndexed() : g;
    for (const name of Object.keys(h.attributes)) if (name !== 'position' && name !== 'normal') h.deleteAttribute(name);
    if (!h.attributes.normal) h.computeVertexNormals();
    return h;
  });
  return mergeGeometries(prepared, false);
}

// Applies f(x, y, z) → [x, y, z] to every vertex, then recomputes normals.
export function warp(g, f) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const [x, y, z] = f(p.getX(i), p.getY(i), p.getZ(i));
    p.setXYZ(i, x, y, z);
  }
  p.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

export function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
