import * as THREE from 'three';
import { textures } from '../core/textures';
import { clamp01, makeRng } from '../core/util';

/**
 * Sea surface, seen convincingly from both sides.
 *
 * Above: swell geometry + two scrolling normal maps + a sun glitter path.
 * Below: the same mesh flips to a bright, mirror-ish ceiling with the sun's
 * disc smeared across it - which is what makes the dive read as "we went
 * under the water", not "the background changed colour".
 */

const WAVES = [
  { dir: [1.0, 0.25], len: 34.0, amp: 0.5, speed: 1.0 },
  { dir: [0.6, -0.8], len: 19.0, amp: 0.28, speed: 1.3 },
  { dir: [-0.4, 0.92], len: 9.5, amp: 0.13, speed: 1.7 },
  { dir: [0.95, 0.32], len: 4.4, amp: 0.06, speed: 2.3 },
];

export class Ocean {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  private uni: Record<string, THREE.IUniform>;

  constructor(halfSize = 620) {
    const N = 128;
    const geo = new THREE.PlaneGeometry(2, 2, N, N);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const u = pos.getX(i);
      const v = pos.getZ(i);
      // quadratic warp: dense near the viewer, coarse at the horizon
      pos.setX(i, Math.sign(u) * u * u * halfSize);
      pos.setZ(i, Math.sign(v) * v * v * halfSize);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), halfSize * 2);

    const tex = textures();
    const nrm = tex.waterNormal;
    nrm.wrapS = nrm.wrapT = THREE.RepeatWrapping;

    this.uni = {
      uTime: { value: 0 },
      uNormal: { value: nrm },
      uSunDir: { value: new THREE.Vector3(0.45, 0.75, -0.48).normalize() },
      uSunColor: { value: new THREE.Color(0xfff0d2) },
      uSkyColor: { value: new THREE.Color(0x9fd4ee) },
      uDeepColor: { value: new THREE.Color(0x0d4a6b) },
      uShallowColor: { value: new THREE.Color(0x2b8fae) },
      uUnderColor: { value: new THREE.Color(0x7fd7e8) },
      uFogColor: { value: new THREE.Color(0x0a2f45) },
      uFogDensity: { value: 0.004 },
      uOpacity: { value: 1 },
    };

    const waveDefs = WAVES.map(
      (w, i) =>
        `const vec2 D${i} = normalize(vec2(${w.dir[0].toFixed(3)}, ${w.dir[1].toFixed(3)}));
         const float L${i} = ${w.len.toFixed(2)};
         const float A${i} = ${w.amp.toFixed(3)};
         const float S${i} = ${w.speed.toFixed(2)};`,
    ).join('\n');

    const waveSum = WAVES.map(
      (_, i) => `
      { float k = 6.28318 / L${i};
        float ph = dot(D${i}, p.xz) * k + uTime * S${i} * sqrt(9.81 * k);
        h += sin(ph) * A${i};
        dx += cos(ph) * A${i} * k * D${i}.x;
        dz += cos(ph) * A${i} * k * D${i}.y; }`,
    ).join('\n');

    this.material = new THREE.ShaderMaterial({
      uniforms: this.uni,
      side: THREE.DoubleSide,
      transparent: true,
      vertexShader: /* glsl */ `
        ${waveDefs}
        uniform float uTime;
        varying vec3 vWorld;
        varying vec3 vNrm;
        varying float vDist;
        void main() {
          vec3 p = position;
          float h = 0.0, dx = 0.0, dz = 0.0;
          ${waveSum}
          // flatten swell towards the horizon so the far field stays calm
          float fade = 1.0 - smoothstep(160.0, 520.0, length(p.xz));
          p.y += h * fade;
          vNrm = normalize(vec3(-dx * fade, 1.0, -dz * fade));
          vec4 wp = modelMatrix * vec4(p, 1.0);
          vWorld = wp.xyz;
          vDist = length(wp.xyz - cameraPosition);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uNormal;
        uniform float uTime;
        uniform vec3 uSunDir, uSunColor, uSkyColor, uDeepColor, uShallowColor, uUnderColor, uFogColor;
        uniform float uFogDensity;
        uniform float uOpacity;
        varying vec3 vWorld;
        varying vec3 vNrm;
        varying float vDist;

        vec3 sampleN(vec2 uv) {
          vec3 n = texture2D(uNormal, uv).xyz * 2.0 - 1.0;
          return n;
        }

        void main() {
          vec2 uv1 = vWorld.xz * 0.021 + vec2(uTime * 0.013, uTime * 0.009);
          vec2 uv2 = vWorld.xz * 0.058 - vec2(uTime * 0.019, uTime * -0.014);
          vec3 n1 = sampleN(uv1);
          vec3 n2 = sampleN(uv2);
          vec3 n = normalize(vNrm + vec3(n1.x + n2.x * 0.55, 0.0, n1.y + n2.y * 0.55) * 0.55);

          vec3 V = normalize(cameraPosition - vWorld);
          float facing = gl_FrontFacing ? 1.0 : -1.0;
          vec3 N = n * facing;

          float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 4.0);
          vec3 col;

          if (gl_FrontFacing) {
            vec3 water = mix(uDeepColor, uShallowColor, clamp(dot(N, vec3(0.0,1.0,0.0)), 0.0, 1.0));
            col = mix(water, uSkyColor, clamp(fres * 1.15, 0.0, 0.92));
            vec3 H = normalize(uSunDir + V);
            float spec = pow(max(dot(N, H), 0.0), 220.0);
            float glit = pow(max(dot(N, H), 0.0), 26.0) * 0.16;
            col += uSunColor * (spec * 1.8 + glit * 0.7);
          } else {
            // seen from beneath: bright mirror ceiling + Snell's window
            float snell = smoothstep(0.05, 0.62, dot(N, V));
            vec3 ceiling = mix(uUnderColor * 0.85, uSkyColor * 1.02, snell);
            vec3 H = normalize(uSunDir + V);
            float caust = pow(max(dot(N, H), 0.0), 40.0);
            col = ceiling + uSunColor * caust * 0.5;
            col = mix(col, uSkyColor * 1.12, pow(snell, 3.0) * 0.55);
          }

          float f = 1.0 - exp(-uFogDensity * uFogDensity * vDist * vDist);
          col = mix(col, uFogColor, clamp(f, 0.0, 1.0));
          gl_FragColor = vec4(col, uOpacity);
          #include <colorspace_fragment>
        }
      `,
    });

    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
  }

  /** Analytic wave height so floating objects sit correctly on the surface. */
  heightAt(x: number, z: number, time: number) {
    let h = 0;
    for (const w of WAVES) {
      const dl = Math.hypot(w.dir[0], w.dir[1]);
      const dx = w.dir[0] / dl;
      const dz = w.dir[1] / dl;
      const k = (Math.PI * 2) / w.len;
      h += Math.sin((dx * x + dz * z) * k + time * w.speed * Math.sqrt(9.81 * k)) * w.amp;
    }
    return h;
  }

  update(time: number, camera: THREE.Camera, fogColor: THREE.Color, fogDensity: number) {
    this.uni.uTime.value = time;
    this.uni.uFogColor.value.copy(fogColor);
    this.uni.uFogDensity.value = fogDensity;
    this.mesh.position.x = camera.position.x;
    this.mesh.position.z = camera.position.z;
  }

  /** Body-of-water colours. The ocean is its own shader, so scene lights do
   *  nothing to it: an evening has to be told to it directly. */
  setWater(deep: THREE.Color, shallow: THREE.Color, under: THREE.Color) {
    (this.uni.uDeepColor.value as THREE.Color).copy(deep);
    (this.uni.uShallowColor.value as THREE.Color).copy(shallow);
    (this.uni.uUnderColor.value as THREE.Color).copy(under);
  }

  setSky(sky: THREE.Color, sun: THREE.Color) {
    (this.uni.uSkyColor.value as THREE.Color).copy(sky);
    (this.uni.uSunColor.value as THREE.Color).copy(sun);
  }
}

