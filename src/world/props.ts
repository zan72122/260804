/**
 * Hand props: the slide, the cover glass, the mountant puddle and the water
 * droplets that run off when the slide leaves the bath.
 */
import * as THREE from 'three';
import { makeGlassMaterial } from '../gfx/materials';
import { TAU } from '../core/util';

export const SLIDE_W = 0.72;
export const SLIDE_D = 0.245;

export function makeSlide() {
  const g = new THREE.Group();
  const mat = makeGlassMaterial({ tint: 0xdff3ff, edge: 1.15, opacity: 1 });
  const pane = new THREE.Mesh(new THREE.BoxGeometry(SLIDE_W, 0.011, SLIDE_D), mat);
  pane.renderOrder = 7;
  g.add(pane);
  // frosted label end — gives the slide an orientation a child can read
  const label = new THREE.Mesh(
    new THREE.BoxGeometry(0.17, 0.013, SLIDE_D * 0.98),
    new THREE.MeshStandardMaterial({ color: 0xeaf6ff, roughness: 0.95, metalness: 0 }),
  );
  label.position.set(-SLIDE_W / 2 + 0.085, 0, 0);
  label.renderOrder = 7;
  g.add(label);
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(0.17, 0.002, 0.03),
    new THREE.MeshBasicMaterial({ color: 0x2fb9a6 }),
  );
  stripe.position.set(-SLIDE_W / 2 + 0.085, 0.008, 0.07);
  g.add(stripe);
  return { group: g, mat, pane };
}

export function makeCoverGlass() {
  const g = new THREE.Group();
  const mat = makeGlassMaterial({ tint: 0xe6f7ff, edge: 1.4, opacity: 1 });
  const pane = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.006, 0.225), mat);
  pane.renderOrder = 9;
  g.add(pane);
  return { group: g, mat };
}

/** A thin lens of mountant that spreads out under the cover glass. */
export function makeMountant() {
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: {
      uSpread: { value: 0 },     // 0..1 radius of the wetted front
      uTime: { value: 0 },
      uTint: { value: new THREE.Color(0xd6f2ff) },
      uOpacity: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main() {
        vUv = uv;
        vN = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uSpread, uTime, uOpacity; uniform vec3 uTint;
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main() {
        vec2 p = (vUv - 0.5) * 2.0;
        // the wetting front is a wobbly circle, not a perfect one
        float wob = 1.0 + 0.09 * sin(atan(p.y, p.x) * 5.0 + uTime * 0.8);
        float r = length(p * vec2(1.0, 1.15)) / wob;
        float front = smoothstep(uSpread, uSpread - 0.12, r);
        if (front <= 0.001) discard;
        float rim = smoothstep(uSpread - 0.16, uSpread - 0.02, r) * front;
        float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.5);
        vec3 col = uTint * (0.35 + fres * 0.5) + vec3(1.0) * rim * 0.55;
        // thin-film colour in the advancing meniscus
        col += (0.5 + 0.5 * cos(6.28318 * (rim * 2.2 + vec3(0.0, 0.33, 0.67)))) * rim * 0.30;
        float a = (0.10 + fres * 0.20 + rim * 0.45) * front * uOpacity;
        gl_FragColor = vec4(col, a);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.3), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 8;
  mesh.visible = false;
  return { mesh, mat };
}

/**
 * A soft disc that follows whatever the player is carrying, drawn on the
 * surface below it. Without it, a top-down or near-top-down shot gives no clue
 * how high the thing in your hand is.
 */
export function makeCarryShadow() {
  const c = document.createElement('canvas');
  c.width = c.height = 96;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(48, 48, 0, 48, 48, 48);
  grd.addColorStop(0, 'rgba(0,0,0,0.55)');
  grd.addColorStop(0.5, 'rgba(0,0,0,0.24)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 96, 96);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, opacity: 0, depthWrite: false,
    color: 0x0e2230,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 5;
  mesh.visible = false;
  return {
    mesh, mat,
    /** @param height how far the carried object floats above `surfaceY` */
    place(x: number, z: number, surfaceY: number, height: number, size: number) {
      mesh.visible = true;
      mesh.position.set(x, surfaceY + 0.004, z);
      const spread = size * (1 + height * 1.6);
      mesh.scale.set(spread, spread, 1);
      mat.opacity = Math.max(0, 0.5 - height * 0.55);
    },
    hide() { mesh.visible = false; mat.opacity = 0; },
    dispose() { mesh.geometry.dispose(); tex.dispose(); mat.dispose(); },
  };
}

/** A handful of water droplets that run off the slide. Meshes, not particles. */
export class Droplets {
  readonly group = new THREE.Group();
  private drops: { m: THREE.Mesh; v: number; life: number }[] = [];
  private mat: THREE.ShaderMaterial;

  constructor(count = 6) {
    this.mat = makeGlassMaterial({ tint: 0xbfe8ff, edge: 0.2, opacity: 0.9 });
    const geo = new THREE.SphereGeometry(1, 10, 8);
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(geo, this.mat);
      m.visible = false;
      m.renderOrder = 9;
      this.group.add(m);
      this.drops.push({ m, v: 0, life: 0 });
    }
  }

  burst(origin: THREE.Vector3, spread = 0.22) {
    let n = 0;
    for (const d of this.drops) {
      if (d.life > 0) continue;
      const a = Math.random() * TAU;
      d.m.position.copy(origin);
      d.m.position.x += Math.cos(a) * spread * Math.random();
      d.m.position.z += Math.sin(a) * spread * Math.random();
      const s = 0.012 + Math.random() * 0.016;
      d.m.scale.set(s, s * 0.8, s);
      d.m.visible = true;
      d.v = 0;
      d.life = 1.2 + Math.random() * 0.5;
      if (++n >= 4) break;
    }
  }

  update(dt: number) {
    for (const d of this.drops) {
      if (d.life <= 0) continue;
      d.life -= dt;
      d.v += 1.6 * dt;
      d.m.position.y -= d.v * dt;
      d.m.scale.y = d.m.scale.x * (0.8 + d.v * 0.5);
      if (d.life <= 0) d.m.visible = false;
    }
  }

  clear() { for (const d of this.drops) { d.life = 0; d.m.visible = false; } }
  dispose() { this.mat.dispose(); this.drops[0]?.m.geometry.dispose(); }
}
