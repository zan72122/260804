/* =========================================================================
   shaders.js — GLSL ES 3.00 sources
   ========================================================================= */
'use strict';

const SH = {};

/* ------------------------------------------------------------ common bits */
SH.common = `
const float PI = 3.14159265359;

vec3 acesFilm(vec3 x){
  const float a=2.51, b=0.03, c=2.43, d=0.59, e=0.14;
  return clamp((x*(a*x+b))/(x*(c*x+d)+e), 0.0, 1.0);
}
vec2 dirToEquirect(vec3 d){
  return vec2(atan(d.x, d.z)/(2.0*PI)+0.5, acos(clamp(d.y,-1.0,1.0))/PI);
}
`;

/* --------------------------------------------------------------- geometry */
SH.mainVS = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNrm;
layout(location=2) in vec2 aUV;
layout(location=3) in float aAO;
uniform mat4 uMVP, uModel, uView;
uniform mat3 uNM;
out vec3 vWP;
out vec3 vN;
out vec2 vUV;
out float vAO;
out vec3 vVP;
void main(){
  vec4 wp = uModel * vec4(aPos,1.0);
  vWP = wp.xyz;
  vN  = normalize(uNM * aNrm);
  vUV = aUV;
  vAO = aAO;
  vVP = (uView * wp).xyz;
  gl_Position = uMVP * vec4(aPos,1.0);
}`;

/* ------------------------------------------------------ depth+normal prepass */
SH.prepassFS = `#version 300 es
precision highp float;
in vec3 vN; in vec3 vVP; in vec2 vUV; in vec3 vWP; in float vAO;
uniform mat4 uView;
layout(location=0) out vec4 oNZ;
void main(){
  vec3 nv = normalize(mat3(uView) * normalize(vN));
  oNZ = vec4(nv, -vVP.z);
}`;

/* ------------------------------------------------------------ shadow pass */
SH.shadowVS = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNrm;
layout(location=2) in vec2 aUV;
layout(location=3) in float aAO;
uniform mat4 uMVP;
void main(){ gl_Position = uMVP * vec4(aPos,1.0); }`;
SH.shadowFS = `#version 300 es
precision highp float;
void main(){}`;

