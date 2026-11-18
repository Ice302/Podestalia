// Ocean liner. Units: 1 ≈ 55 m, bow toward +x, waterline at y = 0.
import * as THREE from 'three';
import { table, loft, extrude, extrudeUp, box, cylY, merge, tube, canvasTexture } from '../lib/geo.js';

export const SHIP_INFO = {
  id: 'voyager',
  title: 'Voyager',
  full: 'Voyager-class Cruise Ship',
  blurb: 'Fourteen decks, about four thousand shader-drawn windows, sixteen lifeboats, waterslides and a pool deck.',
  real: { length: '330 m', weight: '168,000 GT', note: 'Fictional vessel' },
};

export const DH = 0.072;
export const Y0 = 0.33;
// [rear x, front x, half-width, nose bluntness]. Fronts share one raked face;
// the aft ends step down into terraces.
const DECKS = [
  [-2.78, 2.3, 0.365, 0.42], [-2.7, 2.29, 0.31, 0.42], [-2.6, 2.28, 0.31, 0.42], [-2.42, 2.27, 0.365, 0.42], [-2.24, 2.26, 0.365, 0.42],
  [-2.0, 2.25, 0.365, 0.42], [-1.75, 2.24, 0.365, 0.42], [-1.5, 2.22, 0.36, 0.42], [-1.22, 1.72, 0.33, 0.5], [-0.92, 1.3, 0.29, 0.55],
];
const DECK_CELL = 0.05, HULL_CELL = 0.026, HULL_ROWS = 4, LIFEBOAT_Y = 0.33 + 1.6 * 0.072;
export const SHIP_TOP = Y0 + DECKS.length * DH;

// Beam profile of the hull (half-width by x), shared with the UI charts.
export const hullHalfWidth = table([[-3.0, 0.3], [-2.7, 0.35], [-2.2, 0.37], [1.2, 0.37], [1.8, 0.34], [2.3, 0.26], [2.65, 0.16], [2.88, 0.06], [3.0, 0.004]]);
export const SHIP_DECKS = DECKS;

// How many windows the shaders draw (sides, aft faces and hull rows).
export function windowCount() {
  let n = 0;
  for (const [xr, xf, hw, nose] of DECKS) {
    const straight = xf - hw * nose * 2.2 - xr;
    n += 2 * Math.floor(straight / DECK_CELL) + Math.floor((2 * hw) / DECK_CELL);
  }
  return n + HULL_ROWS * 2 * Math.floor((2.15 + 2.85) / HULL_CELL);
}

// Points of interest in build space (used by callouts).
export const SHIP_POI = {
  bow: [3.05, 0.38, 0], bulb: [2.85, 0.05, 0.05], name: [2.3, 0.27, 0.27], bridge: [1.92, 0.87, 0.43],
  funnel: [-0.6, 1.3, 0.13], lifeboat: [0.05, 0.445, 0.36], pool: [0.5, 1.06, 0], slides: [-0.05, 1.3, 0.17],
  stern: [-3.0, 0.3, 0], terraces: [-2.3, 0.75, 0.2], helipad: [2.55, 0.4, 0], radar: [1.0, 1.18, 0.1],
};

const HULL_WINDOWS = /* glsl */ `
float hullWin(vec3 p, vec3 n, out float lit) {
  lit = 0.0;
  if (abs(n.z) < 0.6 || p.x < -2.85 || p.x > 2.15) return 0.0;
  float rowY = (p.y - 0.12) / 0.052;
  float ri = floor(rowY + 0.5);
  if (ri < 0.0 || ri > ${HULL_ROWS - 1}.0) return 0.0;
  float fy = abs(rowY - ri);
  float cx = p.x / ${HULL_CELL}; float ci = floor(cx); float fx = fract(cx);
  float h = hash12(vec2(ci, ri + sign(p.z) * 7.0));
  lit = step(0.4, h) * (0.55 + 0.45 * fract(h * 13.0));
  // Filter the pattern by its on-screen size so distant hulls don't shimmer.
  float ax = clamp(fwidth(cx) * 1.6, 0.0, 1.0), ay = clamp(fwidth(rowY) * 1.6, 0.0, 1.0);
  float wx = mix(step(0.28, fx) * step(fx, 0.72), 0.44, ax);
  float wy = mix(step(fy, 0.13), 0.26, ay);
  return wx * wy;
}`;

