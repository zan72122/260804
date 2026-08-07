// ============================================================================
// 布 — 実ジオメトリ（表・裏・小口の 3 面をもつ厚みのある布）
//   * 折り姿勢は folds.js の pose() が決める
//   * しわは法線方向への実変位
//   * 糸の食い込み・板の締めつけも実際にジオメトリを凹ませる
//   * 色（黄緑 → 緑 → 青緑 → 藍）はフラグメントで連続的に計算
//   * 乾燥ステージだけ Verlet 布シミュレーションに切り替わる
// ============================================================================

import * as THREE from '../vendor/three.module.js';
import { CLOTH_SIZE, CLOTH_THICK } from './folds.js';
import { clamp01, lerp, smoothstep, fbm2, valueNoise2 } from './util.js';

const S = CLOTH_SIZE;

// ---------------------------------------------------------------------------

export class Cloth {
  constructor(seg) {
    this.seg = seg;
    const n = seg + 1;
    this.n = n;
    this.V = n * n;

    const V = this.V;
    const positions = new Float32Array(V * 2 * 3);
    const normals = new Float32Array(V * 2 * 3);
    const uvs = new Float32Array(V * 2 * 2);

    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const p = j * n + i;
        const u = i / seg, v = j / seg;
        uvs[p * 2] = u; uvs[p * 2 + 1] = v;
        uvs[(V + p) * 2] = u; uvs[(V + p) * 2 + 1] = v;
      }
    }

    const idx = [];
    // 表
    for (let j = 0; j < seg; j++) {
      for (let i = 0; i < seg; i++) {
        const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    // 裏（巻き方向を反転）
    for (let j = 0; j < seg; j++) {
      for (let i = 0; i < seg; i++) {
        const a = V + j * n + i, b = a + 1, c = a + n, d = c + 1;
        idx.push(a, b, c, b, d, c);
      }
    }
    // 小口（4 辺）
    const rim = (p0, p1) => { idx.push(p0, p1, V + p0, p1, V + p1, V + p0); };
    for (let i = 0; i < seg; i++) rim(i + 1, i);                                   // v=0
    for (let i = 0; i < seg; i++) rim((seg) * n + i, (seg) * n + i + 1);           // v=1
    for (let j = 0; j < seg; j++) rim(j * n, (j + 1) * n);                         // u=0
    for (let j = 0; j < seg; j++) rim((j + 1) * n + seg, j * n + seg);             // u=1

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(idx);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.2, 0), 1.6);
    this.geometry = geo;
    this.pos = positions;
    this.nrm = normals;

    // 布ごとの作業配列
    this.vertA = new Float32Array(V);
    this.vertB = new Float32Array(V);
    this.vertBurial = new Float32Array(V);
    this.wrinkle = new Float32Array(V);
    this.basePos = new Float32Array(V * 3);

    this.material = makeClothMaterial();
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;

    this.group = new THREE.Group();
    this.group.add(this.mesh);

    // 状態
    this.fold = null;
    this.foldT = 0;
    this.ties = [];
    this.boards = [];
    this.wrinkleAmp = 0.006;
    this.wrinkleSeed = 0;
    this.wetness = 0;
    this.time = 0;
    this.sway = 0;
    this.swayPhase = 0;

    this.physics = null;   // 乾燥ステージで使う Verlet
    this._po = { x: 0, y: 0, z: 0, burial: 0, layer: 0 };
    this._fp = { a: 0, b: 0, burial: 0 };

    this.buildWrinkleField(1);
  }

  // -- しわの場（布ごとに違う個性） ----------------------------------------
  buildWrinkleField(seed) {
    this.wrinkleSeed = seed;
    const n = this.n, seg = this.seg;
    const off = (seed % 97) * 13.37;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const u = i / seg, v = j / seg;
        const w =
          (fbm2(u * 3.1 + off, v * 3.1 + off, 3) - 0.5) * 1.0 +
          (fbm2(u * 8.7 + off * 2, v * 8.7 + off * 2, 2) - 0.5) * 0.45 +
          (fbm2(u * 19.0 + off * 3, v * 19.0 + off * 3, 2) - 0.5) * 0.18;
        // ふちは自然に垂れる
        const edge = Math.min(u, 1 - u, v, 1 - v);
        this.wrinkle[j * n + i] = w * (0.55 + 0.45 * smoothstep(0.0, 0.22, edge));
      }
    }
  }

  setFold(fold) {
    this.fold = fold;
    const n = this.n, seg = this.seg;
    const fp = this._fp;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const p = j * n + i;
        fold.footprint(i / seg, j / seg, fp);
        this.vertA[p] = fp.a;
        this.vertB[p] = fp.b;
        this.vertBurial[p] = fp.burial;
      }
    }
  }

  setBinding(ties, boards) {
    this.ties = ties;
    this.boards = boards;
  }

  // -- 毎フレームのジオメトリ更新 ------------------------------------------
  update(dt) {
    this.time += dt;
    if (this.physics) {
      this.updatePhysics(dt);
      return;
    }
    const n = this.n, seg = this.seg, V = this.V;
    const pos = this.pos, nrm = this.nrm, po = this._po;
    const fold = this.fold;
    const T = this.foldT;

    // --- pass A: 折り姿勢
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const p = j * n + i;
        fold.pose(i / seg, j / seg, T, po);
        pos[p * 3] = po.x;
        pos[p * 3 + 1] = po.y;
        pos[p * 3 + 2] = po.z;
      }
    }

    // --- 糸の食い込み / 板の締めつけ（束のときだけ）
    if (T > 0.55) {
      const bite = smoothstep(0.55, 0.95, T);
      this.applyTieSqueeze(bite);
      this.applyBoardClamp(bite);
    }

    // --- pass B: 法線
    this.computeNormals();

    // --- pass C: しわを法線方向へ実変位
    const amp = this.wrinkleAmp * lerp(1.0, 0.55, this.wetness);
    if (amp > 1e-5) {
      const t = this.time;
      for (let p = 0; p < V; p++) {
        const w = this.wrinkle[p] * amp;
        pos[p * 3] += nrm[p * 3] * w;
        pos[p * 3 + 1] += nrm[p * 3 + 1] * w;
        pos[p * 3 + 2] += nrm[p * 3 + 2] * w;
      }
      // ゆらぎ（風・液中）
      if (this.sway > 0.001) {
        const sw = this.sway;
        for (let j = 0; j < n; j++) {
          const v = j / seg;
          for (let i = 0; i < n; i++) {
            const p = j * n + i;
            const u = i / seg;
            const d = Math.sin(t * 2.3 + u * 5.0 + v * 3.0 + this.swayPhase) * 0.5 +
              Math.sin(t * 3.7 - v * 6.0 + this.swayPhase * 1.3) * 0.3;
            pos[p * 3] += d * sw * 0.02;
            pos[p * 3 + 1] += Math.sin(t * 3.1 + u * 7.0) * sw * 0.008;
          }
        }
      }
      this.computeNormals();
    }

    // --- pass D: 裏面と小口
    this.buildBackShell();

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.normal.needsUpdate = true;
  }

  applyTieSqueeze(bite) {
    const ties = this.ties;
    if (!ties || ties.length === 0) return;
    const n = this.n, pos = this.pos, fold = this.fold;
    for (let k = 0; k < ties.length; k++) {
      const t = ties[k];
      if (t.removed) continue;
      const ring = fold.ringAt(t.a);
      const cx = ring.cx, cy = ring.cy, cz = ring.cz;
      const ax = ring.axis.x, ay = ring.axis.y, az = ring.axis.z;
      const w = t.width * 1.5;
      const k0 = 0.55 * t.tighten * bite;
      if (k0 <= 0.001) continue;
      for (let p = 0; p < this.V; p++) {
        const d = Math.abs(this.vertA[p] - t.a);
        if (d > w) continue;
        const f = smoothstep(w, w * 0.2, d) * k0;
        const px = pos[p * 3], py = pos[p * 3 + 1], pz = pos[p * 3 + 2];
        const rx = px - cx, ry = py - cy, rz = pz - cz;
        const proj = rx * ax + ry * ay + rz * az;
        const ox = rx - ax * proj, oy = ry - ay * proj, oz = rz - az * proj;
        pos[p * 3] = px - ox * f;
        pos[p * 3 + 1] = py - oy * f;
        pos[p * 3 + 2] = pz - oz * f;
      }
    }
  }

  applyBoardClamp(bite) {
    const boards = this.boards;
    if (!boards || boards.length === 0) return;
    const pos = this.pos;
    for (let k = 0; k < boards.length; k++) {
      const bd = boards[k];
      if (bd.removed || bd.clamp <= 0.01) continue;
      const kk = 0.5 * bd.clamp * bite;
      const r2 = (bd.size * 1.25) * (bd.size * 1.25);
      for (let p = 0; p < this.V; p++) {
        const da = this.vertA[p] - bd.a, db = this.vertB[p] - bd.b;
        if (da * da + db * db > r2) continue;
        const f = smoothstep(bd.size * 1.25, bd.size * 0.5, Math.sqrt(da * da + db * db)) * kk;
        pos[p * 3 + 1] *= (1 - f * 0.75);
      }
    }
  }

  computeNormals() {
    const n = this.n, pos = this.pos, nrm = this.nrm;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const p = j * n + i;
        const iL = i > 0 ? p - 1 : p, iR = i < n - 1 ? p + 1 : p;
        const jD = j > 0 ? p - n : p, jU = j < n - 1 ? p + n : p;
        const ax = pos[iR * 3] - pos[iL * 3];
        const ay = pos[iR * 3 + 1] - pos[iL * 3 + 1];
        const az = pos[iR * 3 + 2] - pos[iL * 3 + 2];
        const bx = pos[jU * 3] - pos[jD * 3];
        const by = pos[jU * 3 + 1] - pos[jD * 3 + 1];
        const bz = pos[jU * 3 + 2] - pos[jD * 3 + 2];
        // b × a （三角形の巻き方向と合わせる。逆にすると法線が裏返って布が真っ暗になる）
        let cx = by * az - bz * ay;
        let cy = bz * ax - bx * az;
        let cz = bx * ay - by * ax;
        const l = Math.sqrt(cx * cx + cy * cy + cz * cz) || 1;
        cx /= l; cy /= l; cz /= l;
        nrm[p * 3] = cx; nrm[p * 3 + 1] = cy; nrm[p * 3 + 2] = cz;
      }
    }
  }

  buildBackShell() {
    const V = this.V, pos = this.pos, nrm = this.nrm, t = CLOTH_THICK;
    for (let p = 0; p < V; p++) {
      const q = V + p;
      pos[q * 3] = pos[p * 3] - nrm[p * 3] * t;
      pos[q * 3 + 1] = pos[p * 3 + 1] - nrm[p * 3 + 1] * t;
      pos[q * 3 + 2] = pos[p * 3 + 2] - nrm[p * 3 + 2] * t;
      nrm[q * 3] = -nrm[p * 3];
      nrm[q * 3 + 1] = -nrm[p * 3 + 1];
      nrm[q * 3 + 2] = -nrm[p * 3 + 2];
    }
  }

  // -- 乾燥ステージ: Verlet 布 ---------------------------------------------
  startPhysics(lineY, lineZ, pinCount) {
    const n = this.n, seg = this.seg, V = this.V;
    const prev = new Float32Array(V * 3);
    const cur = new Float32Array(V * 3);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const p = j * n + i;
        const u = i / seg, v = j / seg;
        const x = (u - 0.5) * S;
        const y = lineY - (1 - v) * S;
        const z = lineZ + (valueNoise2(u * 5, v * 5) - 0.5) * 0.02;
        cur[p * 3] = x; cur[p * 3 + 1] = y; cur[p * 3 + 2] = z;
        prev[p * 3] = x; prev[p * 3 + 1] = y; prev[p * 3 + 2] = z;
      }
    }
    // 洗濯ばさみは幅をもって布をつまむので、1 か所につき数点を留める
    const pins = [];
    const topRow = (n - 1) * n;
    const count = pinCount || 5;
    const grip = Math.max(1, Math.round(n * 0.045));
    for (let k = 0; k < count; k++) {
      const i0 = Math.round((k / (count - 1)) * (n - 1));
      for (let d = -grip; d <= grip; d++) {
        const i = i0 + d;
        if (i >= 0 && i < n && pins.indexOf(topRow + i) < 0) pins.push(topRow + i);
      }
    }
    this.clipIndices = [];
    for (let k = 0; k < count; k++) {
      this.clipIndices.push(topRow + Math.round((k / (count - 1)) * (n - 1)));
    }
    this.physics = {
      cur, prev, pins,
      rest: S / seg,
      wind: 0, windPhase: 0, t: 0
    };
    this.pinPositions = pins.map(p => [cur[p * 3], cur[p * 3 + 1], cur[p * 3 + 2]]);
    this.clipPositions = this.clipIndices.map(p => [cur[p * 3], cur[p * 3 + 1], cur[p * 3 + 2]]);
  }

  stopPhysics() { this.physics = null; }

  updatePhysics(dt) {
    const ph = this.physics;
    const n = this.n, V = this.V;
    const cur = ph.cur, prev = ph.prev;
    const h = Math.min(dt, 1 / 40);
    ph.t += h;

    const g = -5.6;                 // m/s^2
    const windAmp = ph.wind;
    const damping = 0.985;

    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const p = j * n + i;
        const px = cur[p * 3], py = cur[p * 3 + 1], pz = cur[p * 3 + 2];
        let vx = (px - prev[p * 3]) * damping;
        let vy = (py - prev[p * 3 + 1]) * damping;
        let vz = (pz - prev[p * 3 + 2]) * damping;
        // 風は重力とおなじ「加速度」の単位で入れる（強すぎると布が飛んでいく）
        const wob = Math.sin(ph.t * 1.7 + j * 0.28) * 0.6 + Math.sin(ph.t * 3.3 - i * 0.21) * 0.4;
        const fz = (0.9 + 0.55 * wob) * windAmp * 5.5;
        const fx = wob * windAmp * 2.2;
        prev[p * 3] = px; prev[p * 3 + 1] = py; prev[p * 3 + 2] = pz;
        cur[p * 3] = px + vx + fx * h * h;
        cur[p * 3 + 1] = py + vy + g * h * h;
        cur[p * 3 + 2] = pz + vz + fz * h * h;
      }
    }

    const rest = ph.rest;
    const restD = rest * Math.SQRT2;
    for (let it = 0; it < 6; it++) {
      // 構造拘束
      for (let j = 0; j < n; j++) {
        for (let i = 0; i < n - 1; i++) {
          satisfy(cur, j * n + i, j * n + i + 1, rest);
        }
      }
      for (let j = 0; j < n - 1; j++) {
        for (let i = 0; i < n; i++) {
          satisfy(cur, j * n + i, (j + 1) * n + i, rest);
        }
      }
      // せん断拘束。毎回かけないと布が縦に伸びて横につぶれる。
      for (let j = 0; j < n - 1; j++) {
        for (let i = 0; i < n - 1; i++) {
          satisfy(cur, j * n + i, (j + 1) * n + i + 1, restD);
          satisfy(cur, j * n + i + 1, (j + 1) * n + i, restD);
        }
      }
      // ピン留め
      for (let k = 0; k < ph.pins.length; k++) {
        const p = ph.pins[k], q = this.pinPositions[k];
        cur[p * 3] = q[0]; cur[p * 3 + 1] = q[1]; cur[p * 3 + 2] = q[2];
      }
    }

    const pos = this.pos;
    for (let p = 0; p < V; p++) {
      pos[p * 3] = cur[p * 3];
      pos[p * 3 + 1] = cur[p * 3 + 1];
      pos[p * 3 + 2] = cur[p * 3 + 2];
    }
    this.computeNormals();
    const amp = this.wrinkleAmp * 0.6;
    for (let p = 0; p < V; p++) {
      const w = this.wrinkle[p] * amp;
      pos[p * 3] += this.nrm[p * 3] * w;
      pos[p * 3 + 1] += this.nrm[p * 3 + 1] * w;
      pos[p * 3 + 2] += this.nrm[p * 3 + 2] * w;
    }
    this.computeNormals();
    this.buildBackShell();
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.normal.needsUpdate = true;
  }

  // 布の一番低い点（しずくを落とす場所さがし）
  lowestPoints(count, out) {
    const n = this.n, pos = this.pos;
    out.length = 0;
    const m = this.group.matrixWorld;
    const step = Math.max(1, Math.floor(this.V / 220));
    let best = [];
    for (let p = 0; p < this.V; p += step) {
      best.push([pos[p * 3 + 1], p]);
    }
    best.sort((a, b) => a[0] - b[0]);
    for (let k = 0; k < Math.min(count, best.length); k++) {
      const p = best[k][1];
      const v = new THREE.Vector3(pos[p * 3], pos[p * 3 + 1], pos[p * 3 + 2]);
      v.applyMatrix4(m);
      out.push(v);
    }
    return out;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}

