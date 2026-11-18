// GT3-class race car. Units: metres, nose toward +x, ground at y = 0.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { table, extrude, extrudeUp, strokeShape, box, cylX, cylZ, merge, arc, warp, creased, warpExtrusion, canvasTexture } from '../lib/geo.js';
import { NOISE } from '../fx/materials.js';

export const GT3_INFO = {
  id: 'gt3',
  title: 'GT3',
  full: 'GT3 Race Car',
  blurb: 'Clearcoat paint, a swan-neck wing, center-lock wheels and an aero package. The parts lock together like a pit-stop.',
  real: { length: '4.57 m', weight: '1,450 kg', note: 'Fictional livery' },
};

export const PAINTS = [
  { name: 'Lava Orange', hex: 0xff4d12 },
  { name: 'Shark Blue', hex: 0x1f5fd6 },
  { name: 'GT Silver', hex: 0xb9bec4 },
  { name: 'Racing Yellow', hex: 0xf3c21b },
  { name: 'Jet Black', hex: 0x0d0e10 },
];

// Body details drawn in the paint shader (all in body build space), so panel
// gaps, louvres, intakes and grilles sit exactly on the surface.
const GT3_DETAIL = /* glsl */ `
float gtDark = 0.0, gtMesh = 0.0;
{
  vec3 p = vLocal; vec3 n = vObjN; float az = abs(p.z);
  float side = smoothstep(0.5, 0.7, abs(n.z));
  float topS = smoothstep(0.5, 0.7, n.y);
  float frontS = smoothstep(0.35, 0.55, n.x);
  float rearS = smoothstep(0.35, 0.55, -n.x);
  float gw = 0.0045;
  float yd = step(0.27, p.y) * step(p.y, 0.93);
  float doorF = 1.0 - smoothstep(0.0, gw, abs(p.x - 0.74 + (p.y - 0.3) * 0.08));
  float doorR = 1.0 - smoothstep(0.0, gw, abs(p.x + 0.5 + (p.y - 0.3) * 0.32));
  float doorB = (1.0 - smoothstep(0.0, gw, abs(p.y - 0.29))) * step(-0.5, p.x) * step(p.x, 0.75);
  float gaps = side * max(max(doorF, doorR) * yd, doorB);
  float hood = topS * (1.0 - smoothstep(0.0, gw, abs(p.x - 1.04))) * step(az, 0.58);
  float hoodS = topS * (1.0 - smoothstep(0.0, gw, abs(az - 0.58))) * step(1.04, p.x) * step(p.x, 2.0);
  float lv = topS * step(1.32, p.x) * step(p.x, 1.7) * step(0.1, az) * step(az, 0.42) * step(0.55, fract(p.x * 44.0));
  float flv = topS * step(1.06, p.x) * step(p.x, 1.48) * step(0.6, az) * step(az, 0.76) * step(0.5, fract(p.x * 34.0));
  float dlv = topS * step(-2.24, p.x) * step(p.x, -1.98) * step(az, 0.5) * step(0.5, fract(p.x * 46.0));
  float ix = p.x + 0.6 + (p.y - 0.45) * 0.55;
  float intake = side * step(0.0, ix) * step(ix, 0.3) * step(0.43, p.y) * step(p.y, 0.68);
  float fi = frontS * min(1.0, step(az, 0.33) * step(0.19, p.y) * step(p.y, 0.33) + step(0.43, az) * step(az, 0.66) * step(0.19, p.y) * step(p.y, 0.37));
  float rg = rearS * step(az, 0.6) * step(0.23, p.y) * step(p.y, 0.5);
  float holes = max(intake, max(fi, rg));
  gtDark = clamp(max(max(gaps, max(hood, hoodS)), max(max(lv, max(flv, dlv)), holes)), 0.0, 1.0);
  gtMesh = holes * step(0.5, fract(p.z * 55.0 + step(0.5, fract(p.y * 55.0)) * 0.5)) * 0.8;
}`;

