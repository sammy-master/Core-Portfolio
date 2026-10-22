import * as THREE from 'three';
import { scene, globalU } from '../engine/renderer.js';

const NOISE = /* glsl */ `
  vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
  vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
  vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
  float snoise(vec3 v){
    const vec2 C=vec2(1./6.,1./3.); const vec4 D=vec4(0.,.5,1.,2.);
    vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
    vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
    vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
    i=mod289(i);
    vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
    float n_=.142857142857; vec3 ns=n_*D.wyz-D.xzx;
    vec4 j=p-49.*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.*x_);
    vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.-abs(x)-abs(y);
    vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
    vec4 s0=floor(b0)*2.+1.; vec4 s1=floor(b1)*2.+1.; vec4 sh=-step(h,vec4(0.));
    vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
    vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
    vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
    p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
    vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.); m=m*m;
    return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
  }
`;
export const NOISE_GLSL = NOISE;

export const bgU = {
  uC1: { value: new THREE.Color('#2a1466') },
  uC2: { value: new THREE.Color('#0b6e8a') },
  uIntensity: { value: 0.55 },
};

const sky = new THREE.Mesh(
  new THREE.SphereGeometry(150, 48, 32),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { ...bgU, uTime: globalU.uTime },
    vertexShader: /* glsl */ `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec3 vD; uniform float uTime, uIntensity; uniform vec3 uC1, uC2;
      ${NOISE}
      float fbm(vec3 p){ float a=.5, s=0.; for(int i=0;i<4;i++){ s+=a*snoise(p); p*=2.03; a*=.5; } return s; }
      void main(){
        vec3 d = normalize(vD);
        float t = uTime * 0.03;
        float n = fbm(d * 1.6 + vec3(t, -t * .6, t * .4));
        float m = fbm(d * 3.2 - vec3(t * .5, t, 0.) + n);
        float cloud = smoothstep(-0.2, 0.9, n + m * 0.5);
        vec3 col = mix(uC1, uC2, smoothstep(-.4, .8, m));
        col *= cloud * uIntensity;
        col += uC2 * pow(max(0., n), 3.) * .35;
        gl_FragColor = vec4(col, 1.);
      }`,
  }),
);
sky.renderOrder = -10;
scene.add(sky);

// ---- Starfield (points) ----
const STAR_N = 2600;
const sp = new Float32Array(STAR_N * 3);
const sc = new Float32Array(STAR_N);
for (let i = 0; i < STAR_N; i++) {
  const r = 30 + Math.random() * 90;
  const a = Math.random() * Math.PI * 2;
  const b = Math.acos(2 * Math.random() - 1);
  sp[i * 3] = r * Math.sin(b) * Math.cos(a);
  sp[i * 3 + 1] = r * Math.sin(b) * Math.sin(a);
  sp[i * 3 + 2] = r * Math.cos(b);
  sc[i] = Math.random();
}
const sg = new THREE.BufferGeometry();
sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
sg.setAttribute('aRnd', new THREE.BufferAttribute(sc, 1));
const stars = new THREE.Points(
  sg,
  new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: globalU.uTime, uPx: { value: window.devicePixelRatio || 1 } },
    vertexShader: /* glsl */ `
      attribute float aRnd; varying float vR; varying float vT; uniform float uTime, uPx;
      void main(){
        vR = aRnd; vT = 0.6 + 0.4 * sin(uTime * (1. + aRnd * 3.) + aRnd * 40.);
        vec4 mv = modelViewMatrix * vec4(position, 1.);
        gl_PointSize = (1.2 + aRnd * 2.2) * uPx;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying float vR; varying float vT;
      void main(){
        float d = length(gl_PointCoord - .5);
        float a = smoothstep(.5, 0., d);
        vec3 c = mix(vec3(.6,.8,1.), vec3(1.,.8,.7), vR);
        gl_FragColor = vec4(c * a * vT * 1.4, a);
      }`,
  }),
);
stars.renderOrder = -9;
scene.add(stars);

// ---- Warp streaks (lines stretched toward the camera, visible when uWarp > 0) ----
const STREAK_N = 700;
const lp = new Float32Array(STREAK_N * 6);
const le = new Float32Array(STREAK_N * 2);
for (let i = 0; i < STREAK_N; i++) {
  const a = Math.random() * Math.PI * 2;
  const r = 1.5 + Math.random() * 18;
  const z = -80 + Math.random() * 100;
  const x = Math.cos(a) * r, y = Math.sin(a) * r;
  lp.set([x, y, z, x, y, z], i * 6);
  le[i * 2] = 0; le[i * 2 + 1] = 1;
}
const lg = new THREE.BufferGeometry();
lg.setAttribute('position', new THREE.BufferAttribute(lp, 3));
lg.setAttribute('aEnd', new THREE.BufferAttribute(le, 1));
export const streaks = new THREE.LineSegments(
  lg,
  new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uWarp: globalU.uWarp, uTime: globalU.uTime, uTint: { value: new THREE.Color('#9fd8ff') } },
    vertexShader: /* glsl */ `
      attribute float aEnd; uniform float uWarp, uTime; varying float vA;
      void main(){
        vec3 p = position;
        p.z = mod(p.z + uTime * (4. + uWarp * 90.) + 80., 100.) - 80.;
        p.z -= aEnd * uWarp * 22.;
        vA = (1. - aEnd * .8) * smoothstep(0., .08, uWarp);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.);
      }`,
    fragmentShader: /* glsl */ `varying float vA; uniform vec3 uTint; void main(){ gl_FragColor = vec4(uTint * 2. * vA, vA); }`,
  }),
);
streaks.frustumCulled = false;
streaks.renderOrder = -8;
scene.add(streaks);

export function setNebula(c1, c2, intensity = 0.55) {
  bgU.uC1.value.set(c1); bgU.uC2.value.set(c2); bgU.uIntensity.value = intensity;
}
export { stars, sky };
