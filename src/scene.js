// ============================================================================
// 工房 — 近景（作業台と布）／中景（藍甕・すすぎ桶）／遠景（土壁・窓・干し布）
// 空気遠近、影、材質のちがいで、ひと目で奥行きが読めるようにする。
//
// 寸法は実物に合わせている:
//   藍甕  … 口径 0.75m / 高さ 0.66m（紺屋の甕は床に埋めるが、見やすさのため床置き）
//   作業台 … 高さ 0.34m の低い台
//   布    … 一辺 0.86m
// ============================================================================

import * as THREE from '../vendor/three.module.js';
import { lerp, clamp01, makeRng } from './util.js';

// 甕は大きい。折った布（最大 1.2m ほどの帯になる）が入る口径にしてある。
export const VAT = {
  x: 0.0, z: -0.70,
  rimY: 0.660,
  liquidY: 0.548,
  radius: 0.54,
  innerR: 0.450
};

export const TABLE = { x: 0, z: 0.66, y: 0.34, w: 1.50, d: 1.02 };
export const BASIN = { x: -1.34, z: 0.16, y: 0.30, r: 0.40 };
export const LINE = { y: 1.74, z: -1.70, halfW: 1.5 };

// ---------------------------------------------------------------------------
// 手続き的テクスチャ
// ---------------------------------------------------------------------------

function canvasTex(size, draw, repeat = 1, srgb = true) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  draw(g, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function woodTexture(size, base, dark, seed, planks) {
  const rng = makeRng(seed);
  return canvasTex(size, (g, s) => {
    g.fillStyle = base; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 320; i++) {
      const y = rng() * s;
      g.strokeStyle = `rgba(${dark},${0.03 + rng() * 0.10})`;
      g.lineWidth = 0.5 + rng() * 2.4;
      g.beginPath();
      g.moveTo(0, y);
      for (let x = 0; x <= s; x += 14) {
        g.lineTo(x, y + Math.sin(x * 0.028 + i) * (1.2 + rng() * 3.2));
      }
      g.stroke();
    }
    const np = planks || 5;
    for (let k = 1; k < np; k++) {
      g.strokeStyle = 'rgba(26,16,10,0.42)';
      g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(0, (k * s) / np); g.lineTo(s, (k * s) / np); g.stroke();
      g.strokeStyle = 'rgba(255,240,215,0.06)';
      g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(0, (k * s) / np + 2.5); g.lineTo(s, (k * s) / np + 2.5); g.stroke();
    }
    // 藍のこぼれ跡・使いこみ
    for (let i = 0; i < 90; i++) {
      const x = rng() * s, y = rng() * s, r = 4 + rng() * 34;
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      const a = 0.03 + rng() * 0.10;
      grd.addColorStop(0, `rgba(16,26,52,${a})`);
      grd.addColorStop(1, 'rgba(16,26,52,0)');
      g.fillStyle = grd;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
  }, 1);
}

function plasterTexture(size, seed) {
  const rng = makeRng(seed);
  return canvasTex(size, (g, s) => {
    g.fillStyle = '#c8b89e'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 7000; i++) {
      const x = rng() * s, y = rng() * s;
      g.fillStyle = `rgba(${132 + rng() * 66 | 0},${118 + rng() * 58 | 0},${94 + rng() * 52 | 0},${rng() * 0.26})`;
      g.fillRect(x, y, 1 + rng() * 3, 1 + rng() * 3);
    }
    // こて跡
    for (let i = 0; i < 40; i++) {
      const x = rng() * s, y = rng() * s, r = 26 + rng() * 100;
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, `rgba(104,90,70,${0.05 + rng() * 0.10})`);
      grd.addColorStop(1, 'rgba(104,90,70,0)');
      g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    // 下のほうは湿って暗い
    const vg = g.createLinearGradient(0, s * 0.45, 0, s);
    vg.addColorStop(0, 'rgba(46,38,30,0)');
    vg.addColorStop(1, 'rgba(46,38,30,0.42)');
    g.fillStyle = vg; g.fillRect(0, 0, s, s);
  }, 1);
}

