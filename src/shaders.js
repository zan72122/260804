// ---------------------------------------------------------------------------
// GLSL ES 1.00 シェーダ群
// ---------------------------------------------------------------------------
'use strict';

const GLSL = {};

GLSL.noise = `
float hash11(float p){ p=fract(p*0.1031); p*=p+33.33; p*=p+p; return fract(p); }
float hash21(vec2 p){
  vec3 p3=fract(vec3(p.xyx)*0.1031);
  p3+=dot(p3,p3.yzx+33.33);
  return fract((p3.x+p3.y)*p3.z);
}
float vnoise(vec2 p){
  vec2 i=floor(p), f=fract(p);
  f=f*f*(3.0-2.0*f);
  float a=hash21(i), b=hash21(i+vec2(1.0,0.0));
  float c=hash21(i+vec2(0.0,1.0)), d=hash21(i+vec2(1.0,1.0));
  return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);
}
float fbm(vec2 p){
  float s=0.0, a=0.5;
  for(int i=0;i<4;i++){ s+=a*vnoise(p); p=p*2.03+vec2(1.7,9.2); a*=0.5; }
  return s;
}
`;

GLSL.tone = `
vec3 aces(vec3 x){
  return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0);
}
float luma(vec3 c){ return dot(c,vec3(0.2126,0.7152,0.0722)); }
`;

// --- 標準頂点シェーダ -------------------------------------------------------
GLSL.stdVS = `
attribute vec3 aPos;
attribute vec3 aNormal;
attribute vec2 aUV;
uniform mat4 uModel;
uniform mat4 uViewProj;
uniform mat3 uNrm;
varying vec3 vW;
varying vec3 vN;
varying vec2 vUV;
void main(){
  vec4 wp = uModel * vec4(aPos,1.0);
  vW = wp.xyz;
  vN = normalize(uNrm * aNormal);
  vUV = aUV;
  gl_Position = uViewProj * wp;
}
`;

