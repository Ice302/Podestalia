// The Director: a pure-ish function of story time T (chapter index + local
// progress) plus wall-clock time for idle motion. Scrubbing backwards always
// reproduces the same frame — every transition is reversible.
import * as THREE from 'three';
import { clamp, lerp, seg, smooth, bump, easeInOut, easeOut, sampleTrack, spring } from './lib/util.js';
import { TRAVEL } from './fx/particles.js';

export const FLOOR_Y = -0.62;
export const WATER_Y = -0.46;

export const TL = {
  explode: [1.26, 1.7],
  m1: [2.06, 2.72],
  carAssemble: [2.7, 2.95],
  aero: [3.1, 3.3, 3.86, 3.98],
  sweep: [3.12, 3.62],
  carExplode: [4.02, 4.28],
  m2: [4.3, 4.84],
  shipAssemble: [4.8, 4.98],
  ocean: [4.36, 4.76],
  floorOut: [4.3, 4.6],
  m3: [9.04, 9.4],
  ribbons: [9.04, 9.28, 9.78, 9.96],
  globe: [9.08, 9.25, 9.6, 9.85],
  burst: [9.3, 9.48],
  rise: [9.28, 9.66],
  m4: [9.5, 9.93],
  arcs: [9.5, 9.66, 9.8, 9.96],
  floorIn: [9.12, 9.4],
  oceanOut: [9.08, 9.38],
  spots: [9.72, 9.96],
};

// Camera keyframes in story time. az/el in degrees around target.
const CAM = [
  { t: 0.0, tgt: [0, 0.08, 0], az: 0, el: 5, r: 6.6, fov: 34 },
  { t: 0.55, tgt: [0.2, 0.06, 0], az: 24, el: 12, r: 5.7, fov: 34 },
  { t: 1.0, tgt: [0.1, 0.06, 0], az: 8, el: 8, r: 6.4, fov: 34, ox: 1.0 },
  { t: 1.3, tgt: [0.3, 0.1, 0], az: 0, el: 5, r: 7.2, fov: 34, ox: 0.7 },
  { t: 1.74, tgt: [0.35, 0.12, 0], az: -9, el: 9, r: 8.9, fov: 34 },
  { t: 2.04, tgt: [0.35, 0.12, 0], az: -16, el: 13, r: 9.0, fov: 34 },
  { t: 2.45, tgt: [0.1, 0.1, 0], az: -2, el: 18, r: 8.7, fov: 34 },
  { t: 2.95, tgt: [0, 0.0, 0], az: 40, el: 10, r: 7.6, fov: 34 },
  { t: 3.1, tgt: [0, 0.0, 0], az: 48, el: 8, r: 7.4, fov: 34, ox: 1.1 },
  { t: 3.3, tgt: [0.7, -0.12, 0], az: 72, el: 3, r: 6.2, fov: 30, ox: 0.9 },
  { t: 3.5, tgt: [0, 0.05, 0], az: 2, el: 3, r: 7.9, fov: 30 },
  { t: 3.63, tgt: [0, 0.05, 0], az: -4, el: 4, r: 8.1, fov: 30 },
  { t: 3.82, tgt: [-0.9, 0.05, 0], az: -128, el: 13, r: 6.6, fov: 32, ox: -0.9 },
  { t: 4.0, tgt: [-0.4, 0.05, 0], az: -150, el: 16, r: 7.5, fov: 34, ox: -0.5 },
  { t: 4.28, tgt: [0, 0.15, 0], az: -195, el: 22, r: 9.4, fov: 34 },
  { t: 4.72, tgt: [0, 0.2, 0], az: -255, el: 22, r: 10.2, fov: 34 },
  { t: 5.0, tgt: [0.3, 0.15, 0], az: -300, el: 13, r: 8.6, fov: 34 },
  { t: 5.3, tgt: [2.45, -0.1, 0], az: -280, el: 4, r: 2.4, fov: 40, ox: 0.45 },
  { t: 5.56, tgt: [2.35, -0.06, 0], az: -290, el: 7, r: 2.6, fov: 40, ox: 0.45 },
  { t: 5.86, tgt: [0.2, 0.1, 0], az: -345, el: 11, r: 4.4, fov: 38 },
  { t: 6.3, tgt: [-2.5, -0.06, 0], az: -405, el: 10, r: 2.7, fov: 40, ox: -0.5 },
  { t: 6.56, tgt: [-2.55, -0.04, 0], az: -446, el: 12, r: 2.9, fov: 40, ox: -0.5 },
  { t: 6.86, tgt: [-1.2, 0.1, 0], az: -500, el: 10, r: 6.2, fov: 34 },
  { t: 7.3, tgt: [0, 0.12, 0], az: -540, el: 3, r: 11.2, fov: 26 },
  { t: 7.56, tgt: [0, 0.12, 0], az: -540, el: 4, r: 10.8, fov: 26 },
  { t: 7.86, tgt: [0, 0.2, 0], az: -560, el: 42, r: 9.4, fov: 30 },
  { t: 8.3, tgt: [0, 0.15, 0], az: -540, el: 84, r: 9.0, fov: 30 },
  { t: 8.56, tgt: [0, 0.15, 0], az: -546, el: 84, r: 8.8, fov: 30 },
  { t: 8.86, tgt: [0, 0.4, 0], az: -600, el: 45, r: 10.8, fov: 34 },
  { t: 9.1, tgt: [0, 0.6, 0], az: -630, el: 30, r: 11.8, fov: 36 },
  { t: 9.5, tgt: [0, 0.7, 0], az: -682, el: 20, r: 11.2, fov: 36 },
  { t: 10.0, tgt: [0, 0.3, 0], az: -720, el: 12, r: 10.8, fov: 36 },
  { t: 13.0, tgt: [0, 0.3, 0], az: -720, el: 12, r: 10.8, fov: 36 },
];
for (const k of CAM) k.ox ??= 0;

