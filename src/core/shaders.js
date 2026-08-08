// GLSL ES 3.00 sources. One PBR-ish surface shader for props, a dedicated
// ultra-thin gold-leaf shader, plus depth and post passes.

const COMMON = /* glsl */`
const float PI = 3.14159265359;

// ---- procedural noise -------------------------------------------------
float hash21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i), b = hash21(i + vec2(1,0));
  float c = hash21(i + vec2(0,1)), d = hash21(i + vec2(1,1));
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}
// Three octaves is the sweet spot here: the surfaces are seen from close range
// under a single soft light, and the fourth octave costs more than it shows.
float fbm(vec2 p){
  float s = 0.5 * vnoise(p);
  s += 0.25 * vnoise(p * 2.03);
  s += 0.125 * vnoise(p * 4.09);
  return s * 1.1428;
}

// ---- lighting ---------------------------------------------------------
float D_GGX(float NoH, float a){
  float a2 = a * a;
  float d = NoH * NoH * (a2 - 1.0) + 1.0;
  return a2 / max(PI * d * d, 1e-7);
}
float V_Smith(float NoV, float NoL, float a){
  float a2 = a * a;
  float gv = NoL * sqrt(NoV * NoV * (1.0 - a2) + a2);
  float gl = NoV * sqrt(NoL * NoL * (1.0 - a2) + a2);
  return 0.5 / max(gv + gl, 1e-6);
}
vec3 F_Schlick(vec3 f0, float u){
  return f0 + (vec3(1.0) - f0) * pow(1.0 - u, 5.0);
}

// Studio environment: a warm shoji window low at the back, dark timber ceiling,
// dim tatami bounce. Used for both diffuse irradiance and specular reflection.
vec3 envColor(vec3 d){
  float up = d.y * 0.5 + 0.5;
  vec3 ceilingC = vec3(0.0075, 0.0068, 0.0065);
  vec3 floorC   = vec3(0.0250, 0.0185, 0.0120);
  vec3 base = mix(floorC, ceilingC, smoothstep(0.30, 0.9, up));
  // shoji panel: broad soft rectangle toward -Z, slightly above horizon
  float win = smoothstep(0.42, 0.99, -d.z) * smoothstep(-0.40, 0.30, d.y) * (1.0 - smoothstep(0.55, 0.92, d.y));
  base += vec3(1.00, 0.86, 0.66) * win * win * 0.62;
  // warm paper lantern to the right
  float lamp = smoothstep(0.90, 0.998, dot(normalize(d), normalize(vec3(0.85, 0.34, 0.12))));
  base += vec3(1.0, 0.70, 0.38) * lamp * 0.45;
  return base;
}

vec3 aces(vec3 x){
  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}
`;

const SHADOW = /* glsl */`
uniform highp sampler2DShadow uShadowMap;
uniform vec2 uShadowTexel;
float shadowFactor(vec4 lightPos, float NoL){
  vec3 p = lightPos.xyz / lightPos.w;
  p = p * 0.5 + 0.5;
  if (p.z > 1.0 || p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0) return 1.0;
  float bias = mix(0.0016, 0.0004, NoL);
  float s = 0.0;
  // Wider taps than a straight 3x3: the light source is a paper screen, so
  // nothing in this room casts a razor edge.
  for (int y = -1; y <= 1; y++){
    for (int x = -1; x <= 1; x++){
      vec2 o = vec2(float(x), float(y)) * uShadowTexel * 2.1;
      s += texture(uShadowMap, vec3(p.xy + o, p.z - bias));
    }
  }
  return s / 9.0;
}
`;

export const VS_SURFACE = /* glsl */`#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec2 aUV;
layout(location=3) in float aAO;
uniform mat4 uProj, uView, uModel, uNormalMat, uLightVP;
out vec3 vWorld;
out vec3 vNormal;
out vec2 vUV;
out float vAO;
out vec4 vLightPos;
void main(){
  vec4 wp = uModel * vec4(aPos, 1.0);
  vWorld = wp.xyz;
  vNormal = normalize((uNormalMat * vec4(aNormal, 0.0)).xyz);
  vUV = aUV;
  vAO = aAO;
  vLightPos = uLightVP * wp;
  gl_Position = uProj * uView * wp;
}`;