// --- 標準フラグメント (物理ベース風) ----------------------------------------
GLSL.stdFS = `
precision highp float;
varying vec3 vW;
varying vec3 vN;
varying vec2 vUV;

uniform vec3 uCam;
uniform vec3 uSunDir;      // 光の進行方向
uniform vec3 uSunCol;
uniform mat4 uLightVP;
uniform sampler2D uLightMap;
uniform float uLightTexel;
uniform float uSunMode;    // 0=ライトマップ経由, 1=直接, 2=なし
uniform vec3 uAmbTop;
uniform vec3 uAmbBot;
uniform vec3 uLampPos;
uniform vec3 uLampCol;
uniform float uLampRange;
uniform vec3 uAlbedo;
uniform float uRough;
uniform float uMetal;
uniform float uMat;
uniform float uWear;
uniform vec3 uEmissive;
uniform vec3 uFogCol;
uniform float uFogDensity;
uniform float uFogAmount;
uniform float uBloomThresh;
uniform float uAO;
uniform vec3 uBounce;
uniform float uTime;

${GLSL.noise}
${GLSL.tone}

vec3 brdf(vec3 N, vec3 V, vec3 L, vec3 radiance, vec3 albedo, float rough, float metal){
  vec3 H = normalize(L+V);
  float NoL = max(dot(N,L),0.0);
  if(NoL<=0.0) return vec3(0.0);
  float NoV = max(dot(N,V),1e-3);
  float NoH = max(dot(N,H),0.0);
  float VoH = max(dot(V,H),0.0);
  float a = max(rough*rough, 0.003);
  float a2 = a*a;
  float dd = NoH*NoH*(a2-1.0)+1.0;
  float D = a2/(3.14159*dd*dd);
  float k = a*0.5;
  float G = (NoL/(NoL*(1.0-k)+k))*(NoV/(NoV*(1.0-k)+k));
  vec3 F0 = mix(vec3(0.04), albedo, metal);
  vec3 F = F0 + (1.0-F0)*pow(1.0-VoH,5.0);
  vec3 spec = D*G*F/(4.0*NoL*NoV+1e-4);
  vec3 kd = (1.0-F)*(1.0-metal);
  return (kd*albedo/3.14159 + spec)*radiance*NoL;
}

// 透過光マップ: RGB = 窓を通った光の色 / A = 遮蔽物までの光源空間深度
vec3 lmTap(vec2 uv, float d){
  vec4 s = texture2D(uLightMap, uv);
  return s.rgb * step(d, s.a);
}

vec3 sunTransmit(vec3 wp){
  vec4 lp = uLightVP*vec4(wp,1.0);
  vec3 ndc = lp.xyz/max(lp.w,1e-5);
  vec2 uv = ndc.xy*0.5+0.5;
  if(uv.x<0.002||uv.x>0.998||uv.y<0.002||uv.y>0.998) return vec3(0.0);
  float d = ndc.z*0.5+0.5 - 0.0035;
  float o = uLightTexel;
  vec3 s = lmTap(uv,d)*0.28;
  s += lmTap(uv+vec2(o,0.0),d)*0.15;
  s += lmTap(uv-vec2(o,0.0),d)*0.15;
  s += lmTap(uv+vec2(0.0,o),d)*0.15;
  s += lmTap(uv-vec2(0.0,o),d)*0.15;
  s += lmTap(uv+vec2(o,o)*0.8,d)*0.06;
  s += lmTap(uv-vec2(o,o)*0.8,d)*0.06;
  return s;
}

void main(){
  vec3 N = normalize(vN);
  vec3 V = normalize(uCam - vW);
  vec3 albedo = uAlbedo;
  float rough = uRough;
  float metal = uMetal;
  float ao = uAO;

  // --- 材質ごとの手続きディテール -----------------------------------------
  if(uMat > 0.5 && uMat < 1.5){
    // 木の床: 板目、目地、摩耗、隅の汚れ
    float plank = floor(vUV.y/0.19);
    float inP = fract(vUV.y/0.19);
    float tone = 0.78+0.42*hash11(plank*3.7);
    float grain = fbm(vec2(vUV.x*2.2+plank*17.0, vUV.y*26.0));
    float grain2 = fbm(vec2(vUV.x*18.0, vUV.y*90.0));
    albedo *= tone*(0.74+0.42*grain)*(0.92+0.16*grain2);
    float gap = smoothstep(0.0,0.028,inP)*smoothstep(1.0,0.972,inP);
    albedo *= mix(0.16,1.0,gap);
    // 継ぎ目の段差を法線に反映
    N = normalize(N + vec3(0.0,0.0,(inP<0.5? -1.0:1.0)*(1.0-gap)*0.55));
    float wear = smoothstep(2.4,0.4,length(vW.xz-vec2(0.0,0.2)));
    rough = mix(0.72,0.34,wear*uWear);
    albedo *= mix(1.0,1.12,wear*uWear);
    float dirt = smoothstep(1.6,2.15,abs(vW.x))+smoothstep(1.7,2.3,abs(vW.z-0.4));
    albedo *= 1.0-0.34*clamp(dirt,0.0,1.0);
    ao *= 1.0-0.30*clamp(dirt,0.0,1.0);
  } else if(uMat > 1.5 && uMat < 2.5){
    // 漆喰壁: こて跡、下端のしみ
    float f = fbm(vUV*7.0);
    float f2 = fbm(vUV*31.0);
    albedo *= 0.90+0.20*f+0.06*f2;
    N = normalize(N + vec3(f2-0.5,f-0.5,f2-0.5)*0.14);
    rough = mix(0.86,0.98,f);
    float base = smoothstep(0.55,0.02,vW.y);
    albedo *= 1.0-0.30*base*(0.4+0.6*f);
    ao *= 1.0-0.35*base;
  } else if(uMat > 2.5 && uMat < 3.5){
    // 金属 (ケイム/鉛): 曇りと擦れ
    float f = fbm(vUV*vec2(3.0,26.0));
    albedo *= 0.72+0.55*f;
    rough = clamp(uRough+0.30*f-0.12*uWear, 0.06, 0.95);
  } else if(uMat > 3.5 && uMat < 4.5){
    // 塗装木 (窓枠・雨戸): 木目と塗装の剥がれ
    float grain = fbm(vec2(vUV.x*3.0, vUV.y*40.0));
    float chip = smoothstep(0.62,0.80,fbm(vUV*9.0));
    albedo *= (0.86+0.24*grain);
    albedo = mix(albedo, albedo*vec3(0.62,0.52,0.44), chip*uWear);
    rough = mix(uRough, 0.92, chip*uWear);
    N = normalize(N + vec3(grain-0.5)*0.10);
  } else if(uMat > 4.5 && uMat < 5.5){
    // 屋外の地面・丘: まだら
    float f = fbm(vUV*1.6)*0.6+fbm(vUV*7.0)*0.4;
    albedo *= 0.72+0.55*f;
    rough = 0.95;
  }

  // --- 照明 -----------------------------------------------------------------
  vec3 L = normalize(-uSunDir);
  vec3 sunRad = vec3(0.0);
  if(uSunMode < 0.5) sunRad = uSunCol * sunTransmit(vW);
  else if(uSunMode < 1.5) sunRad = uSunCol;
  vec3 col = brdf(N,V,L,sunRad,albedo,rough,metal);

  // 作業灯 (点光源、逆二乗 + 距離減衰)
  vec3 lv = uLampPos - vW;
  float ld = length(lv);
  vec3 LL = lv/max(ld,1e-4);
  float atten = 1.0/(1.0+ld*ld*1.4);
  atten *= clamp(1.0-ld/uLampRange,0.0,1.0);
  col += brdf(N,V,LL,uLampCol*atten,albedo,rough,metal);

  // 半球アンビエント
  float hemi = N.y*0.5+0.5;
  vec3 amb = mix(uAmbBot,uAmbTop,hemi);
  // 環境マップを持たないので、金属には反射の代わりに環境光を厚めに足す
  col += amb*albedo*ao*(1.0+metal*2.2);

  // 窓からの間接光 (ガラスの色を含んだ弱いバウンス)
  col += uBounce*albedo*ao*(0.35+0.65*max(0.0,dot(N,vec3(0.0,0.0,1.0))))*step(uSunMode,0.5);

  col += uEmissive;

  // --- 空気遠近 -------------------------------------------------------------
  float dist = length(uCam-vW);
  float fog = 1.0-exp(-pow(dist*uFogDensity,2.0));
  col = mix(col, uFogCol, clamp(fog*uFogAmount,0.0,1.0));

  float bl = clamp((luma(col)-uBloomThresh)*0.55,0.0,1.0);
  gl_FragColor = vec4(pow(aces(col),vec3(1.0/2.2)), bl);
}
`;

