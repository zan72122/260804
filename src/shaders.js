/* GLSL（WebGL2 / GLSL ES 3.00） */
(function (root) {
  'use strict';
  var DD = (root.DD = root.DD || {});

  var HEAD = '#version 300 es\nprecision highp float;\nprecision highp int;\n';
  var HEADS = '#version 300 es\nprecision highp float;\nprecision highp int;\nprecision highp sampler2DShadow;\n';

  /* ---------- 共通: ノイズ ---------- */
  var NOISE = `
float hash21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
float hash11(float p){ p = fract(p*0.1031); p *= p+33.33; return fract(p*(p+p)); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f*f*(3.0-2.0*f);
  float a = hash21(i), b = hash21(i+vec2(1.0,0.0));
  float c = hash21(i+vec2(0.0,1.0)), d = hash21(i+vec2(1.0,1.0));
  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
}
float fbm(vec2 p){
  float s = 0.0, a = 0.5;
  for(int i=0;i<5;i++){ s += a*vnoise(p); p = p*2.03 + 11.7; a *= 0.5; }
  return s;
}
float fbm3(vec2 p){
  float s = 0.0, a = 0.5;
  for(int i=0;i<3;i++){ s += a*vnoise(p); p = p*2.11 + 7.3; a *= 0.5; }
  return s;
}
float ridged(vec2 p){
  float s=0.0,a=0.5;
  for(int i=0;i<4;i++){ s += a*(1.0-abs(vnoise(p)*2.0-1.0)); p=p*2.07+3.1; a*=0.5; }
  return s;
}
`;

  /* ---------- 共通: 大気・空 ---------- */
  var SKY = `
uniform vec3 uSunDir;      // 太陽へ向かう単位ベクトル
uniform vec3 uSunColor;
uniform vec3 uSkyTop;
uniform vec3 uSkyHorizon;
uniform vec3 uHaze;
uniform float uFogDensity;

vec3 skyColor(vec3 d){
  float h = clamp(d.y, -1.0, 1.0);
  float t = pow(clamp(h,0.0,1.0), 0.42);
  vec3 c = mix(uSkyHorizon, uSkyTop, t);
  float sd = max(dot(d, uSunDir), 0.0);
  c += uSunColor * (pow(sd, 6.0)*0.16 + pow(sd, 220.0)*1.1);
  c = mix(c, uHaze, smoothstep(0.09, -0.05, h));
  return c;
}
// 空気遠近: 距離と高度で減衰
vec3 applyFog(vec3 color, vec3 worldPos, vec3 camPos){
  vec3 d = worldPos - camPos;
  float dist = length(d);
  vec3 dir = d / max(dist, 1e-4);
  float hFactor = exp(-max(worldPos.y, 0.0)*0.0045);
  float d2 = max(dist - 55.0, 0.0);
  float f = 1.0 - exp(-d2 * uFogDensity * (0.6 + 0.4*hFactor));
  f = clamp(f, 0.0, 1.0);
  vec3 fc = skyColor(dir);
  // 太陽方向の前方散乱
  float fw = pow(max(dot(dir, uSunDir),0.0), 5.0);
  fc += uSunColor*fw*0.12;
  return mix(color, fc, f);
}
`;

  /* ---------- 共通: ライティング ---------- */
  var LIGHT = `
uniform vec3 uCamPos;
uniform vec3 uAmbTop;
uniform vec3 uAmbBottom;
uniform sampler2DShadow uShadowMap;
uniform vec2 uShadowTexel;
uniform float uShadowStrength;

float shadowAt(vec4 sc, float ndl){
  vec3 p = sc.xyz / sc.w;
  p = p*0.5 + 0.5;
  if(p.z > 1.0 || p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0) return 1.0;
  float bias = mix(0.0022, 0.0006, ndl);
  float s = 0.0;
  for(int y=-1;y<=1;y++){
    for(int x=-1;x<=1;x++){
      vec2 o = vec2(float(x), float(y)) * uShadowTexel;
      s += texture(uShadowMap, vec3(p.xy + o, p.z - bias));
    }
  }
  return s / 9.0;
}

float D_GGX(float nh, float r){
  float a = r*r;
  float a2 = a*a;
  float d = nh*nh*(a2-1.0)+1.0;
  return a2 / max(3.14159265*d*d, 1e-6);
}
float V_Smith(float nv, float nl, float r){
  float a = r*r;
  float gv = nl*sqrt(nv*nv*(1.0-a)+a);
  float gl = nv*sqrt(nl*nl*(1.0-a)+a);
  return 0.5/max(gv+gl, 1e-5);
}
vec3 F_Schlick(vec3 f0, float u){ return f0 + (1.0-f0)*pow(1.0-u, 5.0); }

vec3 shade(vec3 albedo, vec3 N, vec3 V, vec3 world, float rough, float metal, float ao, float shadow){
  vec3 L = uSunDir;
  vec3 H = normalize(L+V);
  float nl = max(dot(N,L), 0.0);
  float nv = max(dot(N,V), 1e-4);
  float nh = max(dot(N,H), 0.0);
  float vh = max(dot(V,H), 0.0);
  vec3 f0 = mix(vec3(0.04), albedo, metal);
  vec3 diff = albedo*(1.0-metal)/3.14159265;
  vec3 spec = F_Schlick(f0, vh) * D_GGX(nh, max(rough,0.045)) * V_Smith(nv, nl, max(rough,0.045));
  vec3 direct = (diff + spec) * uSunColor * nl * shadow;

  // 半球アンビエント + 地面バウンス
  float up = N.y*0.5+0.5;
  vec3 amb = mix(uAmbBottom, uAmbTop, up) * ao;
  vec3 ambSpec = mix(uAmbBottom, uAmbTop, 0.85) * (1.0-rough*0.8) * ao * (0.10 + 0.5*metal);
  vec3 result = direct + amb*albedo*(1.0-metal*0.7) + ambSpec*f0;
  return result;
}
`;

  /* ---------- 物体 VS ---------- */
  var OBJ_VS = HEAD + `
in vec3 aPos;
in vec3 aNrm;
in vec2 aUV;
in vec3 aCol;
uniform mat4 uProj, uView, uModel, uLightVP;
uniform mat3 uNrmMat;
out vec3 vWorld;
out vec3 vNormal;
out vec2 vUV;
out vec3 vColor;
out vec4 vShadow;
out vec3 vObj;
void main(){
  vec4 w = uModel*vec4(aPos,1.0);
  vWorld = w.xyz;
  vNormal = uNrmMat*aNrm;
  vUV = aUV;
  vColor = aCol;
  vObj = aPos;
  vShadow = uLightVP*w;
  gl_Position = uProj*uView*w;
}
`;

  /* ---------- 物体 FS ---------- */
  function objFS(defines) {
    return HEADS + (defines || '') + `
in vec3 vWorld;
in vec3 vNormal;
in vec2 vUV;
in vec3 vColor;
in vec4 vShadow;
in vec3 vObj;
out vec4 oColor;

uniform float uRough;
uniform float uMetal;
uniform float uAO;
uniform vec3  uTint;
uniform float uClipY;      // 反射パス用の切断
uniform float uClipSign;   // 0 = 無効
uniform float uWaterY;     // 現在の水位
uniform float uWetY;       // 濡れの基準面（= 水位）
uniform float uWetAmt;
uniform float uWetLen;     // 上方向へ乾いていく距離スケール
uniform vec3  uRegion;     // x=ゲート位置, y=ドック半幅, z=外海の水位
uniform float uTime;
uniform float uDetail;     // ディテール強度（遠景では 0）
#ifdef MAT_HULL
uniform sampler2D uWashTex;
uniform float uDraft;
#endif
` + NOISE + SKY + LIGHT + `

void main(){
  if(uClipSign != 0.0){
    if((vWorld.y - uClipY)*uClipSign < 0.0) discard;
  }
  // 退化した法線（先端や極）が NaN として伝播しないよう保険をかける
  float nsq = dot(vNormal, vNormal);
  vec3 V = normalize(uCamPos - vWorld);
  vec3 N = (nsq > 1e-8) ? vNormal * inversesqrt(nsq) : V;
  vec3 albedo = vColor*uTint;
  float rough = uRough;
  float metal = uMetal;
  float ao = uAO;
  float dist = length(uCamPos - vWorld);
  float det = uDetail * clamp(1.0 - dist/420.0, 0.0, 1.0);

#ifdef MAT_CONCRETE
  {
    // 面の向きで投影軸を選ぶ
    vec2 pp = (abs(N.y) > 0.6) ? vWorld.xz : ((abs(N.x) > abs(N.z)) ? vWorld.zy : vWorld.xy);
    float m = fbm(pp*0.35);
    float m2 = fbm(pp*2.6);
    albedo *= 0.80 + 0.36*m;
    albedo *= 0.92 + 0.16*m2*det;
    // 型枠の目地（水平方向）
    float band = abs(fract(vWorld.y/1.35) - 0.5)*2.0;
    float seam = smoothstep(0.94, 1.0, band);
    albedo *= 1.0 - 0.30*seam*det;
    // 骨材の粒
    float grit = vnoise(pp*26.0);
    albedo *= 0.93 + 0.14*grit*det;
    rough = 0.80 - 0.12*m;
    // 垂直の汚れ筋
    float streak = fbm(vec2(pp.x*3.4, pp.y*0.09));
    if(abs(N.y) < 0.6){
      albedo *= 1.0 - 0.24*smoothstep(0.52,0.85,streak)*det;
    } else {
      // 舗装の目地と使い込まれた汚れ
      vec2 g = abs(fract(vWorld.xz/6.5 + 0.5) - 0.5)*2.0;
      float jt = max(smoothstep(0.955,1.0,g.x), smoothstep(0.955,1.0,g.y));
      albedo *= 1.0 - 0.26*jt*det;
      float stain = fbm(vWorld.xz*0.09);
      albedo *= 0.88 + 0.24*stain;
      float tire = fbm(vec2(vWorld.x*0.05, vWorld.z*0.9));
      albedo *= 1.0 - 0.13*smoothstep(0.62,0.92,tire)*det;
      rough = mix(rough, 0.55, smoothstep(0.62,0.92,tire)*0.5);
    }
    // 海洋生物の付着（かつての常時水面より下）
    float growth = smoothstep(13.6, 2.0, vWorld.y);
    float gpat = fbm(pp*0.75);
    float g = clamp(growth*(0.30+1.05*gpat) - 0.13, 0.0, 1.0);
    albedo = mix(albedo, vec3(0.048,0.068,0.038)*(0.65+0.7*gpat), g*0.86);
    rough = mix(rough, 0.38, g*0.75);
    // 濡れ：水面直下ほど濡れ、上へ行くほど乾いている
    bool outside = (vWorld.x < uRegion.x + 3.6) || (abs(vWorld.z) > uRegion.y + 3.6);
    float wref = outside ? uRegion.z : uWetY;
    float wamt = outside ? 1.0 : uWetAmt;
    float wlen = outside ? 1.2 : uWetLen;
    float wet = wamt * clamp(exp(-max(0.0, vWorld.y - wref)/max(wlen,0.05)), 0.0, 1.0);
    // 潮位線（水際の濃い帯）: 直上は濡れて黒く、直下は水中
    float tide = exp(-abs(vWorld.y - wref)*1.1)*wamt;
    // 上向きの面（ドック底）は濡れても読めるよう、暗くしすぎない
    float wetK = mix(0.56, 0.34, clamp(abs(N.y),0.0,1.0));
    albedo *= 1.0 - wetK*wet;
    albedo *= 1.0 - 0.26*tide;
    rough = mix(rough, 0.10, wet*0.95);
    // 現在の水際に泡のスカムライン
    float scum = exp(-abs(vWorld.y - uWaterY)*5.0);
    if(uWaterY > 0.05 && abs(N.y) < 0.7){
      float f = fbm(vec2(vWorld.x*1.6 + uTime*0.05, vWorld.z*1.6));
      albedo = mix(albedo, vec3(0.55,0.55,0.50), scum*0.55*smoothstep(0.35,0.75,f));
    }
    // 水際から上へ垂れ残る筋
    float drip = clamp(exp(-max(0.0, vWorld.y - wref)/6.0), 0.0, 1.0)*(1.0-wet*0.5);
    float dn = vnoise(vec2(vWorld.x*2.4, 0.5));
    albedo *= 1.0 - 0.17*drip*smoothstep(0.62,0.95,dn)*wamt;
  }
#endif

#ifdef MAT_HULL
  {
    float y = vObj.y;               // キールからの高さ
    float bootLo = uDraft - 0.35;
    float bootHi = uDraft + 0.95;
    vec3 anti = vec3(0.46,0.078,0.050);      // 船底塗料（赤）
    vec3 boot = vec3(0.030,0.032,0.038);     // ブートトップ
    vec3 top  = vec3(0.048,0.062,0.115);     // 舷側
    vec3 base = anti;
    base = mix(base, boot, smoothstep(bootLo-0.06, bootLo+0.06, y));
    base = mix(base, top,  smoothstep(bootHi-0.06, bootHi+0.06, y));
    albedo = base;

    // 外板の継手（水平ストレーキ + 縦の突合せ）
    float sy = abs(fract(y/2.2 + 0.5) - 0.5)*2.0;
    float seamH = smoothstep(0.965, 1.0, sy);
    float sx = abs(fract(vObj.x/13.0 + 0.5) - 0.5)*2.0;
    float seamV = smoothstep(0.985, 1.0, sx);
    float seam = max(seamH, seamV*0.7);
    albedo *= 1.0 - 0.24*seam*det;
    N = normalize(N + vec3(0.0, -seamH*0.10, 0.0)*det);

    // 塗膜の斑・退色
    vec2 hp = vec2(vObj.x*0.6, y*0.9);
    float wear = fbm(hp*0.32);
    albedo *= 0.84 + 0.34*wear;

    // 錆の筋（舷側、上から下へ）
    if(y > bootHi){
      float rs = fbm(vec2(vObj.x*3.2, y*0.07));
      float rmask = smoothstep(0.58,0.88,rs)*smoothstep(15.5, 9.0, y);
      albedo = mix(albedo, vec3(0.20,0.075,0.03), rmask*0.6*det);
    }

    // 付着生物（喫水線以下）— wash で落とせる
    float washed = texture(uWashTex, vUV).r;
    float depthFac = smoothstep(bootLo, 0.4, y);            // 下ほど濃い
    float sternFac = 0.72 + 0.42*smoothstep(20.0, -95.0, vObj.x);
    float slimeN = fbm(vec2(vObj.x*0.55, y*0.75) + 3.0);
    float slime = clamp(depthFac*sternFac*(0.46 + 1.15*slimeN) - 0.12, 0.0, 1.0);
    slime *= (1.0 - washed);
    vec3 slimeCol = mix(vec3(0.045,0.082,0.034), vec3(0.115,0.115,0.055), slimeN);
    albedo = mix(albedo, slimeCol, slime*0.92);
    // フジツボの粒
    float barn = vnoise(vec2(vObj.x*9.0, y*11.0));
    float bmask = step(0.83, barn)*depthFac*(1.0-washed)*sternFac;
    albedo = mix(albedo, vec3(0.46,0.44,0.39), bmask*0.7*det);
    rough = mix(0.52, 0.86, slime);
    rough = mix(rough, 0.34, washed*depthFac*0.7);
    N = normalize(N + vec3(0.0, (slime-0.5)*0.06, 0.0)*det);

    // 喫水標（白いティック）
    float tick = step(0.992, abs(fract(y/1.0+0.5)-0.5)*2.0);
    float nearMark = step(abs(vObj.x + 86.5), 1.1) + step(abs(vObj.x - 84.5), 1.1);
    albedo = mix(albedo, vec3(0.60,0.60,0.56), clamp(tick*nearMark,0.0,1.0)*0.7*det*(1.0-smoothstep(bootHi, bootHi+1.0, y)));

    // 濡れ（水面直下ほど濡れ、上へ行くほど乾く）
    float wet = uWetAmt * clamp(exp(-max(0.0, vWorld.y - uWetY)/max(uWetLen,0.05)), 0.0, 1.0);
    albedo *= 1.0 - 0.42*wet;
    rough = mix(rough, 0.10, wet*0.92);
    // 水面直下の光の帯（コースティクス風）
    float caus = 0.0;
    if(vWorld.y < uWaterY && uWaterY > 0.4){
      float dsub = uWaterY - vWorld.y;
      caus = ridged(vec2(vWorld.x*0.55 + uTime*0.35, vWorld.z*0.55 - uTime*0.22));
      caus = pow(clamp(caus,0.0,1.0), 3.0) * exp(-dsub*0.35);
    }
    albedo += vec3(0.35,0.45,0.40)*caus*0.55;
  }
#endif

  float ndl = max(dot(N, uSunDir), 0.0);
  float shadow = 1.0;
  if(uShadowStrength > 0.0){
    shadow = mix(1.0, shadowAt(vShadow, ndl), uShadowStrength);
  }
  vec3 c = shade(albedo, N, V, vWorld, clamp(rough,0.03,1.0), metal, ao, shadow);
  c = applyFog(c, vWorld, uCamPos);
  oColor = vec4(c, 1.0);
}
`;
  }

  /* ---------- シャドウパス ---------- */
  var SHADOW_VS = HEAD + `
in vec3 aPos;
uniform mat4 uLightVP, uModel;
void main(){ gl_Position = uLightVP*uModel*vec4(aPos,1.0); }
`;
  var SHADOW_FS = HEAD + `
void main(){}
`;

  /* ---------- 空 ---------- */
  var SKY_VS = HEAD + `
in vec3 aPos;
out vec2 vNdc;
void main(){ vNdc = aPos.xy; gl_Position = vec4(aPos.xy, 1.0, 1.0); }
`;
  var SKY_FS = HEAD + `
in vec2 vNdc;
out vec4 oColor;
uniform mat4 uInvViewProj;
uniform float uTime;
` + NOISE + SKY + `
uniform vec3 uCamPos;
void main(){
  vec4 p0 = uInvViewProj*vec4(vNdc, -1.0, 1.0);
  vec4 p1 = uInvViewProj*vec4(vNdc,  1.0, 1.0);
  vec3 dir = normalize(p1.xyz/p1.w - p0.xyz/p0.w);
  vec3 c = skyColor(dir);
  // 雲（高い層と低い層）
  if(dir.y > 0.005){
    vec2 uv = dir.xz/(dir.y+0.12);
    float t = uTime*0.006;
    float n = fbm(uv*0.055 + vec2(t, t*0.4));
    float n2 = fbm(uv*0.16 - vec2(t*1.6, t*0.3));
    float cl = smoothstep(0.50, 0.86, n*0.72 + n2*0.36);
    cl *= smoothstep(0.0, 0.20, dir.y);
    float lit = smoothstep(0.35, 0.85, n2);
    vec3 cloudCol = mix(vec3(0.55,0.58,0.63), vec3(1.05,1.02,0.96), lit);
    float sd = max(dot(dir, uSunDir), 0.0);
    cloudCol += uSunColor*pow(sd, 22.0)*0.5*lit;
    c = mix(c, cloudCol, cl*0.82);
  }
  oColor = vec4(c, 1.0);
}
`;

  /* ---------- 水面 ---------- */
  var WATER_VS = HEAD + `
in vec3 aPos;
uniform mat4 uProj, uView;
uniform float uLevel;
uniform float uAmp;
uniform float uTime;
uniform vec4 uVortex[4];   // xz = 位置, w = 強さ
out vec3 vWorld;
out vec4 vClip;
out float vEdge;

float waveH(vec2 p, float t){
  float h = 0.0;
  h += sin(p.x*0.145 + t*0.85)*0.55;
  h += sin(p.y*0.191 - t*0.72)*0.42;
  h += sin((p.x*0.72 + p.y*0.55) + t*1.9)*0.16;
  h += sin((p.x*0.44 - p.y*0.98) - t*1.4)*0.11;
  return h;
}
void main(){
  vec3 w = aPos;
  w.y = uLevel;
  float h = waveH(w.xz, uTime)*uAmp;
  // 排水渦のくぼみ
  for(int i=0;i<4;i++){
    if(uVortex[i].w <= 0.0) continue;
    float d = length(w.xz - uVortex[i].xy);
    h -= uVortex[i].w * 1.6 * exp(-d*d/40.0);
  }
  w.y += h;
  vWorld = w;
  vEdge = aPos.y;      // 端のフェード用に格納しておく
  vClip = uProj*uView*vec4(w,1.0);
  gl_Position = vClip;
}
`;

  var WATER_FS = HEADS + `
in vec3 vWorld;
in vec4 vClip;
in float vEdge;
out vec4 oColor;

uniform sampler2D uSceneColor;
uniform sampler2D uSceneDepth;
uniform sampler2D uReflTex;
uniform mat4 uInvViewProj;
uniform vec2 uResolution;
uniform float uTime;
uniform float uNear, uFar;
uniform float uAmp;
uniform float uLevel;
uniform vec3 uAbsorb;
uniform vec3 uScatter;
uniform float uHasRefl;
uniform vec4 uVortex[4];
uniform float uPuddle;     // 0=一枚の水面, 1=水たまりに分裂
uniform float uFoamBoost;
` + NOISE + SKY + LIGHT + `

vec3 waveNormal(vec2 p, float t, float amp){
  float e = 0.55;
  // 解析的な傾き
  float dx = 0.0, dz = 0.0;
  dx += cos(p.x*0.145 + t*0.85)*0.55*0.145;
  dz += cos(p.y*0.191 - t*0.72)*0.42*0.191;
  dx += cos((p.x*0.72 + p.y*0.55) + t*1.9)*0.16*0.72;
  dz += cos((p.x*0.72 + p.y*0.55) + t*1.9)*0.16*0.55;
  dx += cos((p.x*0.44 - p.y*0.98) - t*1.4)*0.11*0.44;
  dz -= cos((p.x*0.44 - p.y*0.98) - t*1.4)*0.11*0.98;
  // 細波
  float n1 = fbm3(p*1.9 + vec2(t*0.55, -t*0.34));
  float n2 = fbm3(p*1.9 + vec2(t*0.55 + 0.35, -t*0.34));
  float n3 = fbm3(p*1.9 + vec2(t*0.55, -t*0.34 + 0.35));
  dx += (n2-n1)*2.4;
  dz += (n3-n1)*2.4;
  return normalize(vec3(-dx*amp, 1.0, -dz*amp));
}

float linDepth(float d){
  float z = d*2.0-1.0;
  return (2.0*uNear*uFar)/(uFar+uNear - z*(uFar-uNear));
}
vec3 worldFromDepth(vec2 uv, float d){
  vec4 p = uInvViewProj*vec4(uv*2.0-1.0, d*2.0-1.0, 1.0);
  return p.xyz/p.w;
}

void main(){
  vec2 uv = vClip.xy/vClip.w*0.5+0.5;
  vec3 V = normalize(uCamPos - vWorld);

  // 水たまりへの分裂
  if(uPuddle > 0.001){
    float pn = fbm(vWorld.xz*0.115) * 0.72 + fbm(vWorld.xz*0.42)*0.28;
    if(pn < uPuddle*0.86) discard;
  }

  vec3 N = waveNormal(vWorld.xz, uTime, uAmp);
  // 渦のねじれ
  for(int i=0;i<4;i++){
    if(uVortex[i].w <= 0.0) continue;
    vec2 dv = vWorld.xz - uVortex[i].xy;
    float d = length(dv)+0.001;
    float g = uVortex[i].w*exp(-d*d/40.0);
    vec2 tang = vec2(-dv.y, dv.x)/d;
    float spiral = sin(d*1.9 - uTime*7.0)*g*0.6;
    N.xz += tang*spiral + dv/d*g*0.9*exp(-d*0.12);
    N = normalize(N);
  }

  float ndv = max(dot(N,V), 0.02);

  // ---- 屈折 ----
  float distort = (0.022 + 0.05*uAmp) / (1.0 + length(uCamPos-vWorld)*0.008);
  vec2 rUV = clamp(uv + N.xz*distort, vec2(0.001), vec2(0.999));
  float dR = texture(uSceneDepth, rUV).r;
  vec3 pR = worldFromDepth(rUV, dR);
  // 屈折先が水面より上ならズラさない（にじみ防止）
  if(pR.y > vWorld.y + 0.15){
    rUV = uv;
    dR = texture(uSceneDepth, rUV).r;
    pR = worldFromDepth(rUV, dR);
  }
  vec3 refr = texture(uSceneColor, rUV).rgb;
  float travel = max(length(pR - vWorld), 0.0);
  float subDepth = max(vWorld.y - pR.y, 0.0);

  // 吸光と散乱
  vec3 trans = exp(-uAbsorb*travel);
  vec3 sunAmb = uSunColor*0.28 + mix(uAmbBottom,uAmbTop,0.8);
  vec3 body = refr*trans + uScatter*sunAmb*(1.0-trans);

  // ---- 反射 ----
  vec3 R = reflect(-V, N);
  vec3 sky = skyColor(R);
  vec3 refl = sky;
  if(uHasRefl > 0.5){
    vec2 mUV = vec2(uv.x, 1.0-uv.y) + N.xz*distort*1.6;
    mUV = clamp(mUV, vec2(0.002), vec2(0.998));
    vec4 rt = texture(uReflTex, mUV);
    refl = mix(sky, rt.rgb, rt.a*0.94);
  }

  float F = 0.02 + 0.98*pow(1.0-ndv, 5.0);
  F = clamp(F, 0.0, 1.0);
  vec3 c = mix(body, refl, F);

  // 太陽の輝き
  vec3 H = normalize(uSunDir+V);
  float nh = max(dot(N,H),0.0);
  c += uSunColor * pow(nh, 780.0) * 2.6;
  c += uSunColor * pow(nh, 60.0) * 0.10;

  // ---- 泡 ----
  float shore = 1.0 - smoothstep(0.0, 1.9, subDepth);
  float fn = fbm(vWorld.xz*0.75 + vec2(uTime*0.09, -uTime*0.06));
  float foam = smoothstep(0.30, 0.95, shore) * smoothstep(0.30, 0.72, fn);
  // 渦の泡
  for(int i=0;i<4;i++){
    if(uVortex[i].w <= 0.0) continue;
    vec2 dv = vWorld.xz - uVortex[i].xy;
    float d = length(dv);
    float ang = atan(dv.y, dv.x);
    float sp = fbm(vec2(ang*2.4 + d*0.55 - uTime*2.2, d*0.3));
    foam += uVortex[i].w*smoothstep(0.45,0.9,sp)*exp(-d*d/70.0)*1.2;
  }
  foam = clamp(foam*(0.6+uFoamBoost), 0.0, 1.0);
  c = mix(c, vec3(0.86,0.90,0.92)*(0.5+0.5*max(dot(N,uSunDir),0.0)+0.25), foam*0.85);

  c = applyFog(c, vWorld, uCamPos);
  oColor = vec4(c, 1.0);
}
`;

  /* ---------- 反射パス用の空（アルファ 0 で「空である」ことを示す） ---------- */
  var REFLSKY_FS = HEAD + `
in vec2 vNdc;
out vec4 oColor;
void main(){ oColor = vec4(0.0); }
`;

  /* ---------- パーティクル ---------- */
  var PART_VS = HEAD + `
in vec3 aPos;
in vec3 aNrm;   // x=size, y=alpha, z=kind
in vec3 aCol;
uniform mat4 uProj, uView;
uniform float uPixScale;
out vec3 vCol;
out float vAlpha;
out float vKind;
out vec3 vWorld;
void main(){
  vec4 vp = uView*vec4(aPos,1.0);
  gl_Position = uProj*vp;
  gl_PointSize = clamp(uPixScale*aNrm.x/max(-vp.z,1.0), 1.0, 220.0);
  vCol = aCol;
  vAlpha = aNrm.y;
  vKind = aNrm.z;
  vWorld = aPos;
}
`;
  var PART_FS = HEAD + `
in vec3 vCol;
in float vAlpha;
in float vKind;
in vec3 vWorld;
out vec4 oColor;
` + NOISE + SKY + `
uniform vec3 uCamPos;
void main(){
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d)*2.0;
  float a = 1.0 - smoothstep(0.55, 1.0, r);
  if(vKind > 0.5) a = pow(a, 2.2);      // ミスト: 柔らかく
  else a = smoothstep(0.0,0.35,1.0-r);   // 水滴: 芯を持つ
  a *= vAlpha;
  if(a < 0.004) discard;
  vec3 c = vCol;
  vec3 dir = normalize(vWorld - uCamPos);
  float dist = length(vWorld-uCamPos);
  float f = 1.0-exp(-dist*uFogDensity*0.7);
  c = mix(c, skyColor(dir), f);
  oColor = vec4(c*a, a);
}
`;

  /* ---------- 指示リング（文字なし） ---------- */
  var HINT_VS = HEAD + `
in vec3 aPos;
uniform mat4 uProj, uView;
uniform vec3 uCenter;
uniform float uSize;
out vec2 vUV;
void main(){
  vec3 right = vec3(uView[0][0], uView[1][0], uView[2][0]);
  vec3 up    = vec3(uView[0][1], uView[1][1], uView[2][1]);
  vec3 w = uCenter + (right*aPos.x + up*aPos.y)*uSize;
  vUV = aPos.xy;
  gl_Position = uProj*uView*vec4(w,1.0);
}
`;
  var HINT_FS = HEAD + `
in vec2 vUV;
out vec4 oColor;
uniform float uTime;
uniform float uKind;      // 0=タップ 1=上下ドラッグ 2=回す 3=左右ドラッグ 4=こする
uniform float uOpacity;
uniform vec3 uColor;

float ring(float r, float rad, float w){ return smoothstep(w, 0.0, abs(r-rad)); }
float arrow(vec2 p){
  // 上向き三角
  p.y -= 0.06;
  float d = max(abs(p.x)*1.5 + p.y*1.0 - 0.30, -p.y - 0.16);
  return smoothstep(0.05, 0.0, d);
}
void main(){
  vec2 p = vUV;
  float r = length(p);
  float t = uTime;
  float a = 0.0;
  if(uKind < 0.5){
    float pulse = fract(t*0.6);
    a += ring(r, 0.28 + pulse*0.62, 0.055)*(1.0-pulse);
    a += ring(r, 0.26, 0.05)*0.85;
    a += smoothstep(0.20,0.10,r)*0.55;
  } else if(uKind < 1.5){
    float k = sin(t*2.6)*0.5+0.5;
    a += arrow(vec2(p.x, -p.y - 0.30 + k*0.10))*0.95;
    a += arrow(vec2(p.x,  p.y - 0.30 - k*0.10))*0.35;
    a += ring(r, 0.20, 0.045)*0.5;
    a += smoothstep(0.14,0.05,r)*0.5;
  } else if(uKind < 2.5){
    float ang = atan(p.y,p.x);
    float sweep = fract((ang/6.2831853) + t*0.45);
    a += ring(r, 0.52, 0.07)*smoothstep(0.0,0.30,sweep)*smoothstep(1.0,0.72,sweep);
    vec2 tip = vec2(cos((t*0.45)*6.2831853+1.2), sin((t*0.45)*6.2831853+1.2))*0.52;
    a += smoothstep(0.13,0.03,length(p-tip));
  } else if(uKind < 3.5){
    float k = sin(t*2.6)*0.5+0.5;
    a += arrow(vec2(-p.y, -p.x - 0.30 + k*0.10))*0.95;
    a += arrow(vec2( p.y,  p.x - 0.30 - k*0.10))*0.95;
    a += smoothstep(0.14,0.05,r)*0.5;
  } else {
    float k = sin(t*3.4);
    vec2 q = p - vec2(k*0.26, 0.0);
    a += smoothstep(0.30,0.16,length(q))*0.75;
    a += ring(length(q), 0.30, 0.055)*0.8;
  }
  a *= uOpacity;
  if(a < 0.004) discard;
  oColor = vec4(uColor*a, a);
}
`;

  /* ---------- 洗浄マスクへの描き込み ---------- */
  var PAINT_VS = HEAD + `
in vec3 aPos;
uniform vec2 uCenter;
uniform float uRadius;
uniform float uAspect;
out vec2 vP;
void main(){
  vP = aPos.xy;
  vec2 c = uCenter*2.0-1.0;
  gl_Position = vec4(c + aPos.xy*vec2(uRadius, uRadius*uAspect), 0.0, 1.0);
}
`;
  var PAINT_FS = HEAD + `
in vec2 vP;
out vec4 oColor;
uniform float uStrength;
void main(){
  float r = length(vP);
  float a = smoothstep(1.0, 0.15, r);
  oColor = vec4(vec3(1.0), a*uStrength);
}
`;

  /* ---------- ポスト ---------- */
  var FS_VS = HEAD + `
in vec3 aPos;
out vec2 vUV;
void main(){ vUV = aPos.xy*0.5+0.5; gl_Position = vec4(aPos.xy,0.0,1.0); }
`;
  var BRIGHT_FS = HEAD + `
in vec2 vUV;
out vec4 oColor;
uniform sampler2D uTex;
uniform float uThreshold;
void main(){
  vec3 c = texture(uTex, vUV).rgb;
  if(any(isnan(c)) || any(isinf(c))) c = vec3(0.0);
  c = clamp(c, vec3(0.0), vec3(64.0));
  float l = dot(c, vec3(0.2126,0.7152,0.0722));
  float k = max(l-uThreshold, 0.0)/max(l,1e-4);
  oColor = vec4(c*k, 1.0);
}
`;
  var BLUR_FS = HEAD + `
in vec2 vUV;
out vec4 oColor;
uniform sampler2D uTex;
uniform vec2 uDir;
void main(){
  vec3 s = texture(uTex, vUV).rgb*0.2270270270;
  s += texture(uTex, vUV + uDir*1.3846153846).rgb*0.3162162162;
  s += texture(uTex, vUV - uDir*1.3846153846).rgb*0.3162162162;
  s += texture(uTex, vUV + uDir*3.2307692308).rgb*0.0702702703;
  s += texture(uTex, vUV - uDir*3.2307692308).rgb*0.0702702703;
  oColor = vec4(s,1.0);
}
`;
  var POST_FS = HEAD + `
in vec2 vUV;
out vec4 oColor;
uniform sampler2D uTex;
uniform sampler2D uBloom;
uniform float uBloomAmt;
uniform float uExposure;
uniform float uVignette;
uniform float uFade;

vec3 aces(vec3 x){
  const float a=2.51, b=0.03, c=2.43, d=0.59, e=0.14;
  return clamp((x*(a*x+b))/(x*(c*x+d)+e), 0.0, 1.0);
}
void main(){
  vec3 c = texture(uTex, vUV).rgb;
  if(any(isnan(c)) || any(isinf(c))) c = vec3(0.0);
  vec3 bl = texture(uBloom, vUV).rgb;
  if(any(isnan(bl)) || any(isinf(bl))) bl = vec3(0.0);
  c = clamp(c, vec3(0.0), vec3(64.0)) + clamp(bl, vec3(0.0), vec3(64.0))*uBloomAmt;
  c *= uExposure;
  c = aces(c);
  vec2 q = vUV-0.5;
  float v = 1.0 - uVignette*dot(q,q)*1.55;
  c *= clamp(v,0.0,1.0);
  c = pow(c, vec3(1.0/2.2));
  c *= uFade;
  oColor = vec4(c,1.0);
}
`;

  DD.SH = {
    OBJ_VS: OBJ_VS,
    objFS: objFS,
    SHADOW_VS: SHADOW_VS,
    SHADOW_FS: SHADOW_FS,
    SKY_VS: SKY_VS,
    SKY_FS: SKY_FS,
    REFLSKY_FS: REFLSKY_FS,
    WATER_VS: WATER_VS,
    WATER_FS: WATER_FS,
    PART_VS: PART_VS,
    PART_FS: PART_FS,
    HINT_VS: HINT_VS,
    HINT_FS: HINT_FS,
    PAINT_VS: PAINT_VS,
    PAINT_FS: PAINT_FS,
    FS_VS: FS_VS,
    BRIGHT_FS: BRIGHT_FS,
    BLUR_FS: BLUR_FS,
    POST_FS: POST_FS
  };
})(typeof window !== 'undefined' ? window : this);
