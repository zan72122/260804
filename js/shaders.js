// All GLSL for the game. WebGL2 / GLSL ES 3.00.

export const COMMON = /* glsl */`
precision highp float;
precision highp int;

float hash11(float p){ p = fract(p*0.1031); p *= p+33.33; p *= p+p; return fract(p); }
float hash12(vec2 p){
  vec3 p3 = fract(vec3(p.xyx)*0.1031);
  p3 += dot(p3, p3.yzx+33.33);
  return fract((p3.x+p3.y)*p3.z);
}
vec2 hash22(vec2 p){
  vec3 p3 = fract(vec3(p.xyx)*vec3(0.1031,0.1030,0.0973));
  p3 += dot(p3, p3.yzx+33.33);
  return fract((p3.xx+p3.yz)*p3.zy);
}
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f*f*(3.0-2.0*f);
  float a = hash12(i), b = hash12(i+vec2(1,0));
  float c = hash12(i+vec2(0,1)), d = hash12(i+vec2(1,1));
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}
float fbm(vec2 p){
  float s = 0.0, a = 0.5;
  for(int i=0;i<5;i++){ s += a*vnoise(p); p *= 2.03; p += 11.7; a *= 0.5; }
  return s;
}
float fbm3(vec2 p){
  float s = 0.0, a = 0.5;
  for(int i=0;i<3;i++){ s += a*vnoise(p); p *= 2.11; a *= 0.5; }
  return s;
}
// GLSL leaves smoothstep undefined when edge0 >= edge1, and several of the
// falloffs here run backwards on purpose, so use an explicit version.
float sstep(float e0, float e1, float x){
  float t = clamp((x-e0)/(e1-e0), 0.0, 1.0);
  return t*t*(3.0-2.0*t);
}
vec3 tonemap(vec3 x){
  // Filmic-ish curve, keeps the warm workshop light from clipping harshly.
  x = max(vec3(0.0), x);
  vec3 c = (x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14);
  return pow(clamp(c,0.0,1.0), vec3(1.0/2.2));
}
`;

export const LIGHTING = /* glsl */`
uniform vec3 uSunDir;      // pointing from surface toward the light
uniform vec3 uSunColor;
uniform vec3 uSkyColor;
uniform vec3 uGroundColor;
uniform vec3 uFillDir;
uniform vec3 uFillColor;
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform vec3 uCamPos;

float ggx(vec3 N, vec3 V, vec3 L, float rough){
  vec3 H = normalize(V+L);
  float a = max(rough*rough, 1e-3);
  float a2 = a*a;
  float NdH = max(dot(N,H),0.0);
  float d = (NdH*NdH*(a2-1.0)+1.0);
  float D = a2/(3.14159*d*d);
  float NdV = max(dot(N,V),1e-4), NdL = max(dot(N,L),1e-4);
  float k = a*0.5;
  float G = (NdL/(NdL*(1.0-k)+k))*(NdV/(NdV*(1.0-k)+k));
  return D*G/(4.0*NdV*NdL)*NdL;
}

vec3 shade(vec3 N, vec3 V, vec3 albedo, float rough, float specAmt, float ao, float shadow){
  float NdL = max(dot(N, uSunDir), 0.0);
  vec3 diff = albedo * uSunColor * NdL * shadow;
  float fillD = max(dot(N, uFillDir), 0.0);
  diff += albedo * uFillColor * fillD * 0.55;
  float hemi = N.y*0.5+0.5;
  diff += albedo * mix(uGroundColor, uSkyColor, hemi) * ao;
  vec3 spec = uSunColor * ggx(N,V,uSunDir,rough) * specAmt * shadow;
  spec += uFillColor * ggx(N,V,uFillDir,rough) * specAmt * 0.35;
  // Cheap rim term: keeps silhouettes readable against the dim background.
  // The base is clamped: a surface facing the camera can land a hair above 1.0
  // and pow() of a negative base is undefined.
  float rim = pow(max(1.0-max(dot(N,V),0.0), 0.0), 3.0);
  vec3 rimC = uSkyColor * rim * 0.35 * ao;
  return diff + spec + rimC;
}

vec3 applyFog(vec3 col, vec3 worldPos){
  float d = length(worldPos - uCamPos);
  float h = clamp(1.0 - worldPos.y*0.06, 0.5, 1.4);
  float f = 1.0 - exp(-d*uFogDensity*h);
  return mix(col, uFogColor, clamp(f,0.0,0.92));
}
`;

