/**
 * Wordless guidance. After a few seconds of hesitation the game points, it
 * never tells: a breathing ring on the thing to touch, a dot that traces the
 * circle you should draw, or an arrow that shows the direction to swipe.
 */
import * as THREE from 'three';
import { makeRingMaterial } from './materials';
import { TAU, damp } from '../core/util';

function arrowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, 128, 128);
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.moveTo(64, 14);
  g.lineTo(110, 66);
  g.lineTo(84, 66);
  g.lineTo(84, 114);
  g.lineTo(44, 114);
  g.lineTo(44, 66);
  g.lineTo(18, 66);
  g.closePath();
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Hints {
  readonly group = new THREE.Group();
  private ring: THREE.Mesh;
  private ringMat: THREE.ShaderMaterial;
  private dot: THREE.Mesh;
  private arrow: THREE.Mesh;
  private arrowMat: THREE.MeshBasicMaterial;
  private t = 0;
  private alpha = 0;
  private target = 0;
  private mode: 'none' | 'ring' | 'circle' | 'arrow' = 'none';
  private radius = 0.3;
  private arrowDir = new THREE.Vector2(0, 1);
  private pos = new THREE.Vector3();

  constructor() {
    this.ringMat = makeRingMaterial(0x7dffe6);
    this.ring = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.ringMat);
    this.ring.renderOrder = 900;
    this.group.add(this.ring);

    this.dot = new THREE.Mesh(
      new THREE.CircleGeometry(0.5, 20),
      new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0.9,
        depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
      }),
    );
    this.dot.renderOrder = 901;
    this.group.add(this.dot);

    this.arrowMat = new THREE.MeshBasicMaterial({
      map: arrowTexture(), transparent: true, opacity: 0.9, color: 0x9fffe8,
      depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.arrow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.arrowMat);
    this.arrow.renderOrder = 901;
    this.group.add(this.arrow);

    this.group.visible = false;
  }

  /** A breathing ring around something to touch or drop onto. */
  showRing(pos: THREE.Vector3, radius: number) {
    this.mode = 'ring'; this.pos.copy(pos); this.radius = radius; this.target = 1;
  }
  /** A ring plus a dot tracing the circular motion the player should make. */
  showCircle(pos: THREE.Vector3, radius: number) {
    this.mode = 'circle'; this.pos.copy(pos); this.radius = radius; this.target = 1;
  }
  /** A ring plus an arrow pointing the way to drag. dir is in screen space. */
  showArrow(pos: THREE.Vector3, radius: number, dx: number, dy: number) {
    this.mode = 'arrow'; this.pos.copy(pos); this.radius = radius;
    this.arrowDir.set(dx, dy).normalize(); this.target = 1;
  }
  hide() { this.target = 0; }

  update(dt: number, camera: THREE.Camera) {
    this.t += dt;
    this.alpha = damp(this.alpha, this.target, 6, dt);
    this.group.visible = this.alpha > 0.01;
    if (!this.group.visible) { this.mode = this.target === 0 ? 'none' : this.mode; return; }

    const pulse = 0.75 + 0.25 * Math.sin(this.t * 3.0);
    this.ringMat.uniforms.uTime.value = this.t;
    this.ringMat.uniforms.uPulse.value = this.alpha * pulse;

    this.ring.position.copy(this.pos);
    this.ring.quaternion.copy(camera.quaternion);
    const s = this.radius * 2 * (1 + 0.05 * Math.sin(this.t * 3.0));
    this.ring.scale.set(s, s, 1);

    this.dot.visible = this.mode === 'circle';
    if (this.dot.visible) {
      const a = -this.t * 1.9;
      const off = new THREE.Vector3(Math.cos(a) * this.radius * 0.82, Math.sin(a) * this.radius * 0.82, 0);
      off.applyQuaternion(camera.quaternion);
      this.dot.position.copy(this.pos).add(off);
      this.dot.quaternion.copy(camera.quaternion);
      const ds = this.radius * 0.24;
      this.dot.scale.set(ds, ds, 1);
      (this.dot.material as THREE.MeshBasicMaterial).opacity = this.alpha * 0.95;
    }

    this.arrow.visible = this.mode === 'arrow';
    if (this.arrow.visible) {
      const bob = (Math.sin(this.t * 2.6) * 0.5 + 0.5) * this.radius * 0.55;
      const off = new THREE.Vector3(
        this.arrowDir.x * (this.radius * 0.9 + bob),
        this.arrowDir.y * (this.radius * 0.9 + bob), 0,
      );
      off.applyQuaternion(camera.quaternion);
      this.arrow.position.copy(this.pos).add(off);
      this.arrow.quaternion.copy(camera.quaternion);
      this.arrow.rotateZ(Math.atan2(this.arrowDir.y, this.arrowDir.x) - Math.PI / 2);
      const as = this.radius * 0.8;
      this.arrow.scale.set(as, as, 1);
      this.arrowMat.opacity = this.alpha * 0.9;
    }
  }

  dispose() {
    this.ring.geometry.dispose(); this.ringMat.dispose();
    this.dot.geometry.dispose(); (this.dot.material as THREE.Material).dispose();
    this.arrow.geometry.dispose(); this.arrowMat.map?.dispose(); this.arrowMat.dispose();
  }
}

export { TAU };
