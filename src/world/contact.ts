/**
 * Contact shadows on the water.
 *
 * The flood surface is a transparent custom shader, so it cannot take part
 * in the normal shadow pass — which left the beater, the crew and the
 * nozzle sitting on the water with nothing beneath them. Anything floating
 * with no darkening under it reads as pasted onto the surface rather than
 * displacing it, and that was one of the quieter reasons the bog looked
 * like a picture of a bog.
 *
 * This is a handful of soft multiplied discs, laid on the surface and moved
 * every frame. One draw call, no shadow map, and it buys the single most
 * important cue: these things are *in* the water.
 */

import * as THREE from 'three';

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision mediump float;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    // soft-edged, never fully black: this is water scattering, not a hole
    float a = smoothstep(1.0, 0.15, d);
    vec3 tint = mix(vec3(1.0), vec3(0.34, 0.38, 0.36), a);
    gl_FragColor = vec4(tint, 1.0);
  }
`;

export class ContactShadows {
  readonly mesh: THREE.InstancedMesh;
  private readonly geo: THREE.PlaneGeometry;
  private readonly mat: THREE.ShaderMaterial;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(1, 0, 0),
    -Math.PI / 2,
  );
  private readonly p = new THREE.Vector3();
  private readonly s = new THREE.Vector3();
  private used = 0;

  constructor(capacity = 6) {
    this.geo = new THREE.PlaneGeometry(1, 1);
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.MultiplyBlending,
    });
    this.mesh = new THREE.InstancedMesh(this.geo, this.mat, capacity);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    // after the water, so it darkens the surface rather than the bed
    this.mesh.renderOrder = 7;
    this.mesh.name = 'contact-shadows';
  }

  begin(): void {
    this.used = 0;
  }

  /** Lay one disc of the given radius on the surface at (x, z). */
  add(x: number, y: number, z: number, radius: number): void {
    if (this.used >= this.mesh.instanceMatrix.count) return;
    this.p.set(x, y + 0.012, z);
    this.s.set(radius * 2, radius * 2, 1);
    this.m.compose(this.p, this.q, this.s);
    this.mesh.setMatrixAt(this.used++, this.m);
  }

  end(): void {
    this.mesh.count = this.used;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.geo.dispose();
    this.mat.dispose();
  }
}