const BG = [
  { t: 0, c: [0.022, 0.024, 0.024] },
  { t: 2.9, c: [0.026, 0.024, 0.022] },
  { t: 4.6, c: [0.012, 0.018, 0.02] },
  { t: 8.9, c: [0.012, 0.018, 0.02] },
  { t: 9.6, c: [0.02, 0.021, 0.021] },
  { t: 13, c: [0.02, 0.021, 0.021] },
];

const D2R = Math.PI / 180;

export class Director {
  constructor(ctx) {
    Object.assign(this, ctx);
    this.camState = { tgt: new THREE.Vector3(), pos: new THREE.Vector3(), fov: 34 };
    this.scroll = 0;
    this.wheelSpin = 0;
    this.spin = 0;
  }

  cameraAt(T, aspect, pointer) {
    const k = sampleTrack(CAM, T);
    let fit = aspect >= 1.3 ? 1 : lerp(1, 2.05, clamp((1.3 - aspect) / 0.85));
    // Portrait screens can't fit three pedestals: pan across them instead.
    const gal = aspect < 0.9 ? smooth(seg(T, 9.8, 10.05)) : 0;
    let tx = k.tgt[0];
    if (gal > 0) {
      fit = lerp(fit, 1.15, gal);
      tx = lerp(tx, lerp(-3.3, 3.3, smooth(seg(T, 10.08, 10.85))), gal);
    }
    const az = (k.az + pointer.x * 2.6) * D2R, el = clamp(k.el + pointer.y * 1.6, -5, 86) * D2R;
    const r = k.r * fit;
    const s = this.camState;
    const ox = aspect >= 1.1 ? k.ox : 0;
    s.tgt.set(tx - Math.cos(az) * ox, k.tgt[1], k.tgt[2] + Math.sin(az) * ox);
    s.pos.set(s.tgt.x + Math.sin(az) * Math.cos(el) * r, s.tgt.y + Math.sin(el) * r, s.tgt.z + Math.cos(az) * Math.cos(el) * r);
    s.fov = k.fov;
    s.az = az; s.el = el; s.r = r;
    return s;
  }