export const SHADOW = /* glsl */`
uniform sampler2D uShadowMap;
uniform mat4 uLightVP;
uniform float uShadowTexel;
float sampleShadow(vec3 worldPos, float NdL){
  vec4 lp = uLightVP * vec4(worldPos,1.0);
  vec3 pc = lp.xyz/lp.w * 0.5 + 0.5;
  if(pc.x<0.005||pc.x>0.995||pc.y<0.005||pc.y>0.995||pc.z>1.0) return 1.0;
  float bias = max(0.0016*(1.0-NdL), 0.0006);
  float s = 0.0;
  for(int y=-1;y<=1;y++){
    for(int x=-1;x<=1;x++){
      float d = texture(uShadowMap, pc.xy + vec2(float(x),float(y))*uShadowTexel).r;
      s += (pc.z - bias > d) ? 0.28 : 1.0;
    }
  }
  return s/9.0;
}
`;

// ---------------------------------------------------------------------------
// Workshop geometry
// ---------------------------------------------------------------------------

export const SCENE_VS = /* glsl */`#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec2 aUV;
layout(location=3) in vec4 aExtra;
uniform mat4 uMVP;
uniform mat4 uModel;
uniform mat3 uNormalMat;
out vec3 vWorld;
out vec3 vNormal;
out vec2 vUV;
out vec4 vExtra;
void main(){
  vec4 wp = uModel * vec4(aPos,1.0);
  vWorld = wp.xyz;
  vNormal = normalize(uNormalMat * aNormal);
  vUV = aUV;
  vExtra = aExtra;
  gl_Position = uMVP * vec4(aPos,1.0);
}`;