// --- ステンドグラス --------------------------------------------------------
GLSL.glassFS = `
precision highp float;
varying vec3 vW;
varying vec3 vN;
varying vec2 vUV;

uniform vec3 uCam;
uniform vec3 uSunDir;
uniform vec3 uSunCol;
uniform vec3 uAmbTop;
uniform vec3 uAmbBot;
uniform vec3 uLampPos;
uniform vec3 uLampCol;
uniform vec3 uBase;
uniform float uFill;        // 0=すりガラス 1=着色済み
uniform float uBacklight;   // 背面からの採光量
uniform float uHighlight;
uniform sampler2D uDirt;
uniform float uDirtAmt;
uniform float uBloomThresh;
uniform float uTime;
uniform float uSeed;

${GLSL.noise}
${GLSL.tone}

void main(){
  vec3 N = normalize(vN);
  vec3 V = normalize(uCam - vW);

  // ガラス表面のうねりと気泡
  vec2 gp = vUV*vec2(9.0,9.0)+uSeed;
  float wave = fbm(gp*1.7)*0.7+fbm(gp*5.3)*0.3;
  float bub = smoothstep(0.80,0.93,vnoise(gp*13.0+3.1));
  N = normalize(N + vec3(wave-0.5, fbm(gp*2.1+7.0)-0.5, 0.0)*0.20);

  // 未着色は「すりガラスの生地」。完成形を見せすぎないよう彩度も明度も低く。
  vec3 base = mix(vec3(0.21,0.25,0.26), uBase, uFill);
  // 手吹きガラス特有の濃淡
  float dens = 0.72+0.56*wave;
  vec3 tint = pow(base, vec3(mix(1.35,0.75,dens)));

  float dirt = texture2D(uDirt, vUV).r*uDirtAmt;

  float fres = pow(1.0-max(dot(N,V),0.0),4.0);

  // 前面照明 (作業中): 半透明の板として見える
  vec3 lv = uLampPos - vW;
  float ld = length(lv);
  vec3 LL = lv/max(ld,1e-4);
  float atten = 1.0/(1.0+ld*ld*1.2);
  float ndl = max(dot(N,LL),0.0);
  vec3 col = tint*uLampCol*atten*(0.30+0.55*ndl)*0.45;
  vec3 H = normalize(LL+V);
  float spec = pow(max(dot(N,H),0.0), mix(90.0,26.0,dirt));
  col += uLampCol*atten*spec*mix(0.42,0.12,dirt);
  col += mix(uAmbBot,uAmbTop,N.y*0.5+0.5)*tint*0.7;
  col += tint*fres*0.20;

  // 背面照明 (取り付け後): ここで一気に発光する。
  // 色が飛ばないよう透過率は控えめにし、彩度を残したまま明るくする。
  float trans = uBacklight*(1.0-dirt*0.55)*(0.55+0.75*dens)*(1.0+0.7*bub);
  col += tint*uSunCol*trans*0.105;
  col += pow(tint,vec3(0.55))*trans*trans*0.10;

  // 汚れ: 白っぽい曇り
  col = mix(col, mix(vec3(0.46,0.45,0.42), vec3(0.9), uBacklight*0.5)*(0.45+0.55*wave), dirt*0.78);
  col += vec3(0.9,0.95,1.0)*uHighlight*(0.10+0.25*fres);

  // ガラスは不透明パスで描く。アルファはブルーム重みとして使う。
  float bl = clamp((luma(col)-uBloomThresh)*0.75,0.0,1.0);
  gl_FragColor = vec4(pow(aces(col),vec3(1.0/2.2)), bl);
}
`;

