// Shader patches that give every model material the "sweep reveal / dissolve"
// behaviour, glowing fronts, rim light, and per-model procedural details
// (livery, windows) — all driven by shared per-model uniforms.
import * as THREE from 'three';

export const NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
float hash12(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
`;

const REVEAL_PARS = /* glsl */ `
uniform float uShow; uniform float uHide; uniform vec3 uAxis;
uniform float uNoiseAmp; uniform float uNoiseFreq; uniform float uEdgeWidth;
uniform vec3 uEdgeColor; uniform float uRim; uniform vec3 uRimColor;
uniform float uActive; uniform float uTime; uniform float uGlow;
varying vec3 vHome; varying vec3 vLocal; varying vec3 vObjN;
float revealEdge = 0.0;
${NOISE}
`;

const REVEAL_DISCARD = /* glsl */ `
if (uActive > 0.5) {
  float rn = snoise(vHome * uNoiseFreq) * uNoiseAmp;
  float rs = dot(vHome, uAxis) + rn;
  if (rs > uShow || rs < uHide) discard;
  revealEdge = 1.0 - smoothstep(0.0, uEdgeWidth, min(uShow - rs, rs - uHide));
}
`;

const REVEAL_EMISSIVE = /* glsl */ `
totalEmissiveRadiance += uEdgeColor * revealEdge * 7.0;
if (uRim > 0.001) {
  float rimF = 1.0 - abs(dot(normalize(normal), normalize(vViewPosition)));
  totalEmissiveRadiance += uRimColor * pow(clamp(rimF, 0.0, 1.0), 2.6) * uRim;
}
`;

export function patchMaterial(mat, shared, patch = {}) {
  const { colorFragment = '', emissiveFragment = '', fragmentPars = '', surfaceFragment = '', uniforms = {}, key = '' } = patch;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, shared, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aHome;\nvarying vec3 vHome;\nvarying vec3 vLocal;\nvarying vec3 vObjN;')
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvObjN = objectNormal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHome = aHome;\nvLocal = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${REVEAL_PARS}\n${fragmentPars}`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\n${REVEAL_DISCARD}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${colorFragment}`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>\n${surfaceFragment}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${REVEAL_EMISSIVE}\n${emissiveFragment}`);
  };
  const cacheKey = `reveal|${key}|${colorFragment}|${emissiveFragment}|${fragmentPars}|${surfaceFragment}`;
  mat.customProgramCacheKey = () => cacheKey;
  return mat;
}

// Blueprint edge lines that lead the reveal front and linger behind the dissolve.
export function edgeMaterial(shared) {
  return new THREE.ShaderMaterial({
    uniforms: shared,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute vec3 aHome; varying vec3 vHome;
      void main(){
        vHome = aHome;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position.z -= 0.00035 * gl_Position.w; // win depth ties against the surface they outline
      }`,
    fragmentShader: /* glsl */ `
      uniform float uShow; uniform float uHide; uniform vec3 uAxis; uniform float uLead;
      uniform float uLineBase; uniform float uRim; uniform float uWire; uniform float uActive;
      uniform vec3 uEdgeColor; uniform float uLineGlow;
      varying vec3 vHome;
      void main(){
        float s = dot(vHome, uAxis);
        float a = 0.0;
        if (uActive > 0.5) {
          float ahead = s - uShow;
          a += step(0.0, ahead) * (1.0 - smoothstep(0.0, uLead, ahead)) * 0.95;
          float behind = uHide - s;
          a += step(0.0, behind) * (1.0 - smoothstep(0.0, uLead, behind)) * 0.95;
        }
        float inside = step(s, uShow) * step(uHide, s);
        a += inside * max(uLineBase, uRim * 0.45);
        a = max(a, uWire * 0.8 * step(s, uShow));
        if (a < 0.004) discard;
        gl_FragColor = vec4(uEdgeColor * uLineGlow, min(a, 1.0));
      }`,
  });
}