function glazeTexture(size, seed) {
  const rng = makeRng(seed);
  return canvasTex(size, (g, s) => {
    g.fillStyle = '#2a2724'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 200; i++) {
      const x = rng() * s, y = rng() * s, r = 10 + rng() * 90;
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      const c = rng() < 0.5 ? '58,52,46' : '20,22,30';
      grd.addColorStop(0, `rgba(${c},${0.12 + rng() * 0.2})`);
      grd.addColorStop(1, `rgba(${c},0)`);
      g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    // 釉薬のたれ
    for (let i = 0; i < 46; i++) {
      const x = rng() * s;
      g.strokeStyle = `rgba(96,92,84,${0.06 + rng() * 0.13})`;
      g.lineWidth = 2 + rng() * 8;
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (rng() - 0.5) * 16, s * (0.3 + rng() * 0.7)); g.stroke();
    }
  }, 1);
}

// ---------------------------------------------------------------------------
// 環境マップ（材質の映り込み用）
// ---------------------------------------------------------------------------

function buildEnvironment(renderer) {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = size * 2; c.height = size;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, size);
  grd.addColorStop(0.0, '#e8eef6');
  grd.addColorStop(0.40, '#b9c4d0');
  grd.addColorStop(0.51, '#8a7f6c');
  grd.addColorStop(1.0, '#3a322a');
  g.fillStyle = grd; g.fillRect(0, 0, size * 2, size);
  const wx = size * 0.40;
  const wg = g.createRadialGradient(wx, size * 0.34, 2, wx, size * 0.34, size * 0.40);
  wg.addColorStop(0, 'rgba(255,248,226,1)');
  wg.addColorStop(1, 'rgba(255,248,226,0)');
  g.fillStyle = wg; g.fillRect(0, 0, size * 2, size);

  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const env = pmrem.fromEquirectangular(tex).texture;
  pmrem.dispose();
  tex.dispose();
  return env;
}

// ---------------------------------------------------------------------------
// 藍甕の液面
// ---------------------------------------------------------------------------

const MAX_RIPPLES = 8;