export const SCENE_FS = /* glsl */`#version 300 es
${COMMON}
${LIGHTING}
${SHADOW}
in vec3 vWorld;
in vec3 vNormal;
in vec2 vUV;
in vec4 vExtra;
out vec4 outColor;
uniform float uTime;
uniform float uBatikHue;

// Material ids: 0 plain, 1 wood, 2 clay/earthenware, 3 copper, 4 plaster wall,
// 5 bamboo, 6 leaf, 7 skin, 8 batik cloth (sarong / hanging), 9 dark metal,
// 10 woven basket, 11 embers
void main(){
  vec3 N = normalize(vNormal);
  if(!gl_FrontFacing) N = -N;
  vec3 V = normalize(uCamPos - vWorld);
  vec3 albedo = vExtra.rgb;
  float rough = 0.75, spec = 0.12, ao = 1.0;
  int mat = int(vExtra.a + 0.5);

  if(mat==1){ // wood: grain rings plus wear on edges
    float g = fbm(vec2(vWorld.y*9.0 + vWorld.x*0.6, vWorld.x*1.7));
    float rings = sin(vWorld.y*54.0 + g*7.0)*0.5+0.5;
    albedo *= 0.80 + 0.24*rings*g + 0.10*fbm3(vUV*24.0);
    float wear = sstep(0.55,1.0,fbm3(vWorld.xz*3.1+vWorld.y*2.0));
    albedo = mix(albedo, albedo*1.18+vec3(0.03,0.02,0.01), wear*0.5);
    rough = 0.62 - 0.15*wear; spec = 0.18;
  } else if(mat==2){ // fired clay, slightly chalky with soot
    float n = fbm(vUV*13.0 + vWorld.xz*2.0);
    albedo *= 0.86+0.26*n;
    float soot = sstep(0.45,0.95,fbm(vWorld.xz*4.0+vec2(0.0,vWorld.y*3.0)));
    albedo = mix(albedo, albedo*0.32, soot*0.42);
    rough = 0.88; spec = 0.06;
  } else if(mat==3){ // copper canting / wajan: warm anisotropic metal, patina
    float n = fbm3(vUV*30.0);
    albedo *= 0.9+0.3*n;
    float patina = sstep(0.5,0.9,fbm(vWorld.xy*7.0));
    albedo = mix(albedo, vec3(0.32,0.42,0.36), patina*0.30);
    rough = 0.24+0.22*n; spec = 1.35;
  } else if(mat==4){ // lime-washed plaster wall
    float n = fbm(vUV*7.0)*0.5 + fbm(vUV*31.0)*0.5;
    albedo *= 0.82+0.30*n;
    float damp = sstep(0.75,0.0,vWorld.y);
    albedo = mix(albedo, albedo*vec3(0.74,0.72,0.66), damp*0.55);
    // Soot and shadow gather high up, so the wall falls away above the frame.
    albedo *= mix(1.0, 0.42, clamp((vWorld.y-1.6)/2.6, 0.0, 1.0));
    rough = 0.95; spec = 0.03;
  } else if(mat==5){ // bamboo: nodes and vertical fibres
    float node = sstep(0.02,0.0,abs(fract(vWorld.y*1.4)-0.5)-0.46);
    albedo *= 0.85+0.2*fbm3(vec2(vUV.x*40.0, vWorld.y*3.0));
    albedo = mix(albedo, albedo*0.7, node);
    rough = 0.55; spec = 0.24;
  } else if(mat==6){ // foliage
    float v = fbm(vUV*9.0);
    albedo *= 0.7+0.6*v;
    rough = 0.7; spec = 0.2;
  } else if(mat==7){ // skin
    rough = 0.62; spec = 0.22;
    albedo *= 0.96+0.08*fbm3(vUV*18.0);
  } else if(mat==8){ // batik cloth on the artisan / hanging in the background
    vec2 p = vUV*vec2(6.0,8.0);
    p += (fbm3(vUV*9.0)-0.5)*0.35;            // hand-drawn wobble
    float d1 = length(fract(p)-0.5);
    float ring = sstep(0.33,0.29,d1)*sstep(0.19,0.23,d1);
    float dots = sstep(0.10,0.07,length(fract(p+0.5)-0.5));
    float weave = 0.92+0.08*sin(vUV.x*240.0)*sin(vUV.y*240.0);
    vec3 dark = albedo*0.42 + vec3(0.015,0.012,0.008);
    vec3 light = albedo*1.05 + vec3(0.035);
    albedo = mix(dark, light, clamp(ring+dots,0.0,1.0)*0.8);
    albedo *= weave;
    rough = 0.85; spec = 0.07;
  } else if(mat==9){ // blackened iron
    rough = 0.42; spec = 0.6;
    albedo *= 0.85+0.25*fbm3(vUV*22.0);
  } else if(mat==10){ // woven basket / bamboo mat
    float wv = sin(vUV.x*160.0)*sin(vUV.y*160.0);
    albedo *= 0.78+0.35*step(0.0,wv)+0.12*fbm3(vUV*40.0);
    rough = 0.8; spec = 0.1;
  } else if(mat==12){ // emissive: daylight through the window, robot eyes, lamp
    outColor = vec4(applyFog(albedo, vWorld), 1.0);
    return;
  } else if(mat==11){ // embers under the wax pan
    float f = fbm(vUV*8.0 + vec2(0.0, uTime*0.6));
    float glow = sstep(0.35,0.9,f);
    outColor = vec4(applyFog(mix(vec3(0.28,0.07,0.02), vec3(2.4,0.85,0.22), glow), vWorld),1.0);
    return;
  }

  float NdL = max(dot(N,uSunDir),0.0);
  float sh = sampleShadow(vWorld, NdL);
  vec3 col = shade(N,V,albedo,rough,spec,ao,sh);
  col = applyFog(col, vWorld);
  outColor = vec4(col, 1.0);
}`;

export const DEPTH_VS = /* glsl */`#version 300 es
layout(location=0) in vec3 aPos;
uniform mat4 uMVP;
void main(){ gl_Position = uMVP * vec4(aPos,1.0); }`;

export const DEPTH_FS = /* glsl */`#version 300 es
precision highp float;
out vec4 outColor;
void main(){ outColor = vec4(1.0); }`;

// ---------------------------------------------------------------------------
// The cloth
// ---------------------------------------------------------------------------

export const CLOTH_VS = /* glsl */`#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec2 aUV;
uniform mat4 uMVP;
out vec3 vWorld;
out vec3 vNormal;
out vec2 vUV;
void main(){
  vWorld = aPos;            // cloth vertices are already in world space
  vNormal = aNormal;
  vUV = aUV;
  gl_Position = uMVP * vec4(aPos,1.0);
}`;