/* ------------------------------------------------------------- main PBR */
SH.mainFS = `#version 300 es
precision highp float;
${SH.common}
in vec3 vWP; in vec3 vN; in vec2 vUV; in float vAO; in vec3 vVP;

uniform sampler2D uAlb, uORM, uNrm, uEnv, uExtra;
uniform highp sampler2DShadow uShadow;
uniform sampler2D uAO2;

uniform vec3 uCam;
uniform vec3 uTint;
uniform vec2 uUVScale;
uniform vec2 uRough;        // x: multiply, y: add
uniform float uMetal;       // multiply
uniform vec3 uEmissive;
uniform float uNormalAmt;
uniform int  uMode;         // 0 solid, 1 latte surface, 2 liquid, 3 unlit
uniform float uAlpha;

uniform vec3 uKeyPos, uKeyColor, uKeyDir;
uniform float uKeyCone, uKeyRange;
uniform vec3 uLamp2Pos, uLamp2Color;
uniform mat4 uLightMVP;
uniform vec2 uShadowTexel;
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform float uEnvIntensity;
uniform vec2 uScreen;
uniform float uSsaoOn;

out vec4 oColor;

vec3 envSample(vec3 d, float lod){
  return textureLod(uEnv, dirToEquirect(d), lod).rgb;
}
vec3 envDiffuse(vec3 n){ return envSample(n, 6.0); }
vec3 envSpecular(vec3 r, float rough){ return envSample(r, rough*6.0); }

// Karis' analytic environment BRDF (avoids a LUT)
vec3 envBRDFApprox(vec3 f0, float rough, float ndv){
  const vec4 c0 = vec4(-1.0, -0.0275, -0.572, 0.022);
  const vec4 c1 = vec4( 1.0,  0.0425,  1.04,  -0.04);
  vec4 r = rough * c0 + c1;
  float a004 = min(r.x*r.x, exp2(-9.28*ndv)) * r.x + r.y;
  vec2 ab = vec2(-1.04, 1.04) * a004 + r.zw;
  return f0 * ab.x + ab.y;
}

/* Milk is neutral white; crema, cocoa and honey are all strongly orange, so
   the blue:red ratio separates them cleanly whatever the base drink is.     */
float milkAt(vec2 uv){
  vec3 c = texture(uExtra, uv).rgb;
  return smoothstep(0.45, 0.84, c.b / max(c.r, 1e-4));
}

vec3 perturb(vec3 N, vec3 V, vec2 uv, vec3 mapN){
  vec3 dp1 = dFdx(-V), dp2 = dFdy(-V);
  vec2 duv1 = dFdx(uv), duv2 = dFdy(uv);
  vec3 dp2p = cross(dp2, N), dp1p = cross(N, dp1);
  vec3 T = dp2p*duv1.x + dp1p*duv2.x;
  vec3 B = dp2p*duv1.y + dp1p*duv2.y;
  float inv = inversesqrt(max(dot(T,T), dot(B,B)) + 1e-9);
  return normalize(mat3(T*inv, B*inv, N) * mapN);
}

float shadowAt(vec3 wp, float ndl){
  vec4 lp = uLightMVP * vec4(wp,1.0);
  vec3 pc = lp.xyz / lp.w * 0.5 + 0.5;
  if(pc.z > 1.0 || pc.x < 0.0 || pc.x > 1.0 || pc.y < 0.0 || pc.y > 1.0) return 1.0;
  float bias = mix(0.0016, 0.0004, ndl);
  float s = 0.0;
  for(int y=-1;y<=1;y++)
    for(int x=-1;x<=1;x++)
      s += texture(uShadow, vec3(pc.xy + vec2(float(x),float(y))*uShadowTexel, pc.z - bias));
  return s / 9.0;
}

void main(){
  vec2 uv = vUV * uUVScale;
  vec3 V  = normalize(uCam - vWP);
  vec3 N  = normalize(vN);

  vec3 albedo; float rough; float metal; float texAO = 1.0; float alpha = uAlpha;

  if(uMode == 1){
    // ---- latte surface: milk coverage drives colour, gloss and relief
    vec4 s = texture(uExtra, vUV);
    albedo = s.rgb * uTint;
    float milk = milkAt(vUV);
    // real micro-foam sits proud of the crema; derive relief from the field
    float e = 1.0/128.0;
    float hx = milkAt(vUV + vec2(e,0.0)) - milkAt(vUV - vec2(e,0.0));
    float hy = milkAt(vUV + vec2(0.0,e)) - milkAt(vUV - vec2(0.0,e));
    vec3 mapN = normalize(vec3(-hx*2.2, -hy*2.2, 1.0));
    N = perturb(N, V, vUV, mapN);
    rough = mix(0.13, 0.52, milk);   // crema is glossy, foam is not
    metal = 0.0;
    alpha = 1.0;
  } else {
    vec4 a = texture(uAlb, uv);
    albedo = a.rgb * uTint;
    vec3 orm = texture(uORM, uv).rgb;
    texAO = orm.r;
    rough = clamp(orm.g * uRough.x + uRough.y, 0.025, 1.0);
    metal = orm.b * uMetal;
    if(uNormalAmt > 0.001){
      vec3 mapN = texture(uNrm, uv).rgb * 2.0 - 1.0;
      mapN.xy *= uNormalAmt;
      N = perturb(N, V, uv, normalize(mapN));
    }
  }
  if(uMode == 3){
    oColor = vec4(albedo * uEmissive, alpha);
    return;
  }

  float ssao = 1.0;
  if(uSsaoOn > 0.5) ssao = texture(uAO2, gl_FragCoord.xy / uScreen).r;
  float ao = texAO * vAO * ssao;
  // The inside of a white cup is a bounce box: the crema is lit far more than
  // a naive single-bounce ambient suggests, and cavity occlusion barely bites.
  float bounce = 1.0;
  if(uMode == 1){ ao = mix(ao, 1.0, 0.65); bounce = 2.4; }

  float ndv = max(dot(N,V), 1e-4);
  vec3 f0 = mix(vec3(0.04), albedo, metal);
  vec3 diffCol = albedo * (1.0 - metal);

  vec3 lit = vec3(0.0);

  // ---- key: pendant lamp over the bar (shadow-mapped spot)
  {
    vec3 Lv = uKeyPos - vWP;
    float dist = length(Lv);
    vec3 L = Lv / max(dist, 1e-4);
    float ndl = max(dot(N,L), 0.0);
    float spot = smoothstep(uKeyCone*0.55, uKeyCone, dot(-L, normalize(uKeyDir)));
    float atten = 1.0 / (1.0 + (dist/uKeyRange)*(dist/uKeyRange));
    if(ndl > 0.0 && spot > 0.0){
      float sh = shadowAt(vWP, ndl);
      vec3 H = normalize(L+V);
      float ndh = max(dot(N,H),0.0), vdh = max(dot(V,H),0.0);
      float a2 = rough*rough; a2 *= a2;
      float d = a2 / (PI * pow(ndh*ndh*(a2-1.0)+1.0, 2.0));
      float k = rough*rough*0.5;
      float g = (ndl/(ndl*(1.0-k)+k)) * (ndv/(ndv*(1.0-k)+k));
      vec3 F = f0 + (1.0-f0)*pow(1.0-vdh, 5.0);
      vec3 spec = d*g*F / (4.0*ndl*ndv + 1e-4);
      lit += (diffCol/PI + spec) * uKeyColor * ndl * atten * spot * sh;
    }
  }
  // ---- the machine's own group lamp: small, warm, unshadowed
  {
    vec3 Lv = uLamp2Pos - vWP;
    float dist = length(Lv);
    vec3 L = Lv / max(dist,1e-4);
    float ndl = max(dot(N,L), 0.0);
    float atten = 1.0/(1.0 + pow(dist/340.0, 2.0));
    vec3 H = normalize(L+V);
    float ndh = max(dot(N,H),0.0), vdh = max(dot(V,H),0.0);
    float a2 = rough*rough; a2*=a2;
    float d = a2/(PI*pow(ndh*ndh*(a2-1.0)+1.0,2.0));
    float k = rough*rough*0.5;
    float g = (ndl/(ndl*(1.0-k)+k))*(ndv/(ndv*(1.0-k)+k));
    vec3 F = f0 + (1.0-f0)*pow(1.0-vdh,5.0);
    lit += (diffCol/PI + d*g*F/(4.0*ndl*ndv+1e-4)) * uLamp2Color * ndl * atten;
  }

  // ---- image-based ambient: the room itself
  vec3 R = reflect(-V, N);
  vec3 irr = envDiffuse(N) * uEnvIntensity;
  vec3 pre = envSpecular(R, rough) * uEnvIntensity;
  vec3 amb = (diffCol * irr * ao) * bounce + pre * envBRDFApprox(f0, rough, ndv) * mix(1.0, ao, 0.6);

  vec3 col = lit + amb + uEmissive;

  if(uMode == 2){
    // liquid: a thin dark body plus a strong sky glint
    float fres = pow(1.0 - ndv, 4.0);
    col += envSpecular(R, 0.06) * uEnvIntensity * (0.05 + fres * 0.7);
  }

  // ---- atmospheric perspective
  float dist = length(uCam - vWP);
  float fog = 1.0 - exp(-pow(dist * uFogDensity, 2.0));
  col = mix(col, uFogColor, clamp(fog, 0.0, 1.0));

  oColor = vec4(col, alpha);
}`;

