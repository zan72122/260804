import * as THREE from 'three';

export interface CamPose {
  pos: THREE.Vector3;
  look: THREE.Vector3;
  halfWidth: number; // horizontal half-extent that must stay visible at the look point
}

const FOV = 42;

export class CameraRig {
  camera: THREE.PerspectiveCamera;
  private curPos = new THREE.Vector3();
  private curLook = new THREE.Vector3();
  private fromPos = new THREE.Vector3();
  private fromLook = new THREE.Vector3();
  private toPose: CamPose | null = null;
  private t = 1;
  private dur = 1;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(FOV, aspect, 0.1, 60);
  }

  // scale camera distance so `halfWidth` fits horizontally (portrait safety)
  private fitted(pose: CamPose): THREE.Vector3 {
    const vHalf = THREE.MathUtils.degToRad(FOV / 2);
    const hHalf = Math.atan(Math.tan(vHalf) * this.camera.aspect);
    const dir = pose.pos.clone().sub(pose.look);
    const dist = dir.length();
    const needed = pose.halfWidth / Math.tan(hHalf);
    if (needed > dist) dir.multiplyScalar(needed / dist);
    return pose.look.clone().add(dir);
  }

  jumpTo(pose: CamPose): void {
    this.toPose = pose;
    this.curPos.copy(this.fitted(pose));
    this.curLook.copy(pose.look);
    this.t = 1;
    this.apply();
  }

  glideTo(pose: CamPose, dur: number): void {
    this.fromPos.copy(this.curPos);
    this.fromLook.copy(this.curLook);
    this.toPose = pose;
    this.dur = Math.max(0.01, dur);
    this.t = 0;
  }

  // retarget only the look point of the active pose (for follow shots)
  retarget(pose: CamPose): void {
    this.toPose = pose;
    if (this.t >= 1) {
      // ease continuously toward the new fitted position
      const target = this.fitted(pose);
      this.curPos.lerp(target, 0.08);
      this.curLook.lerp(pose.look, 0.14);
      this.apply();
    }
  }

  onAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    if (this.toPose && this.t >= 1) {
      this.curPos.copy(this.fitted(this.toPose));
      this.apply();
    }
  }

  update(dt: number): void {
    if (!this.toPose || this.t >= 1) return;
    this.t = Math.min(1, this.t + dt / this.dur);
    const e = this.t < 0.5 ? 4 * this.t ** 3 : 1 - Math.pow(-2 * this.t + 2, 3) / 2; // easeInOutCubic
    const target = this.fitted(this.toPose);
    this.curPos.lerpVectors(this.fromPos, target, e);
    this.curLook.lerpVectors(this.fromLook, this.toPose.look, e);
    this.apply();
  }

  private apply(): void {
    this.camera.position.copy(this.curPos);
    this.camera.lookAt(this.curLook);
  }
}

export const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