function satisfy(pos, a, b, rest) {
  const ax = a * 3, bx = b * 3;
  const dx = pos[bx] - pos[ax];
  const dy = pos[bx + 1] - pos[ax + 1];
  const dz = pos[bx + 2] - pos[ax + 2];
  const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (d < 1e-8) return;
  const diff = (d - rest) / d * 0.5;
  const ox = dx * diff, oy = dy * diff, oz = dz * diff;
  pos[ax] += ox; pos[ax + 1] += oy; pos[ax + 2] += oz;
  pos[bx] -= ox; pos[bx + 1] -= oy; pos[bx + 2] -= oz;
}

// ---------------------------------------------------------------------------
// 布のマテリアル — 藍の色づきと酸化をフラグメントで連続的に作る
// ---------------------------------------------------------------------------

export function makeClothMaterial() {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.86,
    metalness: 0.0,
    side: THREE.FrontSide
  });

  mat.userData.uniforms = {
    uResist: { value: null },
    uDye: { value: 0 },
    uDips: { value: 0 },
    uOx: { value: 0 },
    uWet: { value: 0 },
    uRinse: { value: 0 },
    uTime: { value: 0 },
    uLiquidY: { value: -10 },
    uInVat: { value: 0 }
  };

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, mat.userData.uniforms);

    shader.vertexShader = `
      varying vec2 vShUv;
      varying float vShWY;
    ` + shader.vertexShader;

    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       vShUv = uv;
       vShWY = (modelMatrix * vec4(transformed, 1.0)).y;`
    );

    shader.fragmentShader = `
      varying vec2 vShUv;
      varying float vShWY;
      uniform sampler2D uResist;
      uniform float uDye, uDips, uOx, uWet, uRinse, uTime, uLiquidY, uInVat;

      float shHash(vec2 p){
        p = fract(p * vec2(123.34, 345.45));
        p += dot(p, p + 34.345);
        return fract(p.x * p.y);
      }
      float shNoise(vec2 p){
        vec2 i = floor(p), f = fract(p);
        f = f*f*(3.0-2.0*f);
        float a = shHash(i), b = shHash(i+vec2(1.0,0.0));
        float c = shHash(i+vec2(0.0,1.0)), d = shHash(i+vec2(1.0,1.0));
        return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
      }
      float shFbm(vec2 p){
        float s = 0.0, a = 0.5;
        for(int i=0;i<4;i++){ s += a*shNoise(p); p *= 2.03; a *= 0.5; }
        return s;
      }

      // 藍の色相環: 黄緑 → 緑 → 青緑 → 藍青 → 深い藍
      vec3 indigoRamp(float t){
        vec3 c0 = vec3(0.620, 0.660, 0.140);   // きみどり
        vec3 c1 = vec3(0.240, 0.520, 0.170);   // みどり
        vec3 c2 = vec3(0.040, 0.250, 0.230);   // あおみどり
        vec3 c3 = vec3(0.014, 0.070, 0.165);   // あお
        vec3 c4 = vec3(0.0055, 0.0225, 0.075);  // ふかい あい
        t = clamp(t, 0.0, 1.0) * 4.0;
        if(t < 1.0) return mix(c0, c1, smoothstep(0.0,1.0,t));
        if(t < 2.0) return mix(c1, c2, smoothstep(0.0,1.0,t-1.0));
        if(t < 3.0) return mix(c2, c3, smoothstep(0.0,1.0,t-2.0));
        return mix(c3, c4, smoothstep(0.0,1.0,t-3.0));
      }
    ` + shader.fragmentShader;

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `
      vec4 rs = texture2D(uResist, vShUv);
      float resist = rs.r;
      float burial = rs.g;
      float mura   = rs.b;

      // ---- 染まった量 -----------------------------------------------------
      float dye = uDye * (1.0 - resist);
      dye *= mix(1.0, 0.965, burial);
      dye *= mix(0.945, 1.02, mura);
      dye = clamp(dye, 0.0, 1.0);

      // ---- 酸化: 空気に触れたところからまだらに青くなる ---------------------
      float airN = shFbm(vShUv * 5.0 + 11.0);
      float edgeAir = 1.0 - smoothstep(0.0, 0.30, min(min(vShUv.x, 1.0-vShUv.x), min(vShUv.y, 1.0-vShUv.y)));
      float oxLocal = clamp((uOx * (1.26 + 0.22*edgeAir) - 0.22 * airN - 0.02), 0.0, 1.0);

      // ---- 色 -------------------------------------------------------------
      vec3 clothWhite = vec3(0.930, 0.922, 0.888);
      clothWhite *= 1.0 - 0.045 * shFbm(vShUv * 22.0);
      vec3 dyed = indigoRamp(oxLocal);
      // 重ね染めで深くなる
      dyed *= mix(1.0, 0.58, clamp((uDips - 1.0) / 2.0, 0.0, 1.0));
      // 薄いところは彩度が残る
      float k = pow(dye, 0.36);
      vec3 col = mix(clothWhite, dyed, k);

      // 糸ぎわのにじみ（防染の縁がわずかに濃くなる）
      float edgeR = abs(resist - 0.5);
      col *= 1.0 - 0.13 * uDye * smoothstep(0.42, 0.06, edgeR) * (1.0 - uRinse * 0.6);

      // ぬれているあいだは濃く見える
      col *= mix(1.0, 0.74, uWet * (1.0 - 0.35 * uRinse));

      // 甕のなかでは液の色に沈む
      float sub = clamp((uLiquidY - vShWY) * 3.0, 0.0, 1.0) * uInVat;
      col = mix(col, vec3(0.035, 0.085, 0.150), sub * 0.82);

      diffuseColor.rgb *= col;
      `
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      `
      float roughnessFactor = roughness;
      roughnessFactor = mix(roughnessFactor, 0.30, uWet);
      roughnessFactor -= 0.06 * shNoise(vShUv * 60.0);
      roughnessFactor = clamp(roughnessFactor, 0.06, 1.0);
      `
    );

    // 織り目（細かい normal のゆらぎ）
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_begin>',
      `#include <normal_fragment_begin>
      {
        float fw = length(fwidth(vShUv));
        float fade = 1.0 - smoothstep(0.0015, 0.010, fw);
        if(fade > 0.01){
          float wu = sin(vShUv.x * 1420.0);
          float wv = sin(vShUv.y * 1420.0);
          vec3 t1 = normalize(cross(normal, vec3(0.0,1.0,0.0)) + vec3(1e-4));
          vec3 t2 = normalize(cross(normal, t1));
          normal = normalize(normal + (t1 * wu + t2 * wv) * 0.055 * fade);
        }
      }`
    );

    mat.userData.shader = shader;
  };

  mat.customProgramCacheKey = () => 'aizome-cloth-v1';
  return mat;
}