export const CLOTH_FS = /* glsl */`#version 300 es
${COMMON}
${LIGHTING}
${SHADOW}
in vec3 vWorld;
in vec3 vNormal;
in vec2 vUV;
out vec4 outColor;

uniform sampler2D uColorTex;   // rgb dyed colour, a wetness
uniform sampler2D uWaxTex;     // r coverage, g height, b cooled, a molten heat
uniform sampler2D uGuideTex;   // r guide strength, g motif fill hint
uniform float uTime;
uniform float uLiquidY;
uniform vec3  uLiquidColor;
uniform float uLiquidDensity;
uniform float uGuideVisible;
uniform float uTexel;
uniform float uRevealGlow;     // rises during nglorod for the reveal shimmer
uniform float uLorodFront;     // < 0 outside nglorod
uniform float uLorodWidth;

void main(){
  vec2 uv = vUV;
  vec4 c = texture(uColorTex, uv);
  vec4 w = texture(uWaxTex, uv);

  // ---- woven structure: warp over weft, with slub irregularity -----------
  vec2 wp = uv*vec2(300.0, 300.0);
  float warp = sin(wp.x*3.14159);
  float weft = sin(wp.y*3.14159);
  float interlace = warp*weft;
  float slub = fbm3(uv*90.0);
  float weaveShade = 0.90 + 0.10*sign(interlace)*abs(interlace) + 0.07*(slub-0.5);
  float fuzz = fbm(uv*260.0)*0.06;

  vec3 albedo = c.rgb * weaveShade;
  albedo *= 1.0 - fuzz*0.5;

  // ---- wetness: darker, glossier, and slightly more saturated -----------
  float wet = clamp(c.a, 0.0, 1.0);
  vec3 wetCol = albedo*albedo*1.25;           // darkening of soaked fibre
  albedo = mix(albedo, wetCol, wet*0.85);

  // ---- cloth normal from geometry + weave micro-relief -------------------
  vec3 N = normalize(vNormal);
  if(!gl_FrontFacing) N = -N;
  vec3 dpx = dFdx(vWorld), dpy = dFdy(vWorld);
  vec3 T = normalize(dpx);
  vec3 B = normalize(cross(N,T));
  float wn = (warp*0.5 + weft*0.5)*0.035 + (slub-0.5)*0.05;
  N = normalize(N + T*wn*1.2 + B*wn*0.8);

  float rough = mix(0.92, 0.55, wet);
  float spec  = mix(0.05, 0.42, wet);

  // ---- wax: a raised, translucent amber layer that hides what it covers --
  float wax = clamp(w.r, 0.0, 1.0);
  float waxA = sstep(0.04, 0.42, wax);
  if(waxA > 0.001){
    // Height gradient -> a real ridge with a lit crest and a shaded flank.
    float hL = texture(uWaxTex, uv-vec2(uTexel,0.0)).g;
    float hR = texture(uWaxTex, uv+vec2(uTexel,0.0)).g;
    float hD = texture(uWaxTex, uv-vec2(0.0,uTexel)).g;
    float hU = texture(uWaxTex, uv+vec2(0.0,uTexel)).g;
    vec3 waxN = normalize(N - T*(hR-hL)*9.0 - B*(hU-hD)*9.0);

    float heat = clamp(w.a,0.0,1.0);          // 1 = just poured, warm and glossy
    float cooled = clamp(1.0 - w.a,0.0,1.0);  // 1 = fully set and clouded
    float layer = w.b;                        // 0 = first waxing, 1 = second
    vec3 hotWax  = vec3(0.95,0.58,0.13);
    vec3 coolWax = vec3(0.76,0.55,0.26);
    vec3 waxCol = mix(coolWax, hotWax, heat);
    // The second round of wax is laid over dyed cloth and reads a shade deeper.
    waxCol *= mix(1.0, 0.88, clamp(layer,0.0,1.0));
    // Clouding: cold wax scatters, going pale and waxy rather than glassy.
    waxCol = mix(waxCol, vec3(0.86,0.76,0.58), cooled*0.38);
    // A little of the cloth reads through the thinnest edges of the line.
    float translucency = sstep(0.9,0.25,waxA)*0.35;
    waxCol = mix(waxCol, waxCol*0.6 + albedo*0.55, translucency);

    N = normalize(mix(N, waxN, waxA));
    albedo = mix(albedo, waxCol, waxA*0.94);
    rough = mix(rough, mix(0.13, 0.46, cooled), waxA);
    spec  = mix(spec,  mix(1.15, 0.42, cooled), waxA);
  }

  // ---- the resist boundary: dye crowds up against the wax edge -----------
  float gx = texture(uWaxTex, uv+vec2(uTexel*1.5,0.0)).r - texture(uWaxTex, uv-vec2(uTexel*1.5,0.0)).r;
  float gy = texture(uWaxTex, uv+vec2(0.0,uTexel*1.5)).r - texture(uWaxTex, uv-vec2(0.0,uTexel*1.5)).r;
  float edge = clamp(length(vec2(gx,gy))*3.2, 0.0, 1.0);
  albedo *= 1.0 - edge*0.18*(1.0-waxA);

  // ---- faint guide line for the motif (drawn under everything) ----------
  float guide = texture(uGuideTex, uv).r * uGuideVisible * (1.0-waxA);
  albedo = mix(albedo, albedo*0.86 + vec3(0.10,0.12,0.16)*0.5, guide*0.5);

  vec3 V = normalize(uCamPos - vWorld);
  float NdL = max(dot(N,uSunDir),0.0);
  float sh = sampleShadow(vWorld, NdL);
  vec3 col = shade(N,V,albedo,rough,spec,1.0,sh);

  // ---- submerged part: the dye bath absorbs light through its depth -----
  float depth = uLiquidY - vWorld.y;
  if(depth > 0.0){
    float caustic = fbm(vWorld.xz*7.0 + vec2(uTime*0.7, uTime*0.5));
    float d = depth*uLiquidDensity;
    vec3 absorb = exp(-uLiquidColor*d*3.0);
    col *= absorb;
    col += uLiquidColor*0.18*sstep(0.0,0.25,depth)*(0.6+0.8*caustic);
    col = mix(col, col*1.0+vec3(0.02), 0.0);
    // Surface line where the cloth pierces the liquid.
    col += vec3(1.0,0.95,0.85)*sstep(0.03,0.0,abs(depth))*0.35;
  }

  // The nglorod front itself: a band of heat travelling across the cloth, with
  // the wax still amber ahead of it and the saved colours bare behind it.
  if(uLorodFront >= 0.0){
    float d = (uLorodFront - uv.x) / max(uLorodWidth, 1e-3);
    float band = exp(-d*d*7.0);
    float ahead = sstep(0.0, -0.6, d);        // still waxed, warming up
    col += vec3(1.00,0.72,0.34) * band * 0.24;
    col += vec3(1.00,0.88,0.62) * exp(-abs(d-0.12)*11.0) * 0.10;
    // Cloth just behind the front is still damp from the bath.
    float behind = sstep(0.0, 1.4, d);
    col *= mix(1.0, 0.94, behind*0.5);
    col += vec3(0.9,0.8,0.6) * ahead * 0.04;
  }

  // Reveal shimmer: light rakes across the fibres as the wax lets go.
  col += vec3(1.0,0.93,0.78) * uRevealGlow;

  col = applyFog(col, vWorld);
  outColor = vec4(col, 1.0);
}`;