// Cabin: glass only inside the daylight openings; pillars, roof and frames
// are painted to match the body.
const CABIN_GLASS = /* glsl */ `
float cabGlass = 0.0;
{
  vec3 p = vLocal; vec3 n = vObjN; float az = abs(p.z);
  float y = p.y, x = p.x;
  float sideF = smoothstep(0.45, 0.65, abs(n.z));
  float above = smoothstep(0.955, 0.965, y);
  float front = 1.0 - smoothstep(-0.004, 0.004, x - (0.64 - (y - 0.95) * 1.9));
  float rear = smoothstep(-0.004, 0.004, x - (-1.18 + (y - 0.95) * 1.55));
  float bx = x - (-0.42 + (y - 0.95) * 0.25);
  float bpil = 1.0 - smoothstep(-0.004, 0.0, bx) * (1.0 - smoothstep(0.066, 0.07, bx));
  float notRoof = 1.0 - smoothstep(0.5, 0.6, n.y);
  float sideGlass = sideF * above * front * rear * bpil * notRoof;
  float fw = smoothstep(0.25, 0.4, n.x) * step(az, 0.6 - (y - 0.86) * 0.4) * step(y, 1.185) * step(0.87, y);
  float rw = smoothstep(0.25, 0.4, -n.x) * step(az, 0.44) * step(0.93, y) * step(y, 1.16);
  cabGlass = clamp(sideGlass + fw + rw, 0.0, 1.0);
  float st = step(0.07, az) * step(az, 0.17) * step(0.55, n.y);
  vec3 paintC = mix(uPaint, vec3(0.92), st);
  diffuseColor.rgb = mix(paintC, diffuseColor.rgb, cabGlass);
}`;

const FRONT = { x: 1.3, y: 0.345, r: 0.345, w: 0.27, z: 0.775 };
const REAR = { x: -1.17, y: 0.355, r: 0.355, w: 0.32, z: 0.805 };

// Plan-view half width of the body, used for shaping and for aero flow lines.
export const bodyHalfWidth = table([[-2.32, 0.76], [-2.1, 0.9], [-1.6, 0.97], [-1.17, 0.985], [-0.7, 0.93], [0, 0.9], [0.6, 0.91], [1.0, 0.93], [1.3, 0.94], [1.8, 0.9], [2.1, 0.8], [2.32, 0.6]]);
export const bodyTop = table([[-2.4, 0.4], [-2.3, 0.86], [-2.1, 0.88], [-1.95, 0.9], [-1.4, 1.05], [-0.9, 1.17], [-0.4, 1.25], [0.05, 1.26], [0.45, 1.13], [0.95, 0.92], [1.3, 0.88], [1.66, 0.79], [1.92, 0.68], [2.13, 0.58], [2.32, 0.38]]);
// Underside height (for silhouettes and charts).
export const bodyBottom = (x) => 0.12;