// --- 透過光マップ (色つき影) ------------------------------------------------
// RGB パス: 窓を透過した光の色 / A パス: 不透明遮蔽物の深度
GLSL.lightmapFS = `
precision highp float;
varying vec2 vUV;
uniform vec3 uColor;
uniform float uIsGlass;
uniform sampler2D uDirt;
uniform float uDirtAmt;
void main(){
  vec3 c = uColor;
  if(uIsGlass>0.5){
    float dirt = texture2D(uDirt, vUV).r*uDirtAmt;
    c *= 1.0-dirt*0.6;
  }
  gl_FragColor = vec4(c, gl_FragCoord.z);
}
`;

// --- 透明ガラス (下部の明かり取り。遠景が透けて見える) ----------------------
GLSL.clearGlassFS = `
precision highp float;
varying vec3 vW;
varying vec3 vN;
varying vec2 vUV;
uniform vec3 uCam;
uniform vec3 uSunCol;
uniform vec3 uSunDir;
uniform float uOpacity;
${GLSL.noise}
${GLSL.tone}
void main(){
  vec3 N = normalize(vN);
  vec3 V = normalize(uCam-vW);
  float fres = pow(1.0-max(dot(N,V),0.0),5.0);
  float grime = fbm(vUV*22.0)*0.5+fbm(vUV*70.0)*0.5;
  vec3 L = normalize(-uSunDir);
  vec3 H = normalize(L+V);
  float spec = pow(max(dot(N,H),0.0), 900.0);
  vec3 col = vec3(0.42,0.50,0.62)*(0.30+0.70*grime)*(0.02+0.045*luma(uSunCol))
           + uSunCol*spec*0.5;
  float a = clamp(uOpacity*(0.30+0.8*grime) + fres*0.5, 0.0, 1.0);
  gl_FragColor = vec4(pow(aces(col*3.0),vec3(1.0/2.2)), a);
}
`;

// --- 接地影 (乗算合成) ------------------------------------------------------
GLSL.shadowFS = `
precision mediump float;
varying vec2 vUV;
uniform float uStrength;
void main(){
  float r = length(vUV-0.5)*2.0;
  float s = mix(1.0-uStrength, 1.0, smoothstep(0.15,1.0,r));
  gl_FragColor = vec4(vec3(s), 1.0);
}
`;

// --- 空 --------------------------------------------------------------------
GLSL.skyVS = `
attribute vec3 aPos;
attribute vec2 aUV;
varying vec2 vUV;
void main(){ vUV=aUV; gl_Position=vec4(aPos.xy,0.999,1.0); }
`;

GLSL.skyFS = `
precision highp float;
varying vec2 vUV;
uniform mat4 uInvViewProj;
uniform vec3 uCam;
uniform vec3 uSunDir;
uniform vec3 uSunCol;
uniform vec3 uSkyTop;
uniform vec3 uSkyHorizon;
uniform float uStars;
uniform float uBloomThresh;
${GLSL.noise}
${GLSL.tone}
void main(){
  vec4 p = uInvViewProj*vec4(vUV*2.0-1.0, 1.0, 1.0);
  vec3 dir = normalize(p.xyz/p.w - uCam);
  float h = clamp(dir.y*0.5+0.5, 0.0, 1.0);
  vec3 col = mix(uSkyHorizon, uSkyTop, pow(h, 1.35));
  vec3 L = normalize(-uSunDir);
  float sd = max(dot(dir,L),0.0);
  col += uSunCol*pow(sd, 260.0)*3.0;
  col += uSunCol*pow(sd, 6.0)*0.14;
  if(uStars>0.01){
    vec2 sp = dir.xz/max(abs(dir.y)+0.35,0.15);
    float st = smoothstep(0.9955,0.9995, hash21(floor(sp*180.0)));
    col += vec3(0.85,0.9,1.0)*st*uStars*max(dir.y,0.0);
  }
  float bl = clamp((luma(col)-uBloomThresh)*0.5,0.0,1.0);
  gl_FragColor = vec4(pow(aces(col),vec3(1.0/2.2)), bl);
}
`;