// ---------------------------------------------------------------------------
// Fabric simulation passes (render to texture)
// ---------------------------------------------------------------------------

const FSQUAD_VS = /* glsl */`#version 300 es
layout(location=0) in vec2 aPos;
out vec2 vUV;
void main(){
  vUV = aPos*0.5+0.5;
  gl_Position = vec4(aPos,0.0,1.0);
}`;
export { FSQUAD_VS };

// Lays down wax along the segment the canting spout travelled.
// Drawn straight into the wax target with a MAX blend equation, so a stroke
// only ever adds wax and never has to read the previous texture back.
export const WAX_FS = /* glsl */`#version 300 es
${COMMON}
in vec2 vUV;
out vec4 outColor;
uniform vec2 uA;
uniform vec2 uB;
uniform float uRadius;
uniform float uFlow;       // 0..1, how much wax is coming out right now
uniform float uAspect;
uniform float uDrop;       // extra swell for a pause -> a wax droplet
uniform float uSeed;
uniform float uLayer;      // which waxing round this stroke belongs to

float segDist(vec2 p, vec2 a, vec2 b){
  vec2 pa = p-a, ba = b-a;
  float h = clamp(dot(pa,ba)/max(dot(ba,ba),1e-8),0.0,1.0);
  return length(pa-ba*h);
}

void main(){
  vec2 p = vec2(vUV.x*uAspect, vUV.y);
  vec2 a = vec2(uA.x*uAspect, uA.y);
  vec2 b = vec2(uB.x*uAspect, uB.y);

  // The nib wobbles a little, the way a hand-held canting does.
  float wob = (fbm3(p*130.0 + uSeed) - 0.5)*0.09;
  float d = segDist(p,a,b);
  float r = uRadius*(1.0 + wob) + uDrop*uRadius*0.85;
  float core = 1.0 - sstep(r*0.55, r, d);
  float halo = 1.0 - sstep(r, r*1.7, d);

  float amount = (core + halo*0.28) * uFlow;
  // Molten wax spreads into the weave, so the edge is never perfectly crisp.
  amount *= 0.85 + 0.3*fbm3(p*180.0 + uSeed*3.7);
  amount = clamp(amount, 0.0, 1.0);
  if(amount < 0.004) discard;

  float height = amount*(0.55+0.45*core);
  outColor = vec4(amount, height, uLayer, amount);
}`;

