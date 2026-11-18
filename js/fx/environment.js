// Stage dressing: blueprint floor, vector ocean, ambient dust, pedestals,
// light cones and soft contact shadows.
import * as THREE from 'three';
import { NOISE } from './materials.js';
import { canvasTexture } from '../lib/geo.js';
import { rng } from '../lib/util.js';

export const PEDESTAL_TOP = 0.8;

// A dark studio with a few soft boxes — controlled, car-commercial reflections.
export function studioEnvironment(renderer) {
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(30, 32, 16), new THREE.MeshBasicMaterial({ color: 0x0b0c10, side: THREE.BackSide })));
  const panel = (w, h, pos, rot, color, k) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.rotation.set(...rot);
    scene.add(m);
  };
  // Three long strip lights overhead read as clean car-commercial highlights.
  for (const z of [-2.6, 0, 2.6]) panel(16, 0.55, [0, 9, z], [Math.PI / 2, 0, 0], 0xffffff, 2.4);
  panel(1.2, 10, [-10, 3, 2], [0, Math.PI / 2, 0], 0xffe2c4, 2.2);
  panel(1.2, 10, [10, 3, -2], [0, -Math.PI / 2, 0], 0xe8ece4, 2.2);
  panel(18, 1.2, [0, 1.2, -12], [0, 0, 0], 0xdfe6d8, 0.8);
  panel(10, 3, [0, 4, 12], [0, Math.PI, 0], 0xffffff, 1.2);
  panel(6, 1, [6, 0.5, 8], [0, -2.4, 0], 0xff5a1f, 1.1);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshBasicMaterial({ color: 0x050506 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -2;
  scene.add(ground);
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(scene, 0.03).texture;
  pm.dispose();
  return tex;
}

export function createFloor(y) {
  const uniforms = {
    uOpacity: { value: 1 }, uScroll: { value: 0 }, uTime: { value: 0 }, uPulse: { value: 0 }, uPulseR: { value: 0 },
    uBg: { value: new THREE.Color(0x101112) }, uLine: { value: new THREE.Color(0xc8d1c6) }, uAccent: { value: new THREE.Color(0xff5a1f) },
    uFade: { value: 18 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: true,
    extensions: { derivatives: true },
    vertexShader: /* glsl */ `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      uniform float uOpacity; uniform float uScroll; uniform float uTime; uniform float uPulse; uniform float uPulseR; uniform float uFade;
      uniform vec3 uBg; uniform vec3 uLine; uniform vec3 uAccent; varying vec3 vW;
      float g2(float x){ return exp(-x * x); }
      float grid(vec2 p, float s, float w){
        vec2 q = p / s, fw = max(fwidth(q), vec2(1e-4));
        vec2 g = abs(fract(q - 0.5) - 0.5) / fw;
        float line = 1.0 - min(min(g.x, g.y) / w, 1.0);
        return line * (1.0 - smoothstep(0.18, 0.45, max(fw.x, fw.y))); // LOD fade: no shimmer at distance
      }
      void main(){
        vec2 p = vW.xz + vec2(uScroll, 0.0);
        float r = length(vW.xz);
        float fade = 1.0 - smoothstep(2.5, uFade, r);
        float gm = grid(p, 0.5, 1.0) * 0.07;
        float gM = grid(p, 2.5, 1.2) * 0.22;
        float ring = g2((r - uPulseR) / 0.045) * uPulse;
        float halo = exp(-r * r * 0.08) * 0.10;
        vec3 col = uBg * (1.0 + halo * 4.0) + uLine * (gm + gM) * fade * 0.55 + uAccent * ring * 0.9 + uLine * ring * 0.35;
        gl_FragColor = vec4(col, uOpacity);
      }`,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(90, 90).rotateX(-Math.PI / 2), mat);
  m.position.y = y;
  m.renderOrder = -2;
  m.uniforms = uniforms;
  return m;
}

export function createOcean(y) {
  const uniforms = {
    uTime: { value: 0 }, uFlow: { value: 0 }, uOpacity: { value: 0 }, uCam: { value: new THREE.Vector3() },
    uDeep: { value: new THREE.Color(0x020405) }, uSky: { value: new THREE.Color(0x10181a) }, uLine: { value: new THREE.Color(0xa9c2b3) },
    uStern: { value: -2.8 }, uBow: { value: 2.9 }, uHalf: { value: 0.34 }, uFog: { value: new THREE.Color(0x05070c) }, uLines: { value: 1 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: true,
    extensions: { derivatives: true },
    vertexShader: /* glsl */ `
      uniform float uTime; uniform float uFlow; uniform float uStern; uniform float uBow; uniform float uHalf;
      varying vec3 vW; varying float vH; varying vec3 vN;
      float waves(vec2 p){
        float h = 0.0;
        h += sin(dot(p, vec2(0.9, 0.35)) * 1.6 + uTime * 1.1) * 0.035;
        h += sin(dot(p, vec2(-0.4, 1.0)) * 2.3 + uTime * 1.5) * 0.022;
        h += sin(dot(p, vec2(0.7, -0.8)) * 4.1 + uTime * 2.2) * 0.010;
        h += sin(dot(p, vec2(1.0, 0.1)) * 7.0 + uTime * 3.0) * 0.005;
        return h;
      }
      void main(){
        vec4 w = modelMatrix * vec4(position, 1.0);
        vec2 p = w.xz + vec2(uFlow, 0.0);
        float nearHull = smoothstep(0.0, 0.6, max(abs(w.z) - uHalf, 0.0) + max(w.x - uBow, 0.0) + max(uStern - w.x, 0.0));
        float amp = mix(0.25, 1.0, nearHull);
        float h = waves(p) * amp;
        float e = 0.05;
        float hx = waves(p + vec2(e, 0.0)) * amp - h, hz = waves(p + vec2(0.0, e)) * amp - h;
        vN = normalize(vec3(-hx / e, 1.0, -hz / e));
        w.y += h; vH = h; vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uFlow; uniform float uOpacity; uniform vec3 uCam; uniform float uLines;
      uniform vec3 uDeep; uniform vec3 uSky; uniform vec3 uLine; uniform vec3 uFog;
      uniform float uStern; uniform float uBow; uniform float uHalf;
      varying vec3 vW; varying float vH; varying vec3 vN;
      ${NOISE}
      float g2(float x){ return exp(-x * x); }
      void main(){
        vec3 V = normalize(uCam - vW); vec3 N = normalize(vN);
        float fres = pow(1.0 - max(dot(N, V), 0.0), 4.0);
        vec3 col = mix(uDeep, uSky, fres * 0.85);
        vec3 L = normalize(vec3(-0.45, 0.35, -0.8));
        vec3 H = normalize(L + V);
        col += vec3(1.0, 0.86, 0.7) * pow(clamp(dot(N, H), 0.0, 1.0), 500.0) * 1.2;
        float hh = vH * 40.0 + snoise(vec3((vW.xz + vec2(uFlow, 0.0)) * 0.7, uTime * 0.05)) * 0.45;
        float fh = max(fwidth(hh), 1e-4);
        float iso = abs(fract(hh) - 0.5) / fh;
        float contour = (1.0 - min(iso / 1.2, 1.0)) * 0.12 * uLines * (1.0 - smoothstep(0.2, 0.5, fh));
        vec2 gp = (vW.xz + vec2(uFlow, 0.0)) * 1.2;
        vec2 fg = max(fwidth(gp), vec2(1e-4));
        vec2 gg = abs(fract(gp - 0.5) - 0.5) / fg;
        float grid = (1.0 - min(min(gg.x, gg.y), 1.0)) * 0.05 * uLines * (1.0 - smoothstep(0.2, 0.5, max(fg.x, fg.y)));
        float d = uStern - vW.x;
        float az = abs(vW.z);
        float wake = 0.0;
        if (d > 0.0) {
          float arm = d * 0.36 + uHalf * 0.8;
          float kel = g2((az - arm) / (0.012 + d * 0.012)) * exp(-d * 0.22);
          kel *= 0.55 + 0.45 * sin(d * 34.0 - uTime * 5.0);
          float core = g2(az / (0.14 + d * 0.03)) * exp(-d * 0.3);
          float foam = smoothstep(0.25, 0.95, snoise(vec3(vW.x * 5.0 + uTime * 1.6, vW.z * 14.0, uTime * 0.4)) * 0.5 + 0.5);
          wake = kel * 0.4 + core * foam * 0.45;
        }
        float along = step(uStern, vW.x) * step(vW.x, uBow);
        float hullFoam = g2((az - uHalf) / 0.018) * along * (0.3 + 0.7 * smoothstep(uStern, uBow, vW.x));
        float bd = vW.x - uBow + 0.2;
        float bow = g2((az - max(0.0, -bd) * 0.4) / 0.02) * exp(-max(0.0, -bd) * 3.0) * step(bd, 0.2);
        float fog = smoothstep(9.0, 32.0, length(vW.xz - uCam.xz));
        col += uLine * (contour + grid) * (1.0 - fog);
        float speckle = 0.55 + 0.45 * snoise(vec3(vW.xz * 9.0 + vec2(uFlow * 2.0, 0.0), uTime * 0.6));
        col += vec3(0.85, 0.95, 1.0) * (wake + (hullFoam * 0.22 + bow * 0.18) * speckle) * (1.0 - fog);
        col = mix(col, uFog, fog);
        gl_FragColor = vec4(col, uOpacity);
      }`,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(80, 80, 240, 240).rotateX(-Math.PI / 2), mat);
  m.position.y = y;
  m.renderOrder = -1;
  m.uniforms = uniforms;
  return m;
}

export function createDust(count = 2600) {
  const r = rng(77);
  const pos = new Float32Array(count * 3), seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (r() - 0.5) * 34; pos[i * 3 + 1] = -1 + r() * 10; pos[i * 3 + 2] = (r() - 0.5) * 34;
    seed[i] = r();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const uniforms = { uTime: { value: 0 }, uScale: { value: 500 }, uOpacity: { value: 0.6 }, uColor: { value: new THREE.Color(0xe6ead8) } };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute float aSeed; uniform float uTime; uniform float uScale; varying float vA;
      void main(){
        vec3 p = position;
        p.y += mod(uTime * (0.04 + aSeed * 0.06) + aSeed * 10.0, 10.0) - 5.0;
        p.x += sin(uTime * 0.2 + aSeed * 30.0) * 0.4;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp((0.012 + aSeed * 0.02) * uScale / -mv.z, 0.0, 6.0);
        vA = (0.3 + 0.7 * fract(aSeed * 13.0)) * (0.5 + 0.5 * sin(uTime * (0.6 + aSeed) + aSeed * 40.0));
      }`,
    fragmentShader: /* glsl */ `
      uniform float uOpacity; uniform vec3 uColor; varying float vA;
      void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(uColor, a * vA * uOpacity); }`,
  });
  const p = new THREE.Points(g, mat);
  p.frustumCulled = false;
  p.uniforms = uniforms;
  return p;
}

// Soft blob shadow texture (shared).
let shadowTex = null;
export function contactShadow(w, d, opacity = 0.7) {
  if (!shadowTex) {
    shadowTex = canvasTexture(256, 256, (c, W, H) => {
      const g = c.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.45, 'rgba(0,0,0,0.6)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
    });
    shadowTex.colorSpace = THREE.NoColorSpace;
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity, color: 0x000000 }));
  m.renderOrder = -1;
  return m;
}

export function createPedestal(index, label, accent) {
  const group = new THREE.Group();
  const stone = new THREE.MeshPhysicalMaterial({ color: 0x15161a, metalness: 0.15, roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.45 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x2a2c31, metalness: 0.7, roughness: 0.62 });
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.08, 1.14, 0.12, 96), trim);
  plinth.position.y = 0.06;
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.98, 0.62, 96), stone);
  column.position.y = 0.43;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.02, 1.0, 0.06, 96), trim);
  cap.position.y = 0.77;
  const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(accent).multiplyScalar(3), toneMapped: true });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.02, 0.008, 8, 160).rotateX(Math.PI / 2), glowMat);
  ring.position.y = PEDESTAL_TOP;
  const lowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xd8f23e).multiplyScalar(1.5) });
  const low = new THREE.Mesh(new THREE.TorusGeometry(1.12, 0.005, 6, 160).rotateX(Math.PI / 2), lowMat);
  low.position.y = 0.125;
  const plateTex = canvasTexture(1024, 160, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.fillStyle = 'rgba(236,232,225,0.92)';
    c.font = `600 ${h * 0.3}px "JetBrains Mono", monospace`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(`OBJ-0${index + 1}  —  ${label.toUpperCase()}`, w / 2, h * 0.5);
    c.fillStyle = 'rgba(236,232,225,0.35)';
    c.fillRect(w * 0.1, h * 0.86, w * 0.8, 2);
  });
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.985, 0.985, 0.16, 48, 1, true, -0.62, 1.24), new THREE.MeshBasicMaterial({ map: plateTex, transparent: true, depthWrite: false }));
  plate.position.y = 0.45;
  const shadow = contactShadow(1.9, 1.9, 0.85);
  shadow.position.y = PEDESTAL_TOP + 0.001;
  const mount = new THREE.Group();
  mount.position.y = PEDESTAL_TOP;
  group.add(plinth, column, cap, ring, low, plate, shadow, mount);
  const hit = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 2.6, 16), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.y = 1.3;
  hit.userData.pedestal = index;
  group.add(hit);
  return { group, mount, ring, glowMat, hit, accent: new THREE.Color(accent) };
}

export function lightCone(height = 6, rTop = 0.15, rBot = 1.25, color = 0xf1f6dc) {
  const uniforms = { uOpacity: { value: 0 }, uColor: { value: new THREE.Color(color) }, uTime: { value: 0 } };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: /* glsl */ `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `uniform float uOpacity; uniform vec3 uColor; uniform float uTime; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ float f = pow(clamp(abs(dot(vN, vV)), 0.0, 1.0), 1.6); float h = pow(clamp(vUv.y, 0.0, 1.0), 1.4); gl_FragColor = vec4(uColor, f * h * uOpacity * 0.22); }`,
  });
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, height, 48, 1, true), mat);
  m.uniforms = uniforms;
  m.renderOrder = 6;
  return m;
}