export const FS_SURFACE = /* glsl */`#version 300 es
precision highp float;
${COMMON}
${SHADOW}
in vec3 vWorld;
in vec3 vNormal;
in vec2 vUV;
in float vAO;
in vec4 vLightPos;
out vec4 fragColor;

uniform vec3 uCameraPos;
uniform vec3 uLightDir;      // surface -> light
uniform vec3 uLightColor;
uniform vec3 uBaseColor;
uniform float uRoughness;
uniform float uMetalness;
uniform float uMatType;      // 0 plain 1 wood 2 lacquer 3 bamboo 4 paper 5 plaster 6 metal 7 leather 8 tatami 9 cloth
uniform float uWear;         // 0..1 scuff/dirt amount
uniform float uFogDensity;
uniform vec3 uFogColor;
uniform float uEmissive;
uniform float uTranslucency;   // >0 only for genuinely thin sheets
uniform float uUnderGlow;      // gold spreading between the papers, 0..1
uniform float uUnderRadius;    // how far it has spread, as a fraction of the sheet
uniform float uAlpha;
uniform float uTime;

struct Surf { vec3 albedo; float rough; float metal; vec3 normal; float ao; };

Surf material(vec3 N){
  Surf s;
  s.albedo = uBaseColor;
  s.rough = uRoughness;
  s.metal = uMetalness;
  s.normal = N;
  s.ao = vAO;
  vec2 uv = vUV;
  int t = int(uMatType + 0.5);

  if (t == 1){ // planed cedar / keyaki bench top: long grain, knots, oil patches
    float grain = fbm(vec2(uv.x * 5.0, uv.y * 130.0));
    float rings = fbm(vec2(uv.x * 42.0, uv.y * 3.0));
    float g = grain * 0.55 + rings * 0.45;
    s.albedo *= 0.74 + 0.40 * g;
    s.albedo *= 1.0 - 0.26 * smoothstep(0.55, 0.95, rings);
    s.rough = clamp(uRoughness - 0.18 * rings + 0.10 * grain, 0.12, 1.0);
    // dirt settled where hands and tools pass
    s.albedo *= 1.0 - uWear * 0.30 * smoothstep(0.35, 1.0, rings);
    s.normal = normalize(N + vec3((grain - 0.5) * 0.10, 0.0, (grain - 0.5) * 0.03));
  } else if (t == 2){ // urushi lacquer: deep, wet, faint brush undulation + micro scratches
    float undul = fbm(uv * 26.0) - 0.5;
    s.normal = normalize(N + vec3(undul, 0.0, undul * 0.7) * 0.055);
    // On a turned piece the polish marks run around the form, not out from the
    // centre — uv.x is the circumference here, so the fine variation goes in y.
    float scratch = smoothstep(0.72, 0.98, vnoise(vec2(uv.x * 9.0, uv.y * 260.0)));
    s.rough = clamp(uRoughness + scratch * 0.26 * uWear, 0.02, 1.0);
    s.albedo *= 0.94 + 0.12 * undul;
  } else if (t == 3){ // bamboo: fibrous length streaks, waxy sheen
    float fib = fbm(vec2(uv.x * 240.0, uv.y * 3.0));
    s.albedo *= 0.72 + 0.5 * fib;
    s.rough = clamp(uRoughness - 0.12 * fib, 0.08, 1.0);
  } else if (t == 4){ // washi: cloudy fibre distribution, soft translucency feel
    float fibre = fbm(uv * 90.0);
    float streak = vnoise(vec2(uv.y * 320.0, uv.x * 8.0));
    s.albedo *= 0.80 + 0.26 * fibre + 0.10 * streak;
    s.rough = clamp(uRoughness - 0.05 * fibre, 0.35, 1.0);
    s.normal = normalize(N + vec3(fibre - 0.5, 0.0, (streak - 0.5) * 0.8) * 0.12);
    s.albedo *= 1.0 - uWear * 0.26 * smoothstep(0.5, 1.0, fibre);
  } else if (t == 5){ // clay plaster wall
    float g = fbm(uv * 24.0);
    s.albedo *= 0.74 + 0.46 * g;
    s.normal = normalize(N + vec3(g - 0.5, (g - 0.5) * 0.4, g - 0.5) * 0.20);
  } else if (t == 6){ // worked iron / brass tooling
    // hammer-peened face: fine, shallow, never mottled
    float pit = fbm(uv * 420.0);
    s.rough = clamp(uRoughness + 0.16 * pit * uWear, 0.05, 1.0);
    s.albedo *= 0.90 + 0.16 * pit;
    s.normal = normalize(N + vec3(pit - 0.5, 0.0, (pit - 0.5) * 0.8) * 0.05);
  } else if (t == 7){ // deer hide board (revolving leather) - suede nap
    float nap = fbm(uv * 150.0);
    s.albedo *= 0.75 + 0.45 * nap;
    s.rough = clamp(uRoughness - 0.10 * nap, 0.4, 1.0);
    s.normal = normalize(N + vec3(nap - 0.5, 0.0, nap - 0.5) * 0.16);
  } else if (t == 8){ // tatami weave
    float weave = sin(uv.x * 210.0) * 0.5 + 0.5;
    float rowv = step(0.5, fract(uv.y * 1.6));
    float w = mix(weave, sin(uv.y * 210.0) * 0.5 + 0.5, rowv);
    s.albedo *= 0.66 + 0.42 * w * (0.7 + 0.5 * fbm(uv * 20.0));
    s.rough = clamp(uRoughness - 0.12 * w, 0.3, 1.0);
  } else if (t == 9){ // indigo cloth / noren
    float th = fbm(vec2(uv.x * 300.0, uv.y * 300.0));
    s.albedo *= 0.72 + 0.5 * th;
    s.rough = clamp(uRoughness + 0.1 * th, 0.4, 1.0);
  }
  return s;
}

void main(){
  vec3 N0 = normalize(vNormal);
  vec3 V = normalize(uCameraPos - vWorld);
  if (!gl_FrontFacing) N0 = -N0;
  Surf s = material(N0);
  vec3 N = normalize(s.normal);
  vec3 L = normalize(uLightDir);
  vec3 H = normalize(V + L);
  float NoV = max(dot(N, V), 1e-4);
  float NoL = max(dot(N, L), 0.0);
  float NoH = max(dot(N, H), 0.0);
  float VoH = max(dot(V, H), 0.0);

  float a = max(s.rough * s.rough, 0.0015);
  vec3 f0 = mix(vec3(0.04), s.albedo, s.metal);
  vec3 diffuseColor = s.albedo * (1.0 - s.metal);

  float shadow = shadowFactor(vLightPos, NoL);
  vec3 direct = vec3(0.0);
  {
    vec3 F = F_Schlick(f0, VoH);
    float D = D_GGX(NoH, a);
    float Vis = V_Smith(NoV, NoL, a);
    vec3 spec = F * D * Vis;
    vec3 kd = (vec3(1.0) - F);
    direct = (kd * diffuseColor / PI + spec) * uLightColor * NoL * shadow;
  }

  // image-based-ish ambient from the procedural environment
  vec3 R = reflect(-V, N);
  vec3 irr = envColor(N) * 1.0;
  vec3 refl = envColor(normalize(mix(R, N, s.rough * s.rough))) * (1.0 - s.rough * 0.6);
  vec3 Fenv = F_Schlick(f0, NoV);
  vec3 ambient = (diffuseColor * irr + refl * Fenv * (0.30 + 0.70 * s.metal)) * s.ao;

  vec3 color = direct + ambient + s.albedo * uEmissive;

  // A single sheet of washi lets light through. Without this, paper standing
  // between you and the window reads as a black slab. Only sheets get it —
  // a bundle of two dozen sheets is opaque.
  if (uTranslucency > 0.001) {
    float back = max(dot(-N, L), 0.0);
    color += s.albedo * uLightColor * pow(back, 1.3) * 0.60 * uTranslucency * mix(0.35, 1.0, shadow);
    color += s.albedo * envColor(-N) * 0.55 * uTranslucency;
  }

  // The gold spreading between the sheets shows through the paper. Beaten
  // washi is thin enough that you can see the metal grow while you work.
  if (uUnderGlow > 0.001) {
    vec2 c = vUV / 0.16 - 0.5;
    float r = max(abs(c.x), abs(c.y)) * 2.0;
    float g = smoothstep(uUnderRadius, uUnderRadius * 0.35, r);
    float mottle = 0.75 + 0.5 * fbm(vUV * 60.0);
    color += vec3(1.00, 0.58, 0.18) * g * uUnderGlow * mottle * 1.45;
    // the boundary of the metal reads as a brighter line through the fibre
    float rim = smoothstep(0.10, 0.0, abs(r - uUnderRadius));
    color += vec3(1.00, 0.72, 0.34) * rim * uUnderGlow * 0.9;
  }

  // aerial perspective: distant geometry loses contrast and picks up warm haze
  float dist = length(uCameraPos - vWorld);
  float fog = 1.0 - exp(-uFogDensity * dist * dist);
  color = mix(color, uFogColor, clamp(fog, 0.0, 1.0));

  fragColor = vec4(color, uAlpha);
}`;