// --- 光の柱 (加算) ---------------------------------------------------------
GLSL.shaftFS = `
precision highp float;
varying vec3 vW;
varying vec3 vN;
varying vec2 vUV;
uniform vec3 uCam;
uniform mat4 uLightVP;
uniform sampler2D uLightMap;
uniform vec3 uSunCol;
uniform vec3 uOrigin;
uniform float uStrength;
uniform float uTime;
${GLSL.noise}
${GLSL.tone}
void main(){
  vec4 lp = uLightVP*vec4(vW,1.0);
  vec3 lndc = lp.xyz/max(lp.w,1e-5);
  vec2 uv = lndc.xy*0.5+0.5;
  if(uv.x<0.0||uv.x>1.0||uv.y<0.0||uv.y>1.0) discard;
  vec4 lms = texture2D(uLightMap,uv);
  vec3 c = lms.rgb*step(lndc.z*0.5+0.5-0.004, lms.a);
  float d = distance(vW,uOrigin);
  float fall = exp(-d*0.30);
  // ほこりのゆらぎ
  float n = fbm(vW.xz*1.7+vec2(uTime*0.05,uTime*0.03))*0.6
          + fbm(vW.xy*3.1-vec2(uTime*0.04,0.0))*0.4;
  float edge = smoothstep(0.0,0.06,uv.x)*smoothstep(1.0,0.94,uv.x)
             * smoothstep(0.0,0.06,uv.y)*smoothstep(1.0,0.94,uv.y);
  vec3 V = normalize(uCam-vW);
  float graze = 1.0-abs(dot(normalize(vN),V));
  vec3 col = c*uSunCol*uStrength*fall*edge*(0.45+0.85*n)*(0.35+0.85*graze);
  vec3 o = pow(aces(col),vec3(1.0/2.2));
  gl_FragColor = vec4(o, luma(o)*0.5);
}
`;

// --- ほこり (点スプライト、加算) --------------------------------------------
GLSL.dustVS = `
attribute vec3 aPos;
attribute vec3 aNormal;   // x: 位相, y: 速度, z: サイズ
varying vec3 vW;
varying float vSize;
uniform mat4 uViewProj;
uniform vec3 uCam;
uniform float uTime;
uniform float uPix;
void main(){
  vec3 p = aPos;
  float t = uTime*aNormal.y + aNormal.x*6.28;
  p.x += sin(t*0.7)*0.10;
  p.y += sin(t*0.45+1.7)*0.07 - fract(uTime*0.012*aNormal.y+aNormal.x)*0.0;
  p.z += cos(t*0.55+3.1)*0.10;
  vW = p;
  vec4 cp = uViewProj*vec4(p,1.0);
  gl_Position = cp;
  float d = max(length(uCam-p),0.2);
  vSize = aNormal.z;
  gl_PointSize = clamp(aNormal.z*uPix/d, 1.0, 6.0);
}
`;

GLSL.dustFS = `
precision highp float;
varying vec3 vW;
varying float vSize;
uniform mat4 uLightVP;
uniform sampler2D uLightMap;
uniform vec3 uSunCol;
uniform float uStrength;
${GLSL.tone}
void main(){
  vec2 d = gl_PointCoord-0.5;
  float r = length(d);
  if(r>0.5) discard;
  vec4 lp = uLightVP*vec4(vW,1.0);
  vec3 lndc = lp.xyz/max(lp.w,1e-5);
  vec2 uv = lndc.xy*0.5+0.5;
  if(uv.x<0.0||uv.x>1.0||uv.y<0.0||uv.y>1.0) discard;
  vec4 lms = texture2D(uLightMap,uv);
  vec3 c = lms.rgb*step(lndc.z*0.5+0.5-0.004, lms.a);
  float a = smoothstep(0.5,0.0,r);
  vec3 col = c*uSunCol*uStrength*a*2.2;
  vec3 o = pow(aces(col),vec3(1.0/2.2));
  gl_FragColor = vec4(o, luma(o)*0.7);
}
`;

