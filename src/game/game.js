/**
 * 遊びの流れ。
 *
 * ① ガラスをなでてコケを落とす
 * ② 透明ホースをフィルターにつなぐ
 * ③ 底の落ち葉を吸いとる
 * → 水が澄んで、おさかなが帰ってくる
 *
 * 失敗・点数・時間制限・酸素ゲージは一切なし。
 * 指を離していても飼育員さんが少しずつ進めてくれる（強い補助）。
 */
import * as THREE from 'three';
import { TANK, CAMERA_FIT, fitHalfHeight } from '../world/config.js';
import { PORT_POS, HOSE_REST_CONNECTOR, HOSE_REST_NOZZLE } from '../world/equipment.js';
import { clamp, damp, dampV3, lerp, smoothstep, TAU } from '../core/util.js';

/** おちば掃除中、飼育員さんが向く方向。少しだけ下を見ながらこちらを向く。 */
const LEAF_LOOK = new THREE.Vector3(0, -0.28, 0.96).normalize();

export const STEPS = [
  { id: 'glass', icon: '🧽', text: 'ガラスを ゆびで なでてね', short: 'ガラスみがき' },
  { id: 'hose', icon: '🔌', text: 'ホースを フィルターに つなげてね', short: 'ホースつなぎ' },
  { id: 'leaf', icon: '🍂', text: 'そこの おちばを すいとってね', short: 'おちばそうじ' },
];

// これだけ触らないと、飼育員さんが自分で進める。
// 4 歳児が「なにをするのかな」と眺める時間を見込んで、少し長めにとってある。
const IDLE_ASSIST_DELAY = 4.5;

/**
 * 場面ごとのカメラ。
 * 作業している場所がいつも画面のまん中に来るように、そっと寄る。
 */
const CAM_POSES = {
  idle:   { y: 4.90, lookY: 4.60, lookZ: 0.0, dist: 0.0 },
  glass:  { y: 4.90, lookY: 4.70, lookZ: 0.0, dist: 0.0 },
  hose:   { y: 4.40, lookY: 2.90, lookZ: -0.5, dist: 0.7 },
  leaf:   { y: 4.35, lookY: 2.45, lookZ: -0.3, dist: 0.7 },
  finale: { y: 4.70, lookY: 4.40, lookZ: 0.0, dist: 0.0 },
};

