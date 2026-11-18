// Small math + timing helpers shared across the scene, story and UI layers.

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const seg = (t, a, b) => clamp((t - a) / (b - a));
export const smooth = (t) => t * t * (3 - 2 * t);
export const smoother = (t) => t * t * t * (t * (t * 6 - 15) + 10);
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = (t) => 1 - Math.pow(1 - t, 3);
export const easeIn = (t) => t * t * t;
export const easeOutExpo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

// Rises over [a,b], falls over [c,d]. Handy for "visible during this window".
export const bump = (t, a, b, c, d) => smooth(seg(t, a, b)) * (1 - smooth(seg(t, c, d)));

// Frame-rate independent exponential smoothing.
export const damp = (current, target, lambda, dt) => lerp(current, target, 1 - Math.exp(-lambda * dt));

// Under-damped spring from 0 to 1 — the "pop".
export const spring = (t, k = 7, w = 11) => (t <= 0 ? 0 : 1 - Math.exp(-k * t) * Math.cos(w * t));

export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Piecewise keyframe interpolation over scalar tracks with per-segment easing.
// frames: [{ t, ...values }] sorted by t. Returns an object with the same keys.
export function sampleTrack(frames, t, ease = easeInOut) {
  if (t <= frames[0].t) return frames[0];
  const last = frames[frames.length - 1];
  if (t >= last.t) return last;
  let i = 0;
  while (t > frames[i + 1].t) i++;
  const a = frames[i], b = frames[i + 1];
  const k = ease((t - a.t) / (b.t - a.t));
  const out = {};
  for (const key in a) {
    const va = a[key], vb = b[key] ?? va;
    if (Array.isArray(va)) out[key] = va.map((v, j) => lerp(v, vb[j], k));
    else if (typeof va === 'number') out[key] = lerp(va, vb, k);
    else out[key] = va;
  }
  return out;
}