// --------------------------------------------------------------------------
// Gold leaf: a zero-thickness sheet. Everything here exists to sell 0.1 micron.
// --------------------------------------------------------------------------
export const VS_LEAF = /* glsl */`#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec2 aUV;
layout(location=3) in float aAO;
uniform mat4 uProj, uView, uModel, uNormalMat, uLightVP;
out vec3 vWorld;
out vec3 vNormal;
out vec2 vUV;
out float vSlack;   // local crumple energy fed from the CPU sim
out vec4 vLightPos;
void main(){
  vec4 wp = uModel * vec4(aPos, 1.0);
  vWorld = wp.xyz;
  vNormal = normalize((uNormalMat * vec4(aNormal, 0.0)).xyz);
  vUV = aUV;
  vSlack = aAO;
  vLightPos = uLightVP * wp;
  gl_Position = uProj * uView * wp;
}`;

export const FS_LEAF = /* glsl */`#version 300 es
precision highp float;
${COMMON}
${SHADOW}
in vec3 vWorld;
in vec3 vNormal;
in vec2 vUV;
in float vSlack;
in vec4 vLightPos;
out vec4 fragColor;

uniform vec3 uCameraPos;
uniform vec3 uLightDir;
uniform vec3 uLightColor;
uniform float uTime;
uniform float uWrinkle;    // 0 = burnished flat, 1 = freshly laid and creased
uniform float uAdhesion;   // 0 = free floating, 1 = pressed onto the base
uniform float uThinness;   // 0 = 上澄 at 3/1000 mm, 1 = 箔 at 1/10000 mm
uniform float uEdge;       // visible half-extent as a fraction of the mesh
uniform float uRagged;     // 1 = as beaten, 0 = cut square by the 枠
uniform float uBond;       // radius of the wetting front as it grabs the urushi
uniform float uSparkle;    // キラッ sweep amount
uniform float uSweep;      // 0..1 position of the reflection sweep across the sheet
uniform float uFogDensity;
uniform vec3 uFogColor;
uniform float uOpacity;

// Gold leaf beaten to ~0.1 micron transmits green-blue light. That transmission
// is the single most recognisable "this is real leaf, not yellow paper" cue.
const vec3 GOLD_F0 = vec3(1.000, 0.766, 0.336);
// Measured transmission through leaf is a dim blue-green, not a poster colour.
const vec3 TRANSMIT = vec3(0.055, 0.225, 0.200);

// The leaf is the hero, and what it reflects is what makes it metal. It sees a
// broad shoji panel, a dark timber ceiling and a warm bounce off the bench —
// an area source, never a point, which is why its highlight is a moving band
// rather than a dot.
vec3 envLeaf(vec3 d){
  vec3 c = envColor(d) * 1.05;
  float win = smoothstep(0.05, 0.95, -d.z) * smoothstep(-0.65, 0.45, d.y);
  c += vec3(1.00, 0.80, 0.47) * win * win * 0.58;
  c += vec3(0.42, 0.22, 0.08) * smoothstep(0.15, -0.85, d.y) * 0.24;
  return c;
}

void main(){
  // --- the outline of the metal ---------------------------------------
  // Straight off the papers the leaf has no edge to speak of: it is torn,
  // feathered and never square. The bamboo 枠 is what makes it a 109 mm
  // square, so until then the boundary is noise.
  vec2 qe = vUV - 0.5;
  float edge = uEdge;
  float along = abs(qe.x) > abs(qe.y) ? qe.y : qe.x;
  float bite = (fbm(vec2(along * 26.0, 4.0)) - 0.42) * 0.22
             + (vnoise(vec2(along * 95.0, 11.0)) - 0.5) * 0.06;
  float bound = edge * (1.0 + bite * uRagged);
  if (max(abs(qe.x), abs(qe.y)) > bound) discard;

  vec3 Ng = normalize(vNormal);
  bool front = gl_FrontFacing;
  vec3 N = front ? Ng : -Ng;
  vec3 V = normalize(uCameraPos - vWorld);
  vec3 L = normalize(uLightDir);

  // Micro-crumple: the hammered sheet keeps a fine, directional wrinkle field.
  // Sampled as a small gradient stencil so creases bend the reflection rather
  // than just darkening the surface.
  vec2 p = vUV * vec2(34.0, 31.0);
  float w1 = fbm(p);
  float creaseAmp = uWrinkle * (0.35 + 0.65 * vSlack);
  vec2 grad = vec2(fbm(p + vec2(0.42, 0.0)) - w1, fbm(p + vec2(0.0, 0.38)) - w1) * 2.4;
  vec2 q = vUV * vec2(140.0, 122.0);
  float w2 = vnoise(q);
  vec2 grad2 = vec2(vnoise(q + vec2(0.6, 0.0)) - w2, vnoise(q + vec2(0.0, 0.6)) - w2) * 1.6;
  vec3 T = normalize(abs(N.y) > 0.9 ? vec3(1,0,0) : normalize(cross(vec3(0,1,0), N)));
  vec3 B = normalize(cross(N, T));
  N = normalize(N
    + T * (grad.x * 0.30 * creaseAmp + grad2.x * 0.05 * (0.4 + creaseAmp))
    + B * (grad.y * 0.30 * creaseAmp + grad2.y * 0.05 * (0.4 + creaseAmp)));

  float NoV = max(dot(N, V), 1e-4);
  float NoL = dot(N, L);
  vec3 H = normalize(V + L);
  float NoH = max(dot(N, H), 0.0);
  float VoH = max(dot(V, H), 0.0);

  // Anisotropic sheen: leaf is beaten, not cast — highlights smear along the
  // grain left by the hammer. The direct term is widened to stand in for the
  // shoji's angular size; a delta highlight on a flat sheet would simply turn
  // the whole thing white.
  // At three thousandths of a millimetre the metal is still a stiff little
  // plate with a dull, scattered sheen; at one ten-thousandth it becomes the
  // mirror-bright, translucent thing everyone recognises as gold leaf.
  float rough = mix(0.11, 0.32, uWrinkle * 0.7 + 0.12 * w1);
  rough = mix(rough + 0.30, rough, uThinness);
  float aniso = 0.55;
  float ax = max(rough * rough * (1.0 + aniso), 0.006);
  float ay = max(rough * rough * (1.0 - aniso), 0.003);
  float ToH = dot(T, H), BoH = dot(B, H);
  float dd = ToH * ToH / (ax * ax) + BoH * BoH / (ay * ay) + NoH * NoH;
  float Daniso = 1.0 / (PI * ax * ay * dd * dd);

  vec3 F = F_Schlick(GOLD_F0, VoH);
  float Vis = V_Smith(NoV, max(NoL, 0.0), rough);
  vec3 spec = F * Daniso * Vis * uLightColor * max(NoL, 0.0);
  // Soft compression rather than a hard ceiling: a clipped highlight turns the
  // whole flat sheet into one white plateau and the gold disappears.
  spec = spec / (1.0 + spec * 0.55);

  float shadow = shadowFactor(vLightPos, max(NoL, 0.0));
  spec *= mix(0.55, 1.0, shadow);

  // Environment reflection is what makes leaf read as metal rather than paint.
  vec3 R = reflect(-V, N);
  vec3 refl = envLeaf(R) * F_Schlick(GOLD_F0, NoV) * 0.62;

  // Kept well under the point where the tone curve would wash the hue out:
  // leaf that reads white is leaf that reads like paper.
  // Kept deliberately below 1 in most of the frame: past that the tone curve
  // pulls every channel toward white and the gold turns into cream paper.
  vec3 color = spec * 0.42 + refl;
  color += GOLD_F0 * 0.05 * envLeaf(N);

  // Backlit transmission — visible from the back face and at thin grazing edges.
  float backLit = max(-NoL, 0.0);
  vec3 trans = TRANSMIT * uLightColor * pow(backLit, 0.7) * (front ? 0.22 : 1.0)
    * (1.0 - uAdhesion * 0.85) * uThinness;
  color += trans;
  // thick metal simply reflects less and scatters more
  color = mix(color * 0.72 + GOLD_F0 * 0.05 * envLeaf(N), color, uThinness);

  // Grazing edges: at 0.1 micron the rim goes translucent and glows.
  float rim = pow(1.0 - NoV, 3.0);
  color += vec3(1.0, 0.72, 0.32) * rim * 0.40 * (1.0 - uAdhesion * 0.5) * uThinness;
  // A leaf laid on tacky urushi does not settle all at once: contact spreads
  // outward from where it first touched, and the bonded part goes still.
  float bonded = uBond <= 0.0 ? 0.0
    : smoothstep(uBond + 0.10, uBond - 0.10, length(qe) * 2.0);
  color = mix(color, color * 1.06, bonded);

  // キラッ: a bright reflection band travelling across the sheet.
  float band = exp(-pow((vUV.x + vUV.y * 0.35 - (uSweep * 2.2 - 0.6)) * 6.0, 2.0));
  color += vec3(1.0, 0.90, 0.62) * band * uSparkle * 1.7;
  float glint = pow(max(dot(reflect(-L, N), V), 0.0), 220.0);
  color += vec3(1.0, 0.93, 0.70) * glint * (1.0 + uSparkle * 3.5);

  float dist = length(uCameraPos - vWorld);
  float fog = 1.0 - exp(-uFogDensity * dist * dist);
  color = mix(color, uFogColor, clamp(fog, 0.0, 1.0));

  // Thinness as opacity: face-on it is nearly opaque, edge-on you see through it.
  float alpha = mix(0.74, 0.985, smoothstep(0.05, 0.55, NoV));
  alpha = mix(alpha, 1.0, uAdhesion * 0.9);
  alpha = mix(1.0, alpha, uThinness);   // 上澄 is not see-through at all
  fragColor = vec4(color, alpha * uOpacity);
}`;

