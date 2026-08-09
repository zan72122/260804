import * as THREE from 'three';

// ---------------------------------------------------------------------------
// deterministic value noise
// ---------------------------------------------------------------------------

function hash3(i, j, k, seed) {
  let n = (i * 374761393 + j * 668265263 + k * 1442695041 + seed * 2654435761) | 0;
  n = (n ^ (n >> 13)) | 0;
  n = Math.imul(n, 1274126177) | 0;
  n = (n ^ (n >> 16)) | 0;
  return ((n >>> 0) % 100000) / 100000;
}

// quintic fade: a cubic one leaves visible creases along the noise cell walls
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);

export function noise3(x, y, z, seed = 0) {
  const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z);
  const fx = fade(x - i), fy = fade(y - j), fz = fade(z - k);
  let r = 0;
  for (let dz = 0; dz < 2; dz++) {
    const wz = dz ? fz : 1 - fz;
    for (let dy = 0; dy < 2; dy++) {
      const wy = dy ? fy : 1 - fy;
      for (let dx = 0; dx < 2; dx++) {
        const wx = dx ? fx : 1 - fx;
        r += hash3(i + dx, j + dy, k + dz, seed) * wx * wy * wz;
      }
    }
  }
  return r; // 0..1
}

const fbm = (x, y, z, seed) =>
  noise3(x, y, z, seed) * 0.62 + noise3(x * 2.3, y * 2.3, z * 2.3, seed + 17) * 0.26 +
  noise3(x * 4.9, y * 4.9, z * 4.9, seed + 41) * 0.12;

// small seeded PRNG so a rebuilt tower looks the same shape family every time
export function rng(seed) {
  let s = (seed | 0) || 1;
  return () => {
    s ^= s << 13; s |= 0;
    s ^= s >>> 17;
    s ^= s << 5; s |= 0;
    return ((s >>> 0) % 1000000) / 1000000;
  };
}

// ---------------------------------------------------------------------------
// choux pastry blob
//
// A hand-rolled welded sphere grid (three's SphereGeometry duplicates its seam
// column, which would leave a visible normal crease once we displace it).
// Returns the geometry plus the raw grid so the caramel shell can reuse it.
// ---------------------------------------------------------------------------

const SEG_U = 30;   // around
const SEG_V = 20;   // pole to pole

function chouxDisplace(nx, ny, nz, seed) {
  // broad lobes: real choux puff up unevenly
  const lobes =
    0.034 * Math.sin(3.0 * Math.atan2(nz, nx) + seed * 1.7) * (0.5 + 0.5 * ny) +
    0.020 * Math.cos(2.0 * Math.atan2(nz, nx) - seed * 0.9);
  // baked crust wrinkles
  const wrinkle = (fbm(nx * 2.05 + seed, ny * 2.05, nz * 2.05, seed * 7) - 0.5) * 0.20;
  const fine = (noise3(nx * 7.5, ny * 7.5, nz * 7.5, seed * 3 + 5) - 0.5) * 0.035;
  // little piped nub on the crown
  const up = Math.max(0, ny);
  const nub = 0.075 * Math.pow(up, 5.0);
  return 1.0 + lobes + wrinkle + fine + nub;
}