// Wax cools over time: the molten sheen drains out of it (heat -> 0), and the
// cloth shader reads cooled = 1 - heat to cloud it over.
export const WAX_COOL_FS = /* glsl */`#version 300 es
${COMMON}
in vec2 vUV;
out vec4 outColor;
uniform sampler2D uPrev;
uniform float uDT;
void main(){
  vec4 w = texture(uPrev, vUV);
  w.a = max(0.0, w.a - uDT*0.55);
  outColor = w;
}`;

// One dye step. Colour is removed subtractively, the way a real bath works,
// and only where the wax is not sealing the fibre.
export const DYE_FS = /* glsl */`#version 300 es
${COMMON}
in vec2 vUV;
out vec4 outColor;
uniform sampler2D uColor;
uniform sampler2D uWax;
uniform vec3 uAbsorb;
uniform float uRate;
uniform float uWetFront;    // 0..1 how far the bath has climbed up the cloth
uniform float uFrontSoft;
uniform float uTime;

void main(){
  vec4 c = texture(uColor, vUV);
  vec4 w = texture(uWax, vUV);

  // The bath climbs from the bottom edge of the cloth; the wet line is ragged
  // because the yarn wicks unevenly.
  float ragged = (fbm3(vUV*vec2(26.0,9.0)) - 0.5)*0.10;
  float submerged = sstep(uWetFront + uFrontSoft + ragged,
                               uWetFront - uFrontSoft + ragged, vUV.y);

  float seal = sstep(0.10, 0.55, w.r);
  // Dye creeps a hair under the wax edge - the softness real batik has.
  float creep = sstep(0.55, 0.95, w.r);
  float open = mix(1.0 - seal*0.90, 1.0 - creep, 0.35);
  open = clamp(open, 0.0, 1.0);

  float fibre = 0.72 + 0.56*fbm3(vUV*38.0);
  float take = uRate * submerged * open * fibre;

  vec3 col = c.rgb * exp(-uAbsorb * take);
  float wet = max(c.a, submerged*mix(0.35,1.0,open));
  outColor = vec4(col, clamp(wet,0.0,1.0));
}`;

// Slow drying between stages: wetness falls, colour lifts a little as it dries.
export const DRY_FS = /* glsl */`#version 300 es
${COMMON}
in vec2 vUV;
out vec4 outColor;
uniform sampler2D uColor;
uniform float uDT;
void main(){
  vec4 c = texture(uColor, vUV);
  c.a = max(0.0, c.a - uDT*0.35);
  outColor = c;
}`;

// Nglorod. A front travels across the cloth; wax clouds, softens, lifts, gone.
export const LOROD_FS = /* glsl */`#version 300 es
${COMMON}
in vec2 vUV;
out vec4 outColor;
uniform sampler2D uWax;
uniform float uFront;     // 0..1 position of the removal front
uniform float uWidth;
uniform float uDT;
void main(){
  vec4 w = texture(uWax, vUV);
  float ragged = (fbm(vUV*vec2(14.0,14.0))-0.5)*0.09;
  // How deep into the hot bath this texel already is.
  float t = clamp((uFront + ragged - vUV.x)/max(uWidth,1e-3), 0.0, 1.0);
  if(t > 0.0 && w.r > 0.0){
    float soften = sstep(0.0,0.35,t);
    float lift   = sstep(0.28,1.0,t);
    w.a = max(0.0, w.a - soften*uDT*3.0);        // any remaining sheen goes
    w.g = max(0.0, w.g - lift*uDT*3.4);          // the ridge flattens
    float grain = 0.55 + 0.9*fbm(vUV*70.0);      // then it breaks into flakes
    w.r = max(0.0, w.r - lift*uDT*2.8*grain);
  }
  outColor = w;
}`;

// Guide lines for the chosen motif, rasterised once into a small target.
export const GUIDE_FS = /* glsl */`#version 300 es
${COMMON}
in vec2 vUV;
out vec4 outColor;
uniform vec2 uA;
uniform vec2 uB;
uniform float uRadius;
float segDist(vec2 p, vec2 a, vec2 b){
  vec2 pa = p-a, ba = b-a;
  float h = clamp(dot(pa,ba)/max(dot(ba,ba),1e-8),0.0,1.0);
  return length(pa-ba*h);
}
void main(){
  float d = segDist(vUV, uA, uB);
  float v = 1.0 - sstep(uRadius*0.35, uRadius, d);
  if(v <= 0.001) discard;
  outColor = vec4(v, v, 0.0, 1.0);
}`;