  update(T, time, dt, { introT, aspect, pointer, velocity, reduced }) {
    const { kits, gallery, swarm, floor, ocean, lines, pedestals, lights, post, scene, stage } = this;
    const [m16, car, ship] = kits;
    const idle = reduced ? 0 : 1;

    // ── Stage sway in the hero ────────────────────────────────────────────
    const sway = 1 - smooth(seg(T, 0.55, 1.2));
    stage.rotation.y = Math.sin(time * 0.35) * 0.5 * sway * idle + (1 - sway) * 0;
    stage.position.y = Math.sin(time * 0.8) * 0.04 * sway * idle;
    stage.updateMatrixWorld(true);

    // ── Carbine ───────────────────────────────────────────────────────────
    const pop = reduced ? 1 : clamp(spring(Math.max(0, introT - 0.25) * 0.85));
    const m1 = seg(T, ...TL.m1);
    const e16 = easeInOut(seg(T, ...TL.explode));
    m16.root.visible = T < TL.m1[1] + 0.01;
    if (m16.root.visible) {
      m16.root.scale.setScalar(Math.max(0.001, pop));
      m16.setExplode(e16);
      m16.setReveal(null, m1 > 0 ? m16.frontAt(m1 / (1 - TRAVEL)) : null);
      const flash = reduced ? 0 : bump(introT, 0.2, 0.5, 1.2, 2.6);
      m16.uniforms.uRim.value = 0.55 * e16 + flash * 0.8;
      m16.uniforms.uLineBase.value = 0.22 * e16 + flash * 0.6;
      m16.updateLines();
    }

    // ── GT3 ───────────────────────────────────────────────────────────────
    const m2 = seg(T, ...TL.m2);
    car.root.visible = T > TL.m1[0] + (TL.m1[1] - TL.m1[0]) * TRAVEL * 0.95 && T < TL.m2[1] + 0.01;
    const carAsm = easeInOut(seg(T, ...TL.carAssemble));
    const carEx = easeInOut(seg(T, ...TL.carExplode));
    const eCar = T < TL.carExplode[0] ? 1 - carAsm : carEx;
    if (car.root.visible) {
      car.setExplode(eCar);
      const show = m1 < 1 ? car.frontAt((m1 - TRAVEL) / (1 - TRAVEL)) : null;
      const hide = m2 > 0 ? car.frontAt(m2 / (1 - TRAVEL)) : null;
      car.setReveal(show, hide);
      car.uniforms.uRim.value = 0.5 * eCar;
      car.uniforms.uLineBase.value = 0.2 * eCar;
      car.updateLines();
      const drive = bump(T, 3.08, 3.2, 3.9, 4.0) * idle;
      this.wheelSpin -= dt * drive * 16;
      for (const p of car.parts) if (p.spinner) p.spinner.rotation.z = this.wheelSpin;
      floor.uniforms.uScroll.value += dt * drive * 6;
    }
    const aero = bump(T, ...TL.aero);
    lines.aero.uniforms.uDraw.value = seg(T, TL.aero[0], TL.aero[1] + 0.12);
    lines.aero.uniforms.uOpacity.value = aero;
    lines.aero.visible = aero > 0.002 && car.root.visible;
    const sweepK = seg(T, ...TL.sweep);
    lights.sweep.position.set(lerp(3.4, -3.4, sweepK), 2.6, 2.4);
    lights.sweep.intensity = bump(T, 3.1, 3.18, 3.56, 3.64) * 5;

    // ── Ship ──────────────────────────────────────────────────────────────
    const m3 = seg(T, ...TL.m3);
    ship.root.visible = T > TL.m2[0] + (TL.m2[1] - TL.m2[0]) * TRAVEL * 0.95 && T < TL.m3[1] + 0.01;
    if (ship.root.visible) {
      ship.setExplode(1 - easeInOut(seg(T, ...TL.shipAssemble)));
      const show = m2 < 1 ? ship.frontAt((m2 - TRAVEL) / (1 - TRAVEL)) : null;
      const hide = m3 > 0 ? ship.frontAt(m3 / (1 - TRAVEL)) : null;
      ship.setReveal(show, hide);
      ship.uniforms.uRim.value = 0.4 * ship.explode;
      ship.uniforms.uLineBase.value = 0.15 * ship.explode;
      ship.updateLines();
      const mast = ship.find('mast');
      if (mast && mast.radar) mast.radar.rotation.y = time * 2.2 * idle;
    }
    const oceanK = smooth(seg(T, ...TL.ocean)) * (1 - smooth(seg(T, ...TL.oceanOut)));
    ocean.uniforms.uOpacity.value = oceanK;
    ocean.visible = oceanK > 0.002;
    ocean.uniforms.uTime.value = time * idle + 0.0001;
    ocean.uniforms.uFlow.value = time * 0.35 * idle;
    ocean.uniforms.uCam.value.copy(this.camera.position);

    // ── Floor ─────────────────────────────────────────────────────────────
    const floorK = clamp(1 - smooth(seg(T, ...TL.floorOut)) + smooth(seg(T, ...TL.floorIn)));
    floor.uniforms.uOpacity.value = floorK;
    floor.visible = floorK > 0.002;
    const popRing = reduced ? 0 : bump(introT, 0.3, 0.45, 1.2, 2.4);
    const asmRing = bump(T, 2.92, 2.96, 3.02, 3.14);
    floor.uniforms.uPulse.value = Math.max(popRing, asmRing, bump(T, 9.9, 9.94, 10.0, 10.2));
    floor.uniforms.uPulseR.value = popRing > asmRing ? (introT - 0.3) * 4.5 : seg(T, 2.92, 3.14) * 9 + seg(T, 9.9, 10.2) * 9;
    floor.uniforms.uTime.value = time;

    // ── Particles ─────────────────────────────────────────────────────────
    const m4 = seg(T, ...TL.m4);
    let phase = 0;
    if (T >= TL.m4[0]) phase = 3 + m4;
    else if (T >= TL.m3[0]) phase = 2 + m3;
    else if (T >= TL.m2[0]) phase = 1 + m2;
    else if (T >= TL.m1[0]) phase = m1;
    swarm.phase = phase;
    const su = swarm.uniforms;
    su.uTime.value = time;
    su.uExplA.value = phase < 1 ? m16.explode : car.explode;
    su.uExplB.value = car.explode;
    su.uStage.value.copy(stage.matrixWorld);
    this.spin += dt * (0.25 + 0.6 * bump(T, 9.0, 9.2, 9.6, 9.9)) * (reduced ? 0.2 : 1);
    su.uSpin.value = this.spin;
    su.uSwirl.value = reduced ? 0.35 : 1;

    // ── Finale lines ──────────────────────────────────────────────────────
    const lu = (l, draw, erase = 0, op = 1) => {
      l.uniforms.uDraw.value = draw; l.uniforms.uErase.value = erase; l.uniforms.uOpacity.value = op;
      l.uniforms.uTime.value = time;
      l.visible = op > 0.002 && draw > 0.001 && erase < 0.999;
    };
    lu(lines.vortex, seg(T, TL.ribbons[0], TL.ribbons[1]), seg(T, TL.ribbons[2], TL.ribbons[3]));
    lines.vortex.rotation.y = this.spin * 0.6;
    lu(lines.globe, seg(T, TL.globe[0], TL.globe[1]), seg(T, TL.globe[2], TL.globe[3]), 0.5);
    lines.globe.rotation.y = -this.spin * 0.3;
    lu(lines.burst, seg(T, ...TL.burst), seg(T, TL.burst[0] + 0.08, TL.burst[1] + 0.14));
    lu(lines.arcs, seg(T, TL.arcs[0], TL.arcs[1]), seg(T, TL.arcs[2], TL.arcs[3]));
    lu(lines.rings, reduced ? 1 : clamp((introT - 0.2) / 1.6), 0, (1 - smooth(seg(T, 0.25, 0.8))) * 0.9);
    lines.rings.rotation.y = time * 0.12 * idle;
    lines.aero.uniforms.uTime.value = time;

    // ── Pedestals + gallery models ────────────────────────────────────────
    const rising = T > TL.rise[0] - 0.01;
    pedestals.forEach((p, i) => {
      const k = easeOut(seg(T, TL.rise[0] + i * 0.05, TL.rise[1] + i * 0.05));
      p.group.visible = rising;
      p.group.position.y = FLOOR_Y - 1.2 * (1 - k);
      p.group.updateMatrixWorld(true);
      p.cone.uniforms.uOpacity.value = smooth(seg(T, TL.spots[0] + i * 0.03, TL.spots[1])) * (1 + p.hover * 0.8);
      p.cone.uniforms.uTime.value = time;
      p.cone.visible = p.cone.uniforms.uOpacity.value > 0.002;
      p.glowMat.color.copy(p.accent).multiplyScalar(1.4 + p.hover * 3 + bump(T, 9.6, 9.7, 9.85, 10) * 1.5);
    });
    const galOn = T >= TL.m4[0];
    gallery.forEach((g, i) => {
      g.root.visible = galOn;
      if (!galOn) return;
      const show = m4 < 1 ? g.frontAt((m4 - TRAVEL) / (1 - TRAVEL)) : null;
      g.setReveal(show, g.wireHide ?? null);
      g.updateLines();
      su[`uGal${i}`].value.copy(g.root.matrixWorld);
    });

    // ── Atmosphere + post ─────────────────────────────────────────────────
    const bg = sampleTrack(BG, T, smooth).c;
    scene.background.setRGB(bg[0], bg[1], bg[2]);
    scene.fog.color.copy(scene.background);
    floor.uniforms.uBg.value.copy(scene.background);
    ocean.uniforms.uFog.value.copy(scene.background);
    const morphHeat = Math.max(Math.sin(Math.PI * m1), Math.sin(Math.PI * m2), Math.sin(Math.PI * m3), Math.sin(Math.PI * m4) * 0.8);
    const v = Math.min(1, Math.abs(velocity) * 0.0009);
    post.lens.uniforms.uAberration.value = 0.0012 + morphHeat * 0.0035 + v * 0.004;
    post.lens.uniforms.uTime.value = time;
    post.lens.uniforms.uFlash.value = (bump(T, 2.9, 2.95, 2.97, 3.06) + bump(T, 4.93, 4.97, 4.99, 5.08) + bump(T, 9.88, 9.92, 9.95, 10.04)) * 0.05;
    if (post.bloomPass) post.bloomPass.strength = 0.42 + morphHeat * 0.2 + bump(T, 9.0, 9.3, 9.8, 10) * 0.15;
    const ambient = 1 - 0.4 * smooth(seg(T, 4.4, 4.9)) + 0.4 * smooth(seg(T, 9.4, 9.9));
    lights.key.intensity = 2.2 * ambient;
    lights.rim.intensity = 2.5 * (1 - 0.5 * smooth(seg(T, 9.2, 9.8)));
    lights.hemi.intensity = 0.45 * ambient;

    this.state = { m1, m2, m3, m4, phase, morphHeat };
    return this.state;
  }
}