/* ------------------------------------------------------------ fullscreen */
SH.quadVS = `#version 300 es
layout(location=0) in vec2 aPos;
out vec2 vUV;
void main(){ vUV = aPos*0.5+0.5; gl_Position = vec4(aPos,0.0,1.0); }`;

SH.ssaoFS = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uNZ;
uniform vec2 uTanHalf;
uniform vec2 uRes;
uniform float uRadius, uStrength, uBias;
uniform mat4 uProj;
out vec4 oColor;

vec3 viewPos(vec2 uv, float z){
  vec2 ndc = uv*2.0-1.0;
  return vec3(ndc.x*uTanHalf.x*z, ndc.y*uTanHalf.y*z, -z);
}
float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3,289.1)))*43758.5453); }

void main(){
  vec4 nz = texture(uNZ, vUV);
  float z = nz.w;
  if(z <= 0.0001){ oColor = vec4(1.0); return; }
  vec3 P = viewPos(vUV, z);
  vec3 N = normalize(nz.xyz);
  float ang = hash(gl_FragCoord.xy) * 6.2831853;
  float ca = cos(ang), sa = sin(ang);
  float occ = 0.0;
  const int K = 12;
  for(int i=0;i<K;i++){
    float fi = (float(i)+0.5)/float(K);
    float a = fi * 6.2831853 * 3.0 + ang;
    float r = uRadius * sqrt(fi);
    vec3 dir = vec3(cos(a), sin(a), 0.0);
    dir.z = hash(vec2(fi, ang)) * 0.9 + 0.1;
    dir = normalize(dir);
    if(dot(dir, N) < 0.0) dir = -dir + N*0.2;
    vec3 S = P + dir * r;
    vec4 cp = uProj * vec4(S, 1.0);
    vec2 su = (cp.xy/cp.w)*0.5+0.5;
    if(su.x<0.0||su.x>1.0||su.y<0.0||su.y>1.0) continue;
    float sz = texture(uNZ, su).w;
    if(sz <= 0.0001) continue;
    float diff = (-S.z) - sz;
    float rangeCheck = smoothstep(0.0, 1.0, uRadius / max(abs((-P.z) - sz), 1e-3));
    if(diff > uBias) occ += rangeCheck;
  }
  float ao = 1.0 - (occ/float(K)) * uStrength;
  oColor = vec4(clamp(ao,0.0,1.0));
}`;

SH.blurFS = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uTex;
uniform vec2 uDir;      // texel-sized step
out vec4 oColor;
void main(){
  vec4 s = texture(uTex, vUV) * 0.227027;
  s += (texture(uTex, vUV + uDir*1.3846) + texture(uTex, vUV - uDir*1.3846)) * 0.316216;
  s += (texture(uTex, vUV + uDir*3.2308) + texture(uTex, vUV - uDir*3.2308)) * 0.070270;
  oColor = s;
}`;