function makeLiquid(radius) {
  const geo = new THREE.RingGeometry(0.0004, radius, 80, 16);
  geo.rotateX(-Math.PI / 2);

  const uniforms = {
    uTime: { value: 0 },
    uRipples: { value: Array.from({ length: MAX_RIPPLES }, () => new THREE.Vector4(0, 0, -99, 0)) },
    uAgitate: { value: 0 },
    uFoam: { value: 0.7 },
    uRadius: { value: radius }
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.DoubleSide,
    vertexShader: `
      uniform float uTime;
      uniform vec4 uRipples[${MAX_RIPPLES}];
      uniform float uAgitate;
      varying vec3 vPos;
      varying vec3 vN;
      varying float vDisturb;
      varying vec2 vLocal;

      float waveH(vec2 p, out vec2 grad){
        float h = 0.0;
        grad = vec2(0.0);
        float a1 = 0.0016 + 0.0090*uAgitate;
        h += sin(p.x*15.0 + uTime*1.3)*a1;
        grad.x += cos(p.x*15.0 + uTime*1.3)*15.0*a1;
        h += sin(p.y*12.0 - uTime*1.1)*a1*0.8;
        grad.y += cos(p.y*12.0 - uTime*1.1)*12.0*a1*0.8;
        h += sin((p.x+p.y)*22.0 + uTime*2.1)*a1*0.5;
        grad += vec2(cos((p.x+p.y)*22.0 + uTime*2.1)*22.0*a1*0.5);
        for(int i=0;i<${MAX_RIPPLES};i++){
          vec4 r = uRipples[i];
          float age = uTime - r.z;
          if(age < 0.0 || age > 2.8) continue;
          vec2 d = p - r.xy;
          float dist = length(d) + 1e-5;
          float front = age * 0.58;
          float w = exp(-pow((dist-front)*7.5, 2.0)) * r.w * exp(-age*1.15);
          float ph = (dist - front) * 34.0;
          h += sin(ph) * w * 0.030;
          grad += normalize(d) * cos(ph)*34.0 * w * 0.030;
        }
        return h;
      }

      void main(){
        vec3 p = position;
        vec2 g;
        float h = waveH(p.xz, g);
        p.y += h;
        vLocal = p.xz;
        vPos = (modelMatrix * vec4(p,1.0)).xyz;
        vN = normalize(vec3(-g.x, 1.0, -g.y));
        vDisturb = abs(h)*30.0;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform float uTime;
      uniform float uFoam;
      uniform float uAgitate;
      uniform float uRadius;
      varying vec3 vPos;
      varying vec3 vN;
      varying float vDisturb;
      varying vec2 vLocal;

      float h21(vec2 p){ p = fract(p*vec2(127.1,311.7)); p += dot(p,p+31.7); return fract(p.x*p.y); }
      float n2(vec2 p){
        vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y);
      }
      float fbm(vec2 p){ float s=0.0,a=0.5; for(int i=0;i<5;i++){ s+=a*n2(p); p*=2.07; a*=0.5;} return s; }

      void main(){
        vec3 N = normalize(vN);
        vec3 V = normalize(cameraPosition - vPos);
        float fres = pow(1.0 - clamp(dot(N,V),0.0,1.0), 4.0);

        float r = length(vLocal);

        // 藍液: ほとんど黒に近い濃紺。ふちだけ甕の影で さらに暗い。
        vec3 deep    = vec3(0.008, 0.019, 0.038);
        vec3 shallow = vec3(0.022, 0.055, 0.092);
        vec3 col = mix(shallow, deep, smoothstep(uRadius*0.15, uRadius, r));
        col *= mix(1.0, 0.45, smoothstep(uRadius*0.72, uRadius, r));

        // 藍の華（発酵の泡）— 紫がかった金属光沢の膜
        vec2 fp = vLocal * 11.0 + vec2(uTime*0.045, -uTime*0.035);
        float foam = fbm(fp);
        foam = smoothstep(0.54, 0.78, foam) * uFoam;
        foam *= 1.0 - smoothstep(uRadius*0.22, uRadius*0.92, r);
        foam *= 1.0 - clamp(uAgitate*1.5, 0.0, 0.92);
        vec3 foamCol = mix(vec3(0.22,0.16,0.30), vec3(0.62,0.56,0.68), fbm(fp*2.4));
        col = mix(col, foamCol, foam*0.9);

        // 空の映り込み（ごく弱く。液は暗いままにする）
        vec3 sky = mix(vec3(0.10,0.13,0.17), vec3(0.62,0.68,0.76), clamp(N.y*0.5+0.5,0.0,1.0));
        col += sky * fres * 0.16;

        // 窓のハイライト
        vec3 L = normalize(vec3(-0.60, 0.78, 0.28));
        vec3 H = normalize(L + V);
        float spec = pow(max(dot(N,H),0.0), 340.0);
        col += vec3(1.0,0.96,0.88) * spec * 2.2;

        // かき混ぜたときの白い筋
        col += vec3(0.26,0.34,0.40) * vDisturb * 0.13;

        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  return { mesh, uniforms, rippleIdx: 0 };
}

// ---------------------------------------------------------------------------

export function createWorkshop(renderer) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1d1f24);
  scene.fog = new THREE.Fog(0x8d8778, 3.2, 11.0);

  const env = buildEnvironment(renderer);
  scene.environment = env;

  const floorTex = woodTexture(512, '#946c46', '58,38,22', 7, 4);
  const woodDark = woodTexture(512, '#6b4a2e', '34,20,12', 13, 3);
  const plaster = plasterTexture(512, 21);
  const glaze = glazeTexture(512, 55);

  const matFloor = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.84, metalness: 0.0 });
  const matWall = new THREE.MeshStandardMaterial({ map: plaster, roughness: 0.96, metalness: 0.0 });
  const matTable = new THREE.MeshStandardMaterial({ map: woodDark, roughness: 0.64, metalness: 0.0 });
  const matBeam = new THREE.MeshStandardMaterial({ color: 0x3f2c1d, roughness: 0.82 });

  // ---- 遠景 -------------------------------------------------------------
  const far = new THREE.Group();
  plaster.repeat.set(3.2, 1.4);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(15, 6.5), matWall);
  wall.position.set(0, 2.6, -4.2);
  wall.receiveShadow = true;
  far.add(wall);

  const sideMat = matWall.clone();
  sideMat.map = plaster.clone();
  sideMat.map.repeat.set(2.4, 1.4);
  sideMat.map.needsUpdate = true;
  for (const sx of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.PlaneGeometry(9, 6.5), sideMat);
    side.position.set(sx * 4.3, 2.6, -0.6);
    side.rotation.y = sx > 0 ? -Math.PI / 2 : Math.PI / 2;
    far.add(side);
  }

  // 窓（工房のあかり）
  const win = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.5),
    new THREE.MeshBasicMaterial({ color: 0xfff8e6 }));
  win.position.set(-2.30, 2.45, -4.15);
  far.add(win);
  const frame = new THREE.Mesh(new THREE.PlaneGeometry(2.12, 1.72), matBeam);
  frame.position.set(-2.30, 2.45, -4.18);
  far.add(frame);
  for (let k = 0; k < 3; k++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.032, 1.52, 0.032), matBeam);
    bar.position.set(-2.30 - 0.62 + k * 0.62, 2.45, -4.12);
    far.add(bar);
  }
  for (let k = 0; k < 2; k++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.03, 0.03), matBeam);
    bar.position.set(-2.30, 2.45 - 0.5 + k * 1.0, -4.12);
    far.add(bar);
  }
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(4.6, 3.8),
    new THREE.MeshBasicMaterial({ color: 0xfff1cf, transparent: true, opacity: 0.13, depthWrite: false })
  );
  glow.position.set(-2.30, 2.4, -4.05);
  far.add(glow);

  // 梁
  for (let k = 0; k < 3; k++) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.18, 0.22), matBeam);
    beam.position.set(0, 3.35, -3.2 + k * 1.6);
    far.add(beam);
  }

  // 遠景に干してある藍の布（奥行きの手がかり）
  const farCloths = new THREE.Group();
  const rngC = makeRng(99);
  for (let k = 0; k < 9; k++) {
    const w = 0.36 + rngC() * 0.20, h = 1.5 + rngC() * 0.8;
    const g = new THREE.PlaneGeometry(w, h, 8, 14);
    const pos = g.attributes.position;
    const ph = rngC() * 6;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i), x = pos.getX(i);
      const t = (y + h / 2) / h;
      pos.setZ(i, Math.sin(y * 6.5 + ph) * 0.045 * (1 - t * 0.5) + Math.sin(x * 12 + ph) * 0.022);
      pos.setX(i, x * (1 + (1 - t) * 0.08));
    }
    g.computeVertexNormals();
    const shade = rngC();
    const m = new THREE.MeshStandardMaterial({
      color: new THREE.Color().setHSL(0.605 + rngC() * 0.02, 0.42 + shade * 0.28, lerp(0.09, 0.34, shade)),
      roughness: 0.92, side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(-3.1 + k * 0.78 + rngC() * 0.12, 2.42 - h / 2, -3.55 - rngC() * 0.45);
    mesh.rotation.y = (rngC() - 0.5) * 0.35;
    farCloths.add(mesh);
  }
  const farRod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 7.6, 8), matBeam);
  farRod.rotation.z = Math.PI / 2;
  farRod.position.set(0, 2.44, -3.7);
  farCloths.add(farRod);
  far.add(farCloths);
  scene.add(far);

  // ---- 床 ---------------------------------------------------------------
  floorTex.repeat.set(5, 4.5);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(15, 12), matFloor);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, -1.2);
  floor.receiveShadow = true;
  scene.add(floor);

  // ---- 中景: 藍甕 --------------------------------------------------------
  const vatGroup = new THREE.Group();
  vatGroup.position.set(VAT.x, 0, VAT.z);

  const R = VAT.radius, IR = VAT.innerR, RIM = VAT.rimY;
  // 外側を口までのぼり、返してから内側を底までおりる断面 → 中空の甕になる
  const pts = [
    [0.030, 0.000], [0.260, 0.000], [0.370, 0.045], [0.455, 0.140],
    [0.510, 0.270], [R, 0.400], [0.530, 0.505], [0.492, 0.592],
    [0.470, RIM - 0.030], [0.500, RIM - 0.008], [0.506, RIM],      // 口の返し
    [0.470, RIM], [0.455, RIM - 0.022],                            // 内側へ
    [IR, RIM - 0.080], [0.462, 0.470], [0.428, 0.230], [0.340, 0.075], [0.030, 0.045]
  ];
  const vatGeo = new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), 72);
  vatGeo.computeVertexNormals();
  const vatMat = new THREE.MeshStandardMaterial({
    map: glaze, color: 0x8f959b, roughness: 0.40, metalness: 0.08,
    side: THREE.DoubleSide, envMapIntensity: 1.3
  });
  const vatMesh = new THREE.Mesh(vatGeo, vatMat);
  vatMesh.castShadow = true;
  vatMesh.receiveShadow = true;
  vatGroup.add(vatMesh);

  // 甕のなかの闇
  const inner = new THREE.Mesh(
    new THREE.CylinderGeometry(IR * 0.998, IR * 0.55, RIM - 0.03, 48, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x04060b, side: THREE.BackSide })
  );
  inner.position.y = (RIM - 0.03) * 0.5 + 0.02;
  vatGroup.add(inner);
  const innerBottom = new THREE.Mesh(
    new THREE.CircleGeometry(IR * 0.58, 32),
    new THREE.MeshBasicMaterial({ color: 0x02040a })
  );
  innerBottom.rotation.x = -Math.PI / 2;
  innerBottom.position.y = 0.03;
  vatGroup.add(innerBottom);

  const liquid = makeLiquid(IR * 0.985);
  liquid.mesh.position.y = VAT.liquidY;
  vatGroup.add(liquid.mesh);

  // 甕を据える板と、こぼれた藍の跡
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(R * 1.32, R * 1.36, 0.05, 32),
    new THREE.MeshStandardMaterial({ map: woodDark, roughness: 0.8 })
  );
  base.position.y = 0.025;
  base.receiveShadow = true;
  vatGroup.add(base);
  const stain = new THREE.Mesh(
    new THREE.RingGeometry(R * 1.30, R * 2.0, 40),
    new THREE.MeshStandardMaterial({
      color: 0x141f38, roughness: 0.96, transparent: true, opacity: 0.55, depthWrite: false
    })
  );
  stain.rotation.x = -Math.PI / 2;
  stain.position.y = 0.005;
  vatGroup.add(stain);
  scene.add(vatGroup);

  // ---- 近景: 作業台 ------------------------------------------------------
  const tableGroup = new THREE.Group();
  tableGroup.position.set(TABLE.x, 0, TABLE.z);
  const top = new THREE.Mesh(new THREE.BoxGeometry(TABLE.w, 0.065, TABLE.d), matTable);
  top.position.y = TABLE.y - 0.0325;
  top.castShadow = true; top.receiveShadow = true;
  tableGroup.add(top);
  const lip = new THREE.Mesh(new THREE.BoxGeometry(TABLE.w + 0.05, 0.022, TABLE.d + 0.05), matBeam);
  lip.position.y = TABLE.y - 0.076;
  lip.receiveShadow = true;
  tableGroup.add(lip);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, TABLE.y - 0.076, 0.08), matBeam);
    leg.position.set(sx * (TABLE.w / 2 - 0.11), (TABLE.y - 0.076) / 2, sz * (TABLE.d / 2 - 0.11));
    leg.castShadow = true;
    tableGroup.add(leg);
  }
  scene.add(tableGroup);

  // ---- すすぎ桶 ----------------------------------------------------------
  const basinGroup = new THREE.Group();
  basinGroup.position.set(BASIN.x, 0, BASIN.z);
  const tubProfile = [
    [0.03, 0], [BASIN.r * 0.82, 0], [BASIN.r, BASIN.y], [BASIN.r * 0.955, BASIN.y],
    [BASIN.r * 0.79, 0.035], [0.03, 0.035]
  ].map(p => new THREE.Vector2(p[0], p[1]));
  const tub = new THREE.Mesh(new THREE.LatheGeometry(tubProfile, 44),
    new THREE.MeshStandardMaterial({ map: woodDark, roughness: 0.78, side: THREE.DoubleSide }));
  tub.castShadow = true; tub.receiveShadow = true;
  basinGroup.add(tub);
  for (let k = 0; k < 2; k++) {
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(BASIN.r * (0.88 + k * 0.10), 0.012, 6, 40),
      new THREE.MeshStandardMaterial({ color: 0x776b58, roughness: 0.45, metalness: 0.6 }));
    hoop.rotation.x = Math.PI / 2;
    hoop.position.y = 0.07 + k * 0.15;
    basinGroup.add(hoop);
  }
  const basinWater = new THREE.Mesh(
    new THREE.CircleGeometry(BASIN.r * 0.9, 44),
    new THREE.MeshPhysicalMaterial({
      color: 0xc9dde6, roughness: 0.05, metalness: 0.0,
      transparent: true, opacity: 0.72, envMapIntensity: 1.8
    })
  );
  basinWater.rotation.x = -Math.PI / 2;
  basinWater.position.y = BASIN.y - 0.055;
  basinGroup.add(basinWater);
  scene.add(basinGroup);

  // ---- 物干し ------------------------------------------------------------
  const lineGroup = new THREE.Group();
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, LINE.halfW * 2 + 0.4, 10), matBeam);
  rod.rotation.z = Math.PI / 2;
  rod.position.set(0, LINE.y, LINE.z);
  rod.castShadow = true;
  lineGroup.add(rod);
  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.065, LINE.y, 8), matBeam);
    post.position.set(sx * LINE.halfW, LINE.y / 2, LINE.z);
    post.castShadow = true;
    lineGroup.add(post);
    const brace = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.34), matBeam);
    brace.position.set(sx * LINE.halfW, LINE.y - 0.16, LINE.z + 0.14);
    brace.rotation.x = 0.5;
    lineGroup.add(brace);
  }
  scene.add(lineGroup);

  // ---- 小道具 ------------------------------------------------------------
  const props = new THREE.Group();
  const spool = new THREE.Group();
  const spoolCore = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.09, 20),
    new THREE.MeshStandardMaterial({ color: 0xe9e3d4, roughness: 0.9 }));
  spoolCore.rotation.z = Math.PI / 2;
  spool.add(spoolCore);
  for (const sx of [-1, 1]) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.056, 0.012, 20), matBeam);
    cap.rotation.z = Math.PI / 2;
    cap.position.x = sx * 0.050;
    spool.add(cap);
  }
  spool.position.set(TABLE.x + 0.58, TABLE.y + 0.056, TABLE.z + 0.28);
  spool.rotation.y = 0.4;
  spool.traverse(o => { o.castShadow = true; });
  props.add(spool);

  const boardStack = new THREE.Group();
  for (let k = 0; k < 3; k++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.016, 0.19), matBeam);
    b.position.set(0, 0.009 + k * 0.019, 0);
    b.rotation.y = k * 0.14;
    b.castShadow = true; b.receiveShadow = true;
    boardStack.add(b);
  }
  boardStack.position.set(TABLE.x - 0.58, TABLE.y, TABLE.z + 0.28);
  props.add(boardStack);

  // 甕のわきの手桶と踏み台（スケールの手がかり）
  const bucket = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.115, 0.20, 20, 1, true),
    new THREE.MeshStandardMaterial({ map: woodDark, roughness: 0.8, side: THREE.DoubleSide })
  );
  bucket.position.set(VAT.x + 0.78, 0.10, VAT.z + 0.30);
  bucket.castShadow = true;
  props.add(bucket);
  const bucketIn = new THREE.Mesh(new THREE.CircleGeometry(0.12, 20),
    new THREE.MeshStandardMaterial({ color: 0x0d1a2e, roughness: 0.2 }));
  bucketIn.rotation.x = -Math.PI / 2;
  bucketIn.position.set(VAT.x + 0.78, 0.16, VAT.z + 0.30);
  props.add(bucketIn);

  const stool = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.04, 0.24), matBeam);
  seat.position.y = 0.26; seat.castShadow = true;
  stool.add(seat);
  for (const sx of [-1, 1]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.26, 0.20), matBeam);
    l.position.set(sx * 0.12, 0.13, 0);
    stool.add(l);
  }
  stool.position.set(VAT.x - 0.95, 0, VAT.z + 0.15);
  stool.rotation.y = 0.5;
  props.add(stool);
  scene.add(props);

  // ---- 照明 -------------------------------------------------------------
  const hemi = new THREE.HemisphereLight(0xcfe0f2, 0x3a2b1e, 0.42);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff0d2, 2.05);
  sun.position.set(-3.4, 4.1, 1.6);
  sun.target.position.set(0, 0.35, 0.0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1536, 1536);
  sun.shadow.camera.left = -2.4;
  sun.shadow.camera.right = 2.4;
  sun.shadow.camera.top = 2.6;
  sun.shadow.camera.bottom = -1.4;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 11;
  sun.shadow.bias = -0.0007;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);
  scene.add(sun.target);

  // 布を背景から切りはなすリムライト
  const rim = new THREE.DirectionalLight(0xa9c8ff, 0.7);
  rim.position.set(2.6, 2.2, -2.6);
  scene.add(rim);

  const fill = new THREE.PointLight(0xffd9a8, 3.6, 4.2, 2.0);
  fill.position.set(1.2, 1.35, 1.1);
  scene.add(fill);

  const vatLight = new THREE.PointLight(0x6ba0e0, 3.0, 2.6, 2.0);
  vatLight.position.set(VAT.x, VAT.rimY + 0.30, VAT.z);
  scene.add(vatLight);

  return {
    scene, env,
    liquid, vatGroup, vatMesh, basinWater, basinGroup,
    tableGroup, lineGroup, props, spool, boardStack, farCloths,
    sun, fill, vatLight, hemi, rim,
    addRipple(x, z, amp) {
      const arr = liquid.uniforms.uRipples.value;
      const i = liquid.rippleIdx % MAX_RIPPLES;
      liquid.rippleIdx++;
      arr[i].set(x, z, liquid.uniforms.uTime.value, amp);
    },
    update(dt, t) {
      liquid.uniforms.uTime.value = t;
    }
  };
}