const DECK_WINDOWS = /* glsl */ `
float deckWin(vec3 p, vec3 n, out float lit, out float rail) {
  lit = 0.0; rail = 0.0;
  float fy = (p.y - ${Y0.toFixed(3)}) / ${DH.toFixed(3)};
  float ly = fract(fy), k = floor(fy);
  float side = step(0.6, abs(n.z)); float front = step(0.55, n.x); float back = step(0.6, -n.x);
  float face = max(side, back);
  float ay = clamp(fwidth(fy) * 2.0, 0.0, 1.0);
  float band = mix(step(0.26, ly) * step(ly, 0.86), 0.6, ay);
  // Balcony bays: glass doors split by white partitions, filtered with distance.
  float along = mix(p.x, p.z, back) / ${DECK_CELL};
  float bx = fract(along);
  float ax = clamp(fwidth(along) * 1.6, 0.0, 1.0);
  float pane = band * mix(step(0.09, bx) * step(bx, 0.93), 0.84, ax) * face;
  float fr = band * front;
  rail = mix(step(0.09, ly) * step(ly, 0.16), 0.07, ay) * face;
  float h = hash12(vec2(floor(along) + front * 17.0, k + sign(p.z) * 13.0));
  lit = step(0.5, h) * (0.5 + 0.5 * fract(h * 13.0));
  return max(pane, fr);
}`;