SH.downFS = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uTex;
uniform vec2 uTexel;
out vec4 oColor;
void main(){
  vec4 s = texture(uTex, vUV + uTexel*vec2(-1.0,-1.0));
  s += texture(uTex, vUV + uTexel*vec2( 1.0,-1.0));
  s += texture(uTex, vUV + uTexel*vec2(-1.0, 1.0));
  s += texture(uTex, vUV + uTexel*vec2( 1.0, 1.0));
  oColor = s * 0.25;
}`;

SH.brightFS = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uTex;
uniform float uThreshold;
out vec4 oColor;
void main(){
  vec3 c = texture(uTex, vUV).rgb;
  float l = dot(c, vec3(0.2126,0.7152,0.0722));
  float k = max(0.0, l - uThreshold) / max(l, 1e-4);
  oColor = vec4(c * k, 1.0);
}`;

SH.compositeFS = `#version 300 es
precision highp float;
${SH.common}
in vec2 vUV;
uniform sampler2D uHDR, uBlur, uBloom, uNZ;
uniform float uExposure, uBloomAmt, uVignette, uGrain, uTime;
uniform vec2 uFocus;      // x: focus distance, y: 1/range
out vec4 oColor;

void main(){
  vec3 c = texture(uHDR, vUV).rgb;

  // far-field softening: distance blur reads as air between the layers
  float z = texture(uNZ, vUV).w;
  float coc = clamp((z - uFocus.x) * uFocus.y, 0.0, 1.0);
  coc = coc * coc;
  if(z <= 0.0001) coc = 1.0;
  c = mix(c, texture(uBlur, vUV).rgb, coc * 0.85);

  c += texture(uBloom, vUV).rgb * uBloomAmt;

  c *= uExposure;
  c = acesFilm(c);

  // gentle filmic finish
  vec2 q = vUV - 0.5;
  float vig = 1.0 - dot(q,q) * uVignette;
  c *= vig;
  float g = fract(sin(dot(vUV*vec2(1024.0,768.0) + uTime, vec2(12.9898,78.233)))*43758.5453);
  c += (g - 0.5) * uGrain;

  oColor = vec4(pow(max(c, vec3(0.0)), vec3(1.0/2.2)), 1.0);
}`;

/* ------------------------------------------------- soft particles (steam) */
SH.spriteVS = `#version 300 es
layout(location=0) in vec3 aPos;     // centre in world space
layout(location=1) in vec3 aNrm;     // x: size, y: alpha, z: seed
layout(location=2) in vec2 aUV;      // corner offset -1..1
layout(location=3) in float aAO;
uniform mat4 uVP, uView;
out vec2 vUV; out float vA; out float vSeed; out float vZ;
void main(){
  vec3 right = vec3(uView[0][0], uView[1][0], uView[2][0]);
  vec3 up    = vec3(uView[0][1], uView[1][1], uView[2][1]);
  vec3 wp = aPos + (right*aUV.x + up*aUV.y) * aNrm.x;
  vUV = aUV*0.5+0.5; vA = aNrm.y; vSeed = aNrm.z;
  vec4 vp = uView * vec4(wp,1.0);
  vZ = -vp.z;
  gl_Position = uVP * vec4(wp,1.0);
}`;
SH.spriteFS = `#version 300 es
precision highp float;
in vec2 vUV; in float vA; in float vSeed; in float vZ;
uniform sampler2D uNZ;
uniform vec2 uScreen;
uniform vec3 uColor;
out vec4 oColor;
void main(){
  vec2 d = vUV*2.0-1.0;
  float r = dot(d,d);
  if(r > 1.0) discard;
  float a = pow(1.0 - r, 1.6) * vA;
  // soft against geometry so steam does not cut a hard edge on the pitcher
  float sceneZ = texture(uNZ, gl_FragCoord.xy/uScreen).w;
  if(sceneZ > 0.0001) a *= clamp((sceneZ - vZ)/26.0, 0.0, 1.0);
  oColor = vec4(uColor * a, a);
}`;