export function buildGT3(kit) {
  const livery = canvasTexture(1024, 512, drawDecal);
  const paint = kit.material(
    { color: PAINTS[0].hex, metalness: 0.35, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.06 },
    {
      physical: true,
      patch: {
        key: 'gt3-livery',
        uniforms: { uDecal: { value: livery } },
        fragmentPars: 'uniform sampler2D uDecal;',
        colorFragment: /* glsl */ `
          float az = abs(vLocal.z);
          float stripe = step(0.07, az) * step(az, 0.17) * step(0.7, vLocal.y) * step(0.0, vObjN.y + 0.2);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.92), stripe * 0.95);
          float sill = 1.0 - smoothstep(0.24, 0.26, vLocal.y);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.02), sill);
          if (abs(vObjN.z) > 0.45 && vLocal.y > 0.27 && vLocal.y < 0.8) {
            float u = (vLocal.x + 0.62) / 1.3;
            if (vLocal.z < 0.0) u = 1.0 - u;
            vec2 duv = vec2(u, (vLocal.y - 0.27) / 0.53);
            if (duv.x > 0.0 && duv.x < 1.0) {
              vec4 d = texture2D(uDecal, duv);
              diffuseColor.rgb = mix(diffuseColor.rgb, d.rgb, d.a);
            }
          }
          ${GT3_DETAIL}
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.012), gtDark);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.05), gtMesh);`,
        surfaceFragment: 'roughnessFactor = mix(roughnessFactor, 0.62, gtDark); metalnessFactor = mix(metalnessFactor, 0.05, gtDark);',
      },
    }
  );
  const m = {
    paint,
    glass: kit.material({ color: 0x06080b, metalness: 0.35, roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.1 }, {
      physical: true,
      patch: {
        key: 'gt3-cabin',
        uniforms: { uPaint: { value: paint.color } },
        fragmentPars: 'uniform vec3 uPaint;',
        colorFragment: CABIN_GLASS,
        surfaceFragment: 'roughnessFactor = mix(0.3, 0.04, cabGlass); metalnessFactor = mix(0.35, 0.7, cabGlass);',
      },
    }),
    carbon: kit.material({ color: 0x15171a, metalness: 0.25, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.3 }, {
      physical: true,
      patch: {
        key: 'carbon', fragmentPars: '',
        colorFragment: 'float cw = step(0.5, fract((vLocal.x + vLocal.z) * 60.0)) * step(0.5, fract((vLocal.x - vLocal.z + vLocal.y) * 60.0)); diffuseColor.rgb *= 0.75 + 0.5 * cw;',
      },
    }),
    black: kit.material({ color: 0x08090a, metalness: 0.2, roughness: 0.55 }),
    matte: kit.material({ color: 0x0c0d0e, metalness: 0.1, roughness: 0.7 }),
    carbonMatte: kit.material({ color: 0x131416, metalness: 0.15, roughness: 0.62 }),
    tire: kit.material({ color: 0x111112, metalness: 0, roughness: 0.88 }, {
      patch: { key: 'tire', colorFragment: 'float wall = smoothstep(0.6, 0.9, abs(vObjN.z)); float txt = step(0.72, fract(atan(vLocal.y, vLocal.x) * 6.0)) * step(0.255, length(vLocal.xy)) * step(length(vLocal.xy), 0.3); diffuseColor.rgb += vec3(0.35) * txt * wall;' },
    }),
    rim: kit.material({ color: 0x1a1b1e, metalness: 0.85, roughness: 0.28 }),
    disc: kit.material({ color: 0x55585c, metalness: 0.9, roughness: 0.45 }),
    caliper: kit.material({ color: 0xf2c22a, metalness: 0.2, roughness: 0.35 }),
    nut: kit.material({ color: 0xff3b1f, metalness: 0.6, roughness: 0.3 }),
    titanium: kit.material({ color: 0x8d7f74, metalness: 1, roughness: 0.25 }, {
      patch: { key: 'ti', colorFragment: 'diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.35, 0.25, 0.55), smoothstep(-2.25, -2.4, vLocal.x));' },
    }),
    lamp: kit.material({ color: 0x0b0c0e, metalness: 0.9, roughness: 0.05, emissive: 0xfff4e6, emissiveIntensity: 3 }, {
      patch: { key: 'glow', emissiveFragment: 'totalEmissiveRadiance *= uGlow;' },
    }),
    tail: kit.material({ color: 0x120304, metalness: 0.5, roughness: 0.2, emissive: 0xff1e1e, emissiveIntensity: 4 }, {
      patch: { key: 'glow', emissiveFragment: 'totalEmissiveRadiance *= uGlow;' },
    }),
    headGlass: kit.material({ color: 0x0a0d12, metalness: 0.6, roughness: 0.03, transparent: true, opacity: 0.55 }, { physical: true }),
  };

  const P = (name, list, opts) => kit.part(name, list.map(([g, mat]) => kit.mesh(g, mat)), opts);

  // ── Body: side profile extruded, then shaped in plan and section ──────────
  const pts = [[-2.18, 0.18]];
  pts.push(...arc(REAR.x, 0.38, 0.43, Math.PI + 0.51, -0.51, 26));
  pts.push(...arc(FRONT.x, 0.37, 0.42, Math.PI + 0.496, -0.496, 26));
  pts.push([2.08, 0.16], [2.25, 0.21], [2.31, 0.31], [2.27, 0.42], [2.13, 0.53], [1.92, 0.63], [1.66, 0.74], [1.42, 0.81], [1.15, 0.84], [0.95, 0.85], [0.6, 0.88], [-0.3, 0.89], [-1.0, 0.89], [-1.3, 0.875], [-1.65, 0.86], [-1.95, 0.84], [-2.13, 0.81], [-2.26, 0.83], [-2.31, 0.64], [-2.3, 0.42], [-2.25, 0.27]);
  const bodyRaw = extrude(pts, 1.6, { bevel: 0.2, bevelSize: 0.05, bevelSeg: 8, curveSeg: 4, crease: 0 });
  const body = warpExtrusion(bodyRaw, (x, y) => {
    const barrel = 1 - 0.09 * Math.pow((y - 0.52) / 0.45, 2);
    const tumble = 1 - 0.1 * smoothstep(0.7, 0.98, y);
    const fender = 1 + 0.035 * (bell(x - FRONT.x, 0.45) + bell(x - REAR.x, 0.5)) * smoothstep(0.95, 0.6, y);
    return bodyHalfWidth(x) * barrel * tumble * fender;
  }, { crease: 0.7, unit: 10 });
  P('body', [[body, m.paint]], { explode: [0, 0.55, 0], label: 'Clearcoat body', delay: 0.5, spin: 0.15 });

  // Greenhouse.
  const cabinPts = [[-1.98, 0.8], [0.95, 0.8], [0.93, 0.86], [0.55, 1.05], [0.25, 1.16], [-0.15, 1.2], [-0.55, 1.19], [-0.95, 1.11], [-1.35, 0.99], [-1.75, 0.88], [-1.98, 0.83]];
  const cabinW = table([[-1.98, 0.5], [-1.5, 0.62], [-0.9, 0.7], [0, 0.71], [0.6, 0.7], [0.95, 0.66]]);
  const cabinRaw = extrude(cabinPts, 1.72, { bevel: 0.14, bevelSize: 0.06, bevelSeg: 8, curveSeg: 4, crease: 0 });
  const cabin = warpExtrusion(cabinRaw, (x, y) => cabinW(x) * (1 - 0.3 * smoothstep(0.86, 1.27, y)), { crease: 0.7, unit: 10 });
  P('cabin', [[cabin, m.glass]], { explode: [0, 1.15, 0], delay: 0.62, spin: 0.2 });

  P('tub', [[new RoundedBoxGeometry(4.15, 0.5, 1.12, 2, 0.05).translate(-0.05, 0.37, 0), m.black]], { explode: [0, 0, 0], delay: 0.5, edges: false });

  // ── Aero ───────────────────────────────────────────────────────────────────
  const foil = [];
  for (let i = 0; i <= 20; i++) { const t = i / 20; foil.push([0.17 - t * 0.34, 0.012 * Math.sin(Math.PI * t)]); }
  for (let i = 20; i >= 0; i--) { const t = i / 20; foil.push([0.17 - t * 0.34, -0.012 - 0.03 * Math.sin(Math.PI * Math.pow(t, 0.7))]); }
  const wing = new THREE.ExtrudeGeometry(new THREE.Shape(foil.map(([x, y]) => new THREE.Vector2(x, y))), { depth: 1.74, bevelEnabled: false, curveSegments: 4 });
  wing.translate(0, 0, -0.87);
  wing.rotateZ(-0.14);
  wing.translate(-2.08, 1.33, 0);
  const wingG = creased(wing, 0.7, 10);
  const gurney = box(-2.255, -2.24, 1.34, 1.4, -0.87, 0.87);
  P('wing', [[merge([wingG, gurney]), m.carbon]], { explode: [-0.35, 1.25, 0], label: 'Swan-neck wing', delay: 0.3 });
  const flapFoil = [];
  for (let i = 0; i <= 14; i++) { const t = i / 14; flapFoil.push(new THREE.Vector2(0.065 - t * 0.13, 0.006 * Math.sin(Math.PI * t))); }
  for (let i = 14; i >= 0; i--) { const t = i / 14; flapFoil.push(new THREE.Vector2(0.065 - t * 0.13, -0.006 - 0.014 * Math.sin(Math.PI * Math.pow(t, 0.7)))); }
  const flap = new THREE.ExtrudeGeometry(new THREE.Shape(flapFoil), { depth: 1.72, bevelEnabled: false, curveSegments: 4 });
  flap.translate(0, 0, -0.86).rotateZ(-0.55).translate(-2.235, 1.44, 0);
  P('wingFlap', [[creased(flap, 0.7, 10), m.carbon]], { explode: [-0.5, 1.6, 0], delay: 0.26 });
  for (const s of [-1, 1]) {
    const plate = extrude([[-1.86, 1.22], [-2.27, 1.19], [-2.33, 1.3], [-2.31, 1.52], [-2.18, 1.53], [-1.95, 1.43]], 0.012, { bevel: 0.004, bevelSize: 0.004, bevelSeg: 1, unit: 100 });
    plate.translate(0, 0, s * 0.875);
    P(`endplate${s}`, [[plate, m.carbon]], { explode: [-0.2, 1.3, s * 0.55], delay: 0.28 });
    const neck = strokeShape([[-1.92, 0.82], [-1.93, 1.12], [-1.98, 1.32], [-2.06, 1.4], [-2.12, 1.36]], 0.05, 0.035);
    const ng = extrude(neck, 0.018, { bevel: 0.004, bevelSize: 0.004, bevelSeg: 1, unit: 100 });
    ng.translate(0, 0, s * 0.33);
    P(`neck${s}`, [[ng, m.black]], { explode: [-0.15, 0.85, s * 0.2], delay: 0.32 });
  }
  const splitPlan = [[1.98, -0.8], [2.27, -0.77], [2.36, -0.6], [2.385, -0.2], [2.39, 0], [2.385, 0.2], [2.36, 0.6], [2.27, 0.77], [1.98, 0.8]];
  P('splitter', [[merge([extrudeUp(splitPlan, 0.018, 0.085, { unit: 100 }), box(2.14, 2.34, 0.1, 0.19, -0.79, -0.77), box(2.14, 2.34, 0.1, 0.19, 0.77, 0.79)]), m.carbonMatte]],
    { explode: [0.75, -0.25, 0], label: 'Front splitter', delay: 0.8 });
  const fins = [box(-2.36, -1.95, 0.085, 0.115, -0.78, 0.78)];
  for (let k = -3; k <= 3; k++) fins.push(box(-2.36, -2.0, 0.115, 0.28, k * 0.2 - 0.008, k * 0.2 + 0.008));
  P('diffuser', [[merge(fins), m.matte]], { explode: [-0.8, -0.2, 0], label: 'Rear diffuser', delay: 0.2 });
  for (const s of [-1, 1]) {
    P(`skirt${s}`, [[box(-0.72, 0.86, 0.09, 0.2, s * 0.86 - 0.04, s * 0.86 + 0.04), m.carbon]], { explode: [0, -0.2, s * 0.65], delay: 0.55 });
    const can = extrude([[2.05, 0.34], [2.24, 0.36], [2.24, 0.39]], 0.12, { bevel: 0.004, bevelSize: 0.004, bevelSeg: 1, unit: 100 });
    can.translate(0, 0, s * 0.74);
    P(`canard${s}`, [[can, m.carbon]], { explode: [0.5, 0.1, s * 0.5], delay: 0.85 });
    const shell = new THREE.SphereGeometry(1, 24, 16);
    shell.scale(0.085, 0.042, 0.062);
    warp(shell, (x, y, z) => [x < 0 ? x * 1.35 : x, y, z]); // tail stretched like a teardrop
    shell.translate(0.66, 1.0, s * 0.905);
    const stalk = box(0.64, 0.7, 0.955, 0.972, s * 0.73, s * 0.86);
    P(`mirror${s}`, [[merge([shell, stalk]), m.paint], [new THREE.CircleGeometry(0.03, 20).rotateY(-Math.PI / 2).scale(1, 1.2, 1.6).translate(0.574, 1.0, s * 0.905), m.headGlass]],
      { explode: [0, 0.45, s * 0.6], delay: 0.6 });
    const lamp = new THREE.SphereGeometry(0.13, 28, 18);
    lamp.scale(1.15, 0.6, 0.92).rotateZ(-0.45).translate(1.97, 0.615, s * 0.6);
    const drl = [];
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      drl.push(new THREE.SphereGeometry(0.017, 10, 8).translate(0, Math.sin(a) * 0.045, Math.cos(a) * 0.045));
    }
    drl.push(new THREE.TorusGeometry(0.075, 0.008, 6, 36).rotateY(Math.PI / 2));
    const drlG = merge(drl).rotateZ(-0.45).translate(2.09, 0.56, s * 0.6);
    P(`headlight${s}`, [[lamp, m.headGlass], [drlG, m.lamp]], { explode: [0.6, 0.35, s * 0.2], label: s > 0 ? 'Four-point LED' : null, delay: 0.75 });
  }
  P('taillight', [[merge([box(-2.37, -2.345, 0.69, 0.725, -0.72, 0.72), box(-2.365, -2.34, 0.6, 0.66, -0.68, -0.56), box(-2.365, -2.34, 0.6, 0.66, 0.56, 0.68)]), m.tail]], { explode: [-0.55, 0.15, 0], label: 'Light bar', delay: 0.18 });
  P('exhaust', [[merge([cylX(-2.42, -2.1, 0.052, 0.052, 0.3, -0.085, 24), cylX(-2.42, -2.1, 0.052, 0.052, 0.3, 0.085, 24)]), m.titanium]], { explode: [-0.75, -0.1, 0], delay: 0.15 });
  const scoop = new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  scoop.scale(0.2, 0.045, 0.13).translate(0.05, 1.245, 0);
  P('roofFin', [[merge([extrude([[-0.85, 1.22], [-0.35, 1.25], [-0.35, 1.31], [-0.45, 1.31]], 0.012, { bevel: 0.004, bevelSize: 0.004, bevelSeg: 1, unit: 100 }), scoop]), m.carbon],
    [new THREE.CircleGeometry(1, 20, 0, Math.PI).scale(0.09, 0.03, 1).rotateY(Math.PI / 2).translate(0.248, 1.247, 0), m.matte]],
    { explode: [0, 1.5, 0], delay: 0.66, label: 'Roof scoop' });

  // ── Wheels ───────────────────────────────────────────────────────────────
  for (const [ax, W] of [['front', FRONT], ['rear', REAR]]) {
    for (const s of [-1, 1]) {
      const spinner = new THREE.Group();
      spinner.name = 'spinner';
      spinner.add(kit.mesh(tireGeo(W.r, W.w), m.tire));
      spinner.add(kit.mesh(rimGeo(W.r * 0.74, W.w * 0.9), m.rim));
      spinner.add(kit.mesh(cylZ(-0.02, 0.05, 0.05, 0.035, 0, 0, 6), m.nut));
      spinner.scale.z = s; // mirror so the face points outward
      spinner.position.set(W.x, W.y, s * W.z);
      const disc = kit.mesh(cylZ(-0.012, 0.012, W.r * 0.62, W.r * 0.62, W.x, W.y, 48), m.disc);
      disc.position.z = s * (W.z - W.w * 0.18);
      const cal = kit.mesh(new RoundedBoxGeometry(0.17, 0.09, 0.07, 2, 0.02).translate(0, 0, 0), m.caliper);
      cal.position.set(W.x - W.r * 0.32, W.y + W.r * 0.42, s * (W.z - W.w * 0.12));
      cal.rotation.z = 0.6;
      const p = kit.part(`wheel-${ax}${s}`, [spinner, disc, cal], {
        explode: [ax === 'front' ? 0.25 : -0.25, -0.05, s * 1.05], delay: ax === 'front' ? 0.9 : 0.1,
        label: ax === 'front' && s > 0 ? 'Center-lock wheel' : null, spin: 0.4,
      });
      p.spinner = spinner;
    }
  }
  m.glass.userData.env = 0.55;
  m.headGlass.userData.env = 0.7;
  kit.paint = paint;
  return kit;
}

