// M16-pattern carbine (M4 profile) built from ~30 machined parts.
// Units: centimetres. Bore axis at y = 2, muzzle toward +x.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { extrude, strokeShape, box, cylX, cylY, cylZ, helix, merge, warp, quad } from '../lib/geo.js';

export const M16_INFO = {
  id: 'carbine',
  title: 'Carbine',
  full: 'M16-pattern Carbine',
  blurb: 'Machined receivers, a gold bolt carrier and a holographic optic. Every pin and spring is its own mesh.',
  real: { length: '84 cm', weight: '3.1 kg', note: 'Display model, not functional' },
};

export function buildM16(kit) {
  const m = {
    alu: kit.material({ color: 0x2b2e34, metalness: 0.7, roughness: 0.38 }),
    polymer: kit.material({ color: 0x1e1f22, metalness: 0.05, roughness: 0.55 }),
    steel: kit.material({ color: 0x2c2f33, metalness: 0.9, roughness: 0.32 }),
    fde: kit.material({ color: 0x8c7757, metalness: 0.02, roughness: 0.72 }),
    gold: kit.material({ color: 0xd6aa4c, metalness: 1, roughness: 0.22 }),
    spring: kit.material({ color: 0xa8aeb4, metalness: 1, roughness: 0.25 }),
    rubber: kit.material({ color: 0x0c0c0d, metalness: 0, roughness: 0.92 }),
    glass: kit.material({ color: 0x0b1d26, metalness: 0.4, roughness: 0.04, transparent: true, opacity: 0.42, emissive: 0x06202c }, { physical: true }),
    reticle: kit.material({ color: 0x000000, emissive: 0xff2b2b, emissiveIntensity: 5 }, {
      patch: { key: 'glow', emissiveFragment: 'totalEmissiveRadiance *= uGlow;' },
    }),
  };
  m.polymerDS = kit.material({ color: 0x1e1f22, metalness: 0.05, roughness: 0.55, side: THREE.DoubleSide });

  const P = (name, list, opts) => kit.part(name, list.map(([g, mat]) => kit.mesh(g, mat)), opts);
  const ex = { bevelSeg: 3 };

  // ── Stock group ────────────────────────────────────────────────────────────
  const stock = [[0, -7], [0, 5.2], [1.6, 5.6], [14, 4.5], [19.2, 4.1], [20.6, 3], [20.6, -0.3], [16, -1.5], [9, -3.3], [3.4, -7]];
  P('stock', [[extrude(stock, 3.4, { ...ex, bevel: 0.5, bevelSize: 0.35 }), m.polymer]], { explode: [-9, 0, 0], label: 'Buttstock', delay: 0.1 });
  P('buttpad', [[new RoundedBoxGeometry(1.3, 12.6, 4.6, 2, 0.4).translate(-0.4, -0.9, 0), m.rubber]], { explode: [-15, 0, 0], delay: 0 });
  P('bufferTube', [[cylX(8, 27.4, 1.55, 1.55, 2, 0, 40), m.alu]], { explode: [-3.5, 0, 0], delay: 0.2 });
  P('castleNut', [[merge([cylX(26.6, 27.6, 1.95, 1.95, 2, 0, 10), cylX(27.4, 27.75, 2.15, 2.15, 2, 0, 40)]), m.steel]], { explode: [-1.5, 0, 0], delay: 0.25 });
  P('buffer', [[merge([cylX(12.5, 19.5, 1.2, 1.2, 2, 0, 24), cylX(12.0, 12.5, 0.9, 1.1, 2, 0, 24)]), m.steel]], { explode: [-18, -10.5, 0], delay: 0.15 });
  P('spring', [[helix({ x0: 13, x1: 27, r: 1.05, turns: 26, wire: 0.16, y: 2 }), m.spring]], { explode: [-4, -10.5, 0], label: 'Buffer spring', delay: 0.18, edges: false });

  // ── Lower receiver group ───────────────────────────────────────────────────
  const lower = [[27.2, 0.6], [50, 0.6], [50.7, -0.3], [50.3, -2.2], [48.3, -2.7], [47.8, -7], [40.4, -7], [40.1, -4.3], [36.2, -4.1], [34.6, -4.1], [32.6, -3.7], [30.3, -2.7], [27.2, -1.5]];
  P('lower', [[merge([extrude(lower, 2.1, { ...ex, bevel: 0.32, bevelSize: 0.22 }), box(40.0, 48.2, -7.35, -6.3, -1.55, 1.55)]), m.alu]], { explode: [0, 0, 0], label: 'Lower receiver', delay: 0.5 });
  P('pins', [[merge([cylZ(-1.62, 1.62, 0.34, 0.34, 49.0, -0.4, 16), cylZ(-1.62, 1.62, 0.34, 0.34, 29.0, -0.3, 16)]), m.steel]], { explode: [0, 0, 4], delay: 0.55 });
  const guard = strokeShape([[35.4, -4.0], [35.5, -5.6], [36.4, -6.3], [39.6, -6.3], [40.3, -5.8], [40.3, -4.2]], 0.55);
  P('guard', [[extrude(guard, 1.3, { bevel: 0.12, bevelSize: 0.08, bevelSeg: 2 }), m.alu]], { explode: [0.5, -4.5, 0], delay: 0.6 });
  const trig = strokeShape([[37.3, -3.6], [37.5, -4.7], [37.25, -5.4], [36.8, -5.75]], 0.45, 0.32);
  P('trigger', [[extrude(trig, 0.45, { bevel: 0.05, bevelSize: 0.04, bevelSeg: 1 }), m.steel]], { explode: [0, -3, 2.5], delay: 0.62 });
  P('selector', [[merge([box(32.6, 34.6, -1.9, -1.4, -1.62, -1.38), cylZ(-1.62, -1.38, 0.55, 0.55, 33.2, -1.65, 20)]), m.steel]], { explode: [0, 0, -3.5], delay: 0.64 });
  P('magRelease', [[merge([cylZ(1.35, 1.75, 0.5, 0.5, 46.8, -1.6, 20), box(40.5, 42, -1, 0.2, -1.62, -1.38)]), m.steel]], { explode: [0, 0, 3.5], delay: 0.66 });
  const grip = [[31, -3.7], [35.6, -3.7], [35.3, -5], [34.9, -6.2], [34.2, -7], [34.6, -8], [34, -9.3], [33.7, -11], [33.2, -12.7], [32.4, -13.3], [29.9, -13], [29.3, -12.2], [30.5, -6], [30.6, -4.5]];
  P('grip', [[extrude(grip, 2.3, { ...ex, bevel: 0.5, bevelSize: 0.35 }), m.polymer]], { explode: [-2.5, -6, 0], label: 'Pistol grip', delay: 0.4 });

  // Curved 30-round magazine.
  const magLine = quad([44.2, -2.6], [45.2, -14], [49.6, -24.5], 18);
  const magShape = strokeShape(magLine, 6.0, 6.2);
  const mag = extrude(magShape, 1.7, { bevel: 0.3, bevelSize: 0.22, bevelSeg: 3 });
  const end = magLine[magLine.length - 1];
  const floor = new RoundedBoxGeometry(7.2, 1.0, 2.7, 2, 0.3);
  floor.rotateZ(0.4).translate(end[0] + 0.15, end[1] - 0.37, 0);
  P('magazine', [[mag, m.fde], [floor, m.fde]], { explode: [3.5, -9.5, 0], label: '30-rd magazine', delay: 0.3 });

  // ── Upper receiver group ───────────────────────────────────────────────────
  const upper = [[27.4, 0.6], [27.4, 3.0], [27.9, 3.6], [28.4, 3.95], [52.6, 3.95], [52.6, 0.6]];
  const rail = [box(28.2, 52.2, 3.95, 4.45, -1.05, 1.05)];
  for (let k = 0; k < 24; k++) { const x = 28.6 + k * 0.98; rail.push(box(x, x + 0.52, 4.45, 4.9, -1.1, 1.1)); }
  P('upper', [[extrude(upper, 2.2, { ...ex, bevel: 0.3, bevelSize: 0.2 }), m.alu], [merge(rail), m.alu],
    [box(35.8, 42.8, 1.1, 3.1, 1.4, 1.45), m.rubber]], { explode: [0, 5.5, 0], label: 'Upper receiver', delay: 0.45 });
  P('portCover', [[box(36.0, 42.6, 1.25, 2.95, 1.45, 1.6), m.steel]], { explode: [0, 5.5, 3.5], delay: 0.48 });
  const fa = merge([cylX(-1.4, 1.4, 0.72, 0.72, 0, 0, 20), cylX(-1.95, -1.4, 0.55, 0.55, 0, 0, 20)]);
  fa.rotateY(0.45).translate(32.6, 2.6, 1.65);
  P('forwardAssist', [[merge([fa, box(34.4, 35.6, 1.3, 3.1, 1.3, 2.0)]), m.alu]], { explode: [-1.5, 5.5, 4], delay: 0.5 });
  P('chargingHandle', [[merge([box(25.2, 27.6, 3.05, 3.75, -0.7, 0.7), box(25.2, 26.1, 3.05, 3.75, -1.8, 1.8), box(27.6, 40, 3.15, 3.65, -0.45, 0.45)]), m.alu]],
    { explode: [-13, 10, 0], label: 'Charging handle', delay: 0.35 });
  const bcg = merge([
    cylX(30.4, 41, 1.15, 1.15, 2, 0, 32), box(32.6, 35.8, 3.05, 3.55, -0.35, 0.35), cylX(41, 43.6, 0.62, 0.62, 2, 0, 24),
    cylX(43.6, 44.0, 0.78, 0.78, 2, 0, 7), cylY(2.6, 3.35, 0.22, 0.22, 39.2, 0, 12), cylX(29, 30.4, 0.2, 0.2, 2, 0, 12),
  ]);
  P('bcg', [[bcg, m.gold]], { explode: [-12.5, 7, 0], label: 'Bolt carrier group', delay: 0.38 });

  // Holographic optic.
  const hood = new THREE.Shape();
  rrect(hood, -1.8, 7.0, 3.6, 3.2, 0.5);
  const hole = new THREE.Path();
  rrect(hole, -1.45, 7.35, 2.9, 2.5, 0.3);
  hood.holes.push(hole);
  const hoodG = extrude(hood, 4.8, { bevel: 0.12, bevelSize: 0.08, bevelSeg: 2 });
  hoodG.rotateY(Math.PI / 2).translate(39.0, 0, 0);
  const optBody = new RoundedBoxGeometry(8.4, 1.7, 3.6, 3, 0.45).translate(37.6, 6.5, 0);
  const optMount = box(33.6, 41.6, 4.9, 5.7, -1.3, 1.3);
  const glass = new THREE.PlaneGeometry(2.9, 2.5).rotateY(Math.PI / 2).translate(40.2, 8.6, 0);
  const ret = merge([new THREE.TorusGeometry(0.42, 0.035, 8, 48).rotateY(Math.PI / 2), new THREE.SphereGeometry(0.07, 10, 8)]).translate(40.15, 8.6, 0);
  P('optic', [[merge([hoodG, optBody]), m.alu], [optMount, m.steel], [glass, m.glass], [ret, m.reticle]],
    { explode: [0, 13, 0], label: 'Holographic optic', delay: 0.42 });
  P('rearSight', [[merge([box(29, 31.4, 4.9, 5.5, -0.9, 0.9), extrude([[29.6, 5.5], [30.8, 5.5], [30.5, 7.4], [29.9, 7.4]], 1.5, { bevel: 0.08, bevelSize: 0.05, bevelSeg: 1 })]), m.steel]],
    { explode: [-3, 10, 0], delay: 0.44 });

  // ── Barrel group ───────────────────────────────────────────────────────────
  P('barrel', [[merge([cylX(52.6, 80, 0.78, 0.72, 2, 0, 28), cylX(52.6, 55, 1.0, 1.0, 2, 0, 28)]), m.steel]], { explode: [8, 0, 0], label: '14.5″ barrel', delay: 0.7 });
  P('deltaRing', [[merge([cylX(52.6, 53.8, 2.55, 2.55, 2, 0, 44), cylX(53.8, 54.2, 2.35, 2.35, 2, 0, 44)]), m.steel]], { explode: [3.5, 0, 0], delay: 0.72 });
  P('gasTube', [[cylX(54, 70, 0.22, 0.22, 3.7, 0, 10), m.steel]], { explode: [8, 3, 0], delay: 0.74, edges: false });
  P('handguardTop', [[handguardHalf(true), m.polymerDS]], { explode: [6, 5.5, 0], label: 'Handguard', delay: 0.76 });
  P('handguardBottom', [[handguardHalf(false), m.polymerDS]], { explode: [6, -5.5, 0], delay: 0.78 });
  P('handguardCap', [[cylX(69.8, 70.4, 2.2, 2.0, 2, 0, 40), m.steel]], { explode: [12, 0, 0], delay: 0.8 });
  const fsb = extrude([[69.9, 2.2], [73.1, 2.2], [72.5, 3.2], [72.0, 6.4], [72.0, 8.6], [71.2, 8.6], [71.2, 6.4], [70.6, 3.2]], 1.3, { bevel: 0.15, bevelSize: 0.1, bevelSeg: 2 });
  P('fsb', [[merge([fsb, cylX(69.9, 73.1, 1.3, 1.3, 2, 0, 28), box(71, 72.6, 0, 0.9, -0.4, 0.4), box(71.1, 72.1, 8, 9.8, -0.78, -0.55), box(71.1, 72.1, 8, 9.8, 0.55, 0.78),
    box(71.5, 71.7, 8.3, 9.5, -0.12, 0.12), new THREE.TorusGeometry(0.55, 0.09, 8, 20).translate(71.8, -0.1, 0)]), m.steel]],
    { explode: [9, 7, 0], label: 'Front sight base', delay: 0.84 });
  const slots = [];
  for (let k = 0; k < 5; k++) slots.push(box(-1.7, 1.7, 0.98, 1.1, -0.18, 0.18).rotateX(0.35 + k * 1.1).translate(81.7, 2, 0));
  P('flashHider', [[merge([cylX(79, 84, 1.1, 1.05, 2, 0, 28), cylX(83.8, 84.1, 1.15, 1.15, 2, 0, 28)]), m.steel], [merge(slots), m.rubber]],
    { explode: [17, 0, 0], label: 'Flash hider', delay: 0.9 });

  return kit;
}

function rrect(path, x, y, w, h, r) {
  path.moveTo(x + r, y);
  path.lineTo(x + w - r, y);
  path.quadraticCurveTo(x + w, y, x + w, y + r);
  path.lineTo(x + w, y + h - r);
  path.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  path.lineTo(x + r, y + h);
  path.quadraticCurveTo(x, y + h, x, y + h - r);
  path.lineTo(x, y + r);
  path.quadraticCurveTo(x, y, x + r, y);
}

function handguardHalf(top) {
  const g = new THREE.CylinderGeometry(2.15, 2.3, 15.6, 64, 1, true, top ? Math.PI : 0, Math.PI);
  warp(g, (x, y, z) => {
    const th = Math.atan2(x, z);
    const f = 1 - 0.04 * smoothstep01(0.25, 0.75, 0.5 + 0.5 * Math.cos(th * 18));
    return [x * f, y, z * f];
  });
  g.rotateZ(-Math.PI / 2);
  g.translate(54.2 + 7.8, 2, 0);
  return g;
}

function smoothstep01(a, b, v) {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