export class Game {
  constructor(ctx) {
    Object.assign(this, ctx); // stage, input, audio, env, decor, diver, bubbles, equipment, glassDirt, leaves, school, sparkles, hud, shared
    this.state = 'title';
    this.step = -1;
    this.stepTime = 0;
    this.clarity = 0;
    this.clarityTarget = 0;
    this.hoseProgress = 0;
    this.finaleTime = 0;
    this.holding = 'none';

    this._raycaster = new THREE.Raycaster();
    this._v = new THREE.Vector3();
    this._v2 = new THREE.Vector3();
    this._hand = new THREE.Vector3();
    this._toolOffset = new THREE.Vector3();
    this._toolDir = new THREE.Vector3(0, 0, 1);
    this._pick = new THREE.Vector3();
    this._pickSmooth = new THREE.Vector3(0, 3.5, TANK.glassZ);
    this._hintPos = new THREE.Vector3();
    this._hintVisible = false;

    this.glassPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -(TANK.glassZ - 0.05));
    this.midPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.35);
    this.floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(TANK.floorY + 0.45));

    this.baseDist = 12;
    this.cam = { y: CAM_POSES.idle.y, lookY: CAM_POSES.idle.lookY, lookZ: 0, dist: 0 };
    this.camTarget = { ...CAM_POSES.idle };

    this.wipeSoundTimer = 0;
    this.bubbleSoundTimer = 0;

    this._buildHintRing();
    this._attachSponge();

    // 遊び場の内側マージン（NDC）。HUD の下に潜り込まないようにする。
    // 縦持ちと横持ちで HUD の位置が違うので、layout() で入れ替える。
    this.insets = { x: 0.16, top: 0.32, bottom: 0.36 };
    this.rect = { minX: -2, maxX: 2, minY: 1, maxY: 5 };
  }

  _attachSponge() {
    const sponge = this.equipment.sponge;
    this.equipment.group.remove(sponge);
    this.diver.hand.add(sponge);
    // 顔や体にかぶらないよう、少し下・少し斜めに構えさせる
    sponge.position.set(0.06, -0.20, 0.26);
    sponge.rotation.set(-0.35, 0.45, 0.18);
    sponge.visible = false;
  }

  _buildHintRing() {
    this.hint = new THREE.Group();
    this.hintRings = [];
    for (let i = 0; i < 2; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xfff2a8,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.30, 0.040, 8, 36), mat);
      ring.renderOrder = 30;
      this.hint.add(ring);
      this.hintRings.push({ mesh: ring, mat, phase: i * 0.5 });
    }
    this.hint.visible = false;
    this.stage.scene.add(this.hint);
  }

  // ---------------------------------------------------------------- カメラ

  layout(width, height) {
    const cam = this.stage.camera;
    const aspect = width / height;
    const t = Math.tan(THREE.MathUtils.degToRad(CAMERA_FIT.fov) / 2);
    // 縦にも横にも、遊ぶのに必要な広さを必ず確保できる距離
    this.baseDist = Math.max(
      fitHalfHeight(aspect) / t,
      CAMERA_FIT.minHalfWidth / (t * aspect)
    );
    cam.fov = CAMERA_FIT.fov;

    // 縦持ちのときは、下の操作パネルぶんだけ絵を上へ寄せる
    const portrait = aspect < 0.95;
    cam.clearViewOffset();
    if (portrait) {
      cam.setViewOffset(width, height, 0, height * 0.075, width, height);
    }
    cam.updateProjectionMatrix();
    this.portrait = portrait;
    // 横持ちは上に札とすすみ表示、下は空き。縦持ちは上下どちらにも HUD がある。
    this.insets = portrait
      ? { x: 0.16, top: 0.30, bottom: 0.34 }
      : { x: 0.13, top: 0.38, bottom: 0.20 };
    this._applyCamera();
  }

  /** 場面に合わせてカメラをそっと動かす。急な動きは 4 歳児には酔いのもと。 */
  _updateCamera(dt) {
    let pose = CAM_POSES.idle;
    if (this.state === 'playing' && STEPS[this.step]) pose = CAM_POSES[STEPS[this.step].id] || CAM_POSES.idle;
    else if (this.state === 'finale' || this.state === 'clear') pose = CAM_POSES.finale;
    this.camTarget = pose;
    this.cam.y = damp(this.cam.y, pose.y, 0.08, dt);
    this.cam.lookY = damp(this.cam.lookY, pose.lookY, 0.08, dt);
    this.cam.lookZ = damp(this.cam.lookZ, pose.lookZ, 0.08, dt);
    this.cam.dist = damp(this.cam.dist, pose.dist, 0.08, dt);
    this._applyCamera();
  }

  _applyCamera() {
    const cam = this.stage.camera;
    cam.position.set(0, this.cam.y, this.baseDist + this.cam.dist);
    cam.lookAt(0, this.cam.lookY, this.cam.lookZ);
    cam.updateMatrixWorld();
  }

  /** 画面に確実に映る、平面上の長方形（ワールド座標）を求める。 */
  rectOnPlane(plane, out = {}) {
    const cam = this.stage.camera;
    const { x, top, bottom } = this.insets;
    const corners = [
      [-1 + x, 1 - top], [1 - x, 1 - top],
      [-1 + x, -1 + bottom], [1 - x, -1 + bottom],
    ];
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    let ok = false;
    for (const [nx, ny] of corners) {
      this._raycaster.setFromCamera({ x: nx, y: ny }, cam);
      const p = this._raycaster.ray.intersectPlane(plane, this._v2);
      if (!p) continue;
      ok = true;
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
      minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
    }
    if (!ok) { minX = -2; maxX = 2; minY = 1; maxY = 5; minZ = -2; maxZ = 2; }
    out.minX = minX; out.maxX = maxX;
    out.minY = minY; out.maxY = maxY;
    out.minZ = minZ; out.maxZ = maxZ;
    return out;
  }

  // ---------------------------------------------------------------- 進行

  start() {
    this.state = 'playing';
    this.step = -1;
    this.nextStep();
  }

  restart() {
    this.glassDirt.reset();
    this.leaves.reset();
    this.equipment.reset();
    this.school.reset();
    this.hoseProgress = 0;
    this.snapping = false;
    this.snapT = 0;
    this._autoTimer = 0;
    this._leafStall = 0;
    this._lastLeafProgress = -1;
    this.finaleTime = 0;
    this.clarity = 0;
    this.clarityTarget = 0;
    this.env.setClarity(0);
    this.hud.showHud();
    this.start();
  }

  nextStep() {
    this.step++;
    this.stepTime = 0;
    if (this.step >= STEPS.length) {
      this.beginFinale();
      return;
    }
    const s = STEPS[this.step];
    this.hud.setTask(this.step, s);
    this.audio.chime(this.step + 1);
    // 新しいお題ごとに、自分でやってみる時間をあらためて用意する
    this.input.lastActivity = performance.now() / 1000;

    if (s.id === 'glass') {
      this.holding = 'sponge';
      this.equipment.sponge.visible = true;
      this._pickSmooth.set(0, 3.6, TANK.glassZ);
    } else if (s.id === 'hose') {
      this.holding = 'connector';
      this.equipment.sponge.visible = false;
      this.equipment.portHint = true;
      this._pickSmooth.copy(HOSE_REST_CONNECTOR);
    } else if (s.id === 'leaf') {
      this.holding = 'nozzle';
      this.equipment.portHint = false;
      this._pickSmooth.copy(HOSE_REST_NOZZLE);
    }
  }

  beginFinale() {
    this.state = 'finale';
    this.finaleTime = 0;
    this.holding = 'none';
    this.equipment.suction = 0;
    this.hud.setTask(-1, { icon: '🐠', text: 'おさかなが かえってくるよ' });
    this.audio.suction(false);
    this.audio.fanfare();
    this.school.release();
    this.hint.visible = false;
    this.hud.hideFinger();
  }

  // ---------------------------------------------------------------- 更新

  update(dt, time) {
    this._updateCamera(dt);
    const idle = performance.now() / 1000 - this.input.lastActivity;
    const assisting = this.state === 'playing' && idle > IDLE_ASSIST_DELAY;
    this.assisting = assisting;

    if (this.state === 'playing') {
      const s = STEPS[this.step];
      this.stepTime += dt;
      if (s.id === 'glass') this._updateGlass(dt, time, assisting);
      else if (s.id === 'hose') this._updateHose(dt, time, assisting);
      else if (s.id === 'leaf') this._updateLeaf(dt, time, assisting);
    } else if (this.state === 'finale') {
      this._updateFinale(dt, time);
    } else {
      this._updateIdlePose(dt, time);
    }

    // 水の澄みぐあい
    const glassP = this.glassDirt.progress;
    const leafP = this.leaves.progress;
    // 掃除で 0.82 まで澄み、最後のごほうびで一気に 1.0 まで抜ける
    this.clarityTarget = clamp(glassP * 0.30 + this.hoseProgress * 0.22 + leafP * 0.30, 0, 1);
    if (this.state === 'finale') this.clarityTarget = 1;
    this.clarity = damp(this.clarity, this.clarityTarget, 0.25, dt);
    this.env.setClarity(this.clarity);
    this.shared.flow.value = this.equipment.filterRunning ? 0.55 : 0.0;
    this.stage.compositeMat.uniforms.uWobble.value = lerp(1.8, 0.75, this.clarity);
    this.stage.compositeMat.uniforms.uCaustics.value = lerp(0.006, 0.020, this.clarity);
    this.stage.compositeMat.uniforms.uBloom.value = lerp(0.48, 0.78, this.clarity);

    // 汚れの絵は毎フレーム面倒を見る（変化があったときだけ描き直される）
    this.glassDirt.update();
    this._updateHint(dt, time);
    this.hud.setProgress(this.step, this._stepProgress());
  }

  _stepProgress() {
    if (this.state !== 'playing') return 1;
    const s = STEPS[this.step];
    if (!s) return 1;
    if (s.id === 'glass') return this.glassDirt.progress;
    if (s.id === 'hose') return this.hoseProgress;
    return this.leaves.progress;
  }

  _updateIdlePose(dt, time) {
    this._v.set(Math.sin(time * 0.25) * 1.2, 4.4 + Math.sin(time * 0.4) * 0.25, 1.2);
    this.diver.moveTo(this._v, this._v2.set(this._v.x, this._v.y, TANK.glassZ + 4));
    this.diver.setWorking(false);
  }

  // -------------------------------------------------- ① ガラスみがき

  _updateGlass(dt, time, assisting) {
    this.rectOnPlane(this.glassPlane, this.rect);
    const r = this.rect;
    const minX = Math.max(r.minX, -TANK.halfW + 0.5);
    const maxX = Math.min(r.maxX, TANK.halfW - 0.5);
    const minY = Math.max(r.minY, 0.8);
    const maxY = Math.min(r.maxY, TANK.waterY - 0.7);

    let working = false;
    if (this.input.down) {
      const p = this.input.pickOnPlane(this.stage.camera, this.glassPlane, this._pick);
      if (p) {
        p.x = clamp(p.x, minX, maxX);
        p.y = clamp(p.y, minY, maxY);
        dampV3(this._pickSmooth, p, 0.00002, dt);
        working = true;
      }
    } else if (assisting) {
      // 触っていない間は、いちばん近い汚れへ自分で向かう
      const near = this.glassDirt.nearestDirty(this._pickSmooth.x, this._pickSmooth.y, {
        minX, maxX, minY, maxY,
      });
      if (near) {
        this._v.set(near.x, near.y, TANK.glassZ);
        dampV3(this._pickSmooth, this._v, 0.35, dt);
        working = true;
      }
    }

    this.diver.setToolPitch(0);
    const px = this._pickSmooth.x, py = this._pickSmooth.y;
    // スポンジは手より少し下に構えているので、その分だけ体を持ち上げて
    // 「指でなぞった所」と「磨かれる所」を一致させる。
    this._v.set(px, py + 0.24, TANK.glassZ - 1.05);
    this._v2.set(px, py + 0.24, TANK.glassZ + 3);
    this.diver.moveTo(this._v, this._v2);
    this.diver.setWorking(working);

    if (working) {
      const sponge = this.equipment.sponge;
      sponge.getWorldPosition(this._hand);
      const strength = (this.input.down ? 1.9 : 1.4) * dt;
      const removed = this.glassDirt.wipe(this._hand.x, this._hand.y, 0.95, strength);
      if (removed > 0.00001) {
        this.wipeSoundTimer -= dt;
        if (this.wipeSoundTimer <= 0) {
          this.wipeSoundTimer = 0.20;
          this.audio.wipe(0.13);
        }
        if (Math.random() < dt * 22) {
          this.sparkles.spawn(
            this._hand.x + (Math.random() - 0.5) * 0.7,
            this._hand.y + (Math.random() - 0.5) * 0.7,
            TANK.glassZ - 0.2,
            { color: [1.0, 1.0, 0.85], size: 0.16 }
          );
        }
        if (Math.random() < dt * 9) {
          this.bubbles.spawn(this._hand.x + (Math.random() - 0.5) * 0.4, this._hand.y - 0.1, TANK.glassZ - 0.35, { r: 0.03 + Math.random() * 0.05 });
        }
      }
    }
    // 仕上げ。最後のひとかけらで止まらないように。
    // 「もう画面の中に届く汚れがない」ときも、必ず仕上げに入る。
    const reachable = this.glassDirt.nearestDirty(px, py, { minX, maxX, minY, maxY });
    if (this.glassDirt.progress > 0.82 || !reachable) {
      this.glassDirt.autoFinish(dt, 1.3);
      if (this.glassDirt.progress > 0.999) {
        this.sparkles.burst(0, 3.6, TANK.glassZ - 0.3, 26, { color: [1, 1, 0.9], size: 0.22, spread: 3.4, life: 1.4 });
        this.nextStep();
      }
    }
  }

  // -------------------------------------------------- ② ホースをつなぐ

  _updateHose(dt, time, assisting) {
    const eq = this.equipment;

    // 最初の 1.2 秒は、飼育員さんが口金を拾いに行くところを見せる
    const grabbing = this.stepTime < 1.2;

    this.rectOnPlane(this.midPlane, this.rect);
    const r = this.rect;
    const minX = Math.max(r.minX, -TANK.halfW + 0.8);
    const maxX = Math.min(r.maxX, TANK.halfW - 0.8);
    const minY = Math.max(r.minY, 0.9);
    const maxY = Math.min(r.maxY, TANK.waterY - 0.9);

    if (grabbing) {
      // 口金の置き場所へ向かう
      dampV3(this._pickSmooth, HOSE_REST_CONNECTOR, 0.02, dt);
    } else if (!this.snapping) {
      if (this.input.down) {
        const p = this.input.pickOnPlane(this.stage.camera, this.midPlane, this._pick);
        if (p) {
          p.x = clamp(p.x, minX, maxX);
          p.y = clamp(p.y, minY, maxY);
          dampV3(this._pickSmooth, p, 0.00002, dt);
          // 強い補助：ドラッグ中はつなぎ口へじわじわ引き寄せられる
          this._pickSmooth.lerp(PORT_POS, Math.min(1, dt * 0.35));
        }
      } else if (assisting) {
        dampV3(this._pickSmooth, PORT_POS, 0.25, dt);
      } else {
        // 指を離している間も、口金は水中をゆっくり漂う
        this._pickSmooth.z = damp(this._pickSmooth.z, PORT_POS.z + 0.6, 0.5, dt);
      }
    }

    // 飼育員さんは、つなぎ口のほうを向いて口金を差し出す
    this.diver.setToolPitch(0.18);
    this._v2.copy(PORT_POS).sub(this._pickSmooth);
    if (this._v2.lengthSq() < 0.04) this._v2.set(0, 0, -1);
    this._v2.normalize();
    this._v.copy(this._pickSmooth).addScaledVector(this._v2, -0.66);
    this._v.z = clamp(this._v.z, TANK.backZ + 1.0, TANK.glassZ - 0.6);
    this.diver.moveTo(this._v, this._pickSmooth);
    this.diver.setWorking(this.input.down || assisting);

    this.diver.handWorldPosition(this._hand);
    if (!this.snapping) {
      if (grabbing) {
        // 砂の上の口金が、手のひらへ吸い付くように移る
        eq.connectorPos.lerpVectors(HOSE_REST_CONNECTOR, this._hand, smoothstep(0.65, 1.2, this.stepTime));
      } else {
        eq.connectorPos.copy(this._hand);
      }
    }
    eq.connectorDir.copy(eq.connectorPos).sub(PORT_POS);
    if (eq.connectorDir.lengthSq() < 0.01) eq.connectorDir.set(0, 1, 0.4);
    eq.connectorDir.normalize();

    // つなぎ口に近づいたら、ぱちんと吸い付く
    const dist = eq.connectorPos.distanceTo(PORT_POS);
    if (!this.snapping && !grabbing && dist < 1.7) {
      this.snapping = true;
      this.snapT = 0;
      this.snapFrom = eq.connectorPos.clone();
      this.audio.click(0.28);
    }
    if (this.snapping) {
      this.snapT = Math.min(1, this.snapT + dt * 2.2);
      const k = 1 - Math.pow(1 - this.snapT, 3);
      eq.connectorPos.lerpVectors(this.snapFrom, PORT_POS, k);
      this.hoseProgress = k;
      // 飼育員さんも一緒に近づく
      this._v.copy(PORT_POS).add(new THREE.Vector3(0.9, 0.5, 1.5));
      this.diver.moveTo(this._v, PORT_POS);
      if (this.snapT >= 1) {
        this.snapping = false;
        eq.setConnected(true);
        eq.filterRunning = true;
        eq.portHint = false;
        this.audio.click(0.36);
        this.audio.chime(3, 0.26);
        this.sparkles.burst(PORT_POS.x, PORT_POS.y, PORT_POS.z + 0.3, 26, { color: [0.7, 1, 1], size: 0.2, spread: 2.6, life: 1.3 });
        this.bubbles.burst(PORT_POS.x, PORT_POS.y, PORT_POS.z + 0.3, 16, 0.4);
        this.hoseProgress = 1;
        this.nextStep();
      }
    }
  }

  // -------------------------------------------------- ③ おちばそうじ

  _updateLeaf(dt, time, assisting) {
    const eq = this.equipment;
    // 底は画面の下寄りに来るので、レイの当たり方に頼らず固定の遊び場にする。
    // 落ち葉はこの範囲の中にしか置かないので、必ず全部に手が届く。
    const minX = -2.7, maxX = 2.7;
    const minZ = -2.5, maxZ = 2.6;

    let sucking = false;
    if (this.input.down) {
      const p = this.input.pickOnPlane(this.stage.camera, this.floorPlane, this._pick);
      if (p) {
        p.x = clamp(p.x, minX, maxX);
        p.z = clamp(p.z, minZ, maxZ);
        p.y = TANK.floorY + 0.45;
        dampV3(this._pickSmooth, p, 0.00002, dt);
        sucking = true;
      }
    } else if (assisting) {
      const near = this.leaves.nearest(this._pickSmooth);
      if (near) {
        this._v.copy(near.mesh.position);
        this._v.y = TANK.floorY + 0.45;
        dampV3(this._pickSmooth, this._v, 0.30, dt);
        sucking = true;
      }
    }

    // こちらを向いたまま、ノズルだけを下に向けて掃除する。
    // ノズルの先が指した所にぴたりと来るよう、道具の位置から逆算して立ち位置を決める。
    this.diver.setToolPitch(1.15);
    this.diver.toolOffsetWorld(this._toolOffset);
    this.diver.toolDirWorld(this._toolDir);

    this._v.set(this._pickSmooth.x, TANK.floorY + 0.18, this._pickSmooth.z)
      .sub(this._toolOffset)
      .addScaledVector(this._toolDir, -0.48);
    this._v.z = clamp(this._v.z, TANK.backZ + 0.9, TANK.glassZ - 0.5);
    this._v.y = clamp(this._v.y, TANK.floorY + 0.9, TANK.waterY - 1.2);
    this._v2.copy(this._v).add(LEAF_LOOK);
    this.diver.moveTo(this._v, this._v2);
    this.diver.setWorking(sucking);

    this.diver.handWorldPosition(this._hand);
    eq.nozzlePos.copy(this._hand);
    eq.nozzleDir.copy(this._toolDir).negate();

    // 吸い込み口はノズルの先端
    const mouth = this._v2.copy(eq.nozzlePos).addScaledVector(this._toolDir, 0.48);
    eq.suction = damp(eq.suction, sucking ? 1 : 0, 0.01, dt);
    this.audio.suction(sucking);

    const pulled = this.leaves.suck(mouth, sucking, 1.45, dt);
    if (pulled > 0) this.audio.bubble(1.4, 0.18);
    if (sucking && Math.random() < dt * 14) {
      this.bubbles.spawn(mouth.x + (Math.random() - 0.5) * 0.4, mouth.y + 0.2, mouth.z + (Math.random() - 0.5) * 0.4, { r: 0.025 + Math.random() * 0.05 });
    }
    if (sucking && Math.random() < dt * 10) {
      this.sparkles.spawn(mouth.x + (Math.random() - 0.5) * 0.9, mouth.y + 0.1, mouth.z + (Math.random() - 0.5) * 0.9,
        { color: [0.7, 1.0, 0.95], size: 0.13 });
    }

    this.leaves.update(dt, time, mouth);

    // 取り残しの保険。しばらく減らないときも、自動で片づけて先へ進める。
    const p = this.leaves.progress;
    if (p !== this._lastLeafProgress) {
      this._lastLeafProgress = p;
      this._leafStall = 0;
    } else {
      this._leafStall = (this._leafStall || 0) + dt;
    }
    if (p > 0.82 || this._leafStall > 8) {
      this._autoTimer = (this._autoTimer || 0) + dt;
      if (this._autoTimer > 0.2) {
        this._autoTimer = 0;
        this.leaves.autoCollect();
      }
    }
    if (this.leaves.progress > 0.999) {
      this.audio.suction(false);
      this.nextStep();
    }
  }

  // -------------------------------------------------- ごほうび

  _updateFinale(dt, time) {
    this.finaleTime += dt;
    const eq = this.equipment;
    eq.suction = damp(eq.suction, 0, 0.01, dt);

    // 道具を置いて、水面へゆっくり上がっていく
    const t = this.finaleTime;
    const up = smoothstep(0.6, 4.0, t);
    // 上がりすぎると画面の外に出てしまうので、見送りの位置は少し低めに
    this._v.set(
      lerp(this._pickSmooth.x, 3.1, up),
      lerp(1.8, TANK.waterY - 2.2, up),
      lerp(this._pickSmooth.z, 1.5, up)
    );
    this.diver.moveTo(this._v, this._v2.set(this._v.x, this._v.y + 0.4, TANK.glassZ + 3));
    this.diver.setWorking(false);

    eq.nozzlePos.lerp(HOSE_REST_NOZZLE, Math.min(1, dt * 1.4));
    eq.nozzleDir.set(0, 1, 0.4).normalize();

    // 帰ってきたおさかなに合わせて、きらきらを散らす
    if (t < 6 && Math.random() < dt * 16) {
      this.sparkles.spawn(
        (Math.random() - 0.5) * (TANK.halfW * 1.6),
        1 + Math.random() * (TANK.waterY - 1.5),
        (Math.random() - 0.5) * (TANK.halfD * 1.4),
        { color: [1, 1, 0.9], size: 0.18, life: 1.4 }
      );
    }
    if (Math.random() < dt * 3) {
      this.bubbles.spawn((Math.random() - 0.5) * TANK.halfW * 1.6, 0.4, (Math.random() - 0.5) * TANK.halfD, { r: 0.05 });
    }

    // おさかなをゆっくり眺める時間をとってから、おしまいの画面を出す
    if (this.finaleTime > 7.0 && this.state === 'finale') {
      this.state = 'clear';
      this.hud.showClear();
    }
  }

  // -------------------------------------------------- ヒント

  _updateHint(dt, time) {
    let show = false;
    if (this.state === 'playing') {
      const s = STEPS[this.step];
      if (s.id === 'glass') {
        const near = this.glassDirt.nearestDirty(this._pickSmooth.x, this._pickSmooth.y, this.rect);
        if (near) { this._hintPos.set(near.x, near.y, TANK.glassZ - 0.25); show = true; }
      } else if (s.id === 'hose') {
        this._hintPos.copy(PORT_POS).add(this._v.set(0, 0, 0.25));
        show = !this.snapping;
      } else if (s.id === 'leaf') {
        const near = this.leaves.nearest(this._pickSmooth);
        if (near) { this._hintPos.copy(near.mesh.position).y += 0.35; show = true; }
      }
    }

    this._hintVisible = show;
    this.hint.visible = show;
    if (show) {
      this.hint.position.copy(this._hintPos);
      this.hint.quaternion.copy(this.stage.camera.quaternion);
      // 指を置いていないときほど、はっきり呼びかける
      const urgency = clamp((performance.now() / 1000 - this.input.lastActivity) / 2.0, 0.25, 1);
      for (const r of this.hintRings) {
        const k = (time * 0.9 + r.phase) % 1;
        r.mesh.scale.setScalar(0.55 + k * 1.15);
        r.mat.opacity = (1 - k) * 0.55 * urgency;
      }
      this.hud.showFinger(this._hintPos, this.stage.camera, urgency);
    } else {
      this.hud.hideFinger();
    }
  }
}