// ---------------------------------------------------------------------------
// Liquid surface in the dye vats
// ---------------------------------------------------------------------------

export const LIQUID_VS = /* glsl */`#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec2 aUV;
uniform mat4 uMVP;
uniform mat4 uModel;
uniform float uTime;
uniform vec4 uRipples[6];   // xz centre, w start time, y strength
out vec3 vWorld;
out vec2 vUV;
out float vWave;
void main(){
  vec4 wp = uModel * vec4(aPos,1.0);
  float h = 0.0;
  h += sin(wp.x*7.0 + uTime*1.7)*0.004;
  h += sin(wp.z*9.0 - uTime*1.3)*0.003;
  h += sin((wp.x+wp.z)*13.0 + uTime*2.3)*0.0018;
  for(int i=0;i<6;i++){
    vec4 r = uRipples[i];
    if(r.y <= 0.0) continue;
    float age = uTime - r.w;
    if(age < 0.0 || age > 2.6) continue;
    float d = length(wp.xz - r.xz);
    float front = age*0.72;
    float env = exp(-age*1.5) * exp(-abs(d-front)*9.0);
    h += sin((d-front)*38.0)*env*r.y*0.05;
  }
  wp.y += h;
  vWorld = wp.xyz;
  vUV = aUV;
  vWave = h;
  gl_Position = uMVP * vec4(aPos.x, aPos.y + h, aPos.z, 1.0);
}`;

export const LIQUID_FS = /* glsl */`#version 300 es
${COMMON}
${LIGHTING}
in vec3 vWorld;
in vec2 vUV;
in float vWave;
out vec4 outColor;
uniform float uTime;
uniform vec3 uDyeColor;
uniform float uOpacity;

void main(){
  // Analytic normal from the same ripple field, plus fine chop.
  float e = 0.004;
  float n1 = fbm(vWorld.xz*22.0 + vec2(uTime*0.55, -uTime*0.4));
  float n2 = fbm(vWorld.xz*22.0 + vec2(e,0.0)*22.0 + vec2(uTime*0.55,-uTime*0.4));
  float n3 = fbm(vWorld.xz*22.0 + vec2(0.0,e)*22.0 + vec2(uTime*0.55,-uTime*0.4));
  vec3 N = normalize(vec3(-(n2-n1)*2.0, 1.0, -(n3-n1)*2.0));
  N = normalize(N + vec3(sin(vWorld.x*30.0+uTime*2.0)*0.05, 0.0, cos(vWorld.z*26.0-uTime*1.7)*0.05));

  vec3 V = normalize(uCamPos - vWorld);
  float fres = pow(max(1.0 - max(dot(N,V),0.0), 0.0), 5.0);

  // The bath is a translucent volume: the cloth underneath still reads through
  // it, tinted, which is the whole point of watching the colour take.
  vec3 body = uDyeColor * (0.55 + 0.45*fbm(vWorld.xz*5.0 + uTime*0.2));
  vec3 refl = mix(uSkyColor, uSunColor, 0.30);
  vec3 col = mix(body, refl, clamp(fres*0.85,0.0,0.55));
  col += uSunColor * ggx(N,V,uSunDir,0.09) * 0.9;
  // Powdery scum that natural indigo vats carry.
  col += vec3(0.035,0.04,0.045)*sstep(0.62,0.96,fbm(vWorld.xz*9.0+uTime*0.05));
  col = applyFog(col, vWorld);
  outColor = vec4(col, clamp(uOpacity + fres*0.30, 0.0, 1.0));
}`;

// ---------------------------------------------------------------------------
// Particles: splash droplets, drips, wax flakes, steam
// ---------------------------------------------------------------------------

export const PARTICLE_VS = /* glsl */`#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aData;   // size, kind, fade
uniform mat4 uMVP;
uniform vec2 uViewport;
out float vKind;
out float vFade;
void main(){
  gl_Position = uMVP * vec4(aPos,1.0);
  float scale = uViewport.y * aData.x / max(gl_Position.w, 0.05);
  gl_PointSize = clamp(scale, 1.0, 140.0);
  vKind = aData.y;
  vFade = aData.z;
}`;