// --------------------------------------------------------------------------
export const VS_DEPTH = /* glsl */`#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
uniform mat4 uLightVP, uModel;
void main(){
  gl_Position = uLightVP * uModel * vec4(aPos, 1.0);
}`;

export const FS_DEPTH = /* glsl */`#version 300 es
precision highp float;
void main(){}`;

export const VS_QUAD = /* glsl */`#version 300 es
precision highp float;
layout(location=0) in vec2 aPos;
out vec2 vUV;
void main(){
  vUV = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

export const FS_BRIGHT = /* glsl */`#version 300 es
precision highp float;
in vec2 vUV;
out vec4 fragColor;
uniform sampler2D uTex;
uniform float uThreshold;
void main(){
  vec3 c = texture(uTex, vUV).rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float k = max(l - uThreshold, 0.0) / max(l, 1e-4);
  fragColor = vec4(c * k, 1.0);
}`;

export const FS_BLUR = /* glsl */`#version 300 es
precision highp float;
in vec2 vUV;
out vec4 fragColor;
uniform sampler2D uTex;
uniform vec2 uDir;
void main(){
  vec3 c = texture(uTex, vUV).rgb * 0.2270270270;
  c += texture(uTex, vUV + uDir * 1.3846153846).rgb * 0.3162162162;
  c += texture(uTex, vUV - uDir * 1.3846153846).rgb * 0.3162162162;
  c += texture(uTex, vUV + uDir * 3.2307692308).rgb * 0.0702702703;
  c += texture(uTex, vUV - uDir * 3.2307692308).rgb * 0.0702702703;
  fragColor = vec4(c, 1.0);
}`;

export const FS_COMPOSITE = /* glsl */`#version 300 es
precision highp float;
${COMMON}
in vec2 vUV;
out vec4 fragColor;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform float uBloomAmount;
uniform float uExposure;
uniform float uTime;
uniform float uFlash;
uniform vec2 uResolution;
void main(){
  // slight chromatic spread at the frame edge reads as a real lens
  vec2 d = vUV - 0.5;
  float r2 = dot(d, d);
  vec2 off = d * r2 * 0.0035;
  vec3 scene;
  scene.r = texture(uScene, vUV + off).r;
  scene.g = texture(uScene, vUV).g;
  scene.b = texture(uScene, vUV - off).b;
  vec3 bloom = texture(uBloom, vUV).rgb;
  vec3 c = scene + bloom * uBloomAmount;
  c *= uExposure * (1.0 + uFlash * 0.9);
  c = aces(c);
  c = pow(c, vec3(1.0 / 2.2));
  float vig = smoothstep(1.15, 0.25, length(d) * 1.45);
  c *= mix(0.55, 1.0, vig);
  // fine grain keeps flat dark areas from banding
  float g = hash21(vUV * uResolution + fract(uTime) * 91.7) - 0.5;
  c += g * 0.012;
  fragColor = vec4(c, 1.0);
}`;

// Dust motes / airborne gold flecks — instanced points with real depth.
export const VS_MOTE = /* glsl */`#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aSeed;
uniform mat4 uProj, uView;
uniform float uTime;
uniform float uPointScale;
uniform float uAnimate;   // 1 = room dust drifting on its own, 0 = simulated flakes
out float vFade;
out vec3 vSeed;
void main(){
  vec3 p = aPos;
  float t = uTime * 0.35 + aSeed.x * 10.0;
  p.x += sin(t * 0.7 + aSeed.y * 6.0) * 0.035 * uAnimate;
  p.y += (sin(t * 0.45 + aSeed.z * 6.0) * 0.030 + mod(uTime * 0.006 + aSeed.x, 0.22)) * uAnimate;
  p.z += cos(t * 0.55 + aSeed.x * 6.0) * 0.035 * uAnimate;
  vec4 vp = uView * vec4(p, 1.0);
  gl_Position = uProj * vp;
  float dist = -vp.z;
  gl_PointSize = clamp(uPointScale / max(dist, 0.05), 1.0, 14.0) * (0.5 + aSeed.y);
  vFade = smoothstep(1.6, 0.25, dist) * (0.25 + 0.75 * aSeed.z);
  vSeed = aSeed;
}`;

export const FS_MOTE = /* glsl */`#version 300 es
precision highp float;
in float vFade;
in vec3 vSeed;
out vec4 fragColor;
uniform vec3 uColor;
uniform float uIntensity;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  float a = smoothstep(0.5, 0.0, d);
  vec3 col = uColor * (0.6 + 0.9 * vSeed.y);
  fragColor = vec4(col * a * vFade * uIntensity, a * vFade * uIntensity);
}`;