// ---------------------------------------------------------------------------
// Particle systems
// ---------------------------------------------------------------------------

const POINT_VS = /* glsl */ `
  attribute float aSize;
  attribute float aSeed;
  uniform float uTime;
  uniform float uPixelRatio;
  varying float vAlpha;
  varying float vSeed;
  void main() {
    vec3 p = position;
    p.x += sin(uTime * 0.5 + aSeed * 9.0) * 0.35;
    p.z += cos(uTime * 0.43 + aSeed * 7.0) * 0.35;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float d = -mv.z;
    gl_PointSize = aSize * uPixelRatio * (34.0 / max(d, 1.0));
    vAlpha = clamp(1.0 - d / 90.0, 0.0, 1.0) * clamp(d / 3.0, 0.0, 1.0);
    vSeed = aSeed;
  }
`;

const POINT_FS = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vAlpha;
  varying float vSeed;
  void main() {
    vec4 t = texture2D(uMap, gl_PointCoord);
    float a = t.a * vAlpha * uOpacity;
    if (a < 0.01) discard;
    gl_FragColor = vec4(uColor * (0.75 + fract(vSeed * 13.7) * 0.5), a);
    #include <colorspace_fragment>
  }
`;

/** Slow-drifting marine snow: instantly reads as "we are underwater". */
export class MarineSnow {
  points: THREE.Points;
  private uni: Record<string, THREE.IUniform>;
  private box = new THREE.Vector3(70, 46, 70);
  private base: Float32Array;

  constructor(count = 900) {
    const rng = makeRng(77);
    const pos = new Float32Array(count * 3);
    const size = new Float32Array(count);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (rng() - 0.5) * this.box.x;
      pos[i * 3 + 1] = (rng() - 0.5) * this.box.y;
      pos[i * 3 + 2] = (rng() - 0.5) * this.box.z;
      size[i] = 0.5 + Math.pow(rng(), 3) * 3.2;
      seed[i] = rng();
    }
    this.base = pos.slice();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 200);
    this.uni = {
      uTime: { value: 0 },
      uMap: { value: textures().soft },
      uColor: { value: new THREE.Color(0xdff2ff) },
      uOpacity: { value: 0.0 },
      uPixelRatio: { value: 1 },
    };
    this.points = new THREE.Points(
      g,
      new THREE.ShaderMaterial({
        uniforms: this.uni,
        vertexShader: POINT_VS,
        fragmentShader: POINT_FS,
        transparent: true,
        depthWrite: false,
        blending: THREE.NormalBlending,
      }),
    );
    this.points.frustumCulled = false;
  }

  setPixelRatio(r: number) {
    this.uni.uPixelRatio.value = r;
  }

  update(time: number, dt: number, camera: THREE.Object3D, opacity: number) {
    this.uni.uTime.value = time;
    this.uni.uOpacity.value = opacity;
    if (opacity <= 0.001) {
      this.points.visible = false;
      return;
    }
    this.points.visible = true;
    // wrap the field around the camera so it is always populated
    const g = this.points.geometry;
    const pos = g.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const c = camera.position;
    const hx = this.box.x / 2;
    const hy = this.box.y / 2;
    const hz = this.box.z / 2;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i + 1] -= dt * (0.18 + (this.base[i] % 1) * 0.05);
      let dx = arr[i] - c.x;
      let dy = arr[i + 1] - c.y;
      let dz = arr[i + 2] - c.z;
      if (dx > hx) arr[i] -= this.box.x;
      else if (dx < -hx) arr[i] += this.box.x;
      if (dy > hy) arr[i + 1] -= this.box.y;
      else if (dy < -hy) arr[i + 1] += this.box.y;
      if (dz > hz) arr[i + 2] -= this.box.z;
      else if (dz < -hz) arr[i + 2] += this.box.z;
      void dx;
      void dy;
      void dz;
    }
    pos.needsUpdate = true;
  }
}

interface Bubble {
  life: number;
  maxLife: number;
  vx: number;
  vy: number;
  vz: number;
}

/** Bubble emitter used for the cable entering the water, ROV thrusters, sand. */
export class Bubbles {
  points: THREE.Points;
  private uni: Record<string, THREE.IUniform>;
  private data: Bubble[] = [];
  private cursor = 0;
  private capacity: number;

  constructor(capacity = 360, color = 0xffffff, ring = true) {
    this.capacity = capacity;
    const pos = new Float32Array(capacity * 3);
    const size = new Float32Array(capacity);
    const seed = new Float32Array(capacity);
    for (let i = 0; i < capacity; i++) {
      pos[i * 3 + 1] = 1e6; // parked far away
      this.data.push({ life: 0, maxLife: 1, vx: 0, vy: 0, vz: 0 });
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    this.uni = {
      uTime: { value: 0 },
      uMap: { value: ring ? textures().ring : textures().soft },
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: 1 },
      uPixelRatio: { value: 1 },
    };
    this.points = new THREE.Points(
      g,
      new THREE.ShaderMaterial({
        uniforms: this.uni,
        vertexShader: POINT_VS,
        fragmentShader: POINT_FS,
        transparent: true,
        depthWrite: false,
      }),
    );
    this.points.frustumCulled = false;
  }

  setPixelRatio(r: number) {
    this.uni.uPixelRatio.value = r;
  }

  emit(x: number, y: number, z: number, size = 2, rise = 1.2, spread = 0.6, life = 3) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.capacity;
    const g = this.points.geometry;
    const pos = (g.attributes.position as THREE.BufferAttribute).array as Float32Array;
    const sz = (g.attributes.aSize as THREE.BufferAttribute).array as Float32Array;
    const sd = (g.attributes.aSeed as THREE.BufferAttribute).array as Float32Array;
    pos[i * 3] = x;
    pos[i * 3 + 1] = y;
    pos[i * 3 + 2] = z;
    sz[i] = size;
    sd[i] = Math.random();
    const d = this.data[i];
    d.life = life;
    d.maxLife = life;
    d.vx = (Math.random() - 0.5) * spread;
    d.vy = rise * (0.6 + Math.random() * 0.8);
    d.vz = (Math.random() - 0.5) * spread;
  }

  update(time: number, dt: number) {
    this.uni.uTime.value = time;
    const g = this.points.geometry;
    const posAttr = g.attributes.position as THREE.BufferAttribute;
    const pos = posAttr.array as Float32Array;
    const szAttr = g.attributes.aSize as THREE.BufferAttribute;
    const sz = szAttr.array as Float32Array;
    let any = false;
    for (let i = 0; i < this.capacity; i++) {
      const d = this.data[i];
      if (d.life <= 0) continue;
      any = true;
      d.life -= dt;
      if (d.life <= 0) {
        pos[i * 3 + 1] = 1e6;
        continue;
      }
      pos[i * 3] += d.vx * dt;
      pos[i * 3 + 1] += d.vy * dt;
      pos[i * 3 + 2] += d.vz * dt;
      d.vy += dt * 0.35;
      sz[i] *= 1 + dt * 0.12;
    }
    if (any) {
      posAttr.needsUpdate = true;
      szAttr.needsUpdate = true;
    }
  }
}

/** Sand plume: heavier, settles instead of rising. */
export class SandPlume {
  points: THREE.Points;
  private uni: Record<string, THREE.IUniform>;
  private vel: Float32Array;
  private life: Float32Array;
  private cursor = 0;
  private capacity: number;

  constructor(capacity = 420) {
    this.capacity = capacity;
    const pos = new Float32Array(capacity * 3);
    const size = new Float32Array(capacity);
    const seed = new Float32Array(capacity);
    for (let i = 0; i < capacity; i++) pos[i * 3 + 1] = 1e6;
    this.vel = new Float32Array(capacity * 3);
    this.life = new Float32Array(capacity);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    this.uni = {
      uTime: { value: 0 },
      uMap: { value: textures().soft },
      uColor: { value: new THREE.Color(0xc9b895) },
      uOpacity: { value: 0.5 },
      uPixelRatio: { value: 1 },
    };
    this.points = new THREE.Points(
      g,
      new THREE.ShaderMaterial({
        uniforms: this.uni,
        vertexShader: POINT_VS,
        fragmentShader: POINT_FS,
        transparent: true,
        depthWrite: false,
      }),
    );
    this.points.frustumCulled = false;
  }

  setPixelRatio(r: number) {
    this.uni.uPixelRatio.value = r;
  }

  emit(x: number, y: number, z: number, dirX = 0, dirZ = 0, strength = 1) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.capacity;
    const g = this.points.geometry;
    const pos = (g.attributes.position as THREE.BufferAttribute).array as Float32Array;
    const sz = (g.attributes.aSize as THREE.BufferAttribute).array as Float32Array;
    const sd = (g.attributes.aSeed as THREE.BufferAttribute).array as Float32Array;
    pos[i * 3] = x + (Math.random() - 0.5) * 0.6;
    pos[i * 3 + 1] = y;
    pos[i * 3 + 2] = z + (Math.random() - 0.5) * 0.6;
    sz[i] = (1.1 + Math.random() * 2.3) * strength;
    sd[i] = Math.random();
    this.vel[i * 3] = dirX * (0.4 + Math.random()) * strength + (Math.random() - 0.5) * 0.7;
    this.vel[i * 3 + 1] = (0.35 + Math.random() * 0.7) * strength;
    this.vel[i * 3 + 2] = dirZ * (0.4 + Math.random()) * strength + (Math.random() - 0.5) * 0.7;
    this.life[i] = 2.2 + Math.random() * 1.6;
  }

  update(time: number, dt: number) {
    this.uni.uTime.value = time;
    const g = this.points.geometry;
    const posAttr = g.attributes.position as THREE.BufferAttribute;
    const pos = posAttr.array as Float32Array;
    const szAttr = g.attributes.aSize as THREE.BufferAttribute;
    const sz = szAttr.array as Float32Array;
    let any = false;
    for (let i = 0; i < this.capacity; i++) {
      if (this.life[i] <= 0) continue;
      any = true;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        pos[i * 3 + 1] = 1e6;
        continue;
      }
      pos[i * 3] += this.vel[i * 3] * dt;
      pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      const drag = Math.exp(-1.6 * dt);
      this.vel[i * 3] *= drag;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * drag - dt * 0.35;
      this.vel[i * 3 + 2] *= drag;
      sz[i] *= 1 + dt * 0.42;
    }
    if (any) {
      posAttr.needsUpdate = true;
      szAttr.needsUpdate = true;
    }
  }
}

/** Shafts of sunlight for the first stretch of the descent. */
export class GodRays {
  group: THREE.Group;
  private mats: THREE.ShaderMaterial[] = [];

  constructor() {
    this.group = new THREE.Group();
    const rng = makeRng(303);
    for (let i = 0; i < 7; i++) {
      const w = 5 + rng() * 12;
      const h = 90;
      const g = new THREE.PlaneGeometry(w, h);
      g.translate(0, -h / 2, 0);
      const mat = new THREE.ShaderMaterial({
        uniforms: { uOpacity: { value: 0 }, uColor: { value: new THREE.Color(0xd8f4ff) }, uTime: { value: 0 }, uSeed: { value: rng() } },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
        `,
        fragmentShader: /* glsl */ `
          uniform float uOpacity; uniform vec3 uColor; uniform float uTime; uniform float uSeed;
          varying vec2 vUv;
          void main() {
            float edge = smoothstep(0.0, 0.35, vUv.x) * smoothstep(1.0, 0.65, vUv.x);
            float fall = pow(vUv.y, 1.7);
            float flick = 0.75 + 0.25 * sin(uTime * 0.8 + uSeed * 30.0);
            float a = edge * fall * uOpacity * flick;
            if (a < 0.004) discard;
            gl_FragColor = vec4(uColor, a * 0.42);
            #include <colorspace_fragment>
          }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
      const m = new THREE.Mesh(g, mat);
      m.position.set((rng() - 0.5) * 70, -0.4, (rng() - 0.5) * 70);
      m.rotation.y = rng() * Math.PI;
      m.rotation.z = (rng() - 0.5) * 0.16;
      this.group.add(m);
      this.mats.push(mat);
    }
    this.group.renderOrder = 3;
  }

  update(time: number, camera: THREE.Object3D, opacity: number) {
    this.group.visible = opacity > 0.005;
    if (!this.group.visible) return;
    this.group.position.x = camera.position.x;
    this.group.position.z = camera.position.z;
    for (const m of this.mats) {
      m.uniforms.uOpacity.value = opacity;
      m.uniforms.uTime.value = time;
    }
  }
}

/** Depth-driven water colour used for fog, ambient tint and the ocean shader. */
export function waterColorAt(depth: number, out: THREE.Color) {
  const surface = new THREE.Color(0x2f9bbd);
  const mid = new THREE.Color(0x0d4f77);
  const deep = new THREE.Color(0x06283f);
  const abyss = new THREE.Color(0x04141f);
  const d = Math.max(0, depth);
  if (d < 12) out.copy(surface).lerp(mid, clamp01(d / 12));
  else if (d < 34) out.copy(mid).lerp(deep, clamp01((d - 12) / 22));
  else out.copy(deep).lerp(abyss, clamp01((d - 34) / 30));
  return out;
}

export function fogDensityAt(depth: number) {
  return 0.0042 + clamp01(depth / 60) * 0.016;
}
