/**
 * The sluice gate: one lift panel in a concrete headwall, a screw stem and a
 * hand wheel. Swiping up lifts the panel, and the water sheet pouring
 * through scales with exactly how far it is open — the child can hold it
 * half open, close it again, and see the flow answer immediately.
 *
 * There is no failure state: the gate cannot be broken, and the bog cannot
 * be over- or under-filled in a way that blocks the game.
 */

import * as THREE from 'three';
import { gatePosition, type FieldVariant } from './layout';
import { clamp, damp } from '../core/math';

const POUR_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const POUR_FRAG = /* glsl */ `
  precision mediump float;
  uniform float uTime;
  uniform float uOpen;
  uniform vec3 uColor;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453);
  }

  void main() {
    if (uOpen < 0.02) discard;
    // vertical streaks scrolling downstream
    float lane = floor(vUv.x * 14.0);
    float speed = 1.4 + hash(vec2(lane, 3.0)) * 1.6;
    float v = fract(vUv.y * 2.2 - uTime * speed + hash(vec2(lane, 7.0)));
    float streak = smoothstep(0.55, 0.05, abs(v - 0.5) * 2.0);
    float body = smoothstep(0.0, 0.28, vUv.y) * smoothstep(1.0, 0.62, vUv.y);
    float edge = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
    float a = (0.22 + streak * 0.42) * body * edge * clamp(uOpen * 1.4, 0.0, 1.0);
    vec3 col = mix(uColor, vec3(0.86, 0.93, 0.92), streak * 0.6 + 0.12);
    gl_FragColor = vec4(col, a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export class Gate {
  readonly group = new THREE.Group();
  /** 0 = shut, 1 = fully lifted. */
  open = 0;
  private targetOpen = 0;

  private readonly panel: THREE.Mesh;
  private readonly wheel: THREE.Group;
  private readonly pourMat: THREE.ShaderMaterial;
  private readonly pour: THREE.Mesh;
  private readonly disposables: Array<{ dispose(): void }> = [];
  private time = 0;

  /** World point of the hand wheel — the swipe target and hint anchor. */
  readonly handle = new THREE.Vector3();
  /** Mouth of the gate, where the water lands. */
  readonly mouth = new THREE.Vector3();

  constructor(v: FieldVariant) {
    const base = gatePosition(v);
    this.group.position.copy(base);
    this.group.name = 'gate';

    const concrete = new THREE.MeshStandardMaterial({ color: '#9c968a', roughness: 0.92 });
    const steel = new THREE.MeshStandardMaterial({
      color: '#7c8894',
      roughness: 0.42,
      metalness: 0.72,
    });
    const paint = new THREE.MeshStandardMaterial({
      color: '#d8a12c',
      roughness: 0.55,
      metalness: 0.25,
    });
    this.disposables.push(concrete, steel, paint);

    const wallGeo = new THREE.BoxGeometry(7.4, 3.4, 1.5);
    const wall = new THREE.Mesh(wallGeo, concrete);
    wall.position.set(0, 1.2, 0);
    wall.castShadow = true;
    wall.receiveShadow = true;
    this.group.add(wall);
    this.disposables.push(wallGeo);

    // opening cut visually by two piers + a lintel rather than CSG
    const pierGeo = new THREE.BoxGeometry(1.7, 4.6, 1.7);
    for (const dx of [-2.6, 2.6]) {
      const p = new THREE.Mesh(pierGeo, concrete);
      p.position.set(dx, 1.9, 0);
      p.castShadow = true;
      this.group.add(p);
    }
    this.disposables.push(pierGeo);

    const lintelGeo = new THREE.BoxGeometry(6.9, 0.7, 1.7);
    const lintel = new THREE.Mesh(lintelGeo, concrete);
    lintel.position.set(0, 4.05, 0);
    this.group.add(lintel);
    this.disposables.push(lintelGeo);

    // the lift panel
    const panelGeo = new THREE.BoxGeometry(3.5, 2.9, 0.28);
    this.panel = new THREE.Mesh(panelGeo, steel);
    this.panel.position.set(0, 1.35, -0.35);
    this.panel.castShadow = true;
    this.group.add(this.panel);
    this.disposables.push(panelGeo);

    const ribGeo = new THREE.BoxGeometry(3.6, 0.16, 0.42);
    for (const dy of [-0.85, 0, 0.85]) {
      const rib = new THREE.Mesh(ribGeo, paint);
      rib.position.set(0, dy, 0.05);
      this.panel.add(rib);
    }
    this.disposables.push(ribGeo);

    // screw stem + hand wheel above the lintel
    const stemGeo = new THREE.CylinderGeometry(0.13, 0.13, 3.6, 8);
    const stem = new THREE.Mesh(stemGeo, steel);
    stem.position.set(0, 5.4, -0.35);
    this.group.add(stem);
    this.disposables.push(stemGeo);

    const yokeGeo = new THREE.BoxGeometry(2.4, 0.34, 0.6);
    const yoke = new THREE.Mesh(yokeGeo, paint);
    yoke.position.set(0, 4.55, -0.35);
    this.group.add(yoke);
    this.disposables.push(yokeGeo);

    this.wheel = new THREE.Group();
    this.wheel.position.set(0, 7.1, -0.35);
    const rimGeo = new THREE.TorusGeometry(1.05, 0.15, 8, 22);
    const rim = new THREE.Mesh(rimGeo, paint);
    rim.rotation.x = Math.PI / 2;
    this.wheel.add(rim);
    const spokeGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.05, 6);
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Mesh(spokeGeo, paint);
      s.rotation.z = Math.PI / 2;
      s.rotation.y = (i / 3) * Math.PI;
      this.wheel.add(s);
    }
    const hubGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.44, 10);
    const hub = new THREE.Mesh(hubGeo, steel);
    this.wheel.add(hub);
    this.group.add(this.wheel);
    this.disposables.push(rimGeo, spokeGeo, hubGeo);

    // the pouring sheet
    const pourGeo = new THREE.PlaneGeometry(3.3, 7.6, 1, 1);
    this.pourMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uOpen: { value: 0 },
        uColor: { value: v.waterTint.clone().multiplyScalar(1.8) },
      },
      vertexShader: POUR_VERT,
      fragmentShader: POUR_FRAG,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.pour = new THREE.Mesh(pourGeo, this.pourMat);
    this.pour.position.set(0, 0.62, 2.9);
    this.pour.rotation.x = -Math.PI / 2.18;
    this.pour.renderOrder = 7;
    this.group.add(this.pour);
    this.disposables.push(pourGeo, this.pourMat);

    this.handle.copy(base).add(new THREE.Vector3(0, 7.1, -0.35));
    this.mouth.copy(base).add(new THREE.Vector3(0, 0.6, 4.4));
  }

  /** Drive from a gesture: positive = opening. Clamped and smoothed. */
  nudge(amount: number): void {
    this.targetOpen = clamp(this.targetOpen + amount, 0, 1);
  }

  setTarget(v: number): void {
    this.targetOpen = clamp(v, 0, 1);
  }

  get target(): number {
    return this.targetOpen;
  }

  update(dt: number): void {
    this.time += dt;
    this.open = damp(this.open, this.targetOpen, 3.4, dt);
    this.panel.position.y = 1.35 + this.open * 2.55;
    this.wheel.rotation.y += this.open > 0.002 ? dt * 2.2 * (this.targetOpen - this.open + 0.35) : 0;
    this.pourMat.uniforms.uTime.value = this.time;
    this.pourMat.uniforms.uOpen.value = this.open;
    this.pour.visible = this.open > 0.02;
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
  }
}