export function buildShip(kit) {
  const nameTex = canvasTexture(1024, 116, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.fillStyle = '#0b1a33';
    c.font = `800 ${h * 0.78}px Archivo, Arial, sans-serif`;
    c.textBaseline = 'middle';
    c.textAlign = 'center';
    c.fillText('PODESTALIA', w / 2, h * 0.55);
  });
  const sternTex = canvasTexture(512, 92, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.fillStyle = '#0b1a33';
    c.textAlign = 'center';
    c.font = `800 ${h * 0.46}px Archivo, Arial, sans-serif`;
    c.fillText('PODESTALIA', w / 2, h * 0.48);
    c.font = `600 ${h * 0.26}px "JetBrains Mono", monospace`;
    c.fillText('NASSAU', w / 2, h * 0.88);
  });
  const accent = new THREE.Color(0xff5a1f);

  const hull = kit.material({ color: 0xe6e4df, metalness: 0.1, roughness: 0.45 }, {
    patch: {
      key: 'ship-hull',
      uniforms: { uName: { value: nameTex }, uStern: { value: sternTex }, uAccent: { value: accent } },
      fragmentPars: `uniform sampler2D uName; uniform sampler2D uStern; uniform vec3 uAccent;\n${HULL_WINDOWS}`,
      colorFragment: /* glsl */ `
        vec3 hc = diffuseColor.rgb; float hy = vLocal.y;
        hc = mix(hc, vec3(0.03, 0.06, 0.12), 1.0 - smoothstep(0.075, 0.082, hy));
        hc = mix(hc, vec3(0.42, 0.06, 0.05), 1.0 - smoothstep(-0.006, 0.0, hy));
        float sw = vLocal.x - 1.25 - (hy - 0.1) * 2.6;
        hc = mix(hc, uAccent, step(0.0, sw) * step(sw, 0.055) * step(0.09, hy) * step(hy, 0.34) * step(0.35, abs(vObjN.z)));
        float hl; float hw = hullWin(vLocal, vObjN, hl);
        hc = mix(hc, vec3(0.04, 0.06, 0.09), hw);
        float deckTop = smoothstep(0.7, 0.9, vObjN.y);
        hc = mix(hc, vec3(0.25, 0.29, 0.32), deckTop);
        vec2 hp = vec2(vLocal.x - 2.55, vLocal.z);
        float ring = (1.0 - smoothstep(0.004, 0.008, abs(length(hp) - 0.105))) * deckTop;
        float H = deckTop * step(length(hp), 0.09) * max(step(abs(abs(hp.y) - 0.032), 0.007) * step(abs(hp.x), 0.045), step(abs(hp.x), 0.007) * step(abs(hp.y), 0.032));
        hc = mix(hc, vec3(0.95, 0.78, 0.2), max(ring, H));
        if (abs(vObjN.z) > 0.3) {
          float nu = (vLocal.x - 2.0) / 0.62; if (vLocal.z < 0.0) nu = 1.0 - nu;
          vec2 nuv = vec2(nu, (hy - 0.232) / 0.07);
          if (nuv.x > 0.0 && nuv.x < 1.0 && nuv.y > 0.0 && nuv.y < 1.0) { vec4 nd = texture2D(uName, nuv); hc = mix(hc, nd.rgb, nd.a); }
        }
        if (vObjN.x < -0.6) {
          vec2 suv = vec2((vLocal.z + 0.25) / 0.5, (hy - 0.16) / 0.1);
          if (suv.x > 0.0 && suv.x < 1.0 && suv.y > 0.0 && suv.y < 1.0) { vec4 sd = texture2D(uStern, suv); hc = mix(hc, sd.rgb, sd.a); }
        }
        diffuseColor.rgb = hc;`,
      emissiveFragment: /* glsl */ `
        float hl2; float hw2 = hullWin(vLocal, vObjN, hl2);
        totalEmissiveRadiance += hw2 * hl2 * vec3(1.0, 0.7, 0.36) * 1.2 * uGlow;`,
    },
  });

  const deck = kit.material({ color: 0xe8e7e3, metalness: 0.1, roughness: 0.45 }, {
    patch: {
      key: 'ship-deck',
      fragmentPars: DECK_WINDOWS,
      colorFragment: /* glsl */ `
        float dl; float dr; float dw = deckWin(vLocal, vObjN, dl, dr);
        vec3 dc = mix(diffuseColor.rgb, vec3(0.045, 0.07, 0.1), dw);
        dc = mix(dc, vec3(0.5, 0.56, 0.62), dr);
        dc = mix(dc, vec3(0.14, 0.34, 0.4), step(0.8, vObjN.y));
        diffuseColor.rgb = dc;`,
      emissiveFragment: /* glsl */ `
        float dl2; float dr2; float dw2 = deckWin(vLocal, vObjN, dl2, dr2);
        vec3 warm = mix(vec3(1.0, 0.68, 0.36), vec3(1.0, 0.9, 0.75), step(0.8, fract(dl2 * 91.7)));
        vec3 cool = vec3(0.55, 0.8, 1.0);
        totalEmissiveRadiance += dw2 * mix(dl2 * warm * 0.95, cool * 0.35, step(0.55, vObjN.x)) * uGlow;`,
    },
  });

  const funnelMat = kit.material({ color: 0xf2f1ee, metalness: 0.15, roughness: 0.38 }, {
    patch: {
      key: 'ship-funnel',
      uniforms: { uAccent: { value: accent } },
      fragmentPars: 'uniform vec3 uAccent;',
      colorFragment: 'diffuseColor.rgb = mix(diffuseColor.rgb, uAccent, step(1.24, vLocal.y)); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.03), step(1.335, vLocal.y));',
    },
  });
  const m = {
    hull, deck, funnel: funnelMat,
    white: kit.material({ color: 0xeeeeec, metalness: 0.1, roughness: 0.45 }),
    orange: kit.material({ color: 0xff6a14, metalness: 0.05, roughness: 0.5 }),
    steel: kit.material({ color: 0x2b2f35, metalness: 0.8, roughness: 0.4 }),
    teal: kit.material({ color: 0x18b6c9, metalness: 0.1, roughness: 0.3 }),
    yellow: kit.material({ color: 0xffc83d, metalness: 0.1, roughness: 0.35 }),
    water: kit.material({ color: 0x0b8fb3, metalness: 0.2, roughness: 0.05, emissive: 0x19d4ff, emissiveIntensity: 1.6 }, {
      patch: { key: 'glow', emissiveFragment: 'totalEmissiveRadiance *= uGlow;' },
    }),
    red: kit.material({ color: 0x220000, emissive: 0xff2020, emissiveIntensity: 6 }, { patch: { key: 'glow', emissiveFragment: 'totalEmissiveRadiance *= uGlow;' } }),
    green: kit.material({ color: 0x002200, emissive: 0x20ff60, emissiveIntensity: 6 }, { patch: { key: 'glow', emissiveFragment: 'totalEmissiveRadiance *= uGlow;' } }),
    lamp: kit.material({ color: 0x222222, emissive: 0xfff1dc, emissiveIntensity: 6 }, { patch: { key: 'glow', emissiveFragment: 'totalEmissiveRadiance *= uGlow;' } }),
  };

  const P = (name, list, opts) => kit.part(name, list.map(([g, mat]) => kit.mesh(g, mat)), opts);
  const U = { unit: 100 };

  // ── Hull ───────────────────────────────────────────────────────────────────
  const hw = table([[-3.0, 0.3], [-2.7, 0.35], [-2.2, 0.37], [1.2, 0.37], [1.8, 0.34], [2.3, 0.26], [2.65, 0.16], [2.88, 0.06], [3.0, 0.004]]);
  const top = table([[-3.0, 0.34], [0, 0.33], [2.0, 0.36], [3.0, 0.43]]);
  const bot = table([[-3.0, -0.05], [-2.6, -0.14], [-2.0, -0.15], [2.4, -0.15], [2.9, -0.07], [3.0, -0.01]]);
  const hullG = loft({
    x0: -3.0, x1: 3.0, rings: 140, seg: 56,
    section: (x) => ({ hw: hw(x), top: top(x), bot: bot(x), mid: -0.02, nTop: 10, nBot: 3.2, flare: 0.3 * ss(1.4, 2.9, x) }),
    deform: ([x, y, z]) => [x + (y + 0.02) * 0.32 * ss(1.8, 3.0, x), y, z],
  });
  P('hull', [[hullG, m.hull]], { explode: [0, 0, 0], delay: 1, spin: 0, label: 'Raked bow' });

  // Bow fittings: windlasses, anchors, bulb.
  const fittings = [cylY(0.4, 0.44, 0.022, 0.022, 2.72, 0.07, 16), cylY(0.4, 0.44, 0.022, 0.022, 2.72, -0.07, 16), box(2.45, 2.62, 0.39, 0.41, -0.04, 0.04)];
  const anchors = [new THREE.SphereGeometry(0.03, 12, 8).scale(1.4, 0.8, 0.4).translate(2.76, 0.29, 0.128), new THREE.SphereGeometry(0.03, 12, 8).scale(1.4, 0.8, 0.4).translate(2.76, 0.29, -0.128)];
  P('bowFittings', [[merge(fittings), m.steel], [merge(anchors), m.steel]], { explode: [0.5, 0.6, 0], delay: 0.95 });
  P('bulb', [[new THREE.SphereGeometry(0.06, 20, 14).scale(2.6, 0.9, 0.9).translate(2.86, -0.07, 0), m.hull]], { explode: [0.6, -0.2, 0], delay: 0.98, edges: false });

  // ── Superstructure ───────────────────────────────────────────────────────
  DECKS.forEach(([xr, xf, w], k) => {
    const g = extrudeUp(deckShape(xr, xf, w), DH * 0.985, Y0 + k * DH, { crease: 0.6, ...U });
    P(`deck${k}`, [[g, m.deck]], {
      explode: [0, 0.4 + k * 0.17, 0], delay: 1 - k / (DECKS.length - 1), spin: 0.12,
      label: k === 5 ? 'Balcony decks' : null,
    });
  });
  const bridgeY = Y0 + 7 * DH;
  P('bridgeWings', [[box(1.8, 1.97, bridgeY, bridgeY + DH * 0.95, -0.43, 0.43), m.deck], [merge([new THREE.SphereGeometry(0.008, 8, 6).translate(1.9, bridgeY + DH, -0.43)]), m.red],
    [merge([new THREE.SphereGeometry(0.008, 8, 6).translate(1.9, bridgeY + DH, 0.43)]), m.green]],
  { explode: [0.4, 1.5, 0], delay: 0.2, label: 'Bridge' });

  const funnel = extrude([[-0.8, SHIP_TOP - 0.01], [-0.3, SHIP_TOP - 0.01], [-0.38, 1.36], [-0.92, 1.41], [-0.98, 1.3]], 0.17, { bevel: 0.04, bevelSize: 0.03, bevelSeg: 3, ...U });
  P('funnel', [[funnel, m.funnel]], { explode: [0, 2.2, 0], delay: 0.02, label: 'Funnel' });
  const mast = [box(1.1, 1.135, SHIP_TOP, 1.33, -0.014, 0.014), box(1.07, 1.17, 1.24, 1.25, -0.11, 0.11), box(1.07, 1.12, 1.14, 1.15, -0.06, 0.06)];
  const domes = [new THREE.SphereGeometry(0.04, 18, 12).translate(1.0, SHIP_TOP + 0.09, 0.1), new THREE.SphereGeometry(0.04, 18, 12).translate(1.0, SHIP_TOP + 0.09, -0.1), cylY(SHIP_TOP, SHIP_TOP + 0.05, 0.012, 0.012, 1.0, 0.1, 8), cylY(SHIP_TOP, SHIP_TOP + 0.05, 0.012, 0.012, 1.0, -0.1, 8)];
  const mastPart = P('mast', [[merge(mast), m.white], [merge(domes), m.white], [new THREE.SphereGeometry(0.007, 8, 6).translate(1.117, 1.335, 0), m.lamp]], { explode: [0.3, 2.3, 0], delay: 0.01, label: 'Radar mast' });
  const radar = new THREE.Mesh(box(-0.08, 0.08, -0.006, 0.006, -0.01, 0.01), m.steel);
  radar.position.set(1.117, 1.31, 0);
  radar.name = 'radar';
  mastPart.obj.add(radar);
  mastPart.radar = radar;

  // Pool deck.
  const surround = box(0.18, 0.82, SHIP_TOP, SHIP_TOP + 0.006, -0.14, 0.14);
  P('pool', [[box(0.24, 0.76, SHIP_TOP + 0.006, SHIP_TOP + 0.009, -0.09, 0.09), m.water], [surround, m.white]], { explode: [0, 1.9, 0], delay: 0.05, label: 'Pool deck' });
  const lounge = [];
  for (let i = 0; i < 5; i++) for (let j = 0; j < 8; j++) lounge.push(box(0.9 + i * 0.075, 0.93 + i * 0.075, SHIP_TOP, SHIP_TOP + 0.007, -0.21 + j * 0.06, -0.198 + j * 0.06));
  P('loungers', [[merge(lounge), m.white]], { explode: [0, 2.0, 0], delay: 0.06, edges: false });
  const spiral = [];
  for (let i = 0; i <= 40; i++) { const t = i / 40, a = t * Math.PI * 4.4; spiral.push([-0.05 + Math.cos(a) * 0.065, 1.37 - t * 0.31, 0.17 + Math.sin(a) * 0.065]); }
  const swoop = [[-0.05, 1.37, 0.17], [0.12, 1.3, 0.24], [0.3, 1.2, 0.18], [0.42, 1.14, 0.24], [0.6, 1.08, 0.2]];
  P('slides', [[tube(spiral, 0.009, 200, 8), m.teal], [tube(swoop, 0.009, 120, 8), m.yellow], [cylY(SHIP_TOP, 1.38, 0.016, 0.016, -0.05, 0.17, 10), m.white]],
    { explode: [0, 2.05, 0.2], delay: 0.03, label: 'Waterslides', edges: false });

  // Lifeboats + davits.
  const davits = [];
  for (const s of [-1, 1]) {
    for (let i = 0; i < 8; i++) {
      const x = -1.55 + i * 0.4;
      const boat = new THREE.CapsuleGeometry(0.024, 0.075, 4, 12).rotateZ(Math.PI / 2).translate(x, Y0 + 1.6 * DH, s * 0.338);
      P(`lifeboat${s}-${i}`, [[boat, m.orange]], { explode: [0, 0.5 + i * 0.04, s * 0.5], delay: 0.35 + i * 0.03, spin: 0.9, edges: false, label: s > 0 && i === 4 ? 'Lifeboats' : null });
      davits.push(box(x - 0.06, x - 0.05, Y0 + 1.2 * DH, Y0 + 2.3 * DH, s * 0.31, s * 0.345), box(x + 0.05, x + 0.06, Y0 + 1.2 * DH, Y0 + 2.3 * DH, s * 0.31, s * 0.345));
    }
  }
  P('davits', [[merge(davits), m.white]], { explode: [0, 0.8, 0], delay: 0.4, edges: false });

  // Stern lights.
  P('sternLights', [[merge([new THREE.SphereGeometry(0.008, 8, 6).translate(-2.79, Y0 + DH * 0.5, 0.2), new THREE.SphereGeometry(0.008, 8, 6).translate(-2.79, Y0 + DH * 0.5, -0.2)]), m.lamp]],
    { explode: [-0.4, 0.4, 0], delay: 0.9, edges: false });

  return kit;
}

function deckShape(xr, xf, hw, nose = 0.55) {
  const pts = [[xr, -hw + 0.015], [xr + 0.015, -hw]];
  const xn = xf - hw * nose * 2.2;
  const n = 2.5;
  for (let i = 0; i <= 24; i++) {
    const a = -Math.PI / 2 + (i / 24) * Math.PI;
    const c = Math.cos(a), s = Math.sin(a);
    pts.push([xn + (xf - xn) * Math.pow(Math.max(0, c), 2 / n), hw * Math.sign(s) * Math.pow(Math.abs(s), 2 / n)]);
  }
  pts.push([xr + 0.015, hw], [xr, hw - 0.015]);
  return pts;
}

function ss(a, b, v) {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
