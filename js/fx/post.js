// Post-processing: HDR bloom, then a lens pass (chromatic aberration,
// vignette, grain, scan flash) before tone mapping.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// Removes NaN/Inf and clamps fireflies so one bad sample can't flood the bloom.
const SanitizeShader = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; varying vec2 vUv;
    bool bad(float x) {
    #if __VERSION__ >= 300
      return isnan(x) || isinf(x);
    #else
      return !(x == x) || x > 6.0e4;
    #endif
    }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      if (bad(c.r) || bad(c.g) || bad(c.b)) c = vec4(0.0, 0.0, 0.0, 1.0);
      gl_FragColor = vec4(min(c.rgb, vec3(48.0)), c.a);
    }`,
};

const LensShader = {
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uAberration: { value: 0.002 }, uVignette: { value: 0.9 },
    uGrain: { value: 0.035 }, uFlash: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uTime; uniform float uAberration; uniform float uVignette; uniform float uGrain; uniform float uFlash; uniform vec2 uRes;
    varying vec2 vUv;
    float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    void main(){
      vec2 c = vUv - 0.5; float d = length(c);
      vec2 off = c * uAberration * (0.4 + d * 2.0);
      vec3 col = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
      col *= mix(1.0, smoothstep(0.95, 0.2, d), uVignette);
      col += uFlash * vec3(0.55, 0.85, 1.0) * (1.0 - d);
      float g = hash(vUv * uRes + fract(uTime * 7.31) * 113.0) - 0.5;
      col += g * uGrain * (0.25 + col);
      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }`,
};

export function createPost(renderer, scene, camera, { bloom = true, samples = 4 } = {}) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new ShaderPass(SanitizeShader));
  let bloomPass = null;
  if (bloom) {
    bloomPass = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.42, 0.45, 0.88);
    composer.addPass(bloomPass);
  }
  const lens = new ShaderPass(LensShader);
  composer.addPass(lens);
  composer.addPass(new OutputPass());
  return {
    composer, bloomPass, lens,
    setSize(w, h, dpr) {
      composer.setPixelRatio(dpr);
      composer.setSize(w, h);
      lens.uniforms.uRes.value.set(w * dpr, h * dpr);
    },
  };
}
