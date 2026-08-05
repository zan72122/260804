// じゆうモード：好きなところを切って、積んで、打って、塗る。
import * as THREE from 'three';
import { Step, wiggle, popIn, popOut } from './step.js';
import { Plank } from '../world/workpiece.js';
import { makeNail } from '../world/tools.js';
import { paintSystem } from '../core/materials.js';
import { WOODS, FINISHES } from './blueprints.js';
import { clamp, lerp, damp, tween, wait, easeOutCubic, easeOutBack, rand, pick } from '../core/util.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = new THREE.Vector3(0, 1, 0);
const _tmp = new THREE.Vector3();

const SIZES = [
  { len: 0.42, thick: 0.028, wide: 0.16 },
  { len: 0.34, thick: 0.024, wide: 0.20 },
  { len: 0.28, thick: 0.03, wide: 0.12 },
  { len: 0.48, thick: 0.022, wide: 0.14 },
];

export class FreePlayStep extends Step {
  start() {
    const g = this.game;
    g.hud.setStepsVisible(false);
    g.hud.setGoalImage(null);
    g.focusOn(V(0, 0.10, 0.02), 0.52, { yaw: -0.2, pitch: 0.5 });
    this.pieces = [];
    this.mode = 'move';
    this.woodIndex = Math.max(0, WOODS.indexOf(g.wood));

    paintSystem.clear();
    paintSystem.enabled = 1;
    paintSystem.fill = 0;
    const dir = V(Math.sin(-0.26) * Math.cos(0.5), Math.sin(0.5), Math.cos(-0.26) * Math.cos(0.5));
    paintSystem.setProjection({ position: V(0, 0.1, 0).addScaledVector(dir, 1) }, V(0, 0.12, 0), 0.62);
    this.setFinish(FINISHES[1]);

    this._bar();
    this.addPlank(-0.26);
    wait(0.35).then(() => this.addPlank(0.26));
    g.say('すきなように つくってみよう');
    g.robot.lookAtWorld(V(0, 0.06, 0.1));
  }

  _bar() {
    const g = this.game;
    g.hud.showFreeBar(true, [
      { id: 'move', icon: 'hand', on: true, onPick: () => this.setMode('move') },
      { id: 'cut', icon: 'saw', onPick: () => this.setMode('cut') },
      { id: 'nail', icon: 'hammer', onPick: () => this.setMode('nail') },
      { id: 'paint', icon: 'paint', onPick: () => this.setMode('paint') },
      { id: 'add', icon: 'wood', onPick: () => this.addPlank() },
    ]);
    g.hud.setFreeMode('move');
  }

  setFinish(f) {
    this.finish = f;
    paintSystem.color.set(f.color);
    paintSystem.gloss = f.gloss;
    paintSystem.rainbow = f.rainbow;
    if (this.game.tools.brush) this.game.tools.brush.tip.material.color.set(f.rainbow ? '#ffd0e8' : f.color);
  }

  setMode(m) {
    const g = this.game;
    this.mode = m;
    g.hud.setFreeMode(m);
    g.hud.showPalette(m === 'paint', (f) => this.setFinish(f));
    this._showTool();
    const words = { move: 'うごかそう', cut: 'きろう', nail: 'トントン しよう', paint: 'ぬろう' };
    g.say(words[m]);
  }

  _showTool() {
    const g = this.game;
    const t = g.tools;
    for (const k of ['saw', 'hammer', 'brush']) {
      if (t[k].group.parent) t[k].group.parent.remove(t[k].group);
      t[k].group.visible = false;
    }
    const map = { cut: 'saw', nail: 'hammer', paint: 'brush' };
    const key = map[this.mode];
    if (!key) return;
    const tool = t[key];
    g.scene.add(tool.group);
    tool.group.visible = true;
    if (key === 'saw') tool.group.rotation.set(0, -Math.PI / 2, 0);
    else tool.group.rotation.set(0, 0, 0);
    tool.group.position.set(0, 0.22, 0.24);
    popIn(tool.group, 1, 0.35);
  }

  addPlank(x) {
    const g = this.game;
    if (this.pieces.length >= 8) return;
    const s = SIZES[this.pieces.length % SIZES.length];
    const wood = WOODS[(this.woodIndex + this.pieces.length) % WOODS.length];
    const p = new Plank({ len: s.len, thick: s.thick, wide: s.wide, wood });
    g.scene.add(p.group);
    const px = x !== undefined ? x : rand(-0.45, 0.45);
    p.setPosition(px, s.thick / 2, rand(0.16, 0.34));
    p.group.scale.setScalar(0.001);
    popIn(p.group, 1, 0.45);
    g.audio.pop();
    wait(0.3).then(() => g.audio.thunk(0.6));
    this.pieces.push(p);
  }

  _meshes() { return this.pieces.map((p) => p.mesh); }