function tireGeo(r, w) {
  const prof = [];
  const ri = r * 0.73, hw = w / 2;
  const pts = [[ri, -hw * 0.92], [r * 0.93, -hw], [r, -hw * 0.82], [r, hw * 0.82], [r * 0.93, hw], [ri, hw * 0.92]];
  for (const [x, y] of pts) prof.push(new THREE.Vector2(x, y));
  const g = new THREE.LatheGeometry(prof, 72);
  g.rotateX(Math.PI / 2);
  return creased(g, 0.9, 10);
}

function rimGeo(r, w) {
  const parts = [];
  const barrel = new THREE.CylinderGeometry(r, r, w * 0.85, 48, 1, true);
  barrel.rotateX(Math.PI / 2).translate(0, 0, -w * 0.1);
  parts.push(barrel);
  parts.push(new THREE.TorusGeometry(r, 0.012, 6, 48).translate(0, 0, w * 0.33));
  parts.push(cylZ(0.0, 0.06, 0.075, 0.075, 0, 0, 24));
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    const sp = new THREE.BoxGeometry(r * 0.95, 0.034, 0.03);
    sp.translate(r * 0.5, 0, w * 0.27 - 0.02);
    sp.rotateZ(a);
    parts.push(sp);
  }
  return merge(parts);
}

function drawDecal(ctx, w, h) {
  ctx.clearRect(0, 0, w, h);
  // number roundel
  ctx.fillStyle = 'rgba(245,242,236,1)';
  ctx.beginPath(); ctx.arc(w * 0.47, h * 0.5, h * 0.27, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#0a0a0c';
  ctx.font = `800 ${h * 0.34}px Archivo, Arial, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('03', w * 0.47, h * 0.52);
  ctx.font = `700 ${h * 0.075}px "JetBrains Mono", monospace`;
  ctx.fillStyle = 'rgba(10,10,12,0.9)';
  ctx.fillText('PODESTALIA RACING', w * 0.47, h * 0.92);
  ctx.fillStyle = 'rgba(245,242,236,0.95)';
  ctx.fillRect(w * 0.08, h * 0.08, w * 0.22, h * 0.035);
}

function smoothstep(a, b, v) {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
function bell(d, w) {
  return Math.exp(-(d * d) / (w * w));
}

void NOISE;
