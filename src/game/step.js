// 工程の共通の枠組み。
// どの工程も「始める → 指で動かす → できたら次へ」だけで進む。
import * as THREE from 'three';
import { tween, easeOutBack, easeOutCubic, wait } from '../core/util.js';

export class Step {
  constructor(game, opts = {}) {
    this.game = game;
    this.opts = opts;
    this.done = false;
    this._hintTimer = 0;
    this.hintDelay = 4.0;
  }
  run() {
    return new Promise((res) => {
      this._res = res;
      this.game.setActiveStep(this);
      this.start();
    });
  }
  finish(delay = 0) {
    if (this.done) return;
    this.done = true;
    const end = () => {
      this.teardown();
      if (this.game.activeStep === this) this.game.setActiveStep(null);
      this._res && this._res();
    };
    if (delay > 0) wait(delay).then(end);
    else end();
  }
  // 以下はサブクラスが必要なものだけ実装する
  start() {}
  update(dt) {}
  teardown() {}
  hint() {}
  down() {}
  move() {}
  up() {}
}

/** 道具をちょっと揺らして「ここを触ってね」と伝える */
export function wiggle(obj, amount = 0.16) {
  const base = obj.rotation.z;
  return tween({
    from: 0, to: 1, dur: 0.7,
    onUpdate: (v) => {
      obj.rotation.z = base + Math.sin(v * Math.PI * 3) * amount * (1 - v);
    },
    onDone: () => { obj.rotation.z = base; },
  });
}

/** ぽんっと現れる */
export function popIn(obj, scale = 1, dur = 0.45, delay = 0) {
  obj.visible = true;
  obj.scale.setScalar(0.001);
  return tween({
    from: 0, to: scale, dur, delay, ease: easeOutBack,
    onUpdate: (v) => obj.scale.setScalar(Math.max(0.001, v)),
  });
}
export function popOut(obj, dur = 0.3) {
  const s = obj.scale.x;
  return tween({
    from: s, to: 0.001, dur, ease: easeOutCubic,
    onUpdate: (v) => obj.scale.setScalar(v),
    onDone: () => { obj.visible = false; },
  });
}