  /* ------------- 入力 ------------- */
  down(e) {
    const g = this.game;
    g.guides.hide();
    if (this.mode === 'paint') { this.painting = true; this.move(e); return; }
    const hits = g.input.intersect(this._meshes(), false);
    const hit = hits[0];
    if (this.mode === 'move') {
      if (!hit) return;
      const p = hit.object.userData.plank;
      this.drag = p;
      this.dragY = p.group.position.y + 0.05;
      const gp = g.input.rayToPlane(UP, V(0, this.dragY, 0), _tmp);
      this.grabOff = gp ? p.group.position.clone().sub(gp) : V();
      this.grabOff.y = 0;
      g.audio.uiTap();
    } else if (this.mode === 'cut') {
      if (!hit) return;
      const p = hit.object.userData.plank;
      if (this.cutTarget !== p) {
        this.cutTarget = p;
        const local = p.group.worldToLocal(hit.point.clone());
        this.cutX = clamp(local.x, -p.len / 2 + 0.05, p.len / 2 - 0.05);
        p.removeGuide();
        p.addDashedGuide(this.cutX);
        p.ensureKerf(this.cutX);
        p.setKerfDepth(0.0001);
        this.depth = 0;
        g.audio.uiTap();
        g.say('ギコギコ！');
      }
      this._prevZ = null;
      this.sawing = true;
      this._placeSaw();
    } else if (this.mode === 'nail') {
      if (!hit) return;
      this.nailAt(hit);
    }
  }

  move(e) {
    const g = this.game;
    if (this.mode === 'move' && this.drag) {
      const gp = g.input.rayToPlane(UP, V(0, this.dragY, 0), _tmp);
      if (!gp) return;
      const w = gp.clone().add(this.grabOff);
      this.drag.group.position.x = clamp(w.x, -0.85, 0.85);
      this.drag.group.position.z = clamp(w.z, -0.38, 0.38);
      this.drag.group.position.y = this.dragY;
      g.robot.lookAtWorld(this.drag.group.position.clone());
      return;
    }
    if (this.mode === 'cut' && this.sawing && this.cutTarget) {
      const p = this.cutTarget;
      const topY = p.group.position.y + p.thick / 2;
      const hit = g.input.rayToPlane(UP, V(0, topY, 0), _tmp);
      if (!hit) return;
      const z = clamp(hit.z - p.group.position.z, -p.wide, p.wide);
      if (this._prevZ === null) { this._prevZ = z; this._prevX = hit.x; return; }
      const travel = Math.abs(z - this._prevZ) + Math.abs(hit.x - this._prevX) * 0.3;
      this._prevZ = z; this._prevX = hit.x;
      this.sawZ = z;
      this.speed = travel / 0.016;
      this.depth = clamp(this.depth + travel * 1.0, 0, 1);
      p.setKerfDepth(this.depth * p.thick);
      const contact = p.localToWorld(this.cutX, p.thick / 2 - this.depth * p.thick, z);
      g.dust.spawn(contact, { count: 2, speed: 0.4, size: 0.013, life: 0.7, color: new THREE.Color(p.wood.chip || '#e8c68e'), gravity: 2.0 });
      if (Math.random() < 0.5) g.chips.spawn(contact, { count: 1, speed: 0.3, floor: 0 });
      this._placeSaw();
      if (this.depth >= 0.99) this.doCut();
      return;
    }
    if (this.mode === 'paint' && this.painting) {
      const hits = g.input.intersect(this._meshes(), false);
      if (!hits.length) return;
      const p = hits[0].point;
      const prev = this._prevP;
      this._prevP = p.clone();
      if (prev) {
        const d = prev.distanceTo(p);
        const steps = clamp(Math.ceil(d / 0.02), 1, 8);
        for (let i = 1; i <= steps; i++) paintSystem.paintAt(prev.clone().lerp(p, i / steps), 0.05);
        this.speed = d / 0.016;
      } else {
        paintSystem.paintAt(p, 0.05);
      }
      const b = g.tools.brush.group;
      const n = hits[0].face ? hits[0].face.normal.clone().transformDirection(hits[0].object.matrixWorld) : UP.clone();
      b.position.copy(p).addScaledVector(n, 0.03);
      b.quaternion.setFromUnitVectors(UP, n);
      g.robot.setHandWorld('R', p.clone().addScaledVector(n, 0.14));
    }
  }

  up() {
    if (this.mode === 'move' && this.drag) {
      this.dropPiece(this.drag);
      this.drag = null;
    }
    this.sawing = false;
    this.painting = false;
    this._prevP = null;
    this._prevZ = null;
  }

  _placeSaw() {
    const g = this.game;
    const p = this.cutTarget;
    if (!p) return;
    const s = g.tools.saw.group;
    const y = p.group.position.y + p.thick / 2 + 0.045 - this.depth * p.thick;
    s.position.set(p.group.position.x + this.cutX, y, p.group.position.z + (this.sawZ ?? 0));
    s.rotation.set(0, -Math.PI / 2, 0);
    g.robot.setHandWorld('R', s.position.clone().add(V(0.02, 0.03, 0.22)));
  }