export const PARTICLE_FS = /* glsl */`#version 300 es
${COMMON}
in float vKind;
in float vFade;
out vec4 outColor;
uniform vec3 uTint;
void main(){
  vec2 p = gl_PointCoord*2.0-1.0;
  float d = length(p);
  int kind = int(vKind+0.5);
  if(kind==0){          // liquid droplet: bright rim, dark core
    if(d>1.0) discard;
    float a = sstep(1.0,0.55,d);
    vec3 c = mix(uTint*0.5, vec3(1.0,0.98,0.92), pow(max(1.0-d,0.0),3.0)*0.8);
    outColor = vec4(c, a*vFade);
  } else if(kind==1){   // wax flake: soft irregular chip
    if(d>1.0) discard;
    float n = vnoise(p*3.0+vKind*7.0);
    float a = sstep(1.0,0.4,d+ n*0.25);
    outColor = vec4(mix(vec3(0.92,0.86,0.70), vec3(1.0), 0.4), a*vFade*0.85);
  } else if(kind==2){   // steam
    if(d>1.0) discard;
    float a = sstep(1.0,0.0,d)*0.30;
    outColor = vec4(vec3(0.95,0.94,0.92), a*vFade);
  } else {              // spark / sparkle for the reveal
    float a = sstep(1.0,0.0,d);
    a = pow(a, 2.2);
    outColor = vec4(uTint*1.6, a*vFade);
  }
}`;

// ---------------------------------------------------------------------------
// Backdrop and post
// ---------------------------------------------------------------------------

export const SKY_FS = /* glsl */`#version 300 es
${COMMON}
in vec2 vUV;
out vec4 outColor;
uniform vec3 uTop;
uniform vec3 uBottom;
uniform float uTime;
void main(){
  float t = pow(vUV.y, 1.3);
  vec3 c = mix(uBottom, uTop, t);
  c += (hash12(vUV*997.0)-0.5)*0.008;
  outColor = vec4(c,1.0);
}`;

export const POST_FS = /* glsl */`#version 300 es
${COMMON}
in vec2 vUV;
out vec4 outColor;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform float uTime;
uniform float uVignette;
uniform float uBloomAmt;
uniform float uWarm;
void main(){
  vec3 c = texture(uScene, vUV).rgb;
  vec3 b = texture(uBloom, vUV).rgb;
  c += b*uBloomAmt;
  // Warm the highlights, cool the shadows a touch.
  float l = dot(c, vec3(0.299,0.587,0.114));
  c = mix(c, c*vec3(1.06,1.0,0.93), clamp(l*1.4,0.0,1.0)*uWarm);
  c = mix(c, c*vec3(0.94,0.97,1.06), (1.0-clamp(l*2.0,0.0,1.0))*0.35);
  vec2 q = vUV-0.5;
  float vig = 1.0 - dot(q,q)*uVignette;
  c *= clamp(vig,0.0,1.0);
  c = tonemap(c);
  // The filmic curve lifts the mid-tones, which drains the earthenware and the
  // indigo; put the bite back with a gentle S-curve and a touch of saturation.
  c = clamp(c*c*(3.0-2.0*c)*0.34 + c*0.66, 0.0, 1.0);
  float lum = dot(c, vec3(0.299,0.587,0.114));
  c = clamp(mix(vec3(lum), c, 1.22), 0.0, 1.0);
  c += (hash12(vUV*vec2(1024.0,768.0)+uTime)-0.5)*0.012;
  outColor = vec4(c,1.0);
}`;

export const BRIGHT_FS = /* glsl */`#version 300 es
${COMMON}
in vec2 vUV;
out vec4 outColor;
uniform sampler2D uTex;
uniform float uThreshold;
void main(){
  vec3 c = texture(uTex, vUV).rgb;
  float l = max(max(c.r,c.g),c.b);
  float k = max(0.0, l-uThreshold)/max(l,1e-4);
  outColor = vec4(c*k, 1.0);
}`;

export const BLUR_FS = /* glsl */`#version 300 es
${COMMON}
in vec2 vUV;
out vec4 outColor;
uniform sampler2D uTex;
uniform vec2 uDir;
void main(){
  vec3 s = texture(uTex, vUV).rgb*0.227;
  s += (texture(uTex, vUV+uDir*1.3846).rgb + texture(uTex, vUV-uDir*1.3846).rgb)*0.316;
  s += (texture(uTex, vUV+uDir*3.2308).rgb + texture(uTex, vUV-uDir*3.2308).rgb)*0.070;
  outColor = vec4(s,1.0);
}`;