export function makeChouxGeometry(seed) {
  const grid = [];           // grid[i][j] -> Vector3, i in 0..SEG_U-1 (wrapped), j in 0..SEG_V
  const pale = new THREE.Color('#f7e6c1');   // underside, barely baked
  const mid = new THREE.Color('#d69a4d');    // the usual golden
  const deep = new THREE.Color('#8f4a13');   // where the oven caught it

  for (let i = 0; i < SEG_U; i++) {
    const u = (i / SEG_U) * Math.PI * 2;
    const col = [];
    for (let j = 0; j <= SEG_V; j++) {
      const v = (j / SEG_V) * Math.PI;      // 0 = top pole
      const sv = Math.sin(v), cv = Math.cos(v);
      const nx = sv * Math.cos(u), ny = cv, nz = sv * Math.sin(u);
      const d = chouxDisplace(nx, ny, nz, seed);
      let x = nx * d * 1.03, y = ny * d * 0.96, z = nz * d * 1.03;
      // soft flat-ish bottom so it can rest and be dipped
      if (y < -0.52) y = -0.52 + (y + 0.52) * 0.46;
      col.push(new THREE.Vector3(x, y, z));
    }
    grid.push(col);
  }

  // Poles are single shared vertices — average the ring so they stay welded.
  const topP = new THREE.Vector3(), botP = new THREE.Vector3();
  for (let i = 0; i < SEG_U; i++) { topP.add(grid[i][0]); botP.add(grid[i][SEG_V]); }
  topP.multiplyScalar(1 / SEG_U); botP.multiplyScalar(1 / SEG_U);
  for (let i = 0; i < SEG_U; i++) { grid[i][0].copy(topP); grid[i][SEG_V].copy(botP); }

  const pos = [], col = [], idx = [];
  const tmp = new THREE.Color();
  const index = (i, j) => ((i % SEG_U) + SEG_U) % SEG_U * (SEG_V + 1) + j;

  for (let i = 0; i < SEG_U; i++) {
    for (let j = 0; j <= SEG_V; j++) {
      const p = grid[i][j];
      pos.push(p.x, p.y, p.z);

      // bake: crown is dark golden, underside stays pale
      const len = p.length();
      const upness = THREE.MathUtils.clamp(p.y / Math.max(0.001, len), -1, 1);
      const blotch = fbm(p.x * 2.4 + 3.1, p.y * 2.4, p.z * 2.4, seed * 11 + 2);
      let t = 0.26 + 0.52 * (upness * 0.5 + 0.5) + 0.20 * (blotch - 0.5);
      t = THREE.MathUtils.clamp(t, 0, 1);
      if (t < 0.5) tmp.copy(pale).lerp(mid, t * 2);
      else tmp.copy(mid).lerp(deep, (t - 0.5) * 2);
      // crevices catch less light
      const shade = 0.94 + 0.09 * THREE.MathUtils.clamp((len - 0.97) * 2.5, -1, 1);
      // dry speckle
      const spk = 0.95 + 0.10 * noise3(p.x * 15.0, p.y * 15.0, p.z * 15.0, seed + 91);
      col.push(tmp.r * shade * spk, tmp.g * shade * spk, tmp.b * shade * spk);
    }
  }

  for (let i = 0; i < SEG_U; i++) {
    for (let j = 0; j < SEG_V; j++) {
      const a = index(i, j), b = index(i + 1, j), c = index(i + 1, j + 1), d = index(i, j + 1);
      if (j === 0) idx.push(a, d, c);
      else if (j === SEG_V - 1) idx.push(a, d, b);
      else { idx.push(a, d, c); idx.push(a, c, b); }
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  g.userData.grid = grid;
  return g;
}

// Caramel shell hugging the bottom of the same blob, with a wavy upper rim.
export function makeCoatGeometry(chouxGeo, seed) {
  const grid = chouxGeo.userData.grid;
  const pos = [], idx = [];
  const scale = 1.035;
  const cols = [];

  for (let i = 0; i < SEG_U; i++) {
    const u = (i / SEG_U) * Math.PI * 2;
    // wavy caramel line: the bottom is dipped, and the level it reaches wobbles
    const edge = -0.02 + 0.130 * Math.sin(u * 3 + seed) + 0.075 * Math.sin(u * 5 - seed * 2.3);
    const src = grid[i];

    // where this column crosses the caramel line (j runs top -> bottom)
    let k = 0;
    while (k < SEG_V && src[k].y > edge) k++;
    const a = src[Math.max(0, k - 1)], b = src[k];
    const tt = Math.abs(b.y - a.y) < 1e-6 ? 0 : (edge - a.y) / (b.y - a.y);
    const rim = a.clone().lerp(b, THREE.MathUtils.clamp(tt, 0, 1));

    const out = [];
    for (let j = 0; j <= SEG_V; j++) {
      const p = src[j];
      if (p.y <= edge) {
        out.push(new THREE.Vector3(p.x * scale, p.y * scale, p.z * scale));
      } else {
        // Everything above the line collapses onto the rim. The first row keeps
        // a little thickness and the rest tuck just under the pastry, so the
        // caramel ends in a soft lip instead of a knife edge.
        const above = k - j;
        out.push(rim.clone().multiplyScalar(above <= 1 ? 1.012 : 0.985));
      }
    }
    cols.push(out);
  }

  for (let i = 0; i < SEG_U; i++)
    for (let j = 0; j <= SEG_V; j++) { const p = cols[i][j]; pos.push(p.x, p.y, p.z); }

  const index = (i, j) => ((i % SEG_U) + SEG_U) % SEG_U * (SEG_V + 1) + j;
  for (let i = 0; i < SEG_U; i++)
    for (let j = 0; j < SEG_V; j++) {
      const a = index(i, j), b = index(i + 1, j), c = index(i + 1, j + 1), d = index(i, j + 1);
      idx.push(a, d, c); idx.push(a, c, b);
    }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

// ---------------------------------------------------------------------------
// caramel / sugar strands
// ---------------------------------------------------------------------------

export function strandGeometry(p0, p1, sag, radius, seg = 10) {
  const mid = p0.clone().add(p1).multiplyScalar(0.5);
  mid.y -= sag;
  const curve = new THREE.QuadraticBezierCurve3(p0.clone(), mid, p1.clone());
  return new THREE.TubeGeometry(curve, seg, radius, 4, false);
}

export function spunStrandGeometry(points, radius) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.4);
  return new THREE.TubeGeometry(curve, Math.max(24, points.length * 4), radius, 3, false);
}

// ---------------------------------------------------------------------------
// procedural textures
// ---------------------------------------------------------------------------

export function sparkTexture() {
  const s = 64;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grd.addColorStop(0.0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,226,160,0.85)');
  grd.addColorStop(0.6, 'rgba(255,180,80,0.22)');
  grd.addColorStop(1.0, 'rgba(255,160,60,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Soft blurred blob used as a fake contact shadow under objects.
export function blobShadowTexture() {
  const s = 128;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grd.addColorStop(0, 'rgba(0,0,0,0.55)');
  grd.addColorStop(0.55, 'rgba(0,0,0,0.22)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c);
  return t;
}

// Warm bakery equirect used for reflections (caramel + sugar need something to
// catch) and as the scene backdrop tint.
export function bakeryEnvTexture() {
  const w = 512, h = 256;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');

  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0.00, '#fff2d8');
  grd.addColorStop(0.32, '#f6d3a0');
  grd.addColorStop(0.55, '#a9764a');
  grd.addColorStop(0.75, '#5b3a24');
  grd.addColorStop(1.00, '#2a1a10');
  g.fillStyle = grd;
  g.fillRect(0, 0, w, h);

  // a big soft window and a warm lamp: gives caramel two distinct highlights
  const win = g.createRadialGradient(w * 0.30, h * 0.24, 4, w * 0.30, h * 0.24, h * 0.44);
  win.addColorStop(0, 'rgba(255,255,255,0.95)');
  win.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = win; g.fillRect(0, 0, w, h);

  const lamp = g.createRadialGradient(w * 0.74, h * 0.34, 2, w * 0.74, h * 0.34, h * 0.30);
  lamp.addColorStop(0, 'rgba(255,214,150,0.85)');
  lamp.addColorStop(1, 'rgba(255,190,120,0)');
  g.fillStyle = lamp; g.fillRect(0, 0, w, h);

  const t = new THREE.CanvasTexture(c);
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// The wall behind the bench: dark and warm, with a glow above the work area
// so the tower always has something to stand against.
export function backdropTexture() {
  const w = 256, h = 128;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');

  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0.00, '#1a0f09');
  grd.addColorStop(0.38, '#2c1a10');
  grd.addColorStop(0.62, '#5a3620');
  grd.addColorStop(0.80, '#7a4c2c');
  grd.addColorStop(1.00, '#2a1810');
  g.fillStyle = grd;
  g.fillRect(0, 0, w, h);

  const glow = g.createRadialGradient(w * 0.5, h * 0.52, 2, w * 0.5, h * 0.52, h * 0.55);
  glow.addColorStop(0, 'rgba(255,196,128,0.42)');
  glow.addColorStop(1, 'rgba(255,180,110,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, w, h);

  const t = new THREE.CanvasTexture(c);
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Nougatine / caramel-biscuit base plate top.
export function plateTexture() {
  const s = 256;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  g.fillStyle = '#a9702f';
  g.fillRect(0, 0, s, s);
  for (let i = 0; i < 2600; i++) {
    const x = Math.random() * s, y = Math.random() * s, r = Math.random() * 2.6 + 0.4;
    const v = Math.random();
    g.fillStyle = v > 0.55 ? 'rgba(230,182,110,0.55)' : 'rgba(90,52,20,0.45)';
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function woodTexture() {
  const s = 256;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  g.fillStyle = '#6b4526';
  g.fillRect(0, 0, s, s);
  for (let y = 0; y < s; y++) {
    const n = noise3(y * 0.06, 0.5, 1.3, 7);
    const n2 = noise3(y * 0.31, 2.5, 0.2, 13);
    const a = 0.10 + 0.16 * n + 0.08 * n2;
    g.fillStyle = `rgba(40,22,10,${a.toFixed(3)})`;
    g.fillRect(0, y, s, 1);
  }
  for (let i = 0; i < 400; i++) {
    g.fillStyle = `rgba(${180 + Math.random() * 40 | 0},${130 + Math.random() * 40 | 0},80,0.06)`;
    g.fillRect(Math.random() * s, Math.random() * s, Math.random() * 40 + 6, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 3);
  return t;
}