  doCut() {
    const g = this.game;
    const p = this.cutTarget;
    this.cutTarget = null;
    const [a, b] = p.split(this.cutX);
    g.scene.add(a.group);
    g.scene.add(b.group);
    p.group.parent && p.group.parent.remove(p.group);
    this.pieces = this.pieces.filter((x) => x !== p);
    this.pieces.push(a, b);
    g.audio.thunk(1);
    g.audio.chime(0);
    g.stage.punch(0.03);
    g.sparkles.burst(V(p.group.position.x + this.cutX, p.group.position.y + 0.02, p.group.position.z), { radius: 0.1, count: 18, color: '#ffe9a8' });
    g.dust.spawn(V(p.group.position.x + this.cutX, p.group.position.y, p.group.position.z), {
      count: 16, speed: 0.6, size: 0.018, life: 1.0, color: new THREE.Color(p.wood.chip || '#e8c68e'), gravity: 2.2,
    });
    tween({
      from: 0, to: 1, dur: 0.6, ease: easeOutCubic,
      onUpdate: (v) => { b.group.rotation.z = -v * 0.2; b.group.position.x += v * 0.0012; },
    });
    g.robot.cheer();
    g.say('きれた！');
  }

  /** 手を離した板を、下にあるものの上へ置く（積み木のように積める） */
  dropPiece(p) {
    const g = this.game;
    let top = 0;
    for (const q of this.pieces) {
      if (q === p) continue;
      const dx = Math.abs(q.group.position.x - p.group.position.x);
      const dz = Math.abs(q.group.position.z - p.group.position.z);
      if (dx < (q.len + p.len) * 0.42 && dz < (q.wide + p.wide) * 0.42) {
        top = Math.max(top, q.group.position.y + q.thick / 2);
      }
    }
    const targetY = top + p.thick / 2;
    const from = p.group.position.y;
    tween({
      from: 0, to: 1, dur: 0.26, ease: easeOutCubic,
      onUpdate: (v) => { p.group.position.y = lerp(from, targetY, v); },
      onDone: () => {
        g.audio.thunk(0.7);
        g.stage.punch(0.01);
        g.dust.spawn(V(p.group.position.x, targetY - p.thick / 2, p.group.position.z), {
          count: 5, speed: 0.25, size: 0.01, life: 0.5, color: new THREE.Color('#f0dcb4'), gravity: 1.4,
        });
      },
    });
  }

  nailAt(hit) {
    const g = this.game;
    if (this._nailCool > 0) return;
    this._nailCool = 0.3;
    const p = hit.object.userData.plank;
    const n = makeNail();
    const pos = hit.point.clone();
    pos.y = p.group.position.y + p.thick / 2;
    n.group.position.copy(pos).add(V(0, 0.03, 0));
    g.scene.add(n.group);
    const h = g.tools.hammer.group;
    const high = pos.clone().add(V(0, 0.22, 0));
    const low = pos.clone().add(V(0, 0.06, 0));
    tween({
      from: 0, to: 1, dur: 0.22,
      onUpdate: (v) => {
        const k = v < 0.34 ? v / 0.34 : 1 - (v - 0.34) / 0.66;
        h.position.lerpVectors(low, high, k * 0.9 + 0.1);
        g.robot.setHandWorld('R', h.position.clone().add(V(0.03, -0.02, 0.07)));
      },
      onDone: () => {
        g.audio.hammer(0);
        g.stage.punch(0.028);
        g.rings.pop(pos.clone().add(V(0, 0.002, 0)), { size: 0.07, color: '#ffffff', dur: 0.45 });
        g.dust.spawn(pos, { count: 6, speed: 0.5, size: 0.01, life: 0.5, color: new THREE.Color('#f0dcb4'), gravity: 2.2 });
        tween({
          from: 0.03, to: -0.004, dur: 0.16, ease: easeOutCubic,
          onUpdate: (v) => { n.group.position.y = pos.y + v; },
        });
        // 2 打目
        wait(0.18).then(() => {
          g.audio.hammer(1);
          g.audio.sparkle();
          g.sparkles.burst(pos, { radius: 0.04, count: 8, color: '#ffffff' });
        });
      },
    });
  }

  hint() {
    const g = this.game;
    const p = this.pieces[0];
    if (!p) return;
    if (this.mode === 'move') {
      g.guides.show(p.group.position.clone().add(V(0, 0.03, 0)), V(0, 0.06, 0), { color: '#8ff0c0' });
    } else if (this.mode === 'cut') {
      g.guides.show(p.group.position.clone().add(V(0, 0.03, -p.wide)), p.group.position.clone().add(V(0, 0.03, p.wide)), { pingPong: true, color: '#5ac8fa' });
    }
    g.audio.hint();
  }

  update(dt) {
    this._nailCool = Math.max(0, (this._nailCool || 0) - dt);
  }

  teardown() {
    const g = this.game;
    g.hud.showFreeBar(false);
    g.hud.showPalette(false);
    for (const k of ['saw', 'hammer', 'brush']) {
      if (g.tools[k].group.parent) g.tools[k].group.parent.remove(g.tools[k].group);
      g.tools[k].group.visible = false;
    }
    g.robot.releaseHands();
    g.guides.hide();
  }
}