// --- 無照明 (けがき線・ヒント・スパーク) ------------------------------------
GLSL.flatFS = `
precision highp float;
varying vec3 vW;
varying vec2 vUV;
uniform vec3 uColor;
uniform float uAlpha;
uniform float uRing;   // >0.5 でリング形状
uniform float uTime;
${GLSL.tone}
void main(){
  float a = uAlpha;
  float r = length(vUV-0.5)*2.0;
  if(uRing>0.5){
    float ring = smoothstep(0.55,0.72,r)*smoothstep(1.0,0.86,r);
    float dot0 = smoothstep(0.34,0.0,r)*0.55;
    a *= max(ring, dot0);
  } else {
    a *= smoothstep(1.0,0.05,r);
    a *= a;
  }
  gl_FragColor = vec4(pow(aces(uColor*a*2.0),vec3(1.0/2.2)), a);
}
`;

GLSL.spriteVS = `
attribute vec3 aPos;
attribute vec2 aUV;
varying vec3 vW;
varying vec2 vUV;
uniform mat4 uViewProj;
uniform vec3 uCenter;
uniform vec3 uRight;
uniform vec3 uUp;
uniform float uSize;
void main(){
  vUV = aUV;
  vec3 p = uCenter + uRight*aPos.x*uSize + uUp*aPos.y*uSize;
  vW = p;
  gl_Position = uViewProj*vec4(p,1.0);
}
`;

// --- ポストプロセス ---------------------------------------------------------
GLSL.postVS = `
attribute vec3 aPos;
attribute vec2 aUV;
varying vec2 vUV;
void main(){ vUV=aUV; gl_Position=vec4(aPos.xy,0.0,1.0); }
`;

GLSL.brightFS = `
precision highp float;
varying vec2 vUV;
uniform sampler2D uTex;
void main(){
  vec4 c = texture2D(uTex,vUV);
  gl_FragColor = vec4(c.rgb*c.a, 1.0);
}
`;

GLSL.blurFS = `
precision highp float;
varying vec2 vUV;
uniform sampler2D uTex;
uniform vec2 uDir;
void main(){
  vec3 s = texture2D(uTex,vUV).rgb*0.2270270270;
  s += texture2D(uTex,vUV+uDir*1.3846153846).rgb*0.3162162162;
  s += texture2D(uTex,vUV-uDir*1.3846153846).rgb*0.3162162162;
  s += texture2D(uTex,vUV+uDir*3.2307692308).rgb*0.0702702703;
  s += texture2D(uTex,vUV-uDir*3.2307692308).rgb*0.0702702703;
  gl_FragColor = vec4(s,1.0);
}
`;

GLSL.compFS = `
precision highp float;
varying vec2 vUV;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform float uBloomAmt;
uniform float uVignette;
uniform float uTime;
uniform float uFade;
uniform vec2 uAspect;
void main(){
  vec3 c = texture2D(uScene,vUV).rgb;
  vec3 b = texture2D(uBloom,vUV).rgb;
  c += b*uBloomAmt;
  vec2 d = (vUV-0.5)*uAspect;
  float v = 1.0-uVignette*dot(d,d)*1.15;
  c *= clamp(v,0.0,1.0);
  float g = fract(sin(dot(vUV*vec2(1.0,1.3)+uTime*0.37,vec2(12.9898,78.233)))*43758.5453);
  c += (g-0.5)*0.014;
  c *= uFade;
  gl_FragColor = vec4(c,1.0);
}
`;

// 汚れマスク描画用 (磨き)
GLSL.brushVS = `
attribute vec3 aPos;
attribute vec2 aUV;
varying vec2 vUV;
uniform vec2 uCenter;
uniform float uRadius;
void main(){
  vUV = aUV;
  vec2 p = uCenter + aPos.xy*uRadius;
  gl_Position = vec4(p*2.0-1.0, 0.0, 1.0);
}
`;

GLSL.brushFS = `
precision highp float;
varying vec2 vUV;
uniform float uStrength;
void main(){
  float r = length(vUV-0.5)*2.0;
  float a = smoothstep(1.0,0.15,r)*uStrength;
  gl_FragColor = vec4(0.0,0.0,0.0,a);
}
`;
